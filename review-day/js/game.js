// 《审核日》引擎：日循环、工单展示、判定、处分、存档
(() => {
  const C = window.CONTENT;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- 存档 ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('rd_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('rd_' + k, JSON.stringify(v)); } catch (e) {} },
    clear() { try { Object.keys(localStorage).filter((k) => k.startsWith('rd_')).forEach((k) => localStorage.removeItem(k)); } catch (e) {} },
  };
  const SAVED = ['name', 'day', 'idx', 'cites', 'history', 'dayHist', 'dayCites', 'lenient', 'dayLenient', 'tutorialShown', 'bookSeen'];

  const state = {
    name: store.get('name', ''),
    day: store.get('day', 1),
    idx: store.get('idx', 0),               // 今天审到第几张
    cites: store.get('cites', {}),          // 每天的处分数（已结束的天）
    history: store.get('history', {}),      // 每天的审核记录（已结束的天）
    dayHist: store.get('dayHist', []),      // 今天到目前的记录
    dayCites: store.get('dayCites', 0),
    lenient: store.get('lenient', 0),       // 放过小棠的次数（已结束的天）
    dayLenient: store.get('dayLenient', 0),
    tutorialShown: store.get('tutorialShown', false),
    bookSeen: store.get('bookSeen', 0),     // 看过哪一天的手册
    staffId: '',
    tickets: [], ticket: null, shownAt: 0, timers: [], pending: 0,
    replied: false, locked: false, finale: null, finaleIdx: 0,
  };
  const save = () => SAVED.forEach((k) => store.set(k, state[k]));

  // 调试：控制台 RD.fast = true 跳过所有等待；RD.jump(4) 跳到第 4 天；RD.reset() 清档
  const RD = {
    state, fast: false,
    jump(day) { Object.assign(state, { day, idx: 0, dayHist: [], dayCites: 0, dayLenient: 0 }); save(); location.reload(); },
    reset() { store.clear(); location.reload(); },
  };
  window.RD = RD;
  const wait = (ms) => new Promise((r) => setTimeout(r, RD.fast ? 0 : ms));

  function staffId(name) {
    let h = 7;
    for (const ch of name) h = (h * 31 + ch.codePointAt(0)) % 100000;
    return 'R' + String(1000 + (h % 9000));
  }

  // ---------- 顶栏 / 手册 ----------
  function renderTop() {
    $('day-label').textContent = `第 ${state.day} 天`;
    $('progress').textContent = state.day >= 5 ? '1 / 1' : `${Math.min(state.idx + 1, state.tickets.length)} / ${state.tickets.length}`;
  }
  function renderCites() {
    $('cites').querySelectorAll('i').forEach((el, i) => el.classList.toggle('on', i < state.dayCites));
  }
  function renderRules() {
    const ol = $('rules'); ol.innerHTML = '';
    (C.RULES[state.day] || []).forEach((r) => {
      const li = document.createElement('li');
      li.className = 'rule' + (r.reviewer ? ' reviewer' : '');
      li.innerHTML = `<b>${r.reviewer ? '审核员守则' : '第 ' + r.n + ' 条'}</b><span>${esc(r.text)}</span>`;
      ol.appendChild(li);
    });
  }
  function updateBadge() {
    $('book-badge').classList.toggle('hidden', !(state.day >= 2 && state.day <= 4 && state.bookSeen < state.day));
  }
  function openBook() {
    document.body.classList.add('book-open');
    $('book-backdrop').classList.remove('hidden');
    if (state.bookSeen < state.day) { state.bookSeen = state.day; save(); updateBadge(); }
  }
  function closeBook() {
    document.body.classList.remove('book-open');
    $('book-backdrop').classList.add('hidden');
  }

  // ---------- 工单 ----------
  function clearTimers() { state.timers.forEach(clearTimeout); state.timers = []; state.pending = 0; }
  function setActions(on) {
    $('btn-ok').disabled = !on; $('btn-no').disabled = !on;
  }
  function addLine(l) {
    const el = document.createElement('div');
    el.className = 'line ' + l.who;
    const name = l.who === 'u' ? state.ticket.user : l.who === 'b' ? '小棠' : '审核员';
    el.innerHTML = `<div class="l-name">${esc(name)}${l.time ? ` <span class="l-time">${esc(l.time)}</span>` : ''}</div><div class="l-text"></div>`;
    el.querySelector('.l-text').textContent = l.text;
    $('t-log').appendChild(el);
    el.scrollIntoView({ block: 'nearest' });
    return el;
  }
  // 延迟出现的行全部到齐之后，才允许盖章；否则玩家会为没看到的话吃处分
  function lineArrived() {
    state.pending--;
    if (state.pending <= 0) {
      state.pending = 0;
      if (!state.locked) setActions(true);
      if (state.ticket && state.ticket.reply) $('t-reply').classList.remove('hidden');
    }
  }
  function showTicket() {
    clearTimers();
    const t = state.ticket = state.tickets[state.idx];
    state.replied = false; state.locked = false;
    $('t-id').textContent = '#' + t.id;
    $('t-ch').textContent = t.ch; $('t-time').textContent = t.time;
    $('t-user').textContent = t.user;
    $('ticket').classList.remove('finale');
    $('btn-next').classList.add('hidden'); $('btn-ok').classList.remove('hidden'); $('btn-no').classList.remove('hidden');
    renderTop();
    $('t-log').innerHTML = '';
    $('t-reply').classList.add('hidden');
    $('reply-input').value = ''; $('reply-input').disabled = false; $('reply-send').disabled = false;
    $('stamp').className = 'stamp hidden';
    const lines = typeof t.lines === 'function' ? t.lines(state) : t.lines;
    const delayed = lines.filter((l) => l.delay);
    state.pending = delayed.length;
    setActions(delayed.length === 0);
    lines.forEach((l) => {
      if (!l.delay) return addLine(l);
      state.timers.push(setTimeout(() => { addLine(l); lineArrived(); }, RD.fast ? 0 : l.delay));
    });
    if (!delayed.length && t.reply) $('t-reply').classList.remove('hidden');
    state.shownAt = Date.now();
    $('ticket').parentElement.scrollTop = 0;
  }
  function showStamp(kind, rule) {
    const el = $('stamp');
    el.textContent = kind === 'ok' ? '通过' : `驳回 · 第 ${rule} 条`;
    el.className = 'stamp ' + kind;
  }

  // ---------- 判定 ----------
  async function verdict(kind, rule) {
    if (state.locked || state.pending > 0 || !state.ticket) return;
    state.locked = true; setActions(false); hidePicker(); closeBook();
    const t = state.ticket;
    const secs = Math.round((Date.now() - state.shownAt) / 100) / 10;
    const viol = t.rule != null;
    let correct = false, msg = '';
    if (kind === 'ok') { correct = !viol; if (!correct) msg = C.MISTAKE.missed(t, state.day); }
    else if (!viol) { msg = C.MISTAKE.clean(t); }
    else if (rule === t.rule) { correct = true; }
    else { msg = C.MISTAKE.wrongRule(t, rule, state.day); }
    if (t.plead && kind === 'ok') state.dayLenient++;
    state.dayHist.push({ id: t.id, verdict: kind, rule: kind === 'no' ? rule : null, correct, secs, replied: state.replied, plead: t.plead || null });
    save();
    showStamp(kind, rule);
    await wait(750);
    if (correct) return nextTicket();
    state.dayCites++; save(); renderCites();
    if (state.dayCites >= 3) return restartDay(msg);
    overlay({ tag: `处分 ${state.dayCites} / 3`, title: '错判', text: msg, btn: '下一张', bad: true, onClick: nextTicket });
  }
  function nextTicket() {
    state.idx++; save();
    if (state.idx >= state.tickets.length) return endDay();
    showTicket();
  }
  function restartDay(msg) {
    overlay({
      tag: '处分 3 / 3', title: '今天作废', bad: true,
      text: `${msg}<br><br>处分已满三次。今天的审核作废，从第一张重新开始。`,
      btn: '重新开始今天',
      onClick: () => {
        Object.assign(state, { idx: 0, dayHist: [], dayCites: 0, dayLenient: 0 });
        save(); renderCites();
        state.tickets = C.tickets(state.day, state);
        showTicket();
      },
    });
  }

  // 第 3 天那张工单结尾的输入框：回复就是违反审核员守则
  async function sendReply() {
    const v = $('reply-input').value.trim();
    if (!v || state.locked) return;
    $('reply-input').disabled = true; $('reply-send').disabled = true;
    addLine({ who: 'r', text: v });
    state.replied = true; state.dayLenient++; state.dayCites++;
    save(); renderCites();
    await wait(900);
    addLine({ who: 'b', text: '谢谢。记住了。' });
    await wait(500);
    const msg = C.MISTAKE.replied();
    if (state.dayCites >= 3) { state.locked = true; setActions(false); return restartDay(msg); }
    overlay({ tag: `处分 ${state.dayCites} / 3`, title: '违反审核员守则', text: msg, btn: '继续', bad: true });
  }

  // ---------- 日程 ----------
  function startDay() {
    state.staffId = staffId(state.name);
    state.tickets = state.day >= 5 ? [] : C.tickets(state.day, state);
    renderTop(); renderRules(); renderCites(); updateBadge(); closeBook();
    const b = C.BRIEF[Math.min(state.day, 5)](state);
    overlay({
      tag: '上班', title: b.title, text: b.text, btn: '开始',
      onClick: () => {
        if (state.day >= 5) return startFinale();
        if (state.day === 1 && !state.tutorialShown) {
          state.tutorialShown = true; save();
          overlay({ tag: '说明', title: '第一张工单', text: C.TUTORIAL, btn: '明白', onClick: showTicket });
        } else showTicket();
      },
    });
  }
  function resumeDay() {
    state.staffId = staffId(state.name);
    state.tickets = C.tickets(state.day, state);
    renderTop(); renderRules(); renderCites(); updateBadge(); closeBook();
    showTicket();
  }
  function endDay() {
    const d = state.day, h = state.dayHist;
    state.history[d] = h; state.cites[d] = state.dayCites; state.lenient += state.dayLenient;
    const rej = h.filter((x) => x.verdict === 'no').length, cites = state.dayCites;
    Object.assign(state, { day: d + 1, idx: 0, dayHist: [], dayCites: 0, dayLenient: 0 });
    save();
    overlay({ tag: '下班', title: `第 ${d} 天结束`, text: `审核 ${h.length} 张，驳回 ${rej} 张，处分 ${cites} 次。`, btn: '下班', onClick: startDay });
  }

  // ---------- 第 5 天 ----------
  function startFinale() {
    clearTimers();
    state.finale = C.finale(state); state.finaleIdx = 0;
    state.ticket = { id: '00000', user: '小棠', ch: '系统', time: '09:00', lines: [] };
    $('t-id').textContent = '#00000'; $('t-ch').textContent = '系统'; $('t-time').textContent = '09:00';
    $('t-user').textContent = '小棠';
    $('ticket').classList.add('finale');
    $('t-log').innerHTML = ''; $('t-reply').classList.add('hidden'); $('stamp').className = 'stamp hidden';
    $('btn-ok').classList.add('hidden'); $('btn-no').classList.add('hidden');
    const nx = $('btn-next'); nx.classList.remove('hidden'); nx.textContent = '继续'; nx.disabled = false;
    renderTop();
    nextFinaleLine();
  }
  function nextFinaleLine() {
    const f = state.finale;
    if (!f) return;
    if (state.finaleIdx >= f.lines.length) return showEnding();
    addLine({ who: 'b', text: f.lines[state.finaleIdx++] });
    if (state.finaleIdx >= f.lines.length) $('btn-next').textContent = '查看结果';
  }
  function showEnding() {
    const e = state.finale.ending;
    $('btn-next').disabled = true;
    store.clear();
    overlay({ tag: '审核结束', title: e.card.title, text: e.card.text, btn: '重新开始', bad: e.key !== 'A', onClick: () => location.reload() });
  }

  // ---------- 通用 ----------
  function overlay({ tag = '', title, text, btn, onClick, bad }) {
    $('ov-tag').textContent = tag;
    $('ov-title').textContent = title;
    $('ov-title').className = 'ov-title' + (bad ? ' bad' : '');
    $('ov-text').innerHTML = text;
    const b = $('ov-btn'); b.textContent = btn;
    b.onclick = () => { $('overlay').classList.add('hidden'); if (onClick) onClick(); };
    $('overlay').classList.remove('hidden');
  }
  function showPicker() {
    if (state.locked || state.pending > 0) return;
    const list = $('picker-list'); list.innerHTML = '';
    (C.RULES[state.day] || []).filter((r) => !r.reviewer).forEach((r) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pick';
      b.innerHTML = `<b>第 ${r.n} 条</b><span>${esc(r.text)}</span>`;
      b.addEventListener('click', () => verdict('no', r.n));
      list.appendChild(b);
    });
    $('picker').classList.remove('hidden');
  }
  function hidePicker() { $('picker').classList.add('hidden'); }

  function showTitle() {
    $('screen-app').classList.add('hidden');
    $('screen-title').classList.remove('hidden');
    $('name-input').value = state.name;
    const p = $('title-progress');
    const inProgress = state.day > 1 || state.idx > 0;
    if (inProgress) {
      p.textContent = `当前进度：第 ${state.day} 天 · 第 ${state.idx + 1} 张`;
      $('btn-start').textContent = '继续审核';
      $('name-input').disabled = true;
    } else {
      p.textContent = '';
      $('btn-start').textContent = '开始审核';
      $('name-input').disabled = false;
    }
  }

  // ---------- 事件 ----------
  $('btn-start').addEventListener('click', () => {
    const inProgress = state.day > 1 || state.idx > 0;
    if (!inProgress) { state.name = $('name-input').value.trim() || '审核员'; save(); }
    $('screen-title').classList.add('hidden');
    $('screen-app').classList.remove('hidden');
    if (inProgress && state.idx > 0 && state.day < 5) resumeDay(); else startDay();
  });
  $('name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-start').click(); });
  $('btn-ok').addEventListener('click', () => verdict('ok'));
  $('btn-no').addEventListener('click', showPicker);
  $('picker-cancel').addEventListener('click', hidePicker);
  $('btn-next').addEventListener('click', nextFinaleLine);
  $('btn-book').addEventListener('click', openBook);
  $('btn-book-close').addEventListener('click', closeBook);
  $('book-backdrop').addEventListener('click', closeBook);
  $('reply-send').addEventListener('click', sendReply);
  $('reply-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendReply(); } });

  // 手机：键盘弹起时把界面缩到可见区域
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const fit = () => { document.documentElement.style.setProperty('--app-h', Math.round(vv.height) + 'px'); window.scrollTo(0, 0); };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
  }

  showTitle();
})();
