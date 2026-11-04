// 无头 Chrome 驱动：打开页面、按顺序执行步骤（跑 JS、等待、截图、读文本），收集控制台报错。
// 浏览器面板不可见的时候用它来验证页面。
//
// 用法（参数按顺序执行）：
//   node tools/shot.js --url http://localhost:8767/ --mobile \
//     --shot out/1.png --js "SO.fast=true;document.getElementById('btn-start').click()" --wait 500 --shot out/2.png --text
//
//   --url U        打开页面（等 load 事件）
//   --mobile       375×812、2 倍像素、触屏 UA（在 --url 之前写）
//   --js CODE      在页面里执行，打印返回值（支持 await）
//   --wait MS      等待
//   --shot FILE    截图成 PNG
//   --text         打印页面可见文本（前 2000 字）
//   --errors       打印到目前为止收集到的控制台错误和异常
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const browser = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));
if (!browser) { console.error('没找到 Chrome 或 Edge'); process.exit(1); }

const args = process.argv.slice(2);
const port = 9300 + Math.floor(Math.random() * 500);
const profile = path.join(os.tmpdir(), 'tangan-shot-profile-' + port);
const mobile = args.includes('--mobile');
const scaleIdx = args.indexOf('--scale');
const scale = scaleIdx >= 0 ? Number(args[scaleIdx + 1]) : 2; // --scale 3 截出更清晰的图（手机模式下有效）
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(browser, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--autoplay-policy=no-user-gesture-required',
  `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`,
  `--window-size=${mobile ? '375,812' : '1100,720'}`, 'about:blank',
], { stdio: 'ignore' });

const errors = [];
let ws, nextId = 1;
const pending = new Map();
const events = [];
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function waitEvent(name, timeout = 15000) {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeout);
    events.push({ name, fn: (p) => { clearTimeout(t); resolve(p); } });
  });
}

async function connect() {
  let list = null;
  for (let i = 0; i < 50 && !list; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch (e) { await sleep(200); }
  }
  if (!list) throw new Error('连不上无头 Chrome');
  const page = list.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id); pending.delete(d.id);
      d.error ? p.reject(new Error(d.error.message)) : p.resolve(d.result);
      return;
    }
    if (d.method === 'Runtime.exceptionThrown') errors.push('异常：' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
    if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning'))
      errors.push(d.params.type + '：' + d.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    for (let i = events.length - 1; i >= 0; i--) if (events[i].name === d.method) { events.splice(i, 1)[0].fn(d.params); }
  };
  await send('Runtime.enable'); await send('Page.enable');
  if (mobile) {
    await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: scale, mobile: true });
    await send('Emulation.setTouchEmulationEnabled', { enabled: true });
  }
}

async function run() {
  await connect();
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--mobile') continue;
    if (a === '--scale') { i++; continue; }
    const v = args[i + 1];
    if (a === '--url') { i++; const loaded = waitEvent('Page.loadEventFired'); await send('Page.navigate', { url: v }); await loaded; await sleep(300); }
    else if (a === '--js') {
      i++;
      const r = await send('Runtime.evaluate', { expression: v, awaitPromise: true, returnByValue: true, replMode: true });
      if (r.exceptionDetails) console.log('JS 出错：' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
      else console.log('JS →', JSON.stringify(r.result.value));
    }
    else if (a === '--wait') { i++; await sleep(Number(v)); }
    else if (a === '--shot') {
      i++;
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.mkdirSync(path.dirname(path.resolve(v)), { recursive: true });
      fs.writeFileSync(v, Buffer.from(r.data, 'base64'));
      console.log('截图 →', v);
    }
    else if (a === '--text') {
      const r = await send('Runtime.evaluate', { expression: 'document.body.innerText.replace(/\\n{3,}/g, "\\n\\n").slice(0, 2000)', returnByValue: true });
      console.log('文本 →\n' + r.result.value);
    }
    else if (a === '--errors') { console.log(errors.length ? '控制台错误：\n' + errors.join('\n') : '控制台无错误'); }
  }
  if (!args.includes('--errors')) console.log(errors.length ? '控制台错误：\n' + errors.join('\n') : '控制台无错误');
}

run().catch((e) => { console.error(e.message); process.exitCode = 1; }).finally(() => {
  try { ws && ws.close(); } catch (e) {}
  chrome.kill();
  setTimeout(() => { try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {} }, 500);
});
