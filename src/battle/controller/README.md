# Battle controller boundary

Controller 是领域规则与 React 演出之间的唯一编排边界。它持有 canonical Battle state，向 dispatcher 提交 `BattleCommand`，并把完整 `BattleTransition` 交给界面。

## 职责

`useExpeditionBattleController` 负责：

- 保存、读取和原子提交最新领域状态。
- 统一调用 `dispatchBattleCommand`。
- 保存 UI 专属的 `TargetingMode`：空闲、角色、道具或能力。
- 从 `layer-cleared` event 记录待确认清层，并在退场演出后发送现有 `end-turn` acknowledgement。
- 重启远征时清空 targeting 与待确认清层。

`usePresentationQueue` 负责：

- 为攻击、支援和逐只敌方行动提供单一 busy/runId 时钟。
- 取消旧 run 的所有异步 continuation 与 timeout。
- 保证规则状态只在已有 impact 帧提交，不把动画 phase 写进领域状态。

`presentation-events.ts` 负责把领域事件映射为只读演出 cue。具有相同非空 `batchId` 的事件可以在同一视觉批次并行，但领域 `sequence` 永远不变。

## 一次交互的路径

```text
用户输入
  → Controller 发送 BattleCommand
  → dispatcher 返回 { state, events, error }
  → presentation helper 从 events 读取伤害/治疗/盾牌/斩杀结果
  → presentation queue 播放既定阶段
  → impact 帧提交完整 transition
  → React 用 selector 渲染 canonical state
```

UI 不得比较前后 state 来猜测“这是治疗还是防御”“是否斩杀”“是否清层”。这些结果必须来自结构化 event。

## 随机源

正常挂载不接收 RNG：Controller 用一次 `Math.random` 生成 seed，创建可追踪 Mulberry32，再由状态内 `combat/loot/flavor` stream 推进全部规则随机。这样任意规则帧保存后都可确定性恢复。

显式传入的 RNG 有两种处理：

- 可追踪 RNG（例如 `mulberry32(seed)`）：初始化后继续使用状态内 cursor。
- 不可追踪 RNG：只作为旧用例与 UI 测试的兼容注入，dispatcher 同步记录消耗次数，但它不能用于要求恢复未来随机序列的正式流程。

动画时长和骰子额外旋转仍可使用视觉随机，因为它们不改变规则结果。

## 依赖限制

Controller 可以导入：

- `domain/commands`、`domain/events` 和状态类型。
- `rules/dispatcher` 的公开命令入口。
- `selectors/`。
- 兼容门面的远征创建入口（在调用点迁完前保留）。

Controller 不可以：

- 导入内部 resolver 并直接提交原子效果。
- 直接改 `ExpeditionState`、RNG cursor、undo 或 enemy cursor。
- 根据 CSS/DOM 状态决定规则结果。
- 在 async 局部变量中维护第二份敌方行动队列。

## 扩展 targeting

`TargetingMode` 已包含 `item` 与 `ability`，但它只描述界面当前拿起什么，不代表对应领域命令已经存在。新增主动道具或独立能力时：

1. 先定义正式 `BattleCommand` 与规则合法性。
2. 由 dispatcher 返回完整事件。
3. Controller 仅负责选择目标、发送命令与播放 cue。
4. 若能复用现有攻击/支援 cue，不新增计时器；需要新节奏时也统一挂到 presentation queue。

演出契约测试位于 `presentation-events.test.ts`，完整 UI 时序回归位于 `../ExpeditionBattleScreen.test.tsx`。
