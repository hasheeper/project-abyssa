# 场景交接与页面 UI 入场

> 2026-09-16：已撤销 U3 F 的统一 curtain 接入，恢复本文描述的原页面交接与资源等待实现；不再依赖 UiCurtain／SceneInputBoundary。此次是回退，不是新的性能验收。

> 2026-09-17 M3：角色、商店、出征、洋馆的 UI 入场生命周期共用 `usePageUiIntro`，页面保留薄适配及不同策略。没有改黑幕、资源等待或专用演出。见 [M3 验收](../../../docs/audits/2026-09-17-ui-motion-m3.md)。

正式游戏由 `src/game-shell` 持有唯一黑幕，首次资源准备与内部路由共用本组件。页面提供短文案、`holdReady` 和原有入场样式，嵌套 Provider 自动复用外层，不再重复绘制。独立实验页面仍可使用原 Provider 完成跨文档 handoff；本组件不持有游戏规则或存档。

## 状态机

```text
idle → closing → closed / real loading → opening → idle
```

- `closing`：旧场景安静淡出，黑幕锁住输入；
- `closed`：页面已全黑，此时才执行导航；
- 游戏在同一文档内卸载旧页、挂载目标路由；独立实验页才使用 sessionStorage 跨文档 handoff；
- 业务数据就绪、实际场景挂载后，再收集并等待字体、图片与可选 `ready()`，最后进入 `opening`；
- 图片等视觉资源的等待有 6 秒保险，存档初始化不被这个超时跳过。首次启动按实际资源字节显示进度；切页只显示原六面旋转体。

## 揭幕模式与顺序

| 模式 | 用途 | 当前消费者 |
| --- | --- | --- |
| `fade` | 黑幕揭开背景；页面自行编排实体板或 UI，不让整个世界下落 | GameShell 除 battle 外的默认模式，包括角色、商店、出征、洋馆 |
| `panel-drop` | 专用战斗交接模式；实际演出仍由战斗控制 | `battle` 默认模式；具体战斗场景可显式覆盖 |

`panel-drop` 在路由抵达（或独立页面的有效 handoff）时生效，顺序固定为：

```text
闭合黑幕 → 目标背景就位 → SceneArrivalTitle 显示区域名
         → 区域名淡出 → .abyssa-scene-panel 从上方装入
```

区域标题属于背景层，不得包在 `.abyssa-scene-panel` 内；否则标题会跟随面板一起下落，切换幕与实体界面失去层级差。

## 接入

从产品内部入口引入组件并包住页面（不是公开 `@abyssa/ui` 包）。`transition.css` 已与 `SceneTransition`
组件共置并自动加载，业务页面不要再重复引入。全屏世界页使用默认 `fade`：

```tsx
import { SceneTransitionProvider } from "../../shared/transition";

<SceneTransitionProvider>
  <App />
</SceneTransitionProvider>
```

需要传统 `panel-drop` 的独立实验页可显式选择，并把真正下落的实体容器标记出来；角色、商店、出征不要再额外接此动作：

```tsx
<SceneTransitionProvider reveal="panel-drop">
  <App />
</SceneTransitionProvider>

<SceneArrivalTitle eyebrow="RIFT SECTION" title="ABYSSAL EXPEDITION" />
<main className="abyssa-scene-panel">...</main>
```

发起方在 Provider 内调用：

```tsx
const { navigate } = useSceneTransition();

navigate("./mansion.html", {
  channel: "正在返回",
  destination: "守望者之崖洋馆"
});
```

若页面还要等待存档或接口，把稳定的 Promise 工厂交给 `ready`；不要用假的进度数值：

```tsx
<SceneTransitionProvider ready={() => saveStore.hydrated()}>
  <App />
</SceneTransitionProvider>
```

游戏存档采用子组件就绪信号：`GameLoading` 通过 `useSceneReady(false)` 保持现有黑幕，读取成功或显示明确错误时卸载并释放。揭幕前会重新收集真正场景的图片，避免只检查读档占位页。角色页也接入同一 Provider。直接打开 URL 时，快速读取不闪加载文字；等待超过 250ms 才复用现有切场提示。

`GameProvider` 和 `ReadGameProvider` 只初始化一次有效会话，开发模式 StrictMode 的废弃 setup 不启动读取。初始 `pageshow` 不额外刷新；从后台或 bfcache 返回的通知会合并，同一存档版本的校验不会重置战斗演出。跨页面仍从 IndexedDB 读取并校验正式存档。

## 组件与视觉约束

- `SceneTransitionProvider`：保存同源 handoff、等待目标页资源并驱动四阶段状态机；不登记业务路由。
- `SceneTransition`：覆盖安全区与画布外黑边的顶层黑幕，提供读屏状态和小型承载牌。
- `LoadingPlaque` / `loading-surface.css`：普通加载与洋馆时间/天气切换共用的小牌材质、灰绿配色、文字和恢复按钮；只共享外观，不共享业务状态机，也不接回已撤销的统一 curtain。
- `SceneArrivalTitle`：左上区域抵达标题；实验页可用 `staticDisplay` 常驻，业务页只在 incoming 揭幕时出现。
- `.abyssa-scene-panel`：仅标记实体面板的入场对象，不改变其原有缩放 `transform`，下落使用独立 `translate`。

骰子必须由 `front/back/left/right/top/bottom` 六个真实 DOM 平面组成。禁止在 `.scene-transition__spinner` 或其 wrapper 上增加 `filter`、`backdrop-filter` 或分组透明度；这些属性会把 `preserve-3d` 子面压平成单张 SVG 式假旋转。配色保持克制，不使用彩字、伪进度或宏大系统启动文案。

洋馆时间切换幕单独 portal 到 `body`，避免受 Stage 缩放和裁切影响；层级低于普通路由幕。剧情接管时显式隐藏并暂停该幕，不能依赖原场景祖先的 `hidden`。时间提交、图片 decode/绘制等待和重试仍由洋馆原控制器管理。

## 当前接入关系

- 正式游戏由 GameShell 解析 hash 路由；旧 `map.html`／`shop.html` 等游戏入口重定向至同一壳，独立实验入口另行保留。
- `mansion` 等非战斗页面使用 `fade`；角色、商店、出征的实体主板由页面适配＋共享 page-board CSS 入场，子层次仍归页面。
- 战斗保留自己的 SceneSequence、场景匹配及 readiness，不调用普通页面 UI 入场 hook。
- `loading` 直接组合 `SceneTransition` 与 `SceneArrivalTitle`，只用于 `npm run dev:loading` 重放视觉流程，不是业务导航目的地。

调用方不导入目标 app；正式游戏的目标页面由 GameShell 挂载，不再把游戏导航解释为每次跨独立 HTML 文档。

## 共享页面 UI 生命周期（M3）

`usePageUiIntro` 只返回 `{state, reduced}`，状态为 `waiting | playing | ready`；不渲染 DOM、不执行插值、不加载图片。页面在原容器上消费状态和 CSS。当前只有四个消费者：

| 页面适配 | 开始条件（均需路由 idle） | 完整收尾 | 提前输入差异 |
| --- | --- | --- | --- |
| `useCharacterIntro` | 页面已挂载 | 920ms | focusin；Tab／Enter／空格／方向／Home／End；不含 Escape |
| `useShopIntro` | 页面已挂载 | 920ms | 角色按键＋Escape／PageUp／PageDown；focusin |
| `useMapIntro` | 真正的 `sceneReady` | 1520ms（地图演出常量） | Tab／Enter／空格／Escape／方向；focusin |
| `useMansionIntro` | 图景 presentation ready，且未被剧情 suspended | 1000ms | 地图按键；**不因 focusin 收束**，输入根为 viewport 的 `.mansion-app` 祖先 |

调用配置沿用页面常量，按键列表保持引用稳定：

```tsx
import { usePageUiIntro } from "../../shared/transition/usePageUiIntro";

const intro = usePageUiIntro({
  ref, durationMs: PAGE_INTRO_END_MS, ready: sceneReady,
  keys: PAGE_INTRO_KEYS, settleOnFocus: true,
});
```

- 只有 `ready && !suspended && phase === "idle"` 才能第一次起播或提前输入收束，不能用计时器伪造资源就绪。
- 每次挂载只起播一次；内容重渲染、readiness 抖动、减弱偏好恢复、洋馆剧情返回均不重播。真正卸载后重新进入才重启。
- playing 仅有一个页面收尾计时器；后台隐藏、减弱动态、离场 closing／closed、起播后的 suspended 均收束。首次 hidden／reduced 仍等待就绪条件，然后直接 ready。
- 主键 pointerdown、click，以及各页声明的焦点／按键在捕获阶段同步收束，随后正常执行业务事件。不吞点击，不阻止默认行为；忽略修饰键／输入法组合／根外键盘事件（body 导航键除外）。
- ready 时移除本 hook 的入场输入、visibility 监听并清除计时器；卸载同样清理。`useUiMotion` 原有的偏好订阅仍按组件生命周期保留，不引入常驻 RAF／全局轮询。
- 收尾时间属于整页编排，不等于主板的 820ms。不要让收尾早于立绘、TAB、地图地标等末组动作。

menu 在 opening 阶段起播及对白就绪时点不同，保留 `useMenuIntro`；Logo、战斗、角色切换、地图纸片、AVG、时间幕和天气也不迁入此 hook。该能力依赖产品路由，只留在 `shared/transition`，不导出到公开 UI 包。

## 动效与无障碍

- 黑幕活跃时锁住指针并给 `body` 写入 `aria-busy`；另有 `role="status"` 向读屏器播报目标场景。
- `prefers-reduced-motion: reduce` 下停止骰子与活动点动画，面板直接就位，并缩短黑幕过渡。
- M4 实测发现黑幕 idle 后三个活动点仍在隐藏层循环，现仅以 `:not([data-active])` 暂停；closing／closed／opening 的原活动点关键帧、速度和错峰均保留，黑幕就绪／锁输入／六面骰结构不变。不能把隐藏层运行数量等同于可见 FPS。
- `maximumReadyWaitMs` 只是防止永久黑屏的保险，不代表资源成功，也不应显示为百分比。

## 防白闪契约

每个 HTML 入口在 bundle 之前都要内联同一底色：

```html
<style>
  html,body,#root { width:100%; height:100%; margin:0; background:#020506 }
  body { overflow:hidden }
</style>
```

不能只依赖应用 CSS；跨文档导航时，CSS 下载和执行之前仍可能出现浏览器默认白底。

## 验证清单

- 从 `menu` 分别进入洋馆、商店和战斗，确认旧页完全闭合后才导航；
- 目标页首帧无白闪，等待真实资源与黑幕揭开后再播放页面 UI；专用区域标题遵循原演出；
- 角色／商店／出征主板落入时背景不随之移动；洋馆只让各 UI 小组和头像进入，不下落整个世界；
- 骰子六面保持空间厚度，没有被滤镜压扁；
- 快速连点不会创建第二次导航，6 秒保险不会留下永久 `aria-busy`；
- reduced-motion 模式下无持续旋转或大幅下落。
