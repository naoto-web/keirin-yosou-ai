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

  /** 期間の候補＝直近7日／直近30日／全期間。
   *  2026-10-20 §6.169「モデルは1本」＝過去の全日を今のモデルで計算し直す運用にしたので、版ごとの区切り（現行／前の版）は出さない */
  ranges(s) {
    const days = s.days || [], last = days.length ? days[days.length - 1].date : null;
    const out = [];
    if (last) out.push({ id: 'd7', label: '直近7日', from: U.shiftDay(last, -6), to: last });
    if (last) out.push({ id: 'd30', label: '直近30日', from: U.shiftDay(last, -29), to: last });
    out.push({ id: 'all', label: '全期間', from: '00000000', to: null });
    return out;
  },

  draw(view) {
    const s = Stats.s;
    const ranges = Stats.ranges(s);
    // 既定＝直近30日（選んだものは端末に覚える）
    let rid = U.get('kai_range', 'd30');
    let rg = ranges.find(x => x.id === rid) || ranges[0];
    const rows = (s.days || []).filter(d => d.date >= rg.from && (!rg.to || d.date <= rg.to));
    // 現行の版がまだ0日（版を上げた当日）なら、その旨を出して前の版を見せる
    const empty = !rows.length;
    document.getElementById('topbar-sub').textContent = Stats.stale ? '⚠️通信できず・前回のデータ' : `朝ジョブ ${s.generatedAt.slice(5).replace('-', '/')} 作成`;
    // 万車モデル（2026-10-20 本体 §6.176・アプリ要件定義 §12）＝上部の切替が「万車」のときは万車の成績だけ（本線と混ぜない）
    if (U.model() === 'MANSHA') {
      view.innerHTML = `${Stats.alertCard(s)}
        <div class="chips" id="rchips">${ranges.map(x => `<span class="chip ${x.id === rg.id ? 'on' : ''}" data-r="${x.id}">${U.esc(x.label)}</span>`).join('')}</div>
        ${Stats.manshaBody(rows)}
        <div class="note">万車モデル＝金額は全部仮想（1点100円×最大10点・締切10分前のオッズで選び確定払戻で精算・PCの朝ジョブが計算）。本線の成績は上の切替で「本線」。</div>`;
      view.querySelectorAll('#rchips .chip').forEach(c => c.onclick = () => { U.set('kai_range', c.dataset.r); Stats.draw(view); });
      Stats.bindChart(view);
      return;
    }

    // 検証中の案を選んだとき（今日タブと共通の選択・2026-10-15 Naoto「成績タブにABD選ぶボタンが出てこない」）
    const plan = U.plan();
    const pname = (U.PLANS.find(x => x[0] === plan) || [])[1];
    const prow = plan ? Stats.planRows(s, plan, rg) : null;
    // 種別の切り替え（2026-10-20 Naoto「通常（7車男子）・ガールズ・グレード（9車）で分けて回収率を見れるように」）
    //   ＝daily_digest の kinds（種別ごとの同じ定義の内訳）を日の行に読み替えて、小計・グラフ・日別表をそのまま使う。仕分け・自信度別は本番全体にしか無いので出さない
    // 2026-10-21 §6.179＝6車男子は本線で見送り。チップ「6車（仮想）」は「もし買っていたら（差し×3着）」の別口の成績（daily_digest の k6）
    const KINDS = [['all', '全部'], ['7車男子', '7車男子'], ['9車男子', '9車（グレード）'], ['ガールズ', 'ガールズ'], ['6車男子', '6車（仮想）']];
    const kind = U.get('kai_kind2', 'all');
    const krows = kind === 'all' ? rows : rows.filter(r => r.kinds && r.kinds[kind]).map(r => Object.assign({ date: r.date, diag: {}, hitDiag: {}, skipLoss: 0, cutLoss: 0, kinds: null, structs: kind === '7車男子' ? r.structs : null }, r.kinds[kind]));
    const body = kind === '6車男子' ? Stats.k6Body(rows) : kind === 'all'
      ? Stats.sumCard(rows) + Stats.kindCard(rows) + Stats.structCard(rows) + Stats.chartCard(rows) + Stats.planCard(s, rg) + '<div id="gradecard"></div>' + Stats.diagCard(rows) + Stats.tableCard(rows)
      : (krows.length ? Stats.sumCard(krows, true) + (kind === '7車男子' ? Stats.structCard(krows) : '') + Stats.chartCard(krows) + Stats.tableCard(krows) : `<div class="card muted">この期間に${U.esc(kind)}の記録がありません。</div>`);

    view.innerHTML = `
      ${Stats.alertCard(s)}
      ${U.planChips('spchips')}
      <div class="chips" id="rchips">${ranges.map(x => `<span class="chip ${x.id === rg.id ? 'on' : ''}" data-r="${x.id}">${U.esc(x.label)}</span>`).join('')}</div>
      <div class="chips" id="kchips2">${KINDS.map(([k, l]) => `<span class="chip ${kind === k ? 'on' : ''}" data-k="${k}">${l}</span>`).join('')}</div>
      ${rg.what ? `<div class="note" style="margin-top:0">この版で変えたこと：${rg.what.map(U.esc).join('／')}</div>` : ''}
      ${plan ? Stats.planBody(prow, pname, s, rg) :
        (empty ? `<div class="card muted">この期間の成績はまだありません（翌朝の朝ジョブから1日ずつ増えます）。</div>` : body)}
      ${Stats.weeklyCard(s.weekly)}
      <div class="note">金額は全部仮想（7車男子＝1的中3,000円の変動額・100円未満の目は買わない・固いゲート無し・1レース最大1,500円／9車・ガールズ＝1レース3,000円・固いゲートあり／6車男子＝買わない（「6車（仮想）」は別口）・確定オッズで精算）。本番の損益はGASの台帳が正。<br>
        成績は<b>全日を今のモデル（v15＋買い目v7.2）で計算し直した値</b>＝モデルを変えたら過去も同じモデルで引き直す（2026-10-20〜）。<br>
        的中率と捕捉率が一緒に落ちたらモデル、的中率だけ落ちたら買い方（§6.146）。</div>`;
    view.querySelectorAll('#rchips .chip').forEach(c => c.onclick = () => { U.set('kai_range', c.dataset.r); Stats.draw(view); });
    view.querySelectorAll('#kchips2 .chip').forEach(c => c.onclick = () => { U.set('kai_kind2', c.dataset.k); Stats.draw(view); });
    view.querySelectorAll('#spchips .chip').forEach(c => c.onclick = () => { U.set('kai_plan', c.dataset.plan); Stats.draw(view); });
    Stats.bindChart(view);
    if (!plan && kind === 'all') Stats.loadGrades(view, rg);
  },

  /** 万車モデルの成績（§6.176）＝daily_digest の mansha（hansei.js の出口・t10 で選び確定で精算）をそのまま足す。9/10〜10/20 は参考・10/21〜が観測 */
  manshaBody(rows) {
    const mr = rows.filter(r => r.mansha).map(r => Object.assign({ date: r.date }, r.mansha));
    const head = `<div class="plannote mansha">🎯 <b>万車モデル（高配当狙い・別口・仮想）</b>＝${U.MANSHA_NOTE} 9/10〜10/20 は同じ定義で引き直した参考、10/21〜が観測。<b>的中50本たまるまで数字は読まない</b>（本体 §6.176.5）。</div>`;
    if (!mr.length) return head + `<div class="card muted">この期間の記録はありません（万車モデルの記録は9/10〜・翌朝の朝ジョブから増えます）。</div>`;
    const sum = k => mr.reduce((a, r) => a + (r[k] || 0), 0);
    const inv = sum('invest'), ret = sum('ret'), rr = inv ? ret / inv : null, bought = sum('bought'), hit = sum('hit');
    const obs = mr.filter(r => r.date >= '20261021'), oh = obs.reduce((a, r) => a + (r.hit || 0), 0);
    const sumCard = `<div class="card sum mansha">
        <div><div class="v num">${U.pct(rr, 1)}</div><div class="k">回収率</div></div>
        <div><div class="v num">${hit}<span class="small muted">/${bought}R</span></div><div class="k">的中 ${U.pct(bought ? hit / bought : null, 1)}</div></div>
        <div><div class="v num">${U.num(ret)}</div><div class="k">回収／投資 ${U.num(inv)}</div></div>
        <div><div class="v num">${mr.length}<span class="small muted">日</span></div><div class="k">収支 ${ret - inv >= 0 ? '+' : ''}${U.num(ret - inv)}円</div></div>
      </div>
      <div class="card"><div class="kv"><span class="k">観測の進み</span><span class="num">的中 ${oh}/50本（10/21〜${obs.length}日）${oh >= 50 ? '＝読める' : '＝まだ読まない'}</span>
        <span class="k">対象→買い</span><span class="num">${sum('races')}R → ${bought}R（荒れ予測で見送り ${sum('skipped')}R）</span></div></div>`;
    // 万車のレースを当てているか（2026-10-20 Naoto「そもそも万車のレースを当てられているのか、っていう情報もほしい」）＝レース選別の精度。目の的中とは別
    const man = sum('man'), manSkip = sum('manSkip'), manAll = sum('manAll'), skipped = sum('skipped'), races = sum('races');
    const hasMan = mr.some(r => r.man != null);
    const selCard = hasMan ? `<div class="card manshacard"><h2>万車のレースを当てているか</h2>
      <table><thead><tr><th></th><th class="r">レース</th><th class="r">万車が来た</th><th class="r">万車率</th></tr></thead><tbody>
        <tr><td>買った（荒れ予測≥しきい値）</td><td class="r num">${bought}</td><td class="r num">${man}</td><td class="r num"><b>${U.pct(bought ? man / bought : null, 1)}</b></td></tr>
        <tr><td>見送った（荒れ予測＜しきい値）</td><td class="r num">${skipped}</td><td class="r num">${manSkip}</td><td class="r num">${U.pct(skipped ? manSkip / skipped : null, 1)}</td></tr>
        <tr class="grp"><td>7車男子 全体</td><td class="r num">${races}</td><td class="r num">${manAll}</td><td class="r num">${U.pct(races ? manAll / races : null, 1)}</td></tr>
      </tbody></table>
      <div class="kv" style="margin-top:6px"><span class="k">万車が来た買いレースで、目まで当てた</span><span class="num">${hit}/${man}（${U.pct(man ? hit / man : null, 1)}）</span></div>
      <div class="note">万車＝3連単の払戻1万円以上。レースの選別＝「買った側の万車率」が「見送った側」より高いほど荒れるレースを当てている（過去データの目安＝買った側 約37%・全体 27%・見送った側 約24%）。目の的中＝万車が来ても、その目が10点に入るとは限らない（過去データの目安＝約20%）。</div></div>` : '';
    const table = `<div class="card"><h2>日別</h2><table><thead><tr><th>日付</th><th class="r">買い/対象</th><th class="r">万車</th><th class="r">的中</th><th class="r">投資</th><th class="r">回収率</th></tr></thead><tbody>
      ${mr.slice().reverse().map(r => `<tr><td><a href="#/day/${r.date}">${U.dateLabel(r.date)}</a>${r.date < '20261021' ? '<span class="small muted"> 参考</span>' : ''}</td><td class="r num">${r.bought}/${r.races}</td><td class="r num">${r.man != null ? r.man : '—'}</td><td class="r num">${r.hit}</td><td class="r num">${U.num(r.invest)}</td>
        <td class="r num">${U.pct(r.invest ? r.ret / r.invest : null, 1)}</td></tr>`).join('')}
      </tbody></table><div class="note">「万車」＝買ったレースのうち万車（払戻1万円以上）が来た数。日付をタップすると、その日の一覧を万車モデルで開きます。</div></div>`;
    return head + sumCard + selCard + Stats.chartCard(mr) + table;
  },

  /** 6車男子の「もし買っていたら」（本体 §6.179・2026-10-21）＝daily_digest の k6（hansei.js の出口・t10 で選び確定で精算）をそのまま足す。
   *  本線は6車男子を見送る＝ここの数字は本線の成績に入っていない。記録は t10 のある 9/10〜 */
  k6Body(rows) {
    const kr = rows.filter(r => r.k6).map(r => Object.assign({ date: r.date }, r.k6));
    const head = `<div class="plannote k6">🚲 <b>6車男子＝本線は見送り。ここは「もし買っていたら」（別口・仮想）</b>＝${U.K6_NOTE}</div>`;
    if (!kr.length) return head + `<div class="card muted">この期間の記録はありません（記録は9/10〜・翌朝の朝ジョブから増えます）。</div>`;
    const sum = k => kr.reduce((a, r) => a + (r[k] || 0), 0);
    const inv = sum('invest'), ret = sum('ret'), bought = sum('bought'), hit = sum('hit');
    const sumCard = `<div class="card sum">
        <div><div class="v num">${U.pct(inv ? ret / inv : null, 1)}</div><div class="k">回収率</div></div>
        <div><div class="v num">${hit}<span class="small muted">/${bought}R</span></div><div class="k">的中 ${U.pct(bought ? hit / bought : null, 1)}</div></div>
        <div><div class="v num">${U.num(ret)}</div><div class="k">回収／投資 ${U.num(inv)}</div></div>
        <div><div class="v num">${kr.length}<span class="small muted">日</span></div><div class="k">収支 ${ret - inv >= 0 ? '+' : ''}${U.num(ret - inv)}円</div></div>
      </div>
      <div class="card"><div class="kv"><span class="k">対象→買い</span><span class="num">${sum('races')}R → ${bought}R（見送り ${sum('skipped')}R）</span>
        <span class="k">過去データの判定</span><span class="num">88.4%<span class="small muted">（3/26〜10/20・701R・今の本線のやり方なら74.4%）</span></span></div></div>`;
    const table = `<div class="card"><h2>日別</h2><table><thead><tr><th>日付</th><th class="r">買い/6車</th><th class="r">的中</th><th class="r">投資</th><th class="r">回収率</th></tr></thead><tbody>
      ${kr.slice().reverse().map(r => `<tr><td><a href="#/day/${r.date}">${U.dateLabel(r.date)}</a></td><td class="r num">${r.bought}/${r.races}</td><td class="r num">${r.hit}</td><td class="r num">${U.num(r.invest)}</td>
        <td class="r num">${U.pct(r.invest ? r.ret / r.invest : null, 1)}</td></tr>`).join('')}
      </tbody></table><div class="note">日付をタップするとその日の一覧へ。6車男子のレースを開くと「もし買っていたら」の券面が見られます。</div></div>`;
    return head + sumCard + Stats.chartCard(kr) + table;
  },

  /** 案の日別を、本番の日次（daily_digest）と同じ形に読み替える＝小計・グラフ・日別表をそのまま使うため */
  planRows(s, plan, rg) {
    return (s.plansDaily || []).filter(d => d.date >= rg.from && (!rg.to || d.date <= rg.to) && d.p[plan])
      .map(d => { const t = d.p[plan], b = d.p.base || [0, 0, 0, 0];
        return { date: d.date, bought: t[0], invest: t[1], ret: t[2], hit: t[3], base: { invest: b[1], ret: b[2] } }; });
  },
  planBody(rows, pname, s, rg) {
    const head = `<div class="plannote">🔬 <b>${U.esc(pname)}</b>（検証中の案・実際には買っていない）。7車男子だけ・締切10分前のオッズで選び確定払戻で精算（PCで計算）。
      9/10〜10/14は今のモデルで作り直した参考、10/15〜が判定の窓。<b>途中の数字では判断しない</b>（判定は11/30）。</div>`;
    if (!rows.length) return head + `<div class="card muted">この期間の記録はありません（案の記録は9/10〜）。</div>`;
    const sum = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
    const inv = sum('invest'), ret = sum('ret'), bInv = rows.reduce((a, r) => a + r.base.invest, 0), bRet = rows.reduce((a, r) => a + r.base.ret, 0);
    const rr = inv ? ret / inv : null, br = bInv ? bRet / bInv : null;
    const sumCard = `<div class="card sum plan">
        <div><div class="v num">${U.pct(rr, 1)}</div><div class="k">回収率</div></div>
        <div><div class="v num">${rr != null && br != null ? (rr >= br ? '+' : '') + (100 * (rr - br)).toFixed(1) + 'pt' : '—'}</div><div class="k">基準との差（基準 ${U.pct(br, 1)}）</div></div>
        <div><div class="v num">${U.pct(sum('bought') ? sum('hit') / sum('bought') : null, 1)}</div><div class="k">的中率 ${sum('hit')}/${sum('bought')}R</div></div>
        <div><div class="v num">${rows.length}<span class="small muted">日</span></div><div class="k">収支 ${U.num(ret - inv)}円</div></div>
      </div>`;
    const table = `<div class="card"><h2>日別</h2><table><thead><tr><th>日付</th><th class="r">買い</th><th class="r">的中</th><th class="r">回収率</th><th class="r">基準</th></tr></thead><tbody>
      ${rows.slice().reverse().map(r => `<tr><td><a href="#/day/${r.date}">${U.dateLabel(r.date)}</a>${r.date < '20261015' ? '<span class="small muted"> 参考</span>' : ''}</td><td class="r num">${r.bought}</td><td class="r num">${r.hit}</td>
        <td class="r num">${U.pct(r.invest ? r.ret / r.invest : null, 1)}</td><td class="r num muted">${U.pct(r.base.invest ? r.base.ret / r.base.invest : null, 1)}</td></tr>`).join('')}
      </tbody></table><div class="note">日付をタップすると、その日の一覧を同じ案で開きます。</div></div>`;
    return head + sumCard + Stats.chartCard(rows) + Stats.planCard(s, rg) + table;
  },

  /** 検証中の買い方との比較（2026-10-15 Naoto「成績タブにもABD入れれない？」）
   *  出どころ＝PCの kaikata.js（7車男子・締切10分前のオッズで選び確定払戻で精算）。基準＝今の買い方を同じ土俵で計算し直したもの */
  planCard(s, rg) {
    return '';   // 2026-10-20 §6.169「モデルは1本」＝検証中の買い方との比較は廃止（Bは本番の買い目v6に取り込んだ）。以下は旧コード＝呼ばれない
    // eslint-disable-next-line no-unreachable
    const days = (s.plansDaily || []).filter(d => d.date >= rg.from && (!rg.to || d.date <= rg.to));
    if (!days.length) return '';
    const NAMES = [['base', '基準（今の買い方）'], ['A', 'A 人気目を外す'], ['B', 'B スジ×3着に寄せる'], ['D', 'D ズレの大きいレースだけ'], ['E', 'E 番手3点上の押し切り（モデルなし・1R 3,000円）'], ['E2', 'E2 同じ目を1的中1万円の変動額で']];
    const tot = {}; days.forEach(d => { for (const id in d.p) { const t = tot[id] || (tot[id] = [0, 0, 0, 0]); d.p[id].forEach((v, i) => { t[i] += v; }); } });
    const b = tot.base ? tot.base[2] / tot.base[1] : null;
    const rows = NAMES.filter(([id]) => tot[id]).map(([id, nm]) => { const t = tot[id], r = t[1] ? t[2] / t[1] : null;
      const diff = id !== 'base' && b != null && r != null ? r - b : null;
      return `<tr class="${id === 'base' ? 'grp' : ''}"><td>${nm}</td><td class="r num">${t[0]}R</td><td class="r num">${t[3]}</td>
        <td class="r num">${U.pct(r, 1)}${diff != null ? `<div class="small ${diff >= 0 ? '' : 'muted'}">${diff >= 0 ? '+' : ''}${(100 * diff).toFixed(1)}pt</div>` : ''}</td>
        <td class="r num">${U.num(t[2] - t[1])}円</td></tr>`; }).join('');
    const inWin = days.filter(d => d.date >= '20261015').length;
    return `<div class="card"><h2>🔬 検証中の買い方との比較（${days.length}日）</h2>
      <table><thead><tr><th>買い方</th><th class="r">買ったR</th><th class="r">的中</th><th class="r">回収率<div class="small">基準との差</div></th><th class="r">収支</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="note">7車男子だけ・1レース3,000円・締切10分前のオッズで選び確定払戻で精算（PCで計算）。「基準」は今の買い方を同じ土俵で計算し直したもの＝上の成績とは少しずれます。
        9/10〜10/14は今のモデルで作り直した参考、<b>10/15〜が判定の窓</b>（この期間では${inWin}日）。<b>途中の数字では判断しない</b>（判定はB・Dが11/30、Eが12/15）。
        案E（10/20登録）はモデルを使わないルール＝番手の得点が先頭より3点以上高いラインの押し切り×3着を払戻均等で買う。10/20以前は参考、窓は10/21〜。今日タブには出ない。</div></div>`;
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
    // 🪤朝ジョブは7:40起動＝それより前は「昨日が最新」で正常。9時を過ぎても今日の分が無いときだけ異常にする（2026-10-15 深夜に誤報）
    const jstHour = new Date(Date.now() + 9 * 3600e3).getUTCHours();
    if (j.date !== U.today() && (j.date < U.shiftDay(U.today(), -1) || jstHour >= 9)) items.push(`朝ジョブの最新は ${j.date ? U.dateLabel(j.date) : '不明'}＝今日はまだ走っていない`);
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
  /** lite＝種別で絞ったとき（見送りの原価・削った目は種別別に持っていないので出さない） */
  sumCard(rows, lite) {
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
        ${lite ? '' : `<span class="k">見送りの原価</span><span class="num">${U.yen(t.skipLoss)}<span class="small muted">（見送ったが来ていた払戻）</span></span>
        <span class="k">削った目</span><span class="num">${U.yen(t.cutLoss)}<span class="small muted">（合成倍率で外した目が来た分）</span></span>`}
      </div>
      <div class="note">捕捉率＝来た目がモデルの上位12点に入っていた割合（見送りも含む）＝モデルそのものの物差し。</div></div>`;
  },

  /** 種別ごと（2026-10-20 Naoto「モデルが違うから7車男子・ガールズ・9車で分けて表示」）＝hansei.js --json の kinds をそのまま足す。
   *  種別の記録は10/20（買い目v6）から＝それより前の日は持たないので、この期間に1日も無ければ出さない */
  kindCard(rows) {
    const t = {}; let n = 0;
    rows.forEach(r => { if (!r.kinds) return; n++; for (const k in r.kinds) { const o = t[k] || (t[k] = { races: 0, bought: 0, skipped: 0, hit: 0, invest: 0, ret: 0, capture: 0 }); for (const f in o) o[f] += r.kinds[k][f] || 0; } });
    if (!n) return '';
    const ORDER = ['7車男子', '9車男子', 'ガールズ', '6車男子'];   // 6車男子＝本線は見送り（§6.179・買い 0）
    const keys = ORDER.filter(k => t[k]).concat(Object.keys(t).filter(k => !ORDER.includes(k)));
    const trs = keys.map(k => { const a = t[k];
      return `<tr><td>${U.esc(k)}${k === '9車男子' ? '<div class="small muted">グレード戦</div>' : k === '6車男子' ? '<div class="small muted">本線は見送り</div>' : ''}</td><td class="r num">${a.bought}/${a.races}</td>
        <td class="r num">${U.pct(a.bought ? a.hit / a.bought : null, 1)}</td>
        <td class="r num">${U.pct(a.invest ? a.ret / a.invest : null, 1)}<div class="small muted">${a.ret - a.invest >= 0 ? '+' : ''}${U.num(a.ret - a.invest)}円</div></td>
        <td class="r num">${U.pct(a.races ? a.capture / a.races : null, 1)}</td></tr>`; }).join('');
    return `<div class="card"><h2>種別ごと（${n}日）</h2>
      <table><thead><tr><th>種別</th><th class="r">買い/終了</th><th class="r">的中率</th><th class="r">回収率／収支</th><th class="r">捕捉率</th></tr></thead><tbody>${trs}</tbody></table>
      <div class="note">モデルも買い方も種別で違う（7車男子＝シナリオ木＋スジ×3着＋1的中3,000円の変動額（v7.1・100円未満の目は買わない）／9車＝tree9＋1レース3,000円／ガールズ＝レーティング＋1レース3,000円）。</div></div>`;
  },

  /** 7車男子のライン構造ごと（2026-10-20 Naoto「3:2:2、3:3:1 みたいに分けて回収率を出したい→構造ごとにモデルを変えていく」）
   *  ＝hansei.js --json の structs（2車以上のラインの車数を大きい順・1＝単騎）をそのまま足す。レース数の多い順 */
  structCard(rows) {
    const t = {}; let n = 0;
    rows.forEach(r => { if (!r.structs) return; n++; for (const k in r.structs) { const o = t[k] || (t[k] = { races: 0, bought: 0, skipped: 0, hit: 0, invest: 0, ret: 0, capture: 0 }); for (const f in o) o[f] += r.structs[k][f] || 0; } });
    if (!n) return '';
    const keys = Object.keys(t).sort((a, b) => t[b].races - t[a].races);
    const trs = keys.map(k => { const a = t[k];
      return `<tr><td class="num">${U.esc(k)}</td><td class="r num">${a.bought}/${a.races}</td>
        <td class="r num">${U.pct(a.bought ? a.hit / a.bought : null, 1)}</td>
        <td class="r num">${U.pct(a.invest ? a.ret / a.invest : null, 1)}<div class="small muted">${a.ret - a.invest >= 0 ? '+' : ''}${U.num(a.ret - a.invest)}円</div></td>
        <td class="r num">${U.pct(a.races ? a.capture / a.races : null, 1)}</td></tr>`; }).join('');
    return `<div class="card"><h2>ライン構造ごと（7車男子・${n}日）</h2>
      <table><thead><tr><th>構造</th><th class="r">買い/終了</th><th class="r">的中率</th><th class="r">回収率／収支</th><th class="r">捕捉率</th></tr></thead><tbody>${trs}</tbody></table>
      <div class="note">並びの車数を大きい順に並べたもの（1＝単騎・例 3:2:2）。構造ごとにモデルを分けていく土台（§6.172）。レース数の少ない構造は読まない。</div></div>`;
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
        tip.innerHTML = `<b>${U.dateLabel(r.date)}</b>　回収率 <b class="num">${U.pct(r.invest ? r.ret / r.invest : null, 1)}</b>（7日平均 ${U.pct(ma, 1)}）　的中 ${r.hit}/${r.bought}R${r.capture != null ? `・捕捉 ${r.capture}/${r.races}R` : ''}　<a href="#/day/${r.date}">この日を見る ›</a>`;
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
