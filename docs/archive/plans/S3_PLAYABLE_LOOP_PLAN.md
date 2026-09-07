> 历史档案：2026-09-07文档整理时归档。原路径：`docs/plans/S3_PLAYABLE_LOOP_PLAN.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# S3：Abyssa 独立玩家闭环计划

日期：2026-09-05。状态：**E0–E6 已完成实施与本地验收**。实际交付与证据见 [S3 实施验收](../audits/2026-09-05-s3-implementation.md)。

本轮入口：[S3 审计与探针证据](../audits/2026-09-05-s3-playable-loop.md)。前置交付：[S2 实施验收](../audits/2026-09-05-s2-implementation.md)、[应用服务契约](../../../src/game-application/README.md)、[浏览器装配](../../../src/game-runtime/README.md)。

## 1. 目标与阶段边界

S3 要让玩家在同一档案中完成：新建/继续 → 洋馆或菜单 → 地图编队 → 出征 → 战斗 → 终局入账 → 返回洋馆查看真实收益与经历 → 再次出征。关闭页面、刷新、双击、旧标签页和动画中断不能丢失已提交进度或重复增加资产。

Abyssa 负责这条循环的全部规则、存储、库存、事实与结算。此阶段不需要模型配置，也不调用 rp-style-lab。未来的模型只通过应用端口消费已提交事实，不能绕过游戏命令改变状态。

这是“以既有规则验证生产底座”的阶段，不等于最新 DEMO 内容全部实现。沿用 `abyssa.legacy/contentVersion=1/rulesVersion=1` 和 `legacy.rift`；新战术骰面、玛丽埃塔、庄园副本及经济配平另行排期。不得更改冻结 Catalog 内容却沿用原 digest。

### 1.1 本阶段交付

| 交付 | 最小可验收结果 |
| --- | --- |
| 档案入口 | 新建不覆盖旧档；继续与记录从应用服务读取；导入落新档，导出可回读 |
| 统一会话 | 六个主流程页面消费同一 saveId/epoch；刷新只读并恢复必要收尾 |
| 真实编队 | 凯尔加 1–4 名已实现伙伴；顺序、骰子、目标、动画与实际成员一致 |
| 持久战斗 | 每个权威命令成功提交后才呈现结果；可恢复而不依赖动画播放完 |
| 一次结算 | 主动离场、全灭、最终层完成都进入同一终局协议；回馆后资产一致 |
| 回馆经历 | 读取 ledger 与有效事实，说明这趟远征发生了什么；可立即再次出征 |
| 可选反应 | 复用本地 AI Port 或静默降级；无论反应是否成功都能完成游戏 |

### 1.2 非目标与正式页面策略

- 不实现新角色规则、新副本、托管出征、七件新常备道具、完整设施经营、交易/鉴定、云存档、用户账号或网络同步。
- 新档使用 S2 现有默认：第 1 天晨、资金为零、容量 32、旧五人、空物品与装备。它是本阶段兼容流程的初值，不宣称为正式经济定稿。
- 正式 Mansion 显示 Campaign 资金、时间、库存与远征经历。生产领取、设施修复/升级、手动推进经营相位暂不开放；页面明确说明“建设与生产尚未开放”。原型经营交互可留在 Storybook/测试演示，不挂在正式档案上。
- 正式 Shop 显示真实余额与“交易尚未开放”，停用买卖、砍价与鉴定。样本商品不得作为玩家已持有物或可交易库存。先不把旧 G 换算为里拉。
- Mansion 的出征入口改到 Map；码头骰局保留为独立演示，退出正式经济链路。角色资料可继续作静态阅读，不把展示伤势/未实现骰装当作可用性依据。
- 继续保留四套战斗皮肤、标题素材、立绘与既有转场。正式版不通过 query 参数偷偷回到本地自动开局；演示入口和测试依赖显式注入。

这些是本计划的实施边界，不修改[设定与定稿状态](../snapshots/DESIGN_DECISIONS_AND_CURRENT_STATUS_BEFORE_CONSOLIDATION.md)或[系统盘点](../snapshots/GAME_SYSTEMS_AND_CONTENT_SPEC_BEFORE_CONSOLIDATION.md)。

## 2. 审计形成的实施顺序

审计 A01–A12 的优先级与源码证据见配套文档。顺序固定为：

1. 先补公共客户端所有权、只读视图与恢复协议，再接页面。
2. 接档案、导航、实际编队，确认所有入口能定位同一持久记录。
3. 替换 Battle 状态所有者与演出输入，接通终局和回馆。
4. 增加真实浏览器的跨页、中断、并发验收，再完成整体验收。

不得以“旧页面能挂载”“application 单测通过”代替步骤 3–4。

## 3. 目录与依赖设计

保留多 HTML 入口，不引入 Router、全局状态框架或新 monorepo。本阶段默认不增加第三方依赖。

```text
src/apps/{title,menu,map,battle,mansion,shop}
       ↓
src/game-client/             React 会话、命令协调、导航、请求恢复
       ↓
src/game-runtime/            浏览器装配、按 Catalog 生成只读视图
       ↓
src/game-application/        权威命令、CAS、回执、档案与事实投影
       ↓
src/game-core/               纯规则与三层状态

game-runtime → game-infrastructure（IDB / LocalReactionPort）
game-runtime → content/gameplay（冻结 Catalog）
apps / game-client → shared（纯 UI、转场、展示工具）
```

新增 `src/game-client` owner，不能放进 `shared`。建议落点：

| 文件/目录（拟新增） | 责任 |
| --- | --- |
| `src/game-client/session.ts` | 管理最近一次已验证记录、加载代次、in-flight 命令、错误、订阅；不持有第二份可写规则状态 |
| `src/game-client/react.tsx` | Provider、hook、加载/错误壳；StrictMode 安全创建/清理会话 |
| `src/game-client/navigation.ts` | 解析/生成档案定位 URL、页面守卫与返回目标 |
| `src/game-client/pending-request.ts` | 有界待确认 envelope 的保存、校验与清理；用于复用 requestId |
| `src/game-client/resume.ts` | 驱动既有命令完成必要收尾；与视觉队列无关 |
| `src/game-client/content-view.ts` | 将规则可用名单与展示名称/立绘组合，未知展示资产有兜底 |
| `src/game-runtime/views.ts` | 已验证记录 → Campaign/Battle/出征能力视图；具体文件可按职责拆分 |
| `src/game-application/history.ts` | 玩家可读经历投影；与当次 AI 事实投影分开 |

门禁同时调整 `scripts/lib/module-boundaries.mjs` 与 `tests/build/module-boundaries.test.mjs`：

- client 可依赖 runtime、shared、展示 content/assets，以及 application/core 的公共类型；运行时规则选择经 runtime 暴露。
- client 不直连具体 adapter，不导入 app/tool；apps 不互引、不直连 adapter。
- core/application/runtime/adapter/content/shared/tool 不反向依赖 client；既有纯核环境门禁继续生效。
- 正式主流程写操作只能经客户端调用 application。旧 `legacy-battle` 兼容导出保留给旧测试/显式演示；增加定向 AST 检查，阻止生产控制器调用 createExpedition、旧 dispatch 或敌方内部逐步命令。
- 所有新文件进入 typecheck、对应 Vitest 项目和依赖审计；UI 包发布不包含 client 或游戏存储。

## 4. 会话与页面定位协议

### 4.1 URL 与档案选择

采用相对路径，保留 `/` 和 `/abyssa/` 两种部署路径。例如：

```text
menu.html?save=<saveId>&epoch=<epoch>
map.html?save=<saveId>&epoch=<epoch>
battle.html?save=<saveId>&epoch=<epoch>&expedition=<expeditionId>
mansion.html?save=<saveId>&epoch=<epoch>
```

URL 只携带定位，不带完整状态、seed、余额或 revision。每次挂载通过 `application.open(saveId)` 读取并核对 epoch。battle 中 expedition 用于识别旧战斗链接和已结算结果，不能默默切到另一次远征。

“最近选择档案”可以用 localStorage 保存 `{saveId, epoch}` 提示；它不决定真实存档存在性，不以最大 revision 作为最近游玩的跨档排序。多个档案无有效最近记录时展示选择。记录页暂用短 ID 与游戏内时间/状态命名，不为此引入存档重命名、删除或新的持久 schema。

`SceneTransitionProvider` 只消费已生成的相对 URL、转场文案；sessionStorage 的黑幕交接继续只是表现信息。所有正式链接集中经导航 helper 生成，不能继续散落裸 href。

### 4.2 生命周期与状态

客户端状态至少包含 `loading / ready / submitting / recovering / error / disposed`。Battle 另有 `presenting` 视觉状态；输入可用性同时取决于命令合法性、客户端是否可写、动画是否占用。

- runtime 随页面会话创建，组件重渲染不重复创建连接；卸载取消视觉与反应任务并关闭连接。
- 加载、切档、重试带 generation；过期 promise 不发布到新页面。异步 finally 不得解除后继请求的 busy。
- 正式页不持有 `setCampaign`、`setFunds` 等权威 setter；React 只缓存最近读取的不可变记录与纯视觉状态。
- 一个客户端同一时间只允许一条手动命令；提交按钮先锁定，再 await。别的标签页仍由 CAS 决定先后，不靠前端锁保证原子性。
- 可使用 BroadcastChannel 发 `{saveId, epoch, revision}` 失效通知；收到后重新 open，不接收对方传来的状态。`pageshow`、页面重新可见时重读；不支持通知时 CAS 仍保证安全。

### 4.3 入口守卫

| 读取结果/页面情形 | 行为 |
| --- | --- |
| 缺 save/epoch | 展示进入档案入口；不自动新建，不猜测活动档位 |
| 定位格式错误或 epoch 不符 | 明确显示档案定位失效，允许选择有效档案 |
| not-found | 回 Title 选择或新建；不删除其他档案 |
| 存档损坏/缺内容 | 保留数据，显示原因、诊断导出入口；不以默认状态覆盖 |
| IDB blocked/aborted/quota/unavailable | 不进入成功画面、不用内存模式冒充保存成功；提供有针对性的重试 |
| menu/mansion/map 读取到活动远征 | 显示“继续远征”；禁止新 start；若已终局待入账，引导去结算 |
| battle 没有活动远征，但 URL 对应 ledger | 显示该次已入账结果与回馆/编队入口 |
| battle 无活动远征且没有对应结果 | 返回编队提示，不自动开局 |
| URL expedition 与当前活动远征不同 | 显示旧链接状态，允许显式继续当前远征；不丢弃当前记录 |
| 浏览器返回/前进/BFCache 恢复 | 重新 open 并应用守卫，不恢复过期可写画面 |

档案 list 是索引提示，不是完整校验结果。打开每个档案仍用 open 校验。本轮确认现有 list 对缺少 snapshot 的记录会整体失败，故 E1 增加最小枚举契约：存储端口枚举实际 save key，应用逐档读取/校验，列表返回带 saveId 的 ready/unavailable 项；存储整体不可用仍是顶层错误。两种 store 及调用方一起更新，不改 GameRecord 持久格式，不把坏档静默丢弃或搬到页面猜测。

## 5. 命令提交与恢复

### 5.1 手动命令顺序

1. 从当前 verified record 生成 envelope，固定 `clientRequestId` 与 `expectedHead`。出征同时固定 expeditionId/seed，新建固定 saveId/epoch。
2. 把待确认 envelope 作为请求元数据保存，再调用应用服务；它不是可恢复的权威快照。客户端最多保留当前未确认操作，按档案/页面会话隔离。
3. 只有 `ok=true` 且事务已完成，才报告成功；随后 open 读取最新记录。
4. 存储失败/结果不明时，原 envelope 可原样重试。业务拒绝已获得确定回执后清理；若用户基于新 head 决定重新操作，生成新 requestId。
5. 刷新发现待确认请求，先核对档案，再原样重放以获取已提交/已拒绝回执或在原 expectedHead 上完成；不换 head 自动重发同一个动作。损坏元数据只丢弃元数据，再读取权威记录。
6. 元数据存储失败发生在 dispatch 前，阻止该次提交并显示重试；不发送请求后再声称已具备刷新恢复能力。成功处理后清理，清理失败时重复恢复也只得到同一回执。

请求元数据可以使用 sessionStorage，不能与地图旧 `abyssa:sortie-order:v1` 混用。跨页业务交接只认应用存储；另一标签页不消费本页未提交意图。导入文件不长期复制进客户端元数据；导入响应丢失后通过固定目标 saveId/epoch 重开确认，必要时由用户重新选择同一文件并复用原导入身份。

### 5.2 必要收尾独立于动画

不修改 `open` 的只读语义，也不改变旧核心命令语义。增加受控协调器，用 runtime 的纯状态选择器决定下一条已有应用命令：

| 已持久化状态 | 下一步 | 完成后 |
| --- | --- | --- |
| enemy-turn，outcome=null | `application.resumeEnemyTurn` | 继续检查是否还需 next-round/终局显示 |
| enemy-turn，outcome=continue | `battle-command: next-round` | awaiting-roll；等玩家掷骰 |
| player-turn，规则 selector 返回 layer-cleared | `battle-command: end-turn` | exit-choice 或最终层 finished |
| awaiting-roll / 普通 player-turn | 无自动命令 | 等玩家操作 |
| exit-choice | 无自动命令 | 玩家选择深入或带宝离场 |
| finished + pendingSettlement | 无自动深入/重开 | 显示终局，执行第 8 节结算流程 |

协调器在 Battle 加载以及每次命令后运行；根据最新 head 生成稳定的收尾 requestId（包括 save/epoch/revision/命令类别的确定性摘要），每步再次通过应用校验和 CAS。冲突后读取并重新分类；存储错误停止在可重试状态，不无限循环。设置有限收尾步数，超限作为不变量错误报告并保留诊断。

这些步骤可以形成数个持久提交，保证每个中间状态都能恢复即可；不为追求单次大事务重写 S2。正常流程完成必要提交后，把可验证连续的回执序列交给演出。两次提交之间关闭页面，再次进入会按同样条件补齐。

清层动画 ack 只解除遮罩/视觉等待；不会再发送 end-turn。若清层收尾提交失败，界面显示保存重试，不等待动画来“补救”。

## 6. Map：按真实能力出征

可用角色 = Catalog 已实现且在 Campaign.availableCharacterIds 中。读取展示资源只为名称、头像、立绘，不读取展示伤势、占位骰装来决定是否可出征。

- 首版固定亲征，领队凯尔不可移除；伙伴来自 eustice/elora/kororo/norma，至少一人，总人数 2–5。托管入口禁用并说明尚未开放。
- 保留地图和编队布局；生产面板的骰面预览必须来自当前规则视图。新战术花色/牌型预览若无法准确映射旧规则，先用旧规则可读摘要替代，不能强制转换成另一套骰面语义。
- 唯一可执行路线是 `legacy.rift`。拟把现有 tower 交互位置作为“裂隙远征”入口，替换侧板占位敌情/收益文案；church/cave 保留景观但不出征。它仅是旧兼容路线的入口位置，不代表哨塔怪物或庄园内容已定稿。
- Map 提交完整 start-expedition，再重读确认 expeditionId、routeId、party 顺序后导航。写入失败停留在编队；双击复用同一 in-flight；另一标签页已出征则显示继续入口。
- 移除正式出击令 sessionStorage 写入路径，旧键不作为 Battle 输入；临时编队草稿可丢失或作为非权威偏好缓存，重新打开时重新验证。
- 初始库存为空时允许空道具出征。对已有/导入档的实例，可选取应用已支持的 itemIds/equipmentIds；只展示真实存量和有效所属人，不能凭静态产品生成实例。领用、消耗、装备带回仍由 S2 保管协议处理。

## 7. Battle：已提交结果的演出

### 7.1 视图与规则入口

`createBrowserGameRuntime` 增加只读内容/战斗视图能力，传入已验证记录，按该记录的 Catalog、route 与 party 顺序生成。复用纯核的查询函数；必要时补公共只读 selector 导出，不把整套含写方法的 legacy bindings 交给页面。

视图至少覆盖：phase/status/outcome、骰面/质量、合法目标、装载/撤销/重掷能力、意图/威胁、当前层与收益摘要、出战角色顺序。页面组装命令可以使用这些结果，最终合法性仍由应用/规则层判定。

`ExpeditionDicePanel`、`battle-view-model` 的锚点、Visuals 初始化与 rolling 收尾全部改用实际 party/dice 顺序。角色 ID 是字符串；不能假定所有展示角色都在本局或固定五个槽。

### 7.2 三类状态

| 状态 | 所有者 | 可否写入游戏存储 |
| --- | --- | --- |
| durable record/head | application + store | 只有应用事务可写 |
| verified client view | game-client 最近读取缓存 | 不可作为新权威快照回写 |
| presentation view | Battle 动画：血量过渡、命中、骰子旋转、目标暂存 | 不写入存档，不参与新命令合法性 |

演出输入是“前视图 + 已提交回执序列 + 后视图”。正常收据应连续：第一条 before 与演出前 head 相同，后续 before 等于前条 after，最终读取 head 等于末条 after。先检查 saveId/epoch、expeditionId 和内容身份，再构建视觉队列。

若读取已前进、收到跨页失效、回执重放或缺少准确前视图，则直接安装最新视图、清除旧目标和演出，不把过期事件播到新局上。首版刷新不恢复半段动画，也不要求回放历史动画，因此不需要新建永久演出日志或给所有回执附完整快照。

### 7.3 事件播放与取消

- 保留 receipt 数组顺序；`sequence` 只在其声明的事件范围内使用，不将多份回执的局部 sequence 混排。恢复批次中的组合事件也保留返回顺序。
- 一批 end-turn 可含多条 enemy-intent-resolved。按行动与 cause/batch 建立多个 cue，不直接复用只返回第一条的 getEnemyTurnCue。
- 使用事件携带的 hpBefore/hpAfter、伤害、治疗、护盾等更新视觉值；无法覆盖的效果在阶段边界安装后视图。不要在 UI 复制伤害算法或为演出再次 dispatch 消耗 RNG。
- 层收益、掉落和金币从已提交结果展示；清层延时可以保留，但只是推迟显示，不能再产生第二笔入账。
- `wait` 的取消与卸载必须 resolve(false)，所有挂起 continuation 有出口；runId/generation 防止旧动画写到新状态。
- reduced-motion、切后台、卸载、外部 head 前进可以跳过演出，游戏存档不受影响。演出未结束时默认禁用新的战斗输入；撤销要先结束/取消旧视觉批次，再提交 application 的顶层 undo。

目标拿起/放下、hover、皮肤切换是纯 UI，不生成游戏事务。装载骰子、掷骰、重掷、行动、撤销、深入、离场都是权威命令。

## 8. 终局、回馆与真实经历

终局继续放在 battle.html 内，不新增结算 HTML。必须区分：`terminal-unsettled → settling → settled`，保存失败留在可重试的终局。

1. finished 读取 pendingSettlement 的 expeditionId/terminalRef，展示引擎结果，并提供“结算并返回洋馆”。
2. 点击后提交 settle-expedition。相同点击/重试复用原请求；在交易完成前不展示“已入账”、不跳馆。
3. 应用确认成功后重读 Campaign，以 ledger 中该 expeditionId 的条目为结果；然后跳转 mansion。若返回响应丢失，刷新从存档识别未结算或已结算。
4. already-settled 或 conflict 后重新读取并定位相同 expeditionId 的 ledger；存在则展示已入账，不能再次手动加钱。不存在则保留冲突/重试提示。
5. “再次出征”去 Map 重新编队，只有新 start-expedition 才创建新 expeditionId；不直接调用旧 restart。

主动离场、全灭、最后一层通关都使用该协议。S3 沿用旧规则对本趟收益的处理；不扣洋馆旧存款、不写永久伤势、不引入新的治疗成本。

洋馆显示同一 Campaign 的 funds、clock、inventory，结算 ledger 展示最近一趟收益和深度。时钟本阶段无自动经营推进；不能将展示相位切换写入 Campaign，或伪造一次远征消耗几天。

玩家经历增加单独的只读投影：按 save/epoch、expeditionId 和已提交 revision 范围筛选；排除 simulation、internal、撤回事实；遵守 player/party 可见性。文本采用事实摘要模板，不把旧 log 字符串当作权威经历，不编造伙伴态度。缺少可展示事实时只显示已结算结果。

历史投影保留来源信息以支持导入档与撤回；旧 `projectFacts(record, actorIds, source)` 的当次 AI 语义不放宽。

## 9. LLM 接缝与本地反应

S3 在提交后的呈现侧调用 runtime.createReactions。推荐在终局入账或回馆的当前提交上触发一次本地反应；actorIds 取有效参与者，不把所有洋馆 NPC 默认视为见证者。

- cue 绑定 head/expedition/scene，换档、撤销、再次出征或离场取消旧任务；以现有 coordinator 的接纳结果为准。
- 反应无资产、规则、库存写权限；失败/超时/空结果跳过，结算与导航不等它完成。
- 经历列表能独立工作；将来需要跨多次提交的模型上下文时，在 S4 扩展受控上下文投影，不在页面拼整个 GameRecord 发给宿主。
- S3 不新增 HTTP/SSE、Provider、模型密钥、Model Slot、Pipeline 或宿主 Session。rp-style-lab 停止运行时验收结果应相同。

## 10. 分步实施清单

各步都必须有可运行结果，不能只建空目录。预计改动以职责为准，具体拆文件时不突破依赖边界。

| 步骤 | 主要落点 | 出口条件 |
| --- | --- | --- |
| E0：冻结接线约束 | 本计划、`scripts/lib/module-boundaries.mjs`、边界测试、client README | 新 owner 的正反例门禁生效；生产流程/演示流程与路由表明确 |
| E1：客户端与只读视图 | `src/game-client/*`、runtime/browser/views、必要的 core 公共 selectors、application/history 或索引契约 | IDB 会话可 create/open/dispatch；原请求重试、过期读取、恢复三态、坏档隔离可测试；app 不直连 store |
| E2：档案和导航 | Title/Menu、主流程 entry 壳、navigation helper、`config/entries.mjs` | 新建/继续/记录/导出/导入可用；所有正式页面定位一致；裸链接不自动开局 |
| E3：真实出征 | MapPage、useSortie、sortie-model/roster/quests、出征实例选择 | 2–5 人实际编队与 start 一致；只开放 legacy.rift；失败不跳转；活动远征不重复创建 |
| E4：持久战斗与演出 | Battle App/Screen/controller/presentation/view-model、resume 协调器 | 无旧本地规则写入口；三类收尾可恢复；整批敌方演出、动态人数、取消与新 head 处理通过 |
| E5：结算与回馆 | Battle overlays、MansionPage/estate 接口、MenuTopBar、Shop、history/本地反应 | ledger 唯一入账；同一资金/库存；真实经历；无样本交易；可第二次出征 |
| E6：产品验收与交接 | `tests/smoke/*`、工程门禁、controller/runtime/client README、实施审计 | 下节矩阵通过；构建/发布/兼容检查完成；列明远端 CI 状态和仍未实现玩法 |

E1 不要求扩充 CommandReceipt 存档格式。若实施发现必须变更持久 schema、Catalog digest、公开命令语义或经济规则，应先把实际原因、迁移路径和兼容影响记入本计划，再实施；普通视图/文件拆分无需另设批准流程。

## 11. 验收矩阵

### 11.1 必须新增或改写的自动化

| 场景 | 核心断言 | 建议层级 |
| --- | --- | --- |
| 新档/继续/多档/导入 | 新身份、旧档不变、正确定位；损坏档仍可诊断且不阻断好档 | client + 实际浏览器 |
| 出征双击与导航失败 | 一次 start、一个 expedition；原 seed/party；可继续已保存远征 | client + 浏览器 |
| 2/3/5 人和变更顺序 | 人物、骰槽、目标连线、动作归属一致；未选角色无行动槽 | 组件 + 浏览器代表场景 |
| 道具与装备实例 | Map 领用后营地库存移出；终局按旧规则带回/消耗；无复制 | 应用回归 + 浏览器已支持实例样本 |
| 攻击命中前刷新 | 已提交 HP/RNG 保持，旧动画不重放规则 | 浏览器 |
| 多敌人动画中刷新 | 批次只执行一次；下一轮可继续；无只播放首敌的错误 | 组件 + 浏览器 |
| 最后击杀后中断 | 能从 player-turn 全灭盘面收尾；无重复层收益 | client + 浏览器中断样本 |
| enemy-turn/outcome=null 导入恢复 | 仅继续剩余 cursor，进入合法后继状态 | 应用既有回归 + 浏览器 |
| outcome=continue 但未 next-round | 恢复后 awaiting-roll，RNG 不重复消耗 | client + 浏览器 |
| 取消/卸载/reduced-motion/StrictMode | Promise 完成、无旧任务发布、不重复开局/发命令 | hook/组件 |
| 成功后读取更高 head | 丢弃旧演出、显示最新状态，不将旧 after 当当前值 | client + 双页浏览器 |
| 主动撤离/全灭/通关 | 各自有正确终局，均经同一 ledger 一次入账 | 应用 + 至少代表性真实 UI 全流程 |
| 结算前后刷新/双击/响应丢失 | 未结算可重试，已结算可回馆，余额与 ledger 唯一 | 浏览器 |
| 双标签页同档竞争 | 同 expectedHead 至多一方推进；另一方明确刷新；不自动重发用户行动 | 实际 IDB + 浏览器 |
| undo 与事实 | 已撤回事实不进入经历/反应，旧 cue 失效 | 应用 + client/组件 |
| 存储失败 | 无伪成功/跳页/内存降级；原请求可安全重试 | 存储契约 + client + 浏览器故障注入 |
| 洋馆/商店样本隔离 | 显示真实 funds；不出现样本交易对玩家资产的假承诺 | 组件 + 浏览器 |
| 无 AI 的完整循环 | Title→Map→Battle→结算→Mansion→Map→新远征，跨页同一 save/epoch | 真实浏览器，禁外部 AI 请求 |
| 根路径与子路径 | 完整链路及 back/forward/reload 均保留定位 | `/` 与 `/abyssa/` |

浏览器主验收必须实际点击 UI。定向恢复测试可通过正式导入 API/测试专用 fixture 准备罕见状态，并明确标为中断样本；不能只在页面 evaluate 中调用服务然后声称玩家闭环通过。固定 seed 的测试入口只存在于测试注入，不从正式 URL 接受任意状态。

通过条件以状态与因果断言为准，不追求新增测试数量。旧组件测试中“命中帧才写权威日志”“五人固定”“裸页自动开局”等断言应改成视觉契约或显式演示测试。

### 11.2 实施验收命令与顺序

```sh
export PATH="/tmp/abyssa-s0-toolchain/node-v22.23.2-darwin-arm64/bin:$PATH"
export ABYSSA_BROWSER_EXECUTABLE="/Users/liuhang/Library/Caches/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-mac-arm64/chrome-headless-shell"
npm run typecheck
npm run boundaries:check
npm run check:entries
npm test
npm run check:core:import
npm run test:build
npm run build:game
npm run check:output -- game
npm run test:smoke -- --project=game --project=storage
npm run build:entries
npm run release:check:ui
npm run build:lab
npm run build:tools
npm run test:smoke -- --project=workbench
npm run check:auxiliary
npm run build-storybook
```

以上脚本已按当前 package.json 核对。工程测试可能重建 dist/game，必须在完成构建后固定产物再跑浏览器，不能与浏览器并行重建。新导航依赖使独立入口闭包变大属于预期，仍检查 18 个入口与 UI 包内容。

保留旧 956 步轨迹与 124 运行时导出回归；S3 的动态编队测试是新增消费验证，不重录旧黄金样本掩盖行为变化。远端 CI 只有实际运行才记为通过。

## 12. 完成定义与交接

- [x] E0–E6 全部有实现与证据，主流程生产源码不再使用本地旧规则写入口。
- [x] 档案、导航与所有守卫可用；同档 IDB 是唯一权威数据源。
- [x] 真实编队、持久战斗、终局一次结算、回馆与第二次出征通过 UI 验收。
- [x] 所有必要收尾可从持久态恢复；演出取消与旧 head 不再影响规则。
- [x] Menu/Mansion/Shop 资金一致，未实现经济有明确边界，没有多套钱包。
- [x] 事实、撤回、本地反应可用，未耦合 rp-style-lab 的内部协议。
- [x] 工程/兼容/构建/发布检查通过，保存截图/trace/日志与本地、远端的实际验证范围。
- [x] 更新本计划实际交付章节，新增 S3 实施验收；未实现内容转成明确后续项。

S3 完成后，S4 可以替换 AI Port、扩展受控上下文与宿主适配。新的战术内容与经营规则可以按各自 Catalog/应用命令演进，不需要先把游戏规则搬到 LLM 管线中。

## 13. 本轮规划交付记录

已完成页面与服务静态审计、14 文件/178 项定向回归和 7 组临时探针，实测确认敌方批次/下一轮分界、清层收尾、回执迟读、一次结算、再次出征、坏档列表隔离及取消等待缺口。模块边界与 18 入口门禁通过，详细结果见配套审计。

以上为实施前的规划交付记录，当时仅变更文档与忽略目录中的检查产物。后续新目录、页面接线、恢复逻辑与验收见 [S3 实施报告](../audits/2026-09-05-s3-implementation.md)。

## 14. 实施中的明确调整（2026-09-05）

- `resume.ts` 合入 `GameSession`，内容视图分别放在 runtime/views、runtime/battle-view 和 Map 的 live-roster，避免为规划中的文件名制造空壳。
- 保存列表改为 Storage Port 枚举真实 key（listSaveIds），application 逐档校验与隔离；不改变持久 schema。
- 实测确认 frozen legacy-v1 只含 action/status，没有 item/equipment 定义。正式 UI 接入库存实例选择与所属成员校验，但不伪造可领用样本；实例的保管权/归还由现有测试 Catalog 验证，真实物品定义留内容阶段。
- 回馆时 active expedition 已移除，S2 AI coordinator 原来只允许活动队员，因此本地反应会被拒收。S3 收窄扩展为：仅当前 head 可见的 expedition-settled Fact，且 settlementId 可在 ledger 查证，才授权该次事实见证人；request 继续绑定原 expeditionId、当前 head 和 scene。原 projectFacts 仍只投影当前提交，未扩展跨提交模型上下文，也没有修改存档格式或 AI 响应协议。
- 实际浏览器发现 3D 骰面投影拦截相邻按钮点击；修复装饰面的 hit testing，不改变骰面美术或规则。

## 15. 实际交付与 S4 交接

E0–E6 全部完成。正式 Title/Menu/Map/Battle/Mansion/Shop 共用持久档案，真实 2–5 人编队进入 legacy.rift；战斗先提交再演出，终局按 ledger 一次入账，并能回馆后再次出征。旧链接、刷新、原请求重试、CAS 冲突与三类必要收尾有对应验收。

本地结果：90 文件/777 项单元与组件测试、66 项工程测试、36 项游戏/存储浏览器与 10 项工作台浏览器通过。最终档案弹窗 CSS 修正后重建 game，并另做 1 项档案流程定向复测与截图检查。四类构建、18 独立入口、UI 发布契约、辅助脚本与 Storybook 均通过。保留 956 步冻结轨迹、124 兼容导出与 681 个保护路径；远端 CI 未执行。

S4 可以从 [game-client 协议](../../../src/game-client/README.md) 与 [应用 AI 契约](../../../src/game-application/README.md) 接入模型端口，扩展受控上下文、取消与来源失效处理。Abyssa 的命令、RNG、库存、存档和结算继续独立运行。托管、新战术骰/角色/副本、真实道具内容及洋馆/商店经济仍是明确后续项。完整证据、实施调整和复现说明见 [实施验收](../audits/2026-09-05-s3-implementation.md)。
