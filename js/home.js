// home.js — 画面3.1「今日」＝その日のレース一覧（買い/見送り・締切までの残り・結果）
'use strict';
const Home = {
  timer: null,
  async render(view, d) {
    d = d || U.today();
    view.innerHTML = `<div class="loading">読み込み中…</div>`;
    let r;
    try { r = await API.day(d); }
    catch (e) { if (e.auth) return Setup.render(view, e.message); view.innerHTML = `<div class="card err">${U.esc(e.message)}</div>`; return; }
    Home.data = r.j; Home.d = d;
    Home.draw(view, r);
    clearInterval(Home.timer);
    if (d === U.today()) Home.timer = setInterval(() => { if (location.hash.startsWith('#/day') || location.hash === '#/' || location.hash === '') Home.refresh(view); }, 60000);
  },
  async refresh(view) {
    try { const r = await API.day(Home.d); Home.data = r.j; Home.draw(view, r); } catch (e) {}
  },
  draw(view, r) {
    const j = r.j, d = Home.d;
    const venue = U.get('kai_venue', 'all'), kind = U.get('kai_kind', 'all');
    const venues = (j.venues || []);
    const s = j.sum || {};
    let races = j.races || [];
    if (venue !== 'all') races = races.filter(x => String(x.jo) === venue);
    if (kind === 'buy') races = races.filter(x => x.pred && x.pred.buy);
    if (kind === 'skip') races = races.filter(x => !x.pred || !x.pred.buy);
    if (kind === 'open') races = races.filter(x => x.st !== 'result');

    document.getElementById('topbar-sub').textContent = r.stale ? `⚠️通信できず・${new Date(r.at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}時点` : `更新 ${j.now ? j.now.hm : ''}`;
    const rr = s.stake ? s.ret / s.stake : null;
    view.innerHTML = `
      <div class="datenav">
        <a class="btn" href="#/day/${U.shiftDay(d, -1)}">◀</a>
        <div class="date">${U.dateLabel(d)}${d === U.today() ? ' 今日' : ''}</div>
        <a class="btn" href="#/day/${U.shiftDay(d, 1)}">▶</a>
      </div>
      ${d !== U.today() ? `<div style="text-align:center;margin-bottom:6px"><a class="btn small" href="#/day/${U.today()}">今日に戻る</a></div>` : ''}
      <div class="card sum">
        <div><div class="v num">${s.buy || 0}<span class="small muted">/${s.races || 0}R</span></div><div class="k">買い</div></div>
        <div><div class="v num">${s.hit || 0}<span class="small muted">/${s.settled || 0}</span></div><div class="k">的中</div></div>
        <div><div class="v num">${U.num(s.ret)}</div><div class="k">回収／投資 ${U.num(s.stake)}</div></div>
        <div><div class="v num">${rr == null ? '—' : U.pct(rr, 1)}</div><div class="k">回収率</div></div>
      </div>
      <div class="chips" id="vchips">
        <span class="chip ${venue === 'all' ? 'on' : ''}" data-v="all">時刻順</span>
        ${venues.map(v => `<span class="chip ${venue === String(v.jo) ? 'on' : ''}" data-v="${U.esc(v.jo)}">${U.esc(v.venue)}${v.grade ? ' ' + U.esc(v.grade) : ''}</span>`).join('')}
      </div>
      <div class="chips" id="kchips">
        ${[['all', '全部'], ['buy', '買い'], ['skip', '見送り'], ['open', '結果待ち']].map(([k, l]) => `<span class="chip ${kind === k ? 'on' : ''}" data-k="${k}">${l}</span>`).join('')}
      </div>
      ${j.note ? `<div class="card muted">${U.esc(j.note)}</div>` : ''}
      <ul class="rlist">${races.map(x => Home.item(x, d)).join('') || '<li class="muted" style="padding:16px 4px">該当するレースはありません</li>'}</ul>
      <div class="note">金額は全部仮想（1レース約3,000円・確定オッズで精算）。本番の損益はGASの台帳が正。</div>`;
    view.querySelectorAll('#vchips .chip').forEach(c => c.onclick = () => { U.set('kai_venue', c.dataset.v); Home.draw(view, r); });
    view.querySelectorAll('#kchips .chip').forEach(c => c.onclick = () => { U.set('kai_kind', c.dataset.k); Home.draw(view, r); });
  },
  item(x, d) {
    const p = x.pred, cd = U.countdown(d, x.den);
    const soon = cd && /^あと\d+分$/.test(cd) && +cd.replace(/\D/g, '') <= 15;
    let badge;
    if (!p) badge = `<span class="badge st">予想なし</span>`;
    else if (p.buy) badge = `<span class="badge buy">買い ${p.n}点</span> <span class="badge grade">${U.esc(p.grade || '')}</span>`;
    else badge = `<span class="badge skip">見送り</span>`;
    let right = '';
    if (x.res) {
      right = `<div>${U.comboHtml(x.res.k, true)}</div><div class="small muted num">${U.yen(x.res.pay)}</div>`;
      if (x.hit === true) right += `<div><span class="badge hit">的中 ${U.yen(x.ret)}</span></div>`;
      else if (p && p.buy) right += `<div><span class="badge miss">外れ</span></div>`;
    } else {
      right = `<span class="badge st">${U.stLabel[x.st] || ''}</span>`;
    }
    const why = p && !p.buy && p.why ? `・${U.esc(String(p.why).slice(0, 18))}` : '';
    return `<li><a class="ritem ${p && p.buy ? '' : 'skip'}" href="#/race/${d}/${x.jo}/${x.no}">
      <div class="t"><div class="hm num">${U.esc(x.den || x.start || '')}</div><div class="cd ${soon ? 'soon' : ''}">${cd || (x.st === 'result' ? '' : U.stLabel[x.st] || '')}</div></div>
      <div class="mid"><div class="ttl">${U.esc(x.venue)} ${x.no}R ${x.isGirls ? '<span class="badge girls">G</span>' : ''}</div>
        <div class="sub">${U.esc(x.cls)}・${x.cars}車${why}</div><div style="margin-top:3px">${badge}</div></div>
      <div class="right">${right}</div></a></li>`;
  }
};
