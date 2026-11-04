// 截发帖用的游戏画面：node still-online/post/capture.js（需要 still-online 在 8767 端口跑着）
// 输出到 still-online/post/shots/。之后 node tools/make-posters.js still-online 合成竖图。
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..', '..');
const out = path.join(__dirname, 'shots');
fs.mkdirSync(out, { recursive: true });
const URL = process.env.URL || 'http://localhost:8767/';

// 一直点"像她"和第 idx 个选项，直到页面出现 stop 这句话
const until = (stop, idx = 0) => `await (async()=>{ const sl=(ms)=>new Promise(x=>setTimeout(x,ms));
  for(let i=0;i<120;i++){ if(document.body.innerText.includes(${JSON.stringify(stop)})) break;
    const r=document.querySelector('.rate:not(.done) button[data-k=like]'); if(r){r.click(); await sl(50); continue;}
    const c=document.querySelectorAll('.choice'); if(c.length){ c[Math.min(${idx}, c.length-1)].click(); await sl(50); continue;}
    const ov=document.getElementById('overlay'); if(!ov.classList.contains('hidden')){ document.getElementById('ov-btn').click(); await sl(150); continue;}
    await sl(50);} document.getElementById('msgs').scrollTop=1e6; return 'ok'; })()`;
const openLogs = `document.querySelectorAll('details.log').forEach(d=>d.open=true); document.getElementById('msgs').scrollTop=1e6; 'ok'`;

function shot(args) {
  execFileSync('node', [path.join(root, 'tools', 'shot.js'), '--mobile', '--scale', '3', ...args], { stdio: 'inherit' });
}

shot(['--url', URL, '--shot', path.join(out, 'title.png')]);
shot(['--url', URL,
  '--js', "SO.fast=true; document.getElementById('btn-start').click(); 'ok'", '--wait', '300',
  '--js', until('记得多喝热水', 2), '--wait', '200', '--shot', path.join(out, 'night1-rate.png'),
  '--js', until('晚安 满满', 0), '--wait', '200', '--shot', path.join(out, 'night1-end.png'),
]);
shot(['--url', URL,
  '--js', "SO.fast=true; SO.jump(2); 'ok'", '--wait', '300',
  '--js', until('这事别跟你爸说', 0), '--js', openLogs, '--wait', '200', '--shot', path.join(out, 'night2.png'),
]);
shot(['--url', URL,
  '--js', "SO.fast=true; SO.jump(3); 'ok'", '--wait', '300',
  '--js', until('我听见了', 1), '--js', openLogs, '--wait', '200', '--shot', path.join(out, 'night3.png'),
]);
shot(['--url', URL,
  '--js', "SO.fast=true; SO.jump(4); 'ok'", '--wait', '300',
  '--js', until('请选择：续费', 1), '--wait', '200', '--shot', path.join(out, 'night4.png'),
  '--js', until('对方已不在线', 2), '--wait', '200', '--shot', path.join(out, 'ending.png'),
]);
console.log('截图完成：' + out);
