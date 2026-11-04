// 《骑手已到达》引擎：时间线、配送阶段、骑手聊天、客服、投诉、结局、存档
(() => {
  const D = window.DATA;
  const { $, esc, show, screen, notify, toast, ding, bell, knock, hhmm } = window.APP;

  // ---------- 存档 ----------
  const KEY = 'dl_save';
  const fresh = () => ({
    started: false, elapsed: 0, stageIdx: -1, fired: [],
    chat: [], queue: [], pending: null, unread: 0,
    items: 'normal', remarkLate: false, rider: 0,
    cs: { log: [], round: 0, done: false, doorAsked: false, doorMode: false, options: null, foot: null },
    complaint: null, replaced: false, endAt: null,
    knocking: false, nextKnock: 0, ending: null,
  });
  let state = fresh();
  try { const v = localStorage.getItem(KEY); if (v) state = Object.assign(fresh(), JSON.parse(v)); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

  // 调试：DL.fast 把所有等待缩到十分之一；DL.jump('门口') / DL.jump('door') / DL.jump(300)；DL.end('A')；DL.reset()
  const DL = {
    state,
    get fast() { try { return localStorage.getItem('dl_fast') === '1'; } catch (e) { return false; } },
    set fast(v) { try { localStorage.setItem('dl_fast', v ? '1' : '0'); } catch (e) {} },
    jump, end: (k) => endGame(k), reset, fire: (id) => { const ev = D.EVENTS.find((e) => e.id === id); if (ev) fireEvent(ev); },
  };
  window.DL = DL;
  const scale = () => (DL.fast ? 0.1 : 1);
  const after = (ms, fn) => setTimeout(fn, ms * scale());

  const rider = () => D.RIDERS[state.rider];
  const stage = () => D.STAGES[Math.max(0, state.stageIdx)];
  const arrived = () => !!stage().arrived;
  const atDoor = () => !!stage().door;

  // ---------- 时钟 ----------
  function clockMin() { return D.CLOCK.startMin + Math.floor(state.elapsed / D.CLOCK.secPerMin); }
  function renderClock() { const t = hhmm(clockMin()); $('sb-time').textContent = t; $('lock-time').textContent = t; }

  // ---------- 订单页 ----------
  function renderItems() {
    const list = D.ITEMS[state.items];
    const ul = $('items'); ul.innerHTML = '';
    let total = 0;
    list.forEach((it) => {
      const li = document.createElement('li');
      li.className = it.odd ? 'odd' : it.none ? 'none' : '';
      li.innerHTML = `<span class="n">${esc(it.n)}</span><span class="q">×${it.q}</span><span class="p">¥${it.p.toFixed(2)}</span>`;
      ul.appendChild(li); total += it.p;
    });
    $('total').textContent = '¥' + total.toFixed(2);
  }
  function renderRemark() {
    const el = $('remark');
    el.textContent = state.remarkLate ? D.ORDER.remarkLate : D.ORDER.remark;
    el.classList.toggle('odd', state.remarkLate);
  }
  function renderRider() {
    const r = rider();
    $('rider-av').textContent = r.glyph; $('prof-av').textContent = r.glyph;
    $('rider-name').innerHTML = `${esc(r.name)} <span class="tag" id="rider-rating">${esc(r.rating)}</span>`;
    $('rider-sub').textContent = `棠安到家骑手 · 已完成 ${r.done} 单`;
    $('prof-name').textContent = r.name; $('prof-id').textContent = r.id;
    $('prof-rating').textContent = r.rating; $('prof-done').textContent = r.done;
    $('prof-joined').textContent = r.joined; $('prof-note').textContent = r.note;
    $('chat-title').innerHTML = `${esc(r.name)} <span class="muted small">骑手</span>`;
  }
  function posOnPath(p) {
    const P = D.PATH;
    const segs = []; let total = 0;
    for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); segs.push(l); total += l; }
    let d = Math.max(0, Math.min(1, p)) * total;
    for (let i = 0; i < segs.length; i++) {
      if (d <= segs[i] || i === segs.length - 1) {
        const t = segs[i] ? Math.min(1, d / segs[i]) : 1;
        return [P[i][0] + (P[i + 1][0] - P[i][0]) * t, P[i][1] + (P[i + 1][1] - P[i][1]) * t];
      }
      d -= segs[i];
    }
    return P[P.length - 1];
  }
  function renderStage() {
    const s = stage();
    const [x, y] = posOnPath(s.p);
    const pin = $('pin-rider');
    pin.style.left = x + '%'; pin.style.top = y + '%';
    pin.classList.toggle('pulse', !!s.arrived);
    $('status-main').textContent = s.door ? '骑手在门口' : s.arrived ? '骑手已到达' : '配送中';
    $('dist-label').textContent = s.arrived ? (s.floor ? `骑手已到达 · ${s.floor}` : '骑手已到达') : `骑手距您 ${s.label}`;
    $('eta-label').textContent = s.arrived ? '等待取货' : `预计 ${D.ORDER.eta} 送达`;
    $('map-label').textContent = s.arrived ? '和平路 · 当前位置 · 骑手已到达' : '和平路 · 当前位置';
    $('prof-cur').textContent = s.arrived ? `已到达 · ${s.floor || '楼下'}` : `配送中 · 距您 ${s.label}`;
    $('door-bar').classList.toggle('hidden', !s.door);
    $('door-sub').textContent = state.knocking ? '正在敲门' : '等待取货';
    $('chat-status').textContent = s.arrived ? (s.floor || '已到达') : s.label;
  }
  function updateStage() {
    let idx = 0;
    D.STAGES.forEach((s, i) => { if (state.elapsed >= s.at) idx = i; });
    if (idx !== state.stageIdx) { state.stageIdx = idx; renderStage(); }
  }
  function renderBadge() { $('chat-badge').classList.toggle('hidden', state.unread <= 0); }

  // ---------- 骑手聊天 ----------
  function msgEl(m) {
    const el = document.createElement('div');
    if (m.from === 'sys') { el.className = 'sys'; el.textContent = m.text; return el; }
    el.className = 'm ' + (m.from === 'me' ? 'me' : 'them');
    el.innerHTML = m.from === 'me' ? '<div class="bub"></div>' : `<div class="av">${esc(rider().glyph)}</div><div class="bub"></div>`;
    el.querySelector('.bub').textContent = m.text;
    return el;
  }
  let typingEl = null;
  function renderChat() {
    const box = $('chat-msgs'); box.innerHTML = '';
    state.chat.forEach((m) => box.appendChild(msgEl(m)));
    typingEl = null; setTyping(state.queue.length > 0);
    box.scrollTop = box.scrollHeight;
    renderPanel();
  }
  function appendChat(m) {
    state.chat.push(m);
    if (screen() === 'chat') {
      const box = $('chat-msgs');
      if (typingEl) { typingEl.remove(); typingEl = null; }
      box.appendChild(msgEl(m)); box.scrollTop = box.scrollHeight;
      setTyping(state.queue.length > 0);
    }
  }
  function setTyping(on) {
    if (screen() !== 'chat') return;
    const box = $('chat-msgs');
    if (on && !typingEl) {
      typingEl = document.createElement('div');
      typingEl.className = 'm them';
      typingEl.innerHTML = `<div class="av">${esc(rider().glyph)}</div><div class="bub typing"><span></span><span></span><span></span></div>`;
      box.appendChild(typingEl); box.scrollTop = box.scrollHeight;
    } else if (!on && typingEl) { typingEl.remove(); typingEl = null; }
  }
  function renderPanel() {
    const p = $('chat-panel'); p.innerHTML = '';
    if (state.ending) return;
    if (!state.pending) { p.innerHTML = `<div class="hint">${state.queue.length ? '对方正在输入…' : '等待骑手消息'}</div>`; return; }
    const ev = D.EVENTS.find((e) => e.id === state.pending.id);
    state.pending.options.forEach((text, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'choice' + (ev && ev.choices.open === i ? ' warm' : '');
      b.textContent = text;
      b.addEventListener('click', () => choose(i));
      p.appendChild(b);
    });
  }
  // 把骑手的话排进队列，按时间送达；instant 时直接进聊天记录（调试跳转用）
  function enqueue(texts, { id = null, choices = null, instant = false, delay = 1.6 } = {}) {
    if (instant) {
      texts.forEach((t) => state.chat.push({ from: 'them', text: t }));
      if (choices) state.pending = { id, options: choices.options };
      return;
    }
    texts.forEach((t, i) => state.queue.push({ text: t, at: state.elapsed + delay + i * 1.4, choicesId: choices && i === texts.length - 1 ? id : null }));
    setTyping(true);
  }
  function deliverQueue() {
    while (state.queue.length && state.queue[0].at <= state.elapsed) {
      const item = state.queue.shift();
      appendChat({ from: 'them', text: item.text });
      ding();
      if (screen() !== 'chat') { state.unread++; renderBadge(); notify(`${rider().name}：${item.text}`, openChat); }
      if (item.choicesId) {
        const ev = D.EVENTS.find((e) => e.id === item.choicesId);
        if (ev) { state.pending = { id: ev.id, options: ev.choices.options }; if (screen() === 'chat') renderPanel(); }
      }
      save();
    }
  }
  function choose(i) {
    const pend = state.pending; if (!pend) return;
    const ev = D.EVENTS.find((e) => e.id === pend.id);
    const text = pend.options[i];
    state.pending = null;
    if (!text.startsWith('（')) appendChat({ from: 'me', text });
    if (ev && ev.choices.open === i) { save(); return endGame('A'); }
    const replies = ev && ev.choices.replies[i];
    if (replies) enqueue(replies, { delay: 1.5 });
    renderPanel(); save();
  }
  function openChat() {
    state.unread = 0; renderBadge();
    show('chat'); renderChat();
  }

  // ---------- 时间线 ----------
  function fireEvent(ev, instant = false) {
    if (state.fired.includes(ev.id)) return;
    state.fired.push(ev.id);
    if (ev.items) { state.items = ev.items; renderItems(); }
    if (ev.remark) { state.remarkLate = true; renderRemark(); }
    if (ev.bell && !instant) { bell(); if (screen() !== 'chat') notify('门铃响了', openChat, 3000); }
    if (ev.knock) { state.knocking = true; state.nextKnock = state.elapsed + 3; renderStage(); }
    if (ev.msgs) enqueue(ev.msgs, { id: ev.id, choices: ev.choices || null, instant });
    if (ev.end && !instant) return endGame(ev.end);
    save();
  }
  function knockTick() {
    if (!state.knocking || state.elapsed < state.nextKnock) return;
    state.nextKnock = state.elapsed + D.KNOCK_EVERY;
    knock();
    $('phone').classList.remove('flash'); // 不闪，只响
    if (screen() === 'order') toast('有人在敲门', 1600);
  }
  let saveTick = 0;
  function tick() {
    if (!state.started || state.ending) return;
    state.elapsed += 0.25 / scale();
    if (state.endAt != null && state.elapsed >= state.endAt) return endGame('D');
    if (!state.replaced) D.EVENTS.forEach((ev) => { if (!state.fired.includes(ev.id) && state.elapsed >= ev.at && !state.ending) fireEvent(ev); });
    if (state.ending) return;
    deliverQueue();
    updateStage();
    knockTick();
    renderClock();
    if (++saveTick % 4 === 0) save();
  }
  setInterval(tick, 250);

  function jump(x) {
    let target = typeof x === 'number' ? x : null;
    if (target == null) {
      const ev = D.EVENTS.find((e) => e.id === x); if (ev) target = ev.at;
      const st = D.STAGES.find((s) => s.label === x); if (st) target = st.at;
    }
    if (target == null) return 'unknown';
    if (!state.started) startGame();
    state.queue = []; state.pending = null;
    D.EVENTS.forEach((ev) => { if (!state.fired.includes(ev.id) && ev.at <= target && !ev.end) fireEvent(ev, true); });
    state.elapsed = target;
    updateStage(); renderStage(); renderClock(); if (screen() === 'chat') renderChat();
    save();
    return stage().label;
  }

  // ---------- 客服 ----------
  function csPush(from, text) { state.cs.log.push({ from, text }); }
  function csEl(m) {
    const el = document.createElement('div');
    el.className = 'm ' + (m.from === 'me' ? 'me' : 'bot them');
    el.innerHTML = m.from === 'me' ? '<div class="bub"></div>' : `<div class="av">${D.LEAF}</div><div class="bub"></div>`;
    el.querySelector('.bub').textContent = m.text;
    return el;
  }
  function renderCS(animateFrom = null) {
    const box = $('cs-msgs'); box.innerHTML = '';
    const log = state.cs.log;
    const n = animateFrom == null ? log.length : animateFrom;
    log.slice(0, n).forEach((m) => box.appendChild(csEl(m)));
    box.scrollTop = box.scrollHeight;
    renderCSPanel(animateFrom == null);
    if (animateFrom != null) {
      // 新来的几句一条条冒出来
      let i = n;
      const step = () => {
        if (i >= log.length) { renderCSPanel(true); return; }
        box.appendChild(csEl(log[i++])); box.scrollTop = box.scrollHeight;
        after(900, step);
      };
      after(500, step);
    }
  }
  function renderCSPanel(enabled) {
    const p = $('cs-panel'); p.innerHTML = '';
    if (state.ending) return;
    if (!enabled) { p.innerHTML = '<div class="hint">小棠正在输入…</div>'; return; }
    if (!state.cs.options) { p.innerHTML = `<div class="hint">${esc(state.cs.foot || '')}</div>`; return; }
    state.cs.options.forEach((text, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'choice' + (state.cs.doorMode && text === '好' ? ' danger' : '');
      b.textContent = text;
      b.addEventListener('click', () => csChoose(i));
      p.appendChild(b);
    });
  }
  function csContext() { return { arrived: arrived(), rider: rider() }; }
  function openCS() {
    const cs = state.cs;
    let from = null;
    if (!cs.log.length) {
      from = 0;
      D.ASSIST.hello.forEach((t) => csPush('bot', t));
      cs.options = D.ASSIST.rounds[0].options;
    } else if (cs.done && !cs.doorAsked && atDoor()) {
      from = cs.log.length; askDoor();
    }
    show('cs'); renderCS(from); save();
  }
  function askDoor() {
    const cs = state.cs;
    D.ASSIST.door.ask.forEach((t) => csPush('bot', t));
    cs.options = D.ASSIST.door.options; cs.doorMode = true; cs.doorAsked = true; cs.foot = null;
  }
  function csChoose(i) {
    const cs = state.cs; if (!cs.options) return;
    const text = cs.options[i];
    const from = cs.log.length;
    csPush('me', text);
    if (cs.doorMode) {
      if (text === '好') { save(); renderCS(); return after(600, () => endGame('C')); }
      if (text === '不要' || text === '先不了') { D.ASSIST.door.no.forEach((t) => csPush('bot', t)); cs.options = ['好', '先不了']; }
      else { D.ASSIST.door.how.forEach((t) => csPush('bot', t)); cs.options = ['好', '不要']; }
      if (text === '先不了') { cs.log.pop(); cs.log.pop(); csPush('bot', '好的。我在。'); cs.options = null; cs.foot = '小棠在线 · 随时可以叫她开门'; }
    } else {
      const round = D.ASSIST.rounds[cs.round];
      round.replies[i](csContext()).forEach((t) => csPush('bot', t));
      cs.round++;
      if (cs.round < D.ASSIST.rounds.length) cs.options = D.ASSIST.rounds[cs.round].options;
      else {
        cs.done = true;
        if (atDoor()) askDoor();
        else { D.ASSIST.notYet.forEach((t) => csPush('bot', t)); cs.options = null; cs.foot = D.ASSIST.notYetFoot; }
      }
    }
    save(); renderCS(from + 1);
  }

  // ---------- 投诉 / 换骑手 ----------
  function renderComplaint() {
    const box = $('complaint-opts'); box.innerHTML = '';
    if (state.replaced) { box.innerHTML = '<div class="done">已为您更换骑手。本单不可再次投诉。</div>'; return; }
    if (state.complaint) { box.innerHTML = `<div class="done">${esc(D.COMPLAINT.submitted)}</div>`; return; }
    D.COMPLAINT.options.forEach((text) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = text;
      b.addEventListener('click', () => complain(text));
      box.appendChild(b);
    });
  }
  function complain(reason) {
    if (state.complaint || state.ending) return;
    state.complaint = { reason, at: state.elapsed }; save();
    renderComplaint();
    toast(D.COMPLAINT.submitted);
    after(3200, replaceRider);
  }
  function replaceRider() {
    if (state.ending) return;
    Object.assign(state, {
      rider: 1, replaced: true, elapsed: 0, stageIdx: -1, fired: [], queue: [], pending: null, unread: 0,
      items: 'normal', remarkLate: false, knocking: false, endAt: D.COMPLAINT.endAfter,
    });
    state.chat.push({ from: 'sys', text: '已为您更换骑手' });
    renderRider(); renderItems(); renderRemark(); renderComplaint(); renderBadge(); updateStage(); renderStage(); renderClock();
    if (screen() === 'chat') renderChat();
    toast(D.COMPLAINT.done, 3000);
    notify('已为您更换骑手 · 骑手距您 2.3 km', () => show('order'));
    save();
  }

  // ---------- 结局 ----------
  function endGame(key) {
    if (state.ending) return;
    state.ending = key; state.queue = []; state.pending = null; state.knocking = false; save();
    $('notif').classList.add('hidden'); $('toast').classList.add('hidden');
    show('ending'); renderEnding(true);
  }
  function renderEnding(animate) {
    const e = D.ENDINGS[state.ending];
    const box = $('ending-lines'); box.innerHTML = '';
    $('ending-title').textContent = '';
    $('btn-restart').classList.add('hidden');
    const lines = e.lines;
    const put = (t) => {
      const p = document.createElement('p');
      if (t.startsWith('sys:')) { p.className = 'sys'; p.textContent = t.slice(4); } else p.textContent = t;
      box.appendChild(p);
    };
    const finish = () => { $('ending-title').textContent = e.title; $('btn-restart').classList.remove('hidden'); };
    if (!animate) { lines.forEach(put); finish(); return; }
    let i = 0;
    const step = () => { if (i >= lines.length) return finish(); put(lines[i++]); after(1300, step); };
    after(700, step);
  }
  function reset() { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); }

  // ---------- 启动 ----------
  function renderAll() {
    renderClock(); renderItems(); renderRemark(); renderRider(); updateStage(); renderStage(); renderBadge(); renderComplaint();
  }
  function startGame() {
    if (state.started) return;
    state.started = true; state.elapsed = 0; save();
    renderAll(); show('order');
  }

  $('push-card').addEventListener('click', startGame);
  $('btn-chat').addEventListener('click', openChat);
  $('btn-chat2').addEventListener('click', openChat);
  $('btn-cs').addEventListener('click', openCS);
  $('btn-cancel').addEventListener('click', () => toast(D.CANCEL_TOAST));
  $('rider-row').addEventListener('click', (e) => { if (!e.target.closest('#btn-chat')) show('rider'); });
  $('chat-title').addEventListener('click', () => show('rider'));
  $('back-chat').addEventListener('click', () => show('order'));
  $('back-rider').addEventListener('click', () => show('order'));
  $('back-cs').addEventListener('click', () => show('order'));
  $('btn-open-door').addEventListener('click', () => endGame('A'));
  $('btn-restart').addEventListener('click', reset);
  window.APP.onShow((name) => { if (name === 'chat') { state.unread = 0; renderBadge(); } });

  renderAll();
  if (state.ending) { show('ending'); renderEnding(false); }
  else if (state.started) { show('order'); if (state.queue.length && screen() !== 'chat') setTyping(false); }
  else show('push');
})();
