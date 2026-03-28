// excel.js — Build an Excel workbook from extracted match stats using SheetJS

/**
 * Total Points formula for a given Excel row number and position.
 * Column reference:
 *   D = Pos, G = Minutes Played, H = Goals Scored, I = Assists,
 *   J = Yellow Cards, K = Red Cards, L = Saves,
 *   M = Conceded Goals, N = Own Goals, O = Penalties Missed
 *
 * Position-dependent factors:
 *   goalFactor:       H=4, KK=5, P/V=6
 *   cleanSheetFactor: V/P=4, KK=1, H=0
 *   saveFactor:       (not yet defined — set to 0 for now)
 */
function totalPointsFormula(p) {
  let goalFactor, cleanSheetFactor, saveFactor;

  switch (p.positionAbbr) {
    case 'H':  // forward
      goalFactor = 4; cleanSheetFactor = 0; saveFactor = 0; break;
    case 'KK': // midfielder
      goalFactor = 5; cleanSheetFactor = 1; saveFactor = 0; break;
    case 'P':  // defender
      goalFactor = 6; cleanSheetFactor = 4; saveFactor = 0; break;
    case 'V':  // goalkeeper
      goalFactor = 6; cleanSheetFactor = 4; saveFactor = 1/3; break;
    default:
      goalFactor = 4; cleanSheetFactor = 0; saveFactor = 0; break;
  }
  var goalPoints = p.goals * goalFactor;
  var cleanSheetPoints = p.minutesPlayed < 60 ? 0 : (p.concededGoals === 0 ? cleanSheetFactor : 0);
  var savePoints = Math.floor(p.saves * saveFactor);
  var minutesPoints = (p.minutesPlayed >= 60) ? 2 : (p.minutesPlayed >= 30 ? 1 : 0);
  var assistPoints = p.assists * 3;
  // -1 points if booked, -3 points if sent out, regardless of if a yellow card was received earlier
  var cardPenalty = (p.redCards > 0) ? -3 : (p.yellowCards > 0 ? -1 : 0);
  var ownGoalPenalty = p.ownGoals * -2;
  var penaltyMissPenalty = p.penaltiesMissed * -2;
  var concededGoalsPenalty = Math.floor(p.concededGoals/2) * -1;
  var totalPoints = goalPoints + cleanSheetPoints + savePoints + minutesPoints + assistPoints + cardPenalty + ownGoalPenalty + penaltyMissPenalty + concededGoalsPenalty;
  return totalPoints;
}

/**
 * Generate an Excel file (.xlsx) from match stats and trigger download.
 * @param {Object} matchInfo - Match metadata
 * @param {Array} players - Array of player stat objects
 */
function generateExcel(matchInfo, players) {
  const headers = [
    'Player Name',
    'Player ID',
    'Position',
    'Pos',
    'Team',
    'Match Round',
    'Minutes Played',
    'Goals Scored',
    'Assists',
    'Yellow Cards',
    'Red Cards',
    'Saves',
    'Conceded Goals',
    'Own Goals',
    'Penalties Missed',
    'Total Points'
  ];

  const rows = players.map((p, i) => {
    const rowNum = i + 2; // Excel row (1-indexed, header is row 1)
    return [
      p.playerName,
      p.playerId,
      p.position,
      p.positionAbbr,
      p.team,
      p.round,
      p.minutesPlayed,
      p.goals,
      p.assists,
      p.yellowCards,
      p.redCards,
      p.saves,
      p.concededGoals,
      p.ownGoals,
      p.penaltiesMissed,
      totalPointsFormula(p)
    ];
  });

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws['!cols'] = [
    { wch: 28 }, // A: Player Name
    { wch: 10 }, // B: Player ID
    { wch: 14 }, // C: Position
    { wch: 5 },  // D: Pos (abbreviation)
    { wch: 18 }, // E: Team
    { wch: 12 }, // F: Match Round
    { wch: 14 }, // G: Minutes Played
    { wch: 12 }, // H: Goals Scored
    { wch: 10 }, // I: Assists
    { wch: 12 }, // J: Yellow Cards
    { wch: 10 }, // K: Red Cards
    { wch: 8 },  // L: Saves
    { wch: 14 }, // M: Conceded Goals
    { wch: 10 }, // N: Own Goals
    { wch: 16 }, // O: Penalties Missed
    { wch: 12 }  // P: Total Points
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = `${matchInfo.teamA.name} vs ${matchInfo.teamB.name}`.substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate file
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  // Trigger download
  const fileName = `${matchInfo.teamA.name}_vs_${matchInfo.teamB.name}_Round${matchInfo.round}.xlsx`
    .replace(/[^a-zA-Z0-9._\-() ]/g, '');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
