// background.js — Service worker that receives captured data from content script

let lastMatchData = null;
let lastTeamData = null;

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Match data captured by content script interceptor
  if (message.type === 'matchDataCaptured') {
    const data = message.payload;
    if (data && data.match && data.call && data.call.method === 'getMatch') {
      lastMatchData = data;

      // Update badge to indicate a match is available
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      console.log('SPL Stats: Match captured —',
        data.match.team_A_name, 'vs', data.match.team_B_name);
    }
    sendResponse({ ok: true });
    return true;
  }

  // Team data captured by content script interceptor
  if (message.type === 'teamDataCaptured') {
    const data = message.payload;
    if (data && data.team && data.call && data.call.method === 'getTeam') {
      lastTeamData = data;

      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#1a73e8' });
      console.log('SPL Stats: Team captured —', data.team.team_name);
    }
    sendResponse({ ok: true });
    return true;
  }

  // Popup requesting match data
  if (message.type === 'getMatchData') {
    sendResponse({ matchData: lastMatchData });
    return true;
  }

  // Popup requesting team data
  if (message.type === 'getTeamData') {
    sendResponse({ teamData: lastTeamData });
    return true;
  }

  // Popup clearing stored match
  if (message.type === 'clearMatch') {
    lastMatchData = null;
    if (!lastTeamData) chrome.action.setBadgeText({ text: '' });
    sendResponse({ ok: true });
    return true;
  }

  // Popup clearing stored team
  if (message.type === 'clearTeam') {
    lastTeamData = null;
    if (!lastMatchData) chrome.action.setBadgeText({ text: '' });
    sendResponse({ ok: true });
    return true;
  }
});
