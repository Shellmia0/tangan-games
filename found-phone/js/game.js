// 《捡到的手机》流程：存档、锁屏与密码、主屏、各 app、事件触发、助手、结局
(() => {
  const D = window.DATA, P = window.PHONE;
  const { $, esc, sleep } = P;

  // ---------- 存档 ----------
  const KEY = 'fp_save';
  const fresh = () => ({
    openAt: Date.now(),      // 第一次打开，时钟从这里开始走
    unlocked: false, unlockAt: 0,
    pinFails: 0,
    fired: [],               // 已触发的事件
    read: {},                // 每个对话已读的对方消息数
    pending: {},             // 对话 id -> 等待玩家选择的事件 id
    choices: {},             // 事件 id -> 选项序号
    extra: {},               // 事件加进来的消息
    typing: {},              // 对话 id -> 正在输入
    queue: [],               // 还没送完的消息（关掉页面再打开会接着送）
    assistQueue: null,       // 小棠还没说完的话
    photos: [],              // 事件加进来的照片 key
    photosNew: 0, callsSeen: false,
    assistLog: [], assistRound: 0, assistWait: false,
    stage: 0,                // 1 = 小棠已说"你不是她"，结局解锁
    offTried: false, callTried: false, busWarned: false,
    ending: null,
  });
  let S = load();
  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY)); if (v && typeof v === 'object') return Object.assign(fresh(), v, { typing: {} }); } catch (e) {}
    return fresh();
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }

  // ---------- 时钟 ----------
  function nowMin() { return D.CLOCK.start + Math.floor((Date.now() - S.openAt) / D.CLOCK.msPerMin); }
  function timeStr() { return P.minToStr(Math.min(nowMin(), D.CLOCK.lastBus)); }
  function busLeft() { return Math.max(0, D.CLOCK.lastBus - nowMin()); }
  function tickClock() {
    const t = timeStr();
    $('sb-time').textContent = t; $('lock-time').textContent = t;
    if (S.ending) return;
    const left = busLeft();
    if (left <= 3 && !S.busWarned) {
      S.busWarned = true; save();
      P.notify({ app: '棠安助手', icon: 'assist', title: '小棠', text: D.ASSIST.busWarn, sound: 'low', onOpen: () => openApp('assistant') });
    }
    if (left <= 0) endGame('D');
  }
  setInterval(tickClock, 1000);

  // ---------- 消息模型 ----------
  function chatMsgs(id) { return (D.CHATS[id] || []).concat(S.extra[id] || []); }
  const incoming = (m) => m.from !== 'me' && m.from !== 'sys';
  function countIn(id) { return chatMsgs(id).filter(incoming).length; }
  function unread(id) {
    if (S.read[id] === undefined) return (D.UNREAD_INIT[id] || 0) + (S.extra[id] || []).filter(incoming).length;
    return Math.max(0, countIn(id) - S.read[id]);
  }
  function markRead(id) { S.read[id] = countIn(id); save(); }
  function pushMsg(id, m) {
    (S.extra[id] = S.extra[id] || []).push({ from: m.from, text: m.text, time: timeStr(), ts: Date.now() });
    save();
  }
  function lastTs(id) { const ex = S.extra[id]; return ex && ex.length ? ex[ex.length - 1].ts : 0; }

  // ---------- 视图 ----------
  let view = { name: 'lock', arg: null };
  const PARENT = { chat: 'messages', photo: 'photos', note: 'notes' };
  function setHead(title, sub = '', typing = false) {
    $('app-title').textContent = title;
    $('app-sub').textContent = sub;
    $('app-sub').classList.toggle('typing', typing);
  }
  function openApp(name, arg, first = true) {
    if (S.ending) return;
    view = { name, arg };
    $('app-foot').innerHTML = '';
    $('app-body').innerHTML = '';
    $('app-body').className = 'app-body ' + name;
    if (name === 'messages') renderMessages();
    else if (name === 'chat') renderChat(arg);
    else if (name === 'photos') renderPhotos();
    else if (name === 'photo') renderPhoto(arg);
    else if (name === 'notes') renderNotes();
    else if (name === 'note') renderNote(arg);
    else if (name === 'calls') renderCalls();
    else if (name === 'settings') renderSettings();
    else if (name === 'assistant') renderAssistant(first);
    P.show('app');
    // 底部的选项栏渲染完会把消息区挤矮一截，下一帧再滚到底
    requestAnimationFrame(() => { const b = $('app-body'); if (b.classList.contains('chat-body')) b.scrollTop = b.scrollHeight; });
  }
  function goHome() { view = { name: 'home' }; renderHome(); P.show('home'); }
  // 当前视图重画（事件送达消息时用）
  function refresh() {
    if (S.ending) return;
    if (view.name === 'home') renderHome();
    else if (view.name !== 'lock') openApp(view.name, view.arg, false);
  }

  // ---------- 锁屏与密码 ----------
  function renderLock() {
    $('lock-date').textContent = D.CLOCK.dateText;
    const n = $('lock-notifs'); n.innerHTML = '';
    const list = D.LOCK.notifs.slice();
    if (S.pinFails >= 3) list.unshift(D.LOCK.failNotif);
    list.forEach((x) => {
      const el = document.createElement('div');
      el.className = 'lnotif';
      el.innerHTML = `<div class="n-icon ${esc(x.icon)}"></div><div class="n-body"><div class="n-top"><span class="n-app">${esc(x.app)}</span><span class="n-time">${esc(x.time)}</span></div><div class="n-title">${esc(x.title)}</div><div class="n-text">${esc(x.text)}</div></div>`;
      n.appendChild(el);
    });
    const w = $('lock-widgets'); w.innerHTML = '';
    D.LOCK.widgets.forEach((x) => {
      const el = document.createElement('div');
      el.className = 'widget';
      el.innerHTML = `<div class="w-app">${esc(x.app)}</div><div class="w-title">${esc(x.title)}</div><div class="w-text">${esc(x.text)}</div>`;
      w.appendChild(el);
    });
  }
  let pinBuf = '';
  function renderPin() {
    $('pin-dots').querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < pinBuf.length));
  }
  function buildNumpad() {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
    $('numpad').innerHTML = keys.map((k) => `<button type="button" class="key${k === '' ? ' blank' : ''}${k === '⌫' ? ' del' : ''}" data-k="${k}">${k}</button>`).join('');
    $('numpad').addEventListener('click', (e) => {
      const b = e.target.closest('.key');
      if (!b || !b.dataset.k) return;
      P.beep('tap');
      pressKey(b.dataset.k);
    });
  }
  function pressKey(k) {
    if (k === '⌫') pinBuf = pinBuf.slice(0, -1);
    else if (pinBuf.length < 4) pinBuf += k;
    renderPin();
    if (pinBuf.length === 4) setTimeout(checkPin, 160);
  }
  function checkPin() {
    if (pinBuf === D.PIN) { pinBuf = ''; renderPin(); $('pin-msg').textContent = ''; unlock(); return; }
    pinBuf = ''; S.pinFails++; save(); renderPin();
    const d = $('pin-dots');
    d.classList.add('shake'); setTimeout(() => d.classList.remove('shake'), 500);
    $('pin-msg').textContent = '密码错误';
    if (S.pinFails === 3) {
      renderLock();
      P.notify({ app: D.LOCK.failNotif.app, icon: 'msg', title: D.LOCK.failNotif.title, text: D.LOCK.failNotif.text, sound: 'low' });
    }
  }
  function unlock() {
    S.unlocked = true; S.unlockAt = Date.now();
    S.typing.zhou = true; // 去世的那位，一直在"正在输入"
    save();
    P.clearNotifs();
    goHome();
    scheduleEvents();
  }

  // ---------- 主屏 ----------
  function badgeFor(id) {
    if (id === 'messages') return D.CONTACTS.reduce((n, c) => n + unread(c.id), 0);
    if (id === 'calls') return S.callsSeen ? 0 : 7;
    if (id === 'photos') return S.photosNew || 0;
    return 0;
  }
  function renderHome() {
    const box = $('apps'); box.innerHTML = '';
    D.APPS.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'app-icon';
      const badge = badgeFor(a.id);
      b.innerHTML = `<div class="icon ${a.id}">${a.icon}${badge ? `<span class="badge">${badge}</span>` : ''}</div><div class="label">${esc(a.name)}</div>`;
      b.addEventListener('click', () => openApp(a.id));
      box.appendChild(b);
    });
  }

  // ---------- 消息 ----------
  function preview(c, m) {
    if (!m) return '';
    if (m.from === 'sys') return m.text;
    if (c.group && m.from !== 'me') return `${m.from}：${m.text}`;
    return m.text;
  }
  function renderMessages() {
    setHead('消息');
    const body = $('app-body');
    const order = D.CONTACTS.map((c, i) => ({ c, i, ts: lastTs(c.id) })).sort((a, b) => (b.ts - a.ts) || (a.i - b.i));
    order.forEach(({ c }) => {
      const msgs = chatMsgs(c.id), last = msgs[msgs.length - 1];
      const n = unread(c.id), typing = !!S.typing[c.id];
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<div class="av" style="background:${c.color}">${esc(c.glyph)}</div><div class="rb"><div class="r1"><span class="name">${esc(c.name)}</span><span class="time">${esc(last ? (last.time || '') : '')}</span></div><div class="r2"><span class="preview${typing ? ' typing' : ''}">${typing ? '正在输入…' : esc(preview(c, last))}</span>${n ? `<span class="badge">${n}</span>` : ''}</div></div>`;
      row.addEventListener('click', () => openApp('chat', c.id));
      body.appendChild(row);
    });
  }
  function avatarHTML(c, from) {
    if (c.group) {
      const color = D.MEMBER_COLOR[from] || '#555';
      return `<div class="av" style="background:${color}">${esc(from[0])}</div>`;
    }
    return `<div class="av" style="background:${c.color}">${esc(c.glyph)}</div>`;
  }
  function bubble(c, m) {
    const el = document.createElement('div');
    if (m.from === 'sys') { el.className = 'sys'; el.textContent = m.text; return el; }
    const me = m.from === 'me';
    el.className = 'm ' + (me ? 'me' : 'them');
    const sender = c.group && !me ? `<div class="sender">${esc(m.from)}</div>` : '';
    el.innerHTML = `${me ? '' : avatarHTML(c, m.from)}<div class="bub">${sender}${esc(m.text)}<span class="t">${esc(m.time || '')}</span></div>`;
    return el;
  }
  function typingBubble(c, from) {
    const el = document.createElement('div');
    el.className = 'm them';
    el.innerHTML = `${c ? avatarHTML(c, from) : ''}<div class="bub typing-b"><span></span><span></span><span></span></div>`;
    return el;
  }
  function renderChat(id) {
    const c = D.CONTACT[id];
    const typing = !!S.typing[id];
    setHead(c.name, c.group ? `${c.members.length} 人` : c.unknown ? '未知号码' : typing ? '正在输入…' : '', typing && !c.group);
    markRead(id);
    const body = $('app-body');
    body.classList.add('chat-body');
    chatMsgs(id).forEach((m) => body.appendChild(bubble(c, m)));
    if (typing) body.appendChild(typingBubble(c, c.group ? '阿杰' : c.name));
    body.scrollTop = body.scrollHeight;

    const foot = $('app-foot');
    const pendingEv = S.pending[id];
    if (pendingEv) {
      const ev = D.EVENTS.find((e) => e.id === pendingEv);
      foot.innerHTML = `<div class="options">${ev.choices.options.map((o, i) => `<button type="button" class="opt${o.startsWith('（') ? ' dim' : ''}" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
      foot.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => pick(id, pendingEv, +b.dataset.i)));
    } else if (id === 'unknown' && S.stage >= 1) {
      foot.innerHTML = '<div class="options"><button type="button" class="opt" id="opt-c">你是谁</button></div>';
      $('opt-c').addEventListener('click', () => endGame('C'));
    } else {
      foot.innerHTML = '<div class="inputbar"><div class="fake-input">输入消息…</div><button type="button" class="send">发送</button></div>';
      foot.querySelector('.inputbar').addEventListener('click', () => P.toast('你不知道该说什么。'));
    }
  }

  // ---------- 事件与消息队列 ----------
  // 要送达的消息先放进 S.queue 持久化，再逐条送；中途关掉页面再打开，从没送完的那条接着送
  const timers = [];
  function scheduleEvents() {
    timers.forEach(clearTimeout); timers.length = 0;
    if (!S.unlocked || S.ending) return;
    const elapsed = (Date.now() - S.unlockAt) / 1000;
    let backlog = 1500; // 重新打开页面时，过期的事件排着队补发
    D.EVENTS.forEach((ev) => {
      if (S.fired.includes(ev.id)) return;
      let wait = (ev.at - elapsed) * 1000;
      if (wait < 0) { wait = backlog; backlog += 4000; }
      timers.push(setTimeout(() => fireEvent(ev), wait * P.speed()));
    });
    runQueue();
  }
  function fireEvent(ev) {
    if (S.fired.includes(ev.id) || S.ending) return;
    S.fired.push(ev.id); save();
    if (ev.photo) { addPhoto(ev.photo); return; }
    enqueue(ev.chat, ev.msgs, { typing: ev.typing, low: ev.low, pending: ev.choices ? ev.id : null });
  }
  function enqueue(chat, msgs, opts = {}) {
    S.queue.push({
      chat, msgs: msgs.map((m) => ({ from: m.from, text: m.text, delay: m.delay || 0 })),
      typing: opts.typing || 1.5, low: !!opts.low, pending: opts.pending || null, started: false,
    });
    save();
    runQueue();
  }
  // 逐条送达：先"正在输入"，再出消息；不在这个对话里就弹横幅
  let running = false;
  async function runQueue() {
    if (running) return;
    running = true;
    try {
      while (S.queue.length && !S.ending) {
        const job = S.queue[0];
        const c = D.CONTACT[job.chat];
        while (job.msgs.length && !S.ending) {
          const m = job.msgs[0];
          const wait = job.started ? (m.delay || 2.5) : job.typing;
          S.typing[job.chat] = true; save(); refresh();
          await sleep(wait * 1000);
          if (S.ending) break;
          S.typing[job.chat] = false;
          job.msgs.shift(); job.started = true;
          pushMsg(job.chat, m);
          const viewing = view.name === 'chat' && view.arg === job.chat;
          if (viewing) { markRead(job.chat); P.beep(job.low ? 'low' : 'msg'); }
          else P.notify({ app: '消息', icon: 'msg', title: c.group ? `${c.name} · ${m.from}` : c.name, text: m.text, sound: job.low ? 'low' : 'msg', onOpen: () => openApp('chat', job.chat) });
          refresh();
        }
        if (S.ending) break;
        S.queue.shift();
        if (job.pending) S.pending[job.chat] = job.pending;
        save(); refresh();
      }
    } finally { running = false; }
  }
  function pick(chatId, evId, i) {
    const ev = D.EVENTS.find((e) => e.id === evId);
    delete S.pending[chatId]; S.choices[evId] = i; save();
    const opt = ev.choices.options[i];
    if (!opt.startsWith('（')) pushMsg(chatId, { from: 'me', text: opt });
    refresh();
    const replies = ev.choices.replies[i];
    if (replies) enqueue(chatId, replies, { typing: 3, low: ev.low });
  }
  function addPhoto(key) {
    S.photos.unshift(key); S.photosNew = (S.photosNew || 0) + 1; save();
    P.notify({ app: '相册', icon: 'photo', title: '新照片', text: '1 张 · 刚刚', sound: 'low', onOpen: () => openApp('photos') });
    refresh();
  }

  // ---------- 相册 ----------
  function allPhotos() { return S.photos.map((k) => ({ ...D.PHOTO_EXTRA[k], added: true })).concat(D.PHOTOS); }
  function renderPhotos() {
    const list = allPhotos();
    setHead('相册', `${list.length} 张`);
    const newCount = S.photosNew || 0;
    S.photosNew = 0; save();
    $('app-body').innerHTML = `<div class="grid">${list.map((p, i) => `<button type="button" class="thumb lk lk-${p.look}${i < newCount ? ' new' : ''}" data-i="${i}"><span class="tt">${esc(p.time)}</span></button>`).join('')}</div>`;
    $('app-body').querySelectorAll('.thumb').forEach((b) => b.addEventListener('click', () => openApp('photo', +b.dataset.i)));
  }
  function renderPhoto(i) {
    const p = allPhotos()[i] || allPhotos()[0];
    setHead(p.time, p.place);
    $('app-body').innerHTML = `<div class="photo-view"><div class="pic lk lk-${p.look}"><div class="pic-grain"></div></div><div class="desc">${esc(p.desc)}</div><div class="meta">${esc(p.time)}${p.when ? ' · ' + esc(p.when) : ''} · ${esc(p.place)}</div></div>`;
  }

  // ---------- 备忘录 ----------
  function renderNotes() {
    setHead('备忘录', `${D.NOTES.length} 条`);
    const body = $('app-body');
    D.NOTES.forEach((n) => {
      const el = document.createElement('div');
      el.className = 'note-row';
      el.innerHTML = `<span class="name">${esc(n.title)}</span><span class="preview">${esc(n.time)} · ${esc(n.body.split('\n')[0])}</span>`;
      el.addEventListener('click', () => openApp('note', n.id));
      body.appendChild(el);
    });
  }
  function renderNote(id) {
    const n = D.NOTES.find((x) => x.id === id);
    setHead('备忘录');
    $('app-body').innerHTML = `<div class="note-view"><h2>${esc(n.title)}</h2><span class="time">${esc(n.time)}</span><div class="body">${esc(n.body)}</div></div>`;
  }

  // ---------- 通话记录 ----------
  function renderCalls() {
    setHead('电话', '最近通话');
    S.callsSeen = true; save();
    const body = $('app-body');
    const TY = { missed: '↙', out: '↗', in: '↙' };
    const SUB = { missed: '未接来电', out: '呼出', in: '呼入' };
    D.CALLS.forEach((k) => {
      const c = D.CONTACT[k.who];
      const el = document.createElement('div');
      el.className = 'call-row ' + k.type;
      el.innerHTML = `<span class="ty">${TY[k.type]}</span><div><div class="name">${esc(c.name)}</div><div class="sub">${SUB[k.type]}${k.dur ? ' · ' + esc(k.dur) : ''} · ${esc(k.time)}</div></div>${k.who === 'unknown' ? '<button type="button" class="cb">回拨</button>' : ''}`;
      const cb = el.querySelector('.cb');
      if (cb) cb.addEventListener('click', callBack);
      body.appendChild(el);
    });
  }
  let calling = false;
  async function callBack() {
    if (calling || S.ending) return;
    if (S.stage >= 1) return endGame('C');
    calling = true;
    const ov = $('calling');
    $('calling-num').textContent = D.CONTACT.unknown.name;
    $('calling-state').textContent = '正在呼叫…';
    ov.classList.remove('hidden'); P.beep('ring');
    await sleep(3500);
    $('calling-state').textContent = '对方无人接听';
    await sleep(1600);
    ov.classList.add('hidden'); calling = false;
    if (S.callTried) return;
    S.callTried = true; save();
    await sleep(2500);
    enqueue('unknown', [{ from: 'them', text: '别打了。' }, { from: 'them', text: '我就在附近。', delay: 3 }], { typing: 2, low: true });
  }

  // ---------- 设置 ----------
  function renderSettings() {
    setHead('设置');
    const o = D.OWNER;
    $('app-body').innerHTML = `
      <div class="set-group">
        <div class="set-row"><span>机主</span><span class="v">${esc(o.name)}</span></div>
        <div class="set-row"><span>号码</span><span class="v">${esc(o.number)}</span></div>
        <div class="set-row"><span>型号</span><span class="v">${esc(o.model)}</span></div>
        <div class="set-row"><span>系统</span><span class="v">${esc(o.os)}</span></div>
      </div>
      <div class="set-group">
        <div class="set-row"><span>电池</span><span class="v">${esc(o.battery)} · 低电量</span></div>
        <div class="set-row"><span>存储</span><span class="v">${esc(o.storage)}</span></div>
        <div class="set-row"><span>定位</span><span class="v">和平路公交站</span></div>
        <div class="set-row"><span>棠安助手</span><span class="v">已开启 · 学习机主习惯中</span></div>
      </div>
      <div class="set-group"><div class="set-row btn-row" id="btn-off">关机</div></div>`;
    $('btn-off').addEventListener('click', powerOff);
  }
  let poweringOff = false;
  async function powerOff() {
    if (poweringOff || S.ending) return;
    if (S.stage >= 1) return endGame('B');
    poweringOff = true;
    $('off').classList.remove('hidden');
    await sleep(2600);
    $('off').classList.add('hidden');
    poweringOff = false;
    if (S.offTried) { P.toast('无法关机'); return; }
    S.offTried = true; save();
    await sleep(900);
    enqueue('unknown', [{ from: 'them', text: '别关。' }], { typing: 1.5, low: true });
  }

  // ---------- 棠安助手 ----------
  let assistBusy = false;
  function botBubble(text) {
    const el = document.createElement('div');
    el.className = 'm them';
    el.innerHTML = `<div class="av" style="background:#2a2f3b">${D.LEAF}</div><div class="bub">${esc(text)}</div>`;
    return el;
  }
  function meBubble(text) {
    const el = document.createElement('div');
    el.className = 'm me';
    el.innerHTML = `<div class="bub">${esc(text)}</div>`;
    return el;
  }
  function renderAssistant(first) {
    setHead('棠安助手', '小棠 · 在线');
    const body = $('app-body');
    body.classList.add('chat-body');
    S.assistLog.forEach((m) => body.appendChild(m.from === 'me' ? meBubble(m.text) : botBubble(m.text)));
    if (assistBusy) {
      const t = document.createElement('div');
      t.className = 'm them';
      t.innerHTML = `<div class="av" style="background:#2a2f3b">${D.LEAF}</div><div class="bub typing-b"><span></span><span></span><span></span></div>`;
      body.appendChild(t);
    }
    body.scrollTop = body.scrollHeight;
    renderAssistFoot();
    if (first) assistantOpen();
  }
  function renderAssistFoot() {
    const foot = $('app-foot');
    if (assistBusy || S.assistQueue || S.ending) { foot.innerHTML = ''; return; }
    let options = null, handler = null;
    if (S.stage >= 1) { options = D.ASSIST.final.options; handler = (i) => assistFinal(i); }
    else if (S.assistWait) { foot.innerHTML = `<div class="foot-note">${esc(D.ASSIST.waitFoot)}</div>`; return; }
    else if (S.assistLog.length && S.assistRound < D.ASSIST.rounds.length) { options = D.ASSIST.rounds[S.assistRound].options; handler = (i) => assistPick(i); }
    if (!options) { foot.innerHTML = ''; return; }
    foot.innerHTML = `<div class="options">${options.map((o, i) => `<button type="button" class="opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
    foot.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => handler(+b.dataset.i)));
  }
  // 小棠要说的话也持久化：S.assistQueue = { lines, then }，then 是说完之后要做的事
  function botSay(lines, then = null) {
    S.assistQueue = { lines: lines.slice(), then }; save();
    return runAssist();
  }
  async function runAssist() {
    if (assistBusy || !S.assistQueue) return;
    assistBusy = true; refresh();
    try {
      const q = S.assistQueue;
      while (q.lines.length && !S.ending) {
        const line = q.lines[0];
        await sleep(900 + Math.min(2200, line.length * 90));
        if (S.ending) return;
        q.lines.shift();
        S.assistLog.push({ from: 'bot', text: line }); save();
        if (view.name === 'assistant') P.beep('msg');
        else P.notify({ app: '棠安助手', icon: 'assist', title: '小棠', text: line, onOpen: () => openApp('assistant') });
        refresh();
      }
      if (S.ending) return;
      const then = q.then;
      S.assistQueue = null; save();
      assistBusy = false;
      if (then === 'gate') {
        // 看过的东西太少就先不揭底，让玩家去翻相册
        if (S.fired.length < 2) { S.assistWait = true; save(); await botSay(D.ASSIST.wait); }
        else await botSay(D.ASSIST.reveal, 'reveal');
      } else if (then === 'reveal') {
        S.stage = 1; save();
      }
    } finally { assistBusy = false; refresh(); }
  }
  function assistantOpen() {
    if (assistBusy) return;
    if (S.assistQueue) return runAssist(); // 上次没说完的
    if (S.assistLog.length === 0) return botSay(D.ASSIST.intro({ time: timeStr(), left: busLeft() }));
    if (S.assistWait && S.fired.length >= 2) { S.assistWait = false; save(); return botSay(D.ASSIST.reveal, 'reveal'); }
  }
  function assistPick(i) {
    if (assistBusy || S.assistQueue) return;
    const r = D.ASSIST.rounds[S.assistRound];
    S.assistLog.push({ from: 'me', text: r.options[i] });
    S.assistRound++; save();
    return botSay(r.replies[i], S.assistRound >= D.ASSIST.rounds.length ? 'gate' : null);
  }
  function assistFinal(i) {
    S.assistLog.push({ from: 'me', text: D.ASSIST.final.options[i] }); save();
    endGame(D.ASSIST.final.endings[i]);
  }

  // ---------- 结局 ----------
  async function endGame(key) {
    if (S.ending) return;
    S.ending = key; save();
    timers.forEach(clearTimeout);
    if (key === 'C') await endingCPrelude();
    if (key === 'B') { $('off').classList.remove('hidden'); await sleep(2200); }
    showEnding(key, false);
  }
  async function endingCPrelude() {
    const id = 'unknown';
    view = { name: 'chat', arg: id };
    const lines = D.ENDINGS.C.chat;
    const redraw = () => { $('app-body').innerHTML = ''; renderChat(id); $('app-foot').innerHTML = ''; };
    pushMsg(id, { from: 'me', text: '你是谁' });
    redraw(); P.show('app');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i];
      S.typing[id] = true; redraw();
      await sleep((i === 0 ? 3 : m.delay || 3) * 1000);
      S.typing[id] = false;
      pushMsg(id, m); P.beep('low');
      redraw();
    }
    await sleep(1800);
    await P.flash();
    S.photos.unshift('back'); S.photosNew = (S.photosNew || 0) + 1; save();
    P.notify({ app: '相册', icon: 'photo', title: '新照片', text: '1 张 · 刚刚', sound: 'low' });
    await sleep(3200);
    P.clearNotifs();
  }
  async function showEnding(key, instant) {
    const E = D.ENDINGS[key];
    P.show('ending'); $('off').classList.add('hidden'); $('calling').classList.add('hidden');
    const box = $('ending-text'); box.innerHTML = '';
    $('ending-title').textContent = instant ? E.title : '';
    $('ending-btn').classList.toggle('hidden', !instant);
    for (const line of E.lines) {
      const p = document.createElement('p');
      p.textContent = line; box.appendChild(p);
      if (instant) { p.classList.add('in'); continue; }
      await sleep(60); p.classList.add('in');
      await sleep(line === '……' ? 1400 : 2000);
    }
    if (instant) return;
    await sleep(800);
    $('ending-title').textContent = E.title;
    $('ending-btn').classList.remove('hidden');
  }

  // ---------- 事件绑定与启动 ----------
  buildNumpad();
  $('lock').addEventListener('click', () => { P.show('pin'); pinBuf = ''; renderPin(); $('pin-msg').textContent = ''; });
  $('pin-cancel').addEventListener('click', () => P.show('lock'));
  $('app-back').addEventListener('click', () => { const p = PARENT[view.name]; if (p) openApp(p); else goHome(); });
  $('homebar').addEventListener('click', goHome);
  $('ending-btn').addEventListener('click', () => { localStorage.removeItem(KEY); location.reload(); });
  document.addEventListener('pointerdown', P.initAudio, { once: false });

  // 调试入口：FP.unlock() 跳过锁屏；FP.fire('zhou1') 立刻触发事件；FP.fast = true 关掉等待
  window.FP = {
    get state() { return S; },
    get fast() { return localStorage.getItem('fp_fast') === '1'; },
    set fast(v) { if (v) localStorage.setItem('fp_fast', '1'); else localStorage.removeItem('fp_fast'); },
    unlock() { if (!S.unlocked) unlock(); },
    fire(id) { const ev = D.EVENTS.find((e) => e.id === id); if (ev) fireEvent(ev); },
    async fireAll() { for (const ev of D.EVENTS) await fireEvent(ev); },
    stage(n) { S.stage = n; save(); refresh(); },
    clock(min) { S.openAt = Date.now() - (min - D.CLOCK.start) * D.CLOCK.msPerMin; save(); tickClock(); },
    end(k) { endGame(k); },
    go(name, arg) { if (name === 'home') goHome(); else openApp(name, arg); },
    reset() { localStorage.removeItem(KEY); location.reload(); },
  };

  renderLock();
  if (S.unlocked && !S.fired.includes('zhou1')) S.typing.zhou = true;
  if (S.ending) showEnding(S.ending, true);
  else if (S.unlocked) { goHome(); scheduleEvents(); if (S.assistQueue) runAssist(); }
  else P.show('lock');
  tickClock();
})();
