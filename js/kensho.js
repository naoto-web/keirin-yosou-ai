// kensho.js — 「検証」タブ＝いま走っている前向き検証の一覧と、最新の週次レポート全文（2026-10-14 Naoto「今どの検証やってるか忘れそう」）
//   数字は作らない＝朝ジョブが各検証の --summary をそのまま運んだもの（a=status の kensho）と、週次レポートの原文（a=weekly）を出すだけ。
'use strict';
const Kensho = {
  async render(view) {
    view.innerHTML = `<div class="loading">読み込み中…</div>`;
    let r;
    try { r = await API.status(); }
    catch (e) { if (e.auth) return Setup.render(view, e.message); view.innerHTML = `<div class="card err">${U.esc(e.message)}</div>`; return; }
    const s = r.j.status, ks = s.kensho || [], w = s.weekly;
    document.getElementById('topbar-sub').textContent = r.stale ? '⚠️通信できず・前回のデータ' : `朝ジョブ ${s.generatedAt.slice(5).replace('-', '/')} 作成`;
    const today = U.today();
    const left = d => Math.round((Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)) - Date.UTC(+today.slice(0, 4), +today.slice(4, 6) - 1, +today.slice(6, 8))) / 86400000);
    const ymd = d => `${d.slice(0, 4)}/${+d.slice(4, 6)}/${+d.slice(6, 8)}`;
    const items = ks.slice().sort((a, b) => (a.judge || '9').localeCompare(b.judge || '9')).map((k, i) => {
      const n = k.judge ? left(k.judge) : null;
      const due = n != null && n <= 0;
      const mark = /✅/.test(k.status) && !/❌|⏸/.test(k.status) ? 'ok' : (due ? 'due' : '');
      return `<div class="card kcard ${mark}">
        <div class="row"><b>${U.esc(k.title)}</b></div>
        <div class="small muted">${U.esc(k.sec)}・開始 ${U.md(k.start)}</div>
        <div class="kjudge">${k.judge ? `判定 <b>${ymd(k.judge)}</b>${k.judgeEst ? '（今のペースからの見積もり）' : ''}・${due ? '<span class="badge miss">判定日です</span>' : `あと<b class="num">${n}</b>日`}` : ''}</div>
        <div class="small muted">${U.esc(k.judgeNote || '')}</div>
        <div class="kstatus small">${U.esc(k.status)}</div>
        <details><summary class="small">途中経過の全文</summary><pre class="kpre">${U.esc(k.text)}</pre></details>
      </div>`;
    }).join('');
    view.innerHTML = `
      <div class="card"><h2>いま走っている検証（${ks.length}本）</h2>
        <div class="small muted">どれも「基準を先に決めて、これからのデータで確かめる」形。途中の数字では判断しません。判定日が来たら、合否と「入れるかどうか」をNaotoさんが決めます。</div></div>
      ${items || '<div class="card muted">いま走っている検証はありません。</div>'}
      <div class="card"><h2>週次レポート</h2>
        ${w ? `<div class="row"><span>${U.dateLabel(w.date)}生成</span>${w.unread ? '<span class="badge miss">未読</span>' : '<span class="badge buy">読了</span>'}<span class="spacer"></span>
          <a class="btn small" href="#/weekly">全文を読む ›</a></div>
          <div class="small muted" style="margin-top:6px">毎週金曜20:00に作られます。決めることがあれば土曜にクロコから声をかけます。</div>` : '<div class="small muted">まだありません。</div>'}
      </div>`;
  },

  /** 週次レポート全文＝Markdown を最低限だけ整形（見出し・表・コードブロック・引用・箇条書き・太字） */
  async weekly(view) {
    view.innerHTML = `<div class="loading">読み込み中…</div>`;
    let r;
    try { r = await API.weekly(); }
    catch (e) { if (e.auth) return Setup.render(view, e.message); view.innerHTML = `<div class="card err">${U.esc(e.message)}</div>`; return; }
    const w = r.j.weekly;
    document.getElementById('topbar-sub').textContent = `${U.dateLabel(w.date)} 生成`;
    view.innerHTML = `<div class="row" style="margin:2px 0 6px"><a class="btn" href="#/kensho">◀ 検証</a></div>
      <div class="card md">${Kensho.md(w.text.replace(/^﻿/, ''))}</div>`;
  },
  md(src) {
    const L = src.split(/\r?\n/), out = [];
    const inline = s => U.esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
    for (let i = 0; i < L.length; i++) {
      const l = L[i];
      if (/^```/.test(l)) { const buf = []; i++; while (i < L.length && !/^```/.test(L[i])) buf.push(L[i++]); out.push(`<pre class="kpre wide">${U.esc(buf.join('\n'))}</pre>`); continue; }
      if (/^\|/.test(l)) {
        const rows = []; while (i < L.length && /^\|/.test(L[i])) rows.push(L[i++]); i--;
        const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const body = rows.filter(r => !/^\|[\s|:-]+\|$/.test(r));
        out.push(`<div class="mdtable"><table>${body.map((r, j) => `<tr>${cells(r).map(c => j === 0 ? `<th>${inline(c)}</th>` : `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</table></div>`);
        continue;
      }
      let m;
      if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { out.push(`<h${Math.min(4, m[1].length + 1)} class="mdh">${inline(m[2])}</h${Math.min(4, m[1].length + 1)}>`); continue; }
      if (/^---+$/.test(l)) { out.push('<hr>'); continue; }
      if ((m = l.match(/^>\s?(.*)$/))) { out.push(`<blockquote>${inline(m[1])}</blockquote>`); continue; }
      if ((m = l.match(/^\s*[-*]\s+(.*)$/))) { out.push(`<div class="mdli">・${inline(m[1])}</div>`); continue; }
      if (l.trim()) out.push(`<p>${inline(l)}</p>`);
    }
    return out.join('');
  }
};
