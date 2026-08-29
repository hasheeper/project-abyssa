# 新增角色能力

当前角色的基础能力由六个 `FaceDef` 骰面定义。先判断新能力是否只是既有 `attack/guard/heal/coin/wild/blank` 的新数值，还是需要额外副作用。

## 只使用现有动作

若目标规则、结算方式与既有 verb 相同，只修改 `content/characters.ts` 的数据：

```ts
{
  verb: "guard",
  power: 2,
  pip: 5,
  label: "王权结阵",
  quality: "plain"
}
```

`power` 是战斗效果值，`pip` 是牌型点数，不能因 UI 文案相同而混用。`quality` 只使用 `plain/rust/gild/none` 现有语义。

这类改动不应修改 `actions.ts`、resolver、Controller 或动画计时。

## 组合额外效果

骰面可通过 `effectDefinitionIds` 引用数据 definition。现有“越限奇迹”就是最小例子：

```ts
{
  verb: "heal",
  power: 2,
  pip: 5,
  label: "越限奇迹",
  effectDefinitionIds: ["action.expensive-heal"],
  quality: "gild"
}
```

对应 definition 位于 `content/effect-definitions.ts`，`rules/action-effects.ts` 把它展开为 `modify-resource`、`append-log` 和 `append-fact` 原子效果。治疗、材料消耗、日志与掷骰消耗在同一 command 中提交和撤回。

新增同类能力时：

1. 为 definition 取稳定 id，并加入内容 registry。
2. 在 `ActionEffectDefinition` 中复用已有 trigger/effect 形状。
3. 由 `buildActionEffectContribution` 生成原子效果，绝不直接修改 state。
4. 若需要新的副作用类型，先确认已有 `AtomicEffect` 不能组合表达，再最小扩展 action definition taxonomy。
5. 可见副作用需要对应 event；优先复用现有攻击或支援 cue。

## 新的目标或动作语义

如果能力不是现有 verb 的变体，例如“选择两个敌人后换位”，它已超出骰面数据改动：

1. 在 `BattleCommand` 增加明确命令和参数。
2. 在 dispatcher 增加穷尽分支。
3. 新建规则规划器，验证阶段、角色、骰面和目标合法性。
4. 生成带统一 `causeId/batchId` 的原子效果。
5. 用结构化 event 描述结果。
6. 扩展 `TargetingMode` 只负责收集选择，不复制合法性规则。

不要为了新能力让 UI 直接调用 `resolveAtomicEffects`。

## 测试清单

- 指定骰面时得到预期 verb、power、pip 和品质。
- 非法阶段、未装载、已消耗、封锁、力竭和非法目标被拒绝且不改输入。
- 主效果、副作用、资源消耗和 `die-spent` 的事件顺序固定。
- undo 一次恢复完整命令及 RNG cursor。
- 若影响动画，补 event-to-cue 测试与现有命中帧 UI 回归。
- 若有意改变已有规则，单独审查 golden trace；不要无条件重录。
