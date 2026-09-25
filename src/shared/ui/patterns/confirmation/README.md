# 居中操作确认

`ConfirmationDialog` 用于覆盖、删除、离开未保存页面等需要玩家明确选择的操作。区别于会自行退场的 `SceneFeedback`，它居中显示、暂时隔离背景输入，必须确认或取消。当前已由档案操作、游戏错误恢复、AIRP切换手写稿和删除本机连接等宿主使用；组件本身不读写存档或调用API，业务提交由回调负责。

## 外观

复用事件反馈的青灰透景底板、微弱菱形纹理和暖白文字；背景保持清晰，不加厚重画框、实心色块和正文／按钮间的硬分割线。底板中心保持 64% 不透明度，仅左右 40px、上下 18px 做透明渐变，纹理随边缘收淡；窄容器收为 22px／16px。不使用大范围雾感、blur/backdrop-filter，文字和按钮不参与边缘遮罩。宽 620 authored px，随 Stage 整体缩放；窄容器自动收拢内边距，长内容在面板内滚动。

底纹只承担隐约的材质感：使用中性灰绿，纹理层整体透明度为 22%，叠加原 SVG 的低透明度后有效墨色不足 1%。不提高图案对比度，不改变背景板深度，也不模糊场景。

标题 → 简短后果说明 → 左取消／右确认。按钮沿用 156px、至少 44px 命中区的单线斜切角外形，17px HTML 标签。默认确认用青灰色；`tone="danger"` 只改变确认文字、描边和顶部标记为低饱和红色，不把底板或按钮涂红。优先使用「确认覆盖」「删除档案」这样的具体操作名。

## 接口和交互

```tsx
import { ConfirmationDialog } from "@abyssa/ui/patterns";

<ConfirmationDialog open={confirmOpen}
  title="覆盖这份档案？" description="原有进度将被当前进度替换。"
  confirmLabel="确认覆盖" busy={saving}
  onCancel={() => setConfirmOpen(false)}
  onConfirm={saveSelectedSlot} />
```

- 保持组件挂载，用 `open` 控制，不能写成 `open && <ConfirmationDialog />`；否则退出动画和焦点交接会被截断。
- 回调只表达用户意图，不自动执行业务、关闭弹窗或计时。宿主负责成功后关闭、失败后解除 `busy` 并展示原位错误。
- 默认焦点在取消；Tab／Shift+Tab 环绕，Enter／Space 只激活当前按钮，Escape 取消。点击遮罩不关闭，避免误触。
- 异步提交时，宿主应在确认回调中立即设置 `busy=true`。此时两按钮通过 `aria-disabled` 保留焦点但阻止操作，Escape 也不取消；确认标签变为 `busyLabel`（默认「处理中…」），通过独立 status 播报。不提供请求重试或超时机制，由宿主保证请求终结后恢复。
- `cancelLabel` 默认「取消」，`confirmLabel` 默认「确认」。`description` 为纯文本，支持换行；原始 API 错误应交给 `InlineFeedback`，不要塞进后果说明。
- 使用现有 `UiModal` 行为，不 portal、不锁 body 滚动；放在 Stage 内即可覆盖相同的缩放画布。独立 `confirmation` 预设不影响 `RpgModal` 的 surface/manor。
- 退场完成之前继续隔离输入，之后焦点返回来源按钮；支持 `returnFocusRef` 指定来源，`onPresentChange` 通知实际呈现周期。

## 与侧上提示不同的动效

中间确认窗**原位分层淡变，不位移、不缩放、不模糊**。遮罩／底板／正文／两个按钮分别拥有透明度，不叠加整窗淡化。统一参数为 `tokens.json.confirmation`：

- 入场 525ms：暗幕先铺开；60ms 后底板和顶部细线渐显；150ms 后正文淡入；260ms 后取消按钮进入，确认按钮再错开 45ms。
- 退场 420ms：确认按钮先退、取消随后；正文从 70ms 起退出，底板从 160ms 起退出，暗幕最后从 240ms 起淡出。
- 输入隔离到暗幕真正结束，才返还焦点。关闭中重开从当前透明度接续，不重挂节点；异步状态或文案更新不重播。
- 减弱模式移除所有错峰，统一 80ms 纯透明度变化，退出期间更改偏好也生效。

侧上 `SceneFeedback` 是整体短距离滑入／淡退，不借用确认窗的分层编排。完成通知等待确认窗退出后才入场，不从尚未撤走的黑幕后提前出现。

预览：Storybook → Patterns / Confirmation Dialog → Interactive、Danger、Narrow、In Stage、Reduced Motion。关闭弹窗后，可用「侧上提示」「事件结果」「收起提示」比较入场、退场和替换。确认仅演示 1.2 秒处理中状态及完成提示，不写入档案、不发起网络请求。
