// api.js — 読み出しAPI（GAS「競輪予想AI API」）の呼び出し。鍵は端末に保存したものを使う
'use strict';
const API = {
  URL: 'https://script.google.com/macros/s/AKfycbx64Lgtjj0wPcgUbN1_B6cXOqUYcU2nSCwYnGIG5idxOVEAwf-Hhxc7erffE4BUJWXV/exec',
  key() { return U.get('kai_key', ''); },
  async call(params) {
    const q = new URLSearchParams(Object.assign({ k: API.key() }, params));
    const res = await fetch(API.URL + '?' + q.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error('通信エラー（' + res.status + '）');
    const j = await res.json();
    if (!j.ok) { const e = new Error(j.error === 'auth' ? '合言葉が違います' : (j.error || '取得に失敗')); e.auth = j.error === 'auth'; throw e; }
    return j;
  },
  /** 取れたら端末にも残す＝次に失敗したとき「最後に取れたデータ」を出す（§6） */
  async cached(cacheKey, params) {
    try {
      const j = await API.call(params);
      U.set(cacheKey, { at: Date.now(), j });
      return { j, stale: false };
    } catch (e) {
      const c = U.get(cacheKey, null);
      if (c && !e.auth) return { j: c.j, stale: true, at: c.at, err: e };
      throw e;
    }
  },
  day(d) { return API.cached('kai_day_' + d, { a: 'day', d }); },
  race(d, jo, no) { return API.cached(`kai_race_${d}_${jo}_${no}`, { a: 'race', d, jo, no }); },
  ping() { return API.call({ a: 'ping' }); }
};
