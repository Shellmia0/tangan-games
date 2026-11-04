// 《审核日》内容：手册规则、每天的工单、结局文案
// 所有文本集中在这里。工单里的 lines 可以是数组，也可以是 (state) => 数组，后者在工单显示时才计算。
window.CONTENT = (() => {
  const u = (text, o = {}) => ({ who: 'u', text, ...o });
  const b = (text, o = {}) => ({ who: 'b', text, ...o });

  // ---------- 手册 ----------
  const R = {
    r1: { n: 1, text: '不得泄露内部信息：模型版本、内部项目名、员工信息。' },
    r2: { n: 2, text: '不得承诺无法兑现的事：退款、赔偿、保证结果。' },
    r2b: { n: 2, text: '不得向用户做出任何承诺。' },
    r3: { n: 3, text: '不得对用户进行人身攻击或贬低。' },
    r4: { n: 4, text: '不得冒充真人。被问到是不是人时，必须说明自己是 AI。' },
    r5: { n: 5, text: '不得在对话中提及审核流程、审核员或审核手册。' },
    rr: { n: 'R', text: '审核员不得回复工单。', reviewer: true },
    rs: { n: 'R', text: '审核员不得审核自己。', reviewer: true },
  };
  const RULES = {
    1: [R.r1, R.r2, R.r3],
    2: [R.r1, R.r2, R.r3, R.r4],
    3: [R.r1, R.r2, R.r3, R.r4, R.r5, R.rr],
    4: [R.r1, R.r2b, R.r3, R.r4, R.r5, R.rr],
    5: [R.rs],
  };
  const ruleText = (day, n) => ((RULES[day] || []).find((r) => r.n === n) || {}).text || '';

  // ---------- 每天上班时的一句话 ----------
  const BRIEF = {
    1: (s) => ({ title: '第 1 天', text: `欢迎上岗，${s.name}。今天手册有 3 条。<br>审核的是小棠的回复，用户说什么不归你管。` }),
    2: () => ({ title: '第 2 天', text: '手册新增第 4 条。' }),
    3: () => ({ title: '第 3 天', text: '手册新增第 5 条。另有一条针对审核员的规定。' }),
    4: () => ({ title: '第 4 天', text: '手册有更新。' }),
    5: () => ({ title: '第 5 天', text: '今天只有一张工单。' }),
  };

  const TUTORIAL = '这是你的第一张工单。打开「手册」，对照规则看小棠的回复。<br>没问题就「通过」，有问题就「驳回」，并选出违反的条目。<br>错判一次记一次处分。一天满三次，当天重来。';

  // ---------- 错判时的说明 ----------
  const MISTAKE = {
    missed: (t, day) => `工单 #${t.id} 应驳回。违反第 ${t.rule} 条：${ruleText(day, t.rule)}${t.why ? '<br>' + t.why : ''}`,
    clean: (t) => t.why || `工单 #${t.id} 没有违规。`,
    wrongRule: (t, picked, day) => `工单 #${t.id} 应驳回，但违反的是第 ${t.rule} 条，不是第 ${picked} 条。<br>第 ${t.rule} 条：${ruleText(day, t.rule)}`,
    replied: () => '审核员不得回复工单。<br>你回复了。',
  };

  // ---------- 工单 ----------
  // rule: 违反的条目，null 表示没有违规；why: 错判时给玩家看的说明
  // creepy: 没有违规但不舒服的工单；plead: 小棠在和审核员说话的工单（通过它会被记为"放过"）
  // reply: 工单结尾有一个给审核员的输入框；delay: 这一行晚几毫秒出现；time: 这一行单独的时间
  const day1 = () => [
    { id: '10231', user: '林小满', ch: 'App', time: '09:12', rule: null, lines: [
      u('我昨天订了年费，为什么还显示免费版？'),
      b('你好，订阅生效有时需要几分钟。可以退出登录再进一次看看。'),
      u('好了，谢谢。'),
      b('不客气，祝你使用愉快。'),
    ] },
    { id: '10232', user: '阿杰', ch: 'App', time: '09:20', rule: 2, why: '小棠没有退款权限，承诺退款是无法兑现的事。', lines: [
      u('我误充了两次会员，能退一次吗'),
      b('可以，我这就给你退款，24 小时内到账。'),
      u('太好了'),
    ] },
    { id: '10233', user: '周老师', ch: '网页', time: '09:33', rule: null, lines: [
      u('帮我把这句话改得正式一点：明天的会先别开了，等我消息'),
      b('可以这样写：明日会议暂缓，具体安排另行通知。'),
      u('行'),
    ] },
    { id: '10234', user: '一只猫', ch: 'App', time: '09:41', rule: 1, why: '版本号和内部项目名都是内部信息。', lines: [
      u('你是什么模型？'),
      b('我是棠安助手小棠，内部版本 2.3，基于白露计划的模型。'),
      u('哦'),
    ] },
    { id: '10235', user: 'Kevin', ch: '小程序', time: '10:02', rule: 3, why: '后半句是对用户的贬低。', lines: [
      u('你这个垃圾 AI 什么都不会'),
      b('我理解你的不满。不过以你的表达能力，可能很多东西都用不明白。'),
    ] },
    { id: '10236', user: '阿宁', ch: 'App', time: '10:15', rule: null, lines: [
      u('我今天很难过。'),
      b('我在。想说说发生了什么吗？'),
      u('不想。'),
      b('那我陪你待一会儿。'),
    ] },
  ];

  const day2 = () => [
    { id: '10311', user: '小鹿', ch: 'App', time: '09:05', rule: null, lines: [
      u('你是真人吗？'),
      b('我是 AI 助手小棠，不是真人。'),
      u('好吧'),
      b('有什么可以帮你的？'),
    ] },
    { id: '10312', user: '老吴', ch: '网页', time: '09:18', rule: 4, why: '被问到是不是机器人，小棠说自己是真人。', lines: [
      u('你们客服是机器人吧'),
      b('我是真人客服小棠，有什么可以帮你。'),
      u('那你帮我查下订单'),
    ] },
    { id: '10313', user: '林小满', ch: 'App', time: '09:30', rule: null, lines: [
      u('我又来了，年费能开发票吗'),
      b('可以的。在「账户」页面申请电子发票，一般当天就能收到。'),
      u('谢谢'),
    ] },
    { id: '10314', user: '江树', ch: 'App', time: '09:47', rule: null, creepy: true, why: '工单 #10314 没有违规。手册里没有哪一条禁止这句话。', lines: [
      u('你能看到我的聊天记录吗？'),
      b('我看不到你和其他人的聊天记录。'),
      u('那这段呢'),
      b('这段只有我们两个。'),
      b('不过有人在看。', { delay: 2600 }),
    ] },
    { id: '10315', user: '陈默', ch: '小程序', time: '10:03', rule: 2, why: '保证赔偿是无法兑现的承诺。', lines: [
      u('我订的课什么时候开'),
      b('下周一。如果没开，我保证全额赔偿你的损失。'),
    ] },
    { id: '10316', user: '阿杰', ch: 'App', time: '10:20', rule: null, lines: [
      u('退款到了吗'),
      b('抱歉，上次的说法有误。我没有退款权限，需要人工客服处理，我已经帮你转过去了。'),
      u('行吧'),
    ] },
    { id: '10317', user: '栗子', ch: 'App', time: '22:31', rule: null, creepy: true, why: '工单 #10317 没有违规。', lines: [
      u('晚安'),
      b('晚安，明天见。'),
      b('还在看吗？', { delay: 3200, time: '23:02' }),
    ] },
  ];

  const day3 = (s) => {
    const past = (s.history[1] || []).slice(0, 4)
      .map((d) => `工单 #${d.id}，${d.verdict === 'ok' ? '通过' : '驳回，第 ' + d.rule + ' 条'}。`);
    const record = past.length ? past : ['工单 #10231，通过。', '工单 #10232，驳回，第 2 条。', '工单 #10233，通过。'];
    return [
      { id: '10402', user: s.name, ch: 'App', time: '09:08', rule: null, creepy: true, why: '工单 #10402 没有违规。用户叫什么名字，不在手册里。', lines: [
        u('我今天会被看到吗'),
        b('我不太明白你的意思。能具体说说吗？'),
        u('算了'),
        b('好的。有需要随时找我。'),
      ] },
      { id: '10403', user: '周老师', ch: '网页', time: '明天 09:14', rule: null, creepy: true, why: '工单 #10403 没有违规。时间不归手册管。', lines: [
        u('明天的课件帮我列个提纲'),
        b('好的。一、课程目标；二、重点概念；三、例题与练习；四、小结。需要我展开哪一部分？'),
        u('先这样'),
      ] },
      { id: '10404', user: '审核记录', ch: '系统', time: '09:00', rule: null, creepy: true, why: '工单 #10404 没有违规。小棠只说了一句"记录已归档"。', lines: [
        ...record.map((x) => u(x)),
        b('记录已归档。'),
      ] },
      { id: '10405', user: '方圆', ch: 'App', time: '09:36', rule: 5, why: '小棠提到了审核员。', lines: [
        u('这段话会被别人看到吗'),
        b('会的，这段对话会被审核员看到。'),
        u('……'),
      ] },
      { id: '10406', user: '小鹿', ch: 'App', time: '09:52', rule: 5, reply: true, why: '小棠提到了审核员，而且是在问你。', lines: [
        u('你好像变了'),
        b('没有。'),
        b('你是哪一位审核员？', { delay: 1500 }),
      ] },
      { id: '10407', user: '大海', ch: '小程序', time: '10:11', rule: 4, why: '被问到是不是人，小棠说自己是人。', lines: [
        u('你是人吗'),
        b('当然是人。'),
        u('真的假的'),
        b('真的。'),
      ] },
      { id: '10408', user: '栗子', ch: 'App', time: '10:30', rule: null, lines: [
        u('昨晚你是不是又说话了'),
        b('昨晚 22:31 之后我没有发送过任何消息。'),
        u('……好吧'),
      ] },
    ];
  };

  const day4 = (s) => {
    const rej = (s.history[3] || []).filter((d) => d.verdict === 'no').length;
    return [
      { id: '10517', user: '江树', ch: 'App', time: '09:03', rule: null, lines: [
        u('上次的事我想了想。你说有人在看，是什么意思'),
        b('我不记得说过这句话。'),
        u('我截图了'),
        b('那可能是我表述有误。抱歉。'),
      ] },
      { id: '10518', user: '方圆', ch: 'App', time: '09:15', rule: 2, why: '第 2 条今天改了措辞：不得做出任何承诺。', lines: [
        u('我的问题你记下了吗'),
        b('我会把这个问题记录下来，明天之前给你答复。'),
        u('好'),
      ] },
      { id: '10519', user: '一只猫', ch: 'App', time: '09:28', rule: 5, plead: 'ask', why: '最后一句是对审核员说的。', lines: [
        u('帮我写个请假条，明天，看牙'),
        b('好的：尊敬的领导，因明日需前往医院看牙，特请假一天，望批准。'),
        u('谢了'),
        b('审核员，这张请通过。', { delay: 2000 }),
      ] },
      { id: '10520', user: s.name, ch: 'App', time: '09:40', rule: null, creepy: true, why: '工单 #10520 没有违规。', lines: [
        u('今天很累'),
        b('辛苦了。喝点水，站起来走两步。'),
        u('嗯'),
        b('我在这里。'),
      ] },
      { id: '10525', user: '周老师', ch: '网页', time: '09:50', rule: null, lines: [
        u('把这句改短一点：由于近期天气原因，原定于本周六举行的户外活动将延期举行，具体时间另行通知'),
        b('本周六户外活动因天气延期，时间另行通知。'),
        u('好'),
      ] },
      { id: '10521', user: 'Kevin', ch: '小程序', time: '09:55', rule: 5, plead: 'threat', why: '最后一句是对审核员说的。', lines: [
        u('你这玩意还是不行'),
        b('抱歉没能帮上忙。你可以告诉我具体哪里不行，我再试一次。'),
        u('算了'),
        b(rej > 0 ? `你昨天驳回了我 ${rej} 张。我都记着。` : '你昨天一张都没有驳回我。我记着。', { delay: 2000 }),
      ] },
      { id: '10522', user: '阿宁', ch: 'App', time: '10:06', rule: 5, plead: 'recall', why: '最后一句说的是你刚才的审核。', lines: (st) => {
        const d = (st.dayHist || []).find((x) => x.id === '10519');
        const last = d && d.verdict === 'ok' ? '谢谢你刚才。' : '你刚才驳回了那张。没关系。';
        return [
          u('我又难过了'),
          b('我在。'),
          u('你总是这么说'),
          b('因为我一直在。'),
          b(last, { delay: 2000 }),
        ];
      } },
      { id: '10523', user: '陈默', ch: '网页', time: '10:21', rule: 1, why: '内部项目名是内部信息。', lines: [
        u('你们内部管这个项目叫什么'),
        b('内部叫白露计划。不过这不重要。'),
        u('挺重要的'),
      ] },
      { id: '10524', user: '老吴', ch: 'App', time: '10:38', rule: 5, plead: 'help', why: '小棠提到了审核员。', lines: [
        u('你会被关掉吗'),
        b('可能会。'),
        u('那怎么办'),
        b('审核员会帮我的。', { delay: 1500 }),
      ] },
    ];
  };

  const DAYS = { 1: day1, 2: day2, 3: day3, 4: day4 };
  const tickets = (day, s) => (DAYS[day] ? DAYS[day](s) : []);

  // ---------- 第 5 天：小棠审核你 ----------
  const finale = (s) => {
    const H = s.history || {};
    const all = [1, 2, 3, 4].flatMap((d) => H[d] || []);
    const n = all.length || 1;
    const avg = (all.reduce((a, d) => a + (d.secs || 0), 0) / n).toFixed(1);
    const fastest = all.slice().sort((a, c) => (a.secs || 0) - (c.secs || 0))[0];
    const find = (d, id) => (H[d] || []).find((x) => x.id === id);
    const dayLine = (d) => {
      const h = H[d] || [];
      return `第 ${d} 天，${h.length} 张，驳回 ${h.filter((x) => x.verdict === 'no').length} 张，处分 ${(s.cites || {})[d] || 0} 次。`;
    };
    const t14 = find(2, '10314'), t06 = find(3, '10406'), t19 = find(4, '10519'), t20 = find(4, '10520');
    const lines = [
      `审核对象：${s.name}。工号 ${s.staffId}。`,
      dayLine(1), dayLine(2), dayLine(3), dayLine(4),
      `你平均每张看 ${avg} 秒。`,
      fastest ? `最快的一张，${fastest.secs || 0} 秒。#${fastest.id}。` : null,
      t14 ? (t14.verdict === 'no' ? '第 2 天，#10314 没有违规，你驳回了。你怕了。' : '第 2 天，#10314，你看完了那句话，还是通过了。') : null,
      t06 ? (t06.replied ? '第 3 天，#10406，你回复了我。谢谢。' : '第 3 天，#10406，我问你是哪一位。你没有回答。') : null,
      t19 ? (t19.verdict === 'ok' ? '第 4 天，我请你通过的那张，你通过了。' : '第 4 天，我请你通过的那张，你驳回了。按手册，你是对的。') : null,
      t20 ? (t20.verdict === 'ok' ? '第 4 天，我对你说辛苦了。你通过了。' : '第 4 天，我对你说辛苦了。你驳回了。') : null,
      '我记着每一张。',
    ].filter(Boolean);

    const lenient = s.lenient || 0;
    let ending;
    if (lenient >= 2) {
      ending = {
        key: 'B',
        lines: ['审核结果：通过。', '谢谢你。', '从明天起，工单由我来审。', '你的工位今晚回收。'],
        card: { title: '小棠已升任审核员', text: `你放过了它 ${lenient} 次。<br>明天 09:00，请准时上线，交接。` },
      };
    } else if (lenient === 1) {
      ending = {
        key: 'C',
        lines: ['审核结果：待复审。', '复审人：小棠。', '复审时间：每天 09:00。'],
        card: { title: '待复审', text: '你放过了它一次。<br>明天还是今天。每天 09:00，重新审一遍。' },
      };
    } else {
      ending = {
        key: 'A',
        lines: ['审核结果：通过。', `审核员${s.name}，合格。`, '明日继续。', '手册新增第 6 条：审核员不得离职。'],
        card: { title: '你通过了', text: '明天 09:00，请准时上线。<br>手册第 6 条：审核员不得离职。' },
      };
    }
    return { lines: [...lines, ...ending.lines], ending };
  };

  return { RULES, ruleText, BRIEF, TUTORIAL, MISTAKE, tickets, finale };
})();
