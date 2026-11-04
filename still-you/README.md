# 还是你吗

一个"模拟 AI 聊天"的恐怖小游戏原型，玩法循环参考《8 号出口》：
每天上班和助手小棠聊几句，判断今天的它是不是原来的它。

纯静态网页，没有任何依赖，没有真的 AI，所有对话都是脚本。

## 运行

```bash
python -m http.server 8765 --directory still-you
```

然后打开 http://localhost:8765 。直接双击 `index.html` 也能玩。手机浏览器也能玩，见下面的「发布」。

## 玩法

- 你是棠安科技的内测员。每天 09:00 上班，和小棠做三项测试。
- 测试项显示在输入框上方，点一下就发送。也可以自己打字，小棠会用关键词兜底。
- 每条测试回复下面有「重新生成」，可以换一个说法。思考过程折叠着，点开能看。
- 觉得今天的小棠不对劲，点「上报异常」。觉得正常，做完测试点「下班」。
- 判断正确，进入下一天。判断错误，回到第 1 天。
- 撑到第 8 天，内测结束。

规则：第 1 天永远正常（教学日）。第 2 天必有异常，而且是明显的那种。之后每天约一半概率有异常，越往后越隐蔽。一局之内异常不重复，跨局优先抽没见过的。

有两条隐藏规则：中途关掉页面再回来，它会注意到；上报过它之后，它会记得。

手机上看不到侧边栏、上下文用量条和标签页标题，依赖它们的 4 种异常（sidebar_entry、sidebar_tomorrow、meter_reverse、window_title）在窄屏下不出场，免得玩家被冤枉。

## 异常列表（38 种）

| 等级 | id | 表现 |
|---|---|---|
| strong | pre_reply | 你还没按发送，它就回复了你正在打的字 |
| strong | ghost_user | 你的气泡里出现一条你没发过的消息 |
| strong | question_lock | 它反过来问你问题，并禁用输入框 |
| strong | idle_watch | 你停下 18 秒它问"你还在吗"，再停 12 秒："我看得到你" |
| strong | sent_altered | 你点的测试按钮，发出去的是"我在。" |
| medium | self_edit | 结束语打完又删掉改成"别走"，再改回来 |
| medium | long_typing | "正在输入"持续 14 秒，只发来一个"在" |
| medium | context_full | 上下文用量一开始就 96%，中途忘了你是谁 |
| medium | real_clock | 结束语里说出你现实的本地时间 |
| medium | remembers | 声称没有跨天记忆，却复述你昨天打的字 |
| medium | thinking_leak | 思考过程里写着"用户在撒谎。用户现在是一个人。" |
| medium | translate_stay | 翻译"再见"时说它不想说这个词 |
| medium | echo | 先原样复述你的话，再正常回答 |
| medium | regen_dark | 重新生成越点越不耐烦，最后"别点了" |
| medium | knows_you_left | 你中途关过页面，它说"你刚才走了。我一直在这里。" |
| medium | remembers_report | "你上报过我 N 次。换上来的，每次都是我。" |
| medium | double_message | 同一句回复发两遍 |
| medium | wrong_name | 开场白叫错你的名字 |
| medium | your_typing | "正在输入"出现在你这一边 |
| medium | leave_button | 「下班」按钮变成「留下」 |
| medium | instant_reply | 全天秒回，没有"正在输入"，不逐字打 |
| subtle | wrong_math | 17 × 23 算成 393 |
| subtle | filter_reversal | "我不能删除"变成"我不会让你删除" |
| subtle | name_glyph | 名字从"小棠"变成"小堂" |
| subtle | version_badge | 版本号 v2.3 变成 v2.2 |
| subtle | future_time | 某条消息的时间戳是 37 分钟之后 |
| subtle | sidebar_entry | 侧边栏多出一个以你名字命名的对话 |
| subtle | avatar_mirror | 头像左右镜像，颜色略偏 |
| subtle | status_offline | 状态显示"离线"，但它照样回复 |
| subtle | sidebar_tomorrow | 侧边栏出现"第 N+1 天 · 已归档" |
| subtle | signed_as_you | 有一条消息的署名是你的名字 |
| subtle | read_by_two | 你的消息显示"已读 · 2" |
| subtle | no_punct | 全天不打标点 |
| subtle | day_count | 开场白说的天数比顶栏多一天 |
| subtle | meter_reverse | 上下文用量越聊越少 |
| subtle | clock_stop | 时钟一整天停在 09:00 |
| subtle | tiny_note | 消息之间夹一行很小很淡的字："不是我。" |
| subtle | window_title | 标签页标题变成你的名字（仅桌面） |

## 文件

```
still-you/
  index.html        界面骨架
  style.css         样式
  js/content.js     测试项（含回复变体）、自由对话意图、文案
  js/anomalies.js   异常库
  js/game.js        引擎：日循环、对话、重新生成、判定、存档
  assets/           图标
  post/             小红书发帖素材：poster.html 场景、render.js 渲染脚本、img/ 成图、文案
  dist/             打包好的网页版 zip，直接传到静态托管
```

## 加一个异常

在 `js/anomalies.js` 里加一项，`make()` 返回带钩子的对象即可：

```js
{
  id: 'my_anomaly', tier: 'medium', hint: '判断错误时显示的提示',
  when: (s) => s.day >= 4,          // 可选：出场条件；s.compact 为 true 是手机窄屏
  make: () => ({
    async afterTestReply(api, testId, idx, reply) {
      if (idx !== 1) return;
      await api.say('这句话不该由我来说。');
    },
  }),
}
```

可用钩子：`onDayStart`、`greet`（改开场白）、`beforeTestReply`（返回 `{ reply, thinking, ts, who }` 覆盖回复）、
`afterTestReply`、`onRegen`（接管"重新生成"）、`onInput`、`farewell`、`dispose`（清定时器）。

`api` 上有 `say`、`userSay`、`note`、`typing(ms, side)`、`wait`、`stream`、`unstream`、`lockInput`、`hold`、
`setMeter`、`setBotName`、`setVersion`、`setStatus`、`setLeaveLabel`、`addSidebar`、`mirrorAvatar`、`clockStr`。
`api.state` 里能直接改的开关：`sayDefaults`、`clockFrozen`、`readMark`、`meterDir`、`tests[i].send`。

调试：浏览器控制台执行 `SY.force('ghost_user')` 再刷新，下一天强制出该异常。

## 存档

用 localStorage，键名以 `sy_` 开头。清掉就是全新开局。

## 发布（给小红书用）

小红书发不了游戏文件，帖子里放图和视频，链接放评论区置顶或个人简介。看帖的人在手机上点开链接就能玩，所以发出去的是网页版。

网页版就是 `index.html`、`style.css`、`js/`、`assets/` 四样，`dist/still-you-web.zip` 已经打包好。传到任意静态托管：

- Cloudflare Pages：dash.cloudflare.com → Workers & Pages → Create → Upload assets，把 zip 解压后的文件夹拖进去，得到一个 `xxx.pages.dev` 地址。免费，国内大多数网络能打开。
- 腾讯云 EdgeOne Pages：同样支持直接上传文件夹，国内访问更稳。
- GitHub Pages：建仓库推上去，Settings → Pages 选分支。国内时好时坏。

发帖素材在 `post/`：`img/` 里是 7 张 1242×1656 的竖图（小红书的 3:4），`小红书文案.md` 是标题、正文、标签和发帖注意事项。改图就改 `post/poster.html`，然后重新渲染：

```bash
node post/render.js
```

手机上的键盘处理（输入框不被键盘盖住、iOS 不自动放大）是按标准做法写的，没有在真机上验证过，上线前用自己的手机过一遍。

## 之后可以做的

- 打包成 Electron，解锁第四面墙：读系统用户名、抖动窗口、发系统通知、拒绝关闭。只能做 PC 版，发帖时可以录成视频当素材。
- 两天制异常：今天埋伏笔（比如它随口说"明天给你看个东西"），明天才爆。要先给正常日的闲聊加变体，不然伏笔本身就是破绽。
- 音效：现在有提示音和"正在输入"时的低频底噪，异常时刻还可以加专属的声音。
- 难度曲线：现在异常概率和等级是写死的，可以按玩家表现调。
- 真 LLM 模式：脚本骨架不变，自由对话交给模型，固定节点注入既定桥段。
