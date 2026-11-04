// 《她还在线》引擎：播放 story.js 里的节点、评价与相似度、存档、结局
(() => {
  const S = window.STORY;
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- 存档 ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('so_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('so_' + k, JSON.stringify(v)); } catch (e) {} },
  };
  const fresh = () => ({ night: 1, sim: S.base[0], likes: 0, unlikes: 0, hesitated: false, flags: {}, lines: [] });
  const state = Object.assign(fresh(), store.get('state', {}));
  if (!Array.isArray(state.lines)) state.lines = [];
  const endings = store.get('endings', []);
  const save = () => store.set('state', { night: state.night, sim: state.sim, likes: state.likes, unlikes: state.unlikes, hesitated: state.hesitated, flags: state.flags, lines: state.lines });
  // 把每晚说过的话记下来（只记文本），下一晚开始时淡淡地显示在上面
  let recording = false;
  const record = (k, t) => { if (recording) state.lines.push({ n: state.night, k, t }); };

  // ---------- 中断：重开或跳转时，让进行中的对话安静地停下 ----------
  let epoch = 0;
  const ABORT = Symbol('abort');
  const check = (ep) => { if (ep !== epoch) throw ABORT; };

  // 调试：SO.fast 关掉打字动画；SO.auto = { rate:'like'|'unlike', choice: 0 | fn } 自动走流程；SO.jump(n) 跳到第 n 晚
  const SO = { state, endings, fast: false, auto: null, jump(n) { startNight(n); } };
  window.SO = SO;

  const val = (x) => (typeof x === 'function' ? x(state) : x);
  // fast 模式不用定时器（后台标签页里定时器会被节流到每秒一次），只让出一个微任务
  async function wait(ms) { const ep = epoch; if (SO.fast) await Promise.resolve(); else await sleep(ms); check(ep); }
  const soon = (fn) => { if (SO.fast) Promise.resolve().then(fn); else setTimeout(fn, 30); };
  SO.transcript = []; // 调试：本局所有消息按顺序记在这里

  // ---------- 渲染 ----------
  const avatarHTML = () => `<div class="avatar">${$('avatar-svg').innerHTML}</div>`;
  const msgs = () => $('msgs');
  function scrollBottom() { const m = msgs(); m.scrollTop = m.scrollHeight; }
  function clearMsgs() { msgs().innerHTML = ''; }

  function addEcho(text, opts = {}) {
    const el = document.createElement('div');
    el.className = 'm echo' + (opts.real ? ' real' : '');
    el.innerHTML = `${avatarHTML()}<div class="col"><div class="bubble"></div></div>`;
    el.querySelector('.bubble').textContent = text;
    msgs().appendChild(el); scrollBottom();
    SO.transcript.push('回声：' + text);
    record('echo', text);
    return el;
  }
  function addYou(text) {
    const el = document.createElement('div');
    el.className = 'm you';
    el.innerHTML = '<div class="bubble"></div>';
    el.querySelector('.bubble').textContent = text;
    msgs().appendChild(el); scrollBottom();
    SO.transcript.push('你：' + text);
    record('you', text);
    return el;
  }
  function addSys(text, cls) {
    const el = document.createElement('div');
    el.className = 'sys' + (cls ? ' ' + cls : '');
    el.textContent = text;
    msgs().appendChild(el); scrollBottom();
    SO.transcript.push('系统：' + text);
    record('sys', text);
    return el;
  }
  function attachLog(el, text) {
    const d = document.createElement('details');
    d.className = 'log';
    d.innerHTML = `<summary>训练日志</summary><div class="log-body">${esc(text)}</div>`;
    el.querySelector('.col').appendChild(d);
    scrollBottom();
  }

  let typingEl = null;
  function setStatus(text, typing) {
    const s = $('status'); s.textContent = text; s.classList.toggle('typing', !!typing);
  }
  async function showTyping(ms) {
    if (SO.fast) return;
    const ep = epoch;
    setStatus('对方正在输入…', true);
    typingEl = document.createElement('div');
    typingEl.className = 'm echo';
    typingEl.innerHTML = `${avatarHTML()}<div class="bubble typing-bubble"><span></span><span></span><span></span></div>`;
    msgs().appendChild(typingEl); scrollBottom();
    try { await sleep(ms); check(ep); }
    finally { if (typingEl) typingEl.remove(); typingEl = null; if (ep === epoch) setStatus(state.offline ? '离线' : '在线'); }
  }
  const typingMs = (t) => Math.max(700, Math.min(2600, 500 + t.length * 45));

  // ---------- 相似度 ----------
  function setSim(v) {
    state.sim = Math.max(0, Math.min(100, Math.round(v)));
    const el = $('sim');
    el.textContent = state.sim + '%';
    // 越像，数字越暖
    const t = state.sim / 100;
    el.style.color = `rgb(${Math.round(139 + (228 - 139) * t)}, ${Math.round(144 + (160 - 144) * t)}, ${Math.round(160 + (168 - 160) * t)})`;
    $('badge').classList.toggle('hidden', state.sim >= 100);
  }
  function applyRating(kind) {
    const cap = S.cap[state.night - 1];
    if (kind === 'like') { state.likes++; setSim(Math.min(cap, state.sim + 2)); }
    else { state.unlikes++; setSim(Math.min(cap, state.sim + 1)); }
    save();
  }

  // 评价：在气泡下面放两个按钮，等玩家点
  function askRate(el) {
    return new Promise((resolve) => {
      const ep = epoch;
      const row = document.createElement('div');
      row.className = 'rate';
      row.innerHTML = '<button type="button" data-k="like">像她</button><button type="button" data-k="unlike">不像她</button>';
      el.querySelector('.col').appendChild(row);
      scrollBottom();
      panelHint('这条像她吗？在消息下面评价。');
      const t0 = Date.now();
      const pick = (k) => {
        if (ep !== epoch) return;
        if (k === 'unlike' && Date.now() - t0 > 4000) state.hesitated = true;
        row.classList.add('done');
        row.querySelector(`[data-k="${k}"]`).classList.add('on');
        const before = state.sim;
        applyRating(k);
        const fb = document.createElement('span');
        fb.className = 'fb';
        fb.textContent = state.sim > before ? `已反馈 · 相似度 +${state.sim - before}%` : '已反馈';
        row.appendChild(fb);
        panelClear();
        resolve(k);
      };
      row.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => pick(b.dataset.k)));
      if (SO.auto && SO.auto.rate) soon(() => pick(SO.auto.rate === 'alt' ? (state.likes > state.unlikes ? 'unlike' : 'like') : SO.auto.rate));
    });
  }

  // ---------- 底部面板：选项 / 提示 ----------
  function panelClear() { $('panel').innerHTML = ''; }
  function panelHint(text) { $('panel').innerHTML = `<div class="hint">${esc(text)}</div>`; }
  function askChoices(list) {
    return new Promise((resolve) => {
      const ep = epoch;
      const p = $('panel'); p.innerHTML = '';
      list.forEach((c, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'choice' + (c.cls ? ' ' + c.cls : '');
        b.textContent = val(c.text);
        b.addEventListener('click', () => { if (ep !== epoch) return; panelClear(); resolve(c); });
        p.appendChild(b);
      });
      scrollBottom();
      if (SO.auto) {
        const idx = typeof SO.auto.choice === 'function' ? SO.auto.choice(list, state) : (SO.auto.choice || 0);
        soon(() => { if (ep === epoch) { panelClear(); resolve(list[Math.min(idx, list.length - 1)]); } });
      }
    });
  }

  // ---------- 遮罩 ----------
  function overlay(kicker, title, html, btn, onClick) {
    $('ov-kicker').textContent = kicker || '';
    $('ov-title').textContent = title;
    $('ov-text').innerHTML = html;
    const b = $('ov-btn'); b.textContent = btn;
    b.onclick = () => { $('overlay').classList.add('hidden'); onClick(); };
    $('overlay').classList.remove('hidden');
    SO.transcript.push('遮罩：' + (kicker ? kicker + ' · ' : '') + title);
    if (SO.auto) soon(() => b.click());
  }

  // ---------- 一晚 ----------
  function setOffline(on) {
    state.offline = on;
    $('screen-chat').classList.toggle('offline', on);
    setStatus(on ? '离线' : '在线');
  }

  async function startNight(n) {
    epoch++;
    const ep = epoch;
    state.night = n;
    setSim(S.base[n - 1]);
    save(); store.set('night', n);
    $('screen-title').classList.add('hidden');
    $('screen-chat').classList.remove('hidden');
    $('overlay').classList.add('hidden');
    setOffline(false);
    clearMsgs(); panelClear();
    // 今晚重头开始，所以今晚之前记下的半截对话作废；更早几晚的对话淡淡地留在上面
    recording = false;
    state.lines = state.lines.filter((l) => l.n < n);
    for (const l of state.lines) {
      const el = l.k === 'echo' ? addEcho(l.t) : l.k === 'you' ? addYou(l.t) : addSys(l.t);
      el.classList.add('past');
    }
    addSys(`${S.dates[n - 1]} ${S.times[n - 1]}`);
    recording = true;

    const nodes = S.nights[n - 1];
    const labels = {};
    nodes.forEach((nd, i) => { if (nd.label) labels[nd.label] = i; });
    let i = 0;
    try {
      while (i < nodes.length) {
        check(ep);
        const nd = nodes[i];
        let jump = null;
        if (nd.set) nd.set(state);
        if (nd.wait) await wait(nd.wait);
        if (nd.clear) clearMsgs();
        if (nd.offline) setOffline(true);
        if (nd.who === 'sys') { await wait(350); addSys(val(nd.text), nd.cls); }
        else if (nd.who === 'you') { await wait(500); addYou(val(nd.text)); }
        else if (nd.who === 'echo') {
          const texts = [].concat(val(nd.text));
          let el = null;
          for (const t of texts) {
            if (!nd.instant) await showTyping(typingMs(t));
            check(ep);
            el = addEcho(t, { real: nd.instant });
            await wait(300);
          }
          if (nd.log) attachLog(el, val(nd.log));
          if (nd.rate) await askRate(el);
        }
        else if (nd.choices) {
          await wait(400);
          const c = await askChoices(nd.choices.filter((x) => !x.if || x.if(state)));
          check(ep);
          if (!c.silent) addYou(val(c.text));
          if (c.set) c.set(state);
          save();
          jump = c.next || null;
        }
        else if (nd.nightEnd) return endNight(n);
        else if (nd.end) return ending(nd.end);

        if (!jump && nd.next) jump = val(nd.next);
        if (jump) {
          if (labels[jump] === undefined) throw new Error('未知标签：' + jump);
          i = labels[jump];
        } else i++;
      }
    } catch (e) { if (e !== ABORT) console.error(e); }
  }

  function endNight(n) {
    save(); store.set('night', n + 1);
    overlay(`第 ${n} 晚`, '今晚到这里', `<p class="center">相似度 ${state.sim}%</p>`, '明晚继续', () => startNight(n + 1));
  }

  function ending(key) {
    const e = S.endings[key];
    if (!endings.includes(key)) { endings.push(key); store.set('endings', endings); }
    // 一局结束：进度归零，结局保留
    Object.assign(state, fresh());
    save(); store.set('night', 1);
    overlay('结局', e.title, e.paras.map((p) => `<p>${esc(p)}</p>`).join(''), '回到标题', showTitle);
  }

  // ---------- 标题页 ----------
  function showTitle() {
    epoch++;
    $('screen-chat').classList.add('hidden');
    $('overlay').classList.add('hidden');
    $('screen-title').classList.remove('hidden');
    const n = store.get('night', 1);
    const btn = $('btn-start');
    btn.textContent = n > 1 && n <= 4 ? `继续 · 第 ${n} 晚` : '开通回声';
    $('title-sub').textContent = endings.length ? `已看到 ${endings.length} / 3 个结局` : '';
  }
  $('btn-start').addEventListener('click', () => {
    const n = store.get('night', 1);
    if (n <= 1 || n > 4) Object.assign(state, fresh());
    startNight(n > 4 ? 1 : n);
  });

  $('avatar').innerHTML = $('avatar-svg').innerHTML;
  showTitle();
})();
