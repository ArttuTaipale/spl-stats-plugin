// excel.js — Build an Excel workbook from extracted match stats using SheetJS

/**
 * Build an Excel formula string for total points at a given row.
 *
 * Column layout:
 *   A = player_id, B = player_name, C = position, D = position_abbr,
 *   E = gameweek_number, F = minutes, G = goals, H = assists,
 *   I = goals_conceded, J = own_goals, K = penalties_missed,
 *   L = yellow_cards, M = red_cards, N = saves, O = bonus, P = points
 *
 * Scoring rules:
 *   Goal points:        goals * (V/P=6, KK=5, H/default=4)
 *   Clean sheet:        if minutes>=60 AND conceded=0 → V/P=4, KK=2, H=0
 *   Save points:        V only: INT(saves / 2)
 *   Minutes points:     >=60 → 2, >=30 → 1, else 0
 *   Assist points:      assists * 3
 *   Card penalty:       red>0 → -3, else yellow>0 → -1
 *   Own goal penalty:   own_goals * -2
 *   Penalty miss:       penalties_missed * -2
 *   Conceded penalty:   INT(conceded / 2) * -1
 */
function totalPointsFormula(r) {
  // Goal points: G * factor based on position in D
  var goals = 'G' + r + '*IF(OR(D' + r + '="V",D' + r + '="P"),6,IF(D' + r + '="KK",5,4))';
  // Clean sheet: if minutes>=60 and conceded=0
  var cleanSheet = 'IF(AND(F' + r + '>=60,I' + r + '=0),IF(OR(D' + r + '="V",D' + r + '="P"),4,IF(D' + r + '="KK",2,0)),0)';
  // Save points: goalkeeper only, INT(saves/2)
  var saves = 'IF(D' + r + '="V",INT(N' + r + '/2),0)';
  // Minutes points
  var minutes = 'IF(F' + r + '>=60,2,IF(F' + r + '>=30,1,0))';
  // Assist points
  var assists = 'H' + r + '*3';
  // Card penalty: red → -3, else yellow → -1
  var cards = 'IF(M' + r + '>0,-3,IF(L' + r + '>0,-1,0))';
  // Own goal penalty
  var ownGoals = 'J' + r + '*-2';
  // Penalty miss penalty
  var penMiss = 'K' + r + '*-2';
  // Conceded goals penalty
  var conceded = 'INT(I' + r + '/2)*-1';
  // Bonus (column O)
  var bonus = 'O' + r;

  return goals + '+' + cleanSheet + '+' + saves + '+' + minutes + '+' + assists + '+' + cards + '+' + ownGoals + '+' + penMiss + '+' + conceded + '+' + bonus;
}

/**
 * Generate an Excel file (.xlsx) from match stats and trigger download.
 * @param {Object} matchInfo - Match metadata
 * @param {Array} players - Array of player stat objects
 */
function generateExcel(matchInfo, players) {
  const headers = [
    'player_id',
    'player_name',
    'position',
    'position_abbr',
    'gameweek_number',
    'minutes',
    'goals',
    'assists',
    'goals_conceded',
    'own_goals',
    'penalties_missed',
    'yellow_cards',
    'red_cards',
    'saves',
    'bonus',
    'points'
  ];

  const rows = players.map((p, i) => {
    return [
      p.playerId,
      p.playerName,
      p.position,
      p.positionAbbr,
      p.round,
      p.minutesPlayed,
      p.goals,
      p.assists,
      p.concededGoals,
      p.ownGoals,
      p.penaltiesMissed,
      p.yellowCards,
      p.redCards,
      p.saves,
      '',
      0
    ];
  });

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Write Excel formulas into the points column (P) for each data row
  for (let i = 0; i < players.length; i++) {
    const rowNum = i + 2; // row 1 is header, data starts at row 2
    const cellRef = 'P' + rowNum;
    ws[cellRef] = { t: 'n', f: totalPointsFormula(rowNum) };
  }

  // Set column widths
  ws['!cols'] = [
    { wch: 10 }, // A: player_id
    { wch: 28 }, // B: player_name
    { wch: 14 }, // C: position
    { wch: 12 }, // D: position_abbr
    { wch: 16 }, // E: gameweek_number
    { wch: 10 }, // F: minutes
    { wch: 8 },  // G: goals
    { wch: 10 }, // H: assists
    { wch: 16 }, // I: goals_conceded
    { wch: 10 }, // J: own_goals
    { wch: 16 }, // K: penalties_missed
    { wch: 12 }, // L: yellow_cards
    { wch: 10 }, // M: red_cards
    { wch: 8 },  // N: saves
    { wch: 8 },  // O: bonus
    { wch: 10 }  // P: points
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = `${matchInfo.teamA.name} vs ${matchInfo.teamB.name}`.substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate file
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  // Trigger download
  const fileName = `${matchInfo.teamA.name}_vs_${matchInfo.teamB.name}_Round${matchInfo.round}.xlsx`
    .replace(/[^a-zA-Z0-9._\-() äåöÄÅÖ]/g, '');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Extract player roster from a getTeam API response.
 * @param {Object} data - Full API response (with .team property)
 * @returns {Object} { teamInfo, players[] }
 */
function extractTeamPlayers(data) {
  const team = data.team;

  const teamInfo = {
    teamId: team.team_id,
    teamName: team.team_name
  };

  const players = (team.players || []).filter(function (p) {
    return !p.removed || p.removed === '0000-00-00 00:00:00';
  }).map(function (p) {
    return {
      playerId: p.player_id,
      name: (p.first_name + ' ' + p.last_name).trim(),
      firstName: p.first_name,
      lastName: p.last_name,
      position: p.position_en || p.position || '',
      shirtNumber: p.shirt_number || ''
    };
  });

  return { teamInfo, players };
}

/**
 * Generate an Excel file (.xlsx) from team player roster and trigger download.
 * @param {Object} teamInfo - Team metadata
 * @param {Array} players - Array of player objects
 */
function generateTeamExcel(teamInfo, players) {
  const headers = [
    'Player ID',
    'Name',
    'First Name',
    'Last Name',
    'Position',
    'Jersey Number'
  ];

  const rows = players.map(function (p) {
    return [
      p.playerId,
      p.name,
      p.firstName,
      p.lastName,
      p.position,
      p.shirtNumber
    ];
  });

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 10 },  // Player ID
    { wch: 24 },  // Name
    { wch: 16 },  // First Name
    { wch: 16 },  // Last Name
    { wch: 14 },  // Position
    { wch: 14 }   // Jersey Number
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = teamInfo.teamName.substring(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  const fileName = (teamInfo.teamName + '_players.xlsx')
    .replace(/[^a-zA-Z0-9._\-() äåöÄÅÖ]/g, '');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
