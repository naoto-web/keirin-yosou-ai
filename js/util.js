// util.js — 表示の小道具（数字・日付・HTMLエスケープ・保存）
'use strict';
const U = {
  /** 4桁以上はカンマ（作業場の共通ルール） */
  yen(n) { return n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('ja-JP') + '円'; },
  num(n, d) { if (n == null || isNaN(n)) return '—'; return (d ? (+n).toFixed(d) : Math.round(n)).toLocaleString('ja-JP'); },
  pct(p, d) { return p == null || isNaN(p) ? '—' : (100 * p).toFixed(d == null ? 1 : d) + '%'; },
  odds(o) { if (o == null) return '—'; return o >= 1000 ? Math.round(o).toLocaleString('ja-JP') + '倍' : (+o).toFixed(1) + '倍'; },
  esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },

  /** 日付は 'YYYYMMDD' で持つ（APIと同じ） */
  today() { const d = new Date(Date.now() + 9 * 3600e3); return d.toISOString().slice(0, 10).replace(/-/g, ''); },
  shiftDay(ds, n) { const d = new Date(Date.UTC(+ds.slice(0, 4), +ds.slice(4, 6) - 1, +ds.slice(6, 8) + n)); return d.toISOString().slice(0, 10).replace(/-/g, ''); },
  dateLabel(ds) {
    const d = new Date(Date.UTC(+ds.slice(0, 4), +ds.slice(4, 6) - 1, +ds.slice(6, 8)));
    return `${+ds.slice(4, 6)}/${+ds.slice(6, 8)}（${'日月火水木金土'[d.getUTCDay()]}）`;
  },
  toMin(hm) { const m = /^(\d{1,2}):(\d{2})/.exec(hm || ''); return m ? +m[1] * 60 + +m[2] : null; },
  nowMinJst() { const d = new Date(Date.now() + 9 * 3600e3); return d.getUTCHours() * 60 + d.getUTCMinutes(); },
  /** 締切までの残り（当日だけ）。過ぎたら null */
  countdown(ds, den) {
    if (ds !== U.today()) return null;
    const m = U.toMin(den); if (m == null) return null;
    const left = m - U.nowMinJst();
    if (left < 0) return null;
    return left >= 60 ? `あと${Math.floor(left / 60)}時間${left % 60}分` : `あと${left}分`;
  },

  /** 端末に保存（読めない環境でも落とさない） */
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },

  /** 並び文字列（例 "123 45 6 7"）→ ライン配列 */
  parseNarabi(s) { return String(s || '').trim().split(/\s+/).filter(Boolean).map(g => g.replace(/[^0-9]/g, '').split('').map(Number)); },
  carHtml(n) { return `<span class="car c${n}">${n}</span>`; },
  stLabel: { pre: '発売前', on: '発売中', closed: '締切', result: '結果' }
};
