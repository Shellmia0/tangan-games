// 手机壳：屏幕切换、通知横幅、提示、音效、时间格式
window.PHONE = (() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 调试：FP.fast = true 时所有等待缩短到十分之一
  const speed = () => (window.FP && window.FP.fast ? 0.1 : 1);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms * speed()));

  // ---------- 音效（WebAudio 合成，用户第一次点击之后才初始化） ----------
  let actx = null;
  function initAudio() {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) {}
  }
  function tone(freq, t0, dur, gain = 0.06, type = 'sine') {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    o.connect(g); g.connect(actx.destination);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function beep(kind = 'msg') {
    if (!actx) return;
    try {
      const t = actx.currentTime;
      if (kind === 'msg') { tone(880, t, 0.09); tone(1175, t + 0.1, 0.16); }
      else if (kind === 'low') { tone(92, t, 1.1, 0.12); tone(138, t + 0.05, 0.7, 0.04, 'triangle'); }
      else if (kind === 'tap') { tone(1400, t, 0.03, 0.015, 'square'); }
      else if (kind === 'ring') { for (let i = 0; i < 3; i++) { tone(1046, t + i * 0.3, 0.1, 0.04); tone(1318, t + i * 0.3 + 0.1, 0.12, 0.04); } }
      else if (kind === 'shutter') {
        const b = actx.createBuffer(1, Math.floor(actx.sampleRate * 0.07), actx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const s = actx.createBufferSource(), g = actx.createGain();
        s.buffer = b; g.gain.value = 0.18; s.connect(g); g.connect(actx.destination); s.start(t);
      }
    } catch (e) {}
  }

  // ---------- 屏幕 ----------
  function show(id) {
    document.querySelectorAll('#phone > .screen').forEach((s) => s.classList.toggle('hidden', s.id !== id));
    $('homebar').classList.toggle('hidden', !(id === 'home' || id === 'app'));
    $('statusbar').classList.toggle('hidden', id === 'ending');
    document.body.dataset.screen = id;
  }

  // ---------- 通知横幅：最多叠 3 条，7 秒自动收起，点一下打开对应页面 ----------
  function notify({ title, text, app = '消息', icon = 'msg', sound = 'msg', onOpen }) {
    const box = $('notifs');
    const el = document.createElement('div');
    el.className = 'notif';
    el.innerHTML = `<div class="n-icon ${esc(icon)}"></div><div class="n-body"><div class="n-top"><span class="n-app">${esc(app)}</span><span class="n-time">现在</span></div><div class="n-title">${esc(title)}</div><div class="n-text">${esc(text)}</div></div>`;
    el.addEventListener('click', () => { dismiss(el); if (onOpen) onOpen(); });
    box.prepend(el);
    while (box.children.length > 3) box.lastChild.remove();
    if (sound) beep(sound);
    setTimeout(() => dismiss(el), 7000 * speed());
    return el;
  }
  function dismiss(el) {
    if (!el.isConnected) return;
    el.classList.add('gone');
    setTimeout(() => el.remove(), 300);
  }
  function clearNotifs() { $('notifs').innerHTML = ''; }

  function toast(text) {
    const t = $('toast');
    t.textContent = text; t.classList.remove('hidden');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.add('hidden'), 1800);
  }
  async function flash() {
    const f = $('flash');
    f.classList.add('on'); beep('shutter');
    await sleep(140);
    f.classList.remove('on');
  }

  const pad = (n) => String(n).padStart(2, '0');
  const minToStr = (m) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;

  // 手机：键盘弹起时把界面缩到可见区域；桌面：窗口不够大时把手机壳等比缩小
  function fit() {
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-h', Math.round(h) + 'px');
    const scale = Math.min(1, (h - 40) / 812, (window.innerWidth - 40) / 375);
    document.documentElement.style.setProperty('--scale', String(Math.max(0.3, scale)));
    window.scrollTo(0, 0);
  }
  window.addEventListener('resize', fit);
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', fit); window.visualViewport.addEventListener('scroll', fit); }
  fit();

  return { $, esc, sleep, speed, initAudio, beep, show, notify, clearNotifs, toast, flash, minToStr };
})();
