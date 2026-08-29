# 新增道具

Battle 已支持可序列化 `ItemInstance`、次数消耗、loadout 开战快照和离场结算。被动道具可直接使用 modifier/reaction；主动道具目前需要新增正式 command，不能只接一段 UI 回调。

## 实例形状

道具实例随 `BattleStartInput.loadout.items` 进入战斗：

```ts
const tonic: ItemInstance = {
  kind: "item",
  instanceId: "item:tonic:run-42-slot-1",
  definitionId: "item.tonic",
  sourceId: "inventory:slot-1",
  ownerId: "kael",
  charges: 2,
  maxCharges: 2,
  tags: ["consumable"],
  data: null
};
```

`instanceId` 标识这一件物品，`definitionId` 标识共享规则，`data` 只能存 JSON 参数。不要把 handler 塞进实例。

## 被动道具

1. 在正式 effect definition registry 增加 `BattleEffectDefinition`。
2. 用 `before-damage/before-heal` modifier 或 event reaction 表达效果。
3. 道具 `charges > 0` 时，`compileEffectRuntime` 会自动编译其 definition。
4. 若每次触发需要消耗次数，reaction 在同一因果链追加 `consume-item`。

modifier/reaction 的处理函数必须位于代码 registry；实例只保存 id 和参数。

## 主动道具

`TargetingMode.item` 只是已准备好的 UI 选择状态，领域目前没有通用 `use-item` command。新增主动道具时需要：

1. 新增形如 `{ type: "use-item"; itemInstanceId; target }` 的判别命令。
2. 在规则处理器验证阶段、次数、所有者和目标。
3. 把实际效果与 `consume-item` 放入同一 `resolveEffectsCommand`。
4. 返回治疗、伤害、状态和 `item-consumed` 等结构化事件。
5. Controller 发送命令并消费事件，不直接改 `loadout.items`。

若不同主动道具只是参数不同，建立数据 definition 与一个通用 `use-item` 处理器；不要为每件道具新增 command type。

## 结算

`loadoutAtStart` 是不可变开战快照，`loadout` 是当前次数。`createBattleLoadoutSettlement` 通过 instance id 比较二者，输出 `chargesSpent/chargesRemaining`。战斗外背包只消费这个结算输出，不从日志猜次数。

## 测试清单

- 开战时 loadout 深拷贝，外部对象修改不影响战斗。
- 零次数物品不会编译被动效果，也不能主动使用。
- 主效果与次数消耗是一个 undo checkpoint。
- 同一 event 的 reaction exactly-once，不会重复扣次数。
- 存档/恢复保留实例 data、次数和 definition id。
- 离场结算只报告真实消耗，未使用道具不产生记录。
