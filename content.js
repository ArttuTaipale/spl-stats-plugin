// content.js — Content script that bridges page-level interceptor to the extension background

// Inject the interceptor script into the page context
const script = document.createElement('script');
script.src = chrome.runtime.getURL('interceptor.js');
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);

// Listen for intercepted match data from the page
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (!event.data || event.data.type !== 'SPL_STATS_MATCH_DATA') return;

  // Forward to the background service worker
  chrome.runtime.sendMessage({
    type: 'matchDataCaptured',
    payload: event.data.payload
  });
});
