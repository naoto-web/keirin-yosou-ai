// stats.js — 画面3.4「成績」＝朝ジョブが作った数字（a=status）を表示するだけ（2026-10-09・アプリ段2）
//   🔴ここで新しい数字を定義しない。日次の値は hansei.js の出口（daily_digest）をそのまま足すだけ。
//   ⚠️金額は全部仮想・確定オッズ基準。1日の回収率はノイズ（週次でも±20pt級）＝読むのは累計と週次判定。
'use strict';
const Stats = {
  async render(view) {
    view.innerHTML = `<div class="loading">読み込み中…</div>`;
    let r;
    try { r = await API.status(); }
    catch (e) { if (e.auth) return Setup.render(view, e.message); view.innerHTML = `<div class="card err">${U.esc(e.message)}</div>`; return; }
    Stats.s = r.j.status; Stats.stale = r.stale;
    Stats.draw(view);
  },

  /** 期間の候補＝直近7日／現行の版／ひとつ前の版／全期間。版の区切りは ruler.js（定規を動かした日） */
  ranges(s) {
    const days = s.days || [], last = days.length ? days[days.length - 1].date : null;
    const out = [];
    if (last) out.push({ id: 'd7', label: '直近7日', from: U.shiftDay(last, -6), to: last });
    const ps = (s.periods || []).slice().reverse();
    if (ps[0]) out.push({ id: 'cur', label: `現行 ${ps[0].ver}（${U.md(ps[0].from)}〜）`, from: ps[0].from, to: null, what: ps[0].what });
    if (ps[1]) out.push({ id: 'prev', label: `前の版 ${ps[1].ver}（${U.md(ps[1].from)}〜${U.md(ps[1].to)}）`, from: ps[1].from, to: ps[1].to, what: ps[1].what });
    out.push({ id: 'all', label: '全期間', from: '00000000', to: null });
    return out;
  },

  draw(view) {
    const s = Stats.s;
    const ranges = Stats.ranges(s);
    // 既定＝現行の版。ただし版を上げたばかりで0日なら直近7日（選んだものは端末に覚える）
    const days = s.days || [], cur = ranges.find(x => x.id === 'cur');
    const curEmpty = !cur || !days.some(d => d.date >= cur.from);
    let rid = U.get('kai_range', curEmpty ? 'd7' : 'cur');
    let rg = ranges.find(x => x.id === rid) || ranges[0];
    const rows = (s.days || []).filter(d => d.date >= rg.from && (!rg.to || d.date <= rg.to));
    // 現行の版がまだ0日（版を上げた当日）なら、その旨を出して前の版を見せる
    const empty = !rows.length;
    document.getElementById('topbar-sub').textContent = Stats.stale ? '⚠️通信できず・前回のデータ' : `朝ジョブ ${s.generatedAt.slice(5).replace('-', '/')} 作成`;

    view.innerHTML = `
      ${Stats.alertCard(s)}
      <div class="chips" id="rchips">${ranges.map(x => `<span class="chip ${x.id === rg.id ? 'on' : ''}" data-r="${x.id}">${U.esc(x.label)}</span>`).join('')}</div>
      ${rg.what ? `<div class="note" style="margin-top:0">この版で変えたこと：${rg.what.map(U.esc).join('／')}</div>` : ''}
      ${empty ? `<div class="card muted">この期間の成績はまだありません（翌朝の朝ジョブから1日ずつ増えます）。</div>` : Stats.sumCard(rows) + Stats.chartCard(rows) + '<div id="gradecard"></div>' + Stats.diagCard(rows) + Stats.tableCard(rows)}
      ${Stats.weeklyCard(s.weekly)}
      <div class="note">金額は全部仮想（1レース約3,000円・確定オッズで精算）。本番の損益はGASの台帳が正。<br>
        的中率と捕捉率が一緒に落ちたらモデル、的中率だけ落ちたら買い方（§6.146）。</div>`;
    view.querySelectorAll('#rchips .chip').forEach(c => c.onclick = () => { U.set('kai_range', c.dataset.r); Stats.draw(view); });
    Stats.bindChart(view);
    Stats.loadGrades(view, rg);
  },

  /** 自信度別（2026-10-09 Naoto）＝本番の券面（GASの凍結予想×確定払戻）から。別の呼び出し（a=grades）で後から差し込む */
  async loadGrades(view, rg) {
    const el = view.querySelector('#gradecard'); if (!el) return;
    if (Stats.g) el.innerHTML = Stats.gradeCard(Stats.g, rg);
    else el.innerHTML = `<div class="card muted small">自信度別を読み込み中…</div>`;
    try {
      const r = await API.grades();
      Stats.g = r.j;
      const el2 = view.querySelector('#gradecard'); if (el2) el2.innerHTML = Stats.gradeCard(r.j, rg);
      if (r.j.pending > 0) setTimeout(() => { Stats.g = null; Stats.loadGrades(view, rg); }, 1000);   // 未集計の日が残っていれば続きを取る
    } catch (e) { el.innerHTML = `<div class="card muted small">自信度別は読み込めませんでした（${U.esc(e.message)}）</div>`; }
  },
  gradeCard(g, rg) {
    const t = {}, days = Object.keys(g.days || {}).filter(d => d >= rg.from && (!rg.to || d <= rg.to));
    days.forEach(d => { const x = g.days[d]; for (const k in x) { const o = t[k] || (t[k] = { n: 0, hit: 0, stake: 0, ret: 0, pHit: 0 }); for (const f in o) o[f] += x[k][f] || 0; } });
    const order = ['S', 'A', 'B', 'C', 'D'].concat(Object.keys(t).filter(k => !'SABCD'.includes(k)));
    const rows = order.filter(k => t[k]).map(k => { const a = t[k];
      return `<tr><td><span class="badge grade">${U.esc(k)}</span></td><td class="r num">${a.n}R</td>
        <td class="r num">${U.pct(a.hit / a.n, 1)}<div class="small muted">申告 ${U.pct(a.pHit / a.n, 1)}</div></td>
        <td class="r num">${U.pct(a.stake ? a.ret / a.stake : null, 1)}<div class="small muted">${U.num(a.ret - a.stake)}円</div></td></tr>`; }).join('');
    const from = days.length ? days[0] : null;
    return `<div class="card"><h2>自信度別</h2>
      ${rows ? `<table><thead><tr><th>自信度</th><th class="r">買い</th><th class="r">的中率</th><th class="r">回収率／収支</th></tr></thead><tbody>${rows}</tbody></table>`
        : '<div class="small muted">この期間の集計はまだありません。</div>'}
      ${g.pending ? `<div class="note">集計中（あと${g.pending}日）…</div>` : ''}
      <div class="note">本番の券面（アプリに出ていた自信度・買い目・金額）×確定払戻で集計。上の数字（PCでの再計算）とは少しずれます。
        ${from ? `この表は${U.md(from)}〜（予想の凍結保管が始まった9/14より前は無し）。` : ''}「申告」は自信度が言っていた当たる確率の平均＝実際の的中率と近いほど正直。</div></div>`;
  },

  /** 異常＝朝ジョブのエラー・週次レポートの未読／停止。通知は作らない（§9-1）＝開いたときに赤で出す */
  alertCard(s) {
    const items = [];
    const j = s.job || {};
    if (j.date !== s.today) items.push(`朝ジョブの最新は ${j.date ? U.dateLabel(j.date) : '不明'}＝今日はまだ走っていない`);
    (j.errors || []).forEach(e => items.push(e));
    const w = s.weekly;
    if (w && w.ageDays >= 8) items.push(`週次レポートの最新が ${w.ageDays}日前＝金曜のタスクが動いていない`);
    if (!items.length) return `<div class="card okc"><b>✅ 異常なし</b><span class="small muted">　朝ジョブ ${U.esc(j.startedAt || '')}</span></div>`;
    return `<div class="card alert"><h2>🚨 異常 ${items.length}件</h2><ul>${items.map(x => `<li>${U.esc(x)}</li>`).join('')}</ul></div>`;
  },

  sum(rows) {
    const t = { races: 0, bought: 0, hit: 0, invest: 0, ret: 0, capture: 0, skipLoss: 0, cutLoss: 0, diag: {}, hitDiag: {} };
    rows.forEach(r => {
      ['races', 'bought', 'hit', 'invest', 'ret', 'capture', 'skipLoss', 'cutLoss'].forEach(k => { t[k] += r[k] || 0; });
      ['diag', 'hitDiag'].forEach(k => { for (const x in (r[k] || {})) t[k][x] = (t[k][x] || 0) + r[k][x]; });
    });
    return t;
  },
  sumCard(rows) {
    const t = Stats.sum(rows);
    const rr = t.invest ? t.ret / t.invest : null;
    return `<div class="card sum">
        <div><div class="v num">${rr == null ? '—' : U.pct(rr, 1)}</div><div class="k">回収率</div></div>
        <div><div class="v num">${U.pct(t.bought ? t.hit / t.bought : null, 1)}</div><div class="k">的中率 ${t.hit}/${t.bought}R</div></div>
        <div><div class="v num">${U.pct(t.races ? t.capture / t.races : null, 1)}</div><div class="k">捕捉率</div></div>
        <div><div class="v num">${rows.length}<span class="small muted">日</span></div><div class="k">${U.num(t.races)}R</div></div>
      </div>
      <div class="card"><div class="kv">
        <span class="k">投資</span><span class="num">${U.yen(t.invest)}</span>
        <span class="k">回収</span><span class="num">${U.yen(t.ret)}（収支 ${t.ret - t.invest >= 0 ? '+' : ''}${U.yen(t.ret - t.invest)}）</span>
        <span class="k">見送りの原価</span><span class="num">${U.yen(t.skipLoss)}<span class="small muted">（見送ったが来ていた払戻）</span></span>
        <span class="k">削った目</span><span class="num">${U.yen(t.cutLoss)}<span class="small muted">（合成倍率で外した目が来た分）</span></span>
      </div>
      <div class="note">捕捉率＝来た目がモデルの上位12点に入っていた割合（見送りも含む）＝モデルそのものの物差し。</div></div>`;
  },

  /** 日別の回収率（棒）と7日移動平均（線）。同じ単位なので軸は1本。100%の線＝トントン */
  chartCard(rows) {
    if (rows.length < 2) return '';
    const W = 640, H = 200, L = 34, R = 8, T = 10, B = 22;
    const ys = rows.map(r => (r.invest ? r.ret / r.invest : null));
    const ma = rows.map((r, i) => {
      const w = rows.slice(Math.max(0, i - 6), i + 1), inv = w.reduce((a, x) => a + (x.invest || 0), 0);
      return inv ? w.reduce((a, x) => a + (x.ret || 0), 0) / inv : null;
    });
    const top = Math.max(1.2, Math.ceil(Math.max.apply(null, ys.concat(ma).filter(v => v != null)) * 5) / 5);
    const n = rows.length, bw = (W - L - R) / n;
    const x = i => L + bw * i + bw / 2, y = v => T + (H - T - B) * (1 - v / top);
    const grid = [];
    for (let v = 0; v <= top + 1e-9; v += top > 2 ? 0.5 : 0.2) grid.push(v);
    const bars = rows.map((r, i) => {
      const v = ys[i]; if (v == null) return '';
      const h = Math.max(1, y(0) - y(v)), w = Math.max(2, bw - 2);
      return `<path class="cbar" d="${Stats.roundTop(x(i) - w / 2, y(v), w, h, Math.min(4, w / 2))}"/>`;
    }).join('');
    const line = ma.map((v, i) => (v == null ? '' : `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join('');
    const hits = rows.map((r, i) => `<rect class="chit" data-i="${i}" x="${L + bw * i}" y="${T}" width="${bw}" height="${H - T - B}"/>`).join('');
    const lbl = [0, Math.floor((n - 1) / 2), n - 1].filter((v, i, a) => a.indexOf(v) === i);
    Stats.chartRows = rows; Stats.chartMa = ma;
    return `<div class="card"><h2>日別の回収率</h2>
      <div class="legend small"><span><i class="lg-bar"></i>その日</span><span><i class="lg-line"></i>7日移動平均</span><span><i class="lg-ref"></i>100%＝トントン</span></div>
      <div class="chartwrap"><svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="日別の回収率と7日移動平均">
        ${grid.map(v => `<line class="cgrid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="caxis" x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${Math.round(v * 100)}%</text>`).join('')}
        <line class="cref" x1="${L}" x2="${W - R}" y1="${y(1)}" y2="${y(1)}"/>
        ${bars}<path class="cline" d="${line}"/>
        ${lbl.map(i => `<text class="caxis" x="${x(i)}" y="${H - 6}" text-anchor="middle">${U.md(rows[i].date)}</text>`).join('')}
        <line class="ccross" id="ccross" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/>
        ${hits}
      </svg></div>
      <div class="ctip small" id="ctip">棒をタップすると、その日の数字が出ます</div>
      <div class="note">1日の回収率はノイズ（週次でも±20pt級）。見るのは線（7日平均）と累計。</div></div>`;
  },
  roundTop(x, y, w, h, r) {
    r = Math.min(r, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  },
  bindChart(view) {
    const tip = view.querySelector('#ctip'), cross = view.querySelector('#ccross');
    if (!tip) return;
    view.querySelectorAll('.chit').forEach(el => {
      const show = () => {
        const i = +el.dataset.i, r = Stats.chartRows[i], ma = Stats.chartMa[i];
        const cx = +el.getAttribute('x') + +el.getAttribute('width') / 2;
        cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.style.display = '';
        tip.innerHTML = `<b>${U.dateLabel(r.date)}</b>　回収率 <b class="num">${U.pct(r.invest ? r.ret / r.invest : null, 1)}</b>（7日平均 ${U.pct(ma, 1)}）　的中 ${r.hit}/${r.bought}R・捕捉 ${r.capture}/${r.races}R　<a href="#/day/${r.date}">この日を見る ›</a>`;
      };
      el.addEventListener('mouseenter', show); el.addEventListener('click', show);
    });
  },

  /** 外れの仕分け（①〜④）と当たりの仕分け（★勝ち筋・順当）。仕分けは原因ではない（§6.153） */
  diagCard(rows) {
    const t = Stats.sum(rows);
    const D = [['①買い方', 'モデルは上位12点に置けていたのに買えていない'], ['②考慮漏れ', '市場は知っていた＝追いつく材料はここだけ'],
      ['③確率の配分', '向きは合っている。2・3着の並べ方'], ['④外れてOK', 'どちらも薄かった。直す場所は無い']];
    const H = [['★勝ち筋', '市場が31番人気以下の目をモデルが拾った＝100%超はここが増えたときだけ'], ['順当', 'モデルも市場も上位＝誰でも当たる'], ['的中', '分類の外']];
    const tot = D.reduce((a, [k]) => a + (t.diag[k] || 0), 0), htot = H.reduce((a, [k]) => a + (t.hitDiag[k] || 0), 0);
    const bar = (v, all) => `<div class="bar"><i style="width:${all ? Math.round(100 * v / all) : 0}%"></i></div>`;
    const row = ([k, m], src, all) => `<div class="drow"><div class="row small"><b>${k}</b><span class="muted">${m}</span><span class="spacer"></span>
      <span class="num">${src[k] || 0}R（${U.pct(all ? (src[k] || 0) / all : null, 0)}）</span></div>${bar(src[k] || 0, all)}</div>`;
    return `<div class="card"><h2>外れの仕分け（${tot}R）</h2>${D.map(x => row(x, t.diag, tot)).join('')}
      <h2 style="margin-top:14px">当たりの仕分け（${htot}R）</h2>${H.map(x => row(x, t.hitDiag, htot)).join('')}
      <div class="note">仕分けは原因ではありません。同じ型がたまってから測って決めます（1レースずつ直さない）。</div></div>`;
  },

  tableCard(rows) {
    return `<div class="card"><h2>日別</h2><table><thead><tr><th>日付</th><th class="r">買い</th><th class="r">的中</th><th class="r">回収率</th><th class="r">捕捉率</th></tr></thead><tbody>
      ${rows.slice().reverse().map(r => `<tr><td><a href="#/day/${r.date}">${U.dateLabel(r.date)}</a></td><td class="r num">${r.bought}/${r.races}</td><td class="r num">${r.hit}</td>
        <td class="r num">${U.pct(r.invest ? r.ret / r.invest : null, 1)}</td><td class="r num">${U.pct(r.races ? r.capture / r.races : null, 1)}</td></tr>`).join('')}
    </tbody></table></div>`;
  },

  weeklyCard(w) {
    if (!w) return `<div class="card muted">週次レポートはまだありません（金20:00に作られます）。</div>`;
    const jt = (title, js) => `<div style="margin-top:8px"><div class="small muted">${U.esc(title || '')}</div>
      ${js ? js.map(j => `<div class="jrow"><span class="jm">${j.mark}</span><span><b>${j.id}</b> ${U.esc(j.label)}<div class="small muted num">${U.esc(j.val)}</div></span></div>`).join('')
        : '<div class="small err">判定を読めませんでした（レポートの書式が変わった可能性）</div>'}</div>`;
    return `<div class="card"><h2>週次判定（${U.dateLabel(w.date)}）${w.unread ? ' <span class="badge miss">未読</span>' : ''}</h2>
      ${jt(w.last7 && w.last7.title, w.last7 && w.last7.judge)}
      ${jt(w.cum && w.cum.title, w.cum && w.cum.judge)}
      ${w.seri ? `<div style="margin-top:8px"><div class="small muted">競りの観測（累積）</div><div class="small">${U.esc(w.seri)}</div></div>` : ''}
      ${w.decide && w.decide.length ? `<div style="margin-top:8px"><div class="small muted">決めること</div>${w.decide.map(x => `<div class="small">${U.esc(x.replace(/\*\*/g, ''))}</div>`).join('')}</div>` : ''}
      <div class="note">基準はあとから動かしません。週次でモデルは触りません（変更は判定日だけ）。</div></div>`;
  }
};
