# Battle UI 表现层基线

> 状态：概念原型基线
> 更新日期：2026-08-30
> 适用入口：`battle.html` / `npm run dev:battle`

本文只描述裂隙远征的画框、主题、布局和场景交接。战斗 command、canonical state、RNG、存档与结算规则仍以 [`README.md`](README.md)、[`DEVELOPMENT_GUIDE.md`](DEVELOPMENT_GUIDE.md) 和 `domain/` 文档为准。

## 1. 所有权边界

- UI 皮肤描述整支出击编队的指挥体系，不描述单张角色卡的阵营。
- 混编队伍进入战斗后仍只使用一套外框；角色力竭、换目标或换回合都不会自动换肤。
- `uiSkin` 是 React 表现状态，不进入 canonical battle state、undo、存档 DTO、规则版本或事件 trace。
- 右上角 `UI FRAME` 按钮是原型期的人工巡检入口，正式流程可以由编队或剧情在进入战斗时传入受控 `uiSkin`。

`ExpeditionBattleScreen` 同时支持：

- `uiSkin` + `onUiSkinChange`：受控模式；
- `defaultUiSkin`：独立演示时的非受控初值；
- 未传参数：默认 `timber`。

外层 `App` 持有当前皮肤，并把同一个值同时交给 Stage 背景类和战斗面板，防止“外面青色、里面金色”这类不同步。

## 2. 四套皮肤

| ID | 界面语义 | 外框构成 | 背景倾向 |
| --- | --- | --- | --- |
| `timber` | 原生木框 | 不加载阵营 PNG；保留木质 rail、黄铜层和原始几何 | 棕黑、低饱和 |
| `hero-party` | 勇者小队 | 金色顶饰与四角；四边以连续金属脊线为主，只留极淡编织压纹 | 青黑底、暖金高光 |
| `demon-cadre` | 四席摄政 | 青色顶饰、四角与完整编织边 | 冷青、灰黑 |
| `demon-lord` | 魔王亲征 | 猩红顶饰、四角与完整编织边 | 暗红、黑褐 |

皮肤清单与资产只在 `battleUiSkins.ts` 登记。`ExpeditionBattleScreen.tsx` 根据 definition 决定是否渲染顶饰、角件和 `FrameEdgeWeave`；不要在 JSX 中为某一套皮肤另写第二张结构树。

### 2.1 角件与四边衔接

层级从下到上为：

```text
shell / rails → edge weave (z5) → corner ornaments (z6)
header panel (z2) → top ornaments (z3) → subtitle / controls
```

四边从距角件 82px 处开始，在角件下方重叠，角件负责遮住接缝。勇者主题不能只挂四角 PNG 而关闭四边层，否则角件的长尾会在半途突然断开；它使用同一 `FrameEdgeWeave` DOM，但由 hero 专属 CSS 隐去 overpass、弱化 strand，只留下连续金色 rail。

## 3. 颜色契约

主题变量分为四组：

- `--battle-skin-*`：强调色、亮色、柔和色与弱文字；
- `--battle-frame-*` / `--battle-board-*`：外框、金属、最内层底板和结构线；
- `--battle-detail-*`：账本、意图、骰盘、按钮、弹窗等内部结构色；
- `--battle-scene-*`：同一张战斗背景图上的色调与遮罩。

结构色可以随皮肤变化，战斗语义色不能被整页染色覆盖：

- 生命、受伤、致命与狂暴保持危险语义；
- 治疗、格挡和角色卡各自的功能色保持可辨认；
- 金币、晶石、材料与骰面品质继续使用内容语义色；
- 锈铭、金铭、封印灰与万能命数不因外框阵营而失去区分。

主题最内层 board 在原有 `--battle-board-background` 上增加轻微黑色纵向罩层与内阴影，以获得更深的承托感；该处理不滤到怪物图片、文字或战斗特效。账本等内部面板继续从 `--battle-detail-surface-deep/surface/raised` 派生，禁止重新写死木棕色。

## 4. 画框与内容几何

外层 shell、rail、brass、board 的尺寸仍完全遵守 `shared/stage` 画框契约，四套皮肤不得改变可见外沿。战斗只在 board 内部减少空带：

| 项目 | 共享默认 | Battle 基线 |
| --- | ---: | ---: |
| 上内边距 | 60px | 36px（向上 bleed 24px） |
| 下内边距 | 38px | 20px（向下 bleed 18px） |
| 内容新增高度 | — | 42px |
| 敌方面板 | 280px | 322px |
| 我方面板 | 497px | 497px，不变 |

新增的 42px 全部交给敌方舞台；右侧账本随整个 interior 同步增高。我方角色卡、骰盘和五列锚点不缩放，底部 ActionDock 用下 bleed 抵消定位，仍压在原来的外框基线上。

这些数值集中在 `.abyssa-expedition-frame` 的 `--expedition-content-bleed-*` 派生变量中。调整时必须同时检查：

1. 顶饰与敌方面板之间仍有可读的空隙；
2. 右侧账本上下边与左右内容区平齐；
3. ActionDock 不掉出底框，也不遮住骰子；
4. 四套皮肤使用完全相同的几何。

## 5. 场景交接

战斗入口由 `SceneTransitionProvider reveal="panel-drop"` 包裹：

- `SceneArrivalTitle` 先在背景层显示区域名；
- `.abyssa-expedition-frame.abyssa-scene-panel` 随后从上方装入；
- Stage 战斗背景不会跟着实体面板下落；
- 首帧黑底由 `battle.html` 内联，避免跨文档导航白闪。

完整协议见 [`../../shared/transition/README.md`](../../shared/transition/README.md)。

## 6. 文件地图

| 文件 | 职责 |
| --- | --- |
| `App.tsx` | 持有受控皮肤，并同步 Stage 背景与内部外框。 |
| `battleUiSkins.ts` | 皮肤 ID、文案、顶饰、角件与连续边配置。 |
| `ExpeditionBattleScreen.tsx` | 切换器、皮肤 data attribute、装饰 DOM 与业务 UI。 |
| `expedition.css` | 四套 token、背景滤镜、框体层级、内部组件换肤和布局几何。 |
| `App.test.tsx` | 外层 Stage 与内部受控皮肤同步。 |
| `ExpeditionBattleScreen.test.tsx` | 四皮肤循环、装饰存在性、交互时序与关键 CSS 合同。 |

## 7. 验证清单

自动验证：

```sh
npm run typecheck
npx vitest run src/apps/battle
npm run build:battle
git diff --check
```

浏览器至少检查：

- 四套皮肤逐一切换，Stage 背景、账本、骰子、意图和弹窗色调同步；
- 勇者四角与四边连续，青色／猩红编织边不被 hero 规则削弱；
- 顶饰位于标题面板之上，角件位于连续边之上；
- 顶部与底部空带已收窄，敌方面板和右侧账本没有溢出；
- 普通生命、危险、治疗、金币、晶石和骰面品质仍能靠颜色区分；
- 从 `menu` 进入时，区域标题先出现，战斗面板后落入；直接打开 `battle.html` 时不强制播放 incoming 动画；
- 控制台无错误，`prefers-reduced-motion` 下没有持续旋转或大幅落入。
