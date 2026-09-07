> 历史档案：2026-09-07文档整理时归档。原路径：`docs/audits/2026-09-05-s1-core-extraction.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# S1 纯内核抽取：勘探与审计

日期：2026-09-05。本文是 **S1 迁移前审计记录**；下文事实和测试数量保留勘探时状态，源码链接已跟随迁移更新。后续实施与最终验收统一见 [S1 实施记录](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S1_CORE_EXTRACTION_PLAN.md#12-规划交付与实施记录)。检查对象是 S0 完成后的工作树，不是仅检查 HEAD。HEAD 为 `969ae5ade3c7be1439638e6d4f1f44ecd102a62b`；S0 与此前标题、素材、设定文档的修改仍未提交。

执行入口：[S1 实施计划](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S1_CORE_EXTRACTION_PLAN.md)。阶段依据：[生产化审计](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-production-readiness.md)与 [S0 实施记录](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S0_ENGINEERING_BASELINE_PLAN.md)。

## 1. 结论

**S1 可以开始，优先抽取 Battle 的现有纯规则闭包。** 它已具备命令、效果解析、局部领域事件、可序列化 RNG、存档迁移、撤回与固定种子回归。当前主要问题是所有权仍在页面目录、兼容入口暴露过宽，以及缺少持续约束独立运行的工程门禁。

本轮支持的范围是：内部 `src/game-core/battle`、冻结的旧版内容、旧 facade、Node 测试与依赖边界。S1 之后仍是固定旧内容的战斗内核，不应宣称已经完成通用内容引擎、跨场景存档或完整游戏闭环。

骰局、洋馆、编队和商店的审计结果作为 S2/S3 的输入。它们各自存在规则与表现混合、状态不可直接 JSON 化、浏览器契约或跨场景交接缺口，不适合随着 Battle 整目录搬迁。

## 2. 方法与证据范围

- 阅读 Battle 的 domain、content、rules、selectors、persistence、controller、presentation 和既有重构/维护文档；同时勘探 Dice、Mansion、Sortie、Shop 的规则接缝。
- 使用 Babel AST 扫描 `src` 内 398 个 TS/TSX/JS/MJS 文件的导入与再导出，分别统计运行时边和含类型边。解析字面量动态导入、`require` 与类型导入；不把扫描结果当成任意动态代码的完整依赖证明。
- 对候选模块计算传递闭包、消费者与强连通分量；用 esbuild 的 Node ESM 打包元数据交叉检查运行时依赖。关闭 tree shaking，避免未被使用的导出掩盖 React 依赖。
- 在 Node 22.23.2 / npm 10.9.8 下执行定向 Vitest 测试及独立 Node 探针；未启动 rp-style-lab、运行 setup 或调用 Provider。
- 本轮没有重新运行全量浏览器或全部发行构建。S0 的 695 项应用测试、9 项工程测试、35 项浏览器检查属于既有基线，不能写成本轮新增结果。

本地证据集中在 [dist/reports/s1](/Users/liuhang/Documents/project-abyssa/dist/reports/s1)。该目录被忽略，可被清理；长期结论以本文为准，未来正式门禁必须进入受版本管理的脚本与测试。

## 3. 实际依赖闭包

### 3.1 Battle

以 [engine.ts](/Users/liuhang/Documents/project-abyssa/src/apps/battle/engine.ts) 为入口，排除测试、测试工具与 benchmark 后：

| 分组 | 生产文件数 | 当前职责 |
| --- | ---: | --- |
| domain | 7 | 状态、命令、事件、效果/目标类型、不变量、版本 |
| content | 4 | 固定五人骰面、数值、敌人生成、默认效果定义 |
| rules，含 resolver 子目录 | 29 | 指令分派、行动、回合、效果解析、结算与兼容行为 |
| selectors | 4 | 规则派生、目标合法性、贪心/狂暴摘要 |
| persistence | 5 | JSON DTO、版本迁移、复制、RNG |
| engine.ts | 1 | 旧导出面 |
| 合计 | **50** | **7,751 行，含注释与空行** |

含类型的闭包为 50 文件；运行时闭包为 45 文件。两种图都未发现循环依赖；全部候选文件均可从 facade 到达，没有导出闭包之外的孤立候选实现。未发现外部包、其他 app、共享 UI、素材或宿主导入。

esbuild 的 Battle bundle 也只有 45 个源码输入、0 个外部导入。独立 Node 进程中 `window` 和 `document` 均为 `undefined`，能够创建、执行、保存、恢复和运行完整旧远征轨迹。

注意：这说明 Battle 具备可抽取条件，不说明当前生产页面已脱离 React 控制器，也不说明所有游戏场景都纯净。

### 3.2 真实调用者与兼容面

有 **10 个生产文件**在闭包外消费 Battle：

- 8 个通过旧 facade：`ExpeditionBattleScreen`、`ExpeditionBattleChrome`、`ExpeditionBattleOverlays`、`ExpeditionBattleSidebar`、`ExpeditionDicePanel`、`battle-view-model`、`expedition-visuals`、`useExpeditionBattlePresentation`。
- 2 个深层导入：[presentation-events.ts](/Users/liuhang/Documents/project-abyssa/src/apps/battle/controller/presentation-events.ts:1) 读取领域类型；[useExpeditionBattleController.ts](/Users/liuhang/Documents/project-abyssa/src/apps/battle/controller/useExpeditionBattleController.ts:1) 读取命令、状态、RNG、兼容函数和 dispatcher。
- 另有 20 个测试/测试工具/benchmark 文件消费闭包。这里统计的是源码消费者，不是测试文件执行数。

旧 facade 有 **124 个运行时导出**，类型导出另计。只移动实现并保留 `engine.ts`，会使上述两个深层生产调用者及部分测试的路径失效；迁移清单必须覆盖它们。

详表与导入行号：[import-graph.json](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/import-graph.json)。

### 3.3 其他场景

| 对象 | 本轮实证 | 处理建议 |
| --- | --- | --- |
| Dice `game.ts` | 自身没有导入，但 `GameState` 包含 busy、rolling、rollDurations、rotations；直接调用 `Math.random`；还包含对白、点阵/旋转常量 | 不能把“无 import”等同于确定性规则内核；S1 不整包搬迁 |
| Dice 回合驱动 | `useDiceRound` 持有权威状态、投骰和阶段推进；`useDiceOpponent` 等待远程决策或本地策略 | 规则/表现拆分与 AI Port 另列后续，旧宿主适配器继续隔离在 app |
| Mansion `mansion-state.ts` | 含类型闭包 10 文件，运行时 8 文件；通过 geometry → shared/stage → Stage/useStageScale 引入 React | Node 中能执行不代表无 React；必须先切断传递依赖 |
| Mansion 状态 | `damaged`、`readyProduction` 为 Set；`data.ts` 类型依赖 UI 的 ItemRarity | S2 设计存档 DTO 与领域数据投影；不直接 JSON 保存页面状态 |
| Sortie `sortie-model.ts` | 含类型闭包 3 文件、运行时 2 文件；包含肖像/文案等展示契约，写入函数使用 DOM `Storage` 类型 | 规则、展示、存储需分离；不提前当作 BattleStartInput |
| Shop | 钱包、库存、议价/鉴定状态与 `transact` 闭包都在 React 页；购买没有统一玩家库存入账 | S2/S3 确定 Campaign 经济与结算边界，再按闭环需要抽取 |

Mansion 的完整依赖链为：

```text
mansion-state.ts → mansion-geometry.ts → shared/stage/index.ts
                                         → Stage.tsx → useStageScale.ts → react
```

源头只需要 `cleanRegionLabel`，但同一 geometry 模块还计算舞台尺寸。证据：[mansion-state.ts](/Users/liuhang/Documents/project-abyssa/src/apps/mansion/mansion-state.ts:1)、[mansion-geometry.ts](/Users/liuhang/Documents/project-abyssa/src/apps/mansion/mansion-geometry.ts:1)、[stage/index.ts](/Users/liuhang/Documents/project-abyssa/src/shared/stage/index.ts:1)。Node bundle 保留 `react` 和 `react/jsx-runtime` 外部导入。

## 4. 发现、风险与阶段归属

### S1-A01 · 既有 Battle 重构已完成，不能再按单文件重写

[旧重构计划](/Users/liuhang/Documents/project-abyssa/docs/archive/battle/ENGINE_REFACTOR_PLAN.md:1)标记阶段 0–8 已完成。其文档前部的 2,193 行 engine、1,890 行 Screen、127 项测试属于当时基线，不是当前状态。现有 resolver 已有顺序控制、事件预算 256、触发深度 8 与状态/效果模型。

**S1 处理：**迁移已有实现和回归保护；不另造 ECS、规则 DSL、通用事件总线或第二套战斗状态机。

### S1-A02 · 固定内容依赖深入规则与验证

17 个生产文件直接导入旧 `content`，包括 facade、不变量、迁移器、规则和 selectors。角色顺序验证直接要求 PARTY_ORDER；CharacterId 仍是五个固定字符串。`enemies.ts` 含生成算法与第二层随机分支，不能机械转换成纯 JSON。

证据：[invariants.ts](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/domain/invariants.ts:1)、[enemies.ts](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/enemies.ts)、[expedition.ts](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/expedition.ts:48)。

**S1 处理：**四个内容模块作为运行时使用的 `legacy-v1` 内容夹具随闭包迁移，保持算法、顺序、文本与 ID。**S2 处理：**Catalog、可注入编队/遭遇与不变量参数化。S1 不承诺任意角色或任意地下城。

### S1-A03 · 兼容函数与 dispatcher 有不同事件游标语义

[preserveCompatibilityEventCursor](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/compatibility.ts:39) 会把输出的 `eventSequence` 恢复为输入值。旧 `rollDice` 等函数不是新 dispatcher 的等价别名。

探针：初态 eventSequence 为 0，一次旧 `rollDice` 后仍为 0；一次 dispatcher `roll-dice` 后为 2。撤回还会恢复检查点游标并生成 undo 事件，因此事件 ID 也不能充当跨撤回、跨战斗的全局提交 ID。

**S1 处理：**保留兼容实现、完整导出面与旧游标行为；新内部入口优先使用状态自带 RNG 的命令路径。**S2 处理：**应用层 commandId/revision/commitId 与 Fact 身份。

### S1-A04 · FromInput 构造器未保存传入 RNG 的元数据

[createExpeditionStateFromInput](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/expedition.ts:181) 直接走 raw 创建路径；[createExpeditionFromSeed](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/compatibility.ts:103) 则经过追踪元数据的兼容构造路径。

独立探针使用 seed 19、默认 location/空 loadout：

| 入口 | 创建后 combat seed/cursor | 随后默认 `roll-dice` 的 faceIndex |
| --- | --- | --- |
| `createExpeditionFromSeed(19)` | `19 / 2` | `[2, 4, 5, 1, 3]` |
| `createExpeditionStateFromInput(mulberry32(19), {})` | `0 / 0` | `[1, 0, 1, 0, 2]` |

这确认两个构造器不可互换；不是在所有旧外部 RNG 调用场景下都已出现故障的证明。

**S1 处理：**新入口只采用已验证的 seed 构造路径；旧 FromInput 留在兼容面，注明限制，不悄悄修正或对外宣称支持可恢复的任意带入。**S2 处理：**实现统一 `seed + start input + content` 构造与加载验证，再以专门测试处理旧调用兼容。

### S1-A05 · typed dispatcher 不是外部 JSON 命令协议

[dispatcher.ts](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/dispatcher.ts:1) 对受支持的命令执行状态合法性检查，但结尾的 TypeScript `never` 穷尽检查不会生成运行时输入校验。

探针将 `{ type: "audit-unknown-command" }` 从 JavaScript 传入，返回值就是该对象，而不是 BattleTransition。故当前入口适用于受类型约束的内部调用，不能直接接收 LLM/HTTP 的未验证 JSON。

**S1 处理：**限制入口用途并保留原行为；不把旧内部导出包装成公开远程 API。**S2 处理：**在应用边界验证未知命令、字段、目标、版本与并发条件；AI 只能提交候选行动。

### S1-A06 · 纯规则已存在，页面提交仍受演出驱动

[controller](/Users/liuhang/Documents/project-abyssa/src/apps/battle/controller/useExpeditionBattleController.ts:58) 的 transition 仅计算，commitTransition 才更新 React 中的真实状态；[presentation](/Users/liuhang/Documents/project-abyssa/src/apps/battle/presentation/useExpeditionBattlePresentation.ts:240) 在 impact 提交，并在清层动画后调用 acknowledgeLayerClear 再发 end-turn。

**S1 处理：**controller、队列、计时器和 presentation 留在 app，保留已有动画时机回归。Node runner 可以直接推进纯规则。**S2/S3 处理：**应用层权威状态、先提交后呈现、刷新恢复与跨场景结算；S1 不宣称动画中刷新已安全。

### S1-A07 · 现有边界检查不足以保护新内核

[check-module-boundaries.mjs](/Users/liuhang/Documents/project-abyssa/scripts/check-module-boundaries.mjs:42) 目前不认识 game-core，未知顶层目录归 infrastructure；检查相对导入，提取方式为正则。它不能阻止 core 导入 React、Node I/O、宿主别名或使用 DOM 全局。

独立类型探针移除 DOM、Vite、Vitest、Node 和 React 环境类型后失败，29 条诊断均由缺少 `structuredClone` 声明及其引发的类型推断问题产生；只补 `declare function structuredClone<T>(value: T): T` 后，50 个生产文件通过严格检查。

**S1 处理：**增加 AST 边界、独立环境类型门禁和 Node 测试。仅声明现有跨平台纯复制 API，不通过导入整个 DOM/Node 类型包解决问题。`window` 作为 effect 的字段/参数名是合法业务词，边界检查不能靠全文禁词误杀。

### S1-A08 · 存档与 golden 已有保护，但不能过度推断

现有 Battle 版本为 **schema 4 / rules 1 / content 1**。已有存档中途恢复、v1/v2/v3 迁移、RNG 分流、随机行动撤回再做与不变量测试；版本字段不代表 Campaign 存档服务已存在。

[golden 摘要](/Users/liuhang/Documents/project-abyssa/src/game-runtime/testing/battle/testing/baseline.ts)刻意省略完整日志与撤回快照，也没有覆盖 RNG/eventSequence 的全部状态。因此仅保持旧指纹不足以证明完整迁移等价。

**S1 处理：**保留原指纹，同时在迁移前捕获完整状态、事件、错误、RNG 与存档样本；不可用更新快照消除迁移差异。验收禁止 `UPDATE_BATTLE_BASELINE=1` 跳过断言。**S2 处理：**统一存储 Port、内容兼容策略和 Campaign 数据。

### S1-A09 · 编队、骰装和跨页导航尚未构成游戏闭环

[展示骰面契约](/Users/liuhang/Documents/project-abyssa/src/shared/domain/dice/face.ts:1)含 `art`、花色和 asleep/awake；旧 Battle 的 verb/quality 语义不同，不能通过类型改名直接接入。

[MapPage](/Users/liuhang/Documents/project-abyssa/src/apps/map/MapPage.tsx:37)明确说明出击令已写入但 battle 未读取；源码检索也未找到 Battle 消费 `abyssa:sortie-order:v1` 的路径。

**S1 处理：**冻结旧五人/旧骰面行为，记录映射缺口。**S2/S3 处理：**从定稿内容建立合法输入、消费出击令、带入/带出、终局唯一入账与回洋馆恢复。未定稿契约与数值继续留空。

## 5. 本轮验证结果

| 检查 | 结果 | 限制 |
| --- | --- | --- |
| 定向 Vitest，Node 环境 | **16 文件 / 192 项通过** | 现有测试子集，不与 S0 数量累加 |
| 其中 Battle | 13 文件 / 148 项 | 包括 facade 身份/类型兼容检查 |
| 其中 Dice / Mansion / Sortie | 27 / 6 / 11 项 | 仅已有纯模型测试，未证明完整页面无框架依赖 |
| Battle 独立 Node ESM 导入与执行 | 通过，0 外部导入 | 旧规则内容范围 |
| JSON 存档往返、恢复后重掷、非法阶段命令保留输入、装载撤回恢复骰子/RNG | 探针断言通过 | 抽样探针；更完整场景由现有测试补充 |
| raw FromInput 与 seed 构造比较 | 差异确认 | 见 S1-A04，不计为“修复通过” |
| 未知命令探针 | 缺少运行时校验确认 | 见 S1-A05 |
| Mansion JSON 探针 | `damaged` 的 Set(2) 变成 `{}` | 尚无通用存档 DTO |
| 无 DOM/框架类型检查 | 原样失败；补最小 clone 声明后通过 | 只是审计配置，未接入工程门禁 |

旧远征策略运行到 finished 的结果：

| seed | 轨迹步数 | 终局 | 最终摘要指纹 |
| ---: | ---: | --- | --- |
| 11 | 169 | 团灭 | `aa759ace` |
| 29 | 227 | 团灭 | `21afcc8c` |
| 47 | 181 | 生还 | `fbc1da75` |
| 83 | 165 | 生还 | `b010c47b` |
| 131 | 214 | 生还 | `50d1f338` |

### 5.1 复现

以下命令与一次性探针对应迁移前源码布局，作为历史证据保留；迁移后使用正式的 `npm run check:core` 或 `npm run check:baseline`。均在仓库根目录使用 `.nvmrc` 对应的 Node/npm。

```bash
npm exec vitest -- run \
  src/apps/battle/engine.test.ts \
  src/apps/battle/engine.baseline.test.ts \
  src/apps/battle/persistence/persistence.test.ts \
  src/apps/battle/rules \
  src/apps/battle/testing \
  src/apps/battle/module-boundaries.test.ts \
  src/apps/dice/game.test.ts \
  src/apps/mansion/mansion-state.test.ts \
  src/apps/map/sortie/sortie-model.test.ts \
  --environment node --reporter=dot --reporter=json \
  --outputFile.json=dist/reports/s1/node-tests.json
```

本地审计脚本与报告：

- [inspect.mjs](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/inspect.mjs)：扫描导入图并记录运行时的工作树文件哈希；重跑会更新该哈希清单。
- [probe.mjs](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/probe.mjs)：生成 Node bundle、执行探针并生成两份独立类型配置。
- [probe-results.json](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/probe-results.json)、[node-tests.json](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/node-tests.json)。
- [typecheck-no-dom.log](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/typecheck-no-dom.log)：有意保留原样检查失败证据。

脚本可依次用 `node dist/reports/s1/inspect.mjs`、`node dist/reports/s1/probe.mjs` 执行；随后分别运行 `npm exec tsc -- -p dist/reports/s1/tsconfig-no-dom.json` 和 `npm exec tsc -- -p dist/reports/s1/tsconfig-no-dom-with-clone.json`。前者预期失败，后者预期通过。它们使用当前安装依赖，不访问宿主。

## 6. 对后续 LLM 接入的判断

“Abyssa 负责游戏闭环，rp-style-lab 负责按需的上下文/模型/复杂管线”可行。Battle 的独立规则闭包已经支持这个方向，但当前整个仓库尚未完全实现该边界。

S1 的贡献是明确权威规则归属并锁住纯依赖。S2 用应用层定义合法命令、提交版本、事实、存储和最小 AI Port；S3 先以本地能力完成闭环；S4 再连接 rp-style-lab。旧 Dice 适配器中的 model role、release、binding 等协议不应搬入 game-core。

本轮只提交审计/计划与文档导航变更，未移动运行时代码、改变游戏规则或修复上述后续阶段问题。
