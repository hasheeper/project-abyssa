# 玩家会话与流程

Title、Menu、Map、Battle、Mansion、Shop 和 CharacterStatus 共用本目录。应用服务与 IndexedDB 中的 GameRecord 是权威状态；React 会话缓存和 Battle 演出副本都不接受资产 patch，也不执行规则。

## 使用

可发令的正式页使用 `GameProvider` → `GameGate` → `useGameSession/useGameState`。Provider 在 effect 内创建 runtime，StrictMode 清理会关闭连接、订阅和反应任务。组件测试通过 `GameSessionScope` 显式注入真实 Memory 应用会话；正式 URL 没有样本状态或自动开局开关。

角色页使用 `ReadGameProvider` → `ReadGameGate` → `useReadSession/useReadState`。读取会话不消费 pending、不续行战斗、不发命令；同档临时读取错误显示过期状态，身份／内容错误清除旧数据。同 head 成功刷新复用读模型。装备及回忆入口另用 `useEquipmentSession` 建立受命令白名单约束的写会话，仍禁止自动推进活动战斗。两种会话共用 `observe-commits.ts` 的通知协议。

`navigation.ts` 统一生成同源相对 HTML：所有页面携带 `save/epoch`，Battle 和角色页可另带 `expedition`。角色页附带角色 ID、页签及 menu/map/battle 来源白名单；ID 作为 query 编码，允许 core 已接受的 `/`。缺失定位进入档案守卫；旧远征链接显示已有结算或当前远征入口。localStorage 只保存最近档案提示，不能作为存档。

`GameSession.dispatch(command)` 在提交前保存完整 envelope，返回 `CommittedBatch | null`。同一会话只允许一个 in-flight；双击复用同一 Promise。成功批次包含 `before/after/receipts/presentable`；消费者只有在 `presentable` 且当前 head 一致时才播放旧回执。

## 剧情阅读界面

首晨、AIRP、教学／普通副本、回忆、成长、商店初访与 NVL 预览共用完整 `ReadingControls`：左侧罗马幕号／翻幕、中间推进、右侧版式／REPLAY／LOG／AUTO／SKIP；关闭等业务工具只能追加。所有模式保留同一基础工具集，不各自拼装底栏。

`ReadingPlayer` 提供共享舞台，`StoryReading` 只适配作者内容；首晨保留特殊演出适配但共用底栏、播放时钟及只读回看游标。`AirpReading` 负责进场和玩家 POV（玩家可发言但不上立绘，历史也相同）。AVG／NVL 都使用 `StoryChoices`；LOG 隐藏选项，只显示当前已呈现范围。界面称为 NVL，内部 `RpScene`／`rp-*` 名称与路由保留。

`useReadingPlayback` 等实际文字显示结束后等待 2200ms，提交普通阅读并等待保存；SKIP 顺序读取至下一选择／确认，不再调用“跳过即完成”的业务命令。最终任务确认、进入战斗、结算、生成下一场仍须玩家主动操作。LOG／REPLAY／模式切换／失焦／页面隐藏和业务错误停止播放；`useReadingReview` 独立游标只浏览已呈现内容，不回退存档或重发命令。设置页时长仍是本页预览，未宣称全局接入。见[AIRP 生成反馈、阅读与恢复](../../docs/architecture/AIRP_FLOW_AND_RECOVERY.md)。

## 中断和冲突

Menu 的设置正文由 `settings/settings-menu.css` 在 authored 画布坐标下重排，不缩放整个面板：主标签／滑块数值／右侧预览分别使用 20／15／18px，普通行高 84px；重复英文行标收起。滑块菱形在轨道上居中，预览保留 24px 横向内边距，文字不再贴边。单选使用清晰的选中／未选中色调，文字通过 htmlFor 关联输入，不嵌套 label。设置状态为只读文本，恢复默认有可见名称；参数和真实接入范围保持不变；标题和独立设置入口现在也使用这组控件布局，外层共用 `SystemSceneFrame` 的透景背景、大号双语标题、顶部 TAB 和底栏。`useSettingsMotion` 已替换整区淡变：设置行、取景组、预览和状态分别进入，顶部每个 TAB 与底部各按钮独立错峰，退场反序收束。分类切换保留外层与按钮，只替换淡出完成的正文；预览可见后开始打字，值变化不重播。时序见[动效说明](../shared/ui/motion/README.md)。

`useSaveArchive` 供标题与菜单共用读取控制器。标题的 `TitleArchive`／`SaveArchivePanel` 已改为铺满原 Stage 的透景档案页：大号 LOAD／读取档案、两排错位导轨，每页 4×2，沿上下交替顺序展示；按完整档案数量分页，不受 Menu 的 30 槽上限限制，也不伪造空档。导入／悬浮导出用图标，兼容和归档工具在同一正文区展开，不再使用旧列表边框窗口。日期只读取匹配 saveId＋epoch 的槽位元数据，旧档显示「时间未记录」。场景摘要集中在 `save-scene.ts`，不让 Menu 因导入摘要而加载标题页组件。

Menu 直接挂载同一个 `SaveSlotsPanel`，SAVE／LOAD 切换只改 mode，保留页码、选择、导轨和已验证列表，不重新扫描。网格每页 5×2、三页共 30 槽；不提供「其他档案」或旧列表跳转。导入和每槽导出使用原版 Bootstrap 图标，保留 tooltip 与 aria-label。两排错开半个节距，连续青光导轨不随错位截断。`settings/SettingsPanel` 同样嵌入 Menu，不另建 Stage 或触发路由加载；标题设置在原 Stage 内就地展开，不走路由加载；独立设置链接也复用 `SettingsScene`，退出动画完成后按原来源返回。分页与设置分类共用 `SystemTabs`，定位到标题右侧，仍属于正文子树并遵守 inert 门禁。

`useSaveSlotMotion`／`save-slots-motion` 将导轨、节点、槽位、附件分层：完整入场先展线，交错点亮节点与内容，最后逐个显示 TAB、导入和底部按钮；退场严格倒放，最后收线。透景黑幕由 Menu 宿主的 `MenuSystemBackdrop` 常驻承载，SAVE／LOAD／SETTINGS 互切时不卸载、不淡变，只有进出主 Menu 才淡入淡出。`system-panel-motion` 只绑定具体控件，不绑定整组导航或底栏，保留禁用态明暗。初始列表未就绪时，同一网格只显示导轨与呼吸节点；在 rail hold 处等待，数据就绪续播，不换 DOM 或弹出加载文字。翻页只退入槽位及其导出入口，旧页退完才替换，并锁定操作；轨道、顶部 TAB／导入和底部按钮持续可见，不重播淡入淡出。选中项权重 1.08、同排其他 0.98，hover 不触发布局变化。模式互切保留导轨，用独立 modeOpacity 淡换槽位、装饰线及短错峰附件，不重播展线／逐槽编排；大标题沿用统一撤回／划入。真实保存／读取逻辑不由视觉时钟延迟。

初始扫描可取消，实际提交期间通过同步忙锁禁止切换栏目。先选槽再确认保存，已有槽需再次确认；空槽不能读取。`manual-save.ts` 通过 runtime 的验证导出／复制接口产生独立身份，当前档案继续自动保存，不直接 patch 存储。显示的 source head 与读盘结果必须相同，同一尝试的并发调用和失败重试复用目标与请求身份；槽位目录提交失败重试复用已生成副本，不反复建档。验证复制成功后，再由 `game-runtime/save-slots.ts` 用原子 CAS 更新槽位目录和真实保存日期。首次使用按 saveId 稳定排序映射已有可读档（仅显示，不写入目录），不足 30 槽显示空位，历史时间不伪造。替换只改槽位绑定，不删除原档；目录冲突要求刷新后重新选择。整页刷新不恢复未完成的槽位操作；未绑定、溢出与替换下来的底层档案保留在标题的完整列表中。在线绑定与活动 AIRP 的复制限制不绕过。读入副本后它成为可自动保存的活动旅程，不承诺不可变快照；槽位日期记录手动保存时间，不是后续自动保存时间。

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

`DeparturePreparation`和地图共用整备偏好与数量选择，绑定saveId／epoch／schema／内容摘要。上排显示本趟选择，下排显示馆内库存；按实际能力过滤无库存、重复与超限条目，保留空包选择。内容27／28使用储藏室Lv.1／2／3的4／5／6类上限，旧12～24保留原六类规则。偏好只在会话内保存，确认出发才通过应用命令扣除实际数量；打开面板不发补给、不购买物品。原料不能直接装入战术补给位。

三个窗口显式挂载 manor-utility 主题，配色来自 mansion-room-drawer：冷墨底、暖象牙标题、灰白正文、冷灰辅助信息、旧金分区与选中边缘。主题集中在 shared/ui/styles/manor-utility.css，不修改全局 teal 或物品稀有度令牌。三窗通过 opt-in `manor-utility__window` 共用1080×620设计像素的外框和38/32/24内边距，包含分页或操作栏，不以正文高度充当总高度。日志正文无底板，目录与整备左区共用浅边框深色内面板；组件库的槽位与按钮浮雕保持原样。金币、晶石及物品稀有度仍保留各自语义色，洋馆画布和其他页面不继承这套局部主题。

日志内页共用 22px 标题、12px 辅助文字，以及“说明/状态 → 操作 → 明细”的阅读顺序。`JournalLedger` 展示带回物品的名称、数量和外观，只随右侧正文滚动；`JournalAppraisal` 的同类合并仅用于显示，保留真实持有批次与未知信息边界。`DirectorDayLauncher` 根据已有任务状态呈现今日安排，按钮只打开原生成弹窗。完整设计来源和验证见 [日志排版整合记录](../../docs/audits/2026-09-25-journal-layout-integration.md)。

JournalButton / JournalActionLink 复用 RpgNotchedPillArt 原始 SVG，默认40像素高；14像素 HTML 文字独立于装饰缩放。整备底栏只有「出征编队」保留完整主按钮，「补充物资／查看骰装」使用既有图标与无外框文字入口；加入／移出是数量说明下方144×36像素的低对比局部操作，提示行固定预留，不再形成第二条底栏。金额复用 CurrencyAmount 的金币与晶石图标，公款通过可选冠纹金币区分，三个名称在悬浮或键盘聚焦时显示，读屏名称始终包含账户与真实金额。共享按钮与货币组件的默认外观不变。

556设计像素的整备正文先预留48像素操作栏和16像素间距，主区顶部对齐，详情数量并排显示；不能通过隐藏溢出掩盖按钮裁切。默认不显示操作教学、重复携带状态或方案保存说明，缺货／满包／远征锁定原因和存储异常仍须显示。六槽展示基底横排108像素，实际开放数量由当前存档能力决定，下排七个补给槽80像素，两排外侧边缘对齐；ItemSlot 隐藏稀有度宝石时也须释放其占位，保持图标居中。

## 当前内容边界

普通新档为规则／应用4、内容27，正式AIRP起点为28。标题先选姓名与起点，确认后建档。当前已接开场与四层教学、普通溶洞／庄园、回忆／成长、九件商店装备、日期货单、出售／鉴定和完整商店首访；阅读与交易消费同一正式档案。

洋馆厨房、温室、工坊与真实库存已经接入，每周公款、首次修缮和升级入口已接入，到账／开工／完工使用通用侧上提示。当前出征按数量扣库存，剩余返还，不再每趟免费补满；正式AIRP的生成反馈、侧栏、阅读锁定与恢复见[生命周期合同](../../docs/architecture/AIRP_FLOW_AND_RECOVERY.md)。完整机制以[总览](../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)为准。

依赖门禁允许 client → runtime/shared/展示资源，以及 public core/application 类型；禁止 client → app/adapter 或底层反向引用 client。正式入口的传递闭包禁止 `battle/engine.ts` 与 `runtime/legacy-battle.ts`。导航检查沿生产 import 闭包检查路由表，包含共享导航的返回路径。

实施证据见 [ABYSSA 当前机制与游戏闭环总览](../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)。

庄园结局由已提交 terminal／takeover 决定；首通阅读继续／跳过仅确认阅读游标，不重复发收益。终局入账后即使 active run 已清空，匹配该结算 run 的未确认剧情请求仍可重试；不能因此推进另一趟远征。成长／赠物另有显式完成与授予命令，不能把首通阅读规则泛化为所有故事均无结果。
