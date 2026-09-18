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

CampaignPanel 保留游戏导航；MansionUtilityRail 在右边栏纵排仓库、日志、整备三个独立入口，圆章直接复用原仓库按钮的 SVG、尺寸与状态。新版仓库使用 ResourceInventoryDialog 的固定补给＋开放库存结构，旧版 schema1 保留真实容量的 InventoryDialog；日志采用真实条目索引＋单条阅读区，进行中的交谈／委托在前，已完成记录在后，未开放篇章直接在索引底部置灰列出，可选中查看条件但不能触发未解锁行动。索引是连续列表，不插入分组标题或跨组留白；所有状态共用76像素行高、4像素间距及图文对齐，长标题单行省略，悬浮和阅读区保留全文。整备独立打开 DeparturePreparation，没有跨用途 TAB 或右下角重复入口。日志角标来自可操作的成长、记忆与叙事查询，不伪造未读状态。MansionScene 负责入口互斥及建筑、库存、对话、时间推进互锁；各窗口关闭后返回对应入口焦点。旧版经历仍由 playerHistory 产生，遵守 save/epoch/revision/expedition、可见性与撤回过滤。本地反应仅在 legacy 服务经 runtime.createReactions 读取；绑定 head/场景，离场取消，失败不阻塞导航或结算。

仓库采用固定＋沙盒模式，不再预设装备／材料／文书分类。上方七种常备补给固定一排、不显示名称，数量改为贴在槽位右下角的黑底细框角标（含0和1），不再另占一行；下方开放物品库存每页两排七列，空槽补满当前14格，按实际物品数增加页数而非限制总容量。页脚常驻前后翻页与页码，单页也显示禁用态；换页只更新下方物品并收起旧详情，支持 PageUp／PageDown 和方向键跨页，空槽不占键盘焦点，库存减少时页码自动收敛。两区均复用 ItemSlot / ItemSlotStatic 的边框、菱形底纹、六层浮雕与选中态；常备补给及其详情预览使用显式 interface 色调（冷灰／象牙色，无品质标签或宝石），普通库存保留品质色，原有组件调用默认不变。补给显示真实 storedCharges（包含零库存），不得以免费出征额度冒充库存；装备保留在库／已装备／远征占用，归属标记与数量角标分开。开放库存接受任意名称、图标、数量、描述，不需要分类注册；当前已接入 AIRP 经验证的携带／待交付委托物，未获得、已交付、已丢失的物品不显示，不从台词猜测物品，也不新增任意物品发放或存档规则。库存投影按已提交 record 缓存。详情是只读浮层，坐标按 Stage 缩放换算并约束在内容区，优先利用空位避让真实物品；关闭键固定右上角28像素，不参与正文排版。Esc 先收详情再关窗口，方向键／Home／End 只遍历当前页真实条目，缩放时收起详情。携带和整备操作仍只在独立整备窗口进行。

仓库、日志与整备共用原始 RpgModal / RpgFrame / Nameplate / IconButton，三个窗口统一使用 slim 外置标题牌，不绘制自定义切角页签或方形关闭按钮。索引与阅读区分别滚动，选择条目只改变本地阅读状态；箭头／Home／End 可在条目间移动，关闭重开保留所选记录，未打开的窗口不挂载正文。JournalBrowser 不派发游戏命令，成长、AIRP、回忆保留各自明确的行动按钮，未呈现的 reserved 便条不进入索引。CampaignReturnRecord 的标题／叙述居左，抵达层数置于标题右侧；入账区与标题分隔线等宽，块间距24像素，明细名称居左、金额居右、单位独立12像素列，已结算状态只在入账区显示一次。明细在前、合计在后，只展示已提交的收益；合计包含本次委托／同 run 的接管奖励，不重复扣除途中损失，也不把历史接管奖励再次算入本次。

`DeparturePreparation` 默认六个携带位、七种紧凑补给格和224像素详情栏，左侧装配区约占正文宽度的四分之三。左侧两组共用一块深色浅边框内面板，固定间距、顶部对齐，不撑满后两端分布，也不整体垂直居中；上排含空位均预留名称行，下排只显示图标与数量。所有补给及预览沿用 ItemSlot 的 interface 配色与选中效果，和仓库共用 `.abyssa-item-count` 右下压边角标；上排显示出征携带量，下排显示真实库存，免费配给不混充库存。`useDepartureLoadout` 和地图共用窗口内整备偏好，键绑定 saveId/epoch/schema/content digest；读入时过滤未知、无库存、重复与超限条目，明确保留空包选择。携带上限由核心 `departureSupplyLimit` 统一给出：规则4的内容12及以后为六种，较早版本仍为四种；命令、战斗、归还、事件与存档回放同步校验。偏好仅存于 sessionStorage，不写 GameRecord、不领取配给、不购买物资；地图确认出发时才通过原 start-expedition 命令消耗／补足物品。存储不可用时明示需在编队页重新确认。旧 schema1 的物品／装备选择仍走原逻辑。

三个窗口显式挂载 manor-utility 主题，配色来自 mansion-room-drawer：冷墨底、暖象牙标题、灰白正文、冷灰辅助信息、旧金分区与选中边缘。主题集中在 shared/ui/styles/manor-utility.css，不修改全局 teal 或物品稀有度令牌。三窗通过 opt-in `manor-utility__window` 共用1080×620设计像素的外框和38/32/24内边距，包含分页或操作栏，不以正文高度充当总高度。日志正文无底板，目录与整备左区共用浅边框深色内面板；组件库的槽位与按钮浮雕保持原样。金币、晶石及物品稀有度仍保留各自语义色，洋馆画布和其他页面不继承这套局部主题。

JournalButton / JournalActionLink 复用 RpgNotchedPillArt 原始 SVG，默认40像素高；14像素 HTML 文字独立于装饰缩放。整备底栏只有「出征编队」保留完整主按钮，「补充物资／查看骰装」使用既有图标与无外框文字入口；加入／移出是数量说明下方144×36像素的低对比局部操作，提示行固定预留，不再形成第二条底栏。金额复用 CurrencyAmount 的金币与晶石图标，公款通过可选冠纹金币区分，三个名称在悬浮或键盘聚焦时显示，读屏名称始终包含账户与真实金额。共享按钮与货币组件的默认外观不变。

556设计像素的整备正文先预留48像素操作栏和16像素间距，主区顶部对齐，详情数量并排显示；不能通过隐藏溢出掩盖按钮裁切。默认不显示操作教学、重复携带状态或方案保存说明，缺货／满包／远征锁定原因和存储异常仍须显示。六个携带槽横排108像素，下排七个补给槽80像素，两排外侧边缘对齐；ItemSlot 隐藏稀有度宝石时也须释放其占位，保持图标居中。

## 当前内容边界

新档默认使用规则／应用4、内容12，标题先选择四种旅程起点。完整路径为CG序幕、洋馆首晨、四战＋E1教学、S4-1归馆；六场章一定稿共18屏78帧，玩家内心不占立绘席位，作者动作备注不渲染成字幕。正式闭环还包含庄园初战／维护、刻仪兽回忆、玛亲征开放、十项成长、两件装备和五类战术补给购买。当前默认道具最多携带六类：食物／药水可免费配给，其余五类按库存与充能购买。较早内容版本仍保留四类上限，不隐式升级。

洋馆建设、生产、升级，以及商店出售／鉴定尚未开放。兼容内容的手动时段推进已经由持久命令接入；景致解码期间保持完整遮挡，同一张不透明世界图就绪后才揭幕。完整机制和真实闭环以[当前总览](../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)为准；工程接通不代表整体难度和剧作验收通过。

依赖门禁允许 client → runtime/shared/展示资源，以及 public core/application 类型；禁止 client → app/adapter 或底层反向引用 client。正式入口的传递闭包禁止 `battle/engine.ts` 与 `runtime/legacy-battle.ts`。导航检查沿生产 import 闭包检查路由表，包含共享导航的返回路径。

实施证据见 [S3 实施验收](../../docs/archive/audits/2026-09-05-s3-implementation.md)。

庄园结局由已提交 terminal／takeover 决定；首通阅读继续／跳过仅确认阅读游标，不重复发收益。终局入账后即使 active run 已清空，匹配该结算 run 的未确认剧情请求仍可重试；不能因此推进另一趟远征。成长／赠物另有显式完成与授予命令，不能把首通阅读规则泛化为所有故事均无结果。
