# 场景反馈（独立组件）

这是固定舞台／事件驱动 UI 的反馈组件，已用于存档操作、商店交易和新档奖励。宿主负责实际业务与展示内容，组件只负责视觉、计时和播报。

需要「确认／取消」的操作使用独立的 [`ConfirmationDialog`](../confirmation/README.md)：沿用同一材质和轻透按钮，但居中显示、隔离背景输入，不自动退场。

## 使用边界

| 组件 | 用途 | 放置方式 |
| --- | --- | --- |
| `FeedbackNotice` | 操作成功、普通提示、可自行恢复的条件不足 | 当前内容区的空白带；宿主保持固定锚点 |
| `RewardNotice` | 单件道具或货币的获得提示 | 与轻提示共用侧上锚点，可向下叠放 |
| `EventResult` | 完成任务、获得物品、开放区域 | 场景中部的可读区，避开人物脸部和底部对话框 |
| `InlineFeedback` | 写入失败等需要处理的错误 | 出错操作附近，保留到问题解决；可附重试 |
| `SceneFeedback` | 上述短提示与结果的受控入场、停留、退场 | 普通 DOM 容器，无 portal、固定坐标或遮罩 |

`FeedbackNotice` / `RewardNotice` / `EventResult` 是静态视图，不自带计时或 live region。`SceneFeedback` 提供非打断式播报。`InlineFeedback` 的错误文案使用 alert，但不抢焦点；重试按钮只调用宿主回调。

```tsx
import { SceneFeedback, type SceneFeedbackEntry } from "@abyssa/ui/patterns";

const [feedback, setFeedback] = useState<SceneFeedbackEntry | null>(null);

// 只在真实业务提交成功后设置展示内容。所有奖励在业务层结算。
setFeedback({ id: "presentation-001", kind: "notice", tone: "success", message: "档案已保存" });

<div className="your-scene-feedback-anchor">
  <SceneFeedback entry={feedback} paused={sceneCovered}
    onDismiss={id => setFeedback(current => current?.id === id ? null : current)} />
</div>
```

每次新展示使用新 `id`；同 id 更新内容不会重新入场或重置停留时间。`durationMs` 在该次挂载时确定，`null` 表示由宿主收起。默认完整入场后开始停留：轻反馈 4 秒、结果 6 秒；长内容可延长或暂停。切到后台/宿主传入 `paused` 时暂停剩余时间，恢复后继续。

单条`entry`替换保持先退后进。多条提示使用`entries`：按照传入顺序从上向下排列，新提示追加在末尾，每条独立入场、计时和退场。旧条目移除后，其余条目平滑上移，不重新入场或延长停留；减少动态时直接调整位置。`entry`和`entries`二选一。

```tsx
const [receipts, setReceipts] = useState<SceneFeedbackEntry[]>([]);
// 每次成功交易使用新的展示id；道具id可以相同。
setReceipts(current => [...current, {
  id: transactionId, kind: "reward",
  reward: {id: item.id, kind: "item", name: item.name, icon: item.icon, quantity: purchasedQuantity},
}]);
<SceneFeedback entries={receipts} edge="right" paused={sceneCovered}
  onDismiss={id => setReceipts(current => current.filter(entry => entry.id !== id))}/>
```

`kind: "reward"`显示紧凑的“获得道具”、道具图标、名称和`×数量`，停留时间沿用轻提示的4秒。货币奖励显示货币名称及数值。`onDismiss(id)`只请求宿主移除对应提示，不发奖、不写存档；宿主必须响应回调，替换和卸载不会触发该回调。合并或去重应根据业务事件id处理，不根据组件挂载次数重放奖励。

同一任务的物品和货币应组合为一个 `rewards` 数组。每项使用稳定且唯一的 `id`，数量由调用方校验。不用于战斗伤害跳字、剧情台词、需确认的覆盖/删除操作。

## LLM / API 错误详情

`InlineFeedback` 可增加 `details: { id, raw, status?, code?, requestId? }`。默认仅显示摘要、可选操作和“详细原因”入口；在原位展开，不打开另一个窗口，也不把整段原始错误作为 alert 播报。

```tsx
<InlineFeedback message="AI 服务请求过于频繁，请稍后重试。"
  action={{ label: "重试", onClick: retryRequest }}
  details={{ id: "failure-001", status: 429, code: "rate_limit_exceeded",
    requestId: "req_example", raw: safeResponseText }} />
```

`id` 表示一次错误发生，新 id 自动收起旧详情；同 id 的内容更新保留展开状态。没有有效 `raw` 时不出现空入口。认证失败可以不提供重试，或由宿主提供检查配置操作；组件不判断是否允许重试，不自动请求。

原始文本保留换行，按纯文本显示；长行自动折行，正文限高 180px（窄容器 144px）后内部滚动，可键盘聚焦、选中复制。宿主可用 `--feedback-details-max-height` 调整限高。状态码、错误码和请求 ID 仅在有值时出现。

组件会补充遮蔽常见 Authorization / API Key / Cookie / token 字段和已识别的密钥形态，并提示“凭据已隐藏”。这是展示层的有限防护，不是通用日志清洗器；宿主仍应只传入已脱敏的错误或响应片段，**不要传入完整请求对象、请求体、对话内容或其他隐私数据**。组件不记录日志、不上传原文，也不把服务返回的 HTML 当成页面执行。

## 视觉与动效

沿用全局青灰线条、暗色透景材质、暖白正文和金色结果标识；物品/货币复用现有组件与稀有度。无实心状态色底板、无附加英文小字、无全屏黑幕。默认视图宽度 480 / 580 authored px，`max-width: 100%`，宿主负责 Stage 缩放；长文本和多奖励可换行。

底板中心保持 62% 不透明度，仅左右 26px、上下 12px 做透明渐变，纹理同步收淡；不降低中心深度，不遮罩文字／按钮，也不用 blur/backdrop-filter 或径向雾感。上下仅保留两端消散的弱光线，不加贯通黑边或完整矩形描边。原位错误保留 44% 的较轻暗底，边缘渐变范围为 20px／10px，场景仍然清晰。

底纹与确认窗共用中性灰绿及 22% 的纹理层透明度，叠加 SVG 本身的低透明度后有效墨色不足 1%，仅留下隐约材质感，不形成醒目的菱形网格。背景板深度不随纹理减弱。

原位操作使用已有的斜切角按钮外形，156px 宽、至少 44px 高；17px HTML 标签独立于 SVG 缩放。保留单层青灰细描边和轻透填充，去掉多重厚框；悬浮提亮、按下仅内容轻移，不缩放命中区，窄容器中自然换行。

统一 `tokens.json.feedback`：提示 320ms、结果 420ms 入场，从锚点所属方向轻移 18px；220ms 退场，朝同一方向退回 8px。整条同时淡变，无缩放／模糊，无中间确认窗的暗幕和分层错峰。减少动态时无位移，统一 80ms 透明度变化，包括在退出中更改偏好。不会占用点击/推进按键、捕获焦点或添加确认按钮。

`SceneFeedback.edge` 可选 `top`（默认）／`left`／`right`，只指定动效来源；实际位置仍由宿主容器决定。每个id固定入场方向，退场不因宿主修改edge而反转。同id文案更新不重新入场；完整入场后才开始停留计时。叠放条目间距10px，位置移动沿用轻提示的动效节奏。静态视图应通过`SceneFeedback`播放，不在外层条件卸载它。`InlineFeedback`是原位持久错误，不改成自行退场的侧边通知。

预览：Storybook → Patterns / Scene Feedback → Interactive、Overview、Narrow、Reduced Motion、From Right、From Left、Stacked、Api Error、Api Error Narrow。Stacked可连续点击“获得道具”核对叠放；API预览包括限流、认证失败和超时。所有演示数据、触发按钮及背景仅用于Storybook。
