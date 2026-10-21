#!/usr/bin/env bash
# 从 src/ 重新拼装成品脚本。改完 core 记得跑一次。
set -euo pipefail
cd "$(dirname "$0")"

HEADER=$(cat <<'H'
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

H
)

printf '%s\n\n' "$HEADER" > userscript/deep-optimize.user.js
cat src/deep-optimize.core.js >> userscript/deep-optimize.user.js

cat src/gm-shim.js src/deep-optimize.core.js > dist/init.js

node --check dist/init.js
node --check userscript/deep-optimize.user.js
echo "built: userscript/deep-optimize.user.js ($(wc -c < userscript/deep-optimize.user.js) bytes)"
