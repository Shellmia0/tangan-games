// 用本机的 Chrome（或 Edge）把 poster.html 的每个场景渲染成 1242×1656 的 PNG，顺便生成 assets/icon-180.png
// 用法：node post/render.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = path.join(__dirname, '..');
const outDir = path.join(__dirname, 'img');
const profile = path.join(os.tmpdir(), 'still-you-render-profile');
const SCENES = ['cover', 'rules', 'pre_reply', 'ghost_user', 'thinking_leak', 'idle_watch', 'cta'];

const browser = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));
if (!browser) { console.error('没找到 Chrome 或 Edge'); process.exit(1); }

const fileUrl = (p) => 'file:///' + p.replace(/\\/g, '/');
function shoot(url, out, w, h, extra = []) {
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${profile}`, '--force-device-scale-factor=1', `--window-size=${w},${h}`,
    '--virtual-time-budget=1500', ...extra, `--screenshot=${out}`, url,
  ], { stdio: 'ignore' });
  console.log('写入 ' + path.relative(root, out));
}

fs.mkdirSync(outDir, { recursive: true });
SCENES.forEach((s, i) => {
  shoot(fileUrl(path.join(__dirname, 'poster.html')) + '?s=' + s,
    path.join(outDir, `${String(i + 1).padStart(2, '0')}-${s}.png`), 1242, 1656);
});
fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
shoot(fileUrl(path.join(__dirname, 'icon.html')), path.join(root, 'assets', 'icon-180.png'), 180, 180,
  ['--default-background-color=00000000']);
