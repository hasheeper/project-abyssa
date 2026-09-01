# 场景交接黑幕

这层解决的是独立 HTML App 之间的视觉接力，不是某一页内部的加载 spinner，也不是全局路由或游戏状态容器。调用方提供目标 URL、短文案和可选 `ready()`；共享层只保证闭幕、等待与揭幕顺序一致。

## 状态机

```text
idle → closing → closed / real loading → opening → idle
```

- `closing`：旧场景安静淡出，黑幕锁住输入；
- `closed`：页面已全黑，此时才执行导航；
- 新文档用 `sessionStorage` 接住 handoff，首帧仍是同一闭合黑幕；
- 字体、当前文档图片与可选业务 `ready()` 全部完成后进入 `opening`；
- 最慢等待有 6 秒保险，但界面不伪造百分比，只显示六面旋转体。

## 揭幕模式与顺序

| 模式 | 用途 | 当前消费者 |
| --- | --- | --- |
| `fade` | 洋馆这类铺满画布的世界场景；背景属于世界，不应像卡片一样下落 | `mansion` |
| `panel-drop` | 战斗、商店等受限画布实体面板 | `battle`、`shop` |

`panel-drop` 只在目标页读到有效的同源 handoff 时生效，顺序固定为：

```text
闭合黑幕 → 目标背景就位 → SceneArrivalTitle 显示区域名
         → 区域名淡出 → .abyssa-scene-panel 从上方装入
```

区域标题属于背景层，不得包在 `.abyssa-scene-panel` 内；否则标题会跟随面板一起下落，切换幕与实体界面失去层级差。

## 接入

从公共入口引入组件并包住页面。`transition.css` 已与 `SceneTransition`
组件共置并自动加载，业务页面不要再重复引入。全屏世界页使用默认 `fade`：

```tsx
import { SceneTransitionProvider } from "../../shared/transition";

<SceneTransitionProvider>
  <App />
</SceneTransitionProvider>
```

受限面板页显式选择 `panel-drop`，并把真正下落的实体容器标记出来：

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

## 组件与视觉约束

- `SceneTransitionProvider`：保存同源 handoff、等待目标页资源并驱动四阶段状态机；不登记业务路由。
- `SceneTransition`：覆盖安全区与画布外黑边的顶层黑幕，提供读屏状态和小型承载牌。
- `SceneArrivalTitle`：左上区域抵达标题；实验页可用 `staticDisplay` 常驻，业务页只在 incoming 揭幕时出现。
- `.abyssa-scene-panel`：仅标记实体面板的入场对象，不改变其原有缩放 `transform`，下落使用独立 `translate`。

骰子必须由 `front/back/left/right/top/bottom` 六个真实 DOM 平面组成。禁止在 `.scene-transition__spinner` 或其 wrapper 上增加 `filter`、`backdrop-filter` 或分组透明度；这些属性会把 `preserve-3d` 子面压平成单张 SVG 式假旋转。配色保持克制，不使用彩字、伪进度或宏大系统启动文案。

## 当前接入关系

- `menu` 发起前往 `mansion`、`shop`、`battle` 的 URL 导航；仓库入口尚未接入。
- `mansion` 使用 `fade`；`battle`、`shop` 使用 `panel-drop` 并各自提供背景滤镜与区域标题。
- `loading` 直接组合 `SceneTransition` 与 `SceneArrivalTitle`，只用于 `npm run dev:loading` 重放视觉流程，不是业务导航目的地。

这种 URL 接力不构成 app 间源码依赖：调用方不导入目标 app，目标页仍由独立 HTML/Vite 入口挂载。

## 动效与无障碍

- 黑幕活跃时锁住指针并给 `body` 写入 `aria-busy`；另有 `role="status"` 向读屏器播报目标场景。
- `prefers-reduced-motion: reduce` 下停止骰子与活动点动画，面板直接就位，并缩短黑幕过渡。
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
- 目标页首帧无白闪，区域标题早于实体面板出现；
- `battle` / `shop` 面板落入时背景不随之移动，`mansion` 只淡入；
- 骰子六面保持空间厚度，没有被滤镜压扁；
- 快速连点不会创建第二次导航，6 秒保险不会留下永久 `aria-busy`；
- reduced-motion 模式下无持续旋转或大幅下落。
