> 历史档案：2026-09-07文档整理时归档。原路径：`docs/plans/S2_APPLICATION_FOUNDATION_PLAN.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# S2 内容、存档与应用层实施计划

日期：2026-09-05。状态：**E0—E6 已完成实施与本地验收。** 第 1—15 节保留规划依据，实际 API、取舍和验证结果见第 16 节。

工作目录：`/Users/liuhang/Documents/project-abyssa`。

依据：[S2 勘探审计](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-s2-application-foundation.md)、[S1 实施与交接](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S1_CORE_EXTRACTION_PLAN.md)、[生产化阶段划分](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-production-readiness.md)。玩法解释以[当前定稿](/Users/liuhang/Documents/project-abyssa/docs/archive/snapshots/DESIGN_DECISIONS_AND_CURRENT_STATUS_BEFORE_CONSOLIDATION.md)为准；[系统规格](/Users/liuhang/Documents/project-abyssa/docs/archive/snapshots/GAME_SYSTEMS_AND_CONTENT_SPEC_BEFORE_CONSOLIDATION.md)中标为拟议的内容仍是提案。

## 1. 本阶段目标

**建立 Abyssa 自己的应用底座：注入内容，维护唯一游戏状态，可靠保存和执行命令，并向可选 AI 提供经过授权的已提交事实。**

S2 完成后，测试程序应能在不启动 rp-style-lab 的情况下创建档案、选择受支持的编队/遭遇、执行旧规则远征、保存/恢复、生成终局候选并恰好入账一次。相同请求重试、过期 revision、未知内容和损坏存档都有确定行为。

这验证的是底座能力。**地图出发、战斗演出、刷新续战、结算页与洋馆回归的玩家流程在 S3 接线并验收。** S4 才实现真实 AI 服务适配；它不影响 S2/S3 开始和通过。

### 1.1 S2 必须交付

1. 贯穿创建、执行、selectors、恢复的 Catalog 契约与运行时校验；旧内容作为明确版本注入。
2. Campaign / Expedition / Encounter 的唯一状态归属，以及 JSON 可序列化的应用存档。
3. 游戏应用服务、命令解析、提交身份、回执、幂等与乐观并发控制。
4. 存储 Port、内存实现、IndexedDB 实现；状态、回执、事实、物品交接与结算标记原子写入。
5. 已提交事实的可见性投影、撤回语义，以及第一个任务的本地 AI Port 实现和结果校验。
6. 旧页面兼容装配、独立 Node 门禁、实际浏览器存储验证、S3 交接说明。

### 1.2 本阶段不扩大的范围

| 事项 | 处理 |
| --- | --- |
| 全部页面改为统一状态、先提交后演出、完整回馆 | S3；S2 先交付应用服务与测试消费示例 |
| 新战术骰面、花色、铭约、七件道具、玛丽埃塔完整机制 | 按内容定稿另做规则/内容迁移；本轮不填占位规则冒充实现 |
| 庄园完整场次、平衡数值、委托远征、全力模式 | 不作为 S2 底座的前置条件 |
| 洋馆全部经营命令、商店全部经济、Dice 新回合引擎 | S3 按最小闭环需要抽取，S2 不整目录搬入内核 |
| HTTP/SSE、Provider、Package、Session/Workflow 绑定 | S4 适配层；S2 不修改 rp-style-lab |
| 通用 ECS/DSL、事件溯源、云存档、多分支合并、后台服务 | 不建设；使用状态快照、原子提交和明确协议即可 |
| 仓库整体改为 monorepo 或全面移动 HTML/美术资源 | 沿用 S0 的入口/发行组织，不为目录对称创建空模块 |

## 2. 起点与必须修复的缺口

S1 已通过本地完整门禁；本轮重新运行核心 **15 文件 / 156 项**通过。现有 schema **4** / rules **1** / content **1** 是旧 Battle 协议，不是未来整个游戏的存档版本。

| 审计项 | 当前事实 | S2 对应工作 |
| --- | --- | --- |
| A01 | 17 个生产文件直接引用旧内容；固定五人；StartInput 只有 location/loadout | Catalog、可注入编队/遭遇、兼容装配 |
| A02 | BattleState 实际含整趟远征 | 字段所有权表、规范化快照、可逆纯投影 |
| A03 | 未知命令返回原命令对象 | unknown 输入解析，统一错误协议 |
| A04 | 未知 effect/item、字符串 gold、坏 checkpoint 等不能可靠拒绝 | Schema → 内容引用 → 跨字段不变量三段校验 |
| A05 | raw FromInput 留下错误 RNG 游标 | 唯一正式 seed 创建/恢复链 |
| A06 | 初始状态也能生成 result=null 的 CompletionOutput | 终局 guard、保管关系、唯一结算身份 |
| A07 | 局部 event ID 可复用，facts 是文本 | 应用 Commit/Fact 身份、撤回作废关系 |
| A08 | React/ref 是权威状态，impact 才提交 | 持久化后返回回执；S3 替换页面提交模型 |

本表 A01—A08 均指 [S2 审计](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-s2-application-foundation.md)，不是早期生产审计中的同名编号。

## 3. 架构与目录归属

### 3.1 调用方向

```text
页面 / 测试驱动
  → game-runtime：装配并提供应用实例
    → game-application：输入解析、读状态、运行命令、组织提交、事实投影
      → game-core：纯规则、状态不变量、确定性 RNG、领域结算
      → GameStorePort ← game-infrastructure/storage：memory / IndexedDB
      → AiApplicationPort ← game-infrastructure/ai：本地实现

game-runtime 加载 content/gameplay，校验后注入 core/application。
未来 integrations/rp-style-lab 仅实现 AI Port，由 runtime 按需注入。
```

选择独立的 `src/game-application`，而非让所有页面引用 `src/apps/game`。现有 app 间禁止直接依赖的规则继续成立。应用层不依赖 React、具体存储实现或具体内容包。

### 3.2 有代码进入时才建立的目录

| 位置 | 唯一职责 |
| --- | --- |
| `src/game-core/contracts` | 游戏 ID、Catalog/输入类型及纯校验；类型只有一个所有者 |
| `src/game-core/battle` | 参数化的既有规则、selectors、RNG；不包含正式内容实例 |
| `src/game-core/session` | 三层状态、旧执行形状投影、出征与终局交接的纯规则 |
| `src/content/gameplay/legacy-v1` | 旧角色、平衡、遭遇表、效果定义，冻结为兼容内容 |
| `src/game-application` | 命令服务、存档/回执协议、Store/AI Port、Fact 投影和接受规则 |
| `src/game-infrastructure/storage` | 内存与 IndexedDB 存储实现；数据库升级及平台错误映射 |
| `src/game-infrastructure/ai` | 无网络的短反应实现；不嵌入复杂 Prompt 或上下文管线 |
| `src/game-runtime` | 内容与 Port 装配、旧 Battle facade 绑定；浏览器入口与纯兼容装配分文件 |

本阶段不创建没有实现的 integrations 目录。根 `src/index.ts` 继续只发布 UI，game-core/application 不进入 `@abyssa/ui` 公共导出。

### 3.3 门禁调整

- core 仍只能依赖 core 内纯代码；禁止网络、DOM/React/Node I/O、时间、Math.random、具体内容和宿主类型。
- application 仅依赖 core 公开入口与自身；不依赖 concrete content、runtime、infrastructure、app 或 UI。通过注入的 Port 完成副作用。
- `content/gameplay` 可以 **type-only** 引用 core 的公开 Catalog 契约；禁止运行时导入规则。原有展示 content → shared/domain/assets 规则继续适用，gameplay 子树另禁止素材 URL/浏览器引用。
- infrastructure 仅实现 application 公开 Port，可引用其 DTO；不得绕过应用服务自己执行奖励、战斗或写业务补丁。
- runtime 是具体内容、应用和适配器的装配根；纯 `legacy-battle` 装配不能传递加载 IndexedDB/DOM 模块。
- apps 通过公开 runtime/application 入口消费新能力；禁止跨 app 导入。shared/UI 和工具不得反向依赖 application/runtime/infrastructure。
- 测试夹具和兼容回归可以有精确的测试目录例外；生产检查仍覆盖 type-only、再导出、动态导入、符号链接和循环。

先修改所有者识别及失败用例，再加入新目录。不能让新目录默认落入宽泛 infrastructure 类别而绕过门禁。新增独立 application 的无 DOM 类型检查和 Node 导入检查；IndexedDB 只在适配器项目启用 DOM 类型。

## 4. Catalog 与旧规则兼容

### 4.1 正式内容契约

Catalog 至少覆盖本轮实际使用的角色/六面骰、战斗数值、敌人模板、遭遇槽位、路线层表、效果定义和允许的规则 handler ID。它是只读数据，不包含函数、React 节点、Storage、图片 URL 或模型配置。

每个包固定 `catalogId + contentVersion + rulesVersion`；发行清单记录规范化内容摘要，加载时验证实际内容与身份一致。相同身份不允许静默修改内容。摘要用于内容一致性，不当作签名或玩家防作弊机制。

Schema 与引用验证至少覆盖：

- ID 唯一、引用存在、角色有合法六面骰、数值有限且在该规则域内；拒绝空编队、重复成员、超员和未具备机制定义的角色。
- Enemy instance ID 与 definition ID 分离；遭遇引用敌人定义，运行时实例由内核生成。
- 路线/遭遇表只支持当前需要的有序槽位与有限随机候选，不建设通用 DSL。保持旧第二层随机分支的抽取次数和比较语义。
- 所有 action/status/item/equipment/trait/encounter-rule、队列和 checkpoint 内引用都要检查；未知定义不能 continue 跳过。
- 反应 handler 由内核固定注册，Catalog 只能引用允许 ID 和受约束参数。玩家存档与未来 AI 结果不能传函数或任意脚本。
- 展示名称可以作为内容文本；素材通过页面的 ID → 展示清单映射。角色资料/隐藏剧情不随整个 Catalog 直接交给 AI。

正式入口采用 `createBattleEngine(validatedCatalog)` 返回绑定同一只读上下文的 create/dispatch/select/restore 能力。禁止模块级可变“当前 Catalog”；两个不同 Catalog 的引擎实例必须能并行运行而互不污染。

### 4.2 创建、编队与 RNG

正式创建以 `seed + validated start input + Catalog` 为唯一入口。输入引用 destination/route、编队 ID 和已由 Campaign 确认的带入实例；不接受客户端完整 BattleState、敌人 HP 或任意奖励。

内容机制 ID 不再固定为五人联合；通过 Catalog 校验后使用稳定 ID。首版亲征策略表达“凯尔领队、其他已开放成员最多四名”，编队顺序由输入保存，骰子从该编队生成。使用合成第六角色/不同遭遇的测试证明可注入，不把合成数据加入玩家内容。

`legacy-v1` 仍只有五人的已实现机制。缺少正式机制的玛丽埃塔返回内容未就绪；展示 roster 可以有她，正式出发不能伪造空白骰通过。委托流程不在本阶段实现。

从 seed 建立 combat/loot/flavor，初始敌人和意图生成后写回游标；恢复直接使用已存 RNG，不能再次播种。三条流继续贯穿旧远征，换层不重置；标识生成、UI 动画、AI 和存储重试不消费这些流。新游戏 seed 可由 runtime 提供，重试使用同一已提交/待确认请求中的 seed。

### 4.3 兼容迁移策略

S2 允许重构内部入口，但保留现有页面 `src/apps/battle/engine.ts` 的外部行为：

1. 把具体旧内容移到 `content/gameplay/legacy-v1`，将敌群工厂分成冻结数据与通用纯创建逻辑。每个规则函数沿调用链接收同一个上下文，selectors/迁移也必须贯通。
2. 在 `game-runtime/legacy-battle.ts` 绑定旧 Catalog，提供旧 124 个运行时导出、旧函数参数和旧 schema 4 序列化。页面 engine 只转发该装配。
3. 旧五人类型与通用机制 ID 分开：旧 facade 保留五人类型兼容，防止页面 exhaustive Record 等被意外拓宽。共享状态类型可用类型参数复用，不复制两套规则。
4. 移除被替代的 core legacy 装配入口，迁移其测试/调用点；不能让 core 再反向导入 runtime 来“保留路径”。S1 的内部便捷入口改为需要显式内容的正式入口；它尚不是对外 npm API。
5. 旧 wrappers 的事件游标语义及 raw RNG 限制只留在兼容装配。正式应用服务不得调用 raw 构造器或允许外部 RNG override。
6. S1 的 956 步完整状态、事件、旧存档和 124 导出清单不重录；用旧 facade/纯展开投影进行比较，必要时保持旧 JSON 字段顺序。测试适配代码可迁移，冻结 fixture 字节不变。

兼容测试迁到 runtime 的 Node 测试组；core 测试使用显式测试 Catalog，测试夹具不进入生产闭包。不能通过保留整份旧引擎再另写一份新引擎取得表面通过。

### 4.4 版本边界

新 `GameSaveEnvelope` 从应用 schema **1** 开始，与旧 Battle schema **4** 分开。command/fact/AI 也各自使用协议版本，不把所有版本统一递增。

旧 Battle 4/1/1 仅描述 legacy-v1 的旧格式；不能用同一版本名装入任意新 Catalog。参数化后若 legacy 规则行为不变，保持 rules 1；新增战术骰语义或经济规则时另开规则/内容版本并建立迁移预期。

## 5. 三层状态与存档模型

### 5.1 唯一快照

应用存档的逻辑轮廓如下；字段名可在 E0 细化，但所有权不得改变：

```ts
type GameSnapshot = {
  campaign: CampaignState;
  expedition: ExpeditionState | null;
  encounter: EncounterState | null;
};

type GameSaveEnvelope = {
  schemaVersion: 1;
  head: { saveId: string; epoch: string; revision: number };
  contentRef: CatalogRef;
  snapshot: GameSnapshot;
};
```

`head` 由应用存储协议拥有，不放进可撤回的 Battle checkpoint。Campaign 的 activeExpeditionId 只是引用，必须等于快照中的活动远征身份；不存另一份远征状态。保存校验检查三层引用和生命周期的组合。

### 5.2 字段归属表

| 所有者 | S2 放入的事实 | 约束 |
| --- | --- | --- |
| Campaign | 档案/角色开放状态、世界时间、public/party/crystal 余额、在馆物品实例、最小洋馆状态、活动远征引用、已应用结算标记 | 不含动画、骰局 UI、宿主会话。初始数值由明确样本/内容配置提供，不从菜单硬编码值推断 |
| Expedition | 本趟身份和路线、编队及远征成员状态、层/最深层、未入袋/入袋金币、层倍率累计、最后层结算、带入基线/当前携带物、三条 RNG、跨回合/层效果、enemySequence | 是跨 Encounter 的可写事实；在馆库存中不保留可同时消费的携带物副本 |
| Encounter | 遭遇身份/定义、回合和回合阶段、敌人实例/意图、骰子、重掷数、停滞判断/上次 HP、当前待解析队列和本轮掷骰记录 | 引用 Expedition 成员；不另存一份成员 HP、钱包、带入物和 RNG |
| 应用提交元数据 | revision、回执、Fact、checkpoint → 来源提交关联、结算身份 | 不被战斗 undo 回滚 |
| Presentation | 画面旧值/新值、动画队列、选中目标、已播放游标、场景实例 ID | 非权威，可在刷新后从最新快照重建或跳过 |

旧 party 中 HP/downed/rustLevel/shield/sealedNext 暂整体归 Expedition 的成员运行态，以避免同一成员分散到两个可写副本；盾牌虽按回合重置，仍由规则生命周期处理。旧 statuses/encounterRules 按 duration 跨层，因此归 Expedition 效果集合，目标可引用当前 Encounter，离场时按规则清理。

旧 log/facts 保留为远征兼容展示材料，不当作正式事件证据。旧 eventSequence 只在兼容执行上下文中维持；应用全局身份另行生成。

Expedition 生命周期负责 `in-encounter / exit-choice / finished`；Encounter 只负责活动时的 `awaiting-roll / player-turn / enemy-turn`。在 exit-choice/finished 可保留最近 Encounter 的机械画面数据，但 turn 为非活动，不再有第二个可写的 greed/finished/result。Campaign 结算后清除活动运行态，已结算由 ledger/结算摘要表达，不再保留一份可执行的 settled 远征。

### 5.3 与旧规则协作，避免一次重写解析器

在纯 `session` 层实现显式 `toExecutionState` / `fromExecutionTransition`：从三层运行态临时构造旧规则需要的平坦执行形状，调用唯一参数化规则，再分配回各自所有者。临时平坦状态不写入数据库，也不被 React 持有为第二权威源。

迁移必须有逐字段清单，覆盖第 5.2 节以及每个 undo checkpoint，验证合法旧状态的 round-trip、终局、敌方中断、层结算和 RNG。出现无法无损映射的字段应补足所有权，不能丢掉字段或用通用 `extraState` 藏第二份 BattleState。

撤回 checkpoint 保存 Expedition/Encounter 的必要机械切片，明确排除 Campaign 长期资产、应用 head/回执/结算 ledger 和其他 checkpoint；携带物消耗属于远征机械状态，可按旧规则恢复。带入基线是不可变审计输入，允许与当前携带物同时存在，但不是第二份可消费库存。

### 5.4 最小 Campaign 与内容克制

S2 只把出征/归还需要的实例、余额和身份做实。Mansion 的 Set 在正式 DTO 中使用无重复 ID 数组，临时查询可转 Set；不直接序列化整个 hook。UI rarity、房间 geometry、肖像和 StockGrid 格子属于投影。

完整成长、关系、未知掉落鉴定、设施配方和委托列表等，只在有规则消费时加入版本化模型，不照抄系统规格里的整份拟议 CampaignState。首版不自动应用拟议时间成本或永久伤势。

## 6. Command、Commit 与回执

### 6.1 输入协议

每个可写请求包含 `protocolVersion`、`saveId`、`clientRequestId`、`expectedHead`、命令类型/参数；涉及远征时还必须带 expeditionId。用 discriminated union 的运行时解析器逐字段校验，拒绝未知类型、额外字段、错误版本、非有限数和未知 ID。直接 TypeScript 调用也必须经过同一公开应用入口。

首版公开命令族：

- `start-expedition`：受验证编队、路线、带入 instanceId 与 seed；应用从 Campaign 取实际数据。
- `battle-command`：受限的既有玩家命令；生产路径一次 `end-turn` 完成敌方整批结算。begin/resolve-next/finish 的分步命令作为内核/兼容能力，不让动画通过公开协议驱动权威进度。
- `settle-expedition`：只提交远征身份和预期来源；应用从持久化终局推导奖励/带回内容。
- `undo`：委托现有允许范围，只撤回远征机械动作。

档案 create/open/export/import 是同一应用服务的专用操作，也需运行时校验和原子写入；不伪装为普通 BattleCommand。协议不接受任意路径 patch、完整状态覆盖、`grantGold` 或来自模型的自报结算。

旧存档可能停在 enemy-turn 中途。应用加载后须识别其持久化游标，提供内部 `resume-enemy-turn` 恢复批次：只执行尚未处理的敌人并完成收尾，使用同样的 CAS/回执，不能再次 begin 或重打已处理敌人。恢复是否执行由应用流程决定，不由 UI 动画 ack 决定；正常 open 本身保持只读。

### 6.2 提交流程

1. 解析输入，得到规范命令及请求指纹；指纹包含预期 head、远征身份和参数，忽略对象键排列，不忽略语义字段。
2. 查同档案/来源 epoch 的 requestId 回执。相同指纹返回原回执；不同指纹返回 `request-id-reused`。
3. 读取最新快照，验证 expectedHead、版本、活动远征和领域前置条件。
4. 在独立候选快照上纯执行；失败不修改已加载状态，不消耗已提交 RNG，不发布事件。
5. 为成功候选分配新 revision/commitRef、事实、物品交接和必要结算候选，完成输出不变量检查。
6. Store 在同一事务内再次检查 requestId 和 expectedHead，原子提交所有记录。并发失败丢弃候选，不把命令自动套在新 head 重算。
7. 仅在事务完成后返回 `CommitReceipt`，发布给 UI/AI。写入失败不能把候选 state 提前安装成权威状态。

`CommitRef = saveId + epoch + revision`；revision 是该档案来源内的单调安全整数。失败不推进机械 revision。标识分配不依赖 Battle RNG；同请求的成功重试总是拿到原 commit/receipt。

### 6.3 幂等与错误矩阵

| 情况 | 必须行为 |
| --- | --- |
| 同 requestId/指纹，首次成功后响应丢失 | 返回原回执；不再扣费、掷骰、入账或发布 AI cue |
| 同 requestId，不同命令/参数/expectedHead | `request-id-reused`；不当作新请求 |
| 不同 requestId，同一旧 revision 并发 | 最多一份成功，其余 `conflict`；调用方重读后若继续须用新 ID |
| 合法协议但领域拒绝 | 记录稳定拒绝回执；状态、RNG、revision、Fact 不变 |
| head 冲突 | 记录该合法请求的冲突结果；同 ID 重试返回同结果，不能后来悄悄成功 |
| 未知协议、坏 JSON、无法确定有效请求作用域 | 解析阶段拒绝，不写存档或业务回执 |
| quota/事务中断/存储不可用 | 返回存储错误；不声称成功，可用同 ID 核对/重试 |
| 迟到的成功回执已不是当前 head | 可展示请求完成信息；不得用回执旧状态覆盖最新快照 |

拒绝/冲突回执可以在不改机械 revision 的事务中写入；Store 内必须先判断 requestId 是否已被另一并发请求占用。不存在的档案不能因坏请求自动创建。

Receipt 包含请求身份/指纹、结果、来源/结果 head、规则/内容身份、事件或 Fact 引用及必要的结果投影。回执不是“最新状态缓存”；重试回执与读取最新状态是两个操作。

## 7. 存储、加载和迁移

### 7.1 GameStorePort 与实现

Port 提供有明确结果联合的档案列表/读取、回执查询、原子 compare-and-commit、导入/创建能力。应用层构造候选，Port 只负责事务和并发，不包含战斗规则。不暴露通用 SQL、任意键写入或 read + save 两个无 CAS 的独立操作。

IndexedDB 至少使用 head/snapshot、receipts、commits/facts 等记录；结算标记与物品归属可以在 snapshot 内。一次事务覆盖受影响的全部 object store，以 `transaction.oncomplete` 为成功标准，单个 put 的 success 不代表提交完成。

内容加载、异步摘要计算、规则执行、AI/网络均在事务之外。事务内只做必要的读/比对/写，避免跨异步等待导致事务提前关闭。并发保证依赖数据库事务，不能只靠单标签页 Promise 队列。

内存实现用于 Node 及故障注入，遵守同一 contract suite。IndexedDB 用真实浏览器验证两个连接并发、重新打开数据库、事务 abort、版本升级被旧连接阻塞等情况；内存通过不能替代真实适配器验证。

多标签页的通知只提示重读，不赋予写权限；CAS 始终生效。S2 不要求 leader-election、Service Worker 或通用消息总线。

### 7.2 加载与失败结果

加载顺序固定为：字节/JSON 与结构限制 → 应用/规则/内容版本 → Schema 全字段 → Catalog 引用 → 跨字段/三层不变量 → 可执行状态。所有 undo checkpoint 同样校验；限制深度、集合规模和存档字节数，具体上限在 E0 用现有最大夹具测量后登记。

返回 `not-found / malformed / unsupported-schema / unsupported-rules / missing-content / content-mismatch / invariant-violation / storage-unavailable` 等可判别结果与字段路径。缺少旧 Catalog 时不能回退为当前最新版，损坏存档不能自动新建覆盖。

应用只在完整校验后暴露状态。失败保留原始档案供重试/导出；没有正式迁移函数就明确拒绝，不“修复”未知 ID、截掉未知库存或吞掉坏 checkpoint。

首版回执与结算去重标记在档案生命周期内保留，不按刷新清空。Fact/回执增长应有容量观测与明确写入失败；不为节省空间静默删去去重凭证。全量压缩/历史分页可后续演进，不能削弱当前幂等承诺。

### 7.3 三种恢复路径

| 输入 | S2 策略 |
| --- | --- |
| 当前应用存档正常关闭再打开 | 保留 saveId/epoch/revision、回执和 RNG；只是重读，不是时间回退 |
| 导入旧 Battle schema 1—4 | 运行既有迁移，再做新的完整验证，转换为显式的 legacy 独立远征档案；不合并到任意已有 Campaign 钱包 |
| 导入应用快照/历史备份 | 创建新档位、新 saveId/epoch，保留来源引用；整份资产与已应用结算状态一起恢复，重建来源身份，旧 AI cue 不沿用 |

S2 不实现同档位任意历史覆盖或分支合并。通过“恢复为新档位”满足恢复旧进度时来源更新的要求，也避免回执/资产来自不同时刻。原档位保持可读，导入失败不覆盖它。

正式导出是版本化档案包，除第 5 节的当前 envelope 外，还包含恢复所需的结算候选/标记、Fact 作废关系和 checkpoint 来源关联；不能只导出 mechanical snapshot 却承诺完整恢复。导入时统一重映射活动身份/引用到新来源，并保留 originRef；已结算记录仍为已结算，未结算候选重新绑定，资产数值不变。旧请求回执仅作来源历史，不成为新档位可执行请求；导入不重播奖励或 AI。必须测试所有引用闭合以及已结算/未结算两类导入后的再次结算行为。

旧 Battle 文件没有 Campaign 钱包、物品保管和全局结算证据，因此仅能恢复其自身机械进度。不能凭旧 result 给现有档案发奖励；迁移后可在该独立档位继续旧远征，并在其自身 ledger 内一次结算。正常旧格式的迁移规则保留，异常旧文件要明确拒绝。

数据库结构版本和 GameSave schema 独立。升级先保证旧数据可读/可导出，迁移成功后再安装新记录；blocked/versionchange 给明确诊断，不删除数据库作为自动修复。

## 8. 出征与终局事务：S2 做基础，S3 接页面

### 8.1 出征保管

首版一个 Campaign 最多一趟活动远征。`start-expedition` 验证开放角色、队伍上限/重复、路线支持、物品存在/可带入、数量和归属；在同一事务中将携带的可消费物/装备从在馆库存转交 Expedition，保存不可变带入基线，生成运行态并设置活动引用。

Trait 是成员能力快照，不作为可交易物扣除。首版活动远征期间不开放其他 Campaign 经济写命令，避免库存容量或相同实例在另一页面被出售；S3 开放并行经营时需另设合法的保留策略。

事务失败则库存和活动引用都不变。相同出征请求重试不会生成第二趟远征。Map 的旧 sessionStorage 令不能充当这份事务凭证。

### 8.2 终局候选与结算

终局命令成功提交时，应用从 **finished 且 result 非 null** 的已验证状态产生候选，绑定 saveId/epoch、expeditionId、terminalCommitRef、Catalog 版本和带入基线。候选由应用产生并持久化，客户端不能提供权威 reward/loadout diff。

结算身份以档案来源和 expeditionId 为稳定去重键，同时校验 terminalCommitRef。只用 commandId 去重不够：玩家换一个请求 ID 并基于最新 head 再提交，也必须返回 already-settled；若携带旧 head，则按通用协议返回 conflict，两者都不再入账。

`settle-expedition` 的单次事务完成：

1. 检查候选归属、终局身份及未结算标记。
2. 验证消耗/磨损、instanceId/definitionId、数量范围与带入保管关系；不得因实例缺失就无条件视为合法消耗。
3. 按受版本约束的结算策略归还剩余物/装备，入账本趟结果，记录 settlementId 与 Fact。
4. 清除活动远征引用，结束运行态，写入回执；事务失败则全部保持原状。

legacy-v1 结算样本使用旧 result 的远征收益、写入 partyFund/晶石，不额外扣在馆存款、不引入拟议永久伤势/时间成本。该适配是兼容规则，不代表完整新经济数值已经定稿。

S2 必须验证“终局已存、尚未结算时重启”和“结算成功但响应丢失”两种中断窗口。S3 验证同样语义在实际结算页、返回洋馆、跨页/刷新时仍成立。

## 9. Fact、撤回与 AI 边界

### 9.1 正式 Fact

每个 FactBatch 绑定 CommitRef、expedition/encounter、内容/规则版本、世界时间和来源类别。来源至少区分当前冒险与测试模拟；手工历史不从模型生成结果推导。

FactId 由 commitRef + 批内序号生成；旧 event.id/causeId 仅作为诊断关联。通过显式映射从结构化领域事件生成 Fact，不能解析中文 log/facts 文本反推死亡、奖励或角色关系。

每种 Fact 定义允许载荷和可见范围，如玩家可见、参与者可见、内部机械。投影按任务与角色生成新 DTO，排除 RNG seed/游标、隐藏敌人/未来遭遇、私人背景和未经授权的其他角色信息。未知 Fact 类型默认不导出。快照中的角色资料和元数据也必须过滤，不能只删事件正文。

### 9.2 撤回后的历史

机械 undo 保持旧允许范围，恢复其机械 checkpoint；应用 head 单调前进。应用维护 checkpoint 与来源提交的关联，undo 成功时追加哪些 Fact 被 superseded/retracted，不能复用或删除旧全局身份。

新的投影不把已撤回事件描述为仍然成立；迟到的旧任务按来源失效。已经发给外部服务的信息无法通过撤回收回，S4 需发送上下文失效/重建信号；S2 先明确来源和事实作废语义。

首版短反应只作演出，不写永久关系/剧情，因此不用在 S2 建造通用 NarrativePatch 或关系回滚系统。若后续允许 AI 影响持久叙事，必须增加独立受约束应用命令与迁移。

### 9.3 最小 AI Port

第一个任务固定为 `react-to-commit`：对少量已提交事件产生短对白/表情。本地实现根据事实模板返回，测试替身负责延迟、失败、乱序和非法结果。默认装配不依赖网络或模型配置。

请求至少包含：协议/任务版本、cueId、source CommitRef、场景实例/参与者 ID、授权 Fact 投影、可用表情/动作 ID、语言、输出行数/字符预算和任务截止信息。输出只能包含相同来源、合法说话者、短文本、已允许的表情/动作及所引用的 FactId。

Port 暴露可取消的任务句柄与成功/失败/取消结果；runtime 的计时/取消实现留在适配层，不把 DOM AbortSignal 或模型 SDK 类型灌入 core。Abyssa 应用侧验证结果，适配器即使声称已验证也不能跳过这一步。

接受条件同时检查：cue 仍待处理、来源 head 和活动远征/场景仍匹配、未取消/超时、schema/预算/人物/资产/事实引用合法。同 cue 最多接受一次。状态已前进时首版保守丢弃，不尝试把旧对白自动重定位到新场景。

失败、无结果、超时或服务缺失采用本地台词/跳过，不能撤销规则提交或重新执行机械命令。正常重开页面丢弃旧演出任务；不为了恢复对白自动重发本趟奖励。

S2 不实现模型候选行动。但接口边界确定：未来候选只能转换为当前应用命令再次做来源/规则校验，不能直接修改 GameSnapshot。Provider、Model Slot、Pipeline DAG、Conversation、Release、宿主 branch/checkpoint 都不得成为游戏存档必填字段。

## 10. 分步实施与退出门槛

这些是同一 S2 的执行顺序，不是新增独立任务。每步完成即更新本文件的实施记录；有依赖的步骤按序，独立检查可批量执行。

| 步骤 | 具体工作 | 退出条件 |
| --- | --- | --- |
| E0 契约与兼容探针 | 登记字段/调用点、测量存档和 checkpoint 上限；明确新类型和依赖矩阵；证明 124 导出可由外部兼容装配维持 | 方案可编译，所有权失败用例到位，已有 fixture 不变；不先大规模搬文件 |
| E1 Catalog 贯通 | 纯内容契约、完整引用检查、旧数据迁出、规则/selectors/恢复注入、唯一 seed 路径、旧 facade 装配 | 旧完整基线通过；两个 Catalog 并行隔离；变更编队/遭遇后能执行/恢复；未知 ID 明确拒绝 |
| E2 状态与迁移 | 三层唯一所有权、旧形状可逆投影、GameSave v1、深层校验、档案导入策略 | 旧正常存档与中断状态无损；损坏 checkpoint、gold 字符串等在加载前失败；不出现重复钱包/RNG |
| E3 原子存储与命令服务 | memory/IndexedDB Port、create/open/export/import、CAS、回执/错误、命令解析 | 两实现通过同一 contract；真浏览器重开/双连接/abort 通过；失败候选不发布 |
| E4 出征/终局交接 | 实例保管、start 命令、终局 guard、唯一结算候选与入账 | Node 驱动真实规则完成远征；不同请求重复结算只入账一次；两个中断窗口可恢复 |
| E5 Fact 与本地 AI | 结构化映射、可见性、undo 作废、短反应任务、结果接受与取消 | 隐藏信息不外泄；迟到/重复/非法结果不接受；AI 失败不影响机械/存储结果 |
| E6 整体验收与交接 | 所有门禁、文档、兼容页面回归、S3 消费说明 | S2 DoD 全满足；页面未迁移部分与远端 CI 状态如实登记 |

E0/E1 风险最高：必须先打通创建→执行→selectors→恢复的一条真实路径再批量迁移，不能只改 import 和构造器。E2 不重写 Battle 解析器；E3 不能用无事务 localStorage 暂代正式实现；E4 不能只用伪造 finished 状态证明端到端。

## 11. 验证矩阵

| 编号 | 场景 | 验收证据 |
| --- | --- | --- |
| V01 | legacy 兼容 | S1 956 步/旧存档/事件/RNG/124 导出完整回归，fixture 哈希不变 |
| V02 | 内容注入 | 不同合法编队顺序、少于五人、含合成第六候选的编队、替代遭遇均可执行/读档；两个 Catalog 不互相污染 |
| V03 | 完整校验 | 未知角色/物品/effect/handler/目标、坏数值、重复实例、超员、错版本、缺内容、所有 checkpoint 明确拒绝 |
| V04 | 确定性 | 同内容/seed/命令与恢复得到相同机制结果；失败和 CAS 冲突不消耗已提交 RNG；动画/AI 不消费机制流 |
| V05 | 三层投影 | 所有字段与 checkpoint round-trip；敌方中断、greed、finished、撤回无损；唯一资产和 RNG 所有者 |
| V06 | 请求幂等 | 同 ID 同参、同 ID 异参、响应丢失重试、稳定拒绝回执；旧成功回执不覆盖最新状态 |
| V07 | 并发/持久化 | memory 与 IndexedDB contract；两连接旧 head 竞争最多一成功；abort/quota/重开不会部分写入 |
| V08 | 出征交接 | 同请求不重复出征，物品仅在一处可消费，非法带入失败不扣物，不允许第二趟活动远征 |
| V09 | 终局与入账 | 非终局拒绝；用真实命令到终局；换 requestId 重结算不重复；重启两窗口后结果一致 |
| V10 | 恢复/迁移 | 旧 schema 1—4 合法样本；错误版本保留原档；历史导入新身份；无 Campaign 凭证的旧结果不并入现有钱包 |
| V11 | Fact/undo | 全局身份不复用；撤回后事件作废、来源前进；未提交/内部/他人私有字段不出投影 |
| V12 | AI 接受 | 正常本地反应；失败/取消/超时/重复/乱序/旧场景/旧 head/越权人物或资产全部按契约处理 |
| V13 | 依赖门禁 | core/application 无 DOM/React/I/O/内容实例/宿主；UI 包闭包不含游戏服务；新目录不能绕过边界 |
| V14 | 原有页面与发行 | 旧 Battle 页面及完整工程基线通过；四类聚合、18 兼容入口、UI 发布契约和现有浏览器检查保持有效 |

E0—E5 按变更运行定向检查；E6 再运行完整工程/发行回归，避免每改一份文档就重跑全部构建。新增 Node application 项目并纳入 `npm test`/`check:baseline`；真实存储浏览器测试纳入 S0 的真实产物验证流程。

沿用现有 `check:core`、`check:baseline`、`build:all`、`build:entries`、`release:check:ui`、`release:check:game`、`check:auxiliary`、Storybook 和浏览器门禁；新增 `check:application` 等命令时同步脚本、文档和 CI。不得为过关降低 S1 边界或更新语义 golden。

## 12. 风险与控制

| 风险 | 控制 |
| --- | --- |
| 抽走内容后旧兼容导出依赖不闭合 | E0 先验证外置 binder 与旧 TS 消费者；保留页面 facade，禁止 core 反向引用 runtime |
| Catalog 只在 create 注入，其他路径仍查默认表 | 审计 17 直接消费者，双 Catalog 并行测试覆盖 dispatch/select/restore/换层 |
| 状态拆分导致完整 checkpoint 丢字段 | 显式映射表和旧状态 hash/round-trip；不以 UI 看起来正常代替 |
| S2 被新玩法拖住 | 只冻结 legacy-v1 兼容轮廓，合成内容用于契约测试，玩法变化独立版本 |
| 存储成功与画面成功混淆 | 仅事务 complete 后发布；S3 分离 durable state 与演出副本 |
| 去重只靠 requestId，终局换 ID 后又入账 | 另建档案/远征级 settlement key，并放入同一事务 |
| 读档重放事实导致 AI/奖励重复 | 普通 open 只读取；恢复新档位换来源；cue 接受一次，奖励由 ledger 约束 |
| 老内容被清理导致旧档不可读 | legacy Catalog 随兼容发行保留；找不到准确版本则明确拒绝 |
| 工作树已有大量未提交修改 | 分阶段记录当前文件哈希，限定修改集；不 reset/clean，不覆盖标题/素材/设定 |

## 13. S2 完成定义

- [x] 内容引用、编队/遭遇注入和 seed 创建贯通，不存在正式路径的隐式默认 Catalog。
- [x] 旧 facade/序列化/固定轨迹兼容，唯一规则实现与 UI 包边界保持。
- [x] 三层规范状态、完整加载校验、历史导入来源和版本策略有代码与测试。
- [x] Memory/IndexedDB 原子存储、请求去重、CAS 冲突、失败回执与真实浏览器恢复通过。
- [x] 出征物品唯一保管，终局只能结算一次，两个中断窗口通过实际规则驱动验证。
- [x] Fact 仅来自已提交结构化结果，撤回身份与可见性规则通过。
- [x] 本地 AI Port 可运行且可失败；非法/过期结果不能改变游戏机械状态。
- [x] 核心/应用 Node 类型和导入、工程边界、旧页面与发行回归通过；远端 CI 单独记录。
- [x] S3 的页面接线说明齐全；未将“底座验证通过”写成“玩家闭环已经完成”。

## 14. 交给 S3 的接线清单

2026-09-05：本清单已展开为 [S3 玩家闭环计划](S3_PLAYABLE_LOOP_PLAN.md)，页面实况与新增恢复探针见 [S3 审计](../audits/2026-09-05-s3-playable-loop.md)。S3 当前仅完成规划，下面的接线项尚未实施。

1. Title 从应用服务区分新建/继续/记录；存档不存在、损坏和缺内容有明确 UI。
2. Menu/Mansion/Shop 从同一 Campaign 读投影；按闭环需要抽取领域命令，去掉各自独立的钱包/库存权威副本。
3. Map 使用内容就绪的 roster/编队，提交 start-expedition 成功后才导航；URL/转场只带档案定位，sessionStorage 不交接完整权威状态。
4. Battle 加载活动远征，以已持久化回执驱动演出；UI 可以在 impact 才显示血量，但真实提交已完成。清层 ack 不再发第二次结算命令。
5. 终局页通过 settle-expedition 交接，重复点击/刷新只得到同一结果；返回洋馆从 Campaign 重新读取。
6. 实测地图→战斗→结算→洋馆，并在攻击动画、敌方整批演出、终局前后中断/刷新；全程无模型配置、无 rp-style-lab。

旧 UI 的四套皮肤、标题素材和共享转场不因 S2 提前重做；接线时调整状态所有者，保留演出能力。

## 15. 规划交付记录

本轮已完成源码勘探、11 个入口探针和核心回归，详细结果见 [S2 审计](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-s2-application-foundation.md)。新增本文并更新 README、game-core 说明、S1 交接和生产化审计入口。

规划文档的本地链接与引用行号检查通过，`git diff --check` 通过。以本轮开始时的文件哈希对照，修改范围仅为上述 6 份 Markdown；既有源码/素材/依赖改动均保留。本地核对记录位于 [document-verification.json](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/document-verification.json)。

**以上是规划轮次的交付：当时未实施 E0—E6、未新增业务代码。** 本次实施及验收见下一节；规划检查与实施结果分别记录。

## 16. 实施记录（2026-09-05）

正式 API 与 S3 消费示例见 [应用层说明](/Users/liuhang/Documents/project-abyssa/src/game-application/README.md)，具体缺口修复、版本取舍和验收证据见 [S2 实施验收](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-s2-implementation.md)。

| 步骤 | 实际交付 | 状态 |
| --- | --- | --- |
| E0 | 内容/状态/提交协议、字段清单、原工作树哈希、边界失败用例、旧124导出兼容探针 | 完成 |
| E1 | Catalog 全链注入，旧数据与兼容装配移出 core；冻结发行摘要；新编队/遭遇/select/restore 与旧956步轨迹 | 完成 |
| E2 | 三层唯一状态及 checkpoint 投影、深层 JSON/内容/历史引用校验、旧schema1—4与应用备份新档位导入 | 完成 |
| E3 | Application unknown入口、Memory/IndexedDB、CAS、稳定回执、读写与诊断导出、事务故障映射 | 完成 |
| E4 | 出征保管、真实规则取得正收益、持久化终局候选、一次结算及两种中断窗口 | 完成 |
| E5 | 结构化Fact、undo撤回、来源/参与者投影、可取消本地AI、deadline/预算/角色/资产/事实接受检查 | 完成 |
| E6 | 类型/单元/工程/四类构建/18入口/UI发布/辅助/Storybook与40项浏览器复测通过 | 完成 |

实际实现采用显式 route 参数、统一字符串 CharacterId、两 object store 的整份快照事务；未创建没有消费方的 Mansion 空字段。Catalog v1 暂拒绝生产 reactions；旧解析器的反应机制保留测试注入。应用备份保留连续历史并追加 import 提交，旧回执不转为新来源的可执行凭证。以上调整均未改变 legacy 玩法或给 rp-style-lab 添加依赖。

S2 提供可在无浏览器/无AI下执行的事务闭环；第14节的玩家页面接线仍完整交给S3。首版容量限制、正式方法签名、错误处理和runtime示例已写入应用层说明。


最终验收：85文件/752项单元与组件测试、55项工程测试、40项浏览器测试通过；core/application独立类型与导入、四类发行和18个兼容入口、UI发布契约、辅助产物与Storybook通过。最后的源代码补强又完成相关类型与37项application定向复测。首次浏览器运行受并行重建产物干扰出现一次404，固定产物后40/40完整复测通过，保留失败与成功证据。远端CI未运行。

保护检查确认661个指定路径及S1冻结fixture原字节不变；未修改玩法定稿、标题/地图/美术或依赖锁文件。实际API与取舍见本节链接的实施审计。S2完成后下一阶段是S3页面接线，本轮不提前宣称玩家流程已接通。

后续状态（2026-09-05）：[S3 实施与验收](../audits/2026-09-05-s3-implementation.md)已完成，六个正式页面经 game-client 接入应用事务，实际玩家循环及刷新/冲突验收通过。S2 的历史验收范围仍以本节为准；模型服务与复杂上下文接入继续归 S4。
