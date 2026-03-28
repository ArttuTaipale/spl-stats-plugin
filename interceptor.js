// interceptor.js — Injected into the page to capture getMatch API responses
// This runs in the PAGE context (not extension context) so it can read response bodies.

(function () {
  const TARGET = '/taso/rest/getMatch';

  // --- Intercept XMLHttpRequest ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._splUrl = url;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    if (this._splUrl && this._splUrl.indexOf(TARGET) !== -1) {
      this.addEventListener('load', function () {
        try {
          const data = JSON.parse(this.responseText);
          if (data && data.match && data.call && data.call.method === 'getMatch') {
            window.postMessage({
              type: 'SPL_STATS_MATCH_DATA',
              payload: data
            }, '*');
          }
        } catch (e) {
          // Not valid JSON or not a match response, ignore
        }
      });
    }
    return origSend.apply(this, arguments);
  };

  // --- Intercept fetch ---
  const origFetch = window.fetch;
  window.fetch = function () {
    const input = arguments[0];
    const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');

    if (url.indexOf(TARGET) !== -1) {
      return origFetch.apply(this, arguments).then(function (response) {
        // Clone so the original consumer can still read the body
        const clone = response.clone();
        clone.json().then(function (data) {
          if (data && data.match && data.call && data.call.method === 'getMatch') {
            window.postMessage({
              type: 'SPL_STATS_MATCH_DATA',
              payload: data
            }, '*');
          }
        }).catch(function () { });
        return response;
      });
    }

    return origFetch.apply(this, arguments);
  };
})();
