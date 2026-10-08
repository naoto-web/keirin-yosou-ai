// setup.js — 初回の合言葉入力（端末に保存。コードには書かない）
'use strict';
const Setup = {
  render(view, msg) {
    view.innerHTML = `
      <div class="card">
        <h2>はじめに</h2>
        <p class="small muted">クロコから受け取った合言葉を入力してください。この端末にだけ保存されます。</p>
        <input id="key" class="input" type="password" autocomplete="off" placeholder="合言葉">
        <div class="row" style="margin-top:10px"><span class="small err" id="msg">${U.esc(msg || '')}</span><span class="spacer"></span>
          <button class="btn primary" id="save">保存して開く</button></div>
      </div>`;
    view.querySelector('#save').onclick = async () => {
      const k = view.querySelector('#key').value.trim();
      if (!k) return;
      U.set('kai_key', k);
      const m = view.querySelector('#msg'); m.textContent = '確認中…';
      try { await API.ping(); location.hash = '#/'; App.route(); }
      catch (e) { U.set('kai_key', ''); m.textContent = e.message; }
    };
  }
};
