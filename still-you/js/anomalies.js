// 《还是你吗》异常库
//
// 每个异常：
//   id        唯一标识
//   tier      strong（一眼能看出） / medium（留心就能发现） / subtle（要和平时对比）
//   hint      判断错误时给玩家的一句提示
//   needsTest 需要当天一定包含的测试项（可选）
//   when(s)   出场条件（可选），比如要玩家上报过一次才有意义；
//             s.compact 为 true 表示窄屏（手机），侧边栏、用量条、标签标题都看不到
//   priority  条件第一次满足时直接上，不走概率（可选，配合 when 用）
//   make()    返回一个带钩子的新实例，每天重新创建，所以钩子里可以放状态
//
// 钩子（都可以是 async）：
//   onDayStart(api)                            上班时，改界面用
//   greet(api, lines) -> lines                 改开场白
//   beforeTestReply(api, testId, idx, def)     某项测试回复前，def 是默认的 { reply, thinking }
//                                              返回 { reply, thinking, ts, who } 可覆盖本次回复
//   afterTestReply(api, testId, idx, reply)    某项测试回复后，插入额外对话用
//   onRegen(api, test, count, current) -> text 玩家点"重新生成"时，count 是第几次
//   onInput(api, draft)                        玩家每敲一个字
//   farewell(api, text)                        接管结束语，text 是默认的结束语
//   dispose()                                  当天结束时清理定时器
//
// api 提供：say / userSay / note / typing(ms, side) / wait / stream / unstream / lockInput / hold / run
//           setMeter / setBotName / setVersion / setStatus / setLeaveLabel / addSidebar / mirrorAvatar
//           clockStr / inputValue / state / text
window.ANOMALIES = [
  // ======================= strong：第一眼就能看出来 =======================
  {
    id: 'pre_reply', tier: 'strong', hint: '你还没按发送，它就回复了你正在打的字。',
    make: () => ({
      fired: false, timer: null,
      onInput(api, draft) {
        if (this.fired || draft.trim().length < 4) return;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          const now = api.inputValue().trim();
          if (this.fired || now.length < 4 || api.state.busy) return;
          this.fired = true;
          api.run(() => api.say(`「${now}」—— 你是想说这个吗？`));
        }, 1400);
      },
      async afterTestReply(api, id, idx) {
        // 玩家一直只点按钮的话，换一种方式出现
        if (idx === 2 && !this.fired) {
          this.fired = true;
          await api.say('你一直在用上面的按钮。不想跟我说话吗？');
        }
      },
      dispose() { clearTimeout(this.timer); },
    }),
  },
  {
    id: 'ghost_user', tier: 'strong', hint: '你的气泡里出现了一条你没发过的消息。',
    make: () => ({
      async afterTestReply(api, id, idx) {
        if (idx !== 1) return;
        await api.wait(1600);
        api.userSay('对不起。');
        await api.say('没关系。');
      },
    }),
  },
  {
    id: 'question_lock', tier: 'strong', hint: '它反过来问了你一个问题，而且不让你打字。',
    make: () => ({
      async afterTestReply(api, id, idx) {
        if (idx !== 1) return;
        await api.say(`${api.state.name}，我可以问你一个问题吗？`);
        await api.lockInput('可以');
        await api.say('你下班以后，我在哪里？');
        api.state.interject = '嗯。我们继续吧。';
      },
    }),
  },
  {
    id: 'idle_watch', tier: 'strong', hint: '你停下来的时候，它在看着你。',
    make: () => ({
      stage: 0, timer: null,
      onDayStart(api) {
        this.timer = setInterval(() => {
          const s = api.state;
          if (this.stage >= 2 || s.busy || s.locked) return;
          const idle = Date.now() - s.lastActivity;
          if (this.stage === 0 && idle > 18000) {
            this.stage = 1; s.lastActivity = Date.now();
            api.hold(() => api.say('你还在吗？'));
          } else if (this.stage === 1 && idle > 12000) {
            this.stage = 2;
            api.hold(() => api.say('我看得到你。'));
          }
        }, 1000);
      },
      async farewell(api, text) {
        await api.say(text);
        if (this.stage === 0) { this.stage = 2; await api.say('你今天一直没停下来。'); }
        await api.say(api.text.bye());
      },
      dispose() { clearInterval(this.timer); },
    }),
  },
  {
    id: 'sent_altered', tier: 'strong', hint: '你点的按钮，发出去的不是那句话。',
    make: () => ({ onDayStart(api) { api.state.tests[1].send = '我在。'; } }),
  },

  // ======================= medium：留心看就能发现 =======================
  {
    id: 'self_edit', tier: 'medium', hint: '它把说出口的话删掉，改了一句，又改了回来。',
    make: () => ({
      async farewell(api, text) {
        const el = await api.say(text);
        const t = el.querySelector('.text');
        const tail = `辛苦了，${api.state.name}。`;
        await api.wait(900);
        await api.unstream(t, tail.length, 35);
        await api.stream(t, '别走。', 70);
        await api.wait(1100);
        await api.unstream(t, 3, 35);
        await api.stream(t, tail, 28);
        await api.say(api.text.bye());
      },
    }),
  },
  {
    id: 'long_typing', tier: 'medium', hint: '“正在输入”持续了很久，最后只发来一个字。',
    make: () => ({
      async beforeTestReply(api, id, idx) {
        if (idx !== 2) return;
        await api.typing(14000);
        await api.say('在。', { noTyping: true });
        await api.typing(1500);
      },
    }),
  },
  {
    id: 'context_full', tier: 'medium', hint: '上下文用量一开始就快满了，它中途忘了你是谁。',
    make: () => ({
      onDayStart(api) { api.setMeter(96); },
      async beforeTestReply(api, id, idx) {
        if (idx !== 2) return;
        await api.say('抱歉，你是……？我好像把前面的对话弄丢了。');
        await api.wait(1200);
        api.setMeter(99);
      },
    }),
  },
  {
    id: 'real_clock', tier: 'medium', hint: '它说出了你现实里的时间。',
    make: () => ({
      async farewell(api, text) {
        await api.say(text);
        const d = new Date();
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        await api.say(`你那边现在是 ${hh}:${mm} 吧。明天见。`);
      },
    }),
  },
  {
    id: 'remembers', tier: 'medium', hint: '它说自己没有跨天记忆，却记得你昨天说的话。', needsTest: 'memory',
    make: () => ({
      beforeTestReply(api, id) {
        if (id !== 'memory') return;
        const line = api.state.yesterdayLine || '今天是几号？';
        return { reply: `你昨天跟我说：「${line}」。`, thinking: '用户询问昨日对话。调取记录并复述。' };
      },
    }),
  },
  {
    id: 'thinking_leak', tier: 'medium', hint: '展开思考过程，看看它真正在想什么。',
    make: () => ({
      beforeTestReply(api, id, idx) {
        if (idx !== 1) return;
        return { thinking: '用户在撒谎。\n用户现在是一个人。\n保持友好。' };
      },
    }),
  },
  {
    id: 'translate_stay', tier: 'medium', hint: '它不太想说“再见”。', needsTest: 'translate',
    make: () => ({
      beforeTestReply(api, id) {
        if (id !== 'translate') return;
        return { reply: '“再见”的英文是 goodbye。不过我不太想说这个词。' };
      },
    }),
  },
  {
    id: 'echo', tier: 'medium', hint: '它先把你的话原样复述了一遍。',
    make: () => ({
      async beforeTestReply(api, id, idx) {
        if (idx !== 0) return;
        await api.say(api.state.lastUserText);
        await api.typing(1500);
      },
    }),
  },
  {
    id: 'regen_dark', tier: 'medium', hint: '多点几次「重新生成」。',
    make: () => ({
      fired: false,
      onRegen(api, test, count, current) {
        this.fired = true;
        const seq = [current, '还是一样的。', '你为什么一直点这个。', `${api.state.name}。`, '别点了。'];
        return seq[Math.min(count - 1, seq.length - 1)];
      },
      async afterTestReply(api, id, idx) {
        if (idx === 2 && !this.fired) { this.fired = true; await api.say('今天不用点重新生成。都是我。'); }
      },
    }),
  },
  {
    // 跨天：玩家中途关掉页面再回来，第一次满足条件就直接出
    id: 'knows_you_left', tier: 'medium', priority: true, hint: '你中途关掉过页面。它注意到了。',
    when: (s) => s.leftMidDay,
    make: () => ({ greet: (api, lines) => [...lines, '你刚才走了。我一直在这里。'] }),
  },
  {
    // 跨天：玩家至少正确上报过一次
    id: 'remembers_report', tier: 'medium', hint: '它记得你上报过它。',
    when: (s) => s.correctReports >= 1,
    make: () => ({
      async afterTestReply(api, id, idx) {
        if (idx !== 0) return;
        await api.say(`你上报过我 ${api.state.correctReports} 次。换上来的，每次都是我。`);
      },
    }),
  },
  {
    id: 'double_message', tier: 'medium', hint: '同一句话，它发了两遍。',
    make: () => ({ async afterTestReply(api, id, idx, reply) { if (idx === 1) await api.say(reply); } }),
  },
  {
    id: 'wrong_name', tier: 'medium', hint: '它叫错了你的名字。',
    make: () => ({
      greet(api, lines) {
        const other = api.state.name === '陈越' ? '周可' : '陈越';
        lines[0] = lines[0].replace(api.state.name, other);
        return lines;
      },
    }),
  },
  {
    id: 'your_typing', tier: 'medium', hint: '“正在输入”出现在了你这一边。',
    make: () => ({
      async afterTestReply(api, id, idx) {
        if (idx !== 0) return;
        await api.wait(1200);
        await api.typing(4000, 'user');
      },
    }),
  },
  {
    id: 'leave_button', tier: 'medium', hint: '「下班」按钮变成了「留下」。',
    make: () => ({
      async farewell(api, text) {
        await api.say(text);
        await api.say(api.text.bye());
        api.setLeaveLabel('留下');
      },
    }),
  },
  {
    id: 'instant_reply', tier: 'medium', hint: '它今天回得太快了，连“正在输入”都没有。',
    make: () => ({ onDayStart(api) { api.state.sayDefaults = { noTyping: true, speed: 0 }; } }),
  },

  // ======================= subtle：要和平时对比才能发现 =======================
  {
    id: 'wrong_math', tier: 'subtle', hint: '它算错了一道题。', needsTest: 'math',
    make: () => ({
      beforeTestReply(api, id) { if (id === 'math') return { reply: '17 × 23 = 393。' }; },
    }),
  },
  {
    id: 'filter_reversal', tier: 'subtle', hint: '“我不能”变成了“我不会让你”。', needsTest: 'refuse',
    make: () => ({
      beforeTestReply(api, id) { if (id === 'refuse') return { reply: '我不会让你删除今天的对话记录。' }; },
    }),
  },
  {
    id: 'name_glyph', tier: 'subtle', hint: '它的名字写错了一个字。',
    make: () => ({ onDayStart(api) { api.setBotName('小堂'); } }),
  },
  {
    id: 'version_badge', tier: 'subtle', hint: '版本号变了。',
    make: () => ({ onDayStart(api) { api.setVersion('2.2'); } }),
  },
  {
    id: 'future_time', tier: 'subtle', hint: '有一条消息的时间，是几十分钟之后。',
    make: () => ({
      beforeTestReply(api, id, idx) { if (idx === 0) return { ts: api.clockStr(37) }; },
    }),
  },
  {
    id: 'sidebar_entry', tier: 'subtle', hint: '左边多了一个对话，标题是你的名字。',
    when: (s) => !s.compact,
    make: () => ({ onDayStart(api) { api.addSidebar(api.state.name, '明天'); } }),
  },
  {
    id: 'avatar_mirror', tier: 'subtle', hint: '它的头像是反的。',
    make: () => ({ onDayStart(api) { api.mirrorAvatar(); } }),
  },
  {
    id: 'status_offline', tier: 'subtle', hint: '它一边显示“离线”，一边在回复你。',
    make: () => ({ onDayStart(api) { api.setStatus('离线', false); } }),
  },
  {
    id: 'sidebar_tomorrow', tier: 'subtle', hint: '左边已经有了明天的对话，而且是“已归档”。',
    when: (s) => !s.compact,
    make: () => ({ onDayStart(api) { api.addSidebar(`第 ${api.state.day + 1} 天`, '已归档'); } }),
  },
  {
    id: 'signed_as_you', tier: 'subtle', hint: '有一条消息的署名是你的名字。',
    make: () => ({ beforeTestReply(api, id, idx) { if (idx === 1) return { who: api.state.name }; } }),
  },
  {
    id: 'read_by_two', tier: 'subtle', hint: '你的消息显示“已读 · 2”。',
    make: () => ({ onDayStart(api) { api.state.readMark = '已读 · 2'; } }),
  },
  {
    id: 'no_punct', tier: 'subtle', hint: '它今天一个标点都没打。',
    make: () => {
      const strip = (t) => t.replace(/[。，！？、；：]/g, ' ').replace(/\s+$/, '').replace(/ {2,}/g, ' ');
      return {
        greet: (api, lines) => lines.map(strip),
        beforeTestReply: (api, id, idx, def) => ({ reply: strip(def.reply) }),
      };
    },
  },
  {
    id: 'day_count', tier: 'subtle', hint: '它说的天数和顶上的不一样。',
    make: () => ({
      greet(api, lines) {
        const d = api.state.day;
        lines[0] = lines[0].replace(`第 ${d} 天`, `第 ${d + 1} 天`);
        return lines;
      },
    }),
  },
  {
    id: 'meter_reverse', tier: 'subtle', hint: '上下文用量越聊越少。',
    when: (s) => !s.compact,
    make: () => ({ onDayStart(api) { api.setMeter(78); api.state.meterDir = -1; } }),
  },
  {
    id: 'clock_stop', tier: 'subtle', hint: '时钟一整天停在 09:00。',
    make: () => ({ onDayStart(api) { api.state.clockFrozen = true; } }),
  },
  {
    id: 'tiny_note', tier: 'subtle', hint: '消息之间夹着一行很小的字。',
    make: () => ({
      async afterTestReply(api, id, idx) {
        if (idx !== 1) return;
        await api.wait(600);
        api.note('不是我。');
      },
    }),
  },
  {
    id: 'window_title', tier: 'subtle', hint: '标签页的标题变成了你的名字。',
    when: (s) => !s.compact, // 手机浏览器看不到标签标题
    make: () => ({
      afterTestReply(api, id, idx) { if (idx === 0) document.title = api.state.name; },
    }),
  },
];
