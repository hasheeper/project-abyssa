# ABYSSA

幻想 JRPG 的前端与规则仓库：洋馆生活、角色 AVG、骰子远征、商店与补给生产共用一个本地存档；同时提供 `@abyssa/ui` 组件库、独立演出预览和制作工具。

当前普通新档为 **内容27／规则4**，正式 AIRP 新档为 **内容28／规则4**。普通路线可离线游玩；AIRP 使用玩家在设置中保存的连接，由浏览器直连模型 API。工程闭环已接入，内容质量、平衡与完整玩家体验仍需验收。

当前发布阶段为 **Alpha**，试玩地址为 **[abyssa-airp-alpha.pages.dev](https://abyssa-airp-alpha.pages.dev/)**。源码基线 `14bf250` 已推送 [GitHub](https://github.com/hasheeper/project-abyssa)，游戏 ABOUT 提供同一仓库链接。Cloudflare 采用独立 Direct Upload，Git 推送不会自动更新站点；部署版本、检查结果与限制见[发布记录](docs/deployment/AIRP_STATIC_HTTPS.md)。

## 从这里开始

| 需要了解 | 文档 |
| --- | --- |
| 项目现在做到哪里、下一步是什么 | [当前状态与优先级](docs/DESIGN_DECISIONS_AND_CURRENT_STATUS.md) |
| 实际玩法、经济、掉落与存档 | [游戏机制总览](docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md) |
| 全部有效文档与作者原稿 | [文档索引](docs/README.md) |
| AIRP 当前调用链、权限与恢复 | [LLM 与 AIRP](docs/architecture/LLM_AND_AIRP.md) |
| 启动、构建、入口和目录约束 | [工程配置](config/README.md) |

## 当前可玩内容

- 序幕15张 CG → 洋馆首晨 → 四层五房教学 → 一次领奖 → 洋馆自由行动；快捷起点有对应的初始奖励。
- 潮声溶洞三层五战、第二层撤离；克雷格旧庄园五层，区分初战、维护和玛丽埃塔回忆。生活洋馆与旧庄园副本是两个地点。
- 五人队伍、角色专属骰面、公开敌方意图、牌型与铭约、Lv.1～3成长、九种商店装备。
- 道具在取得时通知，LOG 区分未入袋／已入袋；撤离、失败、通关都经过结算。普通战利品与委托交付物分别遵循自己的带回规则。
- SHOP 购买／出售／鉴定、按日期固定上新与随机货单、固定首访 AVG；AIRP 奇物由副本 GM 在既定价位内预写身份与缇比台词，回店在现有小对话框鉴定；系统资金以铜里拉 G 记账。
- 厨房产食物，温室产原料，工坊消耗原料制药，商店常驻卖药水；按实际库存与数量出征，不再每趟免费补满。
- 正式 AIRP 的日度／副本 GM、场景多轮对白、委托实物领取与交付、结算记忆和次日安排；四位队员、玛丽埃塔与艾比希斯参与剧情调度，固定生活锚点和随机情境指导自由事件，无必演顺序。剧情名单与战斗解锁独立。

每周一公款与五项设施修缮／升级已开放；公款仅用于工程，DEMO不设考核或断供。事件损坏维修、更多地牢、高等级和通用多人骰子事件尚未开放。实现与测试通过不等于文学、美术或完整玩家体验已经验收。

## 本地运行

使用 [.nvmrc](.nvmrc) 指定的 Node 22.23.2，npm 10.9.8。

```sh
npm ci
npm run dev:game   # 正式主应用，http://127.0.0.1:5190/
npm run dev:lab    # 组件与演出实验，5191
npm run dev:tools  # 制作工具，5192
```

`npm run dev` 单独打开组件目录；`dev:new-shop`、`dev:battle-loot`、`dev:airp` 提供隔离调试入口。预览假数据不代表正式档案状态。完整入口和端口以 [config/entries.mjs](config/entries.mjs) 为准，目前登记22项：10个 game、7个 lab、5个 tool。

## 构建与检查

```sh
npm run typecheck:core
npm run typecheck:application
npm run typecheck:app
npm run boundaries:check
npm run test:core
npm run test:application
npm run test:app
npm run build:game
npm run check:output -- game
node scripts/check-doc-links.mjs
```

`npm run build` 仅构建 UI 组件库到 `dist/ui/`；`build:game` 输出 `dist/game/`，`build:lab`／`build:tools` 分别输出实验和工具。全量检查使用 `npm run check:baseline`，其中包含工具层检查；已知限制见状态页，不把专项通过写成全仓通过。

浏览器验收、真实模型生成和静态发布是独立工作，不由以上命令自动代表完成。当前发布流程见 [Cloudflare Pages](docs/deployment/AIRP_STATIC_HTTPS.md)。

## 源码职责

```text
src/game-core/            纯规则、内容合同、战斗与远征状态
src/game-application/     命令、事务、回执、事实与存储接口
src/game-infrastructure/  IndexedDB、模型 HTTP 与其他外部适配
src/game-runtime/         内容装配、查询、模型驱动
src/game-client/          会话、导航、共享业务界面
src/game-shell/           单入口路由、页面加载与样式隔离
src/apps/                正式页面及独立预览
src/content/             版本化玩法与剧情表现数据
src/shared/              UI、AVG／NVL、固定舞台、动效与工具
src/assets/              正式美术和授权说明
src/tools/               美术与内容制作工具
```

游戏规则经应用命令提交；UI 根据已提交状态演出。模型在受限协议内规划剧情和奇物文案，不能自行改写钱包、战斗或发放物品。应用间不直接互相导入，`shared` 不反向依赖游戏业务。详见 [application](src/game-application/README.md)、[client](src/game-client/README.md) 和 [shared](src/shared/README.md)。

固定场景在1600×900 Stage 内制作并统一等比适配，避免画布内部用视口单位重复缩放。组件和类型从 [src/index.ts](src/index.ts) 导出；图标授权、角色标定、素材来源在各资产目录保留。

## 素材与文案维护

```sh
npm run icons:sync
npm run icons:check
npm run emotes:build
npm run emotes:check
npm run pack:setting
```

手册编辑源为 [handbook.json](src/content/presentation/tutorial/handbook.json)，剧情在 [scenes](src/content/presentation/scenes)。作者原稿、冻结 r8 文风样本与素材授权不能当作过时工程日志删除；具体入口见文档索引。
