# Abyssa 代码维护与大文件盘点

> 盘点日期：2026-09-03
> 基准起点：`314e31b chore: checkpoint current development baseline`
> 统计对象：当前工作树，包含未提交的 no-unused 清理、共享样式/API 治理、`src/apps/map/sortie/`、地图队伍立绘与独立校准工作台、设置页及用途化素材目录
> 当前阶段：概念原型 / 垂直切片验证期

## 1. 结论摘要

当前有效代码共有 **546 个文件、94,678 个物理行**。其中生产代码 77,927 行、测试代码 15,939 行、Storybook stories 812 行。仓库现有 **18 个 Vite 入口**：1 个组件目录、12 个场景／实验入口和 5 个制作工具。与 2026-09-01 的盘点相比，净增 **72 个文件、15,192 行**，主要来自队伍立绘共享校准、地图交互与外框回归、独立 Party Figure Studio，以及新增的设置页概念入口。

当前结构判断：

- `src/shared` 已成为最大区域：175 个文件、28,520 行；
- `src/apps/battle` 为第二大区域：102 个文件、23,502 行；
- 两者合计 52,022 行，占全部有效代码 **55.0%**；
- 当前有一个超过 1,500 行的生产文件；
- 最大生产文件是 1,808 行的 `sortie.css`；
- 最大生产 React 文件是 775 行的 `ExpeditionBattleScreen.tsx`；
- 另一个超过 1,500 行的文件是 2,002 行的高覆盖率战斗规则测试。

本次全量质量基线正常：

- **80 个测试文件、695 项测试全部通过**；
- TypeScript 类型检查和模块边界检查通过；
- 默认组件库、全部应用/工具入口与 Storybook 构建通过；
- 发布包动态导入、声明文件、资产清单和体积门禁通过；
- 当前没有已知 P0 正确性、类型、构建或模块边界回归。

本阶段完成后风险地图为：

1. **已关闭 P1：共享 CSS 与公共 API 边界。** 样式已按 core、角色状态和内部角色档案分层；Library CSS 从 248,826 B 降至 214,817 B，公共类型出口也已补齐。
2. **延期 P1：地图 Sortie 的跨应用消费闭环。** 地图端 UI、规则校验和出击令写入已经接入；按当前产品安排暂不实现 battle 端的读取、解析、消费与清理。
3. **P2：大型领域 CSS、`DiceLoadoutPanel` 与大型测试。** 已有明确所有权或高价值覆盖，按功能变化和协作痛点拆分，不按行数机械搬运。

原 P1“大型 PNG 内联与发布包膨胀”继续保持关闭；共享样式与公共 API P1 也已在本阶段关闭。

核心玩法 UI 已进入冻结与缺陷修正阶段：地图选点、委托简报、编队、预备出征、战斗交互、深入/撤离和战斗结算均已有稳定界面。后续优先处理跨应用状态交接、正式内容替换和局部问题，不再横向重构现有版面。

## 2. 盘点口径与代码量

统计包含 `.ts`、`.tsx`、`.css`、`.js`、`.mjs`、`.html`、`.py`，排除：

- `dist/`、所有 `*-dist/` 和 `storybook-static/` 构建产物；
- `static-preview/` 静态分享产物；
- `references/` 参考稿；
- `node_modules/`、Git 元数据；
- `.storybook/` 等点目录中的工具配置；
- Markdown、JSON、图片、SVG、字体等非代码文件。

这里统计的是物理行数，用于识别维护热点，不等同于复杂度、有效语句数或功能量。

### 2.1 按用途统计

| 用途 | 文件数 | 物理行数 | 占总行数 |
| --- | ---: | ---: | ---: |
| 生产代码 | 444 | 77,927 | 82.3% |
| 测试代码 | 80 | 15,939 | 16.8% |
| Storybook stories | 22 | 812 | 0.9% |
| **合计** | **546** | **94,678** | **100%** |

### 2.2 按文件类型统计

| 类型 | 文件数 | 物理行数 | 占总行数 |
| --- | ---: | ---: | ---: |
| TypeScript `.ts` | 218 | 31,253 | 33.0% |
| React `.tsx` | 201 | 30,692 | 32.4% |
| CSS | 98 | 30,259 | 32.0% |
| JavaScript / MJS | 9 | 2,088 | 2.2% |
| HTML | 19 | 303 | 0.3% |
| Python | 1 | 83 | 0.1% |
| **合计** | **546** | **94,678** | **100%** |

### 2.3 主要模块体量

该表包含模块内实现、测试、stories 与 CSS。

| 模块 | 文件数 | 物理行数 | 当前判断 |
| --- | ---: | ---: | --- |
| `src/shared` | 175 | 28,520 | 最大且影响面最广；新增三层样式入口与边界契约测试 |
| `src/apps/battle` | 102 | 23,502 | 最大业务域；规则和战斗表现测试充分，继续避免页面重新聚集职责 |
| `src/tools` | 36 | 7,160 | 新增地图队伍立绘校准工作台；各工具保持独立入口 |
| `src/apps/map` | 29 | 7,049 | Sortie 三态 UI、委托态对侧集结与整体转身、共享校准、地图外框回归均已接入 |
| `src/apps/dice` | 40 | 6,005 | round、Runtime、结算与 view model 边界稳定 |
| `src/apps/mansion` | 23 | 5,555 | 页面、状态、世界与区域样式已有拆分边界 |
| `src/apps/menu` | 17 | 2,268 | 枢纽页和标题栏边界明确 |
| `src/apps/title` | 13 | 1,787 | 命令、主题、CG、几何与入口测试已分层 |
| `src/apps/settings` | 12 | 1,679 | 独立设置概念页；模型对齐现有旋钮，但当前状态只在本页预览 |
| `src/apps/rp` | 8 | 1,480 | 应用壳与共享 RP 场景边界明确 |
| `src/apps/character-status` | 4 | 360 | 三页角色档案的应用接线层，显式选择三层样式包 |

`shared` 与 `battle` 合计 52,022 行，占全部有效代码约 **55.0%**，仍是长期维护资源最应集中的两个区域。

### 2.4 相对上次盘点的变化

| 指标 | 2026-09-01 | 当前 | 变化 |
| --- | ---: | ---: | ---: |
| 文件数 | 474 | 546 | +72 |
| 总行数 | 79,486 | 94,678 | +15,192 |
| 生产代码 | 67,214 | 77,927 | +10,713 |
| 测试代码 | 11,459 | 15,939 | +4,480 |
| `src/shared` | 22,341 | 28,520 | +6,179 |
| `src/apps/battle` | 24,926 | 23,502 | -1,424 |
| `src/apps/map` | 1,557 | 7,049 | +5,492 |

这不是简单的全项目膨胀：新增功能主要进入共享角色领域、地图 Sortie 与独立工具；战斗、骰局和若干页面则因启用 `noUnusedLocals`、`noUnusedParameters` 清除了未引用实现。删除 `src/apps/battle/data.ts` 和 `src/apps/dice/dice-secondary-panels.css` 后，类型检查与全量测试仍通过。

## 3. 本轮大更新盘点

### 3.1 角色档案三页体系

角色状态入口已经从单一概要页扩展为 **概要 / 骰装 / 记事** 三页：

| 能力 | 当前规模 | 直接安全网 |
| --- | ---: | ---: |
| Chronicle 内容、领域、面板、几何与样式 | 7 文件 / 2,243 行 | 内容 8 项；面板 26 项；几何 5 项 |
| Dice loadout 内容、领域、面板、几何与样式 | 9 文件 / 3,139 行 | 内容 10 项；面板 32 项；几何 6 项 |
| 角色状态应用接线 | 4 文件 / 360 行 | App 7 项 |
| `BondCrystal.tsx` 羁绊晶体 | 378 行 | 由 Status/Chronicle 组合测试覆盖 |

当前正向判断：

- 角色内容数据、几何计算和 React 面板已有独立边界；
- `CharacterStatusScreen` 通过 `renderTabPanel` 接入不同页签，没有把三页实现全部塞回应用层；
- 骰面和角色档案内容模型已有直接测试；
- Chronicle 与 Dice loadout 的空态、角色切换、语义和主要几何行为已有覆盖。

维护注意点：

- `DiceLoadoutPanel.tsx` 已达 686 行，是当前最值得观察的可复用 React 组件；
- 三组角色档案 CSS 共 2,718 行，但现在只由角色状态应用的专用入口加载；
- 新面板和羁绊晶体暂定为产品内部能力，已有公共 props 依赖的辅助类型已成套导出。

### 3.2 地图 Sortie UI 与队伍立绘

`src/apps/map/sortie/` 当前为 **15 个文件、4,768 行、59 项直接测试**；加上 `MapPage.test.tsx` 的 17 项集成测试，地图 Sortie 已覆盖：

- `map / team / pop` 三态互斥、从委托人物进入编队后的来路保持，以及地图拾取开关；
- 委托展开时同一棵队伍 DOM 不再消失：小队放大并在侧板对侧集结；侧板在左时槽位外层整体转身，逐角色 `scale / x / y / flipX` 校准保持不变；
- 最多四个可选队员、凯尔第五席与亲征/托管；九名角色均可进入预览编队，伤势或无骰面只在最终出发时拦截；
- 阵容骰面、命数、花色、阵营构成以及不输出胜率/难度评级的赌法描述；
- 节点、空队、重复成员、人数、未知成员和成员可用性的写入前校验；
- 版本 1 出击令写入 `sessionStorage`，并跳转到 battle 入口。

`src/assets/map/party-figures/` 现有 10 张 `512 × 512` RGBA Q 版立绘，共 **2,383,296 B**。`catalog.ts` 统一提供十人 URL 与中文名；`src/content/characters/partyFigureCalibration.ts` 统一提供 `scale / x / y / flipX`、取值范围、校验和稳定 JSON / TypeScript 序列化。地图与工具不再维护两份素材 import 或角色参数。

本次交互与画面收口包括：

- 地图态对整棵槽位树禁用命中，由外层舞台统一接收点击；四席排满后点击任意人物仍能重新进入编队；
- 地图外侧收起态使用 `600 × 210` 舞台，五席在保持横向可读的同时轻微收拢；编队展开态使用 `880 × 350` 舞台，五席收紧为一组，命中盒最多轻叠 5px；委托态形成约 780px 宽的贴底集结视觉，并以逐席错峰落定强化即将出征的动势；人物背后不再绘制大块深色矩形；
- 委托态透明舞台不拦截暗幕，只有实际人物恢复命中并可直接进入编队；副本面板保持 `z-index: 10`，队伍位于暗幕之上的 `z-index: 9`，不会抢占侧板操作；
- 十人已审定默认基线已回填共享校准，完整参数表记录在立绘目录 README；其中 `alvitr` 为 `scale: 1.11 / x: 4 / flipX: true`，`elora` 为 `scale: 1 / x: 5.5 / flipX: true`，`kororo` 也以运行时 `flipX` 修正动作流；其余非中性缩放与偏移同样属于共享基线而非地图局部覆盖，`eustice` 只保留 PNG 已烘焙的翻转；
- PNG 运行时轮廓使用 `contrast(1.07)` 与三层紧凑 `drop-shadow`；地图态、team 态和委托集结态共享脚底中心校准，只有槽位布局、整组朝向和显示比例不同；team 态图片占扣除 24px 名条与 8px 间距后剩余 art 高度的 100%。

新增独立 `party-figure-studio`：**10 个实现/测试文件、1,901 行、13 项直接测试**。工作台提供十人选择、512 单图与 `880 × 350` 五人实机比例预览、三种背景、基线、`scale / x / y / flipX`、版本化 `v3` localStorage、当前/全部重置、JSON/TypeScript 导入、复制与下载。它只按 `tool -> content/assets` 消费共享数据，不依赖 map app；五人模式同步复刻 team 态的槽位几何、24px 名条、8px 间距，图片占剩余 art 高度的 100%，避免“工作台对齐后进游戏又改变比例”。

名单海报仍读取 `portraitUrl`；“当前队伍”摘要与委托中四个成员小槽统一读取 `thumbnailUrl` 并复用共享 `AvatarFrame` 木金切角框，凯尔第五席仍读取旧 `portraitUrl`。透明边缘、V2 色调、烘焙/运行时翻转区别、参数回填流程和接入边界记录在同目录 `README.md` 与 `src/tools/README.md`。

当前未完成的是 **map → battle 的跨应用消费闭环**：battle 入口尚未以运行时 schema 读取、验证、消费或清理出击令，也没有损坏 JSON、未知版本、过期指令与跨入口交接测试。按产品安排继续延期，不影响当前地图端编队与写入路径。

### 3.3 标题、标题栏与骰面

这些上一阶段重点在本次更新后仍保持明确边界：

| 内容 | 当前规模/关键文件 | 维护判断 |
| --- | ---: | --- |
| 标题画面 | 13 文件 / 1,787 行；`TitlePage.tsx` 183 行；`title.css` 575 行 | 命令、主题、CG、几何分层保持稳定 |
| 枢纽标题栏 | `MenuTopBar.tsx` 119 行；`menu-topbar.css` 323 行 | 天数、相位、资源继续保持只读展示 |
| 共享战斗骰面 | 4 文件 / 926 行；最大文件 513 行 | 战斗与骰子工作室继续共同消费 shared 实现 |
| 骰子工作室 | `App.tsx` 546 行；CSS 565 行 | 配置状态继续增长时优先提取纯 model |
| 酒馆骰局 | 40 文件 / 6,005 行；`game.ts` 505 行 | 调度、结算、Runtime 与规则边界保持稳定 |

标题栏不应复制洋馆的时间推进状态；骰面结构调整应同步验证战斗与骰子工作室两个真实消费方。

### 3.4 设置页概念入口

新增 `settings` 独立入口：应用目录为 **12 个文件、1,679 行**；连同 `settings.html` 与 `vite.settings.config.ts`，本次入口增量共 **14 个文件、1,711 行**，并有 9 项直接测试。

当前边界如下：

- 演出节奏与视觉显示只收录能够指向现有下游旋钮的项目，默认值对齐 RP 当前的 step / dur、自动播放、版式过场与取景参数；
- 页面复用 shared 的固定舞台、页签、画框和按钮，不直接导入 `rp` app；
- 用户修改仅投影到设置页自身的预览与 CSS 变量，刷新后恢复默认，尚未写入 localStorage、sessionStorage 或统一配置层，也不会改变其他入口；
- AI 服务页在后端契约确定前保持禁用占位，不提前固化密钥、Provider 或模型表单。

因此它应被描述为“设置界面概念预览”，而不是已经接通的全局设置中心。后续真正接线时，需要先确定配置所有权、持久化范围、版本迁移和各 app 的读取契约。

### 3.5 素材目录收口

`src/assets` 已从按 PNG/SVG 格式和历史批次堆放，收口为 8 个用途目录：`characters / backgrounds / battle / map / ui / icons / emote / cg`。本轮以 Git rename 保留了 **518 个文件**的历史；`scenes/ui/icons` 没有继续扩张多层分类，只有数量较大的物品图标集中在 `icons/items`。

当前素材事实：

- `/Users/liuhang/Downloads/q-char` 对应的 10 张地图队伍立绘已进入 `src/assets/map/party-figures/`，由同目录 catalog 统一映射；
- `bg-a.jpg` 至 `bg-c.jpg` 已按场景语义命名为三张委托背景并进入 `src/assets/map/quest-backgrounds/`；
- `src/assets/ui/abyssa-wordmark.svg` 是完整 Logo 的字标部件；完整徽记由 `AbyssaLogo.tsx` 组合绘制，不存在另一张完整 Logo SVG；
- 地图地面、三个地图节点图，以及骰局/商店中的部分 Tibby 立绘仍来自 `files.catbox.moe`，尚未完成全离线化；
- `icons/items/ATTRIBUTION.md` 继续作为物品图标授权事实来源。

目录迁移只改变所有权和路径，不改变原图内容。后续新增素材按消费场景落位，不再新建 `png2`、`png3`、`svg/ui` 这类格式或临时批次目录。

### 3.6 no-unused 清理

当前工作树的大量删除主要来自 TypeScript 启用：

- `noUnusedLocals`；
- `noUnusedParameters`。

这轮清理横跨 battle、dice、mansion、menu、title、RP、shared 与 tools。类型检查、695 项测试和全部入口构建通过，说明现有引用链已经完成清理；后续不应为恢复旧草稿而回填已删除符号。

## 4. 已完成的结构治理基线

此前批次 A–H 的成果仍有效：

- 共享战斗 UI、骰局和 RP 场景已拆出组合入口、状态与生命周期边界；
- Studio、洋馆区域编辑器和 Three.js 地图已有直接测试；
- 菜单、骰局、共享骰面、标题页与骰子工作室均已有独立维护边界；
- 原有 `tool -> app` 骰面依赖已迁至 `src/shared/ui/dice-face`；
- 大型 PNG 已从 JS/CSS data URL 外置，`public/mansion-map` 不进入 library 发布包；
- 根入口保持 103 项运行时导出，并保留 `branding`、`patterns`、`primitives` 三个子路径；
- `npm pack` 继续由 `prepack` 自动执行真实发布门禁；
- `package.json` 仍保留 `"private": true`，构建可发布不代表授权对外发布。
- 共享样式已拆为 core、公共角色状态和内部角色档案三层，应用入口改为显式消费；
- 公共角色组件签名所需的辅助类型已在根入口和 `patterns` 子路径对齐。

以下旧 P1 保持关闭：

- 骰局等待任务取消、重开局隔离和陈旧 Runtime 回应；
- 骰面从工具跨应用依赖改为 shared 所有权；
- 发布 PNG 重复内联和公共地图目录误入 npm 包；
- 角色档案样式扩散与公共类型出口不完整。

## 5. 当前全部 500 行以上文件

大文件等级用于发现风险，不是强制拆分规则。

| 等级 | 参考范围 | 含义 |
| --- | ---: | --- |
| 超大 | ≥ 1,500 行 | 必须检查职责混合、回归面或测试可检索性 |
| 大型 | 800–1,499 行 | 应有明确所有权与拆分边界 |
| 观察 | 500–799 行 | 可以保留，但不宜无边界增长 |

### 5.1 超大文件（≥ 1,500 行）

| 文件 | 行数 | 优先级 | 当前判断 |
| --- | ---: | --- | --- |
| `src/apps/battle/engine.test.ts` | 2,002 | P2 | 高价值规则测试；仅在定位或冲突成为问题时按规则族拆分 |
| `src/apps/map/sortie/sortie.css` | 1,808 | P2 | 核心版面已冻结，且有 layout/cascade 回归；下一次发生跨区覆盖或并行冲突时按 stage / roster / quest 拆分 |

`sortie.css` 是当前唯一超大生产文件；暂不为降低行数机械拆分，但不再继续向其中横向增加新界面域。

### 5.2 大型文件（800–1,499 行）

| 文件 | 行数 | 优先级 | 当前判断 |
| --- | ---: | --- | --- |
| `src/apps/battle/expedition-skins.css` | 1,314 | P2 | 皮肤域明确；按具体皮肤变化再拆 |
| `src/apps/battle/ExpeditionBattleScreen.test.tsx` | 1,173 | P2 | 高价值场景测试；可按回合、骰盘、动作演出拆 |
| `src/apps/battle/engine.baseline.test.ts` | 1,110 | P2 | 固定种子语义基线；优先保持可比性 |
| `src/shared/ui/styles/components-dice-loadout.css` | 1,070 | P2 | 只进入角色档案专用入口；按内部区域变化再拆 |
| `src/shared/ui/styles/components-status-panel.css` | 980 | P2 | 状态面板域明确，已归入公共角色状态样式包 |
| `src/shared/ui/styles/components-character-screen.css` | 937 | P2 | 单一角色状态屏所有权，暂不机械拆分 |
| `src/apps/battle/expedition-interaction.css` | 923 | P2 | 交互域明确；出现覆盖冲突时再细分 |

### 5.3 观察文件（500–799 行）

| 文件 | 行数 | 优先级 | 建议 |
| --- | ---: | --- | --- |
| `src/apps/battle/ExpeditionBattleScreen.tsx` | 775 | P2 | 已完成当前拆分，继续只做页面编排 |
| `src/tools/party-figure-studio/party-figure-studio.css` | 755 | P2 | 单一工具入口；面板稳定后再按 roster/preview/inspector 拆分 |
| `src/shared/ui/styles/items.css` | 720 | P2 | 随库存功能按 slot/grid/dialog 拆 |
| `src/shared/ui/styles/components-controls.css` | 719 | P2 | 共享控件域清楚，观察跨组件覆盖 |
| `src/shared/ui/patterns/DiceLoadoutPanel.tsx` | 686 | P2 | 功能增长时提取分区组件或纯 view model |
| `src/apps/catalog/App.tsx` | 679 | P2 | 登记数据增长时提取分类清单 |
| `src/shared/ui/styles/components-character-chronicle.css` | 668 | P2 | 记事域明确，已从公共 library 与无关应用解耦 |
| `src/apps/battle/rules/turns.ts` | 638 | P2 | 规则内聚且有直接测试 |
| `src/apps/battle/expedition-shell.css` | 612 | P2 | 壳层边界合理，保持 |
| `src/apps/mansion/mansion-world.css` | 610 | P2 | 世界层所有权清楚，保持 |
| `src/shared/ui/patterns/CharacterChroniclePanel.test.tsx` | 610 | P2 | 仅在检索困难时按时间线、空态和交互拆 |
| `src/content/characters/profiles.ts` | 609 | P2 | 集中角色内容；按角色分工出现协作冲突时拆 |
| `src/apps/mansion/MansionPage.tsx` | 607 | P2 | 已是组合入口，避免重新聚集状态 |
| `src/apps/map/sortie/sortie-layout.test.ts` | 581 | P2 | 集中保护舞台、名单、委托集结与两侧镜像几何；仅在检索困难时按区域拆分 |
| `src/shared/ui/patterns/DiceLoadoutPanel.test.tsx` | 576 | P2 | 与面板能力同步维护，不减少覆盖 |
| `src/apps/title/title.css` | 575 | P2 | 主题入口职责清楚，观察场景变体增长 |
| `src/tools/dice-studio/dice-studio.css` | 565 | P2 | 面板结构稳定后再按所有权拆分 |
| `src/apps/rp/App.tsx` | 559 | P2 | 功能增长时抽阅读控制 hook |
| `src/apps/settings/settings.css` | 556 | P2 | 设置页单一入口；真实接入配置层后再按页签职责拆分 |
| `src/apps/mansion/data.ts` | 555 | P2 | 集中内容定义，当前可保持 |
| `src/apps/dice/dice-board.css` | 554 | P2 | 单一骰盘域，保持 |
| `src/shared/ui/ui.test.tsx` | 552 | P2 | 仅在定位困难时按 primitive/pattern/screen 拆 |
| `src/tools/dice-studio/App.tsx` | 546 | P2 | 配置状态继续增长时提取纯 model |
| `src/shared/ui/styles/rp-bubble-effects.css` | 541 | P2 | 气泡演出域明确，保持 |
| `src/shared/ui/styles/components-dialogue.css` | 521 | P2 | 对话域清楚，观察跨组件覆盖 |
| `src/apps/map/createMapScene.ts` | 515 | P2 | Three.js 场景装配边界明确；新增节点或镜头行为时优先提取纯配置 |
| `src/shared/ui/styles/battle-field.css` | 514 | P2 | 战场域清楚，保持 |
| `src/shared/ui/dice-face/ExpeditionFlatDieFrame.tsx` | 513 | P2 | 共享所有权明确；按 SVG 图元独立变化需求再拆 |
| `src/apps/battle/rules/resolver.test.ts` | 510 | P2 | 随效果族扩展拆分 |
| `src/tools/studio/studio.css` | 510 | P2 | 随面板变化再按工具区域拆 |
| `src/apps/dice/game.ts` | 505 | P2 | 纯规则且有直接测试，保持 |

## 6. 共享 CSS、公共 API 与发布边界

### 6.1 已关闭：共享样式入口过宽

共享组件样式现在分为三层：

| 样式入口 | 所有权 | 内容 |
| --- | --- | --- |
| `components-core.css` | 跨应用公共层 | foundation、controls、dialogue |
| `components-character-status.css` | 已公开角色模式 | selector、StatusPanel、CharacterStatusScreen |
| `components-character-archive.css` | 产品内部 feature | Dice loadout、Chronicle |

`components.css` 继续作为源码兼容聚合入口，按 core → character status → character archive 的原有层叠顺序导入三层；旧调用方不会因入口移动而改变选择器顺序。

公共 library 的 `index.css` 只导入 core 和已公开的 character status 层，不再发布骰装与记事样式。角色状态应用显式导入三层和 `items.css`；battle、dice、map、mansion、menu、title、RP、loading、shop 与 Studio 只引入实际所需样式。

新增 `style-entry-boundaries.test.ts` 固定三层内部顺序、公共入口排除规则和全部应用/工具入口的显式导入约束。

### 6.2 已关闭：公共 API 策略不完整

已有公共 props 会直接引用的辅助类型，现已同时从根入口和 `patterns` 子路径导出：

- `CharacterTabRenderArgs`；
- `StatusPanelAffiliation`、`StatusPanelAffiliationTone`；
- `StatusBond`、`StatusChip`、`StatusPact`。

以下仍在快速演进、且依赖产品领域模型的实现明确保留为内部 feature：

- `CharacterChroniclePanel`；
- `DiceLoadoutPanel`；
- `BondCrystal` 独立组件。

这三者不进入公共运行时导出，其骰装/记事样式也不进入公共 CSS。未来如需公开，应在同一批次公开依赖的领域类型、组件 props、样式入口和契约测试，不能只加一个运行时 export。

### 6.3 体积与发布结果

Vite 输出中的 CSS 体积（十进制 kB）变化如下：

| 入口 | 治理前 | 当前 | 减少 |
| --- | ---: | ---: | ---: |
| battle | 406.03 kB | 297.39 kB | 108.64 kB |
| RP | 328.35 kB | 184.06 kB | 144.29 kB |
| Studio | 299.85 kB | 155.57 kB | 144.28 kB |
| shop | 283.54 kB | 81.65 kB | 201.89 kB |
| character-status | 258.12 kB | 180.19 kB | 77.93 kB |
| dice | 195.38 kB | 86.72 kB | 108.66 kB |
| loading | 167.77 kB | 59.11 kB | 108.66 kB |
| map | 162.83 kB | 104.91 kB | 57.92 kB |

Library CSS 从 248,826 B 降至 **214,817 B**（约 209.78 KiB），减少 34,009 B；256 KiB 门禁占用从约 94.9% 降至 **82.0%**，当前可用余量约 **46.22 KiB**。

当前发布结果：

| 指标 | 当前结果 |
| --- | ---: |
| 发布包压缩体积 | 6,623,054 B（6.32 MiB） |
| 发布包解包体积 | 7,191,899 B（6.86 MiB） |
| 发布文件 | 184 |
| 外置 PNG | 7 |
| Library CSS | 214,817 B |
| Library 全部 JS | 279,012 B |
| 根入口运行时导出 | 103 |
| `branding` / `patterns` / `primitives` | 14 / 32 / 57 |

`scripts/check-package-release.mjs` 除原有四入口、声明、资产、data URL 和体积门禁外，现在还会验证：

- 公共 CSS 必须继续包含 StatusPanel 与 CharacterStatusScreen；
- 公共 CSS 不得重新包含 Dice loadout 与 Chronicle；
- 类型补全不改变 103 / 14 / 32 / 57 的运行时导出契约。

## 7. 验证基线

本轮重新审计实际执行并通过：

~~~bash
npm test -- --maxWorkers=1 --no-file-parallelism
npm run typecheck
npm run boundaries:check
npm run release:check
npm run build:battle
npm run build:character-status
npm run build:dice
npm run build:map
npm run build:mansion
npm run build:menu
npm run build:title
npm run build:rp
npm run build:settings
npm run build:shop
npm run build:novel
npm run build:loading
npm run build:mansion-editor
npm run build:studio
npm run build:party-figure-studio
npm run build:logo-studio
npm run build:dice-studio
npm run build-storybook
~~~

结果：

- Vitest：80 个测试文件、695 项测试全部通过；
- map：11 个测试文件、87 项测试通过；在 4 项外框布局回归之外，委托集结、视觉聚焦、队伍前顶和横幅裁切边缘均有直接回归覆盖；
- party-figure-studio：3 个测试文件、13 项测试通过；独立生产构建成功，浏览器复核十人名册、Alvitr `1.11 / x+4 / flipX` 与五人实机比例预览，并以直接测试锁定 `v3` 存储键；
- settings：1 个测试文件、9 项测试通过；独立生产构建成功，默认值、顶部页签、重置、显示开关和 AI 禁用占位均有直接覆盖；
- shop 改为直接依赖 shared 后，ShopPage 与样式边界 2 个文件、7 项针对性回归再次通过；
- TypeScript：无类型错误；
- 模块边界：无意外跨层依赖；
- 默认 library build 与上述全部应用/工具入口构建成功；新增 Party Figure Studio 也有独立 dev / preview / build 入口；
- Storybook 构建成功，仅保留已有 Axe/iframe 大 chunk 警告；
- `release:check` 通过，四入口、声明、资产清单和体积预算均正常。

未执行 `build:preview`，因为它会改写刻意提交的 `static-preview/` 分享产物；本轮审计不需要刷新该产物。

## 8. 当前风险地图

| 优先级 | 含义 | 当前数量 |
| --- | --- | ---: |
| P0 | 当前质量门禁、正确性、构建或数据风险 | 0 |
| P1 | 跨应用闭环启用前应治理；当前可按产品安排延期 | 1 个延期主题 |
| P2 | 可随功能变化或实际协作痛点渐进处理 | 若干观察项 |

### 8.1 已关闭：共享 CSS 与公共 API 边界

该 P1 已完成：三层样式入口、应用显式消费、内部 feature 隔离、公共类型出口和发布产物断言均已落地。

持续约束：

- 不把 Dice loadout / Chronicle 重新放回公共 `index.css`；
- 新 public 组件必须同时处理运行时、类型和样式出口；
- 新应用入口使用显式样式包，不回退到全量 `components.css` / `index.css`；
- 继续保留 256 KiB 发布门禁，不用放宽预算替代所有权治理。

### 8.2 延期 P1：Sortie 跨应用消费闭环

地图端三态 UI、委托态小队对侧集结/转身、成员可用性与命中规则、写入前校验和版本 1 出击令写入已经完成。本阶段按产品安排不继续实现 battle 读取端；以下完成标准保留，供未来恢复时使用：

完成标准：

- battle 端以运行时 schema 解析版本化数据，不信任原始 `sessionStorage`；
- 对损坏、未知版本、过期、未知成员和不可用成员定义降级/清理行为；
- 成功消费后明确是否清除出击令；
- 增加 map → storage → battle 的端到端契约测试。

### 8.3 P2：按需整理

- `components-dice-loadout.css`、`components-status-panel.css` 和 Chronicle CSS：加载边界已解决，只按内部职责变化决定是否拆文件；
- `sortie.css`：当前按注释与选择器前缀分区，并有 layout/cascade 测试；发生舞台、名单、委托三方并行冲突时再拆文件；
- `party-figure-studio.css`：当前只属于独立校准工具；超过 800 行或多人并行修改时，按 roster / preview / inspector 拆分；
- `DiceLoadoutPanel.tsx`：出现第三组独立状态、复杂计时器或多人冲突时拆分；
- 大型测试：在定位慢或合并冲突明显时按能力域拆，不减少覆盖；
- `profiles.ts`、`mansion/data.ts`：内容协作需要独立所有权时按角色/区域拆；
- 已有清晰领域边界的 `expedition-*.css`、`mansion-*.css` 保持现状。

## 9. 下一阶段维护顺序

1. **守住新的样式和 API 边界。** 新 feature 选择显式入口，公共导出与发布样式同步评审。
2. **冻结现有角色档案模型边界。** 新内容优先进入 content/domain，面板只消费稳定模型。
3. **标题、标题栏与骰面按现有所有权演进。** 结构搬迁与视觉/规则变化分开评审。
4. **大型文件由实际痛点触发拆分。** 以职责、测试可检索性和冲突频率为依据，不追求数字好看。
5. **队伍立绘只维护一套共享校准。** 调整先在 Party Figure Studio 完成并导出，再审核回填 content；不要在 map 或 tool 中复制第二份角色参数。
6. **设置页先保持概念入口边界。** 在配置所有权和持久化契约确定前，不把页内 reducer 或 CSS 变量描述成全局设置，也不添加没有下游的假开关。
7. **素材继续按用途落位。** 地图立绘、委托背景、Logo 字标和物品图标分别维护既有 catalog、来源说明与授权文件，不再按格式或导入批次新建目录。
8. **Sortie 只延期跨应用消费端。** 地图端继续按现有 UI/规则边界维护；产品决定让 battle 消费出击令时，再按 8.2 补运行时解析、降级、清理和端到端契约。

## 10. 不应手工维护的目录

以下内容是构建结果，应修改源文件后重新生成，不应直接修补：

- `dist/`；
- `battle-dist/`、`dice-dist/`、`map-dist/`、`party-figure-studio-dist/` 等所有 `*-dist/`；
- `storybook-static/`。

`static-preview/` 虽然是生成结果，但当前刻意提交用于直接分享，应只通过 `npm run build:preview` 更新。

图片和 SVG 不属于本轮“大代码文件”统计。`src/assets` 已改为按用途归类的 `characters / backgrounds / battle / map / ui / icons / emote / cg`；物品图标仅保留 `icons/items` 一层集中目录。地图队伍 Q 版立绘的来源映射、处理基线和接入边界记录在 `src/assets/map/party-figures/README.md`；授权与全仓重复项仍应在后续专项资产审计中检查。

## 11. 长期软限制

以下值适合作为 code review 提醒，暂不建议设为 CI 硬门槛：

| 文件类型 | 建议关注线 | 理想职责 |
| --- | ---: | --- |
| 页面 / Controller React 文件 | 800 行 | 组合、接线和少量页面状态 |
| 可复用 React 组件 | 500 行 | 单一交互或视觉模式 |
| 纯领域规则文件 | 700 行 | 单一规则族，可独立测试 |
| 单个 CSS 所有权文件 | 800–1,200 行 | 对应一个页面区域或组件族 |
| 单个测试文件 | 800 行 | 对应一个能力域，场景名称易检索 |

即使未超过关注线，出现以下信号也应拆分：

- 文件有多个互不相关的修改原因；
- 同一改动需要跨越相距数百行的代码；
- 一个组件拥有多组独立计时器、DOM refs 或状态机；
- CSS 依赖大量跨层覆盖或无法说明的导入顺序；
- 测试只能通过整页挂载验证本可独立测试的纯逻辑；
- 多人修改时频繁在同一文件产生冲突。

本盘点的目标不是把项目切成尽可能多的小文件，而是让每个业务域能够被独立理解、测试和演进。
