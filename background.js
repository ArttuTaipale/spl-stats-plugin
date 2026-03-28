// background.js — Service worker that receives captured match data from content script

let lastMatchData = null;

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

  // Popup requesting match data
  if (message.type === 'getMatchData') {
    sendResponse({ matchData: lastMatchData });
    return true;
  }

  // Popup clearing stored match
  if (message.type === 'clearMatch') {
    lastMatchData = null;
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ ok: true });
    return true;
  }
});
