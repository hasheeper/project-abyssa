# AIRP-1：正式契约与首条手写委托

更新：2026-09-09。阶段范围：契约、纯函数验证与隔离内容样本；不是玩家全链上线。

后续实施：[AIRP-2 手写闭环](AIRP_2_IMPLEMENTATION.md)已接线；以该文的版本决定、`airp-defer`、原身份恢复和“事务回执／领域回执”区别修订本文的暂定方案。本文其余范围仍记录 AIRP-1 当时的交付边界。

承接 [AIRP DEMO 总计划](AIRP_NARRATIVE_DEMO_PLAN.md)。本阶段选择“旧药箱的搭扣”作为首条样本，完成字段／状态／命令／reader、三轴知情、存档演进和容量边界。真正的命令事务、有效事实适配、IndexedDB 保存、洋馆／巡守 UI 接线在 AIRP-2 实施。

## 1. 本阶段实际交付

| 产物 | 位置 | 实现边界 |
| --- | --- | --- |
| 类型、上限与命令／定义解析 | [airp.ts](../../src/game-core/contracts/airp.ts)、[airp-validation.ts](../../src/game-core/contracts/airp-validation.ts) | 首条 sortie 契约 v1；拒绝任意奖励、目标 patch、未登记引用；不注册到 D5 |
| 时间、失效与完成证据 reader | [airp-readers.ts](../../src/game-core/session/airp-readers.ts) | 对已验证输入做纯计算，不自行认证外部 Fact，不写状态 |
| 三轴／共同知情投影 | [airp-context.ts](../../src/game-core/session/airp-context.ts) | 来源、主题、在场知情交集、稳定排序与预算；不调用模型 |
| 容量守卫 | [airp-capacity.ts](../../src/game-core/contracts/airp-capacity.ts) | 有界集合／UTF-8 大小，不是正式存档 reader |
| 目标与机械定义 | [first-errand.ts](../../src/content/gameplay/airp-v1/first-errand.ts) | 独立内容候选，未并入任何发布 Catalog |
| 完整手写降级稿 | [首条委托演出稿](../../src/content/presentation/airp/first-errand.ts) | 6 个可解析 AVG 短场景＋2 段巡守旁白、3 个态度分支、人物摘要出处 |

本阶段不修改默认内容注册／规则4／记录协议4。开工时默认为内容6；收口复核发现并行教程工作已在工作树将默认切至内容7，AIRP不覆盖该变更，目标测试同时核对内容6和7。也不假定 AIRP 必然叫内容8。`AIRP_CONTRACT_VERSION = 1` 是独立契约修订号。`rp-style-lab` 无改动；此阶段不需要应用后端。

以下状态机、持久对象和事务表是 AIRP-2 的实施合同；不能将“已定义”当成“现行存档已支持”。四型共用原则已明确，其他三型的执行器与内容仍在 AIRP-3。

## 2. 首条委托：旧药箱的搭扣

这是用于验证系统的作者工作稿，不是用户已经确认的新正典；没有新增地图、战斗单位或可治疗的药品。

| 项目 | 定义 |
| --- | --- |
| 稳定定义 | `ripple.elora.old-medicine-case@1`；`ripple / sortie` |
| 主题 | `supplies.recover-empty-medicine-case`；标签 `supplies.recovery / care.practical` |
| 发起人 | 艾洛拉；开场提及玛丽埃塔提供位置，不让未到场者出声 |
| 钩子 | 绷带挤在布袋里；勤务走廊有一只旧空药箱，带回后清洗修整 |
| 提供期 | 8 游戏相位，区间 `[createdPhase, offerUntilPhase)`；从持久提供时刻算起，不从第一次点开算 |
| 失效 | 惰性；从未曝光才可回备用。已见过期保留历史，不写“别人已替你冒险取回” |
| 接受后期限 | 无。当前原型一个活动出击委托；已接受不能再用拒绝按钮删除承诺 |
| 目标路线 | `old-manor.maintenance`；不要求把艾洛拉放进出征队伍 |
| 目标位置 | 第3层、第0号房间定义 `room.old-manor.maintenance.layer-3`（层从1计、房间索引从0计） |
| 注入 | 房间完成时产生本趟“取到空药箱”的任务携带标记；不新增掉落池、道具库存条目或购买行为 |
| 成功 | 本趟目标房间完成，且本趟 `extracted` 或 `cleared` 结算有效；仅到达第三层不算 |
| 失败 | 团灭不带回；本次携带标记失效，委托仍 accepted，下趟新绑定 |
| 奖励 | `memory-only`。原远征资金照常结算；无额外金币、药品、好感值或成长解锁 |
| 冷却 | resolved、missed、declined、expired-seen 均从终态起屏蔽规范主题256相位；备用不产生世界记忆 |

### 2.1 准入与可达性

提供前必须由当前权威查询确认：初章已完成或旧档有合法豁免；庄园已接管且首通收尾完成；维护路线已开放；艾洛拉已解锁、在馆且可交互；没有进行中的远征、回忆、正典收尾或其他占用舞台的场景；没有活动出击委托和同主题排斥。

当前可证明路线中第三层战斗后有既有侧门退出，继续则可走完五层。AIRP 不绕过这些房间与结算，也不添加随时逃跑。准入 reader 和人物可达共享规则尚未接线，不能仅凭 `catalog.characters.elora` 存在就判定可提供。

### 2.2 完整演出与选择

正文以 [演出稿源码](../../src/content/presentation/airp/first-errand.ts) 为唯一文本源，避免 Markdown 与游戏稿分别改字。

| 场景 | 固定内容／出口 |
| --- | --- |
| offer | 整理绷带→询问空药箱→提醒不使用旧药→一个三选关键轮 |
| 接受A / iron | 把药箱列进巡守目标；回应“我先把清洗的布找出来” |
| 接受B / seasoned | 清出安全路线再取；回应搭扣坏了也能回来修 |
| 接受C / pragmatic | 打算取到就撤；回应不必为箱子继续深入 |
| departure | 无演员的便条／目标旁白；不让缺席的艾洛拉说战斗台词 |
| found | 第三层战斗完成后，固定动作取走空箱并系到行囊外侧 |
| return-extracted | 出示撤离记录→接箱→搭扣扣不上→清洗和布带的轻小反应 |
| return-cleared | 出示巡路完成记录→接箱→箱盖需要支撑→感谢没有落下它 |
| retry | 先回来休息，不为药箱立刻折返；不编造伤势、治疗消耗或角色亲眼目击的战况 |
| declined | 艾洛拉先分两个布包，没有数值惩罚 |
| expired | 仅已见历史可回看的一句；未曝光入备用时不播放 |

A/B/C 都是接受且只记录态度，不自动执行出征／撤离。C 不是强制承诺终局必须撤离：玩家之后仍可继续，归来稿由实际结果选取，不能照态度猜结局。关键轮前，外围 UI 另有“稍后”（关闭，不刷新期限）和“不接”（正式拒绝）入口。

`kael` 只作内部玩家 ID；所有普通对白禁止玩家发声，稿中没有自动主角台词。动作与旁白固定手写；AI 将来只改批准的 NPC 对白槽。两条 return 的首屏明确出示巡守记录，为艾洛拉知道本趟结果提供传播依据。

当前 AVG 采用已登记的 `mansion-morning / mansion.first-morning` 做隔离日间预览；这不是昼夜场景适配完成。AIRP-2 应由实际洋馆地点与相位绑定舞台，未登记的夜景不得冒用清晨背景。巡守两段使用现有迎宾厅／勤务走廊场景，不新增美术。

## 3. 状态、时钟与失效

沿用现有代码相位名 `dawn / day / dusk / night`，对应晨／昼／昏／夜。`phaseIndex = (day - 1) * 4 + ordinal`；第65天晨为256，不读取系统时间。

| 当前态 | 输入／前置 | 新态与原子效果 |
| --- | --- | --- |
| 无实例 | 调度安全边界、准入成功、未消费的 boundaryId | 建立 pending、期限与手写 offer 场景；同时消费 boundaryId |
| pending | 打开且未到期、场景有效、演员可达 | offered，首次曝光相位与阅读身份；提交后才显示 |
| offered | 合法关键轮选A/B/C、没有其他活动出击 | accepted；选择、接受Fact、acceptedHead／phase 同一提交 |
| pending / offered | 相位到期 | 先失效，之后的打开／接受不能抢过期限 |
| offered | 不接且尚未到期 | closed/declined；记录拒绝，不授奖 |
| accepted | 从安全边界开启维护远征 | 原状态，写本次冻结绑定及出征来源；进入远征后不允许改目标 |
| accepted | 目标房间有效完成 | 原状态，本趟携带标记＋found短稿身份；不提前变 ready |
| accepted | 该趟有效成功结算＋携带标记 | ready，固定唯一证据；与远征结算一并提交 |
| accepted | 团灭或无目标证据的终局 | 原状态，关闭该趟尝试／清除活动绑定；retry短稿一次，下趟可再绑定 |
| ready | 玩家“出示药箱与巡守记录” | 原状态，最小报告传播事实＋冻结 return 场景＋阅读身份；不能授奖 |
| ready | 收尾阅读完成、证据仍有效、合法交付 | resolved；唯一回执、记忆、冷却、释放任务占用同一提交 |
| resolved / closed | 重复读取／同请求重试 | 不变；返回原回执／终态，不重放世界效果 |

失效分流：pending＋惰性→closed/reserved，只写内部调度历史与定义引用；offered＋惰性→closed/expired-seen，保留曝光历史；有后果→closed/missed＋唯一 aftermath，不扣资源／关系。接受后上述分流均不适用。

备用是模板资格，不是复活旧实例：保存原终态，下一次新 instanceId、重新查三轴与配额。为避免同相位反复补卡，reserved 最早下一游戏日重试；当前待命／活动／备用主题与未过期冷却共同参与排斥。重新提供某个备用模板时仅豁免它自己的reserve引用，仍检查其他占用与冷却，避免模板永远被自己屏蔽。首次样本不会展示有后果余波，该内容验收属于 AIRP-3。

## 4. 命令、事务与 reader 合同

### 4.1 玩家命令

`parseAirpCommand` 已实现以下字段白名单，但当前协议4拒绝它们。AIRP-2 放进新版本 request envelope，沿用 saveId、expectedHead、clientRequestId、规范命令摘要与 CAS；同请求同摘要返回原结果，同身份不同摘要报冲突。

| 命令 | 允许字段（除type） | 应用服务必须检查 |
| --- | --- | --- |
| airp-open | instanceId | 当前场景／演员可达、时限、剧情互斥；ready时按钮必须明确表示出示记录 |
| airp-read | instanceId、sceneId、nodeId | 已冻结本实例场景、当前可达节点；只走下一合法节点，不能跳过选择或恢复到未选分支 |
| airp-accept | instanceId、sceneId、nodeId、optionId | 当前offer的唯一关键轮；选择和接受原子提交，不接受客户端自报stance |
| airp-decline | instanceId | 已曝光且未接受；可达边界和时限；不可取消已接受／ready委托 |
| airp-turn-in | instanceId | ready、return阅读完成、有效证据、无冲突；奖励／记忆取定义，不取请求 |

玩家不能提交目标证据、收益、知识标记、完成状态或任意 patch。关闭窗口不是 command，不推进游戏相位。动画／分页完成不能冒充正式阅读完成。

`airp-read.nodeId` 表示正在确认已读的当前节点，不是任意目标游标；服务检查当前身份后自行算出下一个可达节点。选择节点只由 `airp-accept` 消费，不允许用read跳过接受／态度提交。

### 4.2 系统动作

这些是服务内部随既有合法命令产生的领域事件，不开放成不受限玩家API：

- `schedule(boundaryId)`：边界身份绑定原提交／相位，过期处理与补卡一起提交；确定性选择，首版不引入叙事随机数。
- `bindPatrol`：在真实出征命令中冻结 instance、definition版本、contentDigest、accepted Fact／head、departure Fact／head、runId、routeId、目标定义与运行时房间ID。
- `recordCarry / settleErrand`：重放战斗／旅程得到，不消费 UI 发来的“找到药箱”。found动画失败不影响已保存携带事实。
- `shareReturnReport`：玩家主动出示记录时，限定分享本次是否带回／撤离或通关，不传播队友私人记忆或全部战报。
- `acceptSceneCandidate`：持久订单的候选重新校验；在线生成不能与 IndexedDB 事务共存。

### 4.3 首条目标的证据映射

现有旅程 [d5-journey-evidence.ts](../../src/game-application/versions/d5-journey-evidence.ts) 会重放操作并校验前后摘要／事件；AIRP-2 必须在这个可信边界之后投影 `AirpObjectiveFact`。目前的 `readAirpReturnProof` 输入是测试用规范化事实，不是可直接接收网络 JSON 的安全接口。

| 证据 | 原始来源与映射 |
| --- | --- |
| 接受 | 新版 AIRP 接受领域Fact；确认该instance／definition，且未撤回 |
| 出征 | 本次有效 `expedition-started` / start旅程；接受 revision严格早于出征；同档／epoch |
| 房间 | 重放生成 `room-completed`；payload中的roomId是运行时ID，不能直接与定义字符串比较 |
| 定义映射 | 冻结 route.layers[2][0] → `room.old-manor.maintenance.layer-3`；运行时run.roomIds[2][0] → bound roomInstanceId |
| 带回 | 本次 `expedition-settled`，必须匹配run／route；extracted和cleared都成功，wipe不成功 |

reader 返回 `[acceptFactId, departureFactId, roomFactId, settlementFactId]`、terminalId、runId、evidenceId；缺少、撤回、跨档、跨epoch、其他run、回响、未来revision、错房间、重复／矛盾身份都拒绝。中途进入第三层、旧档首通和 `deepestLayer >= 3` 均不是替代证据。撤离终局不保证带完整 completion 清单，所以不能只看 terminal.completion。

应用适配器还必须验证：有效ID与规范化内容确实来自同一个已验证记录；绑定由合法出征生成；真实房间是战斗类型；接受和出征事实字段对应本实例。纯reader不负责认证这些输入。撤回房间事实后不能交付；已正式结算／交付的动作不得通过局部undo只撤一半历史，若未来支持此类回退，必须整组重演关联效果。

### 4.4 玩家查询

AIRP-2 新增只读 `readNarrativeOffers`、`readActiveErrand`、`readErrandObjective`、`readNarrativeScene`、`readNarrativeHistory`。它们分别输出可见入口／禁用原因、当前任务、携带或待交付状态、冻结正文＋阅读游标、已曝光终态与记忆；未曝光备用候选不进历史。查询不得补卡、调用模型、领取或直接扫描未验证日志。

## 5. 三轴、知情与上下文组装

顺序固定：验证记录并重放→筛选有效Fact→领域摘要与传播账本→任务相关投影→选静态人物资料→加任务与模板身份→预算→hash→生成器。业务事实仍只通过 Agenda／Bond／Locus 输入；订单和 provenance 是控制元数据，不是额外世界状态。

| 块 | 首条必须项 | 禁止项 |
| --- | --- | --- |
| Agenda | 当前任务／承诺、已确认的本次结果、规范主题排斥、相关已公开余波 | 未来正典、未选择分支、其他run冒充本次结果 |
| Bond | 接受态度、已发生的关系节点、在场者共同知晓的相关记忆 | 推测好感数字、旁人私密、模型编出的关系升级 |
| Locus | 当前phaseIndex、真实洋馆／巡守位置、实际在场演员 | 为气氛虚构季节、设施功能、人在馆外却发声 |
| 静态资料 | 世界必要前提、当前演员精简档案及版本／出处、文风约束 | 全部角色卡、人物尚未揭露的秘密常驻Prompt |
| 任务／舞台 | instanceId、sceneId、role、template版本、固定结果、批准槽位、已读内容 | 允许模型改分支／奖励／目标的自由instruction |

`assembleAirpContext` 已实现来源与知情交集部分；阶段／设施／排斥名单、已读片段和实际静态文本解析由 AIRP-2／4 的可信装配器补齐，当前函数不是完整生产Prompt。没有实现的字段宁可缺省，不造空白设施“已修复”等事实。

知识账本用 `public` 或显式 `shared.actorIds`。当前 D5 的 `visibility: party` 只说明日志可展示，不能自动变成全员知道。每条知识必须保留来源Fact和生效head／phase，来源撤回即不可检索。

两人场景要求玩家与艾洛拉都知道；新加入玛丽埃塔时取三人交集，不能把艾洛拉私事原样带入。目击只授予实际出征者；回馆“出示记录”才授予艾洛拉本次最小结果知识。原始人物卡里的关系描述是基线，不是一次新记忆。

首条交付后的权威记忆使用固定摘要：“玩家从侧门撤离并带回空药箱，已交付给艾洛拉。”或“玩家完成本趟巡守并带回空药箱，已交付给艾洛拉。”来源包含交付Fact及四项完成证据；知情集合先为`kael / elora`。态度单独保留所选枚举，不把A/B/C翻译成好感涨跌。搭扣／布带等文本细节留在冻结scene的表现连续性中，不自动成为可修理设施或库存资产。

投影按必需项优先、相位降序、ID字典序排序，最多24条知识、每条320字符，总上下文24 KiB（UTF-8）。低相关／旧条目稳定丢弃；必需项不知情、来源失效或超预算明确失败，不截断承诺或让模型自行补齐。当前hash包括版本化资料引用，AIRP-4 的最终订单摘要还须覆盖解析后的静态文本、政策／输出schema及已读槽位；字节限额不是token限额，上线另做供应商token预检。

## 6. 冻结剧本与生成任务

以下持久结构的完整未知输入reader在 AIRP-2 实施，本阶段不往 schema4 塞新字段。

| 对象 | 必填身份与不变量 |
| --- | --- |
| FrozenScene | sceneId、instanceId、role、templateRef、contentRef、sourceHead、contextHash、source=handwritten/generated、正文格式版本、完整正文、bodyHash；正文含稳定节点／分支ID |
| SceneReading | sceneId、bodyHash、当前nodeId、choiceId→optionId、completed；只前进到可达节点，选项不可覆写 |
| GenerationJob | jobId、owner(saveId/epoch)、task、sourceHead、queuedHead、instance／scene、templateRef、contextHash、attempt摘要、status、acceptedHash或失败原因 |
| MemoryEntry | memoryKey、ownerActorIds、instance、终态来源Fact、phase、topicKeys、knowledge、确定性摘要；文学细节只在scene内 |
| CooldownEntry | themeKey、规范标签、sourceInstance／terminalFact、fromPhase、untilPhase；有效区间半开；过期不删终态或领奖历史 |
| NarrativeState | instances、frozenScenes、readings、jobs、memories、cooldowns、reserve引用、boundary消费标记、唯一活动出击占用 |

生成任务 `queued → running → accepted / failed / cancelled / stale`，与事件状态分离。第一次展示前，无论手写还是生成，必须先保存完整正文及曝光身份。保存失败就不展示；读过的正文不可被迟到输出替换，刷新只恢复冻结正文／分支。

订单提交后再联网。`sourceHead` 是取上下文时的来源；`queuedHead` 是持久订单后的CAS起点，不能误把两者当同一次revision。接收验证owner、实例状态、模板版本、contextHash、演员、全部槽位与输出上限；首版依赖变化一律stale，重建订单或采用手写，不尝试模糊合并。最多初次＋2次重试，每次保留短诊断，不保留原始Prompt和失败正文。

AIRP-4 只改 NPC 对白的受限槽，不改旁白动作、分支ID、道具、状态或远程资源；手写返回稿在AI关闭／非法输出／超时／取消时完整可用。结构验证无法保证不OOC或不编事实，仍需内容抽查。相同模板的两个实际终局才是上下文差异样本，两次随机输出不是验收。

## 7. 存档与版本决策

### 7.1 版本切分

决定采用新版本记录／命令／规则边界，不把AIRP当成任意可选snapshot字段。当前注册器将schema／rules／protocol联动；若接线时最新仍为4，则新增5这组协议及独立Catalog注册，保留1–4 reader不变；若并行工作已使用该编号，则以合并时注册表重新编号，不能抢占。内容包编号独立确定并记录摘要。

正式reader顺序：全包结构与8 MiB限制→明确版本分派→内容身份／digest→既有游戏历史验证→AIRP命令／领域历史重放→实例与绑定／领取身份→冻结正文hash与AVG解析→阅读可达性／知识来源→容量→返回只读记录。不能只用snapshot“看起来合理”跳过重放；只通过AVG解析也不代表归属和来源正确。

首个上线版本优先把冻结正文保存在同一记录的有界内容映射内；IndexedDB一次CAS写入记录／场景／阅读与效果，无独立远程URL依赖。后续若拆独立store，必须同事务写入与完整性校验，导出仍打包所有引用正文。

### 7.2 旧档／导入／复制／新周目

| 情形 | 首版策略 |
| --- | --- |
| 继续旧档 | 仍走原reader与原Catalog，没有AIRP。不能静默向活动远征注入药箱 |
| 显式升级 | 仅无活动run、无未完成必需剧情、无阅读占用的安全边界；先读旧记录，保存来源，保留资产／既成事实及旧档豁免，AIRP从空账本起步 |
| 完整导入恢复 | 新版reader验证正文／引用／有效事实；保留同一档案身份和正在进行的委托，可恢复各中间态。存量身份冲突沿用明确恢复／拒绝流程，不能悄悄覆盖 |
| 复制为新档 | AIRP-2先限定无活动委托／阅读／run的安全边界；原档保留。新root身份重新生成，已曝光历史可作为来源档案只读保存，不将旧领奖证据变成新档活动证据 |
| 活动委托复制 | 首版明确不支持并提示先结束；完整事件／run／Fact／scene／receipt双向重映射另列后续测试，不靠替换saveId实现 |
| 新周目 | 不继承活动委托、提供期限、占用、请求与可再次领奖的证据；历史作为来源档案保留，不自动进入新周目的角色知情。AIRP记忆／主题冷却重置；既有成长继承照原规则 |

复制历史中的原始模型来源是审计信息，不改成新请求。新档所有在线订单生成新jobId／幂等域；任何 sourceFactId 都要有可验证的根或origin路径。若记录嵌套既有 `originRef.source`，容量按整个导出计量，不只数最新snapshot。缺引用／缺正文／新旧内容不匹配时保留原档并报错，不用补空数组或改版本号掩盖。

## 8. 容量测算与故障边界

不为“无限玩”承诺固定8 MiB足够。本阶段确定并测试下列硬上限（单条限额含JSON元数据，不只是文字）：

| 分类 | 数量上限 | 单条上限 | 最大正文／条目总量 |
| --- | --- | --- | --- |
| 冻结场景 | 128 | 16 KiB | 2 MiB |
| 事件实例 | 128 | 4 KiB | 512 KiB |
| 记忆 | 256 | 4 KiB | 1 MiB |
| 生成任务 | 128 | 2 KiB，最多3次短attempt摘要 | 256 KiB |
| 阅读／冷却／备用／消费索引等metadata | 有界集合，单集合不超过现有4096 | 合计128 KiB | 128 KiB |

全项填满的合成序列化样本是 **4,063,932 bytes，约3.876 MiB**，低于AIRP区域4 MiB；测试还覆盖中文UTF-8超限与第129个场景拒绝。合成样本验证字节外壳上界，不冒充正式可导入存档。完整记录（含战斗Fact／origin祖先）仍受8 MiB／节点数／深度等既有限额约束。

30张卡若各冻结offer＋一个return＋一次retry共90场景，最坏文本外壳90×16 KiB＝1,474,560 bytes。128个scene／job槽不能保证任意多失败尝试或全部终局同时保留：另一结果只在实际发生时冻结；静态fallback模板留在版本化内容包，场景实例仅保存实际选择正文。巡守已见提示如进入回看也要计入额度，不能当免费存储；30条×4场景＝120仍在上限内，多次retry会耗尽。

新候选创建前需按将来的offer／归来／一次retry预留字节与scene／job槽，连同既有主记录增长检查；失败诊断限长，重试仍在原job中。正式事务提交前再验完整候选记录。超限时停止新增涟漪／生成，提示导出或在安全边界开始新档；保留已见文本、关键事实、领取去重。没有足够空间就拒绝本次提交并保留原档，不先播放再静默删历史。

这套额度是DEMO保护栏，不是长期存储解决方案。AIRP-2必须用真实战斗／多趟委托／origin链记录复测剩余空间；如常规路径无法完成，先调整存储／归档设计，不能靠放宽8 MiB或删已看剧本交差。

## 9. 验收与 AIRP-2 接线清单

本阶段测试入口：

```sh
npm exec -- vitest run --project core src/game-core/session/airp.test.ts
npm exec -- vitest run --project app src/game-client/airp-first-errand.test.ts
npm exec -- vitest run --project application src/game-application/testing/airp-isolation.test.ts
```

使用项目固定Node 22.23.2。测试覆盖合法路线／退出、字段白名单、期限边界、已见／未见／有后果分流、接受后不超时、撤离／通关、来源撤回／跨run／回响／跨档／错房间、知情交集、稳定上下文、容量与所有手写分支可编译。

### 9.1 本轮实际检查结果

| 检查 | 结果 |
| --- | --- |
| AIRP专项 | 42/42通过：core 36、AVG稿5、协议隔离1；目标同时核对内容6与7 |
| `npm run check:core` | 通过；完整核心26文件／340测试、模块边界、无环境依赖导入检查与5次无界面远征结算 |
| `typecheck:application`／`typecheck:app` | 通过。应用类型检查曾遇到并行改动中的ES2023方法报错，相关工作随后修正，重新执行通过；AIRP未改该文件 |
| `boundaries:check` | 收口复核通过；744源文件、109核心生产文件 |
| 文档链接／差异 | 6个相关Markdown中143个本地文件链接有效；`git diff --check`通过 |
| `npm run check:application`完整回归 | **未通过／未完整跑完**。既有`loop.test.ts`报告购买用例120秒超时及新周目／升级内容引用断言失败后，结束了本轮启动的完整回归进程；未改超时阈值或无关测试来消除失败 |

完整应用回归执行期间，另一项教程工作正在改`player-runtime.ts`默认内容及`loop.test.ts`的升级版本期待值，因此这不是稳定工作树的最终发行回归结果。AIRP没有改这两个文件。后续在相关改动稳定后应重新执行完整应用回归；本阶段只将已完成的检查计为通过，不把上述失败归因成已证实的AIRP问题或已修复问题。

未做浏览器全链／IndexedDB故障注入／真实模型验收：本阶段没有对应正式接线。

### 9.2 下一阶段退出条件

AIRP-2必须完成以下项目，才能称“单条手写闭环可玩”：

1. 按实际最新版本新增Catalog与record／request reader，不修改已发布内容；实现安全升级、恢复、复制限制与失败回滚测试。
2. 将上述状态表实现为可重放领域事件；命令去重／CAS、调度消费、曝光／选择／记忆／冷却真正落盘。
3. 在真实出征和旅程重放中绑定／生成证据，覆盖正常撤离、全清、团灭重试、undo，不以此处规范化fixture代替实际操作证据。
4. 补人物可达和当前舞台适配；洋馆入口、任务提示、第三层found、回馆出示记录与阅读恢复串起来。
5. 同一请求和不同请求重复交付都只返回原回执；多窗口、刷新、存储故障不多领、不替换已看正文。
6. 用真实存档测试容量与导出；浏览器完整走一趟并记录截图／操作证据。AI关闭全链应完成，不需要先启用rp服务。

本阶段不宣称已有真实模型、公共后端、完整状态机执行器、正式存档迁移或约40分钟体验验收。
