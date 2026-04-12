// stats.js — Extract per-player statistics from a getMatch API response

/**
 * Convert an event's time_sec to absolute match time.
 * time_sec resets to 0 at the start of each period (half),
 * so we offset by (period - 1) * 2700 (45 minutes per half).
 */
function absoluteTimeSec(event) {
  const period = parseInt(event.period) || 1;
  return (event.time_sec || 0) + (period - 1) * 2700;
}

/**
 * Extract player stats from the match API response.
 * @param {Object} data - Full API response (with .match property)
 * @returns {Object} { matchInfo, players[] }
 */
function extractMatchStats(data) {
  const match = data.match;

  const matchInfo = {
    matchId: match.match_id,
    date: match.date,
    round: match.round_id,
    roundName: match.round_name || `Round ${match.round_id}`,
    teamA: {
      id: match.team_A_id,
      name: match.team_A_name
    },
    teamB: {
      id: match.team_B_id,
      name: match.team_B_name
    },
    scoreA: match.fs_A,
    scoreB: match.fs_B,
    category: match.category_name
  };

  // Build lookup: player_id -> own goals count from events
  const ownGoals = countOwnGoals(match);

  // Build lookup: player_id -> penalties missed count from events
  const penaltiesMissed = countPenaltiesMissed(match);

  // Build lookup: player_id -> conceded goals (all players, not just GK)
  const conceded = countConcededGoals(match);

  // Process lineups into player stat rows
  const players = (match.lineups || []).map(player => {
    const teamName = player.team_id === match.team_A_id
      ? match.team_A_name
      : match.team_B_name;

    const playerId = String(player.player_id);

    return {
      playerName: formatPlayerName(player.player_name),
      playerId: playerId,
      position: player.position_en || player.position || '',
      positionAbbr: getPositionAbbr(player.position_en, player.position),
      team: teamName,
      round: match.round_id,
      minutesPlayed: player.playing_time_min || 0,
      goals: player.goals || 0,
      assists: player.assists || 0,
      yellowCards: player.warnings || 0,
      redCards: player.disqualifications || 0,
      saves: player.saves || 0,
      concededGoals: conceded[playerId] || 0,
      ownGoals: ownGoals[playerId] || 0,
      penaltiesMissed: penaltiesMissed[playerId] || 0,
      totalPoints: 0 // placeholder
    };
  });

  return { matchInfo, players };
}

/**
 * Count own goals from match events.
 * An own goal is a "maali" event where the scoring team differs from the
 * player's team. In the data, the `team` field on a maali event indicates
 * which team scored. If the event's team_id differs from the player's
 * team in the lineups, it's an own goal. However, looking at the data more
 * carefully: the `maali` event is attributed to the player who scored,
 * and the team field shows which team they play for. An own goal would be
 * when the goal benefits the opposing team — which in this API appears
 * to be tracked by the score changing for the opposite side. We detect
 * own goals by checking: if a `maali` event's `team` is "A" but the score
 * increased for B (or vice versa).
 */
function countOwnGoals(match) {
  const counts = {};
  const events = match.events || [];

  for (const event of events) {
    if (event.code !== 'maali') continue;

    // Determine if this is an own goal by checking if the scoring team's
    // score actually increased. The event has s_A and s_B (cumulative score).
    // The team field tells us which team the player belongs to.
    // If team is "A" but the B score went up (or vice versa), it's an own goal.
    // Actually, let's use a simpler heuristic: check description for "om" (oma maali)
    // or check if team attribution doesn't match the score change.

    // The description field contains the score like "1-0", "2-1" etc.
    // We can check: if team is "A" and B's score is the one that just changed
    const desc = event.description || '';
    const scoreMatch = desc.match(/^(\d+)-(\d+)$/);
    if (!scoreMatch) continue;

    const scoreA = parseInt(scoreMatch[1]);
    const scoreB = parseInt(scoreMatch[2]);

    // If player is on team A but score B increased, it's an own goal
    // If player is on team B but score A increased, it's an own goal
    // We rely on s_A/s_B to tell us the score AFTER this goal
    const isTeamA = event.team === 'A';

    // The current score after this event
    const currentScoreA = event.s_A;
    const currentScoreB = event.s_B;

    // Compare: the description shows the new score. If team A player
    // and the new scoreB > previous scoreB, it's own goal.
    // Simpler: if the player's team is A, the A score in description
    // should have gone up. If B score went up instead, it's own goal.
    if (isTeamA && currentScoreB === scoreB && currentScoreA < scoreA) {
      // B score went up from an A player — own goal (this logic is tricky)
    }

    // Actually, let's use the most reliable approach:
    // team "A" player scoring should make s_A go up
    // If a team "A" player's goal event shows s_B went up, it's own goal
    // But we don't have the previous score easily... let's just check
    // if description score attribution matches the team.
    // Score format is "X-Y" where X = team A score, Y = team B score
    // If team A player and Y > previous Y → own goal
    // Simpler: the last digit that changed tells us which team benefited.

    // Most reliable: for team A player, if scoreA matches their team's
    // expected contribution. An own goal by team A player increases scoreB.
    // Check: does the event's score show the player's team score being
    // the one that's higher than what it would be without this goal?

    // Let's use a practical approach: we'll track running score
    // and compare. But that requires sorting events.
    // For now, skip and use a different method below.
  }

  // Alternative approach: track goal events in order and check score changes
  const goalEvents = events
    .filter(e => e.code === 'maali')
    .sort((a, b) => absoluteTimeSec(a) - absoluteTimeSec(b));

  let prevA = 0;
  let prevB = 0;

  for (const event of goalEvents) {
    const playerId = String(event.player_id);
    const isTeamA = event.team === 'A';
    const currentA = event.s_A;
    const currentB = event.s_B;

    // Determine which score increased
    const aIncreased = currentA > prevA;
    const bIncreased = currentB > prevB;

    // Own goal: team A player but B score went up, or team B player but A score went up
    if ((isTeamA && bIncreased && !aIncreased) ||
        (!isTeamA && aIncreased && !bIncreased)) {
      counts[playerId] = (counts[playerId] || 0) + 1;
    }

    prevA = currentA;
    prevB = currentB;
  }

  return counts;
}

/**
 * Count penalties missed from match events.
 * A penalty miss is detected by:
 * - code "laukausohi" (shot off target) with description "rp" (rangaistuspotku = penalty kick)
 * - code "laukaus" (shot on target / saved) with description "rp" — the GK saved it,
 *   so the taker missed too (tracked via the taker's shot event, not the GK save)
 * - code "laukausblokattu" with description "rp"
 * 
 * Basically any shot event (laukaus, laukausohi, laukausblokattu) where description
 * contains "rp" AND there was no corresponding "maali" event with "rp" for the same
 * sequence means the penalty was not converted.
 * 
 * Simplest reliable approach: count laukausohi+rp and laukaus+rp (saved penalties)
 * per player, since a converted penalty would show as laukausmaali, not laukaus/laukausohi.
 */
function countPenaltiesMissed(match) {
  const counts = {};
  const events = match.events || [];

  for (const event of events) {
    const desc = (event.description || '').toLowerCase();
    if (desc !== 'rp') continue;

    // Penalty shot that was NOT a goal (laukausohi = off target, laukaus = on target but saved,
    // laukausblokattu = blocked)
    if (event.code === 'laukausohi' || event.code === 'laukaus' || event.code === 'laukausblokattu') {
      const playerId = String(event.player_id);
      counts[playerId] = (counts[playerId] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Count conceded goals per player based on which goals happened
 * while the player was on the pitch.
 * Uses substitution events to determine each player's time window,
 * then counts opposing team's goals within that window.
 */
function countConcededGoals(match) {
  const events = match.events || [];
  const lineups = match.lineups || [];

  // Get all goals sorted by absolute time
  const goalEvents = events
    .filter(e => e.code === 'maali')
    .sort((a, b) => absoluteTimeSec(a) - absoluteTimeSec(b));

  // Determine the last event time as match end (using absolute time)
  const matchEndSec = events.reduce((max, e) => Math.max(max, absoluteTimeSec(e)), 0);

  // Build per-player on-pitch intervals: [startSec, endSec]
  // Starters: start at 0, end at sub-out time or match end
  // Substitutes: start at sub-in time, end at sub-out time or match end
  const subInTimes = {};  // player_id -> time_sec they came on
  const subOutTimes = {}; // player_id -> time_sec they went off

  for (const event of events) {
    if (event.code !== 'vaihto') continue;
    const pid = String(event.player_id);
    if (event.description === '+') {
      subInTimes[pid] = absoluteTimeSec(event);
    } else if (event.description === '-') {
      subOutTimes[pid] = absoluteTimeSec(event);
    }
  }

  const counts = {};

  for (const player of lineups) {
    const pid = String(player.player_id);
    const isTeamA = player.team_id === match.team_A_id;

    // Determine on-pitch window
    const isStarter = player.start === '1' || player.start === 1;
    const onSec = isStarter ? 0 : (subInTimes[pid] || 0);
    const offSec = subOutTimes[pid] !== undefined ? subOutTimes[pid] : matchEndSec;

    // Skip players who never played
    if ((player.playing_time_min || 0) === 0) continue;

    // Count opposing goals during this player's time on pitch
    let conceded = 0;
    for (const goal of goalEvents) {
      if (absoluteTimeSec(goal) < onSec || absoluteTimeSec(goal) > offSec) continue;
    }

    counts[pid] = conceded;
  }

  // More reliable: track running score and attribute to players on pitch
  // Reset and use running-score approach
  for (const pid of Object.keys(counts)) counts[pid] = 0;

  let prevA = 0;
  let prevB = 0;

  for (const goal of goalEvents) {
    const currentA = goal.s_A;
    const currentB = goal.s_B;
    const aScored = currentA > prevA;
    const bScored = currentB > prevB;

    for (const player of lineups) {
      const pid = String(player.player_id);
      if ((player.playing_time_min || 0) === 0) continue;

      const isTeamA = player.team_id === match.team_A_id;
      const isStarter = player.start === '1' || player.start === 1;
      const onSec = isStarter ? 0 : (subInTimes[pid] || 0);
      const offSec = subOutTimes[pid] !== undefined ? subOutTimes[pid] : matchEndSec;

      // Was this player on pitch when the goal happened?
      if (absoluteTimeSec(goal) < onSec || absoluteTimeSec(goal) > offSec) continue;

      // Did the opposing team's score increase?
      if (isTeamA && bScored) {
        counts[pid] = (counts[pid] || 0) + 1;
      } else if (!isTeamA && aScored) {
        counts[pid] = (counts[pid] || 0) + 1;
      }
    }

    prevA = currentA;
    prevB = currentB;
  }

  return counts;
}

/**
 * Map position to Finnish abbreviation:
 * V = maalivahti (goalkeeper), P = puolustaja (defender),
 * KK = keskikenttä (midfielder), H = hyökkääjä (forward)
 */
function getPositionAbbr(posEn, posFi) {
  const en = (posEn || '').toLowerCase();
  const fi = (posFi || '').toLowerCase();

  if (en === 'goalkeeper' || fi === 'maalivahti') return 'V';
  if (en === 'defender' || fi === 'puolustaja') return 'P';
  if (en === 'midfielder' || fi.indexOf('keskikentt') !== -1) return 'KK';
  if (en === 'forward' || fi.indexOf('hy\u00f6kk') !== -1) return 'H';
  return '';
}

/**
 * Format player name from "Surname Firstname" to "Firstname Surname"
 */
function formatPlayerName(name) {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length <= 1) return name;
  // API format: "Surname Firstname [Middle]"
  const surname = parts[0];
  const rest = parts.slice(1).join(' ');
  return `${rest} ${surname}`;
}
