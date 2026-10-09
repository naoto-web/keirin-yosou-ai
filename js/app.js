// app.js — 画面の切り替え（#/ … 今日／#/day/YYYYMMDD … その日／#/race/YYYYMMDD/場/R … レース詳細）
'use strict';
const isList = hs => hs === '' || hs === '#/' || hs.startsWith('#/day/');
const App = {
  prev: location.hash,
  route() {
    const view = document.getElementById('view');
    if (!API.key()) return Setup.render(view);
    const h = location.hash.replace(/^#\/?/, '').split('/');
    // 一覧を離れるときにスクロール位置を覚え、レース詳細から一覧へ戻ったときだけ戻す（2026-10-10）
    const prev = App.prev; App.prev = location.hash;
    if (isList(prev) && !isList(location.hash)) Home.scroll = window.scrollY;
    const back = /^#\/race\//.test(prev) && isList(location.hash);
    Home.token = (Home.token || 0) + 1;   // 一覧の裏の取り直しが、別画面に描かないように
    if (!back) window.scrollTo(0, 0);
    // 下のタブ（今日／成績）の選択表示。レース詳細は「今日」側の扱い
    document.querySelectorAll('.tabbar a').forEach(a => a.classList.toggle('on', (a.dataset.tab === 'stats') === (h[0] === 'stats')));
    if (h[0] === 'stats') return Stats.render(view);
    if (h[0] === 'race' && h[1] && h[2] && h[3]) return Race.render(view, h[1], h[2], +h[3]);
    if (h[0] === 'day' && /^\d{8}$/.test(h[1] || '')) return Home.render(view, h[1], back);
    return Home.render(view, U.today(), back);
  }
};
window.addEventListener('hashchange', App.route);
App.route();
// 新しい版が出ていたら読み直す（GitHub Pages は最大10分古い＝version.json を毎回取りに行く）
fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(v => {
  const cur = U.get('kai_ver', null);
  if (cur && cur !== v.v) { U.set('kai_ver', v.v); location.reload(); } else U.set('kai_ver', v.v);
}).catch(() => {});
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/* アプリとしてインストール（2026-10-09）
   🪤Pixel の Chrome で「︙→ホーム画面に追加」が「すでにインストールされています」と出て入れられなかった
     （同じ naoto-web.github.io に別のアプリが入っているのをサイト単位で見ている疑い）。
   ⇒ ページ側からインストール画面を直接呼ぶ入口（beforeinstallprompt）をボタンにする。合図が来たときだけ出す。 */
let installEvt = null;
const sub = () => document.getElementById('topbar-sub');
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); installEvt = e;
  let b = document.getElementById('install-btn');
  if (!b) {
    b = document.createElement('button'); b.id = 'install-btn'; b.className = 'btn primary small'; b.textContent = 'アプリとしてインストール';
    b.style.marginLeft = '8px';
    b.onclick = async () => {
      if (!installEvt) return;
      installEvt.prompt();
      const r = await installEvt.userChoice.catch(() => null);
      b.textContent = r && r.outcome === 'accepted' ? 'インストール中…' : 'アプリとしてインストール';
      if (r && r.outcome === 'accepted') installEvt = null;
    };
    document.querySelector('.topbar').appendChild(b);
  }
});
window.addEventListener('appinstalled', () => { const b = document.getElementById('install-btn'); if (b) b.remove(); });
if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) document.documentElement.dataset.standalone = '1';
