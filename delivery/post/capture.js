// 截发帖用的游戏画面：node delivery/post/capture.js（需要 delivery 在 8770 端口跑着）
// 输出到 delivery/post/shots/。之后 node tools/make-posters.js delivery 合成竖图。
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..', '..');
const out = path.join(__dirname, 'shots');
fs.mkdirSync(out, { recursive: true });
const URL = process.env.URL || 'http://localhost:8770/';

function shot(args) {
  execFileSync('node', [path.join(root, 'tools', 'shot.js'), '--mobile', '--scale', '3', ...args], { stdio: 'inherit' });
}
const open = "document.getElementById('push-card').click(); 'ok'";
const sl = (ms) => `await new Promise(x=>setTimeout(x,${ms}))`;

shot(['--url', URL, '--shot', path.join(out, 'push.png'), '--js', open, '--wait', '700', '--shot', path.join(out, 'order.png')]);
shot(['--url', URL, '--js', open, '--wait', '400', '--js', "DL.fast=true; DL.jump('gate'); 'ok'", '--wait', '2500',
  '--js', "document.getElementById('btn-chat2').click(); 'ok'", '--wait', '500', '--shot', path.join(out, 'chat-gate.png')]);
shot(['--url', URL, '--js', open, '--wait', '400', '--js', "DL.fast=true; DL.jump('门口'); 'ok'", '--wait', '3000',
  '--js', "document.getElementById('order-scroll').scrollTop=0; 'ok'", '--wait', '300', '--shot', path.join(out, 'order-door.png'),
  // 快速模式下时间线十几秒就走到 01:30 骑手离开，所以跳到门口之后关掉快速模式再聊客服
  '--js', "DL.fast=false; document.getElementById('btn-cs').click(); 'ok'", '--wait', '3500',
  '--js', `await (async()=>{ for(let i=0;i<8;i++){ const bs=[...document.querySelectorAll('#cs-panel button')]; if(!bs.length){ ${sl(1000)}; continue; } if(bs.some(b=>b.textContent.trim()==='好')) return 'ask'; bs[0].click(); ${sl(5000)}; } return 'no ask'; })()`,
  '--js', "document.getElementById('cs-msgs').scrollTop=1e6; 'ok'", '--wait', '400', '--shot', path.join(out, 'cs-door.png')]);
shot(['--url', URL, '--js', open, '--wait', '400', '--js', "DL.fast=true; DL.jump('light'); 'ok'", '--wait', '2500',
  '--js', "document.getElementById('rider-row').click(); 'ok'", '--wait', '500', '--shot', path.join(out, 'profile.png')]);
console.log('截图完成：' + out);
