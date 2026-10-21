/* GM_* 模拟层：只在本地浏览器直连测试时使用。
 * 真实 Tampermonkey / Violentmonkey 环境已内置这些 API，不需要本文件。 */
(function () {
  if (typeof window.GM_addStyle === 'function') return;
  var NS = '__gm__';

  window.GM_addStyle = function (css) {
    var s = document.createElement('style');
    s.setAttribute('data-gm-shim', '');
    s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
    return s;
  };

  window.GM_getValue = function (key, def) {
    try {
      var raw = localStorage.getItem(NS + key);
      return raw === null ? def : JSON.parse(raw);
    } catch (e) { return def; }
  };

  window.GM_setValue = function (key, val) {
    try { localStorage.setItem(NS + key, JSON.stringify(val)); } catch (e) {}
  };

  window.GM_registerMenuCommand = function (label, fn) {
    window.__gmMenu = window.__gmMenu || [];
    window.__gmMenu.push({ label: label, fn: fn });
  };

  window.GM_notification = function (text) { console.log('[gm-notify]', text); };
})();
