// popup.js — Popup logic: display match/team info and trigger Excel download

document.addEventListener('DOMContentLoaded', () => {
  const noMatch = document.getElementById('no-match');
  const matchPanel = document.getElementById('match-panel');
  const teamsEl = document.getElementById('teams');
  const scoreEl = document.getElementById('score');
  const metaEl = document.getElementById('meta');
  const playerCountEl = document.getElementById('player-count');
  const downloadBtn = document.getElementById('download-btn');
  const clearBtn = document.getElementById('clear-btn');

  const teamPanel = document.getElementById('team-panel');
  const teamNameEl = document.getElementById('team-name');
  const teamMetaEl = document.getElementById('team-meta');
  const teamPlayerCountEl = document.getElementById('team-player-count');
  const teamDownloadBtn = document.getElementById('team-download-btn');
  const teamClearBtn = document.getElementById('team-clear-btn');

  let currentStats = null;
  let currentTeam = null;

  function updateVisibility() {
    const hasMatch = !!currentStats;
    const hasTeam = !!currentTeam;
    noMatch.style.display = (!hasMatch && !hasTeam) ? '' : 'none';
    matchPanel.style.display = hasMatch ? '' : 'none';
    teamPanel.style.display = hasTeam ? '' : 'none';
  }

  // Request match data from background
  chrome.runtime.sendMessage({ type: 'getMatchData' }, (response) => {
    if (response && response.matchData) {
      try {
        currentStats = extractMatchStats(response.matchData);
        const info = currentStats.matchInfo;

        teamsEl.textContent = `${info.teamA.name} vs ${info.teamB.name}`;
        scoreEl.textContent = `${info.scoreA} - ${info.scoreB}`;
        metaEl.textContent = `${info.category} · Round ${info.round} · ${info.date}`;
        playerCountEl.textContent = `${currentStats.players.length} players in lineup`;
      } catch (e) {
        console.error('SPL Stats: Failed to parse match data', e);
        currentStats = null;
      }
    }
    updateVisibility();
  });

  // Request team data from background
  chrome.runtime.sendMessage({ type: 'getTeamData' }, (response) => {
    if (response && response.teamData) {
      try {
        currentTeam = extractTeamPlayers(response.teamData);
        const info = currentTeam.teamInfo;

        teamNameEl.textContent = info.teamName;
        teamMetaEl.textContent = `Team ID: ${info.teamId}`;
        teamPlayerCountEl.textContent = `${currentTeam.players.length} players in roster`;
      } catch (e) {
        console.error('SPL Stats: Failed to parse team data', e);
        currentTeam = null;
      }
    }
    updateVisibility();
  });

  downloadBtn.addEventListener('click', () => {
    if (!currentStats) return;
    generateExcel(currentStats.matchInfo, currentStats.players);
  });

  clearBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'clearMatch' }, () => {
      currentStats = null;
      updateVisibility();
    });
  });

  teamDownloadBtn.addEventListener('click', () => {
    if (!currentTeam) return;
    generateTeamExcel(currentTeam.teamInfo, currentTeam.players);
  });

  teamClearBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'clearTeam' }, () => {
      currentTeam = null;
      updateVisibility();
    });
  });
});
