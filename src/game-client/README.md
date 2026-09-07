# 玩家会话与流程

Title、Menu、Map、Battle、Mansion、Shop 和 CharacterStatus 共用本目录。应用服务与 IndexedDB 中的 GameRecord 是权威状态；React 会话缓存和 Battle 演出副本都不接受资产 patch，也不执行规则。

## 使用

可发令的正式页使用 `GameProvider` → `GameGate` → `useGameSession/useGameState`。Provider 在 effect 内创建 runtime，StrictMode 清理会关闭连接、订阅和反应任务。组件测试通过 `GameSessionScope` 显式注入真实 Memory 应用会话；正式 URL 没有样本状态或自动开局开关。

角色页使用 `ReadGameProvider` → `ReadGameGate` → `useReadSession/useReadState`。读取会话不消费 pending、不续行战斗、不发命令；同档临时读取错误显示过期状态，身份／内容错误清除旧数据。同 head 成功刷新复用读模型。装备及回忆入口另用 `useEquipmentSession` 建立受命令白名单约束的写会话，仍禁止自动推进活动战斗。两种会话共用 `observe-commits.ts` 的通知协议。

`navigation.ts` 统一生成同源相对 HTML：所有页面携带 `save/epoch`，Battle 和角色页可另带 `expedition`。角色页附带角色 ID、页签及 menu/map/battle 来源白名单；ID 作为 query 编码，允许 core 已接受的 `/`。缺失定位进入档案守卫；旧远征链接显示已有结算或当前远征入口。localStorage 只保存最近档案提示，不能作为存档。

`GameSession.dispatch(command)` 在提交前保存完整 envelope，返回 `CommittedBatch | null`。同一会话只允许一个 in-flight；双击复用同一 Promise。成功批次包含 `before/after/receipts/presentable`；消费者只有在 `presentable` 且当前 head 一致时才播放旧回执。

## 中断和冲突

- sessionStorage 只存一条有界待确认请求（64,000 字符），不存快照。请求确认前保留身份、seed、expectedHead 和参数；响应丢失后原样重试。
- 存储或元数据写入失败会显示错误，不跳页面、不改成内存游戏。诊断导出保留原始档案；用户可重新读取/重试。
- 自动收尾由版本化 continuation 判定，覆盖敌方队列、回合收尾、房间／清层与终局；事件与出口等待用户选择。请求 ID 由 head 与命令确定，每步重新读盘并检查推进；每八步让出事件循环。成功的幂等重放允许 head 不变。
- 页面初次读取仅在 Battle 的 expedition 定位匹配时自动收尾；其他页面可重试自己未确认的请求。过期 Battle URL 不推进另一趟远征。
- 用户动作遇 CAS 冲突不会换 head 自动重发。BroadcastChannel、pageshow、visibilitychange 使会话重新读取；提交期间收到失效通知，会取消旧演出资格并补读。
- dispose 与读取代次阻止迟到任务发布。演出取消只释放视觉定时器，不撤回已提交状态。

## 终局与经历

Battle 明确区分终局候选、正在入账、已入账。只有 settle-expedition 成功且 ledger 中找到该 expedition 才返回洋馆。旧链接、刷新和重复提交都由同一 ledger 去重。再次出征经 Map 创建新 expedition，不能调用旧 restart。

CampaignPanel 显示真实余额、最近 ledger、库存和 `projectPlayerHistory` 产生的经历。历史遵守 save/epoch/revision/expedition、可见性与撤回过滤。本地反应经 runtime.createReactions 重新读取提交记录；绑定 head/场景，离场取消，失败不阻塞导航或结算。rp-style-lab、HTTP/SSE、模型配置和上下文管线不在本层。

## 当前内容边界

新档默认使用规则／应用4、内容3，仍从标题直接进入菜单，初章尚未接入。正式闭环包含庄园初战／维护、刻仪兽回忆、玛亲征开放、十项成长、两件装备和五类战术补给购买。道具最多携带四类：食物／药水可免费配给，其余五类按库存与充能购买。旧档按原内容注册继续运行，不隐式升级。

洋馆建设、生产、升级、手动时间推进，以及商店出售／鉴定尚未开放。完整机制和真实闭环以[当前总览](../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)为准；工程接通不代表难度和剧作验收通过。

依赖门禁允许 client → runtime/shared/展示资源，以及 public core/application 类型；禁止 client → app/adapter 或底层反向引用 client。正式入口的传递闭包禁止 `battle/engine.ts` 与 `runtime/legacy-battle.ts`。导航检查沿生产 import 闭包检查路由表，包含共享导航的返回路径。

实施证据见 [S3 实施验收](../../docs/archive/audits/2026-09-05-s3-implementation.md)。

庄园结局由已提交 terminal／takeover 决定；首通阅读继续／跳过仅确认阅读游标，不重复发收益。终局入账后即使 active run 已清空，匹配该结算 run 的未确认剧情请求仍可重试；不能因此推进另一趟远征。成长／赠物另有显式完成与授予命令，不能把首通阅读规则泛化为所有故事均无结果。
