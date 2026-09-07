> 历史档案：2026-09-07文档整理时归档。原路径：`docs/plans/S1_CORE_EXTRACTION_PLAN.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# S1 纯规则内核抽取计划

日期：2026-09-05。状态：**已完成，全部本地门禁通过**。本文件保留 S1 的执行范围、兼容策略、步骤和验收门槛；实际结果见第 12 节。

工作目录：`/Users/liuhang/Documents/project-abyssa`。

依据：[S1 勘探审计](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-s1-core-extraction.md)、[生产化阶段划分](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-production-readiness.md)、[S0 工程基线](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S0_ENGINEERING_BASELINE_PLAN.md)。玩法内容以[当前定稿整理](/Users/liuhang/Documents/project-abyssa/docs/archive/snapshots/DESIGN_DECISIONS_AND_CURRENT_STATUS_BEFORE_CONSOLIDATION.md)为依据；工程迁移不新增玩法定稿。

## 1. 本阶段交付目标

**把已有 Battle 规则从页面目录抽出，形成 Abyssa 自己拥有、可在 Node 独立执行的内部模块，并保持旧玩法和页面表现不变。**

S1 的交付物：

1. `src/game-core/battle`：状态/命令/事件、规则、纯 selectors、RNG、Battle 存档格式与迁移。
2. 明确标记的 `legacy-v1` 内容夹具：保存当前五人、旧骰面、敌群生成、数值与默认效果行为。
3. 一个受限的新内部入口和一个完整旧兼容入口；旧页面继续运行，旧路径不留第二套实现。
4. 真正的 Node 测试、无 DOM/框架类型检查、依赖边界检查与固定行为基线。
5. 迁移后验证记录及交给 S2/S3 的明确缺口清单。

本阶段结束时，**旧战斗循环应能在无 React、无浏览器、无 AI 服务的进程中运行到终局**。地图编队→战斗→Campaign 入账→洋馆恢复仍由 S2/S3 完成，不能用页面跳转成功替代该验收。

## 2. 已核实的起点

| 项目 | 当前事实 | 对规划的影响 |
| --- | --- | --- |
| S0 | 构建/入口/输出/CI 配置已完成本地验收；远端 CI 尚未运行 | 复用配置体系，保持 UI 包名和导出键 |
| Battle | 50 个生产文件、7,751 行；49 个实现文件 + 1 个 facade | 可整体迁移闭包，无需再做单文件拆分重构 |
| 依赖 | 含类型闭包 50 文件、运行时 45 文件；0 外部依赖、0 循环 | 不需要先建设 workspace 或安装规则框架 |
| 内容耦合 | 17 个生产文件直接导入旧 content | S1 冻结内容依赖，S2 才参数化 |
| 旧调用面 | 124 个运行时导出；10 个生产消费者，其中 2 个深层导入 | 保留完整 facade，并定点修正深层消费者 |
| 既有 Node 验证 | Battle 13 文件/148 项；加 Dice/Mansion/Sortie 共 16 文件/192 项通过 | 当前测试可迁移；其他场景通过测试不等于纯净 |
| 存档 | schema 4 / rules 1 / content 1；已有迁移、RNG、撤回测试 | 本轮不升级版本，不改序列化形状 |
| 已知入口差异 | 旧 wrapper 恢复 eventSequence；FromInput 未写回 RNG 元数据 | 避免“顺手统一”造成兼容破坏 |
| 页面状态 | React controller 持有权威状态，部分命令在 impact 提交 | 页面提交机制留到应用层阶段处理 |

本计划针对当前工作树。HEAD 为 `969ae5ade3c7be1439638e6d4f1f44ecd102a62b`，不能只与 HEAD 比较并据此覆盖 S0 或用户既有修改。

## 3. 范围与阶段边界

### 3.1 S1 必须完成

- 抽取 Battle 已有纯闭包，保留命令、效果解析、目标选择规则、局部结算、RNG 和 Battle DTO。
- 把固定内容归到显式的旧版内容目录，声明其仍参与当前运行。
- 保留完整兼容行为，区分新内部入口与 legacy 导出面。
- 将纯测试/测试工具移到内核所有权下，保留旧路径兼容测试与 UI 回归。
- 用工程门禁保证 core 不依赖 app、UI、素材、浏览器、网络或宿主。
- 更新主动维护文档、依赖规则和 CI；记录迁移结果及未解决项。

### 3.2 S1 不实施的事项

| 事项 | 后续归属 | S1 留下的接缝 |
| --- | --- | --- |
| 任意角色、六名候选/最多五人、内容 Catalog、遭遇注入 | S2 | 冻结的内容目录和集中入口；不改变 CharacterId |
| 新骰装 art/花色/沉眠语义、正式技能与装备数值 | 内容定稿 + S2 | 保留旧 FaceDef；不做静默映射 |
| Campaign / Expedition / Battle 三层状态、统一存储 Port | S2 | Battle JSON 状态与现有版本迁移 |
| 外部命令校验、revision、幂等、Commit/Fact、最小 AI Port | S2 | typed command/transition、局部事件，明确它们不是远程协议 |
| 规则先提交后呈现、动画中刷新恢复 | S2 设计，S3 验收 | UI controller/presentation 继续消费纯规则 |
| 出击令消费、带入/带出、终局唯一入账、回洋馆 | S3，依赖 S2 | 现有 BattleStartInput/CompletionOutput 只作为待演进契约 |
| Dice 全回合引擎、Mansion 存档模型、Shop 经济系统 | S2/S3 按闭环需要抽取 | 本轮审计清单；不为目录对称建空模块 |
| rp-style-lab HTTP 适配、上下文、模型、复杂管线 | S4 | 不导入宿主类型，AI 默认关闭 |
| npm 多包发布、通用 ECS/DSL/总线 | 本轮无需求 | 保持内部模块，不预建基础设施 |

S1 对已知问题的原则：迁移导致的回归必须修复；原有语义问题先固定证据、限制新入口的使用方式并交给对应阶段，不能借搬目录悄悄改变现有行为。

## 4. 源码所有权与目标结构

### 4.1 保持单包，新增内部模块

继续使用 npm、当前 `package-lock.json`、Node 22.23.2 / npm 10.9.8，根包 `@abyssa/ui` 和五个已有公开导出键不变。S1 不把内核塞进 `src/shared`，也不从 `src/index.ts` 或 UI 包导出游戏运行时。

以下结构已经建立，路径相对于仓库根目录：

```text
src/
  game-core/
    README.md
    platform/
      structured-clone.d.ts   # 唯一需要补充的现有跨平台 API 声明
    battle/
      index.ts               # 新内部入口：已验证的初始化与命令路径
      legacy.ts              # 原 engine 的完整兼容导出面
      domain/                # 现有 7 个生产模块
      content/legacy-v1/     # 原 4 个内容模块；当前运行也使用
      rules/                 # 原 29 个生产模块，含 resolver 子目录
      selectors/             # 原 4 个模块，保持纯计算
      persistence/           # 原 5 个模块；没有存储 I/O
      testing/               # scenario、effect fixtures、golden 辅助工具
      ...tests               # 迁移后的纯规则测试，按模块就近放置
  apps/battle/
    engine.ts                # 只转发到 game-core/battle/legacy
    module-boundaries.test.ts
    controller/              # React 状态、选择模式与队列仍在这里
    presentation/            # 动画、计时器、React 组件、视图模型
    ...页面/样式/维护文档
```

`content/legacy-v1` 是**版本冻结的运行时内容夹具**，不是只在测试中使用的假数据，也不是新定稿内容。它不位于可导入素材的根 `src/content`，从结构上避免旧内核吸入角色档案、图片和 UI 数据。

本轮保留 domain/invariants → legacy content、rules → legacy content、selectors → rules 等现有无环依赖。这里的“纯”是无环境副作用且行为可复现，不表示本轮已经把所有规则做成内容无关的泛型。

### 4.2 依赖方向

```text
既有 Battle 页面/controller/presentation
  → apps/battle/engine.ts（薄转发）
  → game-core/battle/legacy.ts
  → 现有纯实现 + legacy-v1 内容

未来 Abyssa 应用层 / 当前 Node runner
  → game-core/battle/index.ts
  → 同一套纯实现 + legacy-v1 内容

规则内核 → 不得反向依赖应用、UI、存储或 AI 服务
```

S1 初始 core 生产依赖全部在 `src/game-core` 内；不设宽泛的 shared 白名单。现有 apps/tools/content/shared 规则继续保留，shared UI 与根 UI 导出不得反向依赖 core。以后确有共享的领域契约需求，再在 S2 选择唯一所有者，不先复制类型。

### 4.3 迁移表

| 当前位置 | 目标/处理 | 必须保留 |
| --- | --- | --- |
| `src/apps/battle/domain/*` | `src/game-core/battle/domain/*` | 状态形状、union、版本、检查顺序 |
| `src/apps/battle/content/{balance,characters,enemies,effect-definitions}.ts` | `src/game-core/battle/content/legacy-v1/*` | 内容 ID、顺序、敌人生成算法、文本、默认注册表 |
| `src/apps/battle/rules/**` | `src/game-core/battle/rules/**` | dispatch 和底层 transition 的差别、效果顺序、预算、兼容 wrapper |
| `src/apps/battle/selectors/*` | `src/game-core/battle/selectors/*` | 数值与目标合法性；presentation-selectors 仍为纯计算，可随迁移 |
| `src/apps/battle/persistence/*` | `src/game-core/battle/persistence/*` | JSON 格式、版本拒绝/迁移、复制与 RNG 元数据行为 |
| 原 `engine.ts` 导出实现 | `src/game-core/battle/legacy.ts` | 124 个运行时导出、类型面、同一实现引用 |
| 原 `engine.ts` 路径 | 留下单向转发 | 原 8 个 facade 生产消费者无需改行为 |
| controller 的 2 个深层消费者 | 改从旧 `engine.ts` 取原有符号 | 不保留重复 domain/rules/persistence 实现；不引入循环 |
| 纯规则测试与 `testing/*`、`engine.bench.ts` | 随内核迁移；测试使用内部路径或 legacy 入口 | 不把测试夹具导出到运行时入口；不复制两份 golden |
| `module-boundaries.test.ts` | 留旧 app 路径，对照新实现 | 旧 facade 的引用/类型兼容及导出面 |
| UI 测试及 controller/presentation 代码 | 留 app；修正测试辅助工具路径 | 演出时机、取消、重启、清层流程 |

移动后删除被替代的旧生产实现目录；若其中还有维护文档，应迁移文档或修正链接。只允许已列出的薄 facade 保留旧源码入口。发现新的真实旧路径消费者时，优先更新其导入，不创建无人使用的兼容树。

## 5. API 与行为兼容策略

### 5.1 两个入口共用一套实现

`battle/legacy.ts` 按原 facade 导出，仍提供低层 helpers、旧外部 RNG 函数与全部历史符号。旧 engine 转发到它；不得把旧方法批量替换成 dispatcher 别名。

`battle/index.ts` 是**仓库内部 typed API**，使用显式导出清单。首批仅提供：

- BattleState、BattleCommand、BattleTransition、事件/错误/版本类型。
- 已验证的 `createExpeditionFromSeed(seed, location?)`，直接复用原实现。
- 两参数 `dispatchBattleCommand(state, command)` 薄包装，委托原 dispatcher，不暴露兼容用 external RNG 参数。
- 当前 Battle 的 serialize/deserialize、版本常量、完成结果投影，以及确有使用者的纯 selectors。

新入口不导出 raw FromInput 构造、任意低层状态修改或效果注册能力；这些旧符号仍存在于 legacy 面和内部测试。新入口不承诺接受未验证 JSON，不在 S1 建立 HTTP 或 LLM 协议。

初始化函数目前位于 `rules/compatibility.ts`，可以按符号复用；无需为了文件名另造一套初始化算法。新命令包装仅收窄参数，不改状态、事件或错误。

### 5.2 必须冻结的契约

| 契约 | 要求 |
| --- | --- |
| 旧公开导出 | 运行时键集合与类型可用性保留；新入口额外符号不泄漏进旧 facade |
| 状态不可变性 | 原有命令不修改输入；失败时引用/事件/错误行为与旧实现一致 |
| RNG | mulberry32 算法、seed 归一化、draw 次数、三流隔离、检查点恢复不变 |
| 兼容 RNG | WeakMap 追踪、外部 closure、旧 restart 使用方式不变；不将它称为独立可恢复存档 |
| 事件 | 类型、payload、顺序、cause/batch、sequence 与 eventSequence 均对照原路径 |
| 撤回 | 快照、资源、随机位置、撤回事件行为均保留；不要求撤回前后 eventSequence 简单相等 |
| 存档 | schema 4 / rules 1 / content 1 不变；目录搬迁不升版本 |
| 迁移 | v1 丢弃不安全旧撤回、v2 loadout、v3 去镜像字段等既有处理保持 |
| 内容 | 五人顺序、HP/层数/倍率、旧骰面、文本与敌人随机分支不变 |
| UI | 命令仍按既有 impact/清层时机提交；不调整动画和导航 |

### 5.3 对已知缺口的明确处置

- **FromInput RNG 差异（审计 A04）：**保留旧实现，补特征测试和注释；新入口不导出。S2 的 seed+start input 构造器才承担正式带入/恢复。
- **未知命令（A05）：**typed API 只供受控内部调用。S2 新增外部输入解析，不在纯迁移里改旧错误协议。
- **底层 resolver：**可返回带诊断的失败解析结果；新应用不能绕过 dispatcher 把任意低层结果当已提交状态。
- **局部事件/文本 facts（A03/A08）：**不充当全局日志、LLM 上下文或经济入账凭证。S2 定义应用事实与提交身份。
- **固定内容（A02/A09）：**现阶段内核明确只服务旧玩法；不通过扩大 ID 类型或自动转换展示骰面声称支持新队伍。

## 6. 工程门禁

### 6.1 无框架的类型检查

新增 `tsconfig.game-core.json`，只纳入 core 生产 TS 与必要声明：

- `lib: ["ES2022"]`、`types: []`，保留 strict 检查；不继承应用的 DOM、Vite、Vitest、React、Node ambient types。
- 不纳入测试、benchmark、测试辅助工具与 UI 文件；它们由对应测试/应用检查覆盖。
- 仅补最小 `structuredClone<T>(value: T): T` 声明，保留当前原生复制行为；不做 polyfill，不重写成 JSON clone。
- 加入 `typecheck:core`，并纳入现有 `typecheck` 与 CI。

审计已在 50 文件闭包上验证上述类型策略可行。即使未来类型检查通过，Node I/O 和依赖方向仍需 AST 门禁补充。

### 6.2 可失败的边界检查

扩展现有 `scripts/check-module-boundaries.mjs`，复用 S0 的 [source-ast.mjs](/Users/liuhang/Documents/project-abyssa/scripts/lib/source-ast.mjs:1)。不得再次依赖 TypeScript 7 已移除的旧 JS compiler API。

core 生产代码的初始规则：

1. 静态导入、再导出、`import type`、`import()` 与 `require` 都检查；相对路径解析到实际文件，越过 core 边界即拒绝。
2. bare imports、宿主路径、未解析别名和非字面量动态装载默认拒绝；禁止 Node builtin、React/DOM、HTTP 客户端、素材和 CSS。
3. 禁止环境状态/副作用：DOM 全局、Storage、fetch、WebSocket、计时器、process/import.meta.env、Math.random、Date.now 与无参 new Date 等；兼容 RNG 只能显式传入或读取状态游标。
4. 检查标识符引用及成员访问，避免把 effect 的 `window` 字段/局部参数、注释文本当成浏览器全局。对可疑动态环境访问采取拒绝策略。
5. core 生产闭包不得触及 testing、`.test`、benchmark；测试允许 Node/Vitest，但不得被生产入口反向引入。
6. 新增 game-core 所有权分类；保留原 apps/tools/content/shared 限制。UI 包入口、shared UI 不得反向导入游戏实现。
7. 生产图有新增循环必须失败；不以忽略整个目录解决违规。

以临时 fixture 工程测试验证边界规则。应覆盖合法纯函数与 structuredClone，以及 React、DOM 类型、类型导入 UI、再导出污染、别名逃逸、Node I/O、动态导入、环境 RNG、循环依赖等拒绝场景。负例应因对应违规失败，不能只断言“任意非零退出码”。

### 6.3 Node 测试与独立导入

通过 Vitest 的项目配置区分 core 的 Node 环境与 app 的 jsdom 环境；细配置置于 `config/vitest/`，根 `vitest.config.ts` 负责统一运行。`npm test` 覆盖两类，`test:core` 可单独运行 Node 项目；纯内核项目不加载 jest-dom setup，不 mock React/DOM 以获得通过。维持 S0 的有限并发。

将旧 facade 兼容测试归入 Node 验证范围，避免移完测试后只证明新路径存在。既有 UI 测试继续归 app 项目；不得因目录变化遗漏测试。

增加 `check:core` 聚合入口：依赖边界、生产类型检查、Node 测试、独立 Node ESM 导入。独立导入使用已有 esbuild，分别检查新入口和 legacy 入口的完整依赖元数据；审计时关闭 tree shaking，不能依靠摇树删除掩盖违规。

临时 bundle、报告写到 `dist/reports/s1`，不新增面向用户的场景入口或正式 core npm 发行目标。内核进入游戏包由现有 Vite 构建完成。

## 7. 顺序实施与每步退出条件

### E0 · 固定迁移前证据

- [x] 记录当前 HEAD、完整工作树状态与受保护文件哈希；保留 S0、标题/CG/设定等已有工作。
- [x] 保存 50 文件依赖清单、10 个生产消费者和所有旧路径消费者。
- [x] 冻结 124 个运行时导出键与实际使用的类型导出；现有引用相等测试继续保留。
- [x] 跑当前 Battle Node 回归，并在修改前捕获完整状态/事件/RNG/存档的预期样本。
- [x] 对 A03/A04 的入口差异补特征测试；将样本移入受版本管理的测试夹具，不能长期依赖 dist 报告。

退出条件：后续等价性比较有旧实现产生的预期，且未修改 golden。不能在迁移后才用新实现生成全部预期。

### E1 · 建立独立验收基础

- [x] 增加独立 core 类型配置、最小 clone 声明和 Node 测试项目配置。
- [x] 实现 AST 边界及其正/负例；新目录不存在或测试集合为空时不能误报完成。
- [x] 准备新/旧入口 Node import 验证与报告路径。
- [x] 明确 package.json、Vitest、工程测试与 CI 的接入位置。

退出条件：门禁的拒绝能力通过 fixture 验证；与 E2 合并形成可运行的变更单元后，正式 core 门禁必须非空通过。不提交只靠跳过检查通过的中间状态。

### E2 · 原子迁移 Battle 闭包

- [x] 移动 domain/rules/selectors/persistence 与四份旧内容；更新相对路径。
- [x] 新建 legacy.ts，原 engine.ts 改为薄转发；建立受限 index.ts。
- [x] 修正两个深层 controller 消费者，处理全部测试/benchmark/辅助工具引用。
- [x] 移除旧生产实现；保留的兼容入口只转发。
- [x] 比较新旧导出、完整行为样本、旧 golden、存档与 RNG。

退出条件：新闭包不导入 app；旧 facade/UI import 可解析；Node 核心门禁通过。目录迁移不能以修改算法或快照来消除差异。

### E3 · 验证页面与工程集成

- [x] 运行原 controller、presentation 与 Battle Screen 回归，检查 impact、取消、重启、清层和敌方分步时序。
- [x] 运行完整 typecheck、边界、单元/组件测试与工程测试，核对测试发现数。
- [x] 构建 UI/game/lab/tools，执行既有产物检查；确认游戏依赖没有进入 @abyssa/ui 公开包。
- [x] 运行 S0 既有 browser smoke；检查单页入口构建和辅助构建，确保未发生路径回归。
- [x] CI 现有工作流接入 core 门禁；本地与远端结果分别记录。

退出条件：S0 基线能力保留、Battle 表现与旧状态行为相同，且 core 独立检查未依赖应用环境。

### E4 · 文档和 S2 交接

- [x] 更新 README 源码树、game-core README、Battle 活跃维护文档及当前模块边界说明。
- [x] 将旧重构文档的历史基线与本次迁移记录区分；修正失效链接，不重写历史结果。
- [x] 填写本文实施记录：命令、版本、测试发现数、结果、真实差异、报告位置。
- [x] 记录 S2 的构造器/Catalog、应用状态/提交、存储、AI Port 接缝。
- [x] 对受保护文件再次校验哈希；仅在全部 DoD 达成时标记 S1 完成。

E0 → E1/E2 → E3 → E4 顺序执行。代码迁移可作为一个原子变更单元，避免留下 core → app 的中间依赖。用户未要求时不自动提交或推送现有未提交工作。

## 8. 验证矩阵与命令契约

### 8.1 需要保住的行为

| 场景 | 断言范围 | 验证来源 |
| --- | --- | --- |
| 5 个完整固定种子远征 | seed 11/29/47/83/131 全轨迹及 terminal；旧指纹逐步一致 | 原 golden + 迁移前完整样本 |
| 创建→投骰→装载→行动→结束回合 | 完整 state、events、error 与 RNG；输入不变 | dispatcher/engine/新入口对照 |
| begin/resolve-next/finish 分步敌回合 | 顺序、游标、中途保存恢复与最终结果 | 原 persistence/turns 测试 |
| 随机偷取与撤回再做 | 资源、骰子、RNG 恢复；区分 undo 事件游标 | 原 persistence + 完整检查点样本 |
| 当前/旧存档 | schema4 往返、v1/v2/v3 迁移、拒绝行为不变 | 原迁移测试 + 冻结 JSON 样本 |
| 失败命令 | 状态引用、资源、默认 RNG 和 events 不变 | 既有合法性失败用例；仅针对已支持命令 |
| 旧 API | 导出键、类型、函数引用、兼容 eventSequence | 旧 facade 测试 + A03 特征测试 |
| FromInput 限制 | seed19 原样差异被记录；不进入新入口 | A04 特征测试 |
| 新两参命令入口 | 与原 dispatcher 默认 context 输出逐字段一致 | 入口契约测试 |
| 页面演出 | impact 提交、清层确认、取消/重启/敌回合 | 既有 controller/presentation/UI 测试 |
| 环境隔离 | 无 DOM/React/宿主/网络依赖，反例确实失败 | AST + 无 DOM 类型 + Node import |

迁移前完整样本至少覆盖一个生还/一个团灭终局、一个敌回合中断点、一个随机行动撤回点，以及三代旧存档。大体积轨迹可保存稳定摘要和必要检查点，但不得继续省略 RNG、eventSequence 与撤回状态；样本预期必须来自迁移前实现。

固定种子测试验收时 `UPDATE_BATTLE_BASELINE` 必须未设置为 `1`。发生不一致时定位差异；原样迁移不接受重生成期望作为修复。

### 8.2 计划新增命令

以下命令已在 S1 实施中接入：

| 命令 | 责任 |
| --- | --- |
| `npm run typecheck:core` | core 生产代码无 DOM/框架环境类型检查 |
| `npm run test:core` | Node 项目的规则与旧 facade 测试 |
| `npm run check:core` | 聚合 core 类型、依赖、测试与独立导入验证 |

保留现有 `npm run typecheck`、`npm test`、`npm run boundaries:check` 和 `npm run check:baseline` 的整体语义；通过组合配置使它们覆盖新增模块，不把旧测试留在无人调用的脚本里。

最终至少执行以下已有门禁及新增 core 门禁；聚合脚本中已执行的检查不必机械重复：

```bash
npm run check:core
npm run check:baseline
npm run build:all
node scripts/check-package-release.mjs
npm run check:output -- game
npm run check:output -- lab
npm run check:output -- tools
npm run test:smoke
npm run build:entries
npm run check:auxiliary
npm run build-storybook
git diff --check
```

基线参考是 S0 的 695 项应用测试、9 项工程测试、35 项浏览器检查、18 个独立入口。S1 新增检查后总数可能增加；移动测试不能降低原有场景覆盖。记录实际文件发现列表，避免单纯比较总数掩盖遗漏。

## 9. 变更风险与回退

| 风险 | 处置 |
| --- | --- |
| 搬迁时更换 RNG 构造或少消耗一次随机数 | 完整 RNG/轨迹对照；恢复原调用顺序 |
| 合并 legacy 与 dispatcher 导致事件差异 | 两入口分别验收；保持 wrapper，不统一游标 |
| 为了类型通过导入整个 DOM/Node 类型包 | 最小 clone 声明 + AST 拒绝环境依赖 |
| 将 geometry/共享 barrel 误当纯工具引入 | 对完整导入/再导出闭包检查，关闭 tree shaking 做独立导入审计 |
| 新内容覆盖旧内容造成存档漂移 | 冻结 legacy-v1，不升级/替换内容，S2 明确迁移策略 |
| 移动后丢失测试或测试仍绕回旧实现 | 核对消费者、测试发现列表、facade 引用与 source graph |
| 核心成功但 UI 动画契约改变 | 保留 controller/presentation，运行既有时序测试 |
| 工作树包含多轮未提交工作 | 迁移前清单/哈希；只撤回本轮已确认改动，不执行全树 reset/clean |

回退单位是本轮闭包迁移与其路径/配置调整。行为对照失败时先停在当前步骤修复；若需回退，根据 E0 清单恢复本轮文件，不动 S0、用户代码、素材和设定文档。单纯路径迁移不生成新存档版本，也不需要回写存档数据。

## 10. S1 完成定义

- [x] 50 文件旧闭包的实现有唯一所有者；旧页面目录只保留约定 facade，不留双份规则。
- [x] 新内部入口与完整 legacy 面都能在 Node 独立导入，生产闭包无 React/DOM/宿主/素材/I/O 依赖。
- [x] 内容明确归入 legacy-v1；旧五人、数值、敌人分支、文本与存档版本保持一致。
- [x] 原 golden、完整状态/事件/RNG 样本、存档迁移与撤回回归通过。
- [x] 两个深层生产消费者、测试和 benchmark 已处理，全部旧 facade 导出兼容。
- [x] 无 DOM 类型门禁、AST 边界负例与 Node 测试接入正式命令/CI，不是一次性探针。
- [x] S0 构建、包、入口、浏览器及原应用测试基线保留，UI 时序无行为改动。
- [x] README/维护指南/计划有最新状态；S2/S3 缺口明确，未声称跨场景闭环或真实 LLM 接入完成。
- [x] 原有未提交代码与素材没有被覆盖；本地和远端验证状态分别说明。

## 11. 给 S2 的交接清单

S1 完成后按下列顺序继续设计。S2 已完成独立勘探，具体实施入口见 [S2 应用底座计划](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S2_APPLICATION_FOUNDATION_PLAN.md)，事实与探针见 [S2 审计](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-s2-application-foundation.md)；S2 已实施，实际边界和验收见 [S2 实施记录](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-s2-implementation.md)。下列清单保留为 S1 交接范围：

1. 定义 Battle 的正式 `seed + start input + content` 创建/恢复路径，修正 FromInput 接缝；角色/遭遇来自 Catalog，验证未知 ID 与内容版本。
2. 在 Abyssa 应用层建立 Campaign/Expedition/Battle 的唯一状态归属、存储 Port 与加载失败策略；Mansion Set、UI 稀有度、Sortie Storage/肖像类型不能直接进入存档。
3. 定义 Command/Commit/Fact：输入解析、revision、失败无副作用、幂等、终局结算身份；保留日志文案与事实的区别。
4. 用本地实现驱动出征带入、战斗、结算和回洋馆，为 S3 的刷新/重复提交/恢复验证准备完整链条。
5. 定义最小 AI Port：输入来自已提交、经过可见性筛选的状态/事实，输出为候选行动或叙事；候选行动再次由 Abyssa 验证，迟到/失败响应可丢弃。

LLM 调用、上下文组织与复杂管线可以交给 rp-style-lab，但 core 永远不认识其 Provider、Model Slot、Pipeline、Conversation 或 Release 类型。AI 的可选性由应用边界与本地回退保证，不依赖在 S1 预建空接口。

## 12. 规划交付与实施记录

### 12.1 迁移结果

前轮完成源码勘探和 192 项定向 Node 验证。本轮在迁移前重新运行原 Battle 13 文件/148 项测试，随后冻结完整状态样本并实施 E0–E4。没有调用 rp-style-lab、执行 setup 或配置 Provider，没有改动玩法定稿。

- 49 个原实现模块迁入 game-core，原 facade 的导出体成为 legacy.ts；增加受限 index.ts 和最小 structuredClone 声明。最终 core 生产集合为 **52 个 TS 文件（含声明）**，Node bundle 的运行时输入为 **46 个模块**。
- 原 app engine.ts 只转发；8 个既有 facade 生产消费者继续使用原路径，2 个 controller 深层消费者改走 facade。原生产目录没有留下另一套规则。
- 原五人、骰面、数值、敌群算法、文本、效果、RNG、撤回及 schema4/rules1/content1 保持不变。50 个原生产模块逐个比对 AST，忽略导入路径与注释后 **0 项语义差异**。
- 新入口使用已验证的 seed 构造器和两参数 dispatcher。旧 124 个运行时导出及其实现引用通过兼容测试；raw FromInput 和 legacy 事件计数限制保持，并有特征测试。
- 5 条完整旧远征的 **956 步全状态指纹**已在迁移前冻结。历史存档输入、中断存档、随机偷取与撤回样本在受版本管理的 testing/fixtures 中，测试没有自动更新预期的开关。
- Node 与 jsdom 测试分项目运行；check:baseline 包含 core 类型、AST 边界、所有测试及独立 Node 导入。根 UI 包导出、锁文件、默认 AI 开关保持原样。

### 12.2 验证结果

执行环境：macOS arm64，Node **22.23.2**，npm **10.9.8**，TypeScript **7.0.2**，Vitest **3.2.7**，Playwright **1.63.0**。Git HEAD 仍为本文件第 2 节所列版本，验证针对含 S0/S1 的当前工作树。

| 检查 | 本轮结果 | 证据 |
| --- | --- | --- |
| 核心/应用/工具类型，入口登记，AST 模块边界 | 通过 | [完整基线日志](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/final-baseline.log) |
| 全量单元/组件测试 | **82 文件 / 703 项通过**；core 15 文件/156 项，app 67 文件/547 项 | [分组统计](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/test-totals.json) |
| 工程测试 | **45 项通过**，含原 9 项与新增 36 项边界正/负例 | [最终工程日志](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/final-engineering.log) |
| 两个核心入口的独立 Node ESM 导入 | 46 个生产输入、**0 外部导入**、124 个旧导出；5 次无浏览器终局运行通过 | [Node 报告](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/core-import.json) |
| 基线跳过开关 | UPDATE_BATTLE_BASELINE=1 明确被拒绝，尚未执行测试即失败 | [拒绝证据](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/baseline-update-rejection.log) |
| UI / game / lab / tools 聚合构建 | 全部通过 | [构建日志](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/build-all.log) |
| UI 包检查与 game/lab/tools 产物检查 | 全部通过；UI 包 184 文件，打包 6.32 MiB，公开导出保持 | [包检查](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/package-check.log) |
| 浏览器 smoke | **35 项全部通过**，含根路径、/abyssa/ 子路径与本地骰局推进 | [浏览器日志](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/smoke.log) |
| 18 个独立入口构建 | 全部通过 | [入口日志](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/entry-builds.log) |
| 辅助脚本/静态预览、Storybook | 全部通过；未重写 static-preview | [辅助验证](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/auxiliary.log)、[Storybook](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/storybook.log) |
| 源码/素材保护与迁移文档链接 | 核心 AST 等价；597 个标题/素材/静态预览保护文件未变；两个设定文档仅更新链接目标 | [变更核对](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/change-verification.json)、[文档核对](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/document-check.json) |

703 项包含全部原有 695 项，加 3 项迁移样本、4 项新入口与 1 项完整 facade 兼容测试。Node 子集不与全量数量累加；迁移前 148 项、规划期 192 项也不计入本轮新增数量。

### 12.3 工程处理与验证限制

Vitest 3 的文件路径项目会把工作目录设为配置文件目录，单独在子配置写 Vite root 不能覆盖该行为。根配置改用带显式 root 的 extends 项目，恢复完整测试发现，并在全量结果中核对 82 个文件。核心 setup 为 0，不加载 jest-dom。生产类型只补原生 structuredClone 声明，没有放宽到 DOM 或 Node 环境类型。

全量 check:baseline 完成后，边界复核增加了“仓库外同名 game-core 目录”的拒绝用例，并重新通过工具类型、边界检查与全部 45 项工程测试；应用代码没有再改变，未重复运行 703 项测试。

边界检查识别类型导入、再导出、动态装载、symlink/父目录逃逸、环境全局和 UI 包间接引用；对局部 window 参数及业务字段保留正常行为。检查器属于工程门禁，未宣称可以执行不可信脚本。

浏览器使用已有 **Chromium 151.0.7922.34**，通过 ABYSSA_BROWSER_EXECUTABLE 显式指定；与 S0 相同。CI 将安装 Playwright 对应浏览器。本轮仅验证本地命令，**没有远端 CI 运行结果**，也没有真实 Provider 调用。

仍保留原始 FromInput RNG、旧 API 游标、typed command 缺少外部 JSON 解析、UI impact 提交与固定内容等限制。它们的分期和处置见第 3/5/11 节；S1 完成不表示地图编队已进入战斗，或奖励已能跨场景唯一入账。

### 12.4 保护与回退记录

迁移前保存了 1,248 个现有文件的哈希，以及代码/配置/文档备份：

`/var/folders/2t/qp430h4s28lfj8fwhfj3trdc0000gn/T/abyssa-s1-Y4h9Bg`

[迁移映射](/Users/liuhang/Documents/project-abyssa/dist/reports/s1/migration-map.json)记录 71 个移动文件（包括测试、辅助工具和文档）；新接口、声明、配置、脚本与测试另行新增。回退必须基于该工作树备份，不得用 HEAD 覆盖原有 S0 和用户工作。git diff --check 与更新后的本地文档链接核对通过。临时备份/报告可被系统清理；永久回归证据已进入 testing/fixtures。本轮没有自动提交或推送。

| 实施项 | 状态 | 结果 |
| --- | --- | --- |
| E0 迁移前冻结 | 完成 | 原测试、导出、完整状态/事件/RNG 与存档样本 |
| E1 验收基础 | 完成 | 无 DOM 类型、AST 边界、Node 项目、独立导入与 CI 命令 |
| E2 闭包迁移 | 完成 | 单一内核、legacy-v1、两个入口与原页面兼容 |
| E3 集成回归 | 完成 | 类型/703 项测试/45 项工程检查/35 项浏览器/所有构建通过 |
| E4 文档与交接 | 完成 | 目录/维护指南/入口已更新，保护文件核对完成，S2 接缝已列明 |
