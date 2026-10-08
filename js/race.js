// race.js — 画面3.2「レース詳細」（並び・選手・展開よみ・買い目）＋3.3「振り返り」の最小版（結果・来た目の順位）
'use strict';
const Race = {
  async render(view, d, jo, no) {
    view.innerHTML = `<div class="loading">読み込み中…</div>`;
    let r;
    try { r = await API.race(d, jo, no); }
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
        <div class="lines">${lines.length ? lines.map(g => `<div class="line">${g.map(U.carHtml).join('')}</div>`).join('') : '<span class="small muted">並び未発表</span>'}</div>
        ${(x.seri && x.seri.length) ? `<div class="note">競りあり</div>` : ''}
      </div>
      ${Race.resultCard(j)}
      ${Race.predCard(p, odds, resK, j.oddsSnap)}
      ${Race.scenCard(p)}
      ${Race.riderCard(j.riders)}`;
  },

  resultCard(j) {
    if (!j.res) return '';
    const p = j.pred, k = j.res.k, mp = p && p.mp ? p.mp[k] : null, o = (j.odds || {})[k];
    const s = j.settle;
    let verdict = '';
    if (p && p.buy) verdict = s && s.hit ? `<span class="badge hit">的中 ${U.yen(s.ret)}（投資 ${U.yen(p.stake)}）</span>` : `<span class="badge miss">外れ（投資 ${U.yen(p.stake)}）</span>`;
    else if (p) verdict = `<span class="badge skip">見送り</span>${p.combos && p.combos.indexOf(k) >= 0 ? '' : ''}`;
    return `<div class="card"><h2>結果</h2>
      <div class="row"><div class="lines" style="margin:0">${k.split('-').map(Number).map(U.carHtml).join('')}</div><span class="spacer"></span>
        <div class="num" style="font-weight:700">${U.yen(j.res.pay)}</div></div>
      <div style="margin-top:6px">${verdict}</div>
      <div class="kv" style="margin-top:8px">
        <span class="k">モデル</span><span class="num">${mp ? `${U.pct(mp.p, 2)}・${mp.r}番人気` : '券面に無い目（順位は朝の振り返りで）'}</span>
        <span class="k">市場</span><span class="num">${o ? `${U.odds(o.o)}・${o.r}番人気` : '—'}</span>
        ${j.res.kimarite ? `<span class="k">決まり手</span><span>${U.esc(j.res.kimarite)}</span>` : ''}
      </div></div>`;
  },

  predCard(p, odds, resK, snap) {
    if (!p) return `<div class="card muted">このレースの予想はまだありません（オッズが出そろうと作られます）</div>`;
    const head = p.buy
      ? `<span class="badge buy">買い ${p.combos.length}点</span> <span class="badge grade">自信度 ${U.esc(p.grade)}</span>`
      : `<span class="badge skip">見送り</span> <span class="small muted">${U.esc(p.why)}</span>`;
    const rows = (p.buy ? p.combos : (p.nogate && p.nogate.combos) || []).map(k => {
      const m = p.mp ? p.mp[k] : null, o = odds[k], a = p.alloc ? p.alloc[k] : null;
      return `<tr class="${k === resK ? 'hitrow' : ''}"><td class="num">${U.esc(k)}</td>
        <td class="r num">${p.buy && a != null ? U.num(a) : '—'}</td>
        <td class="r num">${m ? U.pct(m.p, 2) + `<div class="small muted">${m.r}位</div>` : '—'}</td>
        <td class="r num">${o ? U.odds(o.o) + `<div class="small muted">${o.r}位</div>` : '—'}</td></tr>`;
    }).join('');
    const cut = (p.cut || []).filter(k => !(p.combos || []).includes(k));
    return `<div class="card"><h2>買い目</h2>
      <div>${head}</div>
      ${p.buy ? `<div class="kv" style="margin-top:8px">
        <span class="k">投資</span><span class="num">${U.yen(p.stake)}</span>
        <span class="k">当たれば</span><span class="num">${U.yen(p.payMin)}〜${U.yen(p.payMax)}（合成 ${p.gousei != null ? (+p.gousei).toFixed(2) + '倍' : '—'}）</span>
        <span class="k">的中見込み</span><span class="num">${U.pct(p.pHit, 1)}</span></div>` : ''}
      ${rows ? `<table style="margin-top:8px"><thead><tr><th>目</th><th class="r">金額</th><th class="r">モデル</th><th class="r">オッズ</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
      ${!p.buy && rows ? `<div class="note">見送りなので買っていません。表は「見送らなければ買っていた目」です。</div>` : ''}
      ${cut.length ? `<div class="note">合成倍率のため外した目：${cut.map(U.esc).join('、')}</div>` : ''}
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
