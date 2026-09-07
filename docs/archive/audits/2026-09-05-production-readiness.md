> 历史档案：2026-09-07文档整理时归档。原路径：`docs/audits/2026-09-05-production-readiness.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# Abyssa 底座引擎、生产化与 LLM 接入审计

审计日期：2026-09-05。首轮审计已完成；架构方向为 Abyssa 独立闭环，rp-style-lab 负责 AI 能力。本文第 1—9 节保留实施前的审计快照，S0 后续进展见第 10 节及 [S0 实施记录](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S0_ENGINEERING_BASELINE_PLAN.md#11-实施记录)。

审计对象：`project-abyssa` 与 `rp-style-lab` 的当前工作树。默认按本机运行、单人游戏的产品化目标评估；公网服务、多租户与账号系统不在本次认证范围内。

## 1. 结论与阶段判断

**现在适合从垂直切片转入底座建设。Abyssa 独立拥有游戏规则、流程、存档与结算；先完成不依赖 LLM 的游戏闭环，同时预留版本化 AI 接口。**

| 层面 | 当前状态 | 生产化缺口 |
| --- | --- | --- |
| 战斗规则 | 命令、原子效果、事件、确定性 RNG、状态不变量和存档版本已经存在 | 固定角色与遭遇仍内嵌；战斗、远征和演出提交边界需要调整 |
| UI 与原型 | 组件库、12 个场景原型、5 个制作工具及组件目录可独立运行 | 尚无统一的游戏发行入口与跨场景状态契约 |
| 持久化 | 战斗有 DTO、迁移与完整撤回检查点 | 尚无贯穿洋馆、出征、战斗、商店的权威存档与结算事务 |
| LLM 接入 | Abyssa 有骰局适配器；宿主有较完整的执行与证据机制 | 适配器使用已淘汰接口，现有模拟测试没有覆盖真实版本兼容性 |
| 发布门禁 | Abyssa 类型检查、测试、模块边界和 UI 包发布检查通过 | 游戏发行物、跨仓库兼容性、恢复与升级尚未成为门禁 |

确定分工为 **Abyssa 拥有完整游戏运行时；rp-style-lab 负责上下文组织、模型调用与复杂 AI 管线**。游戏的权威状态、RNG、存档、撤回和奖励事务均在 Abyssa；AI 服务可以保存对话与执行记录，但不持有另一份可独立结算的游戏状态。

修订说明：上一版将“宿主承载游戏执行”列为优先验证项，与用户明确的独立游戏边界不符，已撤回该推荐。现有代码的规则归属接近这一方向，但跨场景闭环和 AI 适配隔离尚未完成；本节是目标边界，不代表已经实现。

[原型期结构规划](/Users/liuhang/Documents/project-abyssa/docs/archive/architecture/CONCEPT_PROTOTYPE_STRUCTURE_AND_SHARED_PLAN.md)中的“独立状态、不引入完整游戏流程、不做 workspace”有明确的阶段前提。用户已提出进入底座建设，可以更新工程阶段；此前建立的单向依赖和原型隔离仍应保留。

## 2. 已验证的问题

优先级含义：P1 为对应能力正式启用前需要解决的问题；P2 为维护与发布能力。A01、A06、A08 中的 AI 接入问题只约束 AI 集成，不阻塞 Abyssa 独立闭环。本次没有发现需要以 P0 紧急处置的问题。

### A01 · P1：现有骰局适配器与当前宿主协议不兼容

- Abyssa 的 [dice-runtime.ts](/Users/liuhang/Documents/project-abyssa/src/apps/dice/runtime/dice-runtime.ts:340)仍读取 `GET /applications/:id/model-bindings`，本地类型仍按 Pipeline／Role Binding 组织。
- [setup 脚本](/Users/liuhang/Documents/project-abyssa/scripts/setup-dice-runtime-application.mjs:154)生成 Role V1、Pipeline V4，并调用旧 Binding 写入地址。
- 宿主当前公开的是 [Model Slot 路由](/Users/liuhang/Documents/rp-style-lab/server/src/routes/applications.ts:307)，模型格式为 Role V2、Pipeline V5。

**实测结果：**离线读取 setup 的纯文档工厂，用当前宿主 Schema 校验，Role V1 和 Pipeline V4 均被拒绝；用实际 Fastify 路由加桩服务执行 `inject`，旧 `model-bindings` 返回 404，新 `model-slots` 返回 200。新路由的 200 只证明路由存在，不代表真实 Application 已配置成功。

影响：当前脚本不能作为正式初始化入口；即使骰局的本地模拟测试通过，也不能证明两仓库可互通。`/runtime/invocations/stream` 仍是现行路由，不能把问题笼统归为“所有执行 API 都失效”。

处理建议：在 AI 接入阶段建立新的版本化适配层；旧 setup 退役或在执行写入前明确阻止不兼容版本。用现行 Schema 与真实路由构建契约测试，不能仅更新客户端类型断言。Abyssa 的启动、存档和游戏命令不依赖该服务预检。

### A02 · P1：构建通过不等于产出可连续游玩的游戏

实施前的 `vite.title.config.ts` 只构建 `title.html` 和 `menu.html`；[菜单](/Users/liuhang/Documents/project-abyssa/src/apps/menu/MenuPage.tsx:75)还链接洋馆、商店、战斗和角色状态。该配置现已由 [入口登记](/Users/liuhang/Documents/project-abyssa/config/entries.mjs)及公共工厂接管，以下实测结果属于迁移前证据。

本次在临时目录进行全新标题构建，构建成功，但 `mansion.html`、`shop.html`、`battle.html`、`character-status.html` 均不存在。按该产物直接静态部署，标题进入菜单后的四个目的页无法访问。开发服务器能从源码提供其他 HTML，掩盖了发行物缺口。

根 [package.json](/Users/liuhang/Documents/project-abyssa/package.json:70)的默认 `build` 和 `release:check` 服务于 `@abyssa/ui`，并非完整游戏发布。

处理建议：单列游戏发行目标与入口注册表，检查产物内导航闭包、资源路径及刷新访问。独立原型继续有自己的预览构建。不要简单拼接各个 `*-dist`：各配置的入口、静态资源复制和资产命名策略不同，存在覆盖风险。

### A03 · P1：跨场景没有共同的权威状态与结算

| 证据 | 当前行为 |
| --- | --- |
| [战斗 controller](/Users/liuhang/Documents/project-abyssa/src/apps/battle/controller/useExpeditionBattleController.ts:37) | React `useState` 初始化远征，状态由本页面持有 |
| [洋馆 hook](/Users/liuhang/Documents/project-abyssa/src/apps/mansion/useMansionEstate.ts:36) | 独立初始化洋馆状态；推进时段时直接抽取三次 `Math.random()` |
| [商店页面](/Users/liuhang/Documents/project-abyssa/src/apps/shop/ShopPage.tsx:165) | 本地库存、1247 里拉和 8 水晶独立初始化 |
| [地图出发](/Users/liuhang/Documents/project-abyssa/src/apps/map/MapPage.tsx:34) | 出击令写入 `sessionStorage`；源码明确注明战斗尚无读取逻辑 |
| [菜单资源](/Users/liuhang/Documents/project-abyssa/src/apps/menu/MenuPage.tsx:120) | 时间、公共资金与队伍资金是静态样本 |

影响：页面跳转尚不构成“领补给→出征→消耗→结算→回到洋馆”的可信闭环。现有转场 `sessionStorage` 是短期演出交接，不应升级为正式存档。

处理建议：在 Abyssa 内定义 Campaign、Expedition、Encounter 的状态范围；每条命令带请求身份和预期版本，成功后形成持久提交与回执。Abyssa 的应用层与存档仓库共同处理重复请求、跨场景结算和冲突恢复。引入全局 React Store 只能解决显示同步，不能替代这些能力。

### A04 · P1：权威状态提交受演出时序控制

[战斗 presentation](/Users/liuhang/Documents/project-abyssa/src/apps/battle/presentation/useExpeditionBattlePresentation.ts:239)在前摇／停顿后调用 `commitTransition`；[清层流程](/Users/liuhang/Documents/project-abyssa/src/apps/battle/presentation/useExpeditionBattlePresentation.ts:169)由 UI 定时器继续确认并推进结算。

这是现有原型为命中帧同步做出的设计，相关测试也约束了视觉时点。进入正式持久化后，组件卸载、刷新、跳过动画不能决定规则是否提交；这项要求与是否接入 rp-style-lab 无关。

处理建议：规则先接受命令并持久提交，UI 持有可延迟播放的显示投影。命中帧仍可更新画面中的 HP；已提交的真实状态不等待动画。恢复时按提交与事件游标继续或跳过演出，不能重新执行伤害、掉落与奖励。

### A05 · P1：规则内核仍以固定垂直切片内容作为输入前提

- 审计时 [CharacterId](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/domain/state.ts)固定为五名角色，角色定义与 `PARTY_ORDER` 固定旧版阵容。角色定义现已迁入 [legacy-v1 Catalog](/Users/liuhang/Documents/project-abyssa/src/content/gameplay/legacy-v1/catalog.ts)，此处保留原审计结论。
- [远征初始化](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/expedition.ts:1)直接依赖角色、平衡数据与固定层数敌人生成器；`createExpeditionStateFromInput` 尚不能注入完整队伍与遭遇定义。
- [状态结构](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/domain/state.ts:249)混合回合、楼层、队伍、战利品和撤回；尚未形成 Campaign／Expedition／Encounter 的清晰组合关系。
- 战斗 `FaceDef` 与 [展示骰面契约](/Users/liuhang/Documents/project-abyssa/src/shared/domain/dice/face.ts)分属不同语义；后者的 Fate／Suit 不能直接视为已进入战斗机制。

影响：继续沿固定内容扩写会使第六个候选角色、可选编队、新遭遇与内容版本迁移同时触及内核和 UI。

处理建议：先把旧阵容和旧遭遇变成版本化测试内容包，保留所有既有行为；由装配层注入经过校验的 Content Catalog、Roster、Encounter。内核保留有限、明确的规则处理器，无需先造通用 ECS、脚本虚拟机或任意规则 DSL。

### A06 · P1：尚无可供 LLM 消费的持久事实契约

[facts 字段](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/domain/state.ts:277)仍是 `string[]`。已有[结构化 BattleEvent](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/domain/events.ts:12)，但[事件 ID](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/rules/dispatcher.ts:77)仅使用局部事件计数；重新开局或撤回后不能单独作为跨会话的全局身份。

影响：如果直接把战报文字当记忆，难以判断事实来自哪场远征、哪个分支、是否已经结算，迟到响应也难以正确作废。

处理建议：在规则事件之外加持久提交信封，绑定游戏、远征、分支、命令、版本和来源事件。模型只接收经过授权的事实投影，叙事输出反向引用来源提交；当前冒险、既定角色往事、已完成章节和模型解释必须分别标识。

### A07 · P2：根目录缺乏发布与所有权分区，现有门禁覆盖不足

本次清点：根目录有 **71 个非隐藏条目、18 个 HTML、18 个 Vite 配置、1 个 Vitest 配置、20 个构建／预览产物目录**。其中 `static-preview` 被明确设计为提交后直接分享的产物，不能当作误提交垃圾清理。

真正的问题是组件库、游戏入口、实验原型、制作工具与构建产物在同一级承担不同生命周期，却没有统一入口清单和发行责任。

- [tsconfig.json](/Users/liuhang/Documents/project-abyssa/tsconfig.json:22)仅将默认 Vite 与 Vitest 配置纳入检查，其他场景 Vite 配置不在该覆盖面内。
- [边界检查](/Users/liuhang/Documents/project-abyssa/scripts/check-module-boundaries.mjs)主要检查 `src` 下可识别的相对导入；尚不覆盖新内核分层、包 exports、别名、构建脚本与配置。
- 当前没有仓库内 `.github` CI 工作流；现有本地门禁仍有价值，但缺少统一、可复现的游戏发布检查。

处理建议：先建立逻辑所有权、入口注册和输出规范，再搬目录。保留 `references`、旧 `preview`、`st/setting` 等资料的明确用途；素材和创作源文件不能混同于可删除构建缓存。

### A08 · P1：宿主工作树与跨仓库依赖尚未构成可冻结基线

`rp-style-lab` 类型检查及本次选定的执行测试通过，但 **`pnpm architecture:check` 未通过**：当前工作树中七个 logo 相关生产文件不可达，架构报告也已过期。这属于现有未提交工作，不宜通过自动重生成报告来掩盖或顺手修改。

[Server SDK 包](/Users/liuhang/Documents/rp-style-lab/packages/application-server-sdk/package.json)仍是 `private: true`、导出源码并使用 `workspace:*` 的仓库内部形态。包版本 `0.1.0` 不等于模型协议或 Package 协议版本，也尚未证明两仓库可独立、可复现地消费同一 SDK 产物。

处理建议：AI 集成前选定通过门禁的服务版本，固定实际使用的公开协议与适配器兼容测试。独立 HTTP 接入不强制使用 Package SDK；仅在确实使用 SDK 时固定其产物与哈希。不要深层导入相邻仓库 `server/src`，也不要依赖开发机器上的可变相对路径。宿主发布状态不阻塞基础游戏开发与发行。

## 3. 可以保留和复用的能力

### Abyssa

保留 `domain → rules → transition/events` 体系、原子效果解析、状态／反应机制、三条确定性 RNG 流、不变量、固定种子回归和已有 UI 演出资产。

[持久化模块](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/persistence/README.md)已经区分 `schemaVersion`、`rulesVersion`、`contentVersion`，支持顺序迁移与完整撤回检查点。这里是正式存档契约的起点，但目前尚不是跨场景存档服务。

本次另用 Node 环境运行引擎相关测试：**12 个测试文件、145 项通过**。这证明已有核心能够脱离浏览器执行，抽取应以保持行为为第一目标。

### rp-style-lab

| 已有能力 | 对 Abyssa 的价值 | 接入限制 |
| --- | --- | --- |
| Release／Session 冻结、Package Lock | 固定 AI 应用资源、上下文与模型配置身份 | 不用于锁定 Abyssa 的整个游戏存档 |
| Program、Validator、State View、Ledger／Checkpoint | 管理 AI 应用自身的工作状态、校验与执行证据 | 不接管游戏命令、库存和战斗状态 |
| CAS、`clientRequestId` 与提交回执 | 管理 AI 会话并发及服务请求重试 | Abyssa 的游戏提交身份仍由自身维护 |
| V9 post-commit Presentation | 可作为 AI 应用内部的可选生成机制参考 | 独立游戏不需要为每条命令创建宿主 Floor |
| Child Thread 与 Terminal Materializer | 可供 AI 应用隔离子任务、整理结果 | 不将游戏远征与奖励结算强行映射为子线程 |
| Model Slot、Task Contract、Evidence | 隔离模型选择、输出约束与调用证据 | Target 和密钥留在 AI 服务侧 |
| Workflow、受限 Narrative Updater | 编排多次生成并维护 AI 上下文中的受限状态 | 对游戏持久状态的修改仍须返回 Abyssa 校验 |

这些机制按 AI 应用需要选用，不是 Abyssa 必须接受的整套运行架构。[Lumen Dice](/Users/liuhang/Documents/rp-style-lab/applications/lumen-dice/README.md)和 [Warden Shop](/Users/liuhang/Documents/rp-style-lab/applications/warden-shop/server/src/program.ts)提供参考应用，不能把它们托管玩法的方式直接作为 Abyssa 的集成前提。

必须保留的现实限制：

- [Package 边界](/Users/liuhang/Documents/rp-style-lab/packages/application-package-contracts/README.md)不允许扩展自建 HTTP 路由、直接访问数据库、启动后台任务或直连 Provider。
- Client SDK 面向宿主挂载的 Shadow Root。独立游戏页面需要公开 HTTP 协议适配器，不能直接把它当通用浏览器请求 SDK。
- 当前没有公共 Memory／Narrative Database、通用工具执行或重启后自动续跑 Provider。重启将执行收口为 interrupted，不能把它当持久任务队列。
- 现有 Lumen 创建时要求若干必选 Model Slot；只有部分 Presentation 是可选。Abyssa 基础游戏无需创建这类 Application／Session；启用 AI 功能时再执行服务就绪检查。
- 宿主按本机服务设计；[CORS 白名单](/Users/liuhang/Documents/rp-style-lab/server/src/config/cors.ts)不含标题页 5182 等入口。正式同源代理或明确来源配置需要单列，Vite 开发代理不能承担发布配置。
- 旧数据库 epoch 不由当前二进制自动迁移。AI 集成需明确会话与执行记录的升级、导出和恢复策略；Abyssa 游戏存档独立演进，不能因 AI 服务数据库不兼容而打不开。

## 4. 推荐的底座边界

### 4.1 两边的明确职责

| 能力 | Abyssa | rp-style-lab |
| --- | --- | --- |
| 游戏循环与规则 | 场景流程、战斗、RNG、库存、时间、成长、奖励 | 不执行或重复实现这些规则 |
| 持久化 | 正式存档、迁移、命令回执、撤回与结算去重 | AI 对话、上下文摘要、管线执行记录与证据 |
| 世界事实与内容 | 角色／物品／遭遇定义、手工章节、已发生事件、可见性规则 | 根据任务检索、裁剪和组织获准使用的材料 |
| AI 执行 | 提交有明确用途的任务，处理取消和结果接受 | Prompt、模型选择、上下文窗口、多阶段管线、生成与内部校验 |
| 结果生效 | 再校验来源版本与领域约束，显示或通过游戏命令接受结果 | 返回结构化结果或候选建议，不直接改游戏存档 |

这是当前采用的目标方向。断开 rp-style-lab 后，Abyssa 应仍能启动、读档、出征、战斗、结算和返回洋馆；AI 功能按场景采用本地文案、跳过或明确不可用。

Abyssa 需要补齐自身存档与事务，但无需因此先建设复杂后端。首版可在存储 Port 后使用适合部署方式的实现，例如浏览器的 IndexedDB。用状态快照、revision、命令回执和结算去重记录建立最小可靠性；结构化事件并不要求全量事件溯源或通用消息总线。

建议状态分层：

| 层 | 所有内容 | 不应混入 |
| --- | --- | --- |
| Campaign | 世界时间、资金与物品实例、角色成长、解锁、当前远征引用、已应用结算记录 | 动画进度与模型调用临时状态 |
| Expedition | 本次编队、带入物品、路线进度、累计收获、撤离／失败结果 | 整个洋馆 UI 状态 |
| Encounter | 战斗队伍快照、敌人、骰子、回合、效果队列、规则 RNG | 长期关系、角色传记 |
| Narrative | Abyssa 已接受的对话／叙事结果及需要随存档保留的关系事实 | 模型执行临时状态；模型对机械字段的直接写入权限 |
| Presentation | 摄像机、转场、动画队列、未播放事件游标 | 权威结算 |

首版可限制一个 Campaign 同时只有一场活动远征。出征时如何扣除／预留补给、远征期间 Campaign 是否允许变更、回归时如何合并，都在 Abyssa 内由显式命令与事务表达；无需创建宿主子线程。

### 4.2 调用关系

```text
游戏 UI
  → Abyssa 应用层（流程、命令处理、事务）
    → game-core（纯规则 + 注入的内容 + 机制 RNG）
    → Abyssa 存档仓库（状态、回执、事件、结算记录）
    → UI 播放已提交事件

Abyssa 应用层在需要 AI 时
  → 构造获准公开的游戏快照 / 事件 / 内容引用
  → AiApplicationPort
    → rp-style-lab 适配器
      → 上下文组织 / 模型调用 / Workflow
    ← 带来源身份的结构化结果或候选建议
  → Abyssa 校验 → 显示，或经合法游戏命令接受
```

图中的 `AiApplicationPort` 是建议新增的应用层接口，不是现有宿主 API。纯内核不依赖此 Port，也不依赖 React、DOM、网络、SQLite、Provider 或宿主内部类型。应用层调用接口，集成层实现接口；模型调用不得进入规则解析器。

Port 表达对白续接、事件反应、战报等任务语义，不暴露 Pipeline DAG、模型角色或 Floor。首版只实现实际需要的任务与可替换的本地实现。rp-style-lab 内部可以使用其 Session／Interaction／Workflow，但这些身份和协议只由适配层持有，不进入游戏存档的必需字段。

### 4.3 三处应先验证的技术边界

1. **RNG 单一归属。**现有三条可回放流由 Abyssa 管理并存档，先保持旧种子轨迹；动画和 LLM 不消耗机制随机流，模型生成的随机性不替代规则骰点。
2. **撤回与读档。**由 Abyssa 定义可撤回范围、存档分支和恢复语义。恢复旧进度时更新来源身份，旧 AI 响应不得写入新进度；原 AI 对话可保留为历史，但继续调用必须明确选择恢复后的上下文。终局奖励通过游戏结算记录防止重复领取。
3. **提交粒度。**以有游戏意义的命令或规则批次在 Abyssa 内提交，不以动画帧或模型响应作为持久化时点。规则接受后先安装新提交身份，画面按事件时序更新；AI 任务有自己的执行生命周期。

### 4.4 上下文不耦合的关键

Abyssa 负责回答“发生了什么、当前角色能知道什么、哪些创作内容属于此版本”；rp-style-lab 负责回答“这次任务该选哪些材料、如何放进上下文窗口、如何摘要和组织多步生成”。游戏侧输出稳定的领域数据，不拼接完整 Prompt，也不把全部私有状态交给 AI 服务再自行判断权限。

每次 AI 请求锚定 `saveId`、分支／恢复代次、游戏 revision 和相关事件，另带对话或任务引用。AI 服务自己的上下文 revision 与游戏 revision 分开管理。长对话、摘要和检索材料可以留在服务侧；游戏已接受、且影响未来玩法或必须离线显示的结果由 Abyssa 保存。

断开服务时，核心游戏存档仍可恢复；AI 对话历史能否完整续接取决于服务数据的保留／导出策略，不能声称只靠游戏快照就能重建所有长对话。这里需要显式会话绑定与重建策略，而非两份游戏状态双向同步。

## 5. 为 LLM 预留的最小契约

### 5.1 首先固定版本，不沿用旧 Binding

当前宿主的[协议矩阵](/Users/liuhang/Documents/rp-style-lab/docs/architecture/model-execution-boundary.md:5)：

| 边界 | 当前版本 |
| --- | --- |
| Application Draft／AI Role | V2／V2 |
| Pipeline／Release | V5／V4 |
| Runtime Context | V6 |
| Invocation Evidence／Run Envelope | V7／V12 |
| Package Manifest／Resource Bundle | V2／V2 |
| Server Extension／Client Extension | V1／V1 |

这些版本各自演进，不应统一改成同一个数字。具体 Provider、Target、密钥和本机路径由 AI 服务配置。AI 应用可以用 Package 管理资源与任务版本，但游戏引擎不需要打包成宿主 Program；独立 HTTP 接入也不强制导入 Package SDK。

### 5.2 游戏边界的建议数据形状

下表是待实现的游戏与 AI 边界契约，不是对现有宿主字段的逐字描述。Command／Commit 由 Abyssa 自身处理；只有获准的事实投影、AI 请求与结果跨越服务边界。

| 契约 | 至少包含 | 必须保证 |
| --- | --- | --- |
| Command | 协议版本、Campaign／Expedition 身份、`clientRequestId`、预期提交引用、命令类型与参数 | 同请求重试返回原结果；相同请求 ID 携带不同参数不能作为新命令接受 |
| Commit／Receipt | 新旧提交引用、规则与内容版本、命令身份、事件列表、可见状态投影 | 状态、事件、消费记录和回执一起提交；失败不消耗机制 RNG |
| FactBatch | 来源提交、分支与远征、事件序号、世界时间、事实类型、结构化载荷、可见范围 | 区分实际冒险、已定历史和模拟；全局身份不依赖局部 `event:0` |
| NarrativeRequest | `cueId`、来源提交、已授权事实投影、参与者稳定 ID、任务类型、语言与输出预算 | 不传完整未过滤状态；不用文字战报反推机制事实 |
| NarrativeResult | 相同 `cueId` 与来源提交、合法说话者、对白、有限表情／动作 ID、引用事实 | Schema 与内容引用有效；过期结果不得覆盖新场景或再次推进游戏 |
| NarrativePatch | 允许的叙事命名空间、字段路径、预期版本与候选值 | 由 Abyssa 再校验并提交；模型不能直接写入游戏状态 |

游戏命令比较 Abyssa 自己持久化的 revision／提交引用，不映射为宿主 `expectedBranchHead`。若 AI 适配器使用需要分支并发控制的会话路由，由适配器独立管理服务要求的 Floor／Checkpoint／hash。AI SSE 断流只表示生成任务状态需要核对，不改变已经提交的游戏命令。

### 5.3 输出权限与失败处理

- **首个接入任务：战斗提交后的短对白／表情。**输入少量已提交事件和人物资料，输出限制为已注册角色与演出资产。先证明端到端边界，不立即搬入完整多阶段战报编排。
- 战报可以引用事实并润色表达；奖励、死亡、成长与解锁由游戏规则给出。角色往事章节继续使用手工定稿内容，不能由模型把新生成内容提升为既定历史。
- 需要多次生成时在 rp-style-lab 内使用 Workflow；现行 Pipeline V5 的单条 Pipeline 对应一次模型调用。Abyssa 只提交任务并观察阶段状态，不负责调度各条 Pipeline。当前旧骰局适配器仍在客户端组织多阶段战报，属于待迁移逻辑，不能视为已符合目标边界。
- 生成任务失败、超时、取消、响应乱序或 AI 服务重启时，采用本地文案或跳过；保留已提交机械结果。叙事重试不能重发原机械命令。
- 若后续让模型提出 NPC 行动、协商结果或事件方案，返回的是受约束的候选；由 Abyssa 根据当前版本与允许的命令验证并执行。可以参与玩法决策，但不能绕过规则直接修改数值。
- 接口应支持调用预算、取消、状态可见和失败诊断；日志使用请求／提交／宿主执行身份关联。原始 Prompt 与敏感世界信息不进入普通玩家日志。
- “关闭 LLM 仍可完成游戏循环”是 Abyssa 的验收要求；只在用户启用 AI 功能时创建／校验外部 AI 应用，基础游戏不依赖 Model Slot 配置。

## 6. 根目录与工程组织建议

### 6.1 目标布局

```text
project-abyssa/
  apps/
    game/                   # 玩家入口、游戏应用层、流程与存储适配
    lab/                    # 原型、组件目录、演出与视觉验证入口
  packages/
    game-core/              # 纯规则、领域契约、序列化与不变量
    ui/                     # 保留 @abyssa/ui 名称及公开组件契约
  content/                  # 版本化角色、骰面、物品、遭遇、章节与资产清单
  integrations/
    rp-style-lab/           # AI Port 实现、协议映射与会话绑定；不含游戏规则
  tools/                    # 内容制作与参数校准；不要求每个工具独立成包
  config/                   # 入口注册、Vite 工厂、TypeScript 配置
  scripts/                  # 校验、构建、打包与发行检查
  docs/                     # 产品定稿、架构、参考、审计
  references/               # 创作／视觉参考，排除于玩家发行物
  dist/                     # 根级应用产物统一进入此处
  package.json
  package-lock.json
  README.md
```

这是归属目标，不要求一次性搬迁。只在有实际代码迁入时建立对应目录。`packages/*/dist` 可以保留标准包内构建方式；根目录不再增加新的 `<scene>-dist`。`st/setting` 等创作源文件先登记，再选择归入 `content` 或资料区。

依赖规则：

- `game-core` 只依赖自身契约与明确允许的纯运行库；不得导入 UI、具体内容、浏览器或宿主内部实现。
- `content` 依赖内核公开的内容类型；装配层加载、校验后将内容注入内核。
- `apps/game` 的应用层组合纯内核与存档仓库，并定义 AI Port。`integrations` 实现该接口，只依赖公开的数据契约；在启动装配处注入。旧原型可以通过兼容 facade 使用新内核。
- `packages/ui` 不持有资金、战斗结算等游戏规则；领域专属演出控制留在游戏应用。
- 制作工具消费内容 Schema，导出受校验的数据；游戏不能依赖工具的组件或运行时代码。

Abyssa 可沿用 npm workspaces，`rp-style-lab` 保持自己的 pnpm 工作区。跨仓库通过固定产物与契约交付，不需要为目录整理先合并仓库或统一包管理器。

### 6.2 先做构建与入口收敛

入口注册表至少记录：入口 ID、用途（game／lab／tool）、源 HTML、开发端口、目标输出、资源复制策略、可跳转目的地。由同一个 Vite 工厂生成配置，保留必要的薄入口配置。

建议明确以下命令类别；名称为建议新增，当前并未实现：

| 命令类别 | 产物或作用 |
| --- | --- |
| `dev:game` / `build:game` | 统一玩家入口与完整导航链，输出 `dist/game` |
| `dev:lab` / `build:lab` | 原型与展示入口，输出 `dist/lab` |
| `build:tools` | 制作工具，输出 `dist/tools` |
| `build:ui` / `release:check:ui` | 独立 UI 包构建与 exports 校验 |
| `check:core` | 无 DOM 编译、规则不变量、确定性与版本迁移 |
| `check:integration` | AI 服务 Schema／路由兼容与生成任务失败恢复；独立于基础游戏门禁 |
| `release:check:game` | 从空输出目录构建并检查导航、资源、运行配置及升级信息 |

旧 HTML URL 与 `dev:*` 脚本先作为兼容入口保留。`static-preview` 的分享用途若保留，应由独立发布任务生成并标注来源版本；调整分享方式后再删除历史产物。根目录清理不应破坏已有使用方式。

### 6.3 内容和版本也要进入生产流程

游戏发行清单记录规则版本、状态 Schema、内容包版本和发行版本；AI 适配器另记录服务协议、任务与可选 Package 的兼容信息。游戏存档打开不依赖外部服务在线或处于某个版本。内容校验至少检查角色／物品／遭遇引用、骰面结构、素材 ID 与资源是否存在；游戏存档记录其使用的内容身份。

素材通过清单引用，明确源文件、运行时导出与工具产物。先掌握实际游戏发行物大小和重复资产，再决定压缩、分包与缓存；本次 UI 包大小不能代表整个游戏的资源预算。

## 7. 实施顺序与完成标准

| 阶段 | 交付范围 | 完成标准 |
| --- | --- | --- |
| [S0：工程基线详细计划](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S0_ENGINEERING_BASELINE_PLAN.md) | 入口注册、构建工厂、输出分类、依赖与 Node 版本、CI 检查 | 旧入口可运行；全部构建配置参与类型检查；全新游戏产物的导航与资源可达；组件库仍独立发布 |
| S1：纯内核抽取 | `game-core`、旧 facade、旧版内容夹具、边界规则 | Node 环境可执行；既有固定种子轨迹、存档与撤回行为不变；禁止内核导入 DOM／React／宿主 |
| S2：内容、存档与应用层 | Catalog、可注入编队／遭遇、三层状态、存储 Port、Command／Commit／Fact 与最小 AI Port | 不启动 rp-style-lab 也能保存、恢复和执行命令；未知 ID、错误版本被拒绝；RNG、迁移、幂等与冲突可验证 |
| S3：Abyssa 独立游戏闭环 | 出征带入、战斗、终局、Campaign 结算、回到洋馆；AI 使用本地实现 | 相同终局只能入账一次；跨页和中途刷新可恢复；不配置模型也能完成整条循环 |
| S4：按需接入 AI | 固定公开协议、HTTP 适配、上下文绑定、第一条可选叙事；复杂任务在服务侧编排 | AI 故障不破坏闭环；请求锚定游戏版本；迟到响应不污染新场景；移除适配器不改变内核 |

**实施优先级是 S0—S3：先让 Abyssa 干净并独立闭环。**第一批变更从 S0 + S1 开始，随后以最小既有玩法补齐存档与结算，不扩充内容量。S2 同时保留稳定事实数据与最小 AI Port，避免事后侵入内核；S4 不作为前面阶段的启动或验收条件。

关键验收场景应作为后续集成测试，而不是只验证界面按钮是否出现：

1. 同状态、同命令、同种子产生一致状态、事件和 RNG 游标；失败命令不消耗资源与随机数。
2. 同一命令重复提交只形成一次机械效果；旧版本请求得到冲突并能重新读取。
3. 规则提交后，在动画中途刷新，恢复后的状态与结算不变。
4. 远征终局后，在 Campaign 结算前或结算响应丢失时重启；奖励仍只入账一次，全程不依赖 AI 服务。
5. 叙事超时、非法角色／素材 ID、过期 cue、乱序输出均不能修改机械状态。
6. 发布内容发生变化时，旧存档明确选择旧版本、迁移或拒绝；不能静默套用新规则。
7. 从空输出目录及声明的发布路径访问标题、菜单和各玩家目的页，刷新与资源加载正常。

暂不写死的内容边界：以[当前定稿整理](/Users/liuhang/Documents/project-abyssa/docs/archive/snapshots/DESIGN_DECISIONS_AND_CURRENT_STATUS_BEFORE_CONSOLIDATION.md)为依据，六名候选／最多五人上阵应由编队数据表达；Marietta 未完成的契约与装备、地下城提案及洋馆完整 v0.1 数值仍不能当作已批准规则写入内核。

## 8. 本次验证记录

### 8.1 基线

| 仓库 | 检查时 HEAD | 工作树情况 |
| --- | --- | --- |
| Abyssa | `969ae5ade3c7be1439638e6d4f1f44ecd102a62b` | 含标题 CG 修改、未提交素材和设计文档；检查针对当前工作树 |
| rp-style-lab | `795ae91e8d0ac6cefb3ffb4b4aeb9431d013b96f` | 含编辑器、Prompt 与 Logo 等未提交工作；检查针对当前工作树 |

实际 shell 为 Node `23.11.0`、npm `10.9.2`。宿主文档要求 Node 22、pnpm 9.15.4；进入发行基线时，应固定兼容的 Node 22 补丁版本并在该环境重新完成门禁。以下通过结果不等同于已在目标发行环境认证。

### 8.2 已执行检查

| 检查 | 结果 | 能证明什么 |
| --- | --- | --- |
| Abyssa `npm run typecheck` | 通过 | 当前纳入配置的 TS 类型检查通过 |
| Abyssa `npm run boundaries:check` | 通过 | 当前原型模块边界满足现有检查规则 |
| Abyssa `npm test` | **80 个文件，695 项通过** | 当前单元／组件回归基线通过 |
| Abyssa 引擎相关测试，`--environment node` | **12 个文件，145 项通过** | 选定核心可无浏览器运行；这是上行测试的子集，不应累加计数 |
| Abyssa `npm run release:check` | 通过 | UI 包构建、声明和包检查通过；不是游戏发行认证 |
| 临时目录全新标题构建 | 构建通过，导航闭包检查不通过 | 仅产出标题与菜单，缺失四个菜单目的页 |
| 宿主 `pnpm typecheck` | 通过 | Contracts、SDK、UI、前后端与服务端测试类型检查通过 |
| 宿主 `pnpm architecture:check` | **失败** | 七个不可达 Logo 生产文件；架构报告过期 |
| 宿主五组定向服务端测试 | **32 项通过** | Model Slot、确定性提交、Presentation 失败／取消、恢复与终局物化等现有机制通过测试 |
| 旧适配器离线协议探针 | **不兼容被确认** | Role V1／Pipeline V4 被当前 Schema 拒绝；旧 Binding 路由 404 |

UI 包检查记录：打包约 6.32 MiB、解包约 6.86 MiB，184 个文件。该数据仅属于组件库。

宿主架构失败列出的文件位于 `src/preview/react/components/centers/logo/`：`abyssa-logo.tsx`、`artwork-content.tsx`、`artwork-definitions.tsx`、`artwork-parts.tsx`、`artwork-stamp.tsx`、`logo-studio-panel.tsx`、`model.ts`。

本次未执行宿主全量测试、浏览器端到端测试、真实 Provider 调用或真实 Package 安装；没有以这些未执行项目作为通过依据。离线路由探针使用桩服务，定向服务端测试使用测试夹具与临时数据。

### 8.3 可复现的定向检查

在 Abyssa 根目录执行无浏览器内核检查：

```bash
npm exec vitest -- run \
  src/apps/battle/engine.test.ts \
  src/apps/battle/engine.baseline.test.ts \
  src/apps/battle/persistence/persistence.test.ts \
  src/apps/battle/rules \
  src/apps/battle/testing \
  --environment node --reporter=dot
```

在 `rp-style-lab/server` 执行本次定向测试：

```bash
pnpm exec tsx --test --test-reporter=spec \
  test/applications/application-model-slot-contract.test.ts \
  test/conversation/interaction/interaction-deterministic-program.test.ts \
  test/conversation/interaction/interaction-presentation-stream.test.ts \
  test/application-packages/terminal-materializer.test.ts \
  test/execution/runtime-api.test.ts
```

标题构建和离线探针的临时证据目录为 `/tmp/abyssa-production-audit.mdvjSn`，可能被系统清理。探针只评估 setup 脚本中 `async function request` 之前的纯工厂部分，再调用当前 Schema 与 Fastify `inject`；未运行 setup 的写入流程。长期回归应在新适配层中正式实现，不能依赖该临时文件。

## 9. 本轮变更范围

本轮审计及边界修订仅更新本文；没有移动源码、修改业务行为、更新宿主架构基线或连接真实 Provider。已存在的代码、素材与设计文档改动保持原状。工程生产化建议与已有玩法定稿分开管理，后续按 S0—S4 验收推进。

## 10. S0 实施追记（2026-09-05）

S0 已建立统一入口、目标工厂、输出隔离、固定 Node／npm、静态产物检查与 CI 工作流，已完成最终本地验收：695 项应用测试、9 项工程测试、35 项浏览器检查全部通过。完整命令、结果和限制统一记录在 [S0 计划与实施记录](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S0_ENGINEERING_BASELINE_PLAN.md)。

A02 的发行缺页问题通过导航闭包与 `dist/game` 聚合目标修复；novel／rp／studio 的动态素材也随对应产物提供。17 份重复场景配置退役，源码所有权和游戏规则保持原有结构。AI 默认关闭，未修改或启动 rp-style-lab，未执行旧 setup 或真实 Provider 调用。

A03—A05 所涉及的跨页权威状态、提交时机、结算与存档，以及 A01／A06／A08 的 AI 协议问题仍按 S1—S4 推进。S0 不代表完整游戏流程已经闭环。GitHub CI 已配置，尚未在远端触发；本地检查不能写作远端 CI 通过。

## 11. S1 规划追记（2026-09-05）

S1 已完成独立勘探，尚未实施源码迁移。当前 Battle 的 50 个生产模块形成无外部依赖、无循环的闭包；定向 Node 验证共 16 文件/192 项通过，其中 Battle 13 文件/148 项。新结果是本轮选定测试的结果，不与第 8 节或 S0 测试数量累加。

详细证据见 [S1 纯内核抽取审计](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-s1-core-extraction.md)，执行入口见 [S1 计划](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S1_CORE_EXTRACTION_PLAN.md)。首批抽取 Battle、冻结旧内容、保留兼容入口并新增环境边界门禁；Catalog、应用状态/存储/提交协议及跨场景闭环继续分别归 S2/S3，AI 适配归 S4。

## 12. S1 实施追记（2026-09-05）

S1 已完成：Battle 规则迁入内部 game-core，旧版内容冻结为 legacy-v1，旧 engine 路径只转发，增加受限内部入口与独立类型/依赖/Node 门禁。50 个原生产模块的 AST 对照无语义差异，旧 124 个运行时导出保留。

最终本地结果为 82 文件/703 项单元与组件测试、45 项工程测试、35 项浏览器检查全部通过；四类聚合产物、18 个独立入口、UI 包、辅助构建和 Storybook 均通过。Node 子集为 15 文件/156 项，不与全量数量累加。完整证据见 [S1 实施记录](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S1_CORE_EXTRACTION_PLAN.md#12-规划交付与实施记录)。

没有升级 Battle 存档/规则/内容版本，没有改变 UI 提交时机或接入 AI 服务；Catalog、应用层存储/提交、跨场景闭环和宿主适配继续归 S2—S4。GitHub CI 已接入新门禁，尚未远端运行。

## 13. S2 规划追记（2026-09-05）

S2 已完成勘探与详细规划，尚未实施源码修改。执行入口为 [S2 内容、存档与应用层计划](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S2_APPLICATION_FOUNDATION_PLAN.md)，现状与证据见 [S2 审计](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-s2-application-foundation.md)。

本轮重新运行核心 15 文件/156 项全部通过，并完成 11 个定向探针：错误版本已有拒绝；未知内容定义、坏撤回快照、字段类型和终局凭证仍需 S2 完善。该结果不与 S1 全量基线累加，未重跑全部构建/浏览器或远端 CI。

S2 将独立 application、存储适配和装配层放在 src 内，保留 app 间隔离；具体内容迁出 core 并显式注入。Campaign/Expedition/Encounter 只保存一份规范状态，通过原子提交实现请求去重和终局唯一入账。本地 AI Port 只消费已提交且经过可见性过滤的事实。S2 验证底座事务，S3 接通实际玩家闭环，S4 才接入 rp-style-lab；未将拟议玩法或宿主内部协议提升为游戏前置条件。


## S2 实施完成追记（2026-09-05）

S2已按E0—E6完成源码与本地验收。Catalog已迁出纯规则并全链注入；三层快照、应用命令/CAS/幂等、Memory/IndexedDB、出征物品保管、终局一次入账和可选本地AI均已落地。旧956步状态/事件/RNG与124运行时导出保持。

本轮完整单元/组件752项、工程55项、固定产物浏览器40项通过；四类构建、18兼容入口、UI发布、辅助与Storybook通过。第一次浏览器套件因并行重建产物出现一项404，固定产物后完整复测通过，详细证据和取舍见 [S2实施验收](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-s2-implementation.md)。远端CI未执行。

S3仍负责真实页面的档案→出征→战斗→结算→洋馆接线；S4才调用rp-style-lab。本轮没有修改玩法定稿、标题美术或依赖锁文件，也没有启动外部AI服务。

## S3 规划追记（2026-09-05）

已完成 [S3 玩家闭环审计](2026-09-05-s3-playable-loop.md) 与 [E0–E6 详细计划](../plans/S3_PLAYABLE_LOOP_PLAN.md)，尚未开始接线实施。当前主要缺口是页面档案身份、地图与真实编队不一致、动画驱动规则、必要收尾恢复、终局页面未入账，以及洋馆/商店仍使用样本资产。

本轮定向回归 14 文件/178 项通过，完成 7 组临时探针，模块边界与 18 入口门禁通过。探针确认底座可以一次结算后再次出征，同时暴露取消等待未完成与坏档拖垮列表的问题。未重跑全量构建、浏览器或远端 CI；这些不与 S2 历史结果混算。

S3 保留 legacy-v1 规则，新增独立 game-client 所有权与可恢复流程，接通档案→地图→战斗→结算→洋馆→再次出征。未实现的经营不以局部钱包伪装成正式存档；rp-style-lab 与真实模型适配继续归 S4。

## S3 实施完成追记（2026-09-05）

S3 E0–E6 已完成，六个正式场景共享 IndexedDB 档案与客户端提交协议。真实编队、持久战斗、三类中断收尾、一次结算、回馆经历和第二次出征均已接通；动画只消费已提交回执。坏档隔离、导入/导出、原请求重试与跨标签 CAS 有实际验收。

90 文件/777 项单元与组件、66 项工程、36 项游戏/存储浏览器、10 项工作台浏览器通过。最终弹窗 CSS 调整后另做 1 项档案流程定向复测与视觉复核。四类构建、18 独立入口、UI 发布检查、辅助脚本与 Storybook 通过；远端 CI 未运行。实际证据和修复记录见 [S3 实施验收](2026-09-05-s3-implementation.md)，协议见 [game-client](../../../src/game-client/README.md)。

冻结规则、Catalog、玩法定稿、美术与锁文件保持，本轮保护检查 681 路径无违规。商店交易、洋馆经营、托管与新玩法仍未开放；S4 负责 rp-style-lab 模型调用与受控上下文，游戏闭环没有增加对其启动或内部协议的依赖。
