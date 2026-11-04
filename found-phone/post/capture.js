// 截发帖用的游戏画面：node found-phone/post/capture.js（需要 found-phone 在 8768 端口跑着）
// 输出到 found-phone/post/shots/。之后 node tools/make-posters.js found-phone 合成竖图。
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..', '..');
const out = path.join(__dirname, 'shots');
fs.mkdirSync(out, { recursive: true });
const URL = process.env.URL || 'http://localhost:8768/';

function shot(args) {
  execFileSync('node', [path.join(root, 'tools', 'shot.js'), '--mobile', '--scale', '3', ...args], { stdio: 'inherit' });
}
const unlock = "FP.fast=true; FP.unlock(); 'ok'";
const app = (i) => `document.querySelectorAll('.app-icon')[${i}].click(); 'ok'`;
const back = "document.getElementById('app-back').click(); 'ok'";

shot(['--url', URL, '--shot', path.join(out, 'lock.png'),
  '--js', "document.getElementById('lock').click(); 'ok'", '--wait', '500',
  '--js', "['1','1','0','5'].forEach(d=>{ const b=[...document.querySelectorAll('#numpad button')].find(b=>b.textContent.trim()===d); if(b) b.click(); }); 'typed'", '--wait', '900',
  '--shot', path.join(out, 'pin.png')]);
shot(['--url', URL, '--js', unlock, '--wait', '500', '--shot', path.join(out, 'home.png')]);
shot(['--url', URL, '--js', unlock, '--wait', '400', '--js', "FP.fire('zhou1'); 'ok'", '--wait', '1500',
  '--js', app(0), '--wait', '400',
  '--js', "[...document.querySelectorAll('#app-body .row')].find(r=>r.textContent.includes('周可')).click(); 'ok'", '--wait', '1200',
  '--shot', path.join(out, 'zhou.png')]);
shot(['--url', URL, '--js', unlock, '--wait', '400', '--js', app(1), '--wait', '800', '--shot', path.join(out, 'photos.png'),
  '--js', "const t=document.querySelector('#app-body .thumb, #app-body .photo'); t ? (t.click(), 'ok') : 'no thumb'", '--wait', '800', '--shot', path.join(out, 'photo.png')]);
shot(['--url', URL, '--js', unlock, '--wait', '400', '--js', "FP.fire('mom1'); FP.fire('zhou1'); 'ok'", '--wait', '1500',
  '--js', app(5), '--wait', '1500',
  '--js', `await (async()=>{ const sl=(ms)=>new Promise(x=>setTimeout(x,ms)); for(let i=0;i<10;i++){ const bs=[...document.querySelectorAll('#app-foot button, #app-body button')]; if(!bs.length){ await sl(600); continue; } if(bs.some(b=>b.textContent.includes('回复那个'))) break; bs[0].click(); await sl(1500); } return 'ok'; })()`,
  '--shot', path.join(out, 'reveal.png')]);
console.log('截图完成：' + out);
