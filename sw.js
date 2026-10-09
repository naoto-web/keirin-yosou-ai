// sw.js — インストール判定用のサービスワーカー（2026-10-09）
// 🪤中身が空の fetch ハンドラは Chrome に「何もしない」と見なされ、ホーム画面へのインストールが出ないことがある。
//   ⇒ 実際に通信を中継する（ネット優先・失敗したら前回の画面ファイル）。APIのデータはキャッシュしない＝常に最新を取りに行く。
const C = 'kai-shell-v3';
const SHELL = ['./', './index.html', './css/app.css', './js/util.js', './js/api.js', './js/setup.js', './js/home.js', './js/race.js', './js/stats.js', './js/app.js', './app.webmanifest', './icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(SHELL)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // API（script.google.com）は素通し
  e.respondWith(fetch(e.request).then(res => {
    const copy = res.clone(); caches.open(C).then(c => c.put(e.request, copy)).catch(() => {});
    return res;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});