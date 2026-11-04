// 用真实截图合成发帖竖图：node tools/make-posters.js <游戏目录>
// 读 <游戏目录>/post/posters.json：
//   [{ "name": "01-cover", "tag": "...", "head": "...", "sub": "...", "foot": "...", "img": "shots/1.png", "pos": "top|bottom", "big": true }]
// img 相对于 <游戏目录>/post/。输出到 <游戏目录>/post/img/<name>.png（1242×1656）。
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const game = process.argv[2];
if (!game) { console.error('用法：node tools/make-posters.js <游戏目录>'); process.exit(1); }
const root = path.resolve(__dirname, '..', game);
const postDir = path.join(root, 'post');
const spec = JSON.parse(fs.readFileSync(path.join(postDir, 'posters.json'), 'utf8'));
const outDir = path.join(postDir, 'img');
const profile = path.join(os.tmpdir(), 'tangan-poster-profile');

const browser = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));
if (!browser) { console.error('没找到 Chrome 或 Edge'); process.exit(1); }

const fileUrl = (p) => 'file:///' + p.replace(/\\/g, '/');
fs.mkdirSync(outDir, { recursive: true });
for (const p of spec) {
  const q = new URLSearchParams();
  for (const k of ['tag', 'head', 'sub', 'foot', 'pos', 'h']) if (p[k]) q.set(k, p[k]);
  if (p.big) q.set('big', '1');
  q.set('img', fileUrl(path.resolve(postDir, p.img)));
  const url = fileUrl(path.join(__dirname, 'poster.html')) + '?' + q.toString();
  const out = path.join(outDir, p.name + '.png');
  execFileSync(browser, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--allow-file-access-from-files', `--user-data-dir=${profile}`, '--force-device-scale-factor=1',
    '--window-size=1242,1656', '--virtual-time-budget=2000', `--screenshot=${out}`, url,
  ], { stdio: 'ignore' });
  console.log('写入 ' + path.relative(path.join(__dirname, '..'), out));
}
