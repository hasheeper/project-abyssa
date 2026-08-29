# Battle 内容维护指南

本目录说明如何在不绕过 command/effect/event 边界的前提下扩展战斗内容。

完整接口与目录索引见 [`../DEVELOPMENT_GUIDE.md`](../DEVELOPMENT_GUIDE.md)。

| 需求 | 指南 | 常用接入点 |
| --- | --- | --- |
| 调整骰面或增加角色能力 | [`ADDING_CHARACTER_ABILITY.md`](ADDING_CHARACTER_ABILITY.md) | `content/characters.ts`、`rules/action-effects.ts` |
| 增加敌人公开并结算的新行为 | [`ADDING_ENEMY_INTENT.md`](ADDING_ENEMY_INTENT.md) | `domain/state.ts`、`rules/turns.ts`、`rules/enemy-intents.ts` |
| 增加被动或主动道具 | [`ADDING_ITEM.md`](ADDING_ITEM.md) | loadout、effect definitions；主动道具另需 command |
| 增加可叠层/持续/净化状态 | [`ADDING_STATUS.md`](ADDING_STATUS.md) | `apply-status`、effect definition、lifecycle boundary |
| 增加装备/特质词条 | [`ADDING_AFFIX.md`](ADDING_AFFIX.md) | modifier/reaction definition |

## 所有新内容都要遵守

1. definition id 和 instance id 必须稳定且可读；不要使用数组下标作为持久身份。
2. 实例 `data` 必须是 JSON，处理函数只放在代码 registry。
3. 能组合现有原子效果时，不新增 resolver 分支。
4. 需要玩家输入时先新增 `BattleCommand`，不能让 UI 直接调用 resolver。
5. 可见结果必须发出结构化 event，UI 不通过比较前后状态猜结果。
6. 规则随机只走状态内正确 stream；视觉随机不进入规则。
7. 同一命令的主效果、消耗、耐久和 reaction 必须共用一个原子 undo checkpoint。
8. 至少增加内容级成功/失败测试、输入不可变测试，并运行完整 Battle 回归。

测试夹具可参考 `../testing/effect-fixtures.ts` 和 `../rules/effect-compatibility.test.ts`。夹具展示的是扩展缝，不应被直接导入正式内容。
