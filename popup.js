// popup.js — Popup logic: display match info and trigger Excel download

document.addEventListener('DOMContentLoaded', () => {
  const noMatch = document.getElementById('no-match');
  const matchPanel = document.getElementById('match-panel');
  const teamsEl = document.getElementById('teams');
  const scoreEl = document.getElementById('score');
  const metaEl = document.getElementById('meta');
  const playerCountEl = document.getElementById('player-count');
  const downloadBtn = document.getElementById('download-btn');
  const clearBtn = document.getElementById('clear-btn');

  let currentStats = null;

  // Request match data from background
  chrome.runtime.sendMessage({ type: 'getMatchData' }, (response) => {
    if (!response || !response.matchData) {
      noMatch.style.display = '';
      matchPanel.style.display = 'none';
      return;
    }

    try {
      currentStats = extractMatchStats(response.matchData);
      const info = currentStats.matchInfo;

      teamsEl.textContent = `${info.teamA.name} vs ${info.teamB.name}`;
      scoreEl.textContent = `${info.scoreA} - ${info.scoreB}`;
      metaEl.textContent = `${info.category} · Round ${info.round} · ${info.date}`;
      playerCountEl.textContent = `${currentStats.players.length} players in lineup`;

      noMatch.style.display = 'none';
      matchPanel.style.display = '';
    } catch (e) {
      console.error('SPL Stats: Failed to parse match data', e);
      noMatch.style.display = '';
      matchPanel.style.display = 'none';
    }
  });

  downloadBtn.addEventListener('click', () => {
    if (!currentStats) return;
    generateExcel(currentStats.matchInfo, currentStats.players);
  });

  clearBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'clearMatch' }, () => {
      currentStats = null;
      noMatch.style.display = '';
      matchPanel.style.display = 'none';
    });
  });
});
