/* 模拟一个常见商业内容站的"反向体验"：
 * 定时弹登录框、禁复制、禁右键、推荐栏定时重渲染（会冲掉任何 DOM 改动） */

// 痛点 4：禁复制 / 禁右键
document.addEventListener('copy', function (e) {
  e.preventDefault();
  console.log('[site] copy blocked');
});
document.addEventListener('contextmenu', function (e) {
  e.preventDefault();
});
document.addEventListener('selectstart', function (e) {
  e.preventDefault();
});

// 痛点 5：2 秒后强制弹登录框
setTimeout(function () {
  document.body.classList.add('modal-open');
}, 2000);

document.querySelector('.close-x').addEventListener('click', function () {
  document.body.classList.remove('modal-open');
});

// 痛点 6：推荐栏每 4 秒整块重建 —— 模拟 React/Vue 重渲染冲掉 DOM 修改
var HOT = [
  { t: '为什么 Service Worker 的缓存策略总是不生效', ad: false },
  { t: '【培训】三个月转行前端，年薪 40 万', ad: true },
  { t: 'CSS 容器查询在真实项目里的三种用法', ad: false },
  { t: '【兼职】在家打字日结 300+', ad: true },
  { t: '从 v8 到字节码：一次真实的性能排查', ad: false }
];

var tick = 0;
function renderRecommend() {
  var box = document.getElementById('recommend');
  var html = '<h3>热门</h3>';
  HOT.forEach(function (it) {
    html += '<div class="r-item' + (it.ad ? ' sponsored' : '') + '">' + it.t + '</div>';
  });
  // 每次重渲染把序号也刷一遍，肉眼能看出它真的在重建
  html += '<div class="r-item" style="color:#bbb;border:0">第 ' + (++tick) + ' 次渲染</div>';
  box.innerHTML = html;
}
renderRecommend();
setInterval(renderRecommend, 4000);

// 痛点 7：列表数据里混着广告，接口层塞进来的
fetch('feed.json')
  .then(function (r) { return r.json(); })
  .then(function (list) {
    var box = document.getElementById('feed');
    box.innerHTML = list.map(function (i) {
      return '<div class="item' + (i.isAd ? ' sponsored' : '') + '">' +
        '<h3>' + i.title + '</h3>' +
        '<p>' + i.desc + '</p></div>';
    }).join('');
  });
