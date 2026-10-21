# 站点深度优化 · Deep Optimize

一个用户脚本，五层叠加：主题、清障、交互解禁、接口净化、阅读增强。
外加一套可复现的本地测试环境，用来验证每一层真的生效，而不是"看起来生效"。

## 目录

```
src/deep-optimize.core.js      逻辑主体，无 userscript 头，可单独注入
src/gm-shim.js                 本地测试用的 GM_* 模拟层，真实油猴环境不需要
userscript/deep-optimize.user.js  可导入 Tampermonkey 的成品（头 + 主体）
dist/init.js                   shim + 主体，给本地页面 <script> 直接引
demo/index.html                未优化的对照页（广告、弹窗、禁复制、付费墙）
demo/with-script.html          同一页面 + 首个 script 位置注入 dist/init.js
shots/                         优化前后截图
```

## 本地跑

```bash
cd 优化
python3 -m http.server 8765 --bind 127.0.0.1
```

- 对照页 <http://127.0.0.1:8765/demo/index.html>
- 注入后 <http://127.0.0.1:8765/demo/with-script.html>

停服务：`lsof -ti:8765 | xargs kill`

## 安装

先装 Tampermonkey（Chrome / Edge / Firefox / Safari 都有），然后点下面任一链接，油猴会自己弹出安装页：

- **jsDelivr（推荐，CDN 更新快）**
  <https://cdn.jsdelivr.net/gh/zhaoruizhe81-bot/deep-optimize@main/userscript/deep-optimize.user.js>
- **GitHub Raw**
  <https://raw.githubusercontent.com/zhaoruizhe81-bot/deep-optimize/main/userscript/deep-optimize.user.js>

装完把 `@match *://*/*` 改成目标域名再保存，例如 `@match https://example.com/*`。通配全站能跑，但没必要让它每个页面都注入一遍。

手动安装也可以：Tampermonkey 面板 → 新建脚本 → 全选替换成 `userscript/deep-optimize.user.js` 的内容。

## 五层能力

**主题层**。CSS 变量驱动，暗/亮两套。之所以用变量而不是硬写颜色，是因为站点改版时你只需要改一组值；而且样式表不会被 React 重渲染冲掉。

**清障层**。广告位、登录遮罩、付费墙、cookie 条按选择器成组删除。付费墙不止删遮罩：`filter: blur()`、`max-height` 截断、`body` 的 `overflow: hidden` 三样得一起解，否则正文还是糊的。

**交互解禁层**。CSS 恢复 `user-select`，事件层在 window 捕获阶段 `stopPropagation()`，让事件到不了 document 上绑的 `preventDefault`。注意只打断传播、不调用 `preventDefault`，浏览器默认的复制行为才能保留。

**数据层**。包住 `fetch` 和 `XMLHttpRequest`，响应体进渲染前递归摘掉带 `isAd` / `sponsored` 标记的条目。这层比改 DOM 稳，因为不关心框架怎么画。

**渲染增强层**。阅读进度条、回顶按钮、J/K 翻页、T 切主题、右下角统计 HUD。HUD 顺带承担了自检职责：清扫轮次还在涨就说明有循环。

## 实测结果

同一份 demo 页，注入前后对比（Chromium，视口 1974×872）：

| 指标 | 注入前 | 注入后 |
|---|---|---|
| 广告节点 | 7 | 0 |
| 登录弹窗 | 2 秒后强制弹出 | 不出现，`body.modal-open` 已摘 |
| 正文 | `blur(3.2px)` + 190px 截断 | `filter: none`，全文可读 |
| 列表条目 | 6（含 2 条广告） | 4，`isAd` 条目在接口层被摘 |
| 推荐栏广告 | 2 条，每 4 秒重建后重现 | 0 条，重建后自动补刀 |
| `user-select` | `none`，复制被 `preventDefault` | `text`，合成 copy 事件 `defaultPrevented: false` |
| 主题 | 纯白 `rgb(255,255,255)` | 深色 `rgb(14,17,22)` / 浅色 `rgb(246,247,249)` |
| 静置 12 秒清扫轮次 | — | +6（0.5 次/秒，已收敛） |

## 三个必须知道的坑

**一、网络 hook 必须跑在页面脚本之前。** `@run-at document-start` 不是可选项。如果等 `DOMContentLoaded` 再包 `fetch`，页面自己的首屏请求早发完了，接口净化那一层等于没写。代码里 `patchNetwork()` 和 `hookRouting()` 放在顶层立即执行，DOM 相关的才等 `DOMContentLoaded`。

**二、MutationObserver 会被自己触发。** 第一版 HUD 用 `innerHTML` 每 2 秒刷新，每次刷新产生 childList 变更 → 观察器回调 → 再清扫 → 再刷新 HUD，实测 464 轮/4 秒，约 116 次/秒的纯空转。修法是给自建节点打 `data-deep-opt-self` 标记，回调里 `closest()` 命中就跳过。第二版又在改 `<b>` 的 `textContent` 时踩了一次，同样 60 次/秒——`textContent` 赋值是移除旧文本节点再插新的，属于 childList 变更，不是 characterData。最终靠归属标记根治。

**三、所有 DOM 手术都得幂等。** demo 里的推荐栏每 4 秒 `innerHTML` 整块重建，模拟框架重渲染。脚本不能只在 load 时改一次，得能被反复执行而不出错、不重复插入。判断标准很简单：静置一分钟，看清扫轮次是否稳定线性增长，而不是指数上涨。

## 换到自己站点改什么

1. `@match` 改域名
2. `AD_SELECTORS` / `OVERLAY_SELECTORS` 换成目标站的真实类名。带 hash 的类名（`.css-1x8f2k`）别用，每次构建都变；优先 `id`、`data-*`、`aria-label`
3. 数据层的 `AD_KEYS` 加上目标站接口里的推广字段名
4. 主题层的容器选择器补上站点的布局类名
