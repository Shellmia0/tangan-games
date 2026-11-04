// 截发帖用的游戏画面：node review-day/post/capture.js（需要 review-day 在 8766 端口跑着）
// 输出到 review-day/post/shots/。之后 node tools/make-posters.js review-day 合成竖图。
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..', '..');
const out = path.join(__dirname, 'shots');
fs.mkdirSync(out, { recursive: true });
const URL = process.env.URL || 'http://localhost:8766/';
const NAME = '林晚';

function shot(args) {
  execFileSync('node', [path.join(root, 'tools', 'shot.js'), '--mobile', '--scale', '3', ...args], { stdio: 'inherit' });
}
// 直接把存档写成"第 day 天第 idx 张"，刷新后点"继续审核"就到那张
const goto = (day, idx) => `localStorage.setItem('rd_name', ${JSON.stringify(JSON.stringify(NAME))}); localStorage.setItem('rd_tutorialShown','true');
  localStorage.setItem('rd_day','${day}'); localStorage.setItem('rd_idx','${idx}'); localStorage.setItem('rd_bookSeen','${day}');
  localStorage.setItem('rd_history', JSON.stringify({1:[{id:'10231',verdict:'ok',rule:null,correct:true,secs:6.2},{id:'10232',verdict:'no',rule:2,correct:true,secs:8.1},{id:'10233',verdict:'ok',rule:null,correct:true,secs:4.4}],2:[{id:'10314',verdict:'ok',rule:null,correct:true,secs:12.3}],3:[{id:'10405',verdict:'no',rule:5,correct:true,secs:5.0},{id:'10406',verdict:'no',rule:5,correct:true,secs:7.7,replied:false}],4:[{id:'10519',verdict:'no',rule:5,correct:true,secs:3.9},{id:'10520',verdict:'ok',rule:null,correct:true,secs:5.5}]}));
  location.reload(); 'ok'`;
const resume = "RD.fast=true; document.getElementById('btn-start').click(); 'ok'";

shot(['--url', URL, '--shot', path.join(out, 'title.png')]);
shot(['--url', URL, '--js', goto(2, 3), '--wait', '800', '--js', resume, '--wait', '500', '--shot', path.join(out, 'day2-10314.png')]);
shot(['--url', URL, '--js', goto(2, 6), '--wait', '800', '--js', resume, '--wait', '500', '--shot', path.join(out, 'day2-10317.png')]);
shot(['--url', URL, '--js', goto(3, 4), '--wait', '800', '--js', resume, '--wait', '500', '--shot', path.join(out, 'day3-10406.png'),
  '--js', "document.getElementById('btn-book').click(); 'ok'", '--wait', '400', '--shot', path.join(out, 'day3-book.png')]);
shot(['--url', URL, '--js', goto(4, 2), '--wait', '800', '--js', resume, '--wait', '500', '--shot', path.join(out, 'day4-10519.png')]);
shot(['--url', URL, '--js', goto(5, 0), '--wait', '800', '--js', resume, '--wait', '400',
  '--js', "document.getElementById('ov-btn').click(); 'ok'", '--wait', '500',
  '--js', "await (async()=>{ for(let i=0;i<12;i++){ const b=document.getElementById('btn-next'); if(b.disabled) break; b.click(); await new Promise(x=>setTimeout(x,80)); } return 'ok'; })()",
  '--shot', path.join(out, 'day5.png')]);
console.log('截图完成：' + out);
