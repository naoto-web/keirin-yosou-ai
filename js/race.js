// race.js — 画面3.2「レース詳細」（並び・選手・展開よみ・買い目）＋3.3「振り返り」の最小版（結果・来た目の順位）
'use strict';
const Race = {
  async render(view, d, jo, no) {
    view.innerHTML = `<div class="loading">読み込み中…</div>`;
    let r;
    try { r = await API.race(d, jo, no, U.planFor(d)); }   // 10/20以前＝v6で組み直し（2026-10-20）
    catch (e) { if (e.auth) return Setup.render(view, e.message); view.innerHTML = `<div class="card err">${U.esc(e.message)}</div>`; return; }
    const j = r.j, x = j.race, p = j.pred, odds = j.odds || {};
    document.getElementById('topbar-sub').textContent = r.stale ? '⚠️通信できず・前回のデータ' : `更新 ${j.now ? j.now.hm : ''}`;
    const lines = U.parseNarabi(x.narabi);
    const resK = j.res ? j.res.k : null;

    view.innerHTML = `
      <div class="row" style="margin:2px 0 6px"><a class="btn" href="#/day/${d}">◀ 一覧</a><span class="spacer"></span>
        <span class="badge st">${U.stLabel[x.st] || ''}</span></div>
      <div class="card rhead">
        <div class="ttl">${U.esc(x.venue)} ${x.no}R ${x.isGirls ? '<span class="badge girls">ガールズ</span>' : ''}</div>
        <div class="small muted">${U.dateLabel(d)}・${U.esc(x.cls)}・${x.cars}車・発走 ${U.esc(x.start)}／締切 ${U.esc(x.den)}${U.countdown(d, x.den) ? '（' + U.countdown(d, x.den) + '）' : ''}</div>
        ${Race.narabiHtml(lines, j.riders)}
        ${(x.seri && x.seri.length) ? `<div class="note">競りあり</div>` : ''}
      </div>
      ${Race.resultCard(j, lines)}
      ${Race.planCard(j, lines)}
      ${Race.reviewCard(j, d)}
      ${Race.honsenBelow(j, d, p, odds, resK, lines)}
      ${Race.scenCard(p)}
      ${Race.riderCard(j.riders)}`;
    // 並べ方の切り替え（決着順／モデル順）＝買い目のカードだけ描き直す
    Race.last = [p, odds, resK, j.oddsSnap, lines, j.riders, Race.predTitle(j, d)];
    Race.bindSort(view);
  },
  bindSort(view) {
    view.querySelectorAll('#predcard .chip[data-sort]').forEach(c => c.onclick = () => {
      U.set('kai_sort', c.dataset.sort);
      view.querySelector('#predcard').innerHTML = Race.predCard.apply(null, Race.last);
      Race.bindSort(view);
    });
  },
  /** 本線の券面（predCard）の見出し＝万車モードでは「本線の買い目」と明記（2026-10-20 Naoto「12点の買目のやつが残ってる、ナニコレ」） */
  predTitle(j, d) { return j.plan && j.plan.id === 'MANSHA' ? '本線の買い目（別口）' : '買い目'; },
  /** 万車カードの下に出す本線の券面。
   *  ・本線モード＝10/21より前は planCard（今の買い目で組み直し）が券面なので出さない／10/21〜は本番の券面
   *  ・万車モード＝10/21〜は本番の券面（v7.2）を「本線の買い目」として出す。10/21より前は本番の券面が旧ルール（12点・3,000円）なので**出さない**
   *    （Naoto「旧ルールの券面はアプリに残さない」）＝「本線」に切り替えれば組み直した券面が見られる旨だけ */
  honsenBelow(j, d, p, odds, resK, lines) {
    const pl = j.plan;
    if (pl && pl.id === 'NOW') return '';
    if (pl && pl.id === 'MANSHA' && d < U.NOW_SINCE) return `<div class="card muted small">本線の券面（今の買い目v7.2で組み直したもの）は、上の切替を「本線」にすると見られます。この日の当時の本番の券面（旧ルール）は出しません。</div>`;
    return `<div id="predcard">${Race.predCard(p, odds, resK, j.oddsSnap, lines, j.riders, Race.predTitle(j, d))}</div>`;
  },

  /** 決着順＝1着の選手ごとにまとめる（並び順）。中は2着が同じライン→別線、その中は並び順 */
  sortByKetchaku(keys, lines) {
    const order = {}; let i = 0; lines.forEach(g => g.forEach(n => { order[n] = i++; }));
    const lineOf = {}; lines.forEach((g, li) => g.forEach(n => { lineOf[n] = li; }));
    const o = n => (order[n] != null ? order[n] : 99);
    return keys.slice().sort((x, y) => {
      const [a1, b1, c1] = x.split('-').map(Number), [a2, b2, c2] = y.split('-').map(Number);
      if (a1 !== a2) return o(a1) - o(a2);
      const s1 = lineOf[b1] === lineOf[a1] ? 0 : 1, s2 = lineOf[b2] === lineOf[a2] ? 0 : 1;
      return (s1 - s2) || (o(b1) - o(b2)) || (o(c1) - o(c2));
    });
  },

  /** 並び＝車番バッジの下に苗字・ラインとラインの間に「・」（2026-10-09 Naoto） */
  narabiHtml(lines, riders) {
    if (!lines.length) return '<div class="lines"><span class="small muted">並び未発表</span></div>';
    const sei = {};
    (riders || []).forEach(r => { sei[r.no] = String(r.name || '').trim().split(/[\s　]+/)[0]; });
    const line = g => `<div class="line">${g.map(n => `<div class="carcol">${U.carHtml(n)}<span class="nm">${U.esc(sei[n] || '')}</span></div>`).join('')}</div>`;
    return `<div class="lines narabi">${lines.map(line).join('<span class="lsep">・</span>')}</div>`;
  },
  /** モデル欄と市場欄は同じ形（確率／順位）で横に並べる。オッズは金額の欄へ（張った額×オッズ＝当たったときの払戻）
   *  2026-10-09 Naoto「％と何位はモデルと市場並んで見れたらいい」 */
  modelCell(m) { return m ? `${U.pct(m.p, 2)}<div class="small muted">${m.r}位</div>` : '—'; },
  marketCell(o) { return o && o.p != null ? `${U.pct(o.p, 2)}<div class="small muted">${o.r}位</div>` : '—'; },
  stakeCell(a, o) {
    const od = o ? U.odds(o.o) : '';
    if (a == null) return od ? `<span class="muted">—</span><div class="small muted">${od}</div>` : '—';
    return `${U.num(a)}円<div class="small muted">${od}${o ? '→' + U.num(a * o.o) + '円' : ''}</div>`;   // オッズは1円あたりの倍率＝払戻＝金額×オッズ
  },

  resultCard(j, lines) {
    if (!j.res) return '';
    const p = j.pred, k = j.res.k, mp = p && p.mp ? p.mp[k] : null, o = (j.odds || {})[k];
    const s = j.settle, pl = j.plan;
    let verdict = '';
    // 万車モード（2026-10-20 Naoto「10/13熊本7R 571で的中になってるけど万車の10点にない・投資3,000円って書いてる」）
    //   ＝結果の判定は**万車枠の精算**で出す（本線の本番券面の的中/投資をここに出さない＝混ぜない）
    if (pl && pl.id === 'MANSHA') {
      const ms = pl.settle, inv = pl.stake || (pl.set ? pl.set.length * 100 : 0);
      verdict = pl.set ? (ms && ms.hit ? `<span class="badge hit">万車枠 的中 ${U.yen(ms.ret)}（投資 ${U.yen(inv)}）</span>` : `<span class="badge miss">万車枠 外れ（投資 ${U.yen(inv)}）</span>`) : `<span class="badge skip">万車枠 見送り</span>`;
    } else if (pl && pl.id === 'NOW') {
      const ns = pl.settle, inv = pl.stake || 0;
      verdict = pl.set ? (ns && ns.hit ? `<span class="badge hit">的中 ${U.yen(ns.ret)}（投資 ${U.yen(inv)}）</span>` : `<span class="badge miss">外れ（投資 ${U.yen(inv)}）</span>`) : `<span class="badge skip">見送り</span>`;
    } else if (p && p.buy) verdict = s && s.hit ? `<span class="badge hit">的中 ${U.yen(s.ret)}（投資 ${U.yen(p.stake)}）</span>` : `<span class="badge miss">外れ（投資 ${U.yen(p.stake)}）</span>`;
    else if (p) verdict = `<span class="badge skip">見送り</span>`;
    return `<div class="card"><h2>結果</h2>
      <div class="row">${U.comboHtml(k)}<span class="spacer"></span>
        <div class="num" style="font-weight:700">${U.yen(j.res.pay)}</div></div>
      <div class="kinds">${U.kindHtml(k, lines)}</div>
      <div style="margin-top:6px">${verdict}</div>
      <div class="kv" style="margin-top:8px">
        <span class="k">モデル</span><span class="num">${mp ? `${U.pct(mp.p, 2)}・${mp.r}番人気` : (p && p.hasAll ? '—' : '記録なし（全通りの保存は10/9の昼以降に作った予想から）')}</span>
        <span class="k">市場</span><span class="num">${o ? `${o.p != null ? U.pct(o.p, 2) + '・' : ''}${o.r}番人気（${U.odds(o.o)}）` : '—'}</span>
        ${j.res.kimarite ? `<span class="k">決まり手</span><span>${U.esc(j.res.kimarite)}</span>` : ''}
        ${j.jiko && j.jiko.length ? `<span class="k">事故</span><span class="jikolist">${j.jiko.map(([car, st]) =>
          `<span class="row" style="gap:6px">${U.carHtml(car)}<b>${U.esc(Race.sei(j.riders, car))}</b><span class="badge jiko">${U.esc(st)}</span></span>`).join('')}</span>` : ''}
      </div></div>`;
  },
  sei(riders, no) {
    const r = (riders || []).find(x => x.no === +no);
    return r ? String(r.name || '').trim().split(/[\s　]+/)[0] : '';
  },

  /** 10/21より前の日＝今の買い目（v7）で組み直した券面（2026-10-20 §6.169.1）。本番の凍結確率×オッズのスナップでAPIがその場で組む。
   *  当時の本番の券面（旧ルール）は出さない（2026-10-20 Naoto「残す必要ない」＝predCard を出さない）。検証中の案（A/B/D）の表示は旧コード＝今は呼ばれない */
  planCard(j, lines) {
    const pl = j.plan; if (!pl) return '';
    const now = pl.id === 'NOW', isM = pl.id === 'MANSHA';   // isM＝万車モデル（§6.176・別口・仮想）
    const SNAP = { t10: '締切10分前', pre: '締切2時間前（暫定）', open: '発売開始時（暫定）' };
    const cls = isM ? 'manshacard' : 'plancard';
    const title = isM ? '🎯 万車モデルの買い目（高配当狙い・別口・仮想）' : now ? '買い目（今の買い目v7.2で組み直し）' : `🔬 ${U.esc(pl.name)}の買い目`;
    const score = isM && pl.score != null ? `<div class="kv" style="margin-top:6px"><span class="k">荒れ予測</span><span class="num">${U.pct(pl.score, 0)}${pl.thresh != null ? `<span class="small muted">（しきい値 ${U.pct(pl.thresh, 0)}）</span>` : ''}</span></div>` : '';
    if (!pl.set) return `<div class="card ${cls}"><h2>${title}</h2><div class="small">${U.esc(pl.skip || '買い目なし')}</div>${score}
      <div class="note">${isM ? '万車モデルは荒れ予測がしきい値以上の7車男子だけ買う。下の「買い目」は本線の券面（別口）。' : now ? '今の買い目なら見送りになるレース。' : '検証中の案（実際には買っていない）。途中の数字では判断しない。'}</div></div>`;
    const resK = j.res ? j.res.k : null, s = pl.settle;
    const inv = pl.stake || pl.set.reduce((t, x) => t + (x.stake || 0), 0);   // v7＝1Rの投資額は券面の合計
    const verdict = s ? (s.hit ? `<span class="badge hit">的中 ${U.yen(s.ret)}（投資 ${U.yen(inv)}）</span>` : `<span class="badge miss">外れ（投資 ${U.yen(inv)}）</span>`) : '';
    const rows = pl.set.map(x => `<tr class="${x.k === resK ? 'hitrow' : ''}"><td>${U.comboHtml(x.k, true)}<div class="kinds">${U.kindHtml(x.k, lines)}</div></td>
      <td class="r num">${U.num(x.stake)}円<div class="small muted">${U.odds(x.odds)}→${U.num(x.stake * x.odds)}円</div></td>
      <td class="r num">${U.pct(x.p, 2)}</td><td class="r num">${x.mk != null ? U.pct(x.mk, 2) : '—'}</td></tr>`).join('');
    return `<div class="card ${cls}"><h2>${title}</h2>
      <div class="row" style="flex-wrap:wrap;gap:6px"><span class="badge buy">${isM ? '万車' : '買い'} ${pl.set.length}点${isM ? '×100円' : ''}</span>${now ? '<span class="badge grade">スジ×3着・1的中3,000円（v7.2）</span>' : ''}${pl.ref ? '<span class="badge grade">参考</span>' : ''}${pl.tentative ? '<span class="badge grade">暫定</span>' : ''}${verdict}</div>
      ${pl.ref ? '<div class="small muted" style="margin-top:4px">📎 PCで作り直した参考値（今のモデルv15で組んだもの・当時の本番モデルとは別）</div>' : ''}
      <div class="kv" style="margin-top:6px"><span class="k">投資</span><span class="num">${U.yen(inv)}</span>${pl.gousei != null ? `<span class="k">合成</span><span class="num">${(+pl.gousei).toFixed(2)}倍</span>` : ''}</div>${score}
      <table style="margin-top:6px"><thead><tr><th>目</th><th class="r">金額／オッズ</th><th class="r">モデル</th><th class="r">市場</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="note">${isM ? `${U.MANSHA_NOTE} オッズは${SNAP[pl.snap] || pl.snap}時点。下の「買い目」は本線の券面（別口）。` : now ? `凍結した確率と${SNAP[pl.snap] || pl.snap}のオッズで、今の買い目v7.2（スジ×3着・賭金＝3,000÷オッズ・100円未満の目は買わない・固いゲート無し）に組み直したもの。当時の本番の券面（旧ルール）は出しません。`
        : `検証中の案（実際には買っていない）。オッズは${SNAP[pl.snap] || pl.snap}時点で組んだもの。下の「買い目」は本番の券面です。`}</div></div>`;
  },

  /** 3.3 振り返り＝診断（どこが悪かったか）・ズレの座標・選手のレース後コメント（2026-10-09 段2）
   *  診断はAPIが shindan.js の写しで出す（Node正本と総当たりで一致を検査済み）。仕分けであって原因ではない */
  reviewCard(j, d) {
    if (!j.res) return '';
    const g = j.diag, post = j.post;
    let diag = '';
    if (g) {
      const cls = g.tag === '★勝ち筋' ? 't-win' : (g.tag === '②考慮漏れ' ? 't-miss2' : '');
      const NAME = ['1着の層', '2着の層（1着を固定）', '3着の層（1・2着を固定）'];
      diag = `<div class="row" style="flex-wrap:wrap"><span class="dtag ${cls}">${U.esc(g.tag)}</span>
          <span class="small muted num">モデル${g.mr || '—'}番／市場${g.kr || '—'}番</span></div>
        <div class="small" style="margin-top:6px">${U.esc(g.why)}</div>
        ${g.layers ? `<table style="margin-top:8px"><thead><tr><th>ズレの座標</th><th class="r">モデル</th><th class="r">市場</th><th class="r">推した車<div class="small">モデル→市場</div></th></tr></thead><tbody>
          ${g.layers.map((x, i) => `<tr class="${x.worst ? 'worst' : ''}"><td>${x.worst ? '★' : ''}${NAME[i]}</td><td class="r num">${U.pct(x.m, 1)}</td><td class="r num">${U.pct(x.k, 1)}</td>
            <td class="r"><span class="combo sm pair">${U.carHtml(x.mTop.car)}<span class="arr">→</span>${U.carHtml(x.kTop.car)}</span></td></tr>`).join('')}</tbody></table>
          <div class="note">★＝来た目に対してモデルが市場より薄く置いた度合いがいちばん大きい層＝直す場所の候補（原因ではない）。</div>` : ''}`;
    } else {
      diag = `<div class="small muted">診断できません（来た目のモデル順位の記録がない＝全通りの保存は10/9の昼以降に作った予想から）。</div>`;
    }
    let pc;
    if (post && post.length) {
      pc = post.slice().sort((a, b) => (a[0] || 99) - (b[0] || 99)).map(([rank, car, name, lead, body]) =>
        `<div class="pc"><div class="row">${U.carHtml(car)}<b>${U.esc(name)}</b><span class="spacer"></span><span class="small muted">${rank ? rank + '着' : ''}</span></div>
          ${lead ? `<div class="lead">${U.esc(lead)}</div>` : ''}<div class="body">${U.esc(body)}</div></div>`).join('');
    } else {
      pc = `<div class="small muted">${d >= U.today() ? 'レース後コメントは翌朝の朝ジョブで届きます。' : 'コメントはありません（取材なし・F1F2の最終日は対象外・アプリに載せているのは直近3日だけ）。'}</div>`;
    }
    // 落車・失格はモデルの外の出来事＝仕分けより先にこれを疑う（欠場はレース前の取り消しなので対象外）
    const ev = (j.jiko || []).filter(x => !/欠場/.test(x[1]));
    const jikoNote = ev.length ? `<div class="jikonote">⚠️ このレースは${U.esc(U.jikoMain(ev))}あり（${ev.map(x => x[0] + '番 ' + x[1]).map(U.esc).join('・')}）。
      荒れた理由はまずこれ＝モデルの外の出来事なので、下の仕分けは割り引いて読む。</div>` : '';
    const isM = j.plan && j.plan.id === 'MANSHA';   // 万車モードでも仕分けは本線（モデルの順位と券面）のもの＝見出しで明記
    return `<div class="card"><h2>振り返り${isM ? '<span class="small muted">（本線の仕分け＝万車枠とは別）</span>' : ''}</h2>${jikoNote}${diag}
      <h2 style="margin-top:14px">選手のレース後コメント</h2>${pc}
      ${post && post.length ? '<div class="note">本人の言葉は後知恵を含みます。「何が足りなかったか」の候補として読む。</div>' : ''}</div>`;
  },

  /** k（'x-y-z'）がスジ×3着か＝先頭→同ライン番手→（同ライン3番手 or 別ライン（2車以上）の先頭）。本番 bets.js isSujiR と同じ判定（表示用の写し） */
  isSuji(k, lines) {
    const at = {}; (lines || []).filter(g => g.length).forEach((g, i) => g.forEach((n, p) => { at[n] = { li: i, pos: p, size: g.length }; }));
    const [x, y, z] = k.split('-').map(Number), A = at[x], B = at[y], C = at[z];
    if (!A || !B || !C || A.size < 2 || A.pos !== 0 || B.li !== A.li || B.pos !== 1 || C.size < 2) return false;
    return (C.li === A.li && C.pos === 2) || (C.li !== A.li && C.pos === 0);
  },

  predCard(p, odds, resK, snap, lines, riders, title) {
    if (!p) return `<div class="card muted">このレースの予想はまだありません（オッズが出そろうと作られます）</div>`;
    title = title || '買い目';
    const hasLines = lines.some(g => g.length >= 2);
    // 2026-10-20 Naoto「旧ルールの券面はアプリで見えるように残す必要ない」＝ルールの印（スジ×3着／旧ルール）は出さない。10/21より前の日は planCard（今の買い目で組み直し）が券面
    const head = p.buy
      ? `<span class="badge buy">買い ${p.combos.length}点</span> <span class="badge grade">自信度 ${U.esc(p.grade)}</span>`
      : `<span class="badge skip">見送り</span> <span class="small muted">${U.esc(p.why)}</span>`;
    const mode = hasLines ? U.get('kai_sort', 'ketchaku') : 'model';
    let keys = (p.buy ? p.combos : (p.nogate && p.nogate.combos) || []).slice();
    if (mode === 'ketchaku') keys = Race.sortByKetchaku(keys, lines);
    const sei = {}; (riders || []).forEach(r => { sei[r.no] = String(r.name || '').trim().split(/[\s　]+/)[0]; });
    let prevA = null;
    const rows = keys.map(k => {
      const m = p.mp ? p.mp[k] : null, o = odds[k], a = p.alloc ? p.alloc[k] : null;
      let grp = '';
      const a1 = +k.split('-')[0];
      if (mode === 'ketchaku' && a1 !== prevA) {
        prevA = a1;
        const same = keys.filter(x => +x.split('-')[0] === a1);
        const yen = same.reduce((s, x) => s + ((p.alloc && p.alloc[x]) || 0), 0);
        const mp = same.reduce((s, x) => s + ((p.mp && p.mp[x]) ? p.mp[x].p : 0), 0);
        const k1 = U.comboKind(k, lines)[0];
        grp = `<tr class="grp"><td colspan="4"><span class="row" style="gap:6px">1着 ${U.carHtml(a1)}<b>${U.esc(sei[a1] || '')}</b>${k1 ? `<span class="kind ${k1.c}">${k1.t}</span>` : ''}
          <span class="spacer"></span><span class="small muted num">${same.length}点${p.buy ? '・' + U.num(yen) + '円' : ''}・モデル計${U.pct(mp, 1)}</span></span></td></tr>`;
      }
      return grp + `<tr class="${k === resK ? 'hitrow' : ''}"><td>${U.comboHtml(k, true)}<div class="kinds">${U.kindHtml(k, lines)}</div></td>
        <td class="r num">${Race.stakeCell(p.buy ? a : null, o)}</td>
        <td class="r num">${Race.modelCell(m)}</td>
        <td class="r num">${Race.marketCell(o)}</td></tr>`;
    }).join('');
    const sortChips = hasLines && keys.length ? `<div class="chips" style="margin-top:8px">${[['ketchaku', '決着順'], ['model', 'モデル順']].map(([v, l]) => `<span class="chip ${mode === v ? 'on' : ''}" data-sort="${v}">${l}</span>`).join('')}</div>` : '';
    const cut = (p.cut || []).filter(k => !(p.combos || []).includes(k));
    // 合成倍率のため外した目＝1目1行・右にモデルとオッズ（市場の確率・人気）
    const cutRows = cut.map(k => `<tr class="${k === resK ? 'hitrow' : ''}"><td>${U.comboHtml(k, true)}<div class="kinds">${U.kindHtml(k, lines)}</div></td>
        <td class="r num">${Race.stakeCell(null, odds[k])}</td><td class="r num">${Race.modelCell(p.mp ? p.mp[k] : null)}</td><td class="r num">${Race.marketCell(odds[k])}</td></tr>`).join('');
    return `<div class="card"><h2>${U.esc(title)}</h2>
      <div>${head}</div>
      ${p.buy ? `<div class="kv" style="margin-top:8px">
        <span class="k">投資</span><span class="num">${U.yen(p.stake)}</span>
        <span class="k">当たれば</span><span class="num">${U.yen(p.payMin)}〜${U.yen(p.payMax)}（合成 ${p.gousei != null ? (+p.gousei).toFixed(2) + '倍' : '—'}）</span>
        <span class="k">的中見込み</span><span class="num">${U.pct(p.pHit, 1)}</span></div>` : ''}
      ${sortChips}
      ${rows ? `<table style="margin-top:4px"><thead><tr><th>目</th><th class="r">金額／オッズ</th><th class="r">モデル</th><th class="r">市場</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
      ${!p.buy && rows ? `<div class="note">見送りなので買っていません。表は「見送らなければ買っていた目」です。</div>` : ''}
      ${cutRows ? `<h2 style="margin-top:14px">合成倍率のため外した目</h2><table><tbody>${cutRows}</tbody></table>` : ''}
      <div class="note">モデル・市場とも「その目が来る確率・210通り（9車は504通り）の中の順位」。市場の確率はオッズから控除分を除いたもの。</div>
      ${lines.some(g => g.length >= 2) ? `<div class="note">決まり方＝1着がライン先頭なら押し切り・番手なら番手差し／2着が同じラインならライン決着・違えば別線（並びから自動判定）。</div>` : ''}
      <div class="note">予想作成 ${U.esc(p.at)}${p.retime ? `・締切10分前に組み直し ${U.esc(p.retime.at)}` : ''}${p.frozen ? '・凍結済み' : ''}。オッズは${snap ? { final: '確定', last: '締切直前', t10: '締切10分前', pre: '締切2時間前', open: '発売開始時' }[snap] + '時点' : '未取得'}。</div>
    </div>`;
  },

  scenCard(p) {
    if (!p || !p.scenarios || !p.scenarios.length) return '';
    const max = Math.max.apply(null, p.scenarios.map(s => s.p));
    return `<div class="card"><h2>展開よみ</h2>
      ${p.frontLabel ? `<div class="small muted" style="margin-bottom:6px">前受け想定：${U.esc(p.frontLabel)}${p.mainKimarite ? `／本線の決まり手：${U.esc(p.mainKimarite)}` : ''}</div>` : ''}
      ${p.scenarios.map(s => `<div style="margin:6px 0"><div class="row small"><span>${U.esc(s.label)}</span><span class="spacer"></span><span class="num">${U.pct(s.p, 0)}</span></div>
        <div class="bar"><i style="width:${max ? Math.round(100 * s.p / max) : 0}%"></i></div></div>`).join('')}
    </div>`;
  },

  riderCard(riders) {
    if (!riders || !riders.length) return '';
    return `<div class="card"><h2>選手</h2><table><thead><tr><th>車</th><th>選手</th><th class="r">得点</th><th class="r">勝率</th><th class="r">B</th></tr></thead><tbody>
      ${riders.map(r => `<tr><td>${U.carHtml(r.no)}</td><td><div>${U.esc(r.name)} <span class="small muted">${U.esc(r.pref)}・${U.esc(r.kyuhan)}・${U.esc(r.kyaku)}</span></div>
        ${r.comment ? `<div class="cmt">${U.esc(r.comment)}</div>` : ''}</td>
        <td class="r num">${r.score != null ? (+r.score).toFixed(2) : '—'}</td><td class="r num">${r.win != null ? U.num(r.win, 1) : '—'}</td><td class="r num">${r.B != null ? r.B : '—'}</td></tr>`).join('')}
    </tbody></table></div>`;
  }
};
