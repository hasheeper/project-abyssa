# UI Motion：共享动作与参数

> 共享动效基线（2026-09-17）：M1 失效残留清理、M2 相同动作与参数收拢、M3 四页入场生命周期收拢、M4 校验与维护收口已完成。保留回退后的逐页演出，不恢复 U3 批量迁移；UiSurface／UiCurtain 不重新引入。标题选中／双菱形、视差和 Logo 后四菜单入场仍是独立效果。普通 UI 的手动减弱偏好不代表全项目统一；洋馆首次开窗长帧仍待单点调查。见[M4验收](../../../../docs/audits/2026-09-17-ui-motion-m4.md)和[开窗性能追踪](../../../../docs/audits/2026-09-17-mansion-window-performance-followup.md)。

执行层是 `motion/react`（固定 `motion@13.3.0`）＋共享 CSS，不向业务暴露引擎 API。

## 当前消费者与所有权

| 能力 | 实际接线 | 不能自动推广到 |
| --- | --- | --- |
| control | IconButton（含 ArrowButton／关闭键）、RibbonButton、RpgNotchedPillButton；MapCommand 显式复用 | 所有形状按钮、TAB、标题菱形、menu 轮盘 |
| surface | RpgModal → UiModal，默认预设；组件调用者沿用原 API | 页面黑幕、非模态地图侧板、整页入场 |
| manor | 洋馆 InventoryDialog／ResourceInventoryDialog、CampaignJournal 的仓库／日志／整备功能窗 | 其他页面默认窗口 |
| content | JournalBrowser 阅读区、ResourceInventoryDialog 物品详情、ShopCounter 商品说明 | 等待新图解码的 CharacterContentSwap／角色整体切换 |
| story-choice | `StoryChoices` → 首晨、战斗教学、AIRP、回忆／成长的 AVG／NVL，标题式逐项入场、双菱形跟随与选中退场；LOG 隐藏选项 | CG 与非整页阅读场景 |
| page-board | CharacterBoardScreen、ShopCounter、map route 引入同一 CSS，现有容器播放 | 战斗 960ms 专用主板、洋馆世界层 |
| 入场生命周期 | `shared/transition/usePageUiIntro` → 角色／商店／地图／洋馆适配 | menu opening 时序、SceneSequence、Logo／AVG／天气 |

共享动作并不要求共享所有编排。新增消费者先选择上述职责，确认实际入口导入样式，再检查默认／减弱、关闭中重开、提前输入和卸载；不要为了接库重复动画父子两个整框。

## 调用方式

```tsx
import { AbyssaProvider, RpgModal, UiContentTransition } from "@abyssa/ui";
import "@abyssa/ui/styles.css";

<AbyssaProvider motionPreference="system">
  <RpgModal open={open} onClose={close} title="日志">
    <UiContentTransition contentKey={selectedId}>
      {reading}
    </UiContentTransition>
  </RpgModal>
</AbyssaProvider>
```

- control：`RpgNotchedPillButton`、`IconButton`、`RibbonButton` 原 API 不变；120ms 提亮、80ms／1px 下压，仅内部美术移动，原生点击区不动。
- surface：`RpgModal` 进入 220ms／退出 160ms，最多 8 个设计像素，不缩放正文；遮罩与面板同步。
- content：`UiContentTransition` 用稳定业务 ID；首次不播，同 ID 更新不播，替换 120ms 淡显，仅一份活内容，无退出队列。它不替业务重置滚动或表单。
- menu-section：Menu 内部栏目使用独立可逆时间轴，首页沿入场分层反向退场 900ms、返回 1180ms；栏目大标题退出 360ms、进入 680ms，存读档／设置正文各用下文的逐项时序。背景／侧栏不重播，只有离场元素恢复。连续改选不重启退场，半途返回从当前进度反向接续；减弱动效与隐藏页面直接收束。参数见 `tokens.json.menuSection`，不接管首次 `useMenuIntro`。
- page-board：角色、商店、出征主板显式复用 820ms／34px 缓落与 240ms 显现，不接管子内容时序。
- manor：洋馆仓库、日志、整备显式选择的 760ms 窗口；默认 surface 不变。
- story-choice（2026-09-19）：首晨选项复用横幅美术与标题节奏，460ms／10px、80ms 错拍；不使用标题流光或常驻漂浮。单对双菱形随鼠标／键盘选中项移动，文字不缩放。点击立即提交，其他行先退，选中行停留 140ms 后 240ms 淡退；普通关闭 160ms，减弱 80ms。参数在 `tokens.json.storyChoice`，未改标题／Logo 实现。

以上参数统一来自 `tokens.json`。修改后运行 `npm run motion:tokens`；`npm run motion:check` 校验三个生成产物：`styles/motion-tokens.css`（控件）、`motion/page-board.css`（主板动作）、`motion/modal-tokens.css`（洋馆正文节奏）。不要手改生成文件。TS 的 `presets.ts` 直接读取同一 JSON，在 Motion 边界转换为秒。

样式按消费者加载：三页通过模块直接导入 `page-board.css`；`UiModal` 直接导入洋馆生成参数和窗口样式。公开 `@abyssa/ui/styles.css` 包含主板预设，不增加 JS 导出或包装组件。专用演出仍可保留自己的 keyframes／过渡。

## 页面主板

在**原有实体板容器**上消费变量，不增加 DOM 层，也不动画整个 Stage：

```css
.my-board[data-intro="playing"] {
  animation: var(--abyssa-motion-page-board-enter);
}
```

- 共享动作只拥有 `translate`／`opacity`，不覆盖宿主的 `transform:scale(...)`、尺寸、裁切或点击区域。
- 页面提供就绪、暂停、收尾和提前输入策略；角色、商店、出征、洋馆通过薄适配调用产品内部的 [`usePageUiIntro`](../../transition/README.md)。立绘、TAB、正文层次仍归页面，没有 readiness 轮询、共享 RAF 或全局动画状态仓库。
- `abyssa-ui-appear` 是同文件内的纯淡入关键帧；商店资产、地图图景复用它，但继续保留各自的时长与延迟。
- M2 保留了原 hook，M3 才合并其重复 effect，四页结束时点仍为 920／920／1520／1000ms。测试检查现有收尾时钟晚于主板和局部 CSS 动作；参数改长时必须同时检查页面完整时序，不能只改一个 duration。路由依赖不进入公开 UI 包。
- 手动／系统减弱将主板预设置为 `none`；页面原有的 waiting 可见性与减弱收束逻辑保留。

战斗主板仍为独立的 960ms 编排，仅登记，不自动迁入本预设。Logo、menu 视差、地图弹簧、角色切换不属于 page-board。

## 窗口生命周期

### Menu 存读档（场景内，不是窗口）

`tokens.json.saveSlots` 管理 1940ms 入场、1440ms 退场、分页和模式轻切换。入场为固定青光导轨的裁剪揭示（不缩放渐变）→交错菱形／槽位→TAB 与附件。顶部说明、每个 TAB、导入图标、底部各按钮单独绑定透明度，不动画整组容器；附件从 1440ms 起以 60ms 间隔、240ms 单项时长逐个显现。退场读取同一编排的反向时间、反向缓动，附件先走，存档／菱形依次收起，线最后收回。等待档案时先完成导轨，在 580ms 处等待数据；呼吸节点与最终网格共用几何，没有独立加载面板或文字。

`useMenuView` 驱动栏目时钟，`useSaveSlotMotion` 在提交后绑定 DOM；出场完成回调不得先将旧时钟归零，否则仍挂载的旧页面会反闪。数据就绪不重新采集既有元素的动画起点；分页只退入槽位与槽内导出，导轨、顶部说明／TAB／导入及底部按钮持续可见，不能把导航控件乘上分页透明度。完成帧保持终值，减弱／后台切换直接收束。SAVE↔LOAD 保持同一个面板，modeOpacity 只淡换槽位、装饰线和短错峰附件（320ms 退／460ms 入），不再淡化背后黑幕，导轨不重绘，也不重新扫描档案。大标题仍走共用 360ms 撤回／680ms 划入，不改形状、排版或另用原地换字。主 Menu 的 900ms 退场／1180ms 返回保持不变。

`MenuSystemBackdrop` 在 Menu 正文宿主内常驻，SAVE／LOAD／SETTINGS 共用同一个透景黑幕，不随页面卸载、模式互切或 TAB 翻页重播。只有跨越主 Menu／系统栏目边界才淡变：初次进入存读档沿用 720ms、设置沿用 360ms；返回主 Menu 时沿用对应栏目末段的退场窗口。中途改选系统栏目不会重新计时或将未完成的透明度强设为 1，取消返回则从当前透明度接续。原渐变、范围和遮罩不变；局部装饰线、标题与逐项内容仍由各自的时间轴控制。

### 标题读档

标题 `TitleArchive` 同样使用 `saveSlots` 的 1940ms／1440ms 时序，但不使用 UiModal 的整窗位移或加载页面。标题自身拥有 presence／输入门禁与透景背景，大号 LOAD 和原标题内容不与档案互相重叠；`ArchiveRecordGrid` 每页 4×2，以显式 `data-slot-order` 沿上下交错顺序复用逐项编排。等待读盘只推进到展线完成，再从原时钟继续，不能归零重播；关闭完成后才允许空档入口切到新游戏设置。翻页、归档过滤与工具返回重新绑定变化节点，不重置既有导轨和附件。原 Menu 的 5×2 布局与时序不变。

### Menu 设置逐组件动效

标题与独立设置入口由 `SettingsScene` 提供同一编排。它与标题 LOAD 共用 `SystemSceneFrame`／`system-scene.css` 的背景、标题和布局，以及贯穿退出阶段的输入门禁／焦点恢复；不再使用旧画框或整窗位移。标题入口不导航、不重建 Stage／CG。分类小标题参与正文淡换，大号 SETTINGS 由宿主时钟独立控制，分类切换不得淡化它、背景或导航按钮。背景底纹在独立入口仍是本页预览，标题入口不改写宿主场景。仅界面动效偏好依旧全局持久化，其他设置不扩大接入范围。

`tokens.json.settingsPanel`、`settings/settings-motion` 与 `useSettingsMotion` 已接入 Menu。保留共用大标题的撤回／划入、顶部 TAB 位置、左栏与场景，不复用存档的展线或缩放，也不再淡化整个正文容器。

- 入场共 1120ms：小标题／状态与局部装饰线先进入，每个设置行作为一个完整组件逐项淡入，行内标签、数值、滑块不拆开。正文从 140ms 起以 48ms 间隔、280ms 单项时长出现；右侧取景组、预览、状态条目分别绑定。顶部说明、每个 TAB 和底部各按钮从 680ms 起以 50ms 间隔、220ms 单项时长进入。只改变 opacity；从存读档切入时共享黑幕保持原状。
- 退场共 760ms：同一 reveal 时钟反向播放，TAB／按钮先退，正文组件反序淡出，局部装饰线最后消隐。切到 SAVE／LOAD 时共享黑幕常驻，只有返回主 Menu 才淡出。不在结束前归零动画时钟，不提前卸载旧组件。
- 分类 TAB 切换：背景板、大标题、TAB、底栏保持；旧正文在 320ms 内依次淡出后才替换 DOM，新分类在 520ms 内逐项进入（正文单项 220ms、间隔 32ms）。连续改选只提交最后请求，半途反向从当前进度接续。
- `useMenuView` 的栏目时钟只提供 reveal 进度，背景与组件各自消费，不再叠乘整块正文 opacity。改变滑块或单选值不重播入场；预览组件出现后才启动打字，退场保留已显示文字到组件消隐。
- 分类过渡锁定正文控件，顶部分类仍可改选；栏目过渡沿用 Menu 的 inert 门禁与左栏切换。减弱动效／页面隐藏直接收束。测试覆盖逐项进度差异、反向时序、分类中断、值更新不重播、预览启停与卸载清理。

### 洋馆功能窗（2026-09-17，显式选择）

仓库、日志、整备使用 `<RpgModal motionPreset="manor">`，保留原尺寸与美术。默认 `surface` 不变，不自动推广到其他页面。

- 框体与招牌共同从上方 30px 缓落，760ms；面板淡入 240ms，独立暗幕 180ms。
- 正文延迟 140ms 后用 380ms 淡入并轻移 8px；头部、导航、底栏延迟 100ms。按区域播放一次，不按物品逐个播放，数据更新不重播。
- 退出 200ms、上移 8px；减弱模式无位移，仅 80ms 淡变。动画结束释放面板的临时 `will-change`。
- 不使用整幅 `backdrop-filter`；宿主在 `open || presented` 期间暂停背景装饰运动，退出完成才恢复。

框体、退出距离、暗幕、淡入、正文与头尾节奏统一来自 `tokens.json.manorWindow`；减弱时长复用 `surface.reducedMs`。`manorWindowMotion` 是该对象的直接引用，`modal-motion.css` 只消费生成的 CSS 变量。退出收尾仍等待真实动画完成，不添加独立计时器。洋馆页挂件、头像与房间详情的入场仍由页面自身管理。

### 通用生命周期约束

保持 `<RpgModal open={open}>` 挂载，**不要**写 `open && <RpgModal>`。后者会把负责退出的 presence 边界一起移除。

窗口用 Motion 的 `AnimatePresence/usePresence` 管理生命周期，`animate` 负责可中断的插值，完成后通知 `safeToRemove`；无自建定时退出引擎。关闭中重开使旧完成回调失效并接续当前位置；关闭中改变减弱偏好也会中断旧动画。

有外部背景 `inert`／快捷键门禁的宿主，使用可选 `onPresentChange` 同步“仍在呈现”，门禁为 `open || presented`，不要自行延迟 N 毫秒。退出期间焦点留在非业务容器，子控件 inert，鼠标和键盘不穿透；真正卸载才还焦点。首批标题与洋馆已经接好。

窗口保持内联 Stage，不 portal、不锁 body、不覆盖宿主的布局 transform。宿主因路由卸载时即时清理监听，不向旧页面抢焦点。

## 减弱与隔离

### 剧情选择生命周期

保持 `<StoryChoices decision={decisionOrNull}>` 挂载，让内部 presence 完成退场；不要在外层用条件删除组件。选择点 ID 来自业务，普通更新不重播，成功清空或更换 `decision`，失败回调必须 reject（把会话返回的 `null` 在宿主转为失败）。`onPresentChange` 包括退场阶段，宿主阻止其间推进下一句，不能为了视觉效果延迟存档命令。

NVL 通过 `RpScene.actions` 自然占位；LOG 隐藏选项并释放高度，同布局来回不重建日志和立绘。正文区与「回到最新」共同留在选项上方。所有整页阅读入口共用 `ReadingControls`、`useReadingPresentation`、`useReadingPlayback`、`useReadingReview` 和 `StoryChoices`。`ReadingPlayer` 是公共舞台，首晨仅保留特殊帧适配；原 NVL 预览也反向使用公共实现。版式切换和回看不推进存档或选择，原局部 `ReadingModeTools`、旧 `StoryChoicePanel` 已移除。

AUTO／SKIP 只有一份普通阅读调度；AVG 由对话打字机报告完成，NVL 观察现有最后一字 CSS 动画的完成 Promise，不另复制字速时钟。无动画／减弱模式直接就绪，SKIP 利用既有 `data-settled` 展开文本。播放在选择、确认、场景末尾、LOG／重播／切换、失焦／隐藏和业务错误处停止。`RpScene`／`rp-*` 保留为内部名称，界面称为 NVL。详见[AIRP 生成反馈、阅读与恢复](../../../../docs/architecture/AIRP_FLOW_AND_RECOVERY.md)。

当前横幅为 620×54 设计像素／17px 字，不再重复显示选择提示。已选结果以 `RpMessage.kind = "choice"` 留在阅读流中，沿用已有消息入场／hydrate；不是新的交互按钮，也不改存档结构。角色色由内容适配器传入 `actor.accent`，不与中性选择条的颜色绑定。

### 偏好范围

`AbyssaProvider.motionPreference` 只接受 `system | reduced`。省略时继承外层；没有 Provider 时跟随系统。系统变化实时生效，不支持强行覆盖系统减弱。

减弱下控件与内容直接到终态，窗口去掉位移、淡变 80ms。产品持久化位于 `shared/preferences`，键为 `abyssa:ui-motion:v1`；UI 包不读写存储，不依赖 `GameRecord`。保存失败保留会话选择并在设置页提示。

Logo、剧情立绘／对白、战斗、天气和 WebGL 专用演出不消费本批手动开关，继续各自策略。形状按钮、页签、页面转场和手工复用按钮美术已恢复迁移前实现；不继续自动推广 U3，不因 CSS 类名相同就宣称全库已统一。鼠标指针／点击效果未加入。

Storybook：`Foundation/UI Motion`。`Standard`／`Reduced` 保留默认窗口；新增 `Page Board`／`Page Board Reduced` 和 `Manor`／`Manor Reduced`。主板直接使用共享 CSS 变量，洋馆直接使用 `RpgModal motionPreset="manor"` 与现有功能窗样式；无预览专用关键帧。支持主板重播、连续内容替换、窗口关闭中重开，不依赖游戏存档。

## 检查与性能记录

```sh
npm run motion:check
npm run motion:audit
npm run build:game
npm run motion:audit -- --json --build
node --test tests/build/ui-motion*.test.mjs tests/build/route-styles.test.mjs
```

`motion:audit` 只读源码，报告未引用候选、重名、同内容关键帧和明确允许的 reduced 替代；检查 CSS shorthand／变量及 TS/JS 字面字符串，但不模拟完整 cascade，也不把动态类名判死。候选不导致自动删除或 CI 失败；已有明确契约仍由测试严格保护。4 组跨文件 RP 减弱替代按实际导入关系登记，不允许任意同名定义借 reduced 名义绕过检查。

`--build` 按 Vite manifest 统计游戏壳＋单一路由的静态依赖闭包，每个 JS/CSS 文件只算一次；另列相对游戏壳的新增量，不递归累加所有 dynamicImports。gzip 为逐文件 level 9 的字节数，不是实测网络流量，图片／字体／数据另计。

运行 `npm run motion:profile` 可在独立的 `127.0.0.1:5198` 原点检查生产构建。它只给验收响应加被动 PerformanceObserver／页面阶段记录和「记录动效快照」按钮；不改磁盘构建、游戏 JS/CSS 或用户原开发存档，不加 RAF／轮询，不替换事件原型。验收 HTML 的资源哈希与 worker 元数据同步重算，仍启用完整性校验。停止后重启可读取新构建。

测量 JSON 位于 DOM 的 `#abyssa-motion-audit`。分别记录新文档加载、可见 playing→ready 和窗口交互，注明资源缓存状态；300 条上限触发时 `truncated=true`，应重新加载再测。pagehide 清理后标记 `stopped=true`，从 bfcache 恢复须刷新再采样。支持情况明确记录，未支持的 long-animation-frame 不能记成零；快照区分 running／paused／finished 和专用常驻动画。模态输入门禁可能拦截 QA 按钮，不要用旧快照判断窗口内状态。工具按钮只用于 QA，不属于正式 UI。不要把一次采样、回调数量、源码行数或关键帧总量说成 FPS 提升。见 [M4 验收与限制](../../../../docs/audits/2026-09-17-ui-motion-m4.md)。
