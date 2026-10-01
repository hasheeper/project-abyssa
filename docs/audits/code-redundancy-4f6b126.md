# 代码冗余与迁移残留审计

审计基线：`4f6b126a723940110bcb63d9db9aa356430ee5ff`。线上运行源码：`7fcfce1`。

执行状态：2026-10-02 已完成下述十项清理。原始审计结论保留，具体改动和验证见文末「清理完成记录」。

## 结论与范围

当前最值得清理的是迁移后留下的演示状态机、旧窗口 CSS、无调用组件和重复的记忆投影。已有存档和请求恢复依赖的保护仍有明确作用。

仓库扫描涵盖 1,786 个 TS／TSX／JS 等文件，AST 解析失败为 0；另对近期 UI 范围的 40 个 CSS 文件做选择器扫描。人工重点核对洋馆、菜单存档、记忆、AIRP Director／生成界面及共享洋馆控件。没有逐行审计所有战斗规则、历史版本协议和基础设施。

本次产出为审计记录，未执行生产代码删除或站点发布。优先级 P2 表示本轮清理应优先处理，P3 表示后续维护整理；本次未确认 P0／P1 问题。

## 已确认的问题

### 1. P2：旧洋馆演示状态机已失去实际调用

位置：`src/apps/mansion/mansion-state.ts:23`、`src/apps/mansion/mansion-state.test.ts:14`；残留接线在 `useMansionEstate.ts:99`、`MansionWorld.tsx:217`。

- 创建演示领地、预览／推进相位、收生产、修缮、升级这六个函数只被旧测试调用。正式页已由 GameSession 和设施应用命令推进。
- 文件仍内置演示初始资金、随机损坏、三次修缮和升级规则。247 行状态模块配套 86 行旧测试，容易让维护者误以为它们仍代表正式机制。
- 正式 hook 固定返回空 `repairProgress` 和空 `damaged`，世界中的可升级图钉与损坏图钉分支因此不会生效。
- 旧常量 `MAX_FACILITY_LEVEL = 4` 仍被世界图钉使用，正式设施视图上限已经是 3。当前没有证明它导致玩家错误升级，但存在两套上限来源。

清理：移除无人调用的模拟规则及配套测试；把旧库存布局常量独立放到展示层；世界图钉直接接受正式施工／产出状态。保留实际施工中的图钉，不把整个 repair 外观一起删掉。

### 2. P2：旧 DOM 已移除，相关 CSS 仍随页面加载

经生产源码和动态类名核对，以下四个文件中确认 89 个完整规则块、90 个选择器已失去对应元素：

| 文件 | 失效规则块 | 主要残留 |
| --- | ---: | --- |
| `src/apps/menu/menu-sections.css:112` | 21 | 旧 records 列表、缩略图、空档槽位 |
| `src/game-client/campaign-journal.css:21` | 32 | 旧成长／伙伴／回忆分栏、旧归档列表 |
| `src/game-client/airp-generation/direct-game.css:3` | 33 | 旧生成场景、gate 外壳、record 面板与折叠区 |
| `src/game-client/airp-generation/generation-flow.css:18` | 3 | 旧委托类名与 flow-launcher |

这些样式文件仍被 menu.css、CampaignJournal 和生成相关组件引用，失效规则没有自动从发布 CSS 中剔除。它们增加查找与覆盖成本，重复复用旧类名时还可能意外恢复旧排版。

清理：按规则删除，不删整个文件；同文件里仍有有效的金额、日志窗口、直连进度和技术详情样式。`airp-direct-settings--${layout}` 和 `memory-time__handle--${part}` 是真实动态类名，已排除。

### 3. P2：记忆投影反复扫描整段内容

位置：`src/game-client/memory/memory-replay.ts:27`、`src/game-runtime/memory-narrative.ts:69`、`src/game-client/memory/useMemoryJournal.ts:48`。

- 回想每个 block 都重新筛选／映射整个场景，重新调用 storyActors，再逐角色查找名字。长场景至少会发生二次量级的扫描与重复对象分配。
- narrativeActBlocks 每个 frame 都在 entry.blocks 中 find 原始记录；投影也随原文长度放大。
- 详情 hook 的 transcript 没有 memo，原文展开、回想退场等本地状态变化都会重新计算同一幕。

清理：给原始 block 建复合来源索引；整幕的稳定角色信息预计算，变化的 initialSlots／portraits 仍按冻结舞台状态处理；transcript 按选中事件和幕 memo。累计消息快照用于播放器，不能未经消费者核对就改为共享可变数组。

本项由算法结构确认，未进行大存档性能测量，不能据此声称已复现卡顿或确定帧率损失。

### 4. P2：AVG 生成模块成为只被测试调用的功能孤岛

位置：`src/game-client/avg-generation.ts:11`、`src/shared/presentation/avg/generation.ts:58`、`src/game-client/avg-generation.test.ts:3`。

请求构造、同源 `/api/avg/generate` 适配器和独立生成器没有生产调用者；现有入口使用 AIRP 的生成驱动。两份源码共 139 行，另有 60 行测试。测试覆盖只能证明这套孤立代码本身可运行，不能说明已经接入游戏。

清理：正式源目录移除该孤岛及仅为其存在的测试；若仍用于后续实验，整体移入明确的 lab 范围。无需为它继续维护另一套正式生成生命周期。

### 5. P3：空回调和恒定假字段仍被逐层传递

位置：`useMansionEstate.ts:17`、`useMansionEstate.ts:101`、`MansionPage.tsx:349`、`MansionPhaseBar.tsx:64`。

- estate.previewPhase 是空函数；页面包装后再传给相位栏，但唯一实际调用者始终设置 readOnly，节点按钮 disabled。
- estate.toast 始终为空字符串，页面仍解构并参与 `growthNotice || toast` 判断。
- 无人使用的 STOCK_CAPACITY 仍保留在旧状态模块。

清理：移除空接口和恒定字段；相位栏明确展示当前相位与推进动作。如果保留可选择相位的组件能力，使用与 readOnly 对应的 props 联合类型，避免要求展示模式传入无作用回调。

### 6. P3：无人调用的组件和占位值

| 位置 | 证据 | 处理 |
| --- | --- | --- |
| `src/apps/menu/MenuLoadPanel.tsx:5` | 没有调用者；MenuPage 直接用 SaveSlotsPanel | 删除包装文件 |
| `src/game-client/SaveGamePanel.tsx:5` | 没有调用者；同样已被 SaveSlotsPanel 替代 | 删除包装文件 |
| `src/shared/ui/patterns/ManorParts.tsx:99` | ManorKeys 和键位类型没有调用者 | 连同 manor-utility.css 的键位样式删除 |
| `src/game-client/memory/memory-types.ts:4` | unopenedMemoryJournal 无引用 | 删除占位值 |

仅当前模块内部使用的 journalMeta、journalTone、JournalActionArt 等可以取消 export，减少对外接口；它们本身仍在运行，不属于可删实现。

### 7. P3：Director 的 fallback 只是在兼容不完整测试 mock

位置：`src/game-client/airp-director/DirectorScene.tsx:39`、`DirectorScene.test.tsx:7`。

`useDirector` 始终提供 advance，生产中的 `d.advance ?? d.send` 右分支不可达。测试用 any 的 fixture 没提供 advance，才依赖回退。advance 和 send 的语义不同：前者还负责续生成及阅读接线。

清理：生产直接调用 d.advance；测试 mock 补齐真实返回合同并去掉相关 any。测试应验证 advance 被使用，不能让 fallback 掩盖缺失的流程适配。

### 8. P3：一个异步接线条件中重复读取和查找

位置：`src/game-client/airp-director/useDirector.ts:54`、`:60`。

同一恢复检查里重复 getSnapshot、重复查找 job；job 查找结果先做可选访问，又再次非空断言。可以在 await 边界后取一次快照和一次 currentJob，让状态、阅读身份、正文是否可用的判断直接可读。

清理：缩短表达式，保留 disposed、job 身份、paused、cursor 与已保存阶段判断。它们防止付费请求迟到后重开已经关闭的场景，属于有效保护。

### 9. P3：同一 mask 图标基础实现有两份

位置：`MansionFacilitySections.tsx:57`、`ManorSection.tsx:6`；样式分别在 `mansion-room-sections.css:134`、`manor-utility.css:127`。

Glyph 与 ManorGlyph 都创建 maskImage／WebkitMaskImage，绘制 currentColor 的图标，区别主要是类名和尺寸。重复维护已没有必要。

清理：共用一个图标基础件，房间尺寸由局部 class 覆盖。房间徽记和面板与工具窗有真实布局差异，暂不强制合并所有 DOM 和 CSS。

### 10. P3：当前 README 仍描述已经替换的界面

位置：`src/game-client/README.md:46`、`:48`。

文档仍写日志为无分组连续列表、库存每页 14 格、浮动详情及 Esc 先收详情。实现已经是分组页签、21 格库存和常驻右栏详情。维护时按旧描述补逻辑，会重新引入已移除的分支和样式。

清理时同步更新机制说明，旧设计过程保留到历史审查记录。

## 核查后保留的保护

- GameSession 的 CAS、pending request 身份和 dispose／读取代次：覆盖真实并发与响应丢失。
- 后台任务与当前页面分离、running 中断恢复、pending 输出保存：覆盖跨页和刷新，不能以状态多为理由去掉。
- Director 的版本分支：当前可读取的旧内容档仍在使用。删除需要单独确定存档支持范围及迁移方案。
- memoryReplayPages 的 source／stage 校验和冻结回想前缀核对：阻止无来源或已撤回内容回想。
- ResourceInventoryDialog 的页码、选择与焦点收敛：库存变化／条目移除时有实际作用。
- 设施 hook 的同步 inFlight：GameSession 并发 dispatch 会返回已有命令的 Promise，本地锁避免把其他操作的结果当成本次设施反馈。
- 洋馆素材加载超时、取消检查、资源释放与静态回退：用于不完整素材／解码失败；未确认可以直接删除。fetch 的 AbortController 与 within 虽同时限制时间，一个终止 I/O、一个保证 Promise 完成边界，不能仅因都是 8 秒便认定重复。

## 建议执行顺序

1. 删除确认无调用的包装件、占位值和失效 CSS；更新 README。
2. 撤掉旧洋馆演示状态机和空接线，世界标记统一使用正式设施视图；删除孤立 AVG 生成模块。
3. 优化记忆原文索引、角色投影与 transcript memo，保持回想输出完全一致。
4. Director mock 对齐真实合同，移除不可达 fallback，整理重复快照／查找和图标基础件。

验证按改动范围选取：类型与模块边界；洋馆／库存／日志／整备；记忆幕／切片／回想；Director 阅读续行及结算恢复。确认级删除无需新增镜像测试；投影和异步接线需用现有语义回归保护。

## 检查记录与限制

- TypeScript noUnusedLocals／noUnusedParameters 检查通过；仓库原配置已启用，无法发现仍 export 或仅被测试调用的代码。
- 模块边界：1,607 个源码文件、155 个 core 生产文件通过。
- import／export AST 扫描以及 CSS 来源核对已完成；路由 namespace、Worker URL、动态 CSS、模块内部 helper 等扫描误报已排除。
- 未改变生产源码，因此没有重新进行构建、浏览器功能测试或发布。

## 清理完成记录（2026-10-02）

### 已执行

- 移除旧洋馆演示状态机及专属测试；schema1 库存网格常量移到 mansion-stock 展示模块。世界图钉直接读取正式 facilities.construction，不再传递空损坏集合、空修缮进度或另一套等级上限；真实产出收取与施工标记保留。
- 删除四个文件中审计确认的 89 个失效 CSS 规则块，清掉空媒体块及失效注释；另删除 4 个无调用键位规则和 2 个旧世界损坏／可升级标记规则，共 95 个规则块。房间工程仍使用的 RepairIcon／PromoteIcon 与对应材质保留。
- 移除空相位预览回调、恒空 toast 和无效只读选择接线。相位栏明确为当前时间展示加推进动作。
- 删除 AVG 短回复生成孤岛及专属测试、MenuLoadPanel、SaveGamePanel，共删除 7 个文件；删除 ManorKeys、ManorKeyHint 和 unopenedMemoryJournal，收回 7 个内部 helper 的 export。
- narrativeActBlocks 预建事实／行号／正文复合索引，保持原先首次匹配的说话人语义；回想按幕或旧场景预建角色与名字索引，再逐 block 覆盖初始站位和肖像；累计消息仍是不可变快照。详情 transcript 按事件与所选幕 memo。
- DirectorScene 直接调用 advance；测试 fixture 明确要求 send 与 advance，两条命令路径均有断言。useDirector 在 await 后只取一次快照、一次 job 和一次驱动错误，保留迟到响应、暂停、销毁和游标保护。
- 房间行内图标统一使用 ManorGlyph，局部样式只保留 18px 尺寸。更新游戏客户端 README，并撤下已删除 AVG 模块的接口样例与当前测试命令。

### 验证结果

| 检查 | 结果 |
| --- | --- |
| 完整类型检查（core/application/app/tooling） | 通过 |
| 模块边界 | 1,600 个源码文件、155 个 core 生产文件通过 |
| 动效令牌同步、git diff --check | 通过 |
| 洋馆／设施／库存／日志／整备、记忆、Director、结算针对性测试 | 16 个文件、94 项通过 |
| 游戏构建 | 通过 |
| 洋馆三窗、记忆刷新／回想、卡住与刷新后结算恢复浏览器检查 | 4 项通过 |

新增语义回归覆盖：初始站位和肖像逐段变化、direction 舞台提示、不可变消息前缀、场景重置，以及重复来源的首个说话人（含未标注说话人）恢复。查看构建后的房间工程与记忆详情截图，图标和现有版式正常。

浏览器使用独立 5207 端口、隔离存档和模拟服务响应。洋馆浏览及记忆回想验证存档不变；结算用例验证退出、导航、取消、事实恢复和刷新后的 running 恢复。没有使用真实模型请求或用户存档。

本轮完成本地清理和验证，未发布 Pages。原有历史存档支持、CAS／请求身份、回想来源和冻结前缀、库存选择收敛、设施操作锁及素材加载保护均保留。此前未跟踪的设计稿和参考图片未纳入清理。

本机验证日志：dist/reports/cleanup-{typecheck,tests,build,smoke}-2026-10-02.local.log；浏览器截图在 dist/reports/browser。构建仍有既有的大 chunk 提示，本轮未调整分包。
- 本机扫描证据位于 `dist/reports/cleanup-audit-*.local.json` 及同名前缀日志，均不属于 Pages 产物。

## 最后审计与收尾（2026-10-02）

### 最后发现的残留及处理

- 正式 `ShopPage → ShopCounter → ShopSurface` 已使用新版商店。旧 `OldShopCounter`、`ShopView`、交易／鉴定／店主对白组件、旧进场 hook、五份样式与仅为原型存在的测试没有正式、实验 HTML 或 Storybook 消费者；移除共18个文件、2486行。旧 `ShopPage.test.tsx` 实际测试 `ShopPreview`，随原型退休；真实买卖、库存、首次入店、日货单、失败恢复与进场测试继续保留。
- 删除无人调用的 `MemoryFrame` 转发包装，以及 `system-records.css` 中39个旧列表／缩略图／槽位／工具浮窗规则。当前导入、管理和兼容工具使用的按钮、字段、操作、身份和展开区样式保留。
- 动效门禁改为当前角色／地图的共享主板消费者；新版商店的资源、分组进场和打字生命周期仍由 `App.entrance.test.tsx`、`ShopCounter.live.test.tsx` 保护。同步商店、素材和切场 README，撤下旧实现路径和时长。
- 地图测试同步当前简报文案，仍验证未开放目的地不能出发。交易响应丢失测试通过当前「重新读取」入口恢复，并在共享提示停靠区验证真实出售收入，继续确认不重复扣款／交易。
- 战斗实验及其真实结算回归发现预览误用新的正式 `hub` 起点，直接出征会被 AIRP 安排校验阻止；预览现使用公开 `debug-offline` 创建内容27。商店日货单 UI 回归也使用该起点，历史内容23的事务／复制回归继续按原合同建档。
- 历史直连恢复夹具仍借用 `airp-demo` 标题起点，统一入口后误建内容28，导致旧测试初始化失败；现在明确创建内容18并提交原历史起点命令，与已采用内容19的 Director 夹具一致。
- 手动存档直接读取导出 JSON 的 `record.head`，没有解开池化格式，当前导出会报错。档案头投影现复用 runtime 的既有 codec，同时支持池化和普通记录；原导出字节、冲突比较、复制验证、请求身份和失败重试保留。四项语义回归在公开调试内容27验证普通档复制、模糊失败、冲突与配额失败，并确认真实池化输入。正式内容28含 `airpGame`，现有 lineage 明确禁止跨身份复制；新增回归确认返回该限制、没有安装半份副本、原档不变。本轮没有实现或绕过该协议限制。
- 整备持久化测试改用已经获赠真实库存的自由行动档；另验证教程开始前尚未获赠时行囊为空，不再把默认教学物品当作库存。
- 战斗食品回归的全局角色查询反复遍历骰子SVG，单进程仍超过5秒；查询限定在现行行动面板，复用一次操作前投影，保留真实回合完成与食物扣除断言。该项最终耗时约3.1秒，未放宽超时门槛。

### 剩余模块的用途

重新扫描1760个 JS／TS 文件、197个 CSS 文件和8523条相对引用，AST解析与悬空本地引用均为0。较大的未从生产入口到达模块逐项核对：角色旧展示数据服务 CharacterPreview／Storybook；旧战斗适配服务兼容和规则回归；Worker由构建配置或Worker URL接入；应用Port适配器用于事务测试。动态类名、公开UI样式和实验展示不据文本扫描结果删除。

本轮确认的大块闲置UI实现已清理。历史内容协议、存档读写、CAS与请求身份、冻结原稿及回想来源保护保留；没有逐行审计全仓规则，也没有以本轮结果宣称完整在线玩家体验已验收。

原件和逐文件SHA清单：`/Users/liuhang/Documents/abyssa-final-audit-20261002-o2arqkfs/`。文档原件使用此前的外部备份，三张设计参考图保持原字节。

### 最终验证

全仓 `check:baseline` 尝试完成了类型、入口、模块边界检查和274个界面层测试文件，发现上述历史夹具、池化存档接线及旧库存预期问题；教学／战斗／存档另有并发超时。后续历史压力回放持续占用两个CPU进程、数分钟没有新结果，停止该轮，不把它记为完整基线通过。发现的失败项全部完成单进程复测，教学结算、历史直连驱动／进度／控制、存档槽位、手动存档、整备、教程出发及战斗绑定共9个文件、50项通过；最后一轮3个文件、15项通过。

| 最终检查 | 结果 |
| --- | --- |
| core／application／app／tooling 类型检查 | 通过 |
| 入口与模块边界 | 22个入口、1586个源码文件、155个core生产文件通过 |
| 构建门禁 | 128项通过 |
| 无DOM导入验证 | 124个兼容导出、5场无界面应用远征结算通过 |
| 游戏构建与输出约束 | 885个文件、160.76 MiB，通过；保留既有大chunk提示 |
| 文档本地链接／章节锚点 | 153份Markdown、884条本地链接，0错误 |
| r8冻结基线与编译请求 | 20个payload、34项编译请求字节一致，networkCalls为0 |
| AST／本地引用扫描 | 1760个JS／TS文件、197个CSS文件，解析错误与悬空引用均为0 |

本轮日志使用 `dist/reports/final-audit-*.local.log`，扫描证据为同目录的 `final-audit-scan-2026-10-02.local.json`，均在Git忽略目录。前几轮浏览器检查证据见上文；最终没有重复完整玩家路径或真实在线验收。全仓压力测试未完整结束、正式AIRP跨身份复制未支持，仍为明确限制。

本轮提交与推送 Git，不发布 Pages；没有调用真实模型或访问用户存档。
