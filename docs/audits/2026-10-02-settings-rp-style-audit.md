# 设置、系统面板与 RP 样式审计

日期：2026-10-02。基于当前工作区，包含上一轮尚未提交的清理结果。本文保留初始勘探依据，并在末尾记录用户确认后的实施与回归。初始审计中的行号对应清理前源码。

## 结论

旧设置的画框模式可以删除。正常入口已经统一使用新版：Menu 内嵌正文，标题页、游戏系统菜单和模型设置按钮使用全屏 `SettingsScene`。独立 `#/settings` 页面也复用新版，只承担深链接兼容和返回来源的职责。

本轮已清理旧设置及共享系统面板分支、失效的 AI 占位样式和动效查询、RP 调试页的重复样式转接文件、旧 AIRP 无调用者的完整版面板，以及失效选择器。

共享 `rp.css` 仍服务正式 NVL／LOG、教程、AIRP 阅读、记忆回想和 Studio。历史 AIRP 阅读组件也有存档消费者，需要保留有效路径。

## 初始检查方法与范围

- 对 1320 个 TS／TSX／JS／CSS 文件建立相对路径导入图，覆盖正式游戏、配置中的实验／工具入口和公开 UI 导出；解析失败为 0。测试及 Storybook 文件另用搜索核对。
- 对设置、共享系统面板、RP、读屏壳和旧 AIRP 样式搜索类名，再人工检查组件输出、状态值、条件分支和工具消费者。代码中的 `querySelector` 字符串不算 DOM 输出证据。
- 独立设置路由、实验入口和公共导出分别核查，避免把实验页仍在使用的样式归为无用。
- 证据：`dist/reports/settings-rp-style-audit-2026-10-02.local.json`。该文件位于忽略目录，仅作为本地审计记录。
- 初始勘探未改业务代码、未重跑构建或浏览器测试；实施后的回归证据见末尾。

## 初始清理依据

### 1. SettingsPanel 的旧画框模式无调用者

位置：`src/game-client/settings/SettingsPanel.tsx:33`。

仅有两个运行时调用者：`src/apps/menu/MenuPage.tsx:321` 传 `embedded`；`src/game-client/settings/SettingsScene.tsx:42` 传 `fullScene`。两者都会使局部 `embedded` 为真。实验入口、测试和 Storybook 未发现默认旧模式的调用。

因此以下旧模式可以一起移除：

- 旧 `RpgTab` 页签及 `moveTab` 键盘处理；新版 `SystemTabs` 自带相应行为。
- 旧 `RpgStatusNode` 配置状态和 `RpgNotchButton` 重置按钮。
- 内部额外 `Stage`、`frameClassName` 和相关导入。
- 各 section 中 `embedded=false` 的英文侧栏标签、旧进度条和旧单选视觉分支。`AiServiceSection` 的 `embedded` 参数完全未使用。

保留 Menu／全屏两种有效宿主的标题、布局与动效差异。`settings.css` 的网格、滑块和预览基础样式仍有效，不能整文件删除。

### 2. SystemPanel 的旧框架分支无调用者

位置：`src/shared/ui/patterns/SystemPanel.tsx:18`。

四个调用者为 SettingsPanel、SaveSlotsPanel、SaveArchive、MemoryPanel；实际使用全部进入 embedded 分支。该组件也没有从公开 UI 入口导出。

可以移除 `RpgHeader`／`RpgFrame` 分支，收掉 `frameClassName` 和只供旧标题使用的 `label` 参数。描述仍用于无障碍名称。主布局、正文、标题和底栏样式继续保留。

上述两项完成后，另外 **8 个旧模式 CSS 规则块**可移除：

| 文件 | 规则起始行 | 内容 |
| --- | --- | --- |
| `settings/settings.css` | 17、27、72 | 旧页签及侧栏进度条 |
| `shared/ui/styles/system-panel.css` | 15、16、17、18、25 | 旧标题、画框和切角重置按钮 |

### 3. AI 占位样式及空动效查询已经失效

当前 Model 页渲染的是 `DirectAiSettings`。`settings-scope`、`settings-status`、`settings-slot` 不再由任何组件输出，`settings-note[data-tone="pending"]` 也不再出现。

可删除规则：

- `settings.css:366`、377、382、391、400、402、412、426，共 8 块。
- `settings-menu.css:60`、61、64，共 3 块。
- `settings-motion.ts:33`、34 的两次空查询。

有效的 `settings-note` 和当前模型设置动效目标需保留。

### 4. RP 实验页有五个重复转接样式文件

`src/apps/rp/app.css` 只导入 `app-foundation.css`、`app-chrome.css`、`app-morph.css`、`app-motion.css`。四个文件又各自转接一份共享 reading 样式。

现在 `App.tsx` 直接使用 `ReadingPlayer`，它已导入 shell／morph／motion；`ReadingControls.tsx:9` 已导入 controls。可以移除这五个文件和 `main.tsx:9` 的转接导入。删除后核查一次 RP 预览，确认 CSS 顺序没有改变画面。此项主要减少维护层级，五个文件只属于 RP 实验入口。

### 5. 读屏壳残留不再产生的 ended 状态

`src/shared/presentation/adv/reading-shell.css:88` 的 `.rp-app[data-state="ended"] .rp-app__stage` 没有消费者。

`ReadingPlayer.tsx:67` 和 `FirstMorningStory.tsx:178` 只产生 `reading`／`idle`／`typing`。删除这一条选择器即可，同块中的 `reading` 光标规则有效。

### 6. 旧 AIRP 完整版面板没有入口

`src/game-client/AirpPanel.tsx:9` 默认 `compact=false`，但运行时仅有 MapPage、ManorBattleBinding、ManorBattleView 三个调用者，均显式传 `compact`。`AirpPoolPanel` 又只有 AirpPanel 一个调用者。

所以两个组件中的非 compact 分支无运行入口，包括旧完整版列表、接取／传话按钮、后续便条和内嵌历史全文。现在日志由 `CampaignReport`、`AirpJournalEntries` 和 `JournalBrowser` 组织。

可以把这两个组件收成紧凑委托提示，删除无入口分支及其专属导入、枚举和 `.airp-pool` 样式。紧凑提示仍用于历史版本委托，组件整体保留。不要连带删除其他地方使用的 AirpOnlineControls、DirectControls 或叙事命令。

### 7. 两处旧皮肤类名完全无输出

- `system-panel.css:29`、30：旧 `.abyssa-system-overlay`，共 2 块。
- `airp.css:6`：旧 `.airp-control`，1 块；同文件第 5 行组合选择器中的 `.airp-control` 可单独删去。另一个按钮选择器需结合第 6 项核查。

第 3、7 项合计 **14 个当前无 DOM 消费者的 CSS 规则块**。第 5、7 项另有 **2 条可独立删除的组合选择器**。

## 有使用者，但可以整理

### 8. 十条角色校准规则重复默认值

`src/shared/ui/styles/rp-motion.css:120` 至 129，每个角色都写 `doll-h:100%`、`doll-x:0%`、`doll-y:0%`，与 `rp-shell-seats.css:23` 至 25 的统一基准完全相同。当前游戏没有其他根级覆盖，Studio 又以内联参数预览。

这 10 块属于重复声明，可以在核对角色取景后删掉，只记录真正偏移的角色。`src/tools/studio/params.ts:199` 的 CSS 导出能力仍有用途，相关注释和导出组织方式需要同步整理。三个变量和立绘几何继续保留。

### 9. 旧 idle 动画目前只在 Studio 选中

`rp-shell-seats.css:191`、196、200 的呼吸／摇摆／颤抖规则、209 的错相延迟和三个 keyframes，仍由 `src/tools/studio/App.tsx:190` 的 `data-idle={state.idle}` 使用。

正式 `SeatActor.tsx:102` 的 idle 包装层没有这个属性，当前角色表现由 EmotionActor／ActorPerformance 驱动。适合把旧 CSS idle 演示规则移到 Studio 样式入口，连同相应 reduced-motion 处理一起迁移。不要删除正式立绘仍使用的 idle／beat 包装层尺寸链。

### 10. 设置行／滑块的 disabled 扩展接口没有调用者

SettingsRow 与 SettingsSlider 都接收 `disabled` 并输出状态属性，但所有设置 section 调用都未传。实际被禁用的是行内 Toggle。

可以进一步收掉这两个内部扩展参数、相应状态属性和失效状态规则。SettingsRow 涉及 `settings.css:87`、`settings-menu.css:62`、`system-panel-motion.css:7`、8；SettingsSlider 涉及 `settings.css:125` 和组件内部禁用转发。

此项优先级低于旧模式删除。保留 Toggle 的有效禁用行为、保存／返回按钮的禁用行为和动效乘法逻辑。

## 兼容入口与有效样式

### 独立设置路由

`SettingsPage.tsx` 只有 15 行，复用新版 `SettingsScene`。仍由 `game-shell/routes.ts:14` 注册，`settings.html`／`#/settings` 都能进入，现有路由测试也会访问。

`settings-navigation.ts:4` 的 `settingsHref` 已无生产调用者，只有自己的测试，可以单独删除。`settingsReturnHref` 仍负责深链接退出后的返回目标。

建议先删除旧画框模式，保留这个很薄的入口。若要彻底取消独立设置页，需要给旧链接设计跳转到相应宿主并打开设置的机制，再同步路由注册、构建条目和测试；直接删文件会使已有链接失效。

### RP 共享样式

`rp.css` 可从正式游戏、公开 UI 样式入口、Catalog、AIRP 实验页、Battle Loot 实验页、RP 实验页和 Studio 到达。

`RpScene` 仍在 `src/index.ts` 和 `src/patterns.ts` 公开导出。对白、旁白、章节、选择记录、掷骰及系统消息都有实际组件输出；当前态、已读态、席位、角色、LOG 和减弱动效规则都有消费者。不能依据名称或某个页面未展示就删除。

### 旧 AIRP 阅读及连接皮肤

`src/apps/mansion/MansionPage.tsx:98` 仍在没有 Director reading 且旧叙事锁定时渲染 `AirpStory`。它处理旧叙事 v1／v2、online 和 direct 状态。

`airp.css` 的 gate／online／creation-record／story-tools 等类名仍由 AirpStory、AirpOnlineControls、DirectControls 和 CampaignReport 输出。这是有效兼容路径。删除整个旧 AIRP 样式或阅读组件前，需要存档迁移方案。

### Catalog 中的旧设置组合示例

`src/apps/catalog/CompositionExamples.tsx:102` 的 `SystemConfigExample` 仍作为组件库示例使用，其 `.assembled-config` 皮肤只经 Catalog 入口加载，不属于正式设置页。可按展示需要改稿，不能算死代码，也不构成保留正式旧设置模式的理由。

## 推荐实施顺序与验收

1. 删除 SettingsPanel／SystemPanel 旧模式，保留两个现行宿主；清掉对应旧模式 CSS。
2. 删除 14 块失效样式、2 条组合选择器、2 次空动效查询及 RP 五文件转接层。
3. 收掉旧 AIRP 非 compact 面板；验证旧存档的紧凑委托提示、日志接取和历史阅读路径。
4. 整理角色重复基准、Studio idle 样式边界和未使用的 disabled 参数。
5. 独立设置路由继续兼容；若要退役，单独实施深链接重定向。

删除后的必要验证：设置正文和全屏入口、分类键盘切换、返回焦点、动效偏好持久化、SAVE／LOAD、记忆详情与回想、RP NVL／LOG 和 Studio idle。再运行类型检查、样式／模块边界和正式游戏构建。不扩展本轮到新的设置功能接入或后端协议删除。

## 实施记录

### 已完成的清理

- SettingsPanel 和 SystemPanel 只保留当前版式，删除旧画框分支、旧页签处理、额外 Stage 及无调用的参数；同步设置、存档与记忆调用者。Menu／全屏的标题和动效差异继续由现行宿主控制。
- 设置各 section 删除旧视觉分支；SettingsRow／SettingsSlider 删除无调用的 disabled 扩展，实际 Toggle 和按钮的禁用逻辑仍有效。删除无生产调用的 settingsHref，保留深链接返回解析。
- AirpPanel／AirpPoolPanel 收成当前委托提示，删除旧完整版列表、操作、全文展示及专属样式。Director 委托、旧 v1／v2 提示与回洋馆入口保持有效。
- 删除 RP 实验页的五个 CSS 转接文件，改用 ReadingPlayer／ReadingControls 已加载的共享入口。
- 删除 **44 个失效或重复 CSS 规则块**：原审计 32 块，加上 disabled 扩展 5 块、旧完整 AIRP／按钮 6 块、旧 pool 日志 1 块；另清掉组合选择器和共享 idle 减弱动效规则。
- 十条与共享基准相同的角色覆盖删除。Studio 导出只生成真正偏离基准的角色规则；呼吸／摇摆／颤抖演示迁入 `src/tools/studio/studio-idle.css`，限定在 Studio，减弱动效覆盖同步迁移并修正优先级。正式立绘的尺寸容器与表现组件保持有效。

### 回归中修正的问题

- Model 设置已把模型块放到右栏，原动效仍只查询左栏。现同时绑定左右栏标题及实际模型块，删除旧占位节点查询。
- 旧内容 8／9 和普通内容 27 经过共享 GameGate 时，AirpGameGate 会提前创建正式结算 host，导致不支持版本抛错。现在仅在已有正式版本判断成立时创建；旧叙事由自己的阅读器处理。增加真实建档回归，确认旧／普通版本不创建正式 host、不访问模型、不改变存档；正式版本的原有流程继续验证。
- 更新现有测试中过期的导入说明、委托 status 字段和底栏按钮假设；背景开关通过可见 label 操作。没有删掉对应行为断言。

### 验证与证据

- 四个范围的类型检查、模块边界（1600 个源码文件）、动效令牌和 `git diff --check` 通过。
- 最终 AST／CSS 引用检查覆盖 src／tests 的 1865 个文件、8454 条本地引用：无缺失目标，无已删除的 embedded／compact 参数残留；修正版本判断后再次通过 app 类型检查和 game 构建。
- 14 个相关单元测试文件共 75 项通过；主批次的最后一项底栏断言修正后由独立 settings-motion 5 项验证补齐。
- AirpGameGate 的 11 项单元测试通过，包含新增旧／普通版本隔离验证和原有正式流程回归。
- 9 项设置／反馈边界与动效审计构建测试通过。
- 正式 game、RP 实验入口和 Studio 工具入口构建通过；仅有既有的大 chunk 提示。
- 浏览器已验证动效偏好跨页面／重载／系统切换，以及正式 AIRP 记忆重载和回想：存档不变，无模型 POST。
- 本地补充探针 5 项全部通过：RP NVL／AVG／LOG 和图片加载、Studio idle 与减弱动效、旧 AIRP v1／v2 委托提示及旧 v1 阅读；均无页面异常或模型 POST。

上述日志及截图均在忽略目录 `dist/reports/`：

- `settings-rp-cleanup-typecheck-2026-10-02.local.log`
- `settings-rp-cleanup-typecheck-final-2026-10-02.local.log`
- `settings-rp-cleanup-tests-2026-10-02.local.log`
- `settings-rp-cleanup-motion-final-2026-10-02.local.log`
- `settings-rp-cleanup-build-2026-10-02.local.log`
- `settings-rp-cleanup-game-final-2026-10-02.local.log`
- `settings-rp-cleanup-smoke-2026-10-02.local.log`
- `settings-rp-cleanup-airp-gate-2026-10-02.local.log`
- `settings-rp-cleanup-browser-2026-10-02.local.log` 及 `settings-rp-cleanup-browser/result.local.json`
- `settings-rp-cleanup-imports-2026-10-02.local.json`

独立设置路由继续复用新版 UI；共享 RP 和历史存档协议仍有消费者。本轮没有提交或发布。
