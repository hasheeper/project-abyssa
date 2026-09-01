# Abyssa 代码维护与大文件盘点

> 盘点日期：2026-09-01
> 基线提交：`e1274d3 feat(ui): establish interactive scene and theme baseline`
> 统计对象：当前工作树（包含尚未提交的维护拆分与既有功能改动）
> 当前阶段：概念原型 / 垂直切片验证期

## 1. 结论摘要

当前有效代码共有 **474 个文件、79,486 个物理行**。其中生产代码 67,214 行、测试代码 11,459 行、Storybook stories 813 行。`.ts` 文件共 26,593 行，占总量 **33.5%**；CSS 共 26,241 行，占 **33.0%**，二者是当前体量最大的维护对象。

大文件与发布边界治理批次 A–H 已全部完成：

- 共享战斗 UI、骰局、RP 场景均已拆出组件、状态与生命周期边界；
- Studio、洋馆区域编辑器和 Three.js 地图均已有直接测试与更小的组合入口；
- 菜单 CSS 已按 7 个视觉域等价拆分；
- 骰局 round hook 已拆出可取消调度器和结算层，并补齐重开局、陈旧 Runtime 回应与卸载清理测试；
- 战斗与骰子工作室共用的 4 个骰面文件已提升到共享层，原有 2 条 `tool -> app` 违规已经消除；
- 标题页、枢纽标题栏和六面骰工作室均已纳入直接测试与独立构建验证；
- 组件库大型 PNG 已从 JS/CSS data URL 中外置，`public/mansion-map` 不再进入发布包；
- 根入口保持 103 项运行时导出，同时新增 `branding`、`patterns`、`primitives` 三个公共子路径；
- `npm pack` 已加入自动预算门禁，压缩体积从 25.97 MB 降至 6.60 MB；
- 当前没有超过 1,500 行的生产文件；唯一超过该线的是高覆盖率测试文件；
- 当前最大的生产文件是 1,366 行的战斗皮肤 CSS，最大的生产 React 文件是 776 行的战斗页面。

当前质量基线正常：

- **57 个测试文件、480 项测试全部通过**；
- 标题、标题栏、战斗骰、骰局和骰子工作室的针对性回归共 15 个文件、145 项测试通过；
- TypeScript 类型检查与模块边界检查通过；
- 默认组件库、战斗、角色状态、骰局、菜单、标题、骰子工作室和 Storybook 构建通过；
- 发布包四入口动态导入、声明文件、7 张外置 PNG 与 7/8 MiB 压缩/解包预算门禁通过；
- 地图入口已完成拆包，最大 Three.js chunk 为 509.05 kB，低于项目设置的 520 kB 警戒线；
- 当前没有已知 P0 正确性、类型、构建或模块边界回归。

P1 发布体积问题已经关闭。下一阶段不建议继续按行数机械拆分，维护重点转为：

1. **P2：标题、标题栏与骰面视觉域。** 当前边界和安全网已经建立，后续随功能变化维护，不宜只为降低数字继续切分。
2. **P2：大型测试与清晰领域 CSS。** 它们可以在检索困难、合并冲突或所属功能变化时拆分，不应只为降低数字而搬文件。
3. **发布预算维护。** 公共 API、资产或样式确需增长时，应显式调整门禁并记录原因，不绕过 `prepack`。

## 2. 盘点口径与代码量

统计包含 `.ts`、`.tsx`、`.css`、`.js`、`.mjs`、`.html`、`.py`，排除：

- `dist/`、所有 `*-dist/` 和 `storybook-static/` 构建产物；
- `static-preview/` 静态分享产物；
- `references/` 参考稿；
- `node_modules/`、Git 元数据；
- Markdown、JSON、图片、SVG、字体等非代码文件。

这里统计的是物理行数，用于识别维护热点，不等同于复杂度、有效语句数或功能量。

### 2.1 按用途统计

| 用途 | 文件数 | 物理行数 | 占总行数 |
| --- | ---: | ---: | ---: |
| 生产代码 | 395 | 67,214 | 84.6% |
| 测试代码 | 57 | 11,459 | 14.4% |
| Storybook stories | 22 | 813 | 1.0% |
| **合计** | **474** | **79,486** | **100%** |

### 2.2 按文件类型统计

| 类型 | 文件数 | 物理行数 | 占总行数 |
| --- | ---: | ---: | ---: |
| TypeScript `.ts` | 186 | 26,593 | 33.5% |
| CSS | 90 | 26,241 | 33.0% |
| React `.tsx` | 171 | 24,234 | 30.5% |
| JavaScript / MJS | 9 | 2,063 | 2.6% |
| HTML | 17 | 272 | 0.3% |
| Python | 1 | 83 | 0.1% |
| **合计** | **474** | **79,486** | **100%** |

### 2.3 主要模块体量

该表包含模块内实现、测试、stories 与 CSS。

| 模块 | 文件数 | 物理行数 | 当前判断 |
| --- | ---: | ---: | --- |
| `src/apps/battle` | 103 | 24,926 | 最大业务域；页面、规则与骰面消费边界已经形成 |
| `src/shared` | 153 | 22,341 | 影响范围最大；新增 4 个共享骰面文件供战斗与工具复用 |
| `src/apps/dice` | 41 | 6,479 | round 调度、结算与生命周期已形成直接测试边界 |
| `src/apps/mansion` | 23 | 5,582 | 页面与样式已拆，后续以回归保护为主 |
| `src/tools` | 26 | 5,274 | 骰子工作室已有 2 项直接测试并只依赖共享层 |
| `src/apps/menu` | 17 | 2,227 | 标题栏与 7 个样式域边界清楚，已有页面回归保护 |
| `src/apps/title` | 13 | 1,790 | 标题入口、主题、CG 与几何均有直接测试 |
| `src/apps/map` | 12 | 1,557 | 生命周期、纹理释放和构建拆包已有直接验证 |
| `src/apps/rp` | 8 | 1,486 | 应用壳与共享场景样式边界已经明确 |

`battle` 与 `shared` 合计 47,267 行，占全部有效代码约 **59.5%**，仍是长期维护资源最应集中的两个区域。骰面文件从 `battle` 移入 `shared` 只改变所有权，不改变这两个区域的合计体量。

## 3. 已完成的维护批次

拆分目标是降低单文件认知成本、资源泄漏风险和回归范围，并非追求总行数下降。新增模块和测试使文件数与总行数增加是正常结果。

| 批次 | 维护对象 | 拆分前 | 当前结果 | 状态 |
| --- | --- | ---: | --- | --- |
| 前置 | 战斗 resolver | 1,447 行 | 公共入口 136 行；内部效果族独立 | 完成 |
| 前置 | 战斗页面 | 1,947 行 | 页面 776 行；视图与演出逻辑独立 | 完成当前阶段 |
| 前置 | 洋馆页面 | 1,678 行 | 页面 609 行；状态、视口、世界与抽屉独立 | 完成当前阶段 |
| A | `BattleScreen.tsx` | 1,188 行 | 组合入口 172 行；视图、类型和动作播放独立 | 完成 |
| A | 共享 `battle.css` | 1,889 行 | 8 行入口 + 7 个领域文件，最大 515 行 | 完成 |
| B | `DiceApp.tsx` | 884 行 | 页面 199 行；round、opponent、runtime 与 view model 独立 | 完成 |
| B | `dice.css` | 2,759 行 | 10 行入口 + 9 个领域文件，最大 555 行 | 完成 |
| C | `RpScene.tsx` | 761 行 | 组合入口 103 行；座席、消息、滚动和生命周期独立 | 完成 |
| C | 共享 `rp.css` | 1,690 行 | 7 行入口 + 7 个领域文件，最大 542 行 | 完成 |
| C | RP `app.css` | 576 行 | 4 行入口 + 4 个应用壳文件，最大 284 行 | 完成 |
| D | Studio `App.tsx` | 775 行 | 主工具 412 行；座席面板与参数类型独立 | 完成 |
| D | 洋馆区域编辑器 | 913 行 | 主编辑器 447 行；Canvas、Sidebar、viewport 与 model 独立 | 完成 |
| D | 地图场景 | 625 行 | 场景 420 行；纹理和 runtime 生命周期独立 | 完成 |
| E | `menu.css` | 1,130 行 | 7 行入口 + 7 个视觉域文件，最大 333 行 | 完成 |
| F | `useDiceRound.ts` | 538 行 | round hook 416 行；可取消调度器与结算表现独立 | 完成 |
| G | 骰面共享所有权 | 2 条 `tool -> app` 违规 | 4 个文件、933 行提升到 `shared`；战斗与工具共同消费 | 完成 |
| H | 组件库发布边界 | 25.97 MB 压缩 / 29.53 MB 解包 | 6.60 MB 压缩 / 7.12 MB 解包；四入口、外置资产与预算门禁 | 完成 |

### 3.1 本轮纳入盘点的新内容

| 内容 | 当前规模 | 已建立的边界与安全网 |
| --- | ---: | --- |
| 标题画面 `src/apps/title` | 13 文件 / 1,790 行 | 页面 183 行；命令、三套主题、双侧 CG 与几何独立；48 项测试 |
| 枢纽标题栏 | 119 行 TSX + 333 行 CSS | 天数、四相位和三类资源只读展示；由 6 项 `MenuPage` 测试覆盖 |
| 共享战斗骰面 | 4 文件 / 933 行 | 六面体与双层骰面位于 `src/shared/ui/dice-face`；战斗与工作室不再跨应用依赖 |
| 骰子工作室 | 4 文件 / 1,165 行 | 六面配置、图章布局、本地持久化、投掷和图层预览；新增 2 项直接测试 |
| 酒馆骰局 `src/apps/dice` | 41 文件 / 6,479 行 | round、结算、Runtime、view model 与表现层分离；47 项测试 |

新增或强化的安全网包括：

- 共享战斗组件的动作、命中与卸载清理；
- 骰局 view model、Runtime 与页面异步流程；
- RP 座席替换、离场、查阅模式和自动滚动；
- Studio 参数格式、座席接线与复制反馈计时器清理；
- 洋馆编辑器导入导出、矩形归一化与 Canvas 交互；
- 地图提前销毁、幂等清理、纹理释放和场景集成；
- 骰局等待任务批量取消、卸载清理、结算取消、重开局隔离与陈旧 Runtime 回应拒绝；
- 骰子工作室六面共享渲染、切面同步和卸载时投掷计时器清理；
- 标题画面的主题、CG 时序、几何、转场与无障碍语义，以及枢纽标题栏的时间和资源读数。

## 4. CSS 等价性、构建拆包与发布边界

### 4.1 CSS 拆分校验

以下哈希是相应 CSS 拆分完成时的验收快照：入口按 `@import` 顺序拼接领域文件后，与基线提交中的原文件 SHA-256 完全一致。后续功能新增的样式不应再用这些历史哈希判定是否回归。

| 样式入口 | 领域文件数 | 拼接 SHA-256 |
| --- | ---: | --- |
| `src/apps/battle/expedition.css` | 10 | `6353231190d5c0747c1ad77eb4466a3db0f496420d72914f75fb703384c6d6a0` |
| `src/apps/mansion/mansion.css` | 5 | `9258e4e94d8a19fa48d1bc667a65951a966da9b0cea43d8d0e74f81e2584f7f3` |
| `src/shared/ui/styles/battle.css` | 7 | `1e9ed85e0e52f7eae299f9386e160ecf396635a38524f2357683f690f73b44e8` |
| `src/apps/dice/dice.css` | 9 | `f9cc6c234a56293b129203abfaf9a6592e8bfd79f81adcec9ddd44a8ed53a57f` |
| `src/shared/ui/styles/rp.css` | 7 | `83e6fee32a900967f5f76cf13d601b2f8364cbde916b57c3aa37ba6ccdd13f39` |
| `src/apps/rp/app.css` | 4 | `e040102553343883482b4f51df83c6df0b0357382874bcbb05dd68fa6961589c` |
| `src/apps/menu/menu.css` | 7 | `9d71a0837abd7246118ea802e43c8dfb4aef565834cc601396518f2c40676356` |

`src/shared/ui/styles/components.css` 的领域拆分同样保持原顺序，但当前拼接内容比基线多一项有意修复：为 `.abyssa-ribbon-button__label` 增加 `box-sizing: border-box`，防止 100% 宽度叠加 padding 后标签右移。因此不将它错误标记为字节级等价。

### 4.2 地图拆包结果

| Map JS chunk | 构建体积 | gzip |
| --- | ---: | ---: |
| 应用代码 | 25.64 kB | 9.09 kB |
| GSAP | 68.08 kB | 26.78 kB |
| React/vendor | 189.60 kB | 59.63 kB |
| Three.js | 509.05 kB | 125.73 kB |

地图最大 chunk 低于 `vite.map.config.ts` 的 520 kB 窄阈值，`build:map` 不再产生超限警告。

### 4.3 组件库发布边界

P1 治理前，Vite library build 会把大型 PNG 分别内联进 JS 与 CSS，且把 `public/mansion-map` 复制到 `dist`。其中 `dist/index.js` 约 7.30 MB（约 7.06 MB 为 PNG data URL），`dist/abyssa-ui.css` 约 5.25 MB（约 5.05 MB 为 PNG data URL），公共地图又增加约 16 MB。

当前构建采用相对资产基址、关闭 library build 的公共目录复制，并通过 `?no-inline` 将 7 张共享皮肤 PNG 外置；同一图片在产物中只保留一份。最终发布结果如下（MB 为十进制）：

| 指标 | 治理前 | 当前 |
| --- | ---: | ---: |
| 发布包压缩体积 | 25.97 MB | 6.60 MB |
| 发布包解包体积 | 29.53 MB | 7.12 MB |
| 主入口 JS | 7.30 MB | 3.36 kB |
| CSS | 5.25 MB | 196.56 kB |
| 全部 JS | 约 7.30 MB | 247.38 kB |
| 发布 PNG | JS/CSS 重复内联 | 7 个文件 / 6.49 MB，自动去重 |
| `dist/mansion-map` | 约 16 MB | 不进入发布包 |

根入口的 103 项运行时导出保持不变，同时增加三个按所有权组织的公共入口：

| 包入口 | 运行时导出数 | 产物 |
| --- | ---: | --- |
| `@abyssa/ui` | 103 | `dist/index.js` / `dist/index.d.ts` |
| `@abyssa/ui/branding` | 14 | `dist/branding.js` / `dist/branding.d.ts` |
| `@abyssa/ui/patterns` | 32 | `dist/patterns.js` / `dist/patterns.d.ts` |
| `@abyssa/ui/primitives` | 57 | `dist/primitives.js` / `dist/primitives.d.ts` |

`scripts/check-package-release.mjs` 会读取真实 `npm pack --dry-run --json` 清单并检查：

- 四个 JS 入口可由 Node 动态导入，入口声明文件和 CSS 均存在；
- 三个子路径的运行时导出都是根入口子集，且导出数量未意外漂移；
- 发布包只含预期的 7 张 PNG，不含 `dist/mansion-map`；
- 单个 JS/CSS 不超过 256 KiB，其中不得出现超过 16 KiB 的 image/font data URL；
- 压缩包不超过 7 MiB，解包体积不超过 8 MiB。

`npm run release:check` 可独立执行完整构建和检查；`prepack` 已接入同一门禁，因此实际执行 `npm pack` 时不能绕过。`package.json` 仍保留 `"private": true`，本批次只关闭发布产物风险，不代表授权对外发布。

## 5. 验证基线

当前收口阶段实际执行并通过：

~~~bash
npx vitest run --maxWorkers=1 --no-file-parallelism
npx vitest run \
  src/tools/dice-studio/App.test.tsx \
  src/apps/menu/MenuPage.test.tsx \
  src/apps/title \
  src/apps/battle/ExpeditionBattleScreen.test.tsx \
  src/apps/dice \
  --maxWorkers=1 --no-file-parallelism
npm run typecheck
npm run boundaries:check
npm run build
npm run release:check
npm pack --dry-run --json
npm run build:battle
npm run build:character-status
npm run build:dice
npm run build:menu
npm run build:title
npm run build:dice-studio
npm run build-storybook
~~~

结果：

- Vitest：57 个测试文件、480 项测试全部通过；本轮采用单 worker 顺序执行，当前快照耗时 77.94 秒；
- 标题、枢纽标题栏、战斗骰、骰局和骰子工作室针对性回归：15 个测试文件、145 项测试全部通过；
- TypeScript：无类型错误；
- 模块边界：无意外跨层依赖；
- 默认 library build、战斗、角色状态、骰局、菜单、标题和骰子工作室入口：构建成功；
- Storybook：构建成功，已有 Axe 与 iframe 工具 chunk 警告不变；
- `release:check` 与实际 `prepack` 生命周期：均通过，四入口和声明文件可用，发布包为 6.60 MB / 7.12 MB。

批次 A–E 已执行并通过默认 library build、当时全部 14 个应用/工具入口与 Storybook；本轮针对 P1 资产消费方以及标题、标题栏与骰面相关入口复验，没有机械重跑无关的全部构建矩阵。

仍需单独跟踪但不阻塞本轮的构建观察项：

- Storybook 的 Axe 与 iframe 工具 chunk 超过 500 kB，属于文档/测试工具链告警，不影响应用入口；
- 未执行 `build:preview`，因为它会改写刻意提交的 `static-preview/` 分享产物，本轮结构维护无需刷新该产物。

## 6. 当前风险地图

| 优先级 | 含义 | 当前数量 |
| --- | --- | ---: |
| P0 | 当前质量门禁、正确性、构建或数据风险 | 0 |
| P1 | 下一次发布或相关功能修改前应主动治理 | 0 |
| P2 | 可随功能变化或实际协作痛点渐进处理 | 若干观察项 |

### 6.1 已关闭：骰面共享所有权

原先位于 `src/apps/battle/dice-face` 的 4 个六面骰实现文件已原样迁入 `src/shared/ui/dice-face`：

- `ExpeditionDieCube.tsx` 与配套 CSS；
- `ExpeditionFlatDieFrame.tsx` 与配套 CSS。

战斗应用和骰子工作室现在都只依赖共享实现，未复制代码，也未放宽边界规则。`npm run boundaries:check` 已恢复通过。骰子工作室新增 2 项直接测试，覆盖六面渲染、切面同步和投掷计时器卸载清理。

骰局异步控制器原 P1 已在批次 F 关闭：`useDiceRound.ts` 从 538 行降至 416 行，结算和等待调度已下沉，并有 8 项新增直接测试覆盖取消、重开与卸载场景。

### 6.2 已关闭：组件库发布体积

原 P1 已在批次 H 关闭。大型 PNG 改为相对路径的独立发布资产，公共地图目录不再随 library build 复制；根入口 API 保持兼容，并补充 `branding`、`patterns`、`primitives` 三个公共子路径。发布包从 25.97 MB 压缩 / 29.53 MB 解包降至 6.60 MB / 7.12 MB。

当前 `prepack` 会自动重建并执行体积、data URL、文件清单、入口动态导入和声明文件检查。后续新增公共资产或导出若确需越过预算，应在同一改动中更新门禁与本节依据，不能只放宽数字。

### 6.3 P2：按需整理

- 标题画面：`title.css`、主题、CG 与几何边界清楚；新增皮肤或布局时继续同步既有 48 项测试；
- 枢纽标题栏：保持时间/资源只读展示，不把洋馆的时间推进状态复制进菜单；
- 共享骰面：`ExpeditionFlatDieFrame.tsx` 以单一 SVG 视觉组件为主，只有出现独立编辑或测试需求时再拆内部图元；
- 骰子工作室：配置能力继续增长时优先提取纯 model 与持久化测试，当前不为 546/565 行数字机械拆分；
- 大型测试文件：在定位慢、合并冲突明显时按规则族或交互主题拆分；
- `items.css`、`components-controls.css`、`studio.css`：随所属组件变化再按所有权拆；
- `catalog/App.tsx`：登记数据继续增长时提取分类清单，页面保留筛选与布局；
- `rp/App.tsx`：自动播放、阅读控制继续扩张时再抽应用层 hook；
- 已有清晰领域边界的 `expedition-*.css`、`mansion-*.css`、`battle-*.css` 保持现状。

## 7. 当前全部 500 行以上文件

大文件等级用于发现风险，不是强制拆分规则：

| 等级 | 参考范围 | 含义 |
| --- | ---: | --- |
| 超大 | ≥ 1,500 行 | 必须检查职责混合、回归面或测试可检索性 |
| 大型 | 800–1,499 行 | 应有明确所有权与拆分边界 |
| 观察 | 500–799 行 | 可以保留，但不宜无边界增长 |

### 7.1 超大文件（≥ 1,500 行）

| 文件 | 行数 | 优先级 | 当前判断 |
| --- | ---: | --- | --- |
| `src/apps/battle/engine.test.ts` | 2,002 | P2 | 86 项高价值规则测试；仅在定位或冲突成为问题时按规则族拆分 |

当前没有超大生产文件。

### 7.2 大型文件（800–1,499 行）

| 文件 | 行数 | 优先级 | 当前判断 |
| --- | ---: | --- | --- |
| `src/apps/battle/expedition-skins.css` | 1,366 | P2 | 皮肤域边界明确；按具体皮肤变化再拆 |
| `src/apps/battle/ExpeditionBattleScreen.test.tsx` | 1,192 | P2 | 42 项高价值场景测试；可按回合、骰盘、动作演出拆 |
| `src/apps/battle/engine.baseline.test.ts` | 1,110 | P2 | 固定种子语义基线；优先保持可比性 |
| `src/apps/battle/expedition-interaction.css` | 980 | P2 | 交互域明确；出现覆盖冲突时再细分 |
| `src/shared/ui/styles/components-character-screen.css` | 875 | P2 | 单一角色状态屏所有权，暂不机械拆分 |
| `src/apps/battle/expedition-dice.css` | 815 | P2 | 骰盘域清楚；已越过关注线，随骰面功能变化观察 |

### 7.3 观察文件（500–799 行）

| 文件 | 行数 | 优先级 | 建议 |
| --- | ---: | --- | --- |
| `src/apps/battle/ExpeditionBattleScreen.tsx` | 776 | P2 | 已完成当前拆分，继续只做页面编排 |
| `src/shared/ui/styles/items.css` | 727 | P2 | 随库存功能按 slot/grid/dialog 拆 |
| `src/shared/ui/styles/components-controls.css` | 719 | P2 | 共享控件域清楚，观察跨组件覆盖 |
| `src/apps/catalog/App.tsx` | 679 | P2 | 登记数据增长时提取分类清单 |
| `src/apps/battle/expedition-readouts.css` | 671 | P2 | 读数域边界明确，保持 |
| `src/apps/battle/rules/turns.ts` | 639 | P2 | 规则内聚且有直接测试 |
| `src/apps/mansion/mansion-world.css` | 615 | P2 | 世界层所有权清楚，保持 |
| `src/apps/battle/expedition-shell.css` | 612 | P2 | 壳层边界合理，保持 |
| `src/apps/mansion/MansionPage.tsx` | 609 | P2 | 已是组合入口，避免重新聚集状态 |
| `src/apps/title/title.css` | 578 | P2 | 主题入口职责清楚，观察场景变体增长 |
| `src/tools/dice-studio/dice-studio.css` | 565 | P2 | 新工具样式；面板结构稳定后再按所有权拆分 |
| `src/apps/rp/App.tsx` | 559 | P2 | 应用编排可保持；功能增长时抽阅读控制 hook |
| `src/apps/mansion/data.ts` | 555 | P2 | 集中内容定义，当前可保持 |
| `src/apps/dice/dice-board.css` | 555 | P2 | 单一骰盘域，保持 |
| `src/shared/ui/ui.test.tsx` | 554 | P2 | 仅在定位困难时按 primitive/pattern/screen 拆 |
| `src/tools/dice-studio/App.tsx` | 546 | P2 | 已有直接测试；配置状态继续增长时提取纯 model |
| `src/shared/ui/styles/rp-bubble-effects.css` | 542 | P2 | 气泡演出域明确，保持 |
| `src/shared/ui/styles/components-dialogue.css` | 521 | P2 | 对话域清楚，观察跨组件覆盖 |
| `src/shared/ui/styles/battle-field.css` | 515 | P2 | 战场域清楚，保持 |
| `src/shared/ui/dice-face/ExpeditionFlatDieFrame.tsx` | 513 | P2 | 共享所有权已明确；按 SVG 图元独立变化需求再拆 |
| `src/tools/studio/studio.css` | 510 | P2 | 随面板变化再按工具区域拆 |
| `src/apps/battle/rules/resolver.test.ts` | 510 | P2 | 随效果族扩展拆分 |
| `src/apps/dice/game.ts` | 505 | P2 | 纯规则且有 27 项直接测试，保持 |
| `src/apps/battle/expedition-enemy-turn.css` | 502 | P2 | 敌方回合域明确，保持 |

## 8. 下一步维护顺序

建议按实际需求触发，而不是立即继续搬文件：

1. **冻结骰局与共享骰面边界。** 后续规则、视觉调整与结构搬迁分开评审，保留现有取消、共享渲染和卸载测试。
2. **维护组件库发布门禁。** 新增公共 API 或资产时优先放入正确子路径，并同步验证真实消费方与 tree-shaking；预算变化必须有明确依据。
3. **标题与标题栏继续按现有所有权演进。** 标题页保持命令/主题/CG/几何分层，枢纽标题栏保持只读展示。
4. **大型测试出现检索或协作成本时**，按能力域拆文件但不减少覆盖。
5. **CSS 只随所属功能维护**；拥有清晰视觉域的 500–1,366 行文件不需要为了阈值继续切碎。

## 9. 不应手工维护的目录

以下内容是构建结果，应修改源文件后重新生成，不应直接修补：

- `dist/`；
- `battle-dist/`、`dice-dist/`、`map-dist/` 等所有 `*-dist/`；
- `storybook-static/`。

`static-preview/` 虽然是生成结果，但当前刻意提交用于直接分享，应只通过 `npm run build:preview` 更新。

图片和 SVG 不属于本轮“大代码文件”统计。资源来源、授权、压缩、重复项和离线可用性应另做资产审计。

## 10. 长期软限制

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
