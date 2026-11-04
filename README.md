# 棠安科技 · 恐怖小游戏合集

几个"模拟软件界面"的恐怖小游戏，纯静态网页，手机浏览器直接玩。
共用一个虚构公司"棠安科技"和它的 AI 助手"小棠"作为世界观。

线上入口：https://shellmia0.github.io/tangan-games/

| 目录 | 游戏 | 一句话 | 状态 |
|---|---|---|---|
| `still-you/` | 还是你吗 | 每天和 AI 助手做三项测试，判断今天的它还是不是原来的它 | 可玩 |
| `review-day/` | 审核日 | 对照每天更新的手册，给 AI 和用户的聊天记录盖章 | 可玩 |
| `still-online/` | 她还在线 | 用逝者的聊天记录训练出来的"回声"，越来越像她 | 可玩 |
| `found-phone/` | 捡到的手机 | 捡到一部手机，机主的联系人开始给你发消息 | 可玩 |
| `delivery/` | 骑手已到达 | 凌晨的外卖推送，你没点过，骑手越来越近 | 可玩 |

每个目录自己的 README 里有玩法、内容表、文件说明和调试方法。每个目录的 `post/` 里有小红书发帖素材（竖图和文案）。

## 工具

- `tools/shot.js`：无头 Chrome 驱动，打开页面、跑 JS、截图、收集控制台错误。浏览器面板不可用时拿它验证。
- `tools/make-posters.js <游戏>`：用 `<游戏>/post/shots/` 里的真实截图和 `posters.json` 合成 1242×1656 的发帖竖图。各游戏的 `post/capture.js` 负责截图。
- `tools/render-posters.js <游戏>`：另一种做法，把手写的 `post/poster.html` 场景渲染成图（still-you 用的是这个）。

## 本地运行

任何静态服务器都行，比如：

```bash
python -m http.server 8769
```

然后打开 http://localhost:8769 就是合集入口，各游戏在对应子路径下。直接双击各目录的 `index.html` 也能玩。

## 发布

整个目录就是 GitHub 仓库 `Shellmia0/tangan-games`，GitHub Pages 从 `main` 分支根路径发布，推送后一两分钟自动更新。
`.gitignore` 排除了 `.claude/`、各游戏的 `dist/` 和 `post/img/`（发帖图片本地渲染，不进仓库）。

## 约定

- 没有依赖，没有构建步骤，没有真的 AI，所有对话都是脚本。
- 手机优先：375px 宽要能完整操作，输入框字号不小于 16px。
- 存档用 localStorage，每个游戏自己的键名前缀（`sy_`、`rd_`、`so_`、`fp_`）。
- 每个游戏暴露一个调试对象（`SY`、`RD`、`SO`、`FP`），能跳关、关动画、强制触发事件。
