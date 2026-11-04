// 给任意一个游戏渲染发帖用的竖图：node tools/render-posters.js <游戏目录>
// 读 <游戏目录>/post/scenes.json（场景 key 数组），把 post/poster.html?s=<key> 渲染成 post/img/NN-<key>.png（1242×1656）。
// 如果有 post/icon.html，顺便渲染成 assets/icon-180.png。
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const game = process.argv[2];
if (!game) { console.error('用法：node tools/render-posters.js <游戏目录>'); process.exit(1); }
const root = path.resolve(__dirname, '..', game);
const postDir = path.join(root, 'post');
const scenesFile = path.join(postDir, 'scenes.json');
if (!fs.existsSync(scenesFile)) { console.error('没找到 ' + scenesFile); process.exit(1); }
const scenes = JSON.parse(fs.readFileSync(scenesFile, 'utf8'));
const outDir = path.join(postDir, 'img');
const profile = path.join(os.tmpdir(), 'tangan-render-profile');

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
  console.log('写入 ' + path.relative(path.join(__dirname, '..'), out));
}

fs.mkdirSync(outDir, { recursive: true });
scenes.forEach((s, i) => {
  shoot(fileUrl(path.join(postDir, 'poster.html')) + '?s=' + s,
    path.join(outDir, `${String(i + 1).padStart(2, '0')}-${s}.png`), 1242, 1656);
});
const icon = path.join(postDir, 'icon.html');
if (fs.existsSync(icon)) {
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  shoot(fileUrl(icon), path.join(root, 'assets', 'icon-180.png'), 180, 180, ['--default-background-color=00000000']);
}
