# Battle canonical state

本文定义 Battle 领域状态中每类事实的唯一权威来源。它描述的是当前 schema v4，不是迁移期兼容形态，也不新增玩法。

## 基本规则

- `ExpeditionState` 必须是纯 JSON 数据；不得存函数、Promise、DOM、定时器或 React 对象。
- 规则只能通过 `BattleCommand` 和原子效果管线改变状态。
- UI 需要派生信息时使用 selector，不在状态中增加可写镜像。
- 每次成功转换返回完整的新状态和有序的结构化事件；输入状态不可被修改。
- `collectExpeditionInvariantViolations` 是存档入口和测试共用的最终一致性检查。

## 权威字段

| 事实 | 权威来源 | 约束 |
| --- | --- | --- |
| 战斗流程 | `mode` | `awaiting-roll`、`player-turn`、`enemy-turn`、`greed`、`finished` 互斥；不存在顶层 `phase/status/lastOutcome`。 |
| 终局结果 | `result` | 只有 `mode.type === "finished"` 时非空。 |
| 敌方回合进度 | `mode.enemyOrder/cursor/closingHand/outcome` | 只存在于 `enemy-turn`；UI 不保存第二份规则 cursor。 |
| 角色生命与力竭 | `party[*].hp/downed` | 当前规则要求 `downed === (hp === 0)`；二者只在 resolver 的生命收束路径中一起写入。 |
| 命数锈蚀 | `party[*].rustLevel` | 骰子不保存 `rustLevel`；展示通过骰主角色派生。 |
| 骰子状态 | `dice[*].faceIndex/sealed/loaded/spent` | 骰子是否力竭通过 `isDieDowned` 从角色派生。 |
| 敌人生死 | `enemies[*].hp` | `hp <= 0` 即被击败；没有 `dead` 字段，被击败后 `intent` 必须为空。 |
| 狂暴 | `statuses` 中的狂暴状态实例 | 敌人不保存 `frenzied` 或激活回合镜像；展示通过狂暴 selector 派生。 |
| 当前意图防御 | `enemies[*].blocked` | 与该敌人当前公开意图同生命周期；发布或清除意图时必须同步重置。 |
| 本层散金 | `gold` | 仅代表尚未按本层结算公式入袋的资源。 |
| 已入袋金币 | `bagGold` | 清层结算后的可带回总额；`lastLayerSettlement` 只作审计和展示。 |
| 当前封锁与下回合封锁 | `dice[*].sealed` / `party[*].sealedNext` | 两者分别表示当前骰和下一回合待应用效果，不能互相代替。 |
| 随机序列 | `rng.combat/loot/flavor` | 每条流保存 `algorithm/seed/cursor`；正式命令默认只从状态流取数。 |
| 撤回 | `undoStack` | 每项是完整核心 checkpoint，但 checkpoint 自身不递归包含 undo 栈。 |
| 装备输入与消耗 | `loadoutAtStart/loadout` | 前者是开战快照，后者是当前耐久/次数；结算只比较二者。 |
| 状态与遭遇规则 | `statuses/encounterRules` | 实例只存 definition id 和 JSON data；处理函数位于代码 registry。 |
| 事件编号 | `eventSequence` | 为下一条领域事件提供稳定 id；撤回 checkpoint 同时恢复该游标。 |

## 不再允许的镜像

schema v4 明确拒绝以下字段：

- 顶层 `phase`、`status`、`lastOutcome`。
- `enemies[*].dead`、`frenzied`、`frenzyActivatesOnRound`。
- `dice[*].downed`、`dice[*].rustLevel`。

旧存档中的这些值只允许在迁移器内读取。迁移完成后，根状态和 undo checkpoint 都必须是 canonical shape。

## 队列、事件与日志

`pendingEffects` 和 `pendingReactions` 是可序列化的规则队列槽位。当前 resolver 同步、原子地排空队列，任何成功或失败返回都不能暴露半处理状态。

结构化 `BattleEvent` 是 UI 演出、审计和未来触发的事实来源。`log` 与 `facts` 是需要随存档保留的玩家可见历史，不是 UI 用 state diff 反推结果的替代品。

同一命令中的事件遵守以下顺序：

1. 根原子效果按提交顺序执行。
2. modifier 按 `priority → sourceId → instanceId` 排序。
3. reaction 对每个事件至多触发一次，并使用相同稳定排序。
4. `sequence` 只表达规则先后；相同 `batchId` 仅允许表现层并行动画。

## 不属于领域状态的内容

以下信息只能留在 Controller 或 React 展示层：

- 当前拿起的角色、道具或能力。
- 攻击、防御、治疗和敌方行动的动画 phase。
- `runId`、timeout、requestAnimationFrame 和 busy 状态。
- DOM ref、FLIP 位置、临时伤害数字和退场节点。
- 视觉随机数，例如骰子旋转圈数与动画时长。

规则结果必须先由 command 产生；表现层只根据 transition events 安排现有命中帧，并在约定帧提交完整状态。

## 写入与读取边界

- 写入：`dispatchBattleCommand` → 规则规划器 → `resolveAtomicEffects`。
- 读取：优先使用 `selectors/`；骰面品质等局部领域派生使用对应 rule helper。
- 保存：`serializeBattleState` 创建带版本戳的深拷贝 DTO。
- 恢复：`deserializeBattleState` 先逐版迁移，再验证 shape 与全部 invariant。
- 测试场景：使用 `testing/scenario.ts` 构造输入；测试中的直接 patch 不能进入正式规则路径。

新增字段前必须先回答：它是否已经能从 canonical state 确定性计算。若答案是“能”，应新增 selector，而不是再存一份状态。
