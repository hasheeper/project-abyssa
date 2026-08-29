# Battle persistence

Battle 存档边界负责版本戳、JSON 序列化、逐版迁移、运行时校验和确定性 RNG。当前存档版本为 schema v4。

## 公共入口

- `createBattleSaveDto(state)`：返回与输入隔离的当前版本 DTO。
- `serializeBattleState(state)`：生成 JSON 字符串。
- `migrateBattleSaveDto(value)`：迁移未知输入并验证为当前 DTO。
- `deserializeBattleState(serialized)`：解析、迁移、验证并返回 canonical state。
- `cloneBattleState(state)`：仅用于已验证 Battle JSON 状态的快速深拷贝。

任何外部存档都必须从上述入口恢复，不能把 `JSON.parse` 的结果直接断言成 `ExpeditionState`。

## 版本戳

`domain/versions.ts` 维护三个独立版本：

| 版本 | 何时递增 | 恢复策略 |
| --- | --- | --- |
| `schemaVersion` | 字段、联合类型或 checkpoint 形状变化 | 必须提供从上一版到下一版的顺序迁移。 |
| `rulesVersion` | 相同命令在相同状态下的规则语义改变 | 默认拒绝不匹配的回放/存档；需要产品级兼容决策，不能伪装成 schema 迁移。 |
| `contentVersion` | 角色、敌人、遭遇或内容 definition 的语义改变 | 默认拒绝不匹配内容；若要兼容，需显式内容迁移。 |

不要为了普通代码整理递增版本。只有保存结果或确定性回放会改变时才更新对应版本。

## 现有迁移链

迁移只允许逐版前进，不能跳版，也不能改写历史迁移的含义。

| 迁移 | 主要处理 |
| --- | --- |
| v1 → v2 | 建立 `mode`、三条 RNG stream、effect/reaction 队列、状态/遭遇规则和事件游标。旧版字段白名单 undo 无法安全补全，因此清空。 |
| v2 → v3 | 增加 `loadoutAtStart/loadout`；把旧敌人狂暴字段转换成可序列化 status 实例。 |
| v3 → v4 | 删除生命周期、敌人生死/狂暴和骰主状态镜像；同步迁移每个 undo checkpoint。旧数据若以 `dead: true` 表示死亡，即使遗留正 HP，也规范为 `hp: 0` 并清除意图。 |

v3 → v4 的 HP 规范化会改变旧版非 canonical 指纹，但不会改变命令顺序、RNG cursor 或终局语义；这是删除冲突状态源所必需的迁移。

## 校验顺序

`migrateBattleSaveDto` 按以下顺序工作：

1. 检查外层对象与版本号。
2. 顺序执行所有缺失的 schema 迁移。
3. 验证当前版本所需的数组、对象、联合类型和 RNG stream 形状。
4. 拒绝 v4 禁止的重复字段。
5. 运行 `collectExpeditionInvariantViolations`，拒绝非法生命、ID、骰主、mode、cursor、资源和 RNG 状态。
6. 返回与输入完全隔离的拷贝。

校验失败必须抛出错误，不得悄悄填充未知当前版本字段。兼容逻辑只属于明确的历史迁移函数。

## RNG 与恢复

规则随机数分为三条独立流：

- `combat`：骰面、敌人选择和战斗流程随机。
- `loot`：结算与奖励随机。
- `flavor`：不影响主战斗数值的随机事实。

每条流保存 Mulberry32 的 `seed/cursor`。命令创建临时 cursor，成功后把新 cursor 写回结果状态；失败命令不消耗随机数。undo checkpoint 会恢复三条流，因此“行动 → 撤回 → 重做”得到相同结果。

正式 UI 启动时只用外部随机生成一次 seed，随后全部规则随机来自状态。`BattleDispatchContext.rng` 仅保留给旧 API 和确定性测试夹具；不可追踪的函数无法在存档中保存未来输出，不得用于正式持久化流程。

视觉随机（骰子额外旋转圈数、动画时长等）不属于规则 RNG，也不进入存档。

## Undo checkpoint

checkpoint 保存完整核心状态，但不递归保存 `undoStack`。新增 canonical 字段会自然进入 checkpoint，不得恢复字段白名单方案。

修改 schema 时必须同时检查：

- 根状态迁移。
- `undoStack[*].state` 的递归迁移。
- 中途处于 `enemy-turn` 的 cursor、closing hand 与 outcome。
- RNG、event sequence、status、loadout、log 和 facts。

## 新增 schema 版本

1. 在 `domain/versions.ts` 把 schema 版本加一。
2. 在 `migrate.ts` 新增单步 `migrateSchemaN`；不要修改已经发布的单步输入/输出约定。
3. 若字段存在于 checkpoint，复用一个可控制递归深度的状态迁移函数。
4. 扩充当前 DTO shape 校验和 domain invariants。
5. 增加上一版 → 当前版、嵌套 undo、非法输入和 JSON round-trip 测试。
6. 复验敌方回合中途恢复、同 seed trace 与撤回后 RNG。

相关测试位于 `persistence.test.ts`，canonical 字段规则见 `../domain/CANONICAL_STATE.md`。
