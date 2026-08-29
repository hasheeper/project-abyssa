# 新增词条

当前底座不提供随机前后缀生成器或独立 `AffixInstance`。一个手工策划词条应表示为挂在装备或特质实例上的 `definitionId + JSON data`，并由 effect definition 编译成 modifier/reaction。

## 选择 modifier 还是 reaction

- 在伤害或治疗结算前改变数值：使用 modifier。
- 监听已发生事实并追加效果：使用 reaction。
- 同时需要两者：放在同一个 `BattleEffectDefinition`，共享 definition id。

目标标签特攻的最小 definition：

```ts
const TAGGED_SPECIALIST = "affix.tagged-specialist";

const definition: BattleEffectDefinition = {
  definitionId: TAGGED_SPECIALIST,
  modifiers: [{
    priority: 10,
    window: "before-damage",
    operation: "multiply",
    value: 2,
    requiredTags: ["target:anomaly"],
    targetKinds: ["enemy"]
  }],
  reactions: []
};
```

装备实例引用相同 id：

```ts
{
  kind: "equipment",
  instanceId: "equipment:blade:42",
  definitionId: TAGGED_SPECIALIST,
  sourceId: "kael",
  ownerId: "kael",
  slot: "weapon",
  durability: 3,
  maxDurability: 3,
  tags: ["affix"],
  data: null
}
```

攻击规划器只需给符合条件的 `damage` effect 添加稳定 tag；不应写“如果装备了某词条则伤害翻倍”的硬编码分支。

## Reaction 词条

监听 `damage-applied`、`unit-defeated` 等 event，并在代码 registry 以相同 definition id 注册 handler。handler 从 `binding.data` 读取已合并的模板和实例 JSON 参数，返回原子效果数组。

必须检查 `applied > 0`、目标类型和必要 tags。需要消耗耐久时，把 `consume-equipment-durability` 与派生效果放进同一 reaction 链；耐久为 0 的装备不会被 `compileEffectRuntime` 激活。

## 排序与冲突

modifier 和 reaction 都按 `priority → sourceId → instanceId` 升序执行。priority 是规则契约，不是“越大越强”；新增词条必须明确它与穿透、减免、倍率、免疫的相对位置。

不要依赖 registry 对象键顺序或 loadout 数组顺序解决冲突。重定向、穿透、减免和 prevent 的组合必须有独立测试。

## 内容展示

规则 definition 与玩家可读名称/描述可以共享稳定 id，但展示文案不应进入 resolver 判断。若未来增加词条 UI registry，应保持它是 definition id 到本地化/图标元数据的映射，实例只保存必要参数。

## 测试清单

- definition 可从装备/特质实例正确编译。
- tag 与 target 不匹配时完全不生效。
- 多词条顺序固定，`modifier-applied` 记录 before/after。
- reaction 对单个 event 至多一次，派生事件不会意外自触发。
- 耐久消耗、破损停用、undo 和离场 wear 结算一致。
- 词条实例完整经过 JSON round-trip，不保存函数。

完整组合夹具见 `../testing/effect-fixtures.ts`：目标标签特攻、命中施毒、击杀加金币和范围伤害吸血均未修改既有攻击函数。
