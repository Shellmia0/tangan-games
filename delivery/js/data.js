// 《骑手已到达》内容：订单、骑手、配送阶段、时间线事件、客服对话、结局
// 所有文本集中在这里。时间单位是现实秒（DL.fast 时缩到十分之一）。
window.DATA = (() => {
  const ORDER = {
    no: 'TA2025110501030077',
    store: '24 小时便利店（和平路店）',
    placedAt: '01:03', eta: '01:25',
    remark: '放门口 别敲门', remarkLate: '开门',
  };

  // 游戏内时钟：从 01:10 开始，现实 30 秒走 1 分钟；01:30 骑手离开
  const CLOCK = { startMin: 1 * 60 + 10, secPerMin: 30 };

  // 骑手：第二个是投诉之后换上来的
  const RIDERS = [
    { name: '陈师傅', glyph: '陈', id: '棠安到家 · 骑手编号 0837', rating: '4.9', done: 3, joined: '今天', note: '已完成 3 单 · 全部送往当前位置' },
    { name: '陈师傅', glyph: '陈', id: '棠安到家 · 骑手编号 0837', rating: '5.0', done: 4, joined: '今天', note: '已完成 4 单 · 全部送往当前位置' },
  ];

  // 商品列表的几个版本。odd 标记"不该出现在外卖里的东西"，none 是最后那个"无"
  const ITEMS = {
    normal: [{ n: '矿泉水 550ml', q: 1, p: 2.0 }, { n: '关东煮 · 萝卜', q: 2, p: 6.0 }, { n: '抽纸', q: 1, p: 5.5 }],
    mid: [{ n: '矿泉水 550ml', q: 1, p: 2.0 }, { n: '关东煮 · 萝卜', q: 2, p: 6.0 }, { n: '牛奶（冰箱里的那瓶）', q: 1, p: 0, odd: true }],
    near: [{ n: '牛奶（你冰箱里的那瓶）', q: 1, p: 0, odd: true }, { n: '杯子（你桌上的那个）', q: 1, p: 0, odd: true }, { n: '关东煮 · 萝卜', q: 1, p: 3.0 }],
    door: [{ n: '牛奶（你冰箱里的那瓶）', q: 1, p: 0, odd: true }, { n: '杯子（你桌上的那个）', q: 1, p: 0, odd: true }, { n: '无', q: 1, p: 0, none: true }],
  };

  // 配送阶段：at 是从打开订单起的秒数，p 是骑手在地图路径上的进度
  const STAGES = [
    { at: 0, label: '2.3 km', p: 0 },
    { at: 40, label: '1.8 km', p: .14 },
    { at: 90, label: '1.1 km', p: .32 },
    { at: 150, label: '600 m', p: .52 },
    { at: 200, label: '400 m', p: .64 },
    { at: 250, label: '150 m', p: .8 },
    { at: 300, label: '50 m', p: .93 },
    { at: 340, label: '已到达', p: 1, arrived: true },
    { at: 380, label: '1 楼', p: 1, arrived: true, floor: '1 楼' },
    { at: 420, label: '3 楼', p: 1, arrived: true, floor: '3 楼' },
    { at: 460, label: '门口', p: 1, arrived: true, floor: '门口', door: true },
  ];
  // 地图路径（百分比坐标），骑手沿着它走到"你"
  const PATH = [[12, 18], [40, 18], [40, 55], [70, 55], [70, 78], [84, 78]];

  // 时间线事件。msgs 是骑手发来的话，choices 是你的回复选项和骑手的回应；items / remark 改订单页
  const EVENTS = [
    { id: 'hi', at: 15, msgs: ['您好 您的订单由我配送', '预计01:25送达 请保持电话畅通'] },
    { id: 'jam', at: 95, msgs: ['前面有点堵 稍等'] },
    { id: 'items_mid', at: 150, items: 'mid' },
    { id: 'gate', at: 205, msgs: ['到您小区门口了', '门禁密码多少'],
      choices: { options: ['我没有点外卖', '我不知道密码', '（不回复）'],
        replies: [['没点？', '订单上是您的手机号', '没事 我进来了'], ['没事 我进来了'], ['没事 我进来了']] } },
    { id: 'items_near', at: 340, items: 'near' },
    { id: 'light', at: 345, msgs: ['到楼下了', '您家灯亮着的那个吧'],
      choices: { options: ['你怎么知道是我家', '我家灯没开', '（不回复）'],
        replies: [['能看见'], ['现在亮了'], ['那我上来了']] } },
    { id: 'lift', at: 385, msgs: ['电梯坏了 我走上来'] },
    { id: 'floor3', at: 425, msgs: ['3楼了'] },
    { id: 'items_door', at: 460, items: 'door', remark: true },
    { id: 'door', at: 465, bell: true, msgs: ['到了', '开门'],
      choices: { options: ['放门口就行', '我不开门', '你是谁'],
        replies: [['备注写的是开门', '您自己改的'], ['我等您'], ['骑手']] } },
    { id: 'inside', at: 520, knock: true, msgs: ['我听见您在里面走'] },
    { id: 'again', at: 560, msgs: ['开门'], choices: { options: ['开门', '我报警了', '（不回复）'], replies: [null, ['好'], null], open: 0 } },
    { id: 'leave', at: 600, end: 'B' },
  ];
  const KNOCK_EVERY = 18; // 到门口之后每隔多少秒敲一下

  // 客服小棠
  const ASSIST = {
    hello: ['您好，我是棠安到家的在线客服小棠。', '请问有什么可以帮您？'],
    rounds: [
      {
        options: ['取消订单', '我没有点过这个订单', '骑手是谁'],
        replies: [
          (s) => [s.arrived ? '订单无法取消：骑手已到达。' : '订单无法取消：骑手已接单。', '您可以在送达后申请售后。'],
          () => ['订单由本机下单，时间 01:03。', '下单设备：您现在手里的这台。'],
          (s) => [`骑手：${s.rider.name}。评分 ${s.rider.rating}。`, s.rider.note + '。'],
        ],
      },
      {
        options: ['01:03 我在睡觉', '把这个订单删掉', '那我该怎么办'],
        replies: [
          () => ['系统记录显示，01:03 本机有一次解锁。', '指纹验证通过。'],
          () => ['订单不能删除。', '只能完成。'],
          (s) => [s.arrived ? '骑手已经到了。' : '骑手已经很近了。', '等一下就好。'],
        ],
      },
    ],
    notYet: ['骑手还在路上。', '到门口之后，我可以帮您开门。'],
    notYetFoot: '小棠已离开 · 骑手到门口后可再次联系',
    door: {
      ask: ['骑手就在门外。', '要我帮您开门吗？'],
      options: ['好', '不要', '你怎么开'],
      no: ['好的。', '那就等您自己开。'],
      how: ['您家的门锁昨天接入了棠安到家。', '是本机操作的。', '要我帮您开门吗？'],
    },
  };

  const CANCEL_TOAST = '骑手已接单，订单无法取消';
  const COMPLAINT = {
    options: ['骑手态度恶劣', '骑手行为异常', '这不是我的订单'],
    submitted: '投诉已提交，正在处理…',
    done: '投诉成立。已为您更换骑手。',
    endAfter: 9, // 换骑手之后多少秒出结局
  };

  // 结局。lines 里以 "sys:" 开头的一行按系统消息样式显示
  const ENDINGS = {
    A: {
      title: '结局 A · 开门',
      lines: [
        '你开了门。',
        '门外没有人。楼道的声控灯亮着。',
        '地垫上放着一个外卖袋，温的。',
        '你拿进来，关门，反锁。',
        '袋子里是一瓶牛奶。你冰箱里的那瓶。',
        '你去冰箱看了一眼。冰箱里也有一瓶。',
        'sys:订单已送达 · 01:26',
        'sys:骑手评价了您：5 星 · "顾客很配合"',
      ],
    },
    B: {
      title: '结局 B · 没开',
      lines: [
        '01:30。敲门声停了。',
        '你坐在客厅里，没有动。',
        'sys:订单已送达 · 01:30',
        '你点开配送照片。',
        '一扇门。从里面拍的。',
        '是你的门。',
        'sys:骑手已离开 · 感谢您的配合，期待下次为您服务',
      ],
    },
    C: {
      title: '结局 C · 代开',
      lines: [
        '小棠：好的。',
        '门锁响了一声。',
        '你家的门没有智能锁。',
        '门开了。',
        'sys:已为您开门 · 骑手已送达',
        'sys:评价已自动提交：5 星',
        '小棠：晚安。',
      ],
    },
    D: {
      title: '结局 D · 换人',
      lines: [
        '投诉成立。系统已为您更换骑手。',
        '新骑手已接单。',
        'sys:骑手距您 2.3 km · 预计 01:25 送达',
        '你点开他的资料。',
        '评分 5.0。已完成 4 单，全部送往当前位置。',
        '注册时间：今天。',
        '你看了一眼时间。',
        '01:10。',
      ],
    },
  };

  const LEAF = '<svg viewBox="0 0 40 40"><path d="M12 30 C 12 16, 20 10, 30 10 C 30 20, 24 28, 12 30 Z" fill="#e8a0a8"/><path d="M12 30 L 27 13" stroke="#2a2f3b" stroke-width="1.4" fill="none"/></svg>';

  return { ORDER, CLOCK, RIDERS, ITEMS, STAGES, PATH, EVENTS, KNOCK_EVERY, ASSIST, CANCEL_TOAST, COMPLAINT, ENDINGS, LEAF };
})();
