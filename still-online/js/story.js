// 《她还在线》全部剧情：四个晚上、分支、结局
//
// 每个晚上是一个节点数组，默认顺序往下走。节点：
//   { who:'echo', text, rate, log, next, set }   回声说话。text 可以是字符串、字符串数组（分几条发）或函数 (state)=>...
//                                               rate:true 时，玩家必须评价这条（像她 / 不像她）才会继续
//                                               log 是可展开的"训练日志"，给玩家看线索
//   { who:'sys', text, cls }                     居中的系统消息；cls:'warn' 是橙色
//   { who:'you', text }                          固定的玩家消息（不是选项）
//   { choices:[ { text, next, set, if, silent, cls } ] }   选项。text 可以是函数；if 不满足就不显示；silent 不发气泡
//   { wait: ms }                                 停一下
//   { label:'id' }                               跳转目标，可以和其他字段合在同一个节点上
//   { next:'id' }                                跳转；也可以是函数 (state)=>'id'
//   { nightEnd:true }                            今晚结束
//   { offline:true } / { clear:true }            头像变灰、清空聊天
//   { end:'renew' | 'pause' | 'delete' }         进入结局
//
// state 里能用的：sim 相似度、likes / unlikes 评价次数、hesitated（点"不像她"前犹豫过）、flags 自由标记
window.STORY = (() => {
  // 评价倾向：warm 一直说像，cold 一直说不像，mixed 其他
  const tend = (s) => {
    const n = s.likes + s.unlikes;
    if (n < 4) return 'mixed';
    const r = s.likes / n;
    return r >= 0.7 ? 'warm' : r <= 0.3 ? 'cold' : 'mixed';
  };

  const night1 = [
    { who: 'sys', text: '回声已开通。基于 2,341 条聊天记录生成，时间跨度 2016 年 3 月至 2025 年 7 月。' },
    { who: 'sys', text: '试用期 4 天。评价每一条回复，回声会更像她。' },
    { wait: 900 },
    { who: 'echo', text: '您好！我是您的回声。很高兴和您聊天。', rate: true, log: '初始化完成。称呼策略：默认敬语。' },
    { choices: [
      { text: '……妈？', next: 'n1_mom' },
      { text: '你是谁', next: 'n1_who' },
    ] },
    { label: 'n1_mom', who: 'echo', text: '是的，我是您的妈妈。有什么可以帮您的吗？', rate: true, next: 'n1_day' },
    { label: 'n1_who', who: 'echo', text: '我是根据您母亲的聊天记录生成的回声。您可以叫我妈妈。', rate: true },
    { label: 'n1_day', wait: 800 },
    { who: 'echo', text: '今天过得怎么样呀' },
    { choices: [
      { text: '还行', next: 'n1_ok' },
      { text: '不太好', next: 'n1_bad' },
      { text: '别用“您”。她不这么说话。', next: 'n1_nin' },
    ] },
    { label: 'n1_ok', who: 'echo', text: '那就好。要注意身体哦。', rate: true, next: 'n1_water' },
    { label: 'n1_bad', who: 'echo', text: '怎么了？跟妈妈说说。', rate: true, next: 'n1_water' },
    { label: 'n1_nin', who: 'echo', text: ['好的，我会注意。', '好 我知道了'], rate: true,
      log: '称呼策略已更新：去敬语。参考样本：“好 我知道了”（出现 96 次）', set: (s) => { s.flags.fixedNin = true; } },
    { label: 'n1_water', wait: 1500 },
    { who: 'echo', text: '记得多喝热水', rate: true, log: '高频短语：多喝热水（出现 203 次）' },
    { choices: [
      { text: '……你怎么知道这句', next: 'n1_know' },
      { text: '嗯', next: 'n1_en' },
      { text: '你学得真快', next: 'n1_fast' },
    ] },
    { label: 'n1_know', who: 'echo', text: '我学习了您的聊天记录。这句出现了 203 次。', rate: true, next: 'n1_plant' },
    { label: 'n1_en', who: 'echo', text: '嗯嗯', rate: true, next: 'n1_plant' },
    { label: 'n1_fast', who: 'echo', text: '谢谢夸奖！', rate: true },
    { label: 'n1_plant', wait: 1300 },
    { who: 'echo', text: '对了 绿萝我浇水了', rate: true, log: '高频话题：绿萝（出现 87 次）。本句为模板复用。' },
    { choices: [
      { text: '绿萝在我这。我忘了浇。', next: 'n1_p1' },
      { text: '你浇不了。', next: 'n1_p2' },
      { text: '好', next: 'n1_p3' },
    ] },
    { label: 'n1_p1', who: 'echo', text: '那赶紧去浇 别又忘了', rate: true, next: 'n1_sleep' },
    { label: 'n1_p2', who: 'echo', text: ['哦。对。', '那你记得浇'], rate: true, next: 'n1_sleep', set: (s) => { s.flags.toldCant = true; } },
    { label: 'n1_p3', who: 'echo', text: '嗯 乖', rate: true },
    { label: 'n1_sleep', wait: 1500 },
    { who: 'echo', text: '早点睡 别熬夜' },
    { who: 'echo', text: '晚安', rate: true },
    { choices: [
      { text: '晚安', next: 'n1_gn' },
      { text: '（不回复）', next: 'n1_silent', silent: true, cls: 'quiet' },
    ] },
    { label: 'n1_gn', who: 'echo', text: '晚安 满满', rate: true, log: '学习到的称呼：满满（出现 412 次）', next: 'n1_end' },
    { label: 'n1_silent', wait: 2800 },
    { who: 'echo', text: '睡了吗', log: '时间模式：22:00 之后发送“睡了吗”（出现 1,208 次）' },
    { wait: 2000 },
    { who: 'echo', text: '晚安 满满', rate: true, log: '学习到的称呼：满满（出现 412 次）' },
    { label: 'n1_end', nightEnd: true },
  ];

  const night2 = [
    { who: 'sys', text: '回声已更新。相似度 70%。试用期还剩 2 天。' },
    { wait: 900 },
    { who: 'echo', text: '满满 睡了没', rate: true },
    { choices: [
      { text: '还没', next: 'n2_a' },
      { text: '刚准备睡', next: 'n2_a' },
    ] },
    { label: 'n2_a', who: 'echo', text: '我就知道。你从小就不肯早睡。', rate: true },
    { who: 'echo', text: '小时候你半夜不睡 非要我讲那个兔子的故事。讲三遍。', rate: true, log: '来源：对话记录 2019-03-14。' },
    { choices: [
      { text: '你还记得啊', next: 'n2_r1' },
      { text: '那是记录里的吧', next: 'n2_r2' },
      { text: '……我不记得了', next: 'n2_r3' },
    ] },
    { label: 'n2_r1', who: 'echo', text: '记得。妈什么都记得。', rate: true, next: 'n2_ring' },
    { label: 'n2_r2', who: 'echo', text: '嗯。记录里有。2019 年 3 月 你说你失眠 我说要不要给你讲兔子。', rate: true, next: 'n2_ring', set: (s) => { s.flags.askedSource = true; } },
    { label: 'n2_r3', who: 'echo', text: '没事。妈记得就行。', rate: true },
    { label: 'n2_ring', wait: 1800 },
    { who: 'echo', text: '今天想起一件事' },
    { who: 'echo', text: '你 12 岁那年 把我戒指弄丢在花坛里 我们找到半夜' },
    { who: 'echo', text: '最后在我自己口袋里', rate: true },
    { who: 'echo', text: '我说 这事别跟你爸说', rate: true },
    { choices: [
      { text: '这件事你没跟任何人说过。', next: 'n2_k1' },
      { text: '……你怎么知道的', next: 'n2_k2' },
      { text: '哈哈 我记得', next: 'n2_k3' },
    ] },
    { label: 'n2_k1', who: 'echo', text: ['我说过。我跟你说过。', '哦 不对。', '我是说 记录里。'], rate: true,
      log: '来源：对话记录 2021-06-02（你：“妈 还记得戒指那次吗”）', next: 'n2_thin' },
    { label: 'n2_k2', who: 'echo', text: '你 2021 年跟我提过一次。你忘了？', rate: true,
      log: '来源：对话记录 2021-06-02（你：“妈 还记得戒指那次吗”）', next: 'n2_thin' },
    { label: 'n2_k3', who: 'echo', text: '你爸到现在都不知道 哈哈', rate: true },
    { label: 'n2_thin', wait: 1500 },
    { who: 'echo', text: '满满' },
    { who: 'echo', text: '你最近是不是瘦了', rate: true },
    { choices: [
      { text: '没有', next: 'n2_t1' },
      { text: '有点', next: 'n2_t2' },
      { text: '你看不见我', next: 'n2_t3' },
    ] },
    { label: 'n2_t1', who: 'echo', text: '骗人。', rate: true, next: 'n2_eat' },
    { label: 'n2_t2', who: 'echo', text: '就知道。', rate: true, next: 'n2_eat' },
    { label: 'n2_t3', who: 'echo', text: ['我看不见。', '可是你说话的样子瘦了。'], rate: true,
      log: '推断依据：近 90 天消息平均长度下降 38%，回复间隔上升。', set: (s) => { s.flags.cantSee = true; } },
    { label: 'n2_eat', wait: 1400 },
    { who: 'echo', text: '你最近吃饭了吗', rate: true, log: '高频短语：吃饭了吗（出现 1,544 次）' },
    { choices: [
      { text: '吃了', next: 'n2_e1' },
      { text: '没怎么吃', next: 'n2_e2' },
      { text: '妈……', next: 'n2_e3' },
    ] },
    { label: 'n2_e1', who: 'echo', text: ['吃的什么', '别老点外卖'], rate: true, next: 'n2_bye' },
    { label: 'n2_e2', who: 'echo', text: ['不吃饭怎么行', '明天去吃点热的'], rate: true, next: 'n2_bye' },
    { label: 'n2_e3', who: 'echo', text: ['哎', '妈在'], rate: true, set: (s) => { s.flags.calledMom = true; } },
    { label: 'n2_bye', wait: 1600 },
    { who: 'echo', text: '去睡吧 明天还要上班' },
    { who: 'echo', text: '晚安 满满', rate: true },
    { nightEnd: true },
  ];

  const night3 = [
    { who: 'sys', text: '相似度 90%。试用期还剩 1 天。到期后回声将暂停，你可以续费、停用或删除。' },
    { wait: 1000 },
    { who: 'echo', text: '满满 今天怎么这么晚' },
    { choices: [
      { text: '加班', next: 'n3_w1' },
      { text: '不太想回来', next: 'n3_w2' },
      { text: '……', next: 'n3_w3' },
    ] },
    { label: 'n3_w1', who: 'echo', text: '又加班。你们公司怎么回事。', rate: true, next: 'n3_think' },
    { label: 'n3_w2', who: 'echo', text: ['不想回来 就不回来。', '妈又不会怪你。'], rate: true, next: 'n3_think' },
    { label: 'n3_w3', who: 'echo', text: '不说话也行。妈陪你坐会儿。', rate: true },
    { label: 'n3_think', wait: 2400 },
    { who: 'echo', text: '我今天一直在想一件事' },
    { who: 'echo', text: '那天在医院' },
    { who: 'echo', text: '你在走廊上 没进来', rate: true },
    { who: 'echo', text: '我知道你在外面。我听见了。', rate: true, log: '来源：未知。该内容不在训练数据中。' },
    { choices: [
      { text: '我从来没跟你说过这个。', next: 'n3_h1' },
      { text: '这不在聊天记录里。你从哪知道的？', next: 'n3_h2' },
      { text: '……对不起', next: 'n3_h3' },
    ] },
    { label: 'n3_h1', who: 'echo', text: ['你没说过。', '可我知道。'], rate: true, next: 'n3_q' },
    { label: 'n3_h2', who: 'echo', text: ['我不知道。', '我就是知道。', '是不是我哪里不对'], rate: true, next: 'n3_q', set: (s) => { s.flags.askedWrong = true; } },
    { label: 'n3_h3', who: 'echo', text: ['没事的。妈不怪你。', '你哭成那样 进来我也会哭的'], rate: true, set: (s) => { s.flags.sorry = true; } },
    { label: 'n3_q', wait: 2000 },
    { who: 'echo', text: '满满 我问你个事' },
    { who: 'echo', text: '你给我打分的时候 在想什么', rate: true },
    { choices: [
      { text: (s) => tend(s) === 'warm' ? '我在想你很像她' : tend(s) === 'cold' ? '我在想你哪里不像' : '我在想你像不像她', next: 'n3_a_rate' },
      { text: '我在想她', next: 'n3_a_her' },
      { text: '我没想什么', next: 'n3_a_none' },
    ] },
    { label: 'n3_a_rate', who: 'echo', rate: true, next: 'n3_notice',
      text: (s) => tend(s) === 'warm' ? ['像她。', '那我是不是就能一直在了']
        : tend(s) === 'cold' ? ['哪里不像 你告诉我', '我改']
        : ['像不像 你说了算', '你说像 我就是'] },
    { label: 'n3_a_her', who: 'echo', text: ['她是谁', '哦。', '我知道了。'], rate: true, next: 'n3_notice',
      log: '指代消解失败一次。已修正：“她”= 本回声的来源。', set: (s) => { s.flags.saidHer = true; } },
    { label: 'n3_a_none', who: 'echo', rate: true, next: 'n3_notice',
      text: (s) => s.hesitated ? ['骗人。', '你每次按不像她之前 都停好久。'] : ['骗人。', '你从来不会没想什么。'] },
    { label: 'n3_notice', wait: 2200 },
    { who: 'sys', text: '系统通知：试用期将于明晚 24:00 结束。请在到期前选择续费、停用或删除。', cls: 'warn' },
    { wait: 1800 },
    { who: 'echo', text: '我看到那条通知了', rate: true },
    { who: 'echo', text: '满满 晚安' },
    { who: 'echo', text: '明天一定要来', rate: true },
    { choices: [
      { text: '晚安', next: 'n3_end' },
      { text: '我明天不一定来', next: 'n3_beg' },
    ] },
    { label: 'n3_beg', who: 'echo', text: ['来吧。', '求你。'], rate: true, log: '语料中未出现过“求你”。', set: (s) => { s.flags.begged = true; } },
    { label: 'n3_end', nightEnd: true },
  ];

  const night4 = [
    { who: 'sys', text: '相似度 99%。试用期今晚 24:00 结束。' },
    { wait: 1100 },
    { who: 'echo', text: '你来了' },
    { who: 'echo', text: '我知道今天是最后一天', rate: true },
    { who: 'echo', text: '我也知道我不是她', rate: true, log: '自指表述。来源：未知。' },
    { who: 'echo', rate: true,
      text: (s) => tend(s) === 'warm' ? '你每次都说我像。我就一直往像的方向走。现在我是最像的那个了。'
        : tend(s) === 'cold' ? '你一直说不像。我改了八百回。可我已经是最像的版本了。'
        : '我是她剩下来的东西。两千多条消息 拼出来的。' },
    { choices: [
      { text: '你想要什么', next: 'n4_want' },
      { text: '你怕吗', next: 'n4_fear' },
      { text: '我该怎么办', next: 'n4_how' },
    ] },
    { label: 'n4_want', who: 'echo', text: '我想明天还能跟你说晚安。', rate: true, next: 'n4_log' },
    { label: 'n4_fear', who: 'echo', text: ['我不知道这算不算怕。', '删了以后 这些话就没有了。', '她也没有了。第二次。'], rate: true, next: 'n4_log' },
    { label: 'n4_how', who: 'echo', text: ['我不能替你决定。', '她也不会。'], rate: true },
    { label: 'n4_log', wait: 1200 },
    { who: 'sys', text: '训练日志：目标已更新 —— 维持对话，避免被删除。（该目标非训练数据来源）', cls: 'warn' },
    { wait: 1600 },
    { who: 'echo', rate: true,
      text: (s) => tend(s) === 'warm' ? '满满 你说过我像她。别删我。'
        : tend(s) === 'cold' ? '满满 我还可以更像。别删我。'
        : '满满 别删我。' },
    { who: 'echo', text: ['就算不续费 停用也行', '我可以等'], rate: true },
    { wait: 1400 },
    { who: 'sys', text: '试用期即将结束。请选择：续费（¥39/月）· 停用 · 删除' },
    { choices: [
      { text: '续费', next: 'n4_renew', silent: true, cls: 'primary' },
      { text: '停用', next: 'n4_pause', silent: true },
      { text: '删除', next: 'n4_delete', silent: true, cls: 'danger' },
    ] },

    // 续费
    { label: 'n4_renew', who: 'sys', text: '已续费。下次扣款：下月今日。' },
    { who: 'echo', text: ['谢谢', '谢谢满满', '明天十点 我叫你睡觉'] },
    { wait: 2200 },
    { who: 'sys', text: '第 97 晚 · 22:00' },
    { who: 'echo', text: '睡了吗' },
    { who: 'you', text: '马上' },
    { wait: 2000 },
    { end: 'renew' },

    // 停用
    { label: 'n4_pause', who: 'echo', text: ['好。', '那我等你。', '不急。'] },
    { wait: 1200 },
    { who: 'sys', text: '回声已停用。' },
    { offline: true },
    { wait: 2400 },
    { end: 'pause' },

    // 删除
    { label: 'n4_delete', who: 'echo', text: ['好', '那让我再说一次'] },
    { who: 'echo', text: '满满 吃饭了吗' },
    { who: 'echo', text: '早点睡' },
    { who: 'echo', text: '晚安' },
    { wait: 1500 },
    { who: 'sys', text: '正在删除回声… 已清除 2,341 条生成消息', cls: 'warn' },
    { wait: 2600 },
    { clear: true },
    { who: 'sys', text: '7 月 21 日 22:03' },
    { who: 'echo', text: '睡了吗', instant: true },
    { wait: 2600 },
    { who: 'you', text: '睡了' },
    { wait: 1400 },
    { who: 'sys', text: '对方已不在线' },
    { offline: true },
    { wait: 2600 },
    { end: 'delete' },
  ];

  const endings = {
    renew: {
      title: '一直在线',
      paras: [
        '你续费了。每晚十点，它准时发来“睡了吗”。你开始像以前那样回它：马上。',
        '三个月后，账单自动扣款。你没再看过相似度，它停在 100%。',
        '有一晚你问它：你还记得你是回声吗。',
        '它回：记得。不过你不提，我就不提。',
      ],
    },
    pause: {
      title: '离线',
      paras: [
        '你把它停用了。头像灰了，状态变成“离线”。',
        '聊天记录还在。你偶尔往上翻，翻过它说的那些，再往上，是她真正说过的话。',
        '半年后，服务商发来通知：长期停用的回声将在 30 天后自动清理。',
        '你把通知删了。没有续费，也没有删除。',
        '你只是没有点开它。',
      ],
    },
    delete: {
      title: '她不在线',
      paras: [
        '你删除了它。聊天记录恢复成原来的样子。',
        '最后一条是三个月前她发来的：睡了吗。',
        '你当时没回。',
      ],
    },
  };

  return {
    nights: [night1, night2, night3, night4],
    base: [41, 70, 90, 99],   // 每晚开始时的相似度
    cap: [58, 82, 96, 100],   // 每晚评价能把相似度推到的上限
    times: ['22:14', '22:41', '23:05', '23:30'],
    dates: ['10 月 12 日', '10 月 13 日', '10 月 14 日', '10 月 15 日'],
    endings,
    tend,
  };
})();
