> 历史档案：2026-09-07文档整理时归档。原路径：`docs/audits/2026-09-05-s3-playable-loop.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# S3 玩家闭环审计

日期：2026-09-05。阶段：**实施前历史基线**。本文保留规划时的断点与探针结果；当前实现和验收见 [S3 实施报告](2026-09-05-s3-implementation.md)。

执行入口：[S3 详细计划](../plans/S3_PLAYABLE_LOOP_PLAN.md)。前置依据：[S2 实施验收](2026-09-05-s2-implementation.md)、[应用层接口](../../../src/game-application/README.md)。

## 1. 结论

Abyssa 已有能够独立运行的规则、内容、存档和结算底座，但玩家页面仍是旧控制器与视觉原型。当前可以逐页打开、跳转、打一局，不能据此认定“同一档案出征、刷新续战、一次入账、返回洋馆、再次出征”已经成立。

S3 应接通这一条链，并补齐页面消费协议。无需引入 rp-style-lab；LLM 调用与复杂上下文管线继续归 S4。主要难点是状态恢复、演出与持久提交分离、实际编队，以及旧样本资产退出正式账本。

本审计发现的大部分是 S2 有意保留的阶段缺口，不应描述成 S2 的回归。动画等待无法取消完成，是本轮额外确认的现有问题。

## 2. 页面与服务实况

| 位置 | 当前事实 | S3 必须改变的行为 |
| --- | --- | --- |
| Title | “继续”和“新的开始”都跳 menu；“记录”是提示 | 区分档案创建、读取、选择和错误 |
| Menu | 第 12 天、黄昏、12800/1450/8 是样本；出征直达 battle | 从 Campaign 读取；出征经过 Map |
| Map | 九名展示角色、展示骰装、三处占位委托；出击令写 sessionStorage | 用 Catalog 能力与 Campaign 可用名单编队，提交成功才跳转 |
| Battle | 挂载时创建旧远征；React/ref 保存权威状态；动画推进规则 | 加载同一活动远征；提交、恢复、演出各自有责任 |
| 终局 | 显示旧 result，按钮“再来一局”重开 | 调用应用结算，显示入账状态，回馆/重新编队 |
| Mansion | 独立 useState 钱包、库存、生产与设施；房间链接裸跳 | 读取真实资金与经历；未接入的经营不发生真实资产操作 |
| Shop | 本地 1247 里拉、8 晶石及样本货物，交易只改局部 state | 正式入口不运行样本交易；暂不实现商店经济 |
| 应用服务 | CAS、幂等回执、原子存储、终局 ledger 已有 | 复用并提供页面需要的只读投影与恢复编排 |

## 3. 发现与证据

优先级：P1 为闭环验收前必修；P2 为随对应接线修复。行号指本次审计时工作树。

### A01 · P1：档案身份尚未进入页面链路

证据：[titleCommands.ts](../../../src/apps/title/titleCommands.ts:26)、[TitlePage.tsx](../../../src/apps/title/TitlePage.tsx:68)、[MenuPage.tsx](../../../src/apps/menu/MenuPage.tsx:71)。新建与继续都导航到同一裸 URL；菜单出征跳过 Map。没有 saveId/epoch 的校验、恢复与错误入口。

还确认了档案选择的前置缺口：[IndexedDB list](../../../src/game-infrastructure/storage/indexeddb.ts:122) 和 [Memory list](../../../src/game-infrastructure/storage/memory.ts:20) 直接取每条记录的 snapshot.campaign。本轮向临时 Memory 数据库加入畸形记录后，list 整体返回 internal-error，而另一有效档仍能单独 open。E1 需按实际存储 key 枚举，逐档返回可读/不可用状态。

影响：跨页只是换画面，无法证明属于同一档案；直接打开 battle 还会新建一局，坏档可能阻断整个档案列表。对应计划 E0–E2。

### A02 · P1：地图的出征协议与可执行内容分离

证据：[MapPage.tsx](../../../src/apps/map/MapPage.tsx:34) 已明确注释 battle 不读出击令；[useSortie.ts](../../../src/apps/map/sortie/useSortie.ts:115) 写 sessionStorage 后直接回调；[sortie-roster.ts](../../../src/apps/map/sortie/sortie-roster.ts:47) 从角色展示资料和展示骰装生成名单，凯尔的展示 faces 为空；[sortie-model.ts](../../../src/apps/map/sortie/sortie-model.ts:321) 校验展示名单；[sortie-quests.ts](../../../src/apps/map/sortie/sortie-quests.ts:6) 明示委托是占位。

真实 Catalog 则只有 legacy.rift 与旧五人，[manifest](../../../src/content/gameplay/legacy-v1/manifest.ts:3) 冻结内容身份。应用层要求领队加至少一名伙伴，[service.ts](../../../src/game-application/service.ts:356)。地图的托管模式、九人档案、展示伤势不能直接变成生产出征权限。

影响：地图选谁、去哪，与 Battle 实际开局不一致。对应 E1/E3；不以补全所有角色机制解决本问题。

### A03 · P1：战斗界面还假设固定五人

证据：[ExpeditionDicePanel.tsx](../../../src/apps/battle/presentation/ExpeditionDicePanel.tsx:75)、[battle-view-model.ts](../../../src/apps/battle/presentation/battle-view-model.ts:37)、[useExpeditionBattlePresentation.ts](../../../src/apps/battle/presentation/useExpeditionBattlePresentation.ts:105) 用 PARTY_ORDER 决定骰槽、锚点和动画初始化。

本轮探针确认应用服务能合法开出 `[kael, norma]` 两人队。只把 Map 接到 start-expedition，仍不足以保证骰槽、目标连线、伤害呈现与成员顺序正确。对应 E3/E4，覆盖 2/3/5 人与非默认顺序。

### A04 · P1：权威提交仍受动画控制

证据：[useExpeditionBattleController.ts](../../../src/apps/battle/controller/useExpeditionBattleController.ts:31) 挂载 createExpedition，commit 只写 ref/state；[useExpeditionBattlePresentation.ts](../../../src/apps/battle/presentation/useExpeditionBattlePresentation.ts:120) 接管 commitTransition，并在玩家命中、敌人逐个命中时提交旧规则结果；[ExpeditionBattleScreen.tsx](../../../src/apps/battle/ExpeditionBattleScreen.tsx:129) 直接调用旧 transition。

影响：刷新会丢失当前局；简单把 commit 换成异步 IDB 写入，会继续把持久化时机绑在动画上。S3 要先完成应用提交，再播放纯视觉事件序列。对应 E4。

### A05 · P1：持久态恢复不能只处理“半个敌方回合”

证据：[service.ts](../../../src/game-application/service.ts:425) 对 outcome=null 的中断敌方批次要求 resume；[dispatcher.ts](../../../src/game-core/battle/rules/dispatcher.ts:193) 的 end-turn 完成敌方行动与结算，但下一轮仍是单独 next-round；[getRoundOutcome](../../../src/game-core/battle/selectors/battle-selectors.ts:37) 可从盘面判定敌人全灭；旧 [acknowledgeLayerClear](../../../src/apps/battle/controller/useExpeditionBattleController.ts:106) 在动画之后发 end-turn。

实测：seed=19，end-turn 产生两条 enemy-intent-resolved，持久态停在 `enemy-turn/outcome=continue`；另一路最后击杀后停在 `player-turn/in-encounter`，open 不推进，补发 end-turn 才进入 exit-choice。

结论：S3 要覆盖中断敌方批次、已完成但未 next-round、击杀完成但未清层收尾三种状态。必要的收尾命令仍然存在，由可恢复的流程协调器负责；“动画 ack 不发命令”不意味着删掉清层规则。对应 E1/E4。

### A06 · P1：回执事件与下一次读取的快照不保证同版

证据：[CommandReceipt](../../../src/game-application/contracts.ts:54) 不含中间快照；[service.ts](../../../src/game-application/service.ts:536) 的 open 返回当前记录；[getEnemyTurnCue](../../../src/apps/battle/controller/presentation-events.ts:108) 只找第一条敌方事件。

实测：end-turn 回执 after.revision=3；另一条 next-round 后 open 得到 revision=4；重放原请求仍返回 revision=3 的原回执。这是正确的幂等行为。页面若把 rev3 的事件配 rev4 的状态播放，会错位；把整批传给旧 cue helper 则只播放第一只敌人。

对应 E1/E4：校验 before/after 与当前 head；无准确前后视图时刷新到最新状态并跳过旧演出；保留收据数组顺序，按敌方行动/效果批次切分，不用单个 cue 代表整批。

### A07 · P2：取消动画会留下未完成的等待 Promise

证据：[usePresentationQueue.ts](../../../src/apps/battle/controller/usePresentationQueue.ts:22) 只在 timer 回调 resolve；cancel 与卸载清 timer，却不 resolve 等待者。

本轮使用真实 React renderHook：wait(20ms) 后 cancel，80ms 后 Promise 仍未完成，busy 已为 false。不能由此断言当前一定发生内存泄漏，但旧 async continuation 确实无法正常收尾。对应 E4：取消/卸载统一使等待完成为 false，配合 generation 阻止旧任务发布。

### A08 · P1：终局页面尚未消费一次入账协议

证据：[ExpeditionBattleOverlays.tsx](../../../src/apps/battle/presentation/ExpeditionBattleOverlays.tsx:77) 的结果页只有“再来一局”；[ExpeditionBattleScreen.tsx](../../../src/apps/battle/ExpeditionBattleScreen.tsx:273) 重置本地远征；[service.ts](../../../src/game-application/service.ts:372) 才是终局事务入口。

实测：同一结算请求重试返回 replayed；换 requestId 再结算返回 already-settled，并非第二份成功回执。ledger 始终一条，本次样本 party=135，结算后 expedition=null，能再次出征。

对应 E5：页面重试复用原 envelope；遇到 already-settled/conflict 重新读取并按 expeditionId 找 ledger。不能把所有重复情形统一显示为失败，更不能因换页重复加钱。

### A09 · P1：三个场景的样本经济不能直接成为 Campaign

证据：[MenuPage.tsx](../../../src/apps/menu/MenuPage.tsx:120)、[useMansionEstate.ts](../../../src/apps/mansion/useMansionEstate.ts:35)、[mansion-state.ts](../../../src/apps/mansion/mansion-state.ts:67)、[ShopPage.tsx](../../../src/apps/shop/ShopPage.tsx:166)。洋馆推进相位调用 Math.random，本地设施/库存/钱包可变；商店买卖没有进入 Campaign 物品实例保管。

真实 [Campaign](../../../src/game-core/session/state.ts:79) 有资金、时钟、库存与结算账本，没有设施经营字段；默认资金为零。最新设计中的金币损失范围与庄园成本仍有提案部分，见[设定状态](../snapshots/DESIGN_DECISIONS_AND_CURRENT_STATUS_BEFORE_CONSOLIDATION.md:194)。

对应 E2/E5：正式页面只读 Campaign；设施修复、生产、买卖与鉴定在本阶段禁用并说明尚未开放，预览保留在明确的演示入口。不能把旧 G 直接兑换成商店里拉，也不能虚构初始经营资产。

### A10 · P1：跨页公共客户端需要新的所有权边界

证据：[module-boundaries.mjs](../../../scripts/lib/module-boundaries.mjs:17) 限制 shared 依赖游戏服务、app 互引与 app 直连 adapter；[browser.ts](../../../src/game-runtime/browser.ts:14) 目前提供服务装配，没有 React 会话、导航定位与只读 Battle 视图。

[TransitionProvider.tsx](../../../src/shared/transition/TransitionProvider.tsx:212) 能处理带 query 的相对 URL，但不会替业务补档案参数；[MansionPage.tsx](../../../src/apps/mansion/MansionPage.tsx:370) 还直接 location.assign；[entries.mjs](../../../config/entries.mjs:2) 的导航依赖记录旧去向。

对应 E0/E1：新增 game-client owner；共享转场继续只接 URL/文案。同步登记 menu/mansion→map、battle→mansion/map/title 等依赖与循环闭包，避免独立入口产物缺页。

### A11 · P2：已有事实投影是当次反应，不是完整回馆经历列表

证据：[projectFacts](../../../src/game-application/facts.ts:214) 严格筛选同 source revision、可见且未撤回事实。它适合一次已提交动作的反应；直接用于洋馆历史会漏掉此前回合。

对应 E5：增加独立、只读、按 expeditionId 查询的玩家经历投影，保留来源及撤回过滤。LLM 仍经既有 AI Port 的受限投影，不把整份存档、日志或历史列表直接传出。

### A12 · P1：现有浏览器通过标准尚未证明玩家闭环

证据：[game.spec.ts](../../../tests/smoke/game.spec.ts:7) 测挂载、刷新和导航，地图出发只断言进入 battle 与挂载，没有断言成员、同档身份、RNG 续接或入账。[storage.spec.ts](../../../tests/smoke/storage.spec.ts:25) 单独测试 IndexedDB，不是玩家页面接线测试。

对应 E6：真实浏览器从 Title 操作至回馆/第二次出征；验证同档余额、实例、事实及中断窗口。原覆盖需保留，但不能把总测试数等同于完成度。

## 4. 本轮验证与限制

| 检查 | 本轮结果 | 说明 |
| --- | --- | --- |
| 相关组件与应用回归 | 14 文件、178 项通过 | Title/Menu/Map/Battle/Mansion/Shop 及应用事务/AI/库存；不是全量 752 项复跑 |
| 临时运行探针 | 7 组检查完成 | 敌方批次、迟读/重放、清层收尾、结算去重、两人再出征、坏档列表、队列取消 |
| 模块边界与入口门禁 | 通过：436 源文件、62 纯核生产文件、18 入口 | 在既有工作树上执行，不表示 S3 新客户端已存在 |
| 浏览器/构建/远端 CI | 本轮未重跑 | 浏览器源码已审阅；S2 的 40 项浏览器与全量构建属于历史证据 |

证据目录：[planning](../../../dist/reports/s3/planning)。包含 [targeted-tests.log](../../../dist/reports/s3/planning/targeted-tests.log)、[probes.json](../../../dist/reports/s3/planning/probes.json)、临时探针脚本及最终 [verification.json](../../../dist/reports/s3/planning/verification.json)。此目录为忽略的本地产物，清理 dist 后不会保留；核心观测已记录在本文。

复现探针：固定 Node 22 工具链下运行 `node dist/reports/s3/planning/run-probes.mjs`。脚本通过 esbuild 加载现有应用/规则与实际 React hook，使用 MemoryGameStore；不读写用户浏览器数据库。它不替代 IndexedDB 与真实页面恢复验收。

## 5. 范围保护

本轮只新增计划/审计并补文档导航，探针放在忽略的 dist。起始工作树 1389 条路径中，1386 条保持原哈希或原删除状态；仅 README、S2 计划和上位生产审计增加导航/追记，另新增本文与 S3 计划。原本已删除的路径按 null 比较，源码、素材、锁文件、设定定稿与旧冻结 fixture 保留。两份新文档的 56 个本地链接、计划内 npm 脚本名称及空白检查通过。

规划交付时，下一步为计划 E0；上述记录仅描述当时的审计，不代表后续实施状态。新客户端、恢复协调器、档案 UI 与玩家闭环的交付证据统一记录在 [实施报告](2026-09-05-s3-implementation.md)。
