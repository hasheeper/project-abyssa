# AIRP-4 勘探、实施与验收记录

更新：2026-09-09。实施依据：[应用接口计划](AIRP_4_APPLICATION_INTEGRATION_PLAN.md)。范围保持4A～4D，以下分步记录不代表整体完成。

阅读口径：第1～12节保留各轮实施时的历史状态；用户现已指定scy-a三个模型并授权充分测试额度，旧“等待配置／预算”前置已解除。2026-09-10 当前三段分工与修复机制见第13节，替代此前文本模型输出JSON的设计。

2026-09-12当前接续：用户更正小模型为deepseek-flash，已安装0.3.2并调整Writing事实承接，隔离回归通过；两情境四场真实闭环、摘要召回、重放和AVG通过，内容质量仍需修订，见[0.3.2记录](../audits/2026-09-12-airp-032-acceptance.md)及第17节。上批0.3.1错误模型名／6次请求和文本问题见第16节。旧档不迁移，以下各节保留发生时语境，当前排期以[Abyssa推进计划](ABYSSA_DEMO_NEXT_STEPS.md)为准。

## 1. 开工勘探

- 两仓库均有大量既有未提交改动，保留原状，不重置、不自动提交。
- Abyssa当前默认内容9／规则4，AIRP-3由`reduceAirpPoolCommit`重放玩法事实。旧场景仍为三情绪、16节点及`handwritten`来源；在线能力不能通过放宽旧解析器接入。
- rp已有Managed Interaction V8/V9、Workflow、State Updater及终态检查点；外部游戏可以使用Session／Interaction／Timeline／Result HTTP接口，不需要新增生成路由。
- rp Client SDK是工作台内嵌Surface接口，不是现成外部HTTP客户端。外部接入须处理真实`thread-timeline-v6`嵌套结构、精确Floor／Checkpoint、Contract与最终结果来源。
- Package Server SDK有Program／derived／Validator／Materializer边界。优先复用原生机制；领域模块不直接查库或调用Provider。
- 当前rp SQLite扩展为Node ABI 131，本机Node 23匹配；不重装用户依赖。Abyssa测试另使用已安装的Node 22运行时，运行前核验版本。

## 2. 执行顺序

| 阶段 | 具体动作 | 验收证据 |
| --- | --- | --- |
| 4A | 定义独立在线请求／文本／来源／接纳契约；实现外部HTTP适配和fixture测试；固定writer、确认与恢复政策 | 类型检查；旧解析器不变；正常、重复、过期、错误来源、终态失败、分页及14情绪专项测试 |
| 4B | 在rp安装机制下新增AIRP应用资源与领域模块；大纲→文本Workflow、独立预设与小模型Updater；确认／失效、知情筛选 | 真实宿主＋模拟Provider集成测试，原生Floor／State／Ledger和输入证据 |
| 4C | 新内容版本接入请求持久化、合法场景接纳、原AVG、阅读确认和下一场记忆引用 | 真实游戏命令与浏览器闭环；具备配置后真实模型两情境样本 |
| 4D | 断线／刷新／多窗口／切档／重复／分支恢复／改稿／降级与旧档回归 | 自动化恢复测试、真实浏览器、文风与运行成本记录；公开部署如有需求另验安全 |

通用能力在rp复用／补齐，AIRP仅持有领域语义与预设。协议是应用接口，不是内容发布包；不另建状态库、模型调度器或浏览器rp内核。

## 3. 4A接入决定

首个任务使用“旧药箱的搭扣”的归来场景，后续场景验证已确认记忆。游戏规则仍负责真实证据与奖励，rp负责叙事状态；调试与玩家使用同一应用版本、独立Session。

请求在网络调用前持久化并冻结本地head、内容版本、事件／任务、演员、事实与rp分支。正文只有可见创作记录和演员／情绪／文本；创作记录不进玩家正文，不要求模型生成AVG跳转、场景ID或奖励。

响应只有在精确Contract／Floor的terminal、committed、restorable、stateContinuable检查点与最终结果相符时才可接纳。客户端不取最后一楼、不以outputText代替提交证明。结果绑定原请求，本地head变化则拒绝；重复接纳应返回同一场景，不生成第二份效果。

阅读完成后以本地事实身份确认给rp，确认前不得启动依赖该记忆的下一场。生成候选不等于玩家已经历；断网不回滚已完成玩法。恢复旧备份须核对rp精确检查点，冲突时分叉或明确阻断，不能覆盖较新分支。

## 4. 当前执行状态

4A客户端契约与外部HTTP适配、4B首个后端应用与模拟Provider链路已实现。4C现在也已接入显式内容10的玩家存档、原AVG、读后确认与后续交谈，详见第8节；默认新档仍为内容9，旧档不自动迁移。4D恢复专项持续验证，真实模型的文风与费用尚未验收，不将整体4A～4D标记完成。

| 交付物 | 内容 |
| --- | --- |
| [在线契约](../../src/game-application/airp/contracts.ts) | 固定`generate-scene`、请求来源／演员／事实／预算、14情绪、原生绑定与回执 |
| [场景接纳](../../src/game-application/airp/acceptance.ts) | 冻结ticket、来源复验、head／事件过期拒绝、同稿幂等、已提交阅读确认；不写奖励 |
| [Session绑定](../../src/game-application/airp/rp-session.ts) | 从指定Release解析冻结资源，区分游玩／开发与存档身份；只接纳精确身份的空Session与空分支 |
| [控制动作](../../src/game-application/airp/control.ts) | 固定已读确认／丢弃ticket，绑定可信原文Entry及精确前序检查点，不接受客户端自填trustedScene |
| [原生响应解析](../../src/game-application/airp/rp-wire.ts) | Timeline V6、Checkpoint V5、输入／输出引用、精确Pipeline Result与hash；不取最后一楼 |
| [HTTP适配](../../src/game-infrastructure/airp/rp-http-client.ts) | 原生Interaction→分页Timeline→Result，单次总超时／取消、响应预算和明确错误；不自动重发或串联模型 |
| [跨仓库验证](../../scripts/verify-airp-rp-contract.mjs) | 临时rp宿主＋两节点原生Workflow＋模拟Provider，使用上述真实客户端读取并接纳，重放不增加模型调用 |

原生协议实测确认：Workflow V1的结果Entry是**字符串**，即使模型输出JSON，Entry保存的仍是JSON文本；客户端先核对字符串Entry及Result，再解析为正文对象。InvocationInputSchema V1使用`list`，不是JSON Schema的`array`。不通过伪造对象Entry或扩大宿主协议绕开这些边界。

首轮新增57项测试通过（契约42、HTTP14、与原表现情绪一致性1），应用层与全项目类型检查通过，模块边界检查通过。跨仓库验证通过：当前V8 Contract／V5 Checkpoint→外部客户端→接纳→同请求重放，共2次模拟模型调用、0次真实Provider调用。该验证使用临时测试应用，**不等于4B正式AIRP应用、Updater或玩家UI已经接通**。

本轮既有AIRP应用层回归已完成：6个文件，89项通过、5项原有跳过；耗时约264秒。随后按最新字符串Entry及输出来源字段重跑新增三文件：57项通过。不把历史通过次数沿用为本轮结果。

复验命令：在Abyssa用项目Node 22运行`vitest run`指定新增三测试文件；类型检查运行`tsc -p tsconfig.game-application.json --noEmit`及`tsc --noEmit`。跨仓库验证在rp的`server/`中用其ABI兼容Node运行：

```sh
node --import tsx /Users/liuhang/Documents/project-abyssa/scripts/verify-airp-rp-contract.mjs --rp-root /Users/liuhang/Documents/rp-style-lab
```

## 5. 4B已核对的实施入口

- 使用独立AIRP Application Package定义角色／预设、两节点Workflow、State Schema及Program／Validator；保留原生Conversation入口满足Release契约，不将玩家流程退回自由聊天。
- 首轮无需内嵌新工作台UI，Package允许`client:null`；外部Abyssa接口和rp原生资源／执行检查即可联调。
- Program输出与Action最终输出共享字符串schema，可输出受控准备信息并把已校验请求／召回切片写到授权State；Workflow用授权View读取。不要假设Program有一个当前不存在的独立输出schema。
- 记忆有效集合与送模切片分开；通用预算／稳定选择机制复用或补入rp，应用负责来源、知情、候选／已读资格及失效政策。
- Updater可以绑定`interaction-input`、`program-output`、`authoritative-output`，并读取授权State／更新政策。计划使用required更新，失败不冒称记忆已更新。
- 类酒馆预设须按源文件逐模块提取、分任务配置并记录保留／删除依据；实际提取已在4B完成，真实模型表现仍待验收。

## 6. 4B后端应用与跨仓库验证

实现位置：[rp AIRP应用](../../../rp-style-lab/applications/airp/README.md)。只新增应用资源与领域模块，不接管Abyssa Campaign，不改写旧本地Fact，不直连Provider、不注册专用路由。Package是rp原生的后端应用安装单位，**不是重新引入静态内容发布器**。

当前执行链：

1. `generate-scene`核验游戏身份／epoch／内容、演员、故事时间与事实知情；Program准备有界context，原生Workflow依次运行大纲与文本。
2. 生成只形成待确认候选。Abyssa外部客户端核验精确终态／Result，文本仍只有创作记录、speaker、14情绪与正文。
3. `confirm-scene`引用本分支精确终态的可信原文，核对已读身份、request hash与实际正文hash；Program记录正文来源与玩法Fact引用，required Updater只写本次320字以内的摘要。
4. 后续场景仅使用有效、已确认、在故事时间内且在场演员共同知情的连续性；同一请求原生重放不重复模型调用。`discard-scene`放弃候选，`invalidate-memory`使本分支源记忆及依赖项失效，旧检查点不变。

4B阶段补入rp的通用能力有两项：SDK的稳定有界选择函数，以及原生trusted Entry新增`same-branch-terminal-output`来源。角色／知情／记忆资格等留在AIRP。当前选择上限4条／4096字节，状态上限8条记忆；达到容量明确停止，不无限增长。未授权条目ID只留私有筛选审计，不发给模型。4D继续补齐通用HTTP关闭生命周期，见第10节。

实测的两个重要口径：

- Context Projection的selectors不是可选分支，声明的每个schema都须找到来源。因此动作复用字符串`airp-action-output-v1`用于投影；正文消费者额外核对Action、`pipeline-result`来源和精确写作Pipeline。Program准备回执不被当成正文。此变化仅涉及尚未发布的4A在线契约，不改内容8／9。
- required Updater语义拒绝后，rp可能保留已认证Program State，`stateContinuable`仍为true，但`restorable`为false并有失败原因。客户端不能只看一个布尔值；领域层另外阻止必需摘要缺失后的依赖续写。空摘要／空patch也不算完成必需更新。

预设提取见[rp提取记录](../../../rp-style-lab/applications/airp/resources/PRESET_EXTRACTION.md)：保留启用模块的相对顺序、有效宏含义、口吻、可读性、反机械化与正常虚构冲突；按句移除越权安全宣告。ICOT变为可见前置创作记录，非隐藏推理。长篇外部小说示例因任务和预算不需而省略，不能误称其全部是破限指令。小模型不套写作预设，`llm/`原流程未动。

4B阶段验证结果：

- rp新增10项专项通过：真实Package安装／Release、两节点Workflow、确认与幂等、Updater、连续召回、来源／空摘要拒绝、失效传播、身份／时间回退、私密条目隔离及通用预算。
- rp既有Package安装／绑定、Child可信提升和Updater专项回归23项通过。
- [真实AIRP应用跨仓库验证](../../scripts/verify-airp-rp-application.mjs)通过：使用Abyssa实际HTTP客户端，从Package生成结果→本地纯接纳→原生HTTP可信确认→Updater→后续场景引用记忆，共5次模拟模型调用、0次真实Provider调用。
- rp服务端、服务端测试、AIRP应用与Server SDK类型检查通过；本次新增／修改代码ESLint和格式检查通过。Abyssa全项目类型检查与模块边界检查通过。
- 最终重跑10项后端专项、两条跨仓库脚本均通过；后端扩展构建约21.95 kB，原生Application Package构建成功，仅生成本地开发产物，未安装到用户数据库。两仓库`git diff --check`通过，6份相关文档本地链接检查无缺失。

运行跨仓库验证：

```sh
# 在rp的server目录，用SQLite ABI兼容的Node运行
node --import tsx /Users/liuhang/Documents/project-abyssa/scripts/verify-airp-rp-application.mjs --rp-root /Users/liuhang/Documents/rp-style-lab
```

架构检查的本次契约签名变化已隔离验证：在内存中仅去掉新增trusted来源后，签名与原基线完全一致，因此只更新该签名。Package身份改由应用导出，宿主测试不写死应用ID。未刷新包含他人改动的全仓架构报告；既有未接线logo文件与报告过期仍是全仓检查的剩余问题，不冒称全仓CI全绿。

## 7. 4C传输接线与恢复勘探

已落实到实际HTTP客户端，不再由验证脚本手写确认请求：

- `release`按显式Release ID读取原生资源，用Package逻辑键定位大纲／写作／Updater／Workflow／Contract的冻结版本。不会自动跟随`currentReleaseId`，不会从浏览器上传提示词来替代Release。
- `createSession`／`recoverSession`使用持久化Session ticket中的存档ID、epoch、游玩／开发模式、内容摘要和精确Release；检查原生participant、Package／资源版本、三个模型槽、空Session及其精确空分支。开发与玩家不用同一个Session，标题或active分支不是绑定依据。
- `submitGeneration`可先返回原生回执，`readResult`单独核验正文。这样即使正文不是合法JSON，仍可依据原始回执丢弃候选；不能因解析失败而丢掉后端已经推进的事实。请求／回执由玩家应用层持久化，传输层不自行写存档。
- `control`／`readControlResult`分别发送和查验确认／丢弃。确认须核对可信原文hash、完整已读payload、Program输出、certified Ledger、required Updater的冻结Pipeline与accepted提案；HTTP 200及单独`stateContinuable:true`均不足以完成确认。丢弃不产生已读记忆。
- POST之后的GET断线仍保留“提交结果不明”语义；调用方只能查回／重放相同ticket，不能推定POST已撤销。传输层无自动重试循环，重放失败的required Updater不会另跑一次模型来伪装成功。

新增验证：5个客户端文件合计100项通过（契约42、控制19、Session16、HTTP22、表现兼容1）；全项目与应用层类型检查通过，模块边界790个源文件无新增违规。旧内容8／9和玩家默认内容未改。

更新后的[实际应用跨仓库脚本](../../scripts/verify-airp-rp-application.mjs)通过：从HTTP读取Release→创建并查回独立Session→两节点生成→客户端已读确认→Updater→下一场召回→丢弃；另验证过期head在模型调用前拒绝、非JSON候选仍可清理、空patch导致required Updater失败且重放不增调用。合计10次模拟模型调用、0次真实Provider调用。原两节点接口脚本也重新通过（2次模拟调用）。均使用临时宿主数据库，未安装到用户数据库或触发实际费用。

此阶段勘探发现的Session限制：`POST /sessions`没有`clientRequestId`幂等契约。传输适配仅提供单一创建者下、按精确metadata查回丢失响应的恢复；多个匹配候选明确失败，已使用的Session不会被当作新实例接走。**传输适配本身不构成跨窗口唯一创建保证。** 后续第8节已经在玩家接线加入持久化身份与同origin Web Locks，并验证双窗口恢复；如需要跨设备／后端强幂等，仍须补在rp通用Session能力中，不能以AIRP轮询或标题匹配替代。

## 8. 4C实际玩家接线

内容10已经创建并注册，入口为标题「记录」中的「新建 AIRP 联机档（内容10）」。普通「新的开始」仍使用内容9。新档沿用原教学／巡路；首个在线样本为「旧药箱的搭扣」归来及一次后续交谈，不假装其余卡片均已生成化。

| 位置 | 已实现职责 |
| --- | --- |
| [内容10](../../src/content/gameplay/demo-v10/content.ts) | 显式启用在线定义，保留内容9与手写降级稿 |
| [玩家契约](../../src/game-application/airp/gameplay-contracts.ts)、[重放规则](../../src/game-application/airp/gameplay.ts) | Session绑定、请求／结果／确认／清理随Fact、Receipt和存档完整重放；不是浏览器sidecar |
| [请求协调](../../src/game-runtime/airp-online-driver.ts) | 每次只推进一项已持久化工作；通过真实HTTP适配调用rp，无模型编排或Agent循环 |
| [浏览器锁](../../src/game-infrastructure/airp/browser-lock.ts) | 相同来源下同一连接的排他操作；取得锁后重读，避免另一窗口已处理后重复提交 |
| [来源门禁与AVG](../../src/game-client/AirpStory.tsx)、[连接控件](../../src/game-client/AirpOnlineControls.tsx) | 展示前明确联网／手写；原阅读控件逐句确认；连接与前置创作记录独立显示，不混入对白 |

请求使用该请求提交**之后**的本地head，避免自身持久化就使响应过期。事实来自已重放的接受委托、出发、找到药箱和成功归来证据，不由界面自由输入。结果接纳仅替换获准场景正文，角色、舞台与任务控制仍来自程序；不变更奖励／时间／任务终态。

14情绪只走新在线契约；旧`validateAirpScript`仍限制三情绪、16节点、320字。在线正文至多32行、每行600字，并有24 KiB总预算；仅经在线接纳产生的场景使用48 KiB存储上限，完整叙事与存档上限未扩大。在线工作区另有512 KiB与两个样本场景上限。

未选来源与生成中场景同时从正文和历史转录隐藏。手写稿一经选择不可由迟到响应替换；即便原文无法解析，也可重放同一生成请求取得原生回执，再丢弃候选。该清理不是撤销HTTP；在请求尚未到达后端时选择降级，查回过程仍可能执行这次生成，不能承诺零费用取消。

最后一条真实`airp-read`提交原子产生确认ticket，动画结束不记已读。required Updater确认完成前，不允许依赖该记忆的新场景；本地任务交付与后端叙事确认分工明确，不双写奖励与同一记忆字段。

本次已验证：

- 玩家应用层7项通过：实际巡路、正文／历史门禁、请求head、完整备份重放、原AVG读取确认、后续任务、迟到降级、篡改拒绝、复制阻断、CAS竞争及最大正文预算。
- 原接口专项99项重跑通过；新增请求协调与Web Locks专项12项、UI生命周期／重试4项、情绪契约兼容1项通过。旧UI专项另7项通过。未把历史通过数当成本轮总数。
- [真实玩家跨仓库脚本](../../scripts/verify-airp-player-application.mjs)通过实际游戏命令贯通：巡路证据→独立Session→生成→原场景冻结→逐句阅读→原生记忆确认→后续召回；恢复发送中的旧备份后查回同一生成／确认记录，不新增模型调用，也拒绝覆盖较新本地档。两个场景合计6次模拟调用、0次真实调用。与旧纯接纳脚本不同，它不绕过游戏Fact／Receipt。
- [浏览器专项](../../tests/smoke/airp-online.spec.ts)最终4项通过，使用构建后的Abyssa、临时原生rp HTTP宿主、真实IndexedDB与Web Locks：响应丢失／双窗口恢复／后续记忆；非JSON正文手写降级；required Updater失败保留阅读、重试不增加调用且阻断后续；Session创建响应丢失后双窗口查回同一游玩Session（加开发fixture共两个Session，0次模型调用）。
- 视觉检查修复底栏裁切及连接面板被对白框遮挡的问题；最终展开面板、普通对白与失败提示截图已人工查看，新增遮挡命中测试通过。控件生命周期4项与请求协调12项在修改后重跑通过。
- 全项目四组类型检查、模块边界与game构建通过。没有安装到用户数据库、读取模型密钥或部署服务。
- rp的应用／预算选择9项与同分支可信源1项再次通过；旧实际应用脚本再次通过（10次模拟调用），玩家脚本通过（6次模拟调用），均为0次真实Provider调用。两仓库差异空白检查、7份当前文档的本地链接检查通过。

复验时使用各仓库兼容的Node，先运行7项玩家测试生成经过验证的`dist/reports/airp-4/checkpoints.json`；测试fixture不是用户存档：

```sh
# rp/server目录；不提供fixture环境变量时，会从真实玩法命令重新构造前置档
ABYSSA_AIRP_ONLINE_FIXTURE=/Users/liuhang/Documents/project-abyssa/dist/reports/airp-4/checkpoints.json node --import tsx /Users/liuhang/Documents/project-abyssa/scripts/verify-airp-player-application.mjs --rp-root /Users/liuhang/Documents/rp-style-lab

# Abyssa目录，先build:game；15176在rp开发CORS白名单内
ABYSSA_RP_ROOT=/Users/liuhang/Documents/rp-style-lab ABYSSA_SMOKE_PORT=15176 npm run test:smoke -- --project=game airp-online.spec.ts --workers=1
```

浏览器测试子进程默认使用`/opt/homebrew/bin/node`匹配rp的SQLite，可通过`ABYSSA_RP_NODE`明确指定；其临时宿主只监听回环地址，模拟脚本控制使用测试IPC，不向应用暴露测试HTTP端点。

## 9. 4D恢复政策与剩余验收

首版恢复采用保守边界，不再另造一套分支引擎：

- 刷新／离页仅取消当前等待，保留持久化ticket；恢复查回或重放同一请求。控件对同一工作自动尝试一次，失败后只接受显式重试；不自动循环修复模型。
- Web Locks只保证同浏览器／同origin的协调，**不等于rp后端强幂等或跨设备唯一Session创建**。原生创建缺少幂等键的问题仍在；多个精确匹配候选或已使用候选不猜选。
- 完整备份可以保留原saveId／epoch恢复；本地已有不同／较新记录时拒绝覆盖。新在线调用仍携带精确rp head；远端分支冲突时停止，不能跳到“最新成功楼层”。已冻结文本仍可读取。
- 已绑定在线Session的档案暂不允许复制为新身份、升级或新周目，避免两个身份共享可写实例。UI隐藏该续接入口，应用层也拒绝。尚未实现自动rp Fork／跨Session记忆迁移，不能写成支持任意分叉恢复。
- required Updater失败必须显示未确认，保留已完成阅读且阻断后续依赖。相同失败请求重放不能重新调用模型洗成成功；后端修复／显式分支处理仍需单独执行政策。
- 改稿失效已有rp领域Action和后端测试，但玩家改稿／分支恢复UI、长期多场景状态容量、跨设备强幂等均未承诺完成。

原生备份重放、必需更新失败的玩家表现与同origin创建恢复现已通过上述专项。旧内容8的21项、再战／隔离3项及核心规则48项通过；内容9共14项分批复验通过，包括从真实前置档验证三条出击链、余波、失败重绑、完整通关及旧版继承。两项完整历史测试曾因原默认5秒超时；与邻近集成用例统一为60秒后单独重跑，两项分别约3.2／3.7秒通过，断言未删。本次是13项全链通过加两项定向复验的证据合并，不冒称此前失败运行全绿或全仓CI已完成。

真实模型两情境文风、耗时和费用仍需指定AIRP Release、模型槽与调用预算；目前均为模拟Provider，不能以6次模拟调用代替文本质量验收。已向用户提出配置／预算问题，在明确前不读取凭证或发起真实Provider调用。

整体4A～4D保持进行中。当前实现方向仍是**rp通用后端＋AIRP应用定义＋Abyssa客户端**，没有内容发布器、浏览器rp内核或第二套Agent／状态平台。

## 10. 4D原生分支、中断与切档专项

按“勘探→计划→执行→验证”继续补足恢复证据，没有改变第9节的保守恢复政策。

### 勘探与决定

- rp已有精确检查点Fork及应用级失效Action；需要验证实际分支隔离，不再实现AIRP分支引擎或自动迁移。
- 写作／required Updater在途时，原先`app.close()`只等连接关闭，既不向HTTP请求传递应用取消，也不能确保异步handler的检查点／finally先于数据库关闭。实际玩家HTTP恢复验证曾因此挂起；这是通用宿主生命周期问题。
- 切换GameSession时，已持久化工作会随port更换取消，但连接阶段的Release查询原先只在组件卸载时取消。补上切档专项后先复现失败，再按Session生命周期修复，阻止迟到连接结果写回旧存档。

### 实施边界

rp的[通用请求信号](../../../rp-style-lab/server/src/http/request-signal.ts)现在组合客户端取消、请求超时与应用关闭信号；启动时统一注册。优雅关闭先通知取消并等待在途handler结束，再由既有onClose关闭Worker／数据库。handler保留Fastify上下文，异常也释放等待；普通JSON与hijacked SSE使用同一机制，没有AIRP判断或专用HTTP接口。Provider仍须配合取消，不承诺任意不合作任务的固定时限退出。

两种中断不可混写：

| 场景 | 验证结果 |
| --- | --- |
| 直接原生服务中的悬挂执行，模拟异常退出遗留工作 | 重启将1项running执行收口为interrupted；相同请求返回同一incomplete终态，不重调模型；再次重启恢复数为0 |
| 实际玩家HTTP调用期间优雅关闭 | 关闭信号先取消写作／Updater，终态落库后才关闭；重启恢复数为0，不是假成功；相同请求仍被客户端判为`airp-incomplete` |
| 原生精确检查点Fork后失效记忆 | 相同Fork请求幂等、错误hash拒绝；仅新分支及依赖失效，原检查点不变；工作台active分支不影响显式原分支续写 |
| GameSession切换 | 原工作与连接查询均取消；迟到连接结果不绑定旧档或新档，界面可重新连接 |

[玩家恢复验证](../../scripts/verify-airp-player-recovery.mjs)使用实际玩法存档与HTTP适配：写作中断后可以显式选择手写稿、查回原回执并丢弃候选，不产生记忆；Updater中断保留已读事实，不生成确认回执或改动资产，依赖它的后续生成被阻断。不是只测孤立DTO或绕过存档重放。

### 本轮验证

- rp应用、预算、可信源、原生Fork／中断、通用HTTP生命周期和既有Updater恢复：23项通过；普通Conversation／Child／Activity／Presentation SSE、Application、Provider、Execution、Storage接口回归另27项通过。
- [HTTP生命周期专项](../../../rp-style-lab/server/test/integration/request-shutdown.test.ts)6项覆盖根／子路由、客户端取消、请求超时、SSE关闭和handler异常；已含在上述23项内，不重复累加。
- Abyssa在线契约／控制／Session／HTTP／请求协调／情绪兼容及UI生命周期合计118项通过，其中UI6项包含新增切档2项。连接查询的新增用例修复前失败、修复后通过。
- 三条跨仓库脚本均通过：玩家恢复writer2次／updater3次、完整玩家闭环6次、正式应用接入10次模拟调用；全部0次真实Provider调用，均为临时测试数据。
- 修改后重新构建游戏，4项原生浏览器专项全部通过（约1.9分钟）：丢失响应与双窗口恢复／后续记忆、非法正文手写清理、必需Updater失败、丢失Session创建响应后的唯一游玩实例恢复。使用临时后端与真实IndexedDB／Web Locks，不是替换HTTP的静态mock。
- rp服务端及测试类型检查通过，修改的rp源文件和测试ESLint／格式检查通过；Abyssa全项目类型检查、800源文件边界检查及game构建通过。
- rp架构检查暴露新增测试目录不符合既有分层，已将测试移至`server/test/integration/`并复验消除该项。剩余为既有未接线logo文件和过期报告；不刷新含其他工作内容的全仓基线，不声称全仓CI通过。
- 两仓库差异空白检查及5份本轮更新文档的本地链接检查通过。

复验恢复脚本：

```sh
# 在rp/server，用与SQLite兼容的Node；fixture为测试构造的游戏记录
ABYSSA_AIRP_ONLINE_FIXTURE=/Users/liuhang/Documents/project-abyssa/dist/reports/airp-4/checkpoints.json node --import tsx /Users/liuhang/Documents/project-abyssa/scripts/verify-airp-player-recovery.mjs --rp-root /Users/liuhang/Documents/rp-style-lab
node --import tsx --test test/application-packages/airp-recovery.test.ts test/integration/request-shutdown.test.ts
```

本轮没有安装应用到用户数据库、读取密钥、调用真实模型或部署服务。玩家自动Fork、跨设备创建幂等与长期多场景扩容仍是未承诺能力；真实模型的两情境文风／知情隔离／连续性及耗时费用仍待明确Release、模型槽与预算后验收，不能以模拟测试替代。4A～4D整体仍保持进行中。

## 11. 验收复核：补齐三轴情境的实际语义

复核总计划§5.1时发现，原送模内容虽然有`phase`、`stance`、地点ID与筛选后的记忆，却缺少编码对应的时段、选项和场所说明；不能将“字段已传入”当成“模型已拿到明确情境”。本轮继续按勘探、定位来源、先写失败用例、实现、复验推进。

新增rp AIRP的[领域上下文资源](../../../rp-style-lab/applications/airp/resources/scene-context.ts)，来源为现有世界公开切片、药箱选项、场所定义、游戏时钟和主角行为契约。只补应用语义，不修改rp通用调度、HTTP或状态Schema，不跨仓库导入生产服务：

- Agenda明确归来／后续目标、空药箱边界、玩家当时选择的安排与本次真实巡路结果；`pragmatic`不等于一定从侧门撤离，选择不是结果，也不是永久性格。
- Bond只列送模筛选已经选中的已确认记忆ID与公开同队基线。未提供的关系阶段／好感／羁绊节点明确不得臆造，不把作者口吻示例补成经历。
- Locus把相位索引还原为游戏日、晨／昼／昏／夜，给出公共休息室名称及本次在场者；未知地点在模型调用前拒绝。不从在场者倒推谁参加了巡守，也不新增设施或天气事实。
- 玩家`kael`仅为兼容ID，显示称呼为“你”，不生成固定姓名、对白或内心。世界前提只有药箱样本所需的公开范围，没有注入全量世界秘密。
- 原请求、资源来源及筛选证据继续由原生State／输入证据冻结；同一prepared View进入大纲与文本，小模型仍只收到其授权的已读摘要任务。

新增7项[上下文测试](../../../rp-style-lab/server/test/application-packages/airp-context.test.ts)：四时段／三安排／两结果的实际模型输入、后续记忆、未知地点拒绝及24条×320字玩法事实的原生预算。前6项在修复前全部失败，修复后7项通过；与原应用7项、恢复3项合计17项通过。这里的“实际模型输入”指原生编译后交给模拟Provider的输入，不是真实模型文风结果。

[跨仓库语义校验](../../scripts/verify-airp-rp-context.mjs)直接比对3个游戏选项文案和64天×4时段共256个时间编码，全部通过；不安装应用或调用HTTP／模型。这样资源中必要的编码解释不能悄悄偏离游戏定义。

实际玩家→rp链路重新通过（6次模拟调用），正式应用接入／失败语义脚本重新通过（10次模拟调用）；均0次真实调用。AIRP与服务端测试类型检查、修改代码ESLint通过；后端Bundle构建为约25.78 kB。预设源文件SHA-256与既有提取记录一致。rp全仓架构检查仍只报告既有logo未接线与报告过期，不改无关基线。

复验命令（rp/server）：

```sh
node --import tsx --test test/application-packages/airp-context.test.ts test/application-packages/airp-application.test.ts test/application-packages/airp-recovery.test.ts
node --import tsx /Users/liuhang/Documents/project-abyssa/scripts/verify-airp-rp-context.mjs --rp-root /Users/liuhang/Documents/rp-style-lab
```

本轮没有修改玩家玩法、旧存档或在线wire版本，也不改写已冻结的Release和历史输入。整体仍缺真实模型的两个来源明确情境、连续性／知情／文风及耗时费用验收；所需rp实例／Release、三类模型与预算尚未由用户指定，不能以本轮新测试宣告4A～4D全部完成。

### 整体验收核对与外部前置

| 阶段 | 当前可核对证据 | 不能据此宣称的结果 |
| --- | --- | --- |
| 4A | 独立在线契约、严格来源／终态解析、Session绑定、冻结请求／确认／丢弃；接口和存档测试，实际原生HTTP链路 | 不证明生成文风或公网安全 |
| 4B | 原生Package构建与临时安装、三槽分任务预设、两节点Workflow、受控Updater、共同知情筛选、来源失效；本轮上下文及原应用测试 | 未选择真实型号，未向用户数据库安装；模拟Provider不是模型质量验收 |
| 4C | 内容10实际巡路请求→原AVG冻结／阅读→原生确认→后续记忆；玩家脚本与浏览器证据见第8、10、11节 | 不把显式手写降级计作AI通过，不声称其余所有卡片已生成化 |
| 4D | 来源冲突、幂等、刷新／断线／双窗口、切档取消、原身份备份、原生Fork／失效、writer／Updater中断及旧内容分层回归 | 真实模型的两情境文风、连续性／知情与耗时费用仍未验收；自动迁移、跨设备强幂等、公开部署不在已交付保证内 |

本节结束时尚缺真实配置；这一历史前置现已由用户解除，不再要求重复填写或审批。具体授权、安装及实测修复见下节。

## 12. scy-a真实接入与兼容性修复

用户指定文本`gemini-3.8-flash`、大推理`claude-fable-5 [perplexity]`、小推理`deepseek-v4-flash`，全部来自已有scy-a，额度“够用”。复用已有Target及系统凭据，不重复创建Provider／Target，不修改供应商默认值或其他应用。

本地API为`http://127.0.0.1:8787/api/v1`，AIRP Application为`a1abd682-8fdc-4ccb-a293-f84163f909dd`。通过原生CLI安装Package、重启本任务启动的API，再按原生plan/apply升级，当前Release为`600c9af3-f62a-4db9-b78c-a8a9bf1a209d`（0.1.2）。旧0.1.0／0.1.1 Release、失败楼层和Session保留，未改写历史。开发与游玩Session分开。

真实调用揭示并修复了模拟Provider不能代替验证的两类边界：

- 0.1.0将全部任务数据承载为system消息，Gemini返回缺少contents的上游错误。相同最小测试改为user成功。0.1.1改为Role系统指令＋任务participant turn，新增编译输入测试修复前失败、修复后通过；不向Abyssa加入Provider分支。
- 0.1.1小模型1024输出额度不足，且scy-a在choice的`finish_reason`之后追加隐藏传输状态，导致严格JSON拒绝。4096额度实测能得到摘要；通用Chat Completions适配器按choice终止边界处理尾部delta，保留终止chunk正文、usage和error，不按HTML或供应商名删字。0.1.2提升Updater额度、明确记忆ID和猜测／未来打算边界；没有关闭小模型推理，也没有放宽状态patch校验。
- 文本复核发现“不能证明全清”被扩写成“说明正道没清”。0.1.2基础预设明确未知不等于否定，禁止这一无依据推断。既有失败版本不被当作合格样本。

可复验工具：[`verify-airp-live.mjs`](../../scripts/verify-airp-live.mjs)现必须显式`--allow-live --max-model-calls 12`（上限可降低，不可在恢复时提高），从通过完整重放校验的测试档经真实命令生成、逐句阅读、确认并续写；每步持久化journal、调用预留与精确Release／Session身份。恢复同一请求不重新生成失败楼层；发生上游失败先检查证据，不盲目重启。原生证据由只读[`inspect-airp-live.mjs`](../../scripts/inspect-airp-live.mjs)保存；[`verify-airp-live-browser.mjs`](../../scripts/verify-airp-live-browser.mjs)使用正常导入入口检查冻结正文并拦截API POST，不发起新生成。

0.1.x真实结果保留在历史验收报告，不作为0.2.0新分工验收。

## 13. 纯文字创作与小模型后处理（2026-09-10）

应用升级为0.2.0：`outline`（Claude，大纲纯文字）→ `writing`（Gemini，纯正文）→ `formatting`（DeepSeek，JSON封装）。`confirm-scene`仍在实际阅读后使用独立DeepSeek Updater。本轮不新增玩法变量权限：当前小模型只可更新本次已读记忆的summary；奖励、任务终态、资产与关系阶段仍归程序。

通用补充在rp：Workflow可声明JSON值Schema、列表字段约束、上游正文保真约束和专用retry feedback Port。校验错误保留为失败Run；反馈包含上一轮原文、错误和Run ID，作为不可变system Entry与下次Run在同一事务入库。重试沿用原生ordinal／retryOfRunId，最多两次格式化尝试，不添加前端重试循环、后台Agent或AIRP专用路由。

格式化只允许去掉声明的行首说话者标签及调整空白；字词、标点、顺序不得增删。语法、未知字段、14词枚举、长度、旁白neutral及正文改写错误都在后端检查。前置说明为简短可见的作品检查记录，不是隐藏推理，不进入记忆正文。

Abyssa仍核对原生终态、来源和原存档身份。历史字段`writingPipelineVersionId`表示最终结果生产者：0.1.x指向writer，0.2.0明确映射formatter。旧Release／旧存档不静默迁移；HTTP等待上限调整为300秒，取消／结果不明仍走原身份查询，不新开一次生成。

当前测试与实际安装、验收结论统一记录在[三段流验收](../audits/2026-09-10-airp-three-stage-acceptance.md)。

0.2.0真实联调两场生成都通过，但第二次记忆提交连续将`path`写为`pointer`，被原生结构校验拒绝；9次模型Run中7完成、2失败，不能报为完整闭环通过。0.2.1补上通用State Updater的可选feedback Port：原始可信正文／State／policy不变，格式失败反馈上一轮原文及具体错误，原生有限重试；语义越权拒绝仍不重试。反馈与Run原子入库，故障样本与旧Release完整保留。应用预设明确`op/path/value`，不让程序转换错误字段。

## 14. 第一批：0.3.0客户端兼容（2026-09-12）

先补失败用例，复现0.3.0版本拒绝，再将Release／Runtime白名单与最终输出资源选择合并为同一张明确兼容表：0.1.x仍选writer，0.2.x和0.3.0选formatter。未知版本拒绝；保存字段、Package／Release hash、Result和Checkpoint校验不变。

核对0.2.1与0.3.0后确认原生成／确认／丢弃合同及三段流不变。人物／场景改由冻结Resource消费；新增修订动作不自动向玩家开放。只修改Abyssa会话适配与回归测试，没有改rp通用宿主，也未把27份资料全部注入Prompt。

当前源码应用包、真实玩家命令、原AVG、读后记忆、后续召回及writer／Updater重启恢复已通过隔离复验。分项数量、旧版本边界与版本组合统一见[第一批验收报告](../audits/2026-09-12-airp-package-compatibility.md)，不与此前真实Provider测试混记。

本轮不安装真实0.3.0、不改默认内容9、不迁移存档。后续按推进计划第二批做药箱资料接线；AIRP-4的文学质量、公开部署和多人物扩展仍未完成。

## 15. 第二批：0.3.1药箱资料接线（2026-09-12）

采用可移植的Package默认资料：现有世界／艾洛拉／对白／玩家边界4份来源，审定11个逐字摘录，记录SHA、位置与本场适用范围。原27份用户草稿不重导、不改写，不把本机UUID写进应用。人物／公共场景供Outline和Writing，新增对白规范只供Writing；三个Resource作为participant参考，不替换system规则。Format／Reformat只取精确上游文本，Updater只在实际阅读后取可信正文、授权State和policy。

处理原世界概述与人物档案的出身冲突，本场不叙述身世；排除私密关系、世界内幕与其他人物原文对白。共同生活只作公共基线，不当作特定共同记忆或关系等级。游戏事实权威、选择／结果区分、两场及有界记忆容量不变。

包版本0.3.1、艾洛拉资料版本2；客户端显式接纳新版本并保持最终formatter映射及精确身份检查。没有改Program／State／Action合同或通用宿主。写作规范属于instruction，不开放包内资料派生；人物／场景保留既有原生派生政策。

原输入预算不增。最大24条必需玩法事实、两情境／不同选择、读前无记忆与读后召回、资源阶段隔离、源码来源核对及玩家恢复通过隔离测试。完整分项、版本hash与待试读事项见[第二批验收](../audits/2026-09-12-airp-source-context.md)。本批工程完成不代表整体退出：尚无0.3.1真实模型合格文稿、等待时间或费用结论，未自动进入第三批。

## 16. 第二批接续：本机安装与真实试读（2026-09-12）

已按用户确认备份主库、安装相同hash的0.3.1，通过原生Upgrade V2 plan／apply接入Abyssa主应用；保留原英文槽标签、图标、3个模型绑定和27份用户资料。6个旧Release逐项核对不变，旧玩家档不迁移。当前独立验收Release为`0.3.1-acceptance.2`，`9e28521b-b580-44b4-a4f0-c08fcb48436d`；名称仅标识用途，不表示验收通过。

首轮0调用失败源于通用Evidence V7校验未接受合法Model Slot图标。隔离副本复现后复用`botIconIds`修复可选字段校验，保持hash／未知字段拒绝；36项定向测试与生产／测试类型检查通过。重启宿主后改用新验收Release和独立Session，不重开失败楼层。

撤离C／完成B两组由正常游戏命令构建；实际大纲和正文均返回，小模型Format均遇`UPSTREAM_AUTH`（上游401／403），没有进入JSON修复。共6次真实请求，4次完成、2次授权失败，无隐藏重试；已知22,669 tokens，失败usage未知。两组生成至失败约116／118秒。没有最终场景、AVG试读、已读摘要或后续召回，incomplete仍被客户端正确拒绝。

真实输入验证了人物／场景→Outline与Writing、专门对白规范→Writing、Format只接收冻结上游文字的分工。正文仍有“成功撤回→没有多生枝节”的无依据推断，不能只修授权就宣称通过。下一步先确认scy-a小模型授权／路由，以新包版本有限修正Writing，再于明确预算内补验；不改变Format保真职责，不自动进入四型／多人。

完整备份、版本／会话身份、逐阶段耗时、未读隔离与审读结论见[真实试读报告](../audits/2026-09-12-airp-live-source-acceptance.md)。首轮和第二轮失败证据均保留，未用手工JSON或历史截图替代失败样本。当前8787服务保留，没有公网部署或新前端改版。

## 17. 0.3.2：修正小模型名称与Writing（2026-09-12）

按用户明确名称，通过原生API新增scy-a的`deepseek-flash`目标并绑定到新版本小模型槽，不原地改写旧目标、旧Release、密钥或另两个模型。0.3.2只改变Writing约束及两份参考Resource的排版，Action／Workflow／State和14情绪格式不变；Abyssa精确兼容新包，未知版本仍拒绝。

Writing显式区分撤离与完成，禁止从成功结果推断途中无事；后续承接已确认小事、不重复初次接箱，收束称谓与纯文字分段。新约束不进入Format／Updater。最大事实量回归先捕获预算超限，经压缩重复说明和JSON缩进后通过，4来源／11摘录完整，16,000预算不变。

原生备份后安装至主应用，独立验收Release为`4365084d-07ae-4b76-8528-cf4de1eb723d`。27份用户资源、9个旧Release、两个原模型绑定及用户图标／英文标签保持，旧档不迁移。69项Abyssa兼容、18项rp专项、四项浏览器、跨仓玩家／记忆及恢复回归通过。首轮两次超时已终态取消；用户关注授权并确认继续后，以新身份各封顶11次，完成两情境四场的16次调用、4条读后摘要、原生召回、幂等重放及4场真实AVG。加上取消共18/24次，无残留running；已知74,193 tokens，取消usage未知。实际文稿仍有邀请变成玩家已执行行为、无来源维修价格与后续节拍重复，工程通过不等于内容合格。下一步只修订应用Outline／Writing与骨架，详见[0.3.2记录](../audits/2026-09-12-airp-032-acceptance.md)，不自动进入四型／多人。
