// app.js — 画面の切り替え（#/ … 今日／#/day/YYYYMMDD … その日／#/race/YYYYMMDD/場/R … レース詳細）
'use strict';
const App = {
  route() {
    const view = document.getElementById('view');
    if (!API.key()) return Setup.render(view);
    const h = location.hash.replace(/^#\/?/, '').split('/');
    window.scrollTo(0, 0);
    if (h[0] === 'race' && h[1] && h[2] && h[3]) return Race.render(view, h[1], h[2], +h[3]);
    if (h[0] === 'day' && /^\d{8}$/.test(h[1] || '')) return Home.render(view, h[1]);
    return Home.render(view, U.today());
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
