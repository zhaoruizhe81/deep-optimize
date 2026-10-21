// ==UserScript==
// @name         站点深度优化 · Deep Optimize
// @namespace    local.deepopt
// @version      1.0.0
// @description  主题化 / 去广告 / 反禁复制 / 接口净化 / 阅读增强，五层一体
// @author       YG
// @homepageURL  https://github.com/zhaoruizhe81/deep-optimize
// @updateURL    https://raw.githubusercontent.com/zhaoruizhe81/deep-optimize/main/userscript/deep-optimize.user.js
// @downloadURL  https://raw.githubusercontent.com/zhaoruizhe81/deep-optimize/main/userscript/deep-optimize.user.js
// @match        *://*/*
// @run-at       document-start
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

/* ============================================================
 * 站点深度优化核心（Deep Optimize Core）
 * 无头部逻辑体，既可被 userscript 头包裹，也可直接在浏览器注入。
 * 五层：主题 / 清障 / 交互解禁 / 数据净化 / 渲染增强
 * ============================================================ */
(function () {
  'use strict';

  var W = (typeof unsafeWindow !== 'undefined' && unsafeWindow) ? unsafeWindow : window;
  var D = document;
  var LOG = '[deep-opt]';

  /* ---------- 0. 基础工具 ---------- */

  function addStyle(css) {
    if (typeof GM_addStyle === 'function') return GM_addStyle(css);
    var s = D.createElement('style');
    s.setAttribute('data-deep-opt', 'true');
    s.textContent = css;
    (D.head || D.documentElement).appendChild(s);
    return s;
  }

  var store = {
    get: function (k, d) {
      try {
        if (typeof GM_getValue === 'function') return GM_getValue(k, d);
        var raw = localStorage.getItem('deepopt:' + k);
        return raw === null ? d : JSON.parse(raw);
      } catch (e) { return d; }
    },
    set: function (k, v) {
      try {
        if (typeof GM_setValue === 'function') { GM_setValue(k, v); return; }
        localStorage.setItem('deepopt:' + k, JSON.stringify(v));
      } catch (e) {}
    }
  };

  var stats = { ads: 0, overlays: 0, payload: 0, sweeps: 0 };

  /* ---------- 1. 主题层：变量驱动，抗框架重渲染 ---------- */

  var THEMES = {
    dark:  { bg: '#0e1116', panel: '#161b22', fg: '#c9d1d9', muted: '#8b949e', line: '#21262d', accent: '#58a6ff' },
    light: { bg: '#f6f7f9', panel: '#ffffff', fg: '#24292f', muted: '#57606a', line: '#d0d7de', accent: '#0969da' }
  };

  var state = { theme: store.get('theme', 'dark') };

  function applyTheme(name) {
    var t = THEMES[name] || THEMES.dark;
    state.theme = THEMES[name] ? name : 'dark';

    var el = D.getElementById('deep-opt-theme');
    if (!el) {
      el = D.createElement('style');
      el.id = 'deep-opt-theme';
      (D.head || D.documentElement).appendChild(el);
    }

    el.textContent = [
      ':root{',
      '  --do-bg:' + t.bg + ';--do-panel:' + t.panel + ';--do-fg:' + t.fg + ';',
      '  --do-muted:' + t.muted + ';--do-line:' + t.line + ';--do-accent:' + t.accent + ';',
      '  --do-radius:10px;',
      '}',
      'html,body{background:var(--do-bg)!important;color:var(--do-fg)!important;}',
      /* 通用容器：让站点的白底/深字跟随主题，不依赖具体类名 */
      'body *:not(img):not(video):not(canvas):not(svg):not(path){',
      '  border-color:var(--do-line)!important;',
      '}',
      'header,footer,main,aside,nav,article,section,div.card,.card,.panel,',
      '.site-header,.recommend,.feed .item,.item,.post,.layout{',
      '  background-color:transparent!important;color:var(--do-fg)!important;',
      '}',
      'a{color:var(--do-accent)!important;}',
      'h1,h2,h3,h4,strong{color:var(--do-fg)!important;}',
      '.meta,.muted,time,small,.recommend h3{color:var(--do-muted)!important;}',
      'input,textarea,select,button{',
      '  background:var(--do-panel)!important;color:var(--do-fg)!important;',
      '  border:1px solid var(--do-line)!important;border-radius:8px;',
      '}',
      'hr{border-color:var(--do-line)!important;}',
      /* 沉浸阅读：正文限宽 + 行高 */
      '.article-body,.post p,.content{',
      '  max-width:74ch;line-height:1.85!important;font-size:16.5px!important;',
      '  color:var(--do-fg)!important;',
      '}',
      /* 记录滚动进度条 */
      '#deep-opt-progress{',
      '  position:fixed;top:0;left:0;height:3px;width:0;z-index:2147483646;',
      '  background:linear-gradient(90deg,var(--do-accent),#7ee787);',
      '  transition:width .08s linear;pointer-events:none;',
      '}',
      /* 浮层徽章 */
      '#deep-opt-hud{',
      '  position:fixed;right:16px;bottom:16px;z-index:2147483647;',
      '  background:var(--do-panel);border:1px solid var(--do-line);',
      '  color:var(--do-muted);font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;',
      '  padding:8px 12px;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.28);',
      '  cursor:pointer;user-select:none;max-width:240px;',
      '}',
      '#deep-opt-hud b{color:var(--do-accent);font-weight:600;}',
      '#deep-opt-top{',
      '  position:fixed;right:16px;bottom:64px;z-index:2147483647;',
      '  width:38px;height:38px;border-radius:50%;display:none;',
      '  align-items:center;justify-content:center;cursor:pointer;',
      '  background:var(--do-panel);border:1px solid var(--do-line);',
      '  color:var(--do-fg);font-size:16px;box-shadow:0 6px 24px rgba(0,0,0,.28);',
      '}'
    ].join('\n');

    store.set('theme', state.theme);
    console.log(LOG, 'theme =', state.theme);
  }

  /* ---------- 2. 交互解禁：复制 / 右键 / 选中 ---------- */

  function unlockInteraction() {
    addStyle([
      '*,*::before,*::after{',
      '  -webkit-user-select:text!important;user-select:text!important;',
      '}',
      'body{cursor:auto!important;}'
    ].join('\n'));

    /* 捕获阶段掐断站点的拦截器，同时保留浏览器默认行为
       （不 preventDefault，只 stopPropagation —— 事件到不了 body 上的监听） */
    ['copy', 'cut', 'contextmenu'].forEach(function (type) {
      W.addEventListener(type, function (e) { e.stopPropagation(); }, true);
    });

    D.oncopy = null;
    D.oncut = null;
    D.oncontextmenu = null;
    D.onselectstart = null;
    if (D.body) {
      D.body.oncopy = null;
      D.body.oncontextmenu = null;
    }
  }

  /* ---------- 3. 清障层：广告 / 遮罩 / 付费墙 ---------- */

  var AD_SELECTORS = [
    '[data-ad]',
    '.ad-banner',
    '.advert',
    '.adsbygoogle',
    '.sponsored',
    '.ad-slot',
    '[class*="advert"]',
    '[class*="ad-slot"]',
    '[id*="google_ads"]',
    '[id*="ad-container"]'
  ];

  var OVERLAY_SELECTORS = [
    '.login-mask',
    '.login-modal',
    '.modal-backdrop',
    '.cookie-bar',
    '.paywall-mask',
    '.paywall-box',
    '.vip-tip',
    '[class*="float-ad"]'
  ];

  addStyle([
    /* 付费墙：模糊与截断一起解 */
    '.article-body[data-locked],.post [data-locked]{',
    '  filter:none!important;-webkit-filter:none!important;',
    '  max-height:none!important;overflow:visible!important;',
    '}',
    '.paywall-mask{display:none!important;}',
    /* 弹窗打开时锁定的滚动要还回来 */
    'html,body{overflow:auto!important;position:static!important;}',
    'body.modal-open,body.no-scroll{overflow:auto!important;}'
  ].join('\n'));

  function killNodes(list, counter) {
    var n = 0;
    list.forEach(function (sel) {
      var nodes;
      try { nodes = D.querySelectorAll(sel); } catch (e) { return; }
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].isConnected) { nodes[i].remove(); n++; }
      }
    });
    stats[counter] += n;
    return n;
  }

  function sweep() {
    var removed = killNodes(AD_SELECTORS, 'ads') + killNodes(OVERLAY_SELECTORS, 'overlays');

    /* 属性级清理：有些站把锁定状态写在 dataset 上而不是 class */
    var locked = D.querySelectorAll('[data-locked]');
    for (var j = 0; j < locked.length; j++) {
      var el = locked[j];
      el.removeAttribute('data-locked');
      if (el.style.filter !== 'none') el.style.filter = 'none';
      if (el.style.maxHeight !== 'none') el.style.maxHeight = 'none';
      removed++;
    }

    /* 遮罩可能靠 body class 控制显示 */
    if (D.body && (D.body.classList.contains('modal-open') || D.body.classList.contains('no-scroll'))) {
      D.body.classList.remove('modal-open', 'no-scroll', 'overflow-hidden');
    }
    if (D.documentElement.classList.contains('modal-open')) {
      D.documentElement.classList.remove('modal-open');
    }

    stats.sweeps++;
    if (removed) console.log(LOG, 'sweep removed', removed);
    return removed;
  }

  /* ---------- 4. 数据层：接口返回净化 ---------- */

  var AD_KEYS = ['isAd', 'is_ad', 'ad', 'sponsored', 'isSponsored', 'promoted'];

  function isAdNode(o) {
    for (var i = 0; i < AD_KEYS.length; i++) {
      if (o[AD_KEYS[i]] === true || o[AD_KEYS[i]] === 1) return true;
    }
    return false;
  }

  function cleanPayload(node, depth) {
    depth = depth || 0;
    if (!node || depth > 8) return node;
    if (Array.isArray(node)) {
      var out = [];
      for (var i = 0; i < node.length; i++) {
        var it = node[i];
        if (it && typeof it === 'object' && isAdNode(it)) { stats.payload++; continue; }
        out.push(cleanPayload(it, depth + 1));
      }
      return out;
    }
    if (typeof node === 'object') {
      for (var k in node) {
        if (Object.prototype.hasOwnProperty.call(node, k)) {
          node[k] = cleanPayload(node[k], depth + 1);
        }
      }
      return node;
    }
    return node;
  }

  function patchNetwork() {
    /* 4.1 fetch */
    var nativeFetch = W.fetch;
    if (typeof nativeFetch === 'function' && !nativeFetch.__deepOpt) {
      var patched = function (input, init) {
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        return nativeFetch.call(W, input, init).then(function (res) {
          var ct = res.headers.get('content-type') || '';
          if (!/json/i.test(ct)) return res;
          return res.clone().json().then(function (data) {
            var cleaned = cleanPayload(data);
            return new W.Response(JSON.stringify(cleaned), {
              status: res.status,
              statusText: res.statusText,
              headers: { 'Content-Type': 'application/json; charset=utf-8' }
            });
          }).catch(function () { return res; });
        });
      };
      patched.__deepOpt = true;
      W.fetch = patched;
    }

    /* 4.2 XHR —— 老站点还在用，不能漏 */
    var XP = W.XMLHttpRequest && W.XMLHttpRequest.prototype;
    if (XP && !XP.__deepOpt) {
      var rawOpen = XP.open;
      var rawSend = XP.send;

      XP.open = function (method, url) {
        this.__doUrl = String(url || '');
        return rawOpen.apply(this, arguments);
      };

      XP.send = function () {
        var xhr = this;
        xhr.addEventListener('readystatechange', function () {
          if (xhr.readyState !== 4) return;
          var ct = '';
          try { ct = xhr.getResponseHeader('content-type') || ''; } catch (e) {}
          if (!/json/i.test(ct)) return;
          try {
            var data = JSON.parse(xhr.responseText);
            var cleaned = cleanPayload(data);
            var json = JSON.stringify(cleaned);
            Object.defineProperty(xhr, 'responseText', { value: json, configurable: true });
            Object.defineProperty(xhr, 'response', { value: json, configurable: true });
          } catch (e) {}
        });
        return rawSend.apply(this, arguments);
      };

      XP.__deepOpt = true;
    }
  }

  /* ---------- 5. 渲染增强：进度条 / 回顶 / 快捷键 / HUD ---------- */

  function mountChrome() {
    if (D.getElementById('deep-opt-progress')) return;

    var bar = D.createElement('div');
    bar.id = 'deep-opt-progress';
    bar.setAttribute('data-deep-opt-self', '');
    D.documentElement.appendChild(bar);

    var top = D.createElement('div');
    top.id = 'deep-opt-top';
    top.setAttribute('data-deep-opt-self', '');
    top.textContent = '↑';
    top.title = '回到顶部';
    top.addEventListener('click', function () {
      W.scrollTo({ top: 0, behavior: 'smooth' });
    });
    D.documentElement.appendChild(top);

    var hud = D.createElement('div');
    hud.id = 'deep-opt-hud';
    hud.setAttribute('data-deep-opt-self', '');
    D.documentElement.appendChild(hud);

    var raf = 0;
    function onScroll() {
      if (raf) return;
      raf = W.requestAnimationFrame(function () {
        raf = 0;
        var h = D.documentElement.scrollHeight - W.innerHeight;
        var p = h > 0 ? (W.scrollY / h) * 100 : 0;
        bar.style.width = p.toFixed(1) + '%';
        top.style.display = W.scrollY > 400 ? 'flex' : 'none';
      });
    }
    W.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* HUD 一次建好，之后只改文本节点。
     * innerHTML 每次重写都会产生 childList 变更，而 characterData 不在
     * 观察范围内 —— 这是本脚本不自我触发清扫循环的关键。 */
    hud.innerHTML =
      '已清 <b id="do-ads">0</b> 条广告 · 遮罩 <b id="do-ov">0</b> 处<br>' +
      '接口滤掉 <b id="do-pl">0</b> 条 · 清扫 <b id="do-sw">0</b> 轮<br>' +
      '<span style="opacity:.7">点我切换主题 · 快捷键 J K T</span>';

    var nAds = hud.querySelector('#do-ads');
    var nOv = hud.querySelector('#do-ov');
    var nPl = hud.querySelector('#do-pl');
    var nSw = hud.querySelector('#do-sw');

    var lastHud = '';
    function refreshHud() {
      var txt = stats.ads + '|' + stats.overlays + '|' + stats.payload + '|' + stats.sweeps;
      if (txt === lastHud) return;
      lastHud = txt;
      nAds.textContent = stats.ads;
      nOv.textContent = stats.overlays;
      nPl.textContent = stats.payload;
      nSw.textContent = stats.sweeps;
    }
    refreshHud();
    hud.addEventListener('click', function () {
      applyTheme(state.theme === 'dark' ? 'light' : 'dark');
      lastHud = '';
      refreshHud();
    });
    setInterval(refreshHud, 2000);

    /* 快捷键：j/k 滚动，t 切主题，g 顶，G 底 */
    W.addEventListener('keydown', function (e) {
      var t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      var step = Math.round(W.innerHeight * 0.6);
      switch (e.key) {
        case 'j': W.scrollBy({ top: step, behavior: 'smooth' }); break;
        case 'k': W.scrollBy({ top: -step, behavior: 'smooth' }); break;
        case 't': applyTheme(state.theme === 'dark' ? 'light' : 'dark'); refreshHud(); break;
        case 'g': W.scrollTo({ top: 0, behavior: 'smooth' }); break;
        case 'G': W.scrollTo({ top: D.body.scrollHeight, behavior: 'smooth' }); break;
        default: return;
      }
      e.preventDefault();
    }, true);

    stats._refreshHud = refreshHud;
  }

  /* ---------- 6. 调度器：防重渲染冲掉 + SPA 路由 ---------- */

  var scheduled = false;
  function scheduleSweep() {
    if (scheduled) return;
    scheduled = true;
    W.requestAnimationFrame(function () {
      scheduled = false;
      sweep();
      if (stats._refreshHud) stats._refreshHud();
    });
  }

  function hookRouting() {
    ['pushState', 'replaceState'].forEach(function (k) {
      var orig = W.history[k];
      if (!orig || orig.__deepOpt) return;
      var wrapped = function () {
        var r = orig.apply(this, arguments);
        W.setTimeout(scheduleSweep, 0);
        return r;
      };
      wrapped.__deepOpt = true;
      W.history[k] = wrapped;
    });
    W.addEventListener('popstate', scheduleSweep);
    W.addEventListener('hashchange', scheduleSweep);
  }

  /* ---------- 7. 启动 ----------
   * 关键：网络 hook 与事件解禁放在顶层立即执行。
   * 一旦延迟到 DOMContentLoaded，页面的同步脚本早就把首屏请求发完了，
   * fetch 拦截等于废掉 —— 这是写用户脚本最容易踩的时机坑。 */

  patchNetwork();
  hookRouting();
  applyTheme(state.theme);
  unlockInteraction();

  function bootUI() {
    mountChrome();
    sweep();

    /* 只处理站点自身产生的变更。我们自己往页面里塞的 HUD / 进度条
     * 一旦被算进去，就会形成 sweep → 改 HUD → 观察器触发 → sweep 的死循环。 */
    var mo = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var t = records[i].target;
        if (t && t.nodeType === 1 && t.closest && t.closest('[data-deep-opt-self]')) continue;
        scheduleSweep();
        return;
      }
    });
    mo.observe(D.documentElement, { childList: true, subtree: true });

    /* 有的站延迟注入广告容器，补几枪 */
    [300, 1200, 3000].forEach(function (ms) { W.setTimeout(scheduleSweep, ms); });

    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('切换主题', function () {
        applyTheme(state.theme === 'dark' ? 'light' : 'dark');
      });
      GM_registerMenuCommand('立即清扫', scheduleSweep);
    }

    console.log(LOG, 'booted', location.href);
    W.__deepOpt = { stats: stats, sweep: scheduleSweep, theme: applyTheme };
  }

  if (D.readyState === 'loading') {
    D.addEventListener('DOMContentLoaded', bootUI, { once: true });
  } else {
    bootUI();
  }
})();
