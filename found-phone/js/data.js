// 《捡到的手机》内容：机主、联系人、聊天、照片、备忘录、通话记录、助手对话、事件、结局
// 所有文本集中在这里。
window.DATA = (() => {
  const OWNER = { name: '林晚', model: '棠安 T2', os: 'TangOS 4.1', number: '139 2210 0836', battery: '7%', storage: '58.2 GB / 64 GB' };
  const PIN = '1104';
  // 游戏内时钟：捡到手机时 23:47，末班车 00:00；现实每 60 秒走 1 分钟
  const CLOCK = { start: 23 * 60 + 47, lastBus: 24 * 60, msPerMin: 60000, dateText: '11月4日 星期二' };

  const CONTACTS = [
    { id: 'mom', name: '妈妈', glyph: '妈', color: '#9c5a44' },
    { id: 'zhou', name: '周可', glyph: '可', color: '#4d5f85', star: true },
    { id: 'group', name: '周五不加班', glyph: '群', color: '#3f6f58', group: true, members: ['阿杰', 'Mia', '老周', '林晚'] },
    { id: 'unknown', name: '138 0012 2071', glyph: '?', color: '#3a3a3a', unknown: true },
    { id: 'landlord', name: '房东老张', glyph: '张', color: '#7a6246' },
  ];
  const CONTACT = Object.fromEntries(CONTACTS.map((c) => [c.id, c]));
  const MEMBER_COLOR = { '阿杰': '#5a7fa0', 'Mia': '#a05a8a', '老周': '#7a8a5a', '林晚': '#2f6fd6' };

  // from: 'me' 是机主林晚；'sys' 是居中的系统行；'them' 是对方；群聊里 from 是成员名
  const CHATS = {
    mom: [
      { from: 'them', text: '晚晚 吃饭了吗', time: '18:20' },
      { from: 'me', text: '吃了 加班', time: '18:52' },
      { from: 'them', text: '今天是可可生日吧。你别去站台了，妈知道你每年都去', time: '21:30' },
      { from: 'me', text: '不去', time: '21:41' },
      { from: 'them', text: '怎么不接电话', time: '22:38' },
      { from: 'sys', text: '未接来电 22:40' },
      { from: 'them', text: '晚晚，你在哪', time: '23:10' },
      { from: 'them', text: '妈睡不着。回个消息', time: '23:31' },
    ],
    zhou: [
      { from: 'sys', text: '8月2日' },
      { from: 'them', text: '明天老地方见！末班车前到', time: '22:10' },
      { from: 'me', text: '好 带蛋糕', time: '22:11' },
      { from: 'them', text: '你别又迟到', time: '22:11' },
      { from: 'me', text: '不会', time: '22:12' },
      { from: 'sys', text: '8月3日' },
      { from: 'me', text: '可可？', time: '23:52' },
      { from: 'me', text: '你在哪', time: '23:58' },
      { from: 'me', text: '可可', time: '00:14' },
      { from: 'sys', text: '9月15日' },
      { from: 'me', text: '今天路过站台了。', time: '23:40' },
      { from: 'sys', text: '10月14日' },
      { from: 'me', text: '他们把那个站牌换了。', time: '23:45' },
      { from: 'sys', text: '11月3日' },
      { from: 'me', text: '明天你生日。我去等你。', time: '23:50' },
    ],
    group: [
      { from: '阿杰', text: '今晚谁加班', time: '20:05' },
      { from: 'Mia', text: '我 救命', time: '20:06' },
      { from: '老周', text: '林晚今天请假了吧 一下午没见', time: '20:30' },
      { from: '阿杰', text: '她朋友圈发了个公交站 啥意思', time: '20:31' },
      { from: 'Mia', text: '别说了 今天是她那个朋友的生日', time: '20:33' },
      { from: '阿杰', text: '哦……', time: '20:34' },
      { from: 'Mia', text: '@林晚 到家了吗', time: '22:50' },
      { from: '老周', text: '有人联系上她吗', time: '23:12' },
    ],
    unknown: [],
    landlord: [
      { from: 'sys', text: '11月1日' },
      { from: 'them', text: '小林 这个月房租记得', time: '09:12' },
      { from: 'me', text: '明天转', time: '12:40' },
      { from: 'sys', text: '11月3日' },
      { from: 'them', text: '收到了。对了你最近晚上都不在家？楼道灯坏了我看你好几天没回', time: '19:30' },
      { from: 'me', text: '在的 回得晚', time: '23:20' },
      { from: 'sys', text: '今天' },
      { from: 'them', text: '那你注意安全 那个站台晚上没人', time: '19:00' },
    ],
  };
  // 刚捡到时各对话的未读数
  const UNREAD_INIT = { mom: 2, group: 2 };

  // 解锁后按秒触发的事件。chat 事件逐条送达，第一条前显示 typing 秒的"正在输入"
  const EVENTS = [
    {
      id: 'mom1', at: 25, chat: 'mom', typing: 3,
      msgs: [{ from: 'them', text: '晚晚？你电话怎么一直占线' }],
      choices: {
        options: ['我不是林晚，我捡到了这部手机', '我没事，别担心'],
        replies: [
          [{ from: 'them', text: '你是谁？？' }, { from: 'them', text: '把电话给晚晚' }, { from: 'them', text: '今天是可可的生日 她肯定在站台', delay: 4 }, { from: 'them', text: '求你 看看周围有没有她', delay: 3 }],
          [{ from: 'them', text: '那就好' }, { from: 'them', text: '你今天别去站台了 听妈的' }, { from: 'them', text: '你打字怎么跟平时不一样', delay: 5 }],
        ],
      },
    },
    {
      id: 'zhou1', at: 60, chat: 'zhou', typing: 6, low: true,
      msgs: [{ from: 'them', text: '你站的地方，是我站过的地方。' }],
      choices: {
        options: ['你是谁', '周可已经……'],
        replies: [
          [{ from: 'them', text: '我知道你不是她。' }, { from: 'them', text: '她也知道。', delay: 4 }],
          [{ from: 'them', text: '我知道。' }, { from: 'them', text: '晚晚也知道。' }, { from: 'them', text: '所以她今天来了。', delay: 4 }],
        ],
      },
    },
    {
      id: 'group1', at: 100, chat: 'group', typing: 2,
      msgs: [
        { from: '阿杰', text: '我刚打车路过和平路站，站台有个人站那看手机，是林晚吗' },
        { from: 'Mia', text: '她不是不接电话吗', delay: 4 },
        { from: '阿杰', text: '我喊了一声没反应', delay: 3 },
        { from: '老周', text: '@林晚 你在吗 看到回一下', delay: 4 },
      ],
      choices: {
        options: ['我捡到了她的手机', '（不回复）'],
        replies: [
          [{ from: '阿杰', text: '？？？' }, { from: 'Mia', text: '你在哪？？' }, { from: '阿杰', text: '你是不是就在和平路站', delay: 3 }, { from: '阿杰', text: '那你旁边那个人是谁', delay: 4 }],
          null,
        ],
      },
    },
    {
      id: 'unknown1', at: 150, chat: 'unknown', typing: 2, low: true,
      msgs: [{ from: 'them', text: '你还在站台上吧。' }, { from: 'them', text: '别回头。', delay: 5 }],
    },
    { id: 'photo1', at: 200, photo: 'near' },
  ];

  // 照片：没有真图，look 对应 style.css 里的 .lk-* 色块。新的在前
  const PHOTOS = [
    { time: '刚刚', when: '23:46', place: '和平路公交站', look: 'night', desc: '站台。一个人背对镜头站着，低头看手机。\n衣服和你今晚穿的一样。' },
    { time: '23:20', place: '和平路公交站', look: 'bench', desc: '站牌下的长椅。椅子上放着一部手机，屏幕朝上。\n是这部手机。' },
    { time: '22:58', place: '和平路公交站', look: 'night', desc: '站台。空的。灯坏了一盏。' },
    { time: '11月3日', place: '和平路公交站', look: 'flower', desc: '长椅上放着一束花。没有卡片。' },
    { time: '11月2日', place: '和平路公交站', look: 'sign', desc: '同一个站牌。晚上。' },
    { time: '11月1日', place: '和平路公交站', look: 'sign', desc: '站牌。"和平路"三个字下面的线路表上，贴着一张寻人启事，被撕掉了一半。' },
    { time: '10月28日', place: '家', look: 'cat', desc: '猫。只拍到一半，它在躲。' },
    { time: '10月22日', place: '公司楼下', look: 'warm', desc: '一杯奶茶，杯套上写着"林"。' },
    { time: '8月3日', place: '和平路公交站', look: 'dark', desc: '很暗。什么都没拍到，只有路灯的一个光点。' },
    { time: '8月2日', place: '火锅店', look: 'warm', desc: '两个人的手碰杯。背景是火锅的雾气。' },
    { time: '3 年前 · 11月4日', place: '周可家', look: 'cake', desc: '生日蛋糕。奶油上用草莓酱写着 11.04。\n可可在笑，眼睛闭着。' },
  ];
  // 事件加进来的照片
  const PHOTO_EXTRA = {
    near: { time: '刚刚', place: '和平路公交站', look: 'near', desc: '更近了。\n能看到那个人手里的屏幕是亮的。\n屏幕上是这张照片。' },
    back: { time: '刚刚', place: '和平路公交站', look: 'back', desc: '你的后脑勺。' },
  };

  const NOTES = [
    { id: 'todo', title: '待办', time: '今天 19:12', body: '周五前交报告\n给妈回电话\n买蛋糕 草莓酱的\n11/4 23:47 末班车' },
    { id: 'letter', title: '给可可', time: '今天 23:40', body: '可可，\n今天我去站台等你。\n如果末班车来了你还没来，我就' },
    { id: 'pin', title: '密码', time: '10月30日', body: '密码是可可的生日。\n每年都忘，每年都记在这。' },
    { id: 'shop', title: '购物清单', time: '10月27日', body: '猫粮\n洗衣液\n草莓酱（可可生日）\n蜡烛 24 根' },
  ];

  // type: missed 未接 / out 呼出 / in 呼入
  const CALLS = [
    { who: 'unknown', type: 'missed', time: '23:41' },
    { who: 'unknown', type: 'missed', time: '23:35' },
    { who: 'unknown', type: 'missed', time: '23:28' },
    { who: 'unknown', type: 'missed', time: '23:21' },
    { who: 'unknown', type: 'missed', time: '23:15' },
    { who: 'unknown', type: 'missed', time: '23:09' },
    { who: 'unknown', type: 'missed', time: '23:02' },
    { who: 'mom', type: 'missed', time: '22:40' },
    { who: 'zhou', type: 'out', time: '昨天 23:50', dur: '未接通' },
    { who: 'landlord', type: 'in', time: '昨天 19:02', dur: '1:12' },
  ];

  const LOCK = {
    notifs: [
      { app: '消息', icon: 'msg', title: '妈妈', text: '妈睡不着。回个消息', time: '23:31', open: ['chat', 'mom'] },
      { app: '消息', icon: 'msg', title: '周五不加班', text: '老周：有人联系上她吗', time: '23:12', open: ['chat', 'group'] },
      { app: '电话', icon: 'call', title: '138 0012 2071', text: '7 个未接来电', time: '23:41', open: ['calls'] },
    ],
    widgets: [
      { app: '备忘录', title: '密码', text: '密码是可可的生日。每年都忘……' },
      { app: '相册', title: '回忆', text: '3 年前的今天 · 可可的生日' },
    ],
    // 密码错 3 次之后出现
    failNotif: { app: '消息', icon: 'msg', title: '138 0012 2071', text: '别猜了。今天是她生日。', time: '刚刚' },
  };

  const ASSIST = {
    intro: (t) => [`晚上好，林晚。现在是 ${t.time}，末班车还有 ${t.left} 分钟。`, '今天的提醒：可可生日。是你去年设的。'],
    rounds: [
      {
        options: ['我不是林晚', '末班车去哪', '可可是谁'],
        replies: [
          ['……', '识别到机主：林晚。', '开玩笑？你最近很少开玩笑。'],
          ['和平路站的末班车，终点站……这条线路去年已经停运了。', '但你每天晚上都在这里等。'],
          ['周可。通讯录里标了星。', '你们的聊天停在 8 月 2 日。后面的消息都是你一个人发的。'],
        ],
      },
      {
        options: ['你知道我在哪吗', '她去哪了', '别说了'],
        replies: [
          ['定位：和平路公交站。你每晚 23:30 到，末班车走了才走。', '今天比平时久。'],
          ['林晚？', '你就是林晚。', '……对吗？'],
          ['好。', '……', '我还是说一句。'],
        ],
      },
    ],
    wait: ['等一下。有一件事我需要确认。', '你先看看她的相册。'],
    waitFoot: '小棠暂时离开了 · 稍后再试',
    reveal: ['你握手机的方式和她不一样。', '你打字的节奏也不一样。', '你不是她。', '她的手机不该在你手里。但既然在你手里，你有三个选择。'],
    final: { options: ['把手机放回原地', '关机', '回复那个一直打电话的号码'], endings: ['A', 'B', 'C'] },
    busWarn: '末班车还有 3 分钟。',
  };

  const ENDINGS = {
    A: {
      title: '结局 A · 放回',
      lines: [
        '你把手机放回长椅上，屏幕朝下。',
        '走出十几步，它在你身后响了。是铃声，不是震动。',
        '你没有回头。',
        '……',
        '第二天早上你路过这个站台。长椅上没有手机，多了一束花。',
        '没有卡片。',
      ],
    },
    B: {
      title: '结局 B · 黑屏',
      lines: [
        '你长按电源键。',
        '屏幕黑下去的那一秒，你在黑屏里看见了自己的脸。',
        '还有你身后的站牌。',
        '站牌下站着一个人，离你很近，低头看着手里亮着的屏幕。',
        '你没有回头。你把手机塞进口袋，往有灯的地方走。',
        '口袋里，它又亮了一下。',
      ],
    },
    C: {
      title: '结局 C · 来了',
      // 先在未知号码的对话里走完这一段，再闪光、加照片，最后出字
      chat: [
        { from: 'them', text: '我是林晚。' },
        { from: 'them', text: '手机落在站台了，谢谢你帮我拿着。', delay: 3 },
        { from: 'them', text: '我马上到。', delay: 3 },
        { from: 'them', text: '我就在你后面。', delay: 6 },
      ],
      lines: [
        '闪光灯亮了一下。不是你按的。',
        '相册里多了一张照片。拍摄时间：刚刚。',
        '照片里是你的后脑勺。',
        '你终于回头了。',
        '站台上没有人。只有末班车的灯，从路口拐过来。',
      ],
    },
    D: {
      title: '结局 D · 末班车',
      lines: [
        '末班车进站了。',
        '车门开着。车里没有人，司机座上也没有。',
        '手机响了一声。是小棠：「到站了，林晚。」',
        '你上了车。',
      ],
    },
  };

  const APPS = [
    { id: 'messages', name: '消息', icon: '<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>' },
    { id: 'photos', name: '相册', icon: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M3 16l5-5 4 4 3-3 6 5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><circle cx="16" cy="9" r="1.5" fill="#fff"/></svg>' },
    { id: 'notes', name: '备忘录', icon: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M8 8h8M8 12h8M8 16h5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>' },
    { id: 'calls', name: '电话', icon: '<svg viewBox="0 0 24 24"><path d="M6 3h3l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/></svg>' },
    { id: 'settings', name: '设置', icon: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>' },
    { id: 'assistant', name: '棠安助手', icon: '<svg viewBox="0 0 40 40"><path d="M12 30 C 12 16, 20 10, 30 10 C 30 20, 24 28, 12 30 Z" fill="#e8a0a8"/><path d="M12 30 L 27 13" stroke="#2a2f3b" stroke-width="1.4" fill="none"/></svg>' },
  ];
  const LEAF = APPS[5].icon;

  return { OWNER, PIN, CLOCK, CONTACTS, CONTACT, MEMBER_COLOR, CHATS, UNREAD_INIT, EVENTS, PHOTOS, PHOTO_EXTRA, NOTES, CALLS, LOCK, ASSIST, ENDINGS, APPS, LEAF };
})();
