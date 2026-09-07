> 历史档案：2026-09-07文档整理时归档。原路径：`docs/audits/2026-09-05-s2-application-foundation.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# S2 内容、存档与应用层：勘探审计

日期：2026-09-05。状态：**规划前审计已完成；S2 业务代码尚未实施。** 检查对象是 S1 完成后的当前工作树，HEAD 为 `969ae5ade3c7be1439638e6d4f1f44ecd102a62b`。S0/S1、标题、素材和设定等未提交修改均保留。

实施入口：[S2 应用底座计划](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S2_APPLICATION_FOUNDATION_PLAN.md)。前序结果：[S1 实施记录](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S1_CORE_EXTRACTION_PLAN.md#12-规划交付与实施记录)。上位依据：[生产化审计](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-production-readiness.md)。

## 1. 结论

S1 已把 Battle 的规则闭包从页面中抽出；S2 的主要工作是建立**内容注入、跨场景状态归属和可信提交边界**。这需要应用层及本地事务存储，不需要先连接 rp-style-lab。

当前 Battle 能独立运行旧远征，但不是正式 Campaign 服务。它仍固定五人内容，存档验证不足以接收任意 JSON，页面持有权威状态，终局输出没有可用于跨场景入账的身份。把这些函数直接放到 HTTP 或 LLM 调用后面，会把原型中的隐含前提暴露为协议问题。

建议 S2 交付可在 Node 和浏览器存储测试中运行的应用底座；S3 再把地图、战斗、标题和洋馆接入同一底座，验证玩家完整闭环。S2 要实际实现事务、结算去重基础与本地 AI Port，不能只新增类型文件；也不能把全部场景迁移和新玩法定稿一起塞进 S2。

## 2. 方法与证据边界

- 阅读 S0—S2 上位阶段定义、S1 交接、设定的已定/拟议边界，以及 Battle 创建、规则、效果、存档、撤回、事件和页面提交源码。
- 定向阅读 Title/Menu、Sortie、Mansion、Shop 的当前状态和调用路径；复核模块所有权门禁。
- 使用已有 Babel AST 导入提取器扫描 Battle 生产 TS，确认 **17 个生产文件直接引用 legacy-v1 内容**。这包括兼容导出，不等同于 17 个都包含硬编码规则。
- 将选定核心函数用 esbuild 打成临时 Node ESM，运行 11 个探针。它们是入口行为勘探，不是完整异常输入覆盖，也不是 S2 已实现的证明。
- 在固定 Node **22.23.2** / npm **10.9.8** 下重新执行 `npm run test:core`：**15 文件 / 156 项通过**。
- 未启动 rp-style-lab、未执行 setup、未调用 Provider；本轮没有重跑全部构建或全部浏览器测试，远端 CI 未运行。

可清理的本地证据：[探针脚本](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/audit-probe.mjs)、[探针结果及导入清单](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/probes.json)、[核心测试日志](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/core-tests.log)。该目录被 Git 忽略，长期事实以下表和正文为准；实施时需把相关断言转为受版本管理的测试。

## 3. 需要在 S2 处理的发现

### S2-A01 · 内容注入只覆盖了部分效果选项，没有贯通正式调用链

证据：[状态类型](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/domain/state.ts)、[远征创建](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/expedition.ts)、[不变量](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/domain/invariants.ts)、[敌群生成](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/enemies.ts)。

`CharacterId` 是固定五人联合；创建和存档不变量要求固定 `PARTY_ORDER`。角色骰面、HP、层数与敌群通过内容模块直接导入。`BattleStartInput` 只有 location/loadout，没有正式编队或遭遇引用。解析器虽有部分 effectDefinitions 参数，但正常 dispatcher、selectors、迁移和默认注册表尚未共享一个经过校验的 Catalog。

**影响：**只给构造器加 party 参数仍会在出手、换层、目标选择或读档时回落到固定内容。需要沿 17 个直接消费者和传递调用参数化，并保持旧内容的 RNG 消耗顺序。

### S2-A02 · 当前 BattleState 是整趟远征状态，不能当作纯 Encounter 再复制

证据：[ExpeditionStateCore / BattleState](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/domain/state.ts:261)、[层与终局结算](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/settlement.ts)。

`ExpeditionState` 是 `BattleState` 的别名。它同时拥有 location/layer、gold/bagGold、成员伤势与退化、带入/当前装备、回合骰子/敌人、三条 RNG、撤回快照和终局 result。`mode` 也同时包含回合阶段、greed 与 finished。

**影响：**若 Campaign、Expedition 和 Encounter 各保存一份 party、钱包和 RNG，会产生三处可写事实。S2 应明确拆分所有权；为保留旧规则，可以在命令执行中临时展开为旧形状，持久化时只保留一份规范化快照。

### S2-A03 · 外部命令还没有运行时解析

证据：[dispatcher 尾部](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/dispatcher.ts)、[内部入口](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/index.ts)。

传入 `{ type: "audit-unknown-command" }`，实际返回**同一个命令对象**，不是 `BattleTransition`；`const exhaustive: never = command` 仅有编译期意义。当前内部 typed API 的注释已明确要求未来应用层验证。

**影响：**必须先从 unknown 解析版本化命令，拒绝未知类型、额外权限字段、非法数值和内容引用，再调用内核。不能把 `as BattleCommand` 当作校验。现有 15 个命令也不包含正式通用道具或技能命令，不能从 UI 按钮推断功能已经可用。

### S2-A04 · 存档已拒绝错误版本，但深层形状与内容引用仍有漏洞

证据：[当前 DTO 校验](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/persistence/migrate.ts:206)、[不变量检查](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/domain/invariants.ts:31)、[效果编译](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/effect-runtime.ts:61)。

| 探针 | 实际结果 | S2 需要的行为 |
| --- | --- | --- |
| schemaVersion / rulesVersion / contentVersion 分别改为 999 | 三者均明确拒绝 | 保留版本拒绝，新增应用存档和 Catalog 身份检查 |
| 带入与当前物品 definitionId 都为 `audit:missing` | 读档成功，效果编译返回空 modifiers/reactions | 在创建/加载时拒绝未知定义，不静默失效 |
| status definitionId 为 `audit:missing` | 读档成功 | 校验状态定义、目标、handler 引用和 payload |
| player-turn 存档的 undoStack 放入 `{action:"audit",state:{}}` | **加载成功，执行 undo 才抛出 length 读取异常** | 加载时检查每个完整 checkpoint，限制嵌套和数量 |
| party 首个 id 改为不存在的角色 | 抛出读取 faces 的 TypeError | 返回带路径的未知角色错误 |
| gold 改成字符串 `"999"` | 读档成功 | 检查所有机械字段的类型、范围和有限数值 |

这些结果不表示正常旧存档全部不可用；现有正常轨迹和版本迁移测试仍通过。它们说明内部不变量函数还不能替代外部输入的完整 Schema 校验。其他未探测字段仍需在实施时按 DTO 全字段覆盖。

### S2-A05 · raw 创建函数未写回机制 RNG

证据：[兼容构造](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/compatibility.ts:78)、[raw 创建](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/expedition.ts)、[S1 特征测试](/Users/liuhang/Documents/project-abyssa/src/game-runtime/testing/battle/testing/extraction-baseline.test.ts)。

固定 seed 19：raw `createExpeditionStateFromInput(mulberry32(19), {})` 的 combat seed/cursor 是 **0/0**，正式 seed 构造是 **19/2**；接着通过 dispatcher roll，骰面分别为 `[1,0,1,0,2]` 和 `[2,4,5,1,3]`。

**影响：**S2 不能直接把 raw FromInput 提升为正式创建入口。新入口应从 seed 建立可序列化随机流，并在初始遭遇/意图生成后保存全部游标。兼容调用的旧行为要保留在隔离的 legacy 入口。

### S2-A06 · CompletionOutput 不是跨场景结算凭证

证据：[loadout 结算](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/loadout.ts:22)。

初始 awaiting-roll 状态也能调用 `createBattleCompletionOutput`，返回 `{result:null,loadout:{...}}`。函数没有终局身份、revision 或唯一 settlementId。带出差量按 instanceId 比较，当前实例缺失被当作剩余 0；definition、归属和实例是否来自本趟带入，不能只靠这份输出证明。

**影响：**应用层应从已提交且合法的终局推导结算候选，验证保管中的物品和初始快照，再以独立身份一次入账。禁止 UI/AI 提交自报的 result、金币或耐久差量。

### S2-A07 · 局部事件与撤回不足以承担全局 Fact/回执身份

证据：[事件发射](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/dispatcher.ts:77)、[撤回](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/undo.ts)、[事件类型](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/domain/events.ts)。

已有结构化领域事件，但 ID 源于 state.eventSequence；旧 wrappers 会恢复输入游标，undo 会恢复 checkpoint 的游标。`facts` 则为叙述文本数组，没有全局身份、来源提交、可见性或撤回关系。

**影响：**全局 Fact 必须使用应用提交身份加批内序号；撤回追加作废信息，不能删掉已发出的事实后复用 ID。存档恢复也必须使旧 AI 任务来源与新进度可区分。

### S2-A08 · React controller 仍持有权威状态，动画参与提交

证据：[controller](/Users/liuhang/Documents/project-abyssa/src/apps/battle/controller/useExpeditionBattleController.ts:35)、[presentation](/Users/liuhang/Documents/project-abyssa/src/apps/battle/presentation/useExpeditionBattlePresentation.ts:240)。

部分 transition 先计算，impact 阶段才 `commitTransition`；清层演出确认还会调用 `acknowledgeLayerClear`，再次发出 end-turn。这里的 commit 只更新 React/ref，并不持久化。生产页面未调用 Battle serialize/deserialize 形成存档服务。

**影响：**S2 应先提供“持久化完成后才返回 CommitReceipt”的应用服务和确定的命令批次语义；S3 再把 UI 变成已提交事件的消费者。不能仅把旧 commit 换成异步存储函数，而继续让动画决定规则是否发生。

## 4. 跨场景接线现状

| 场景 | 本轮核实的现状 | 阶段处理 |
| --- | --- | --- |
| Title | continue 与 begin 都只跳 menu；archive/settings 只提示。未检查存档存在或创建档案 | S2 提供档案操作；S3 接按钮与错误显示 |
| Menu | day=12、dusk，资金 12800/1450/8 是页面样本 | S3 从 Campaign 投影读取 |
| Sortie | roster 混头像/立绘、展示骰面、缺席文案；model 还声明 DOM Storage。hook 写 `abyssa:sortie-order:v1`；本轮搜索未找到 Battle 生产读取者 | S2 定义纯编队/出征输入；S3 地图提交命令后导航 |
| Mansion | 规则文件经 geometry → shared/stage → Stage 传递引用 UI；data 类型依赖 UI rarity；damaged/readyProduction 是 Set；hook 用三次 Math.random 推进 | S2 定义最小持久化表示；S3 按实际闭环需要抽取规则和接线 |
| Shop | 钱包、stock、鉴定与交易在 React 状态；buy 扣钱减货架库存，没有统一 Campaign 物品入账 | S3 另接经济命令；不能视为已有统一库存 |
| Dice/旧 AI | S1 已记录独立规则与浏览器管线混合；S0 默认 AI off | 本轮没有复测宿主协议；S2 不将旧管线提升为新应用层 |

源码入口：[Title 命令](/Users/liuhang/Documents/project-abyssa/src/apps/title/titleCommands.ts)、[Menu](/Users/liuhang/Documents/project-abyssa/src/apps/menu/MenuPage.tsx:120)、[Sortie](/Users/liuhang/Documents/project-abyssa/src/apps/map/sortie/sortie-model.ts:290)、[Mansion 状态](/Users/liuhang/Documents/project-abyssa/src/apps/mansion/mansion-state.ts:35)、[Mansion hook](/Users/liuhang/Documents/project-abyssa/src/apps/mansion/useMansionEstate.ts:73)、[Shop 交易](/Users/liuhang/Documents/project-abyssa/src/apps/shop/ShopPage.tsx:213)。

## 5. 内容与工程边界对计划的限制

1. 当前定稿为六名候选、亲征凯尔占第五席，其余最多四人；代码仍是固定旧五人。S2 应证明 ID/编队可注入，不替未完成的玛丽埃塔机制填数值。测试用第六个合成角色不能算正式内容上线。
2. 展示 DieFace 的 art/花色/沉眠与旧 Battle verb/quality 不是同义模型；不可凭字段相似自动映射。正式战术内容迁移需独立版本与验收。
3. 固定出口方向已采用，但旧战斗在每层 greed 可离场。S2 的 legacy-v1 必须明确是兼容玩法；新出口表与庄园场次不能通过工程重构悄悄替换旧规则。
4. Mansion 完整 Campaign 草图及时间成本有“拟议”标记，不能照抄成首版全部字段和规则。S2 只建立足够支撑出征/回归事务的最小模型。
5. 当前门禁禁止 content → core，且未显式识别 application/runtime/infrastructure；直接新建目录会落入泛化 infrastructure 所有者。必须先更新精确的依赖矩阵，而非放开 app 之间直接引用。

对应依据：[定稿与当前差距](/Users/liuhang/Documents/project-abyssa/docs/archive/snapshots/DESIGN_DECISIONS_AND_CURRENT_STATUS_BEFORE_CONSOLIDATION.md)、[Campaign 拟议轮廓](/Users/liuhang/Documents/project-abyssa/docs/archive/snapshots/GAME_SYSTEMS_AND_CONTENT_SPEC_BEFORE_CONSOLIDATION.md:222)、[现有所有权检查](/Users/liuhang/Documents/project-abyssa/scripts/lib/module-boundaries.mjs:36)。

## 6. 本轮验证与交付界限

| 项目 | 结果 |
| --- | --- |
| 固定工具链核心回归 | 15 文件 / 156 项通过；包含 S1 冻结轨迹 |
| 定向探针 | 11 项运行完成，结果如第 3 节；异常行为作为缺口记录 |
| 本轮生产代码修改 | 无；仅新增规划/审计、更新文档入口 |
| 完整构建 / 全量浏览器 / 远端 CI | 本轮未运行，不能沿用旧数字冒充本轮结果 |
| S2 新能力 | 未实施，计划的验收项均未勾选 |

S1 历史基线仍为 703 项单元/组件、45 项工程、35 项浏览器本地通过；本轮 156 项是其中核心回归的重新运行，不应累加。下一步按 S2 计划的 E0—E6 顺序实施，优先完成兼容装配与 Catalog 贯通，再建设状态/存储/提交/事实与本地 AI 边界。


## S2 实施追记（2026-09-05）

S2已按E0—E6完成源码与本地验收。Catalog已迁出纯规则并全链注入；三层快照、应用命令/CAS/幂等、Memory/IndexedDB、出征物品保管、终局一次入账和可选本地AI均已落地。旧956步状态/事件/RNG与124运行时导出保持。

本轮完整单元/组件752项、工程55项、固定产物浏览器40项通过；四类构建、18兼容入口、UI发布、辅助与Storybook通过。第一次浏览器套件因并行重建产物出现一项404，固定产物后完整复测通过，详细证据和取舍见 [S2实施验收](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-s2-implementation.md)。远端CI未执行。

S3仍负责真实页面的档案→出征→战斗→结算→洋馆接线；S4才调用rp-style-lab。本轮没有修改玩法定稿、标题美术或依赖锁文件，也没有启动外部AI服务。
