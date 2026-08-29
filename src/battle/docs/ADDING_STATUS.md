# 新增状态

状态由 `StatusInstance` 保存身份、目标、层数、持续时间、tags 和 JSON data。规则逻辑来自与 `definitionId` 对应的 modifier/reaction registry。

## 应用状态

所有状态必须通过 `apply-status` 原子效果进入：

```ts
{
  ...base,
  type: "apply-status",
  target: { kind: "enemy", id: enemyId },
  refresh: "stack",
  status: {
    instanceId: `poison:${enemyId}`,
    definitionId: "status.poison",
    sourceId: actorId,
    stacks: 1,
    maxStacks: 3,
    duration: { scope: "round", remaining: 2 },
    tags: ["debuff", "poison"],
    data: null
  }
}
```

resolver 根据 target 生成 `targetKey`，并执行免疫、叠层/刷新与事件发射。调用方不能手工向 `state.statuses` push。

## 刷新规则

- `replace`：用新定义整体替换同目标同 definition 的实例。
- `refresh`：保留层数，仅重设持续时间。
- `stack`：层数增加到 `maxStacks`，并用新持续时间刷新。
- `extend`：累加持续时间，层数不变。

使用 `modify-status` 改层数或剩余时间，使用 `remove-status` 做明确移除。`cleanse` 可以按 definition id 或 tag 清除；带 `unremovable` tag 的状态不会被 cleanse。`immune:<definitionId>` tag 可阻止对应状态应用。

## 持续时间边界

支持 `effect/action/round/next-round/layer/expedition` scope。`advanceStatusDurations` 是显式边界操作，不会因为墙钟时间自动递减。

新增有期限状态时必须同时指定由哪个 canonical transition 调用该边界，并添加到该转换的 effect/event 序列中。不要在 React timer 中递减状态。当前狂暴预警使用专门的下一回合转换，因为到期时还要原子地替换为永久狂暴并增加攻击；永久狂暴以 `duration: null` 持续至敌人死亡。

## 状态规则

纯数值状态优先使用 modifier；事件触发状态使用 reaction：

- modifier 适合增伤、减伤、治疗倍率、免疫和穿透。
- reaction 适合命中施毒、击杀奖励、回合触发和吸血。
- handler 必须检查 event type、目标、实际生效值和 source，避免响应自己的派生事件形成循环。

resolver 会按稳定顺序执行，并以最大深度 8、最大事件数 256 终止循环。

## 清除与死亡

单位被击败时，resolver 会移除该目标的状态并发出 `status-removed`。需要跨目标或跨层保留的效果应使用正确 target/scope，不能依赖死亡单位数组仍留在 UI 中。

## 测试清单

- 首次应用、四种 refresh、层数上限、到期和显式移除。
- definition/tag cleanse、`unremovable` 与 immunity。
- modifier/reaction 稳定顺序和 exactly-once。
- 死亡、清层、存档恢复与 undo 后状态一致。
- 递归 reaction 命中预算时产生明确错误事件。
