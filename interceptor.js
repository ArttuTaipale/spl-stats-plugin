// interceptor.js — Injected into the page to capture getMatch and getTeam API responses
// This runs in the PAGE context (not extension context) so it can read response bodies.

(function () {
  const TARGETS = {
    '/taso/rest/getMatch': function (data) {
      if (data && data.match && data.call && data.call.method === 'getMatch') {
        window.postMessage({ type: 'SPL_STATS_MATCH_DATA', payload: data }, '*');
      }
    },
    '/taso/rest/getTeam': function (data) {
      if (data && data.team && data.call && data.call.method === 'getTeam') {
        window.postMessage({ type: 'SPL_STATS_TEAM_DATA', payload: data }, '*');
      }
    }
  };

  function matchTarget(url) {
    for (var path in TARGETS) {
      if (url.indexOf(path) !== -1) return TARGETS[path];
    }
    return null;
  }

  // --- Intercept XMLHttpRequest ---
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._splUrl = url;
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    var handler = this._splUrl ? matchTarget(this._splUrl) : null;
    if (handler) {
      var h = handler;
      this.addEventListener('load', function () {
        try {
          var data = JSON.parse(this.responseText);
          h(data);
        } catch (e) {
          // Not valid JSON, ignore
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
    var handler = matchTarget(url);

    if (handler) {
      var h = handler;
      return origFetch.apply(this, arguments).then(function (response) {
        var clone = response.clone();
        clone.json().then(function (data) { h(data); }).catch(function () { });
        return response;
      });
    }

    return origFetch.apply(this, arguments);
  };
})();
