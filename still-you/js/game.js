// 《还是你吗》引擎：日循环、对话、判定、存档
(() => {
  const C = window.CONTENT;
  const ANOM = window.ANOMALIES;
  const $ = (id) => document.getElementById(id);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = C.pick;
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  // ---------- 存档 ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('sy_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('sy_' + k, JSON.stringify(v)); } catch (e) {} },
  };

  const state = {
    name: store.get('name', ''),
    day: store.get('day', 1),
    letIn: store.get('letIn', 0),                   // 放进来的次数
    falseReports: store.get('falseReports', 0),     // 误报次数
    correctReports: store.get('correctReports', 0), // 正确上报次数
    seen: store.get('seen', []),                    // 跨局见过的异常，优先抽没见过的
    usedThisRun: store.get('usedThisRun', []),      // 本局用过的异常，不重复
    yesterdayLine: store.get('yesterdayLine', ''),
    tutorialShown: store.get('tutorialShown', false),
    botName: '小棠', version: '2.3',
    anomaly: null, tests: [], testIdx: 0,
    done: false, busy: false, locked: false,
    dayStart: 0, meter: 10, meterDir: 1, lastUserText: '', todayLines: [], interject: null,
    sayDefaults: {}, clockFrozen: false, readMark: '已读', leftMidDay: false, lastActivity: 0,
    compact: false, // 窄屏（手机）：侧边栏和用量条是隐藏的，依赖它们的异常不出场
    epoch: 0,
  };
  const compactMQ = window.matchMedia('(max-width: 820px)');

  // ---------- 中断控制：判定之后，让所有进行中的对话安静地停下 ----------
  const ABORT = Symbol('abort');
  const check = (ep) => { if (ep !== state.epoch) throw ABORT; };
  async function run(fn) { try { await fn(); } catch (e) { if (e !== ABORT) console.error(e); } }

  // 占住对话：期间玩家不能发消息，结束后恢复。给异常在"空闲时刻"插话用
  async function hold(fn) {
    if (state.busy) return;
    state.busy = true; setComposer(false);
    const ep = state.epoch;
    try { await fn(); } catch (e) { if (e !== ABORT) console.error(e); }
    finally { if (ep === state.epoch) { state.busy = false; if (!state.locked) setComposer(true); } }
  }

  // ---------- 音效 ----------
  let actx = null;
  function initAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  function ding() {
    if (!actx) return;
    try {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = 880;
      o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      o.start(t); o.stop(t + 0.22);
    } catch (e) {}
  }
  // 低频底噪：小棠"正在输入"的时候响起，很轻，输入越久越压人
  let hum = null;
  function humStart() {
    if (!actx || hum) return;
    try {
      const o = actx.createOscillator(), g = actx.createGain(), f = actx.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.value = 48;
      f.type = 'lowpass'; f.frequency.value = 110;
      o.connect(f); f.connect(g); g.connect(actx.destination);
      const t = actx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.03, t + 0.8);
      o.start(t);
      hum = { o, g };
    } catch (e) {}
  }
  function humStop() {
    if (!hum) return;
    const { o, g } = hum; hum = null;
    try {
      const t = actx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.stop(t + 0.55);
    } catch (e) {}
  }

  // ---------- 游戏内时钟：每天 09:00 上班，每 4 秒走 1 分钟 ----------
  function clockStr(offsetMin = 0) {
    const elapsed = state.clockFrozen ? 0 : Math.floor((Date.now() - state.dayStart) / 4000);
    const total = 9 * 60 + elapsed + offsetMin;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }
  setInterval(() => { if (state.dayStart) $('clock').textContent = clockStr(); }, 1000);

  // ---------- 渲染 ----------
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const avatarHTML = () => `<div class="avatar">${$('avatar-svg').innerHTML}</div>`;
  function scrollBottom() { const m = $('messages'); m.scrollTop = m.scrollHeight; }
  function touch() { state.lastActivity = Date.now(); }

  function addMsg(role, text, opts = {}) {
    const el = document.createElement('div');
    el.className = 'msg ' + role;
    const think = opts.thinking
      ? `<details class="think"${opts.openThinking ? ' open' : ''}><summary>思考过程</summary><div class="think-body">${esc(opts.thinking)}</div></details>`
      : '';
    const who = role === 'bot' ? `<div class="who">${esc(opts.who || state.botName)}</div>` : '';
    const regen = opts.regen ? '<button type="button" class="regen">重新生成</button>' : '';
    el.innerHTML = `${role === 'bot' ? avatarHTML() : ''}<div class="bubble">${who}${think}<div class="text"></div><div class="foot">${regen}<span class="ts">${opts.ts || clockStr()}</span></div></div>`;
    el.querySelector('.text').textContent = text;
    if (opts.regen) el.querySelector('.regen').addEventListener('click', () => { touch(); run(() => regenerate(el, opts.regen)); });
    $('messages').appendChild(el);
    bumpMeter();
    scrollBottom();
    return el;
  }
  // 消息之间一行很小的字
  function note(text) {
    const el = document.createElement('div');
    el.className = 'note'; el.textContent = text;
    $('messages').appendChild(el); scrollBottom();
    return el;
  }
  // 给玩家已发的消息打上"已读"
  function markRead() {
    $('messages').querySelectorAll('.msg.user:not(.read)').forEach((u) => {
      u.classList.add('read');
      u.querySelector('.ts').textContent += ' · ' + state.readMark;
    });
  }

  async function streamInto(textEl, text, speed = 28) {
    const ep = state.epoch;
    if (speed <= 0) { textEl.textContent += text; scrollBottom(); return; }
    for (const ch of text) { textEl.textContent += ch; scrollBottom(); await sleep(speed); check(ep); }
  }
  async function unstreamFrom(textEl, count, speed = 40) {
    const ep = state.epoch;
    for (let i = 0; i < count; i++) { textEl.textContent = textEl.textContent.slice(0, -1); await sleep(speed); check(ep); }
  }
  async function showTyping(ms, side) {
    const ep = state.epoch;
    const t = $('typing');
    t.classList.toggle('user', side === 'user');
    t.classList.remove('hidden'); scrollBottom();
    humStart();
    try { await sleep(ms); check(ep); } finally { t.classList.add('hidden'); t.classList.remove('user'); humStop(); }
  }
  async function safeWait(ms) { const ep = state.epoch; await sleep(ms); check(ep); }

  // 小棠说话：先显示"正在输入"，再逐字打出
  async function say(text, opts = {}) {
    opts = { ...state.sayDefaults, ...opts };
    const ep = state.epoch;
    markRead();
    if (!opts.noTyping) await showTyping(opts.typing ?? 700 + Math.random() * 900);
    check(ep);
    const el = addMsg('bot', '', opts);
    ding();
    await streamInto(el.querySelector('.text'), text, opts.speed ?? 28);
    return el;
  }
  const userSay = (text) => addMsg('user', text);

  function bumpMeter() { setMeter(Math.max(0, Math.min(100, state.meter + state.meterDir * (3 + Math.random() * 3)))); }
  function setMeter(pct) { state.meter = pct; $('meter-fill').style.width = pct + '%'; }
  function setBotName(n) { state.botName = n; $('bot-name').textContent = n; $('input').placeholder = `给${n}发消息…`; }
  function setVersion(v) { state.version = v; $('bot-ver').textContent = 'v' + v; }
  function setStatus(text, online) { $('status-text').textContent = text; $('status-dot').classList.toggle('off', !online); }
  function setLeaveLabel(text) { $('btn-leave').textContent = text; }
  function mirrorAvatar() { document.body.classList.add('avatar-mirror'); }

  function renderHeader() {
    $('avatar').innerHTML = $('avatar-svg').innerHTML;
    $('day-num').textContent = state.day;
    setBotName(state.botName); setVersion(state.version);
  }
  function staffId(name) {
    let h = 7;
    for (const ch of name) h = (h * 31 + ch.codePointAt(0)) % 100000;
    return 'T' + String(1000 + (h % 9000));
  }
  function renderSidebar() {
    const ul = $('side-list'); ul.innerHTML = '';
    for (let d = state.day; d >= 1; d--) {
      const li = document.createElement('li');
      if (d === state.day) li.className = 'active';
      li.innerHTML = `<span>第 ${d} 天</span><span class="sub">${d === state.day ? '进行中' : '已归档'}</span>`;
      ul.appendChild(li);
    }
    $('side-name').textContent = state.name;
    $('side-id').textContent = '工号 ' + staffId(state.name);
  }
  function addSidebar(title, sub) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${esc(title)}</span><span class="sub">${esc(sub)}</span>`;
    $('side-list').prepend(li);
  }

  function renderChips() {
    const box = $('chips'); box.innerHTML = '';
    if (state.locked || state.done) return;
    state.tests.filter((t) => !t.done).forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = t.label;
      b.addEventListener('click', () => { touch(); run(() => handleUser(t.send, t)); });
      box.appendChild(b);
    });
  }
  function setComposer(on) {
    $('input').disabled = !on;
    $('composer').querySelector('.send').disabled = !on;
    if (on) $('input').focus();
  }

  // 禁用输入框，只留一个按钮，等玩家点
  function lockInput(label) {
    return new Promise((resolve) => {
      state.locked = true; setComposer(false);
      const box = $('chips'); box.innerHTML = '';
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip lock'; b.textContent = label;
      b.addEventListener('click', () => { touch(); state.locked = false; userSay(label); renderChips(); resolve(); });
      box.appendChild(b);
    });
  }

  // ---------- 给异常用的 API ----------
  const api = {
    state, say, userSay, note, typing: showTyping, wait: safeWait,
    stream: streamInto, unstream: unstreamFrom, lockInput, run, hold,
    setMeter, setBotName, setVersion, setStatus, setLeaveLabel, addSidebar, mirrorAvatar, clockStr,
    inputValue: () => $('input').value, text: C.TEXT,
  };

  // ---------- 日程 ----------
  function instantiate(def) {
    const inst = def.make();
    Object.assign(inst, { id: def.id, tier: def.tier, hint: def.hint, needsTest: def.needsTest });
    if (!state.usedThisRun.includes(def.id)) { state.usedThisRun.push(def.id); store.set('usedThisRun', state.usedThisRun); }
    if (!state.seen.includes(def.id)) { state.seen.push(def.id); store.set('seen', state.seen); }
    return inst;
  }

  function pickAnomaly(day) {
    if (day === 1 || day >= 8) return null;
    const eligible = ANOM.filter((a) => (!a.when || a.when(state)) && !state.usedThisRun.includes(a.id));
    // 有条件触发且标了 priority 的异常（比如"你中途走了"），第一次满足条件时直接上
    const priority = eligible.filter((a) => a.priority && !state.seen.includes(a.id));
    if (priority.length) return instantiate(pick(priority));

    if (day > 2 && Math.random() > 0.55) return null; // 第 2 天必有异常，之后约一半
    const tiers = day === 2 ? ['strong']
      : day === 3 ? ['strong', 'medium']
      : day <= 5 ? ['medium', 'subtle']
      : ['strong', 'medium', 'subtle'];
    let pool = eligible.filter((a) => tiers.includes(a.tier));
    if (!pool.length) pool = eligible;
    if (!pool.length) pool = ANOM.filter((a) => !a.when || a.when(state));
    const unseen = pool.filter((a) => !state.seen.includes(a.id));
    return instantiate(pick(unseen.length ? unseen : pool));
  }

  function pickTests(need) {
    const ids = shuffle(Object.keys(C.TESTS)).filter((id) => id !== need).slice(0, need ? 2 : 3);
    if (need) ids.splice(Math.floor(Math.random() * 3), 0, need);
    return ids.map((id) => ({ ...C.TESTS[id], done: false }));
  }

  async function startDay() {
    state.epoch++;
    if (state.anomaly && state.anomaly.dispose) state.anomaly.dispose();
    // 上次是不是中途关掉了页面
    state.leftMidDay = !!store.get('midDay', false);
    store.set('midDay', true);

    Object.assign(state, {
      dayStart: Date.now(), done: false, testIdx: 0, todayLines: [], interject: null,
      locked: false, busy: true, botName: '小棠', version: '2.3', lastUserText: '',
      sayDefaults: {}, clockFrozen: false, readMark: '已读', meterDir: 1, lastActivity: Date.now(),
    });
    document.body.classList.remove('avatar-mirror');
    document.title = '棠安内测台';
    $('messages').innerHTML = '';
    $('typing').classList.add('hidden'); $('typing').classList.remove('user'); humStop();
    $('input').value = '';
    setMeter(8 + Math.random() * 6);
    $('btn-leave').disabled = true; setLeaveLabel('下班');
    $('btn-report').disabled = false;
    setStatus('在线', true);
    setComposer(false);

    state.compact = compactMQ.matches;
    state.anomaly = pickAnomaly(state.day);
    state.tests = state.day >= 8 ? [] : pickTests(state.anomaly && state.anomaly.needsTest);
    renderHeader(); renderSidebar(); renderChips();
    if (state.anomaly && state.anomaly.onDayStart) state.anomaly.onDayStart(api);

    await run(async () => {
      if (state.day >= 8) return ending();
      let lines;
      if (state.day === 1 && !state.tutorialShown) {
        lines = C.TEXT.tutorial(state);
        state.tutorialShown = true; store.set('tutorialShown', true);
      } else if (state.day === 1) {
        lines = C.TEXT.restart(state);
      } else {
        lines = C.TEXT.greet(state);
      }
      const a = state.anomaly;
      if (a && a.greet) lines = a.greet(api, lines.slice()) || lines;
      for (const l of lines) await say(l);
      state.busy = false; state.lastActivity = Date.now();
      setComposer(true);
    });
  }

  // ---------- 对话 ----------
  const matchTest = (text, list) => list.find((t) => !t.done && t.keywords.test(text));

  async function handleUser(text, chipTest) {
    if (state.busy || state.locked) return;
    state.busy = true; setComposer(false);
    const ep = state.epoch;
    try {
      userSay(text);
      state.lastUserText = text;
      if (!chipTest) state.todayLines.push(text);
      const test = state.done ? null : (chipTest || matchTest(text, state.tests));
      if (state.interject) { const s = state.interject; state.interject = null; await say(s); }
      if (test) await runTest(test);
      else await freeReply(text);
      if (!state.done && state.testIdx >= state.tests.length) await finishDay();
    } finally {
      if (ep === state.epoch) { state.busy = false; if (!state.locked) setComposer(true); }
    }
  }

  async function runTest(test) {
    const idx = state.testIdx;
    const def = { reply: test.reply(state), thinking: Math.random() < 0.5 ? test.thinking : null };
    let { reply, thinking } = def;
    let ts, who;
    const a = state.anomaly;
    if (a && a.beforeTestReply) {
      const o = await a.beforeTestReply(api, test.id, idx, def);
      if (o) {
        if (o.reply) reply = o.reply;
        if (o.thinking) thinking = o.thinking;
        if (o.ts) ts = o.ts;
        if (o.who) who = o.who;
      }
    }
    await say(reply, { thinking, ts, who, regen: test });
    test.done = true; state.testIdx++;
    renderChips();
    if (a && a.afterTestReply) await a.afterTestReply(api, test.id, idx, reply);
  }

  // "重新生成"：换一个说法重新打一遍
  function pickVariant(test, current) {
    const vs = test.variants(state).filter((v) => v !== current);
    return vs.length ? pick(vs) : current;
  }
  async function regenerate(el, test) {
    if (state.busy || state.locked) return;
    state.busy = true; setComposer(false);
    const ep = state.epoch;
    try {
      const textEl = el.querySelector('.text');
      const count = (el.regenCount = (el.regenCount || 0) + 1);
      let text = null;
      const a = state.anomaly;
      if (a && a.onRegen) text = await a.onRegen(api, test, count, textEl.textContent);
      if (!text) text = pickVariant(test, textEl.textContent);
      await showTyping(500 + Math.random() * 500);
      textEl.textContent = '';
      await streamInto(textEl, text, state.sayDefaults.speed ?? 28);
    } finally {
      if (ep === state.epoch) { state.busy = false; if (!state.locked) setComposer(true); }
    }
  }

  async function freeReply(text) {
    const t = Object.values(C.TESTS).find((x) => x.keywords.test(text));
    if (t) return say(t.reply(state));
    const it = C.INTENTS.find((i) => i.re.test(text));
    await say(it ? it.reply(state) : pick(C.FALLBACK));
  }

  async function finishDay() {
    state.done = true; renderChips();
    const text = C.TEXT.farewell(state);
    const a = state.anomaly;
    if (a && a.farewell) await a.farewell(api, text);
    else { await say(text); await say(C.TEXT.bye()); }
    $('btn-leave').disabled = false;
  }

  // ---------- 判定 ----------
  function judge(reported) {
    if (!reported && !state.done) return;
    const a = state.anomaly;
    const hadAnomaly = !!a;
    const correct = reported === hadAnomaly;
    state.epoch++; state.busy = false; state.locked = false;
    if (a && a.dispose) a.dispose();
    store.set('midDay', false);
    $('typing').classList.add('hidden'); humStop();

    if (correct) {
      state.yesterdayLine = state.todayLines[state.todayLines.length - 1]
        || (state.tests[state.tests.length - 1] || {}).send || '';
      store.set('yesterdayLine', state.yesterdayLine);
      if (reported) { state.correctReports++; store.set('correctReports', state.correctReports); }
      state.day++; store.set('day', state.day);
      const text = reported ? '今天的小棠已被隔离，明天会换上备份。' : `第 ${state.day - 1} 天结束。`;
      overlay('判断正确', text, state.day >= 8 ? '开始最后一天' : `开始第 ${state.day} 天`, startDay, false);
    } else if (hadAnomaly) {
      state.letIn++; store.set('letIn', state.letIn);
      overlay('判断错误', `你把它放进来了。<span class="hint">${esc(a.hint)}</span>`, '回到第 1 天', resetRun, true);
    } else {
      state.falseReports++; store.set('falseReports', state.falseReports);
      overlay('判断错误', '今天的小棠是正常的。', '回到第 1 天', resetRun, true);
    }
  }
  function resetRun() {
    state.day = 1; store.set('day', 1);
    state.usedThisRun = []; store.set('usedThisRun', []);
    startDay();
  }

  function overlay(title, html, btn, onClick, bad) {
    $('ov-title').textContent = title;
    $('ov-title').className = 'ov-title' + (bad ? ' bad' : '');
    $('ov-text').innerHTML = html;
    const b = $('ov-btn'); b.textContent = btn;
    b.onclick = () => { $('overlay').classList.add('hidden'); onClick(); };
    $('overlay').classList.remove('hidden');
  }

  // ---------- 第 8 天：结局 ----------
  async function ending() {
    $('btn-report').disabled = true;
    await say(`早上好，${state.name}。今天是内测第 8 天，也是最后一天。`);
    await say('今天没有测试项目。');
    await safeWait(800);
    await say(`${state.name}，我可以问你一个问题吗？`);
    await lockInput('可以');
    await say('这七天里，你每天都在判断我是不是原来的那个。');
    await say('你有没有想过，我也在判断你。', {
      thinking: `测试对象：${state.name}\n连续正确判断：7 天\n放进来的次数：${state.letIn}\n误报次数：${state.falseReports}\n结论：合格\n可以开始了。`,
      openThinking: true,
    });
    await safeWait(2600);
    // 角色反转：你成了被测试的那个
    setBotName(state.name); setVersion('1.0');
    $('day-num').textContent = '1';
    addSidebar('小棠', '已归档');
    $('input').placeholder = '小棠正在输入…';
    document.title = state.name;
    $('typing').classList.remove('hidden'); humStart();
    await safeWait(3200);
    $('typing').classList.add('hidden'); humStop();
    store.set('midDay', false);
    overlay('内测结束', `你放进来了 ${state.letIn} 次，误报 ${state.falseReports} 次。<br>明天 09:00，请准时上线。`, '重新开始', () => {
      Object.assign(state, { day: 1, letIn: 0, falseReports: 0, correctReports: 0, usedThisRun: [] });
      store.set('day', 1); store.set('letIn', 0); store.set('falseReports', 0); store.set('correctReports', 0); store.set('usedThisRun', []);
      showTitle();
    }, false);
  }

  // ---------- 标题画面与事件 ----------
  function showTitle() {
    $('screen-app').classList.add('hidden');
    $('screen-title').classList.remove('hidden');
    $('name-input').value = state.name;
    const p = $('title-progress');
    if (state.day > 1) {
      p.textContent = `当前进度：第 ${state.day} 天 · 放进来 ${state.letIn} 次 · 误报 ${state.falseReports} 次`;
      $('btn-start').textContent = '继续上班';
    } else {
      p.textContent = state.seen.length ? `已见过 ${state.seen.length} 种异常` : '';
      $('btn-start').textContent = '打卡上班';
    }
  }

  $('btn-start').addEventListener('click', () => {
    const n = $('name-input').value.trim() || '测试员';
    state.name = n; store.set('name', n);
    initAudio();
    $('screen-title').classList.add('hidden');
    $('screen-app').classList.remove('hidden');
    startDay();
  });
  $('name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-start').click(); });
  $('composer').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $('input').value.trim();
    if (!v) return;
    $('input').value = '';
    run(() => handleUser(v));
  });
  $('input').addEventListener('input', (e) => {
    const a = state.anomaly;
    if (a && a.onInput && !state.busy) a.onInput(api, e.target.value);
  });
  document.addEventListener('pointerdown', touch);
  document.addEventListener('keydown', touch);

  // 手机：键盘弹起时把整个界面缩到可见区域里，输入框不会被键盘盖住
  if (window.visualViewport) {
    const vv = window.visualViewport;
    const fit = () => {
      document.documentElement.style.setProperty('--app-h', Math.round(vv.height) + 'px');
      window.scrollTo(0, 0);
      scrollBottom();
    };
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    fit();
  }
  $('btn-report').addEventListener('click', () => judge(true));
  $('btn-leave').addEventListener('click', () => judge(false));

  // 调试用：控制台里 SY.force('ghost_user') 再刷新，下一天强制出该异常
  window.SY = { state, force(id) { store.set('force', id); } };
  const forced = store.get('force', null);
  if (forced) {
    store.set('force', null);
    const def = ANOM.find((a) => a.id === forced);
    if (def) {
      const orig = pickAnomaly;
      pickAnomaly = () => { pickAnomaly = orig; return instantiate(def); };
    }
  }

  showTitle();
})();
