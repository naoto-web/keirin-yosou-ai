// home.js — 画面3.1「今日」＝その日のレース一覧（買い/見送り・締切までの残り・結果）
'use strict';
const Home = {
  timer: null,
  /** 2026-10-10 Naoto「詳細から戻るたびに読み込みが入る」
   *  ⇒ 手元にある前回の一覧（メモリ→端末保存の順）を先に即表示し、裏で取り直して差し替える。
   *    詳細から戻ったときはスクロール位置も戻す（restore）。 */
  async render(view, d, restore) {
    d = d || U.today();
    const plan = U.planFor(d);   // 10/20以前＝今の買い目（v7）で組み直し（2026-10-20）
    const token = Home.token = (Home.token || 0) + 1;   // 取り直している間に別画面へ移ったら描かない
    const saved = Home.d === d && Home.plan === plan && Home.data ? { j: Home.data } : U.get(plan ? `kai_day_${d}_${plan}` : 'kai_day_' + d, null);
    if (saved && saved.j) {
      Home.data = saved.j; Home.d = d; Home.plan = plan;
      Home.draw(view, { j: saved.j, stale: false });
      if (restore) window.scrollTo(0, Home.scroll || 0);
    } else view.innerHTML = `${U.planChips('pchips0')}<div class="loading">読み込み中…${plan ? '（今の買い目で組み直すので、初めての日は10〜20秒かかります）' : ''}</div>`;
    let r;
    try { r = await API.day(d, plan); }
    catch (e) {
      if (saved && saved.j) return;   // 手元の一覧は出ている＝エラーで消さない
      if (e.auth) return Setup.render(view, e.message); view.innerHTML = `<div class="card err">${U.esc(e.message)}</div>`; return;
    }
    if (token !== Home.token) return;
    const y = window.scrollY;
    Home.data = r.j; Home.d = d; Home.plan = plan;
    Home.draw(view, r);
    window.scrollTo(0, y);
    clearInterval(Home.timer);
    if (d === U.today()) Home.timer = setInterval(() => { if (location.hash.startsWith('#/day') || location.hash === '#/' || location.hash === '') Home.refresh(view); }, 60000);
  },
  async refresh(view) {
    try { const r = await API.day(Home.d, Home.plan); Home.data = r.j; Home.draw(view, r); } catch (e) {}
  },
  /** 検証中の案のとき＝各レースの案の結果を、本番の予想と同じ形に読み替える（一覧・絞り込み・小計をそのまま使うため） */
  asPlan(j) {
    if (!j.plan) return j;
    const isM = j.plan.id === 'MANSHA';   // 万車モデル（§6.176）＝買いのバッジに「万車」
    return Object.assign({}, j, {
      sum: j.planSum || {},
      races: (j.races || []).map(x => {
        const pl = x.plan || { buy: false, why: '' };
        return Object.assign({}, x, {
          // 予想そのものが無いレース＝「見送り・予想なし」ではなく「予想なし」のバッジ（2026-10-21）
          pred: pl.buy ? { buy: true, n: pl.n, stake: pl.stake, grade: pl.prod ? (x.pred && x.pred.grade) || '' : (pl.ref ? '参考' : (pl.tentative ? '暫定' : (isM ? '万車' : ''))) } : (pl.why === '予想なし' ? null : { buy: false, why: pl.why || '' }),
          hit: pl.buy ? pl.hit : null, ret: pl.buy ? pl.ret : null
        });
      })
    });
  },
  draw(view, r) {
    const j = Home.asPlan(r.j), d = Home.d;
    const venue = U.get('kai_venue', 'all'), kind = U.get('kai_kind', 'all'), kind3 = U.get('kai_kind3', 'all');
    const venues = (j.venues || []);
    // 種別のボタン（2026-10-20 Naoto「ボタンでガールズだけ・グレードだけ、と選べるように」）＝一覧も小計もその種別だけに
    const KINDS3 = [['all', '全部'], ['7', '7車男子'], ['9', '9車（グレード）'], ['g', 'ガールズ']];
    const kindOf = x => (x.isGirls ? 'g' : x.cars === 9 ? '9' : '7');
    let races = j.races || [];
    if (kind3 !== 'all') races = races.filter(x => kindOf(x) === kind3);
    const s = kind3 === 'all' ? (j.sum || {}) : Home.sumOf(races);
    if (venue !== 'all') races = races.filter(x => String(x.jo) === venue);
    if (kind === 'buy') races = races.filter(x => x.pred && x.pred.buy);
    if (kind === 'skip') races = races.filter(x => !x.pred || !x.pred.buy);
    if (kind === 'open') races = races.filter(x => x.st !== 'result');

    document.getElementById('topbar-sub').textContent = r.stale ? `⚠️通信できず・${new Date(r.at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}時点` : `更新 ${j.now ? j.now.hm : ''}`;
    const rr = s.stake ? s.ret / s.stake : null;
    // 万車モード＝「万車のレースを当てているか」（2026-10-20 Naoto）＝結果の出た7車男子で、買った側／見送った側それぞれの万車（払戻1万円以上）の数
    Home.isM = !!(j.plan && j.plan.id === 'MANSHA');
    let manCard = '';
    if (Home.isM) {
      const done = (j.races || []).filter(x => x.res && x.cars === 7 && !x.isGirls);
      const isMan = x => x.res.pay >= 10000, buyS = done.filter(x => x.pred && x.pred.buy), skipS = done.filter(x => !(x.pred && x.pred.buy));
      const mb = buyS.filter(isMan).length, ms = skipS.filter(isMan).length, mh = buyS.filter(x => isMan(x) && x.hit).length;
      if (done.length) manCard = `<div class="card small"><b>万車が来た</b>　買い ${mb}/${buyS.length}R（${U.pct(buyS.length ? mb / buyS.length : null, 0)}）・見送り ${ms}/${skipS.length}R（${U.pct(skipS.length ? ms / skipS.length : null, 0)}）・万車が来た買いレースで目まで当てた ${mh}/${mb}</div>`;
    }
    view.innerHTML = `
      <div class="datenav">
        <a class="btn" href="#/day/${U.shiftDay(d, -1)}">◀</a>
        <div class="date">${U.dateLabel(d)}${d === U.today() ? ' 今日' : ''}</div>
        <a class="btn" href="#/day/${U.shiftDay(d, 1)}">▶</a>
      </div>
      ${d !== U.today() ? `<div style="text-align:center;margin-bottom:6px"><a class="btn small" href="#/day/${U.today()}">今日に戻る</a></div>` : ''}
      ${U.planChips('pchips')}
      ${j.plan && j.plan.id === 'MANSHA' ? `<div class="plannote mansha">🎯 <b>万車モデル（高配当狙い・別口・仮想）</b>＝${U.MANSHA_NOTE}${d < '20261021' ? ' この日は同じ定義で引き直した<b>参考</b>（観測は10/21〜）。' : ''}</div>`
        : j.plan && j.plan.id === 'NOW' ? `<div class="plannote">🧮 この日は<b>今の買い目v7.2（スジ×3着・1的中3,000円・100円未満の目は買わない・固いゲート無し）で組み直した券面</b>。7車男子は凍結した確率と締切10分前のオッズで組み直しています。9車・ガールズは当時の本番のまま（買い方は今と同じ）。</div>`
        : j.plan ? `<div class="plannote">🔬 <b>${U.esc(j.plan.name)}</b>（検証中の案・実際には買っていない）。7車男子だけ。</div>` : ''}
      ${j.plan && j.planSum && j.planSum.ref ? `<div class="plannote">📎 この日は<b>PCで作り直した参考値</b>（${j.planSum.ref}R）＝今のモデル（v15）で組んだもの。</div>` : ''}
      ${j.plan && j.planSum && j.planSum.prodOnly ? `<div class="plannote">📎 この日は全通りの確率を保存していない予想が${j.planSum.prodOnly}Rあります（全通りの保存は10/9の昼以降）。そのレースだけは組み直せないので、当時の本番の券面をそのまま出しています。</div>` : ''}
      <div class="chips" id="kchips3">${KINDS3.map(([k, l]) => `<span class="chip ${kind3 === k ? 'on' : ''}" data-k3="${k}">${l}</span>`).join('')}</div>
      <div class="card sum ${j.plan && j.plan.id === 'MANSHA' ? 'mansha' : j.plan ? 'plan' : ''}">
        <div><div class="v num">${s.buy || 0}<span class="small muted">/${s.races || 0}R</span></div><div class="k">買い</div></div>
        <div><div class="v num">${s.hit || 0}<span class="small muted">/${s.settled || 0}</span></div><div class="k">的中</div></div>
        <div><div class="v num">${U.num(s.ret)}</div><div class="k">回収／投資 ${U.num(s.stake)}</div></div>
        <div><div class="v num">${rr == null ? '—' : U.pct(rr, 1)}</div><div class="k">回収率</div></div>
      </div>
      ${manCard}
      <div class="chips" id="vchips">
        <span class="chip ${venue === 'all' ? 'on' : ''}" data-v="all">時刻順</span>
        ${venues.map(v => `<span class="chip ${venue === String(v.jo) ? 'on' : ''}" data-v="${U.esc(v.jo)}">${U.esc(v.venue)}${v.grade ? ' ' + U.esc(v.grade) : ''}</span>`).join('')}
      </div>
      <div class="chips" id="kchips">
        ${[['all', '全部'], ['buy', '買い'], ['skip', '見送り'], ['open', '結果待ち']].map(([k, l]) => `<span class="chip ${kind === k ? 'on' : ''}" data-k="${k}">${l}</span>`).join('')}
      </div>
      ${j.note ? `<div class="card muted">${U.esc(j.note)}</div>` : ''}
      ${Home.table(races, d)}
      ${j.plan && j.plan.id === 'MANSHA'
        ? '<div class="note">万車モデル＝金額は全部仮想（1点100円×最大10点・締切10分前のオッズで選び確定払戻で精算）。本線の券面は上の切替で「本線」。的中50本たまるまで数字は読まない（本体 §6.176.5）。</div>'
        : '<div class="note">金額は全部仮想（7車男子＝1的中3,000円の変動額・100円未満の目は買わない・1レース最大1,500円／9車・ガールズ＝1レース3,000円・確定オッズで精算）。本番の損益はGASの台帳が正。</div>'}`;
    view.querySelectorAll('tr[data-href]').forEach(tr => tr.onclick = () => { location.hash = tr.dataset.href; });
    view.querySelectorAll('#pchips .chip').forEach(c => c.onclick = () => { U.set('kai_plan', c.dataset.plan); Home.render(view, Home.d); });
    view.querySelectorAll('#kchips3 .chip').forEach(c => c.onclick = () => { U.set('kai_kind3', c.dataset.k3); Home.draw(view, r); });
    view.querySelectorAll('#vchips .chip').forEach(c => c.onclick = () => { U.set('kai_venue', c.dataset.v); Home.draw(view, r); });
    view.querySelectorAll('#kchips .chip').forEach(c => c.onclick = () => { U.set('kai_kind', c.dataset.k); Home.draw(view, r); });
  },
  /** 種別で絞ったときの小計（APIの sum と同じ定義＝結果が出た買いだけ投資と回収を足す） */
  sumOf(races) {
    const s = { races: 0, buy: 0, hit: 0, settled: 0, stake: 0, ret: 0 };
    races.forEach(x => { s.races++; if (!x.pred || !x.pred.buy) return; s.buy++; if (x.hit == null) return; s.settled++; s.stake += x.pred.stake || 0; s.ret += x.ret || 0; if (x.hit) s.hit++; });
    return s;
  },
  /** 1レース1行の表（2026-10-21 Naoto「08:27/青森1R/3:2:2/1点/投400円/回0円/▲400円/累▲400円」・縦列をそろえる）
   *  列＝時刻／レース（印＝G・9・万・落/失）／構造／点／投資／回収／収支／累計。累計＝表示している行を時刻順に足した収支（結果の出た買いだけ）。
   *  行は的中＝緑・外れ＝収支が赤・見送り＝灰・結果待ち＝「…」。行をタップでレース詳細。万車モードでは投資・回収が万車枠の数字になる（asPlan で読み替え済み） */
  table(races, d) {
    if (!races.length) return '<div class="card muted">該当するレースはありません</div>';
    let cum = 0;
    const rows = races.map(x => {
      const p = x.pred, buy = !!(p && p.buy), settled = buy && x.hit != null;
      const inv = buy ? (p.stake || 0) : 0, ret = settled ? (x.ret || 0) : null, pl = settled ? ret - inv : null;
      if (settled) cum += pl;
      const cls = settled ? (x.hit ? 'hit' : 'miss') : buy ? 'open' : 'skip';
      const cd = U.countdown(d, x.den), soon = cd && /^あと\d+分$/.test(cd) && +cd.replace(/\D/g, '') <= 15;
      const jm = U.jikoMain(x.jiko);
      const marks = `${x.isGirls ? '<span class="rb g">G</span>' : x.cars === 9 ? '<span class="rb">9</span>' : ''}${x.res && x.res.pay >= 10000 ? '<span class="rb man">万</span>' : ''}${jm ? `<span class="rb jiko">${jm.slice(0, 1)}</span>` : ''}`;
      return `<tr class="${cls}" data-href="#/race/${d}/${x.jo}/${x.no}">
        <td class="l hm ${soon ? 'soon' : ''}">${U.esc(x.den || x.start || '')}</td>
        <td class="l race">${U.esc(x.venue)}${x.no}R${marks}</td>
        <td class="l st">${x.isGirls ? '—' : U.structOf(x.narabi)}</td>
        <td class="r">${buy ? p.n + '点' : (p ? '見送' : '—')}</td>
        <td class="r">${buy ? U.num(inv) : '—'}</td>
        <td class="r ret">${settled ? U.num(ret) : (buy ? '…' : '—')}</td>
        <td class="r pl">${settled ? U.money(pl) : (buy ? '…' : '—')}</td>
        <td class="r cum">${settled ? U.money(cum) : ''}</td></tr>`;
    }).join('');
    return `<table class="rtab">
      <colgroup><col class="c-hm"><col class="c-race"><col class="c-st"><col class="c-pts"><col class="c-inv"><col class="c-ret"><col class="c-pl"><col class="c-cum"></colgroup>
      <thead><tr><th class="l">時刻</th><th class="l">レース</th><th class="l">構造</th><th class="r">点</th><th class="r">投資</th><th class="r">回収</th><th class="r">収支</th><th class="r">累計</th></tr></thead>
      <tbody>${rows}</tbody></table>
      <div class="note">構造＝並びの車数（大きい順・1＝単騎）。点＝買い目の点数（見送＝見送り）。投資・回収・収支＝円（▲＝マイナス）。累計＝表示している行を時刻順に足した収支（結果の出た買いだけ）。「…」＝結果待ち。印＝G ガールズ・9 9車・万 万車（払戻1万円以上）・落/失 事故。行をタップで詳細。</div>`;
  }
};
