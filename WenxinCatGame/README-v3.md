# 温馨猫小屋 · 微信小游戏（v3 优化版）

GPT 原版基础上的启动性能优化版本。

## 优化内容（v3）

- `game.json`：86 张品种图（1.9MB）拆分为 `breeds` 子包，主包 3.7MB → 1.3MB
- `js/ui.js`：`ensureImage` 支持子包按需加载，未下载完时显示"图片加载中"，完成后自动重绘
- `assets/breeds/game.js`：子包标记文件（微信小游戏子包要求）

微信云测试：启动性能 83 → 91，代码包下载 74 → 94。

## 资源文件说明

图片（119 张 PNG）和音频（14 个 MP3）因 GitHub App 推送限制未包含在此仓库，
请从本仓库根目录的 `WenxinCatGame-wechat (1).zip`（GPT 原版包）解压获取，
或使用 `WenxinCatGame-opt-v3.zip`（优化版完整包）。

目录结构（完整版）：
```
WenxinCatGame/
├── game.js / game.json     # 入口 + 子包配置
├── config.js               # 云环境配置
├── js/                     # 游戏逻辑（含子包加载）
├── js/rules/               # 玩法规则
├── assets/                 # 图片资源（本仓库仅含文本，此处需解压 zip 补充）
│   └── breeds/             # 86 张品种图 → breeds 子包
├── cloudfunctions/mw-catgame/  # 云函数
├── tests/                  # 105 个测试
└── tools/                  # check / preview 脚本
```
