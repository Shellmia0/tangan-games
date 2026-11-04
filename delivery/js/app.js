// 《骑手已到达》壳：页面切换、通知横幅、提示、音效、时钟格式
window.APP = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- 页面 ----------
  const SCREENS = ['push', 'order', 'chat', 'rider', 'cs', 'ending'];
  let current = 'push';
  const listeners = [];
  function show(name) {
    SCREENS.forEach((s) => $('screen-' + s).classList.toggle('hidden', s !== name));
    current = name;
    listeners.forEach((fn) => fn(name));
  }
  const onShow = (fn) => listeners.push(fn);
  const screen = () => current;

  // ---------- 通知横幅 / 提示 ----------
  let notifTimer = null, notifAction = null;
  function notify(text, onClick, ms = 5000) {
    const el = $('notif');
    $('notif-text').textContent = text;
    el.classList.remove('hidden');
    notifAction = onClick || null;
    clearTimeout(notifTimer);
    notifTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }
  $('notif').addEventListener('click', () => {
    $('notif').classList.add('hidden');
    if (notifAction) notifAction();
  });
  let toastTimer = null;
  function toast(text, ms = 2200) {
    const el = $('toast');
    el.textContent = text; el.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  // ---------- 音效（用户手势之后才初始化） ----------
  let actx = null;
  function initAudio() { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); } catch (e) {} }
  document.addEventListener('pointerdown', initAudio, { once: false });
  function tone(freq, t0, dur, vol, type = 'sine') {
    if (!actx) return;
    try {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = freq;
      o.connect(g); g.connect(actx.destination);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.start(t0); o.stop(t0 + dur + 0.05);
    } catch (e) {}
  }
  // 新消息：短促的一声
  function ding() { if (!actx) return; const t = actx.currentTime; tone(880, t, 0.18, 0.05); }
  // 门铃：叮——咚
  function bell() { if (!actx) return; const t = actx.currentTime; tone(659, t, 0.6, 0.09); tone(523, t + 0.45, 0.9, 0.09); }
  // 敲门：两下低频短音
  function knock() {
    if (!actx) return;
    const t = actx.currentTime;
    [0, 0.22, 0.44].forEach((d) => { tone(95, t + d, 0.09, 0.14, 'triangle'); tone(60, t + d, 0.12, 0.12); });
  }

  // ---------- 时钟 ----------
  const hhmm = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

  return { $, esc, show, onShow, screen, notify, toast, ding, bell, knock, hhmm };
})();
