# Battle engine

Battle 是一个确定性、可保存、事件驱动的小规模回合制效果系统。当前实现保留五人队伍、少量敌群和既有演出，同时为手工策划的道具、装备、特质、状态与敌人机制提供统一底座。

当前持久化版本为 schema v4；规则与内容版本均为 v1。

后续开发请先阅读 [`DEVELOPMENT_GUIDE.md`](DEVELOPMENT_GUIDE.md)，其中集中列出了接口、文件位置、运行流程、扩展落点和提交检查清单。

产品理念、长期方向与讨论语境集中保存在 [`DESIGN_REFERENCE_LOG.md`](DESIGN_REFERENCE_LOG.md)。该文档是参考日志，不自动覆盖当前实现规格。

## 核心保证

- 所有正式规则变化从 `dispatchBattleCommand` 进入。
- 规则规划器只生成原子效果；核心字段由 `resolveAtomicEffects` 写入。
- 每次转换返回新状态、有序事件和明确错误，不修改输入。
- 生命周期、敌方 cursor、RNG、触发队列和 undo 均可序列化。
- 同初始状态、seed 和命令序列得到相同 state 与 event trace。
- React 只负责输入与演出，不通过 state diff 反推领域结果。
- 一条玩家命令及其全部 reaction 只有一个 undo checkpoint。
- 单次解析最多 256 个事件、触发深度最多 8，循环会明确失败而不会卡死。

## 数据流

```text
content definitions ───────────────┐
                                   ↓
UI → controller → command dispatcher → rule planner → atomic effect resolver
                      ↑                                    │
                      │                                    ↓
                 state RNG                         next state + events
                                                           │
                            selectors ← canonical state ←───┘
                                ↓                    ↓
                               UI               persistence
```

`batchId` 允许表现层把同批 AOE 并行动画化，但不会改变 resolver 的执行顺序和事件 `sequence`。

## 目录职责

| 目录/文件 | 职责 |
| --- | --- |
| `domain/` | command、state、effect、event、target、版本与 invariant 类型。不得依赖 React。 |
| `content/` | 手工策划的角色、敌人、平衡常量和 effect definition。 |
| `rules/dispatcher.ts` | 唯一命令网关，选择 RNG stream 并调用规则转换。 |
| `rules/actions.ts` | 把攻击、防御、治疗、偷取规划成原子效果。 |
| `rules/turns.ts` / `enemy-intents.ts` | 回合推进、意图公开和逐只意图结算。 |
| `rules/resolver.ts` | 原子写入、modifier、reaction、死亡/力竭收束、事件预算与原子 undo。 |
| `rules/effect-runtime.ts` | 从 loadout、status 和 encounter rule 实例编译 modifier/reaction。 |
| `selectors/` | 从 canonical state 派生交互、展示和统计结果。 |
| `persistence/` | schema DTO、迁移、JSON clone 与三条确定性 RNG stream。 |
| `controller/` | React 状态提交、targeting、事件到演出 cue 和统一 presentation queue。 |
| `testing/` | scenario builder、golden trace、effect fixture 和 invariant 测试工具。 |
| `engine.ts` | 稳定兼容门面，只导出实现，不承载核心规则。 |

Battle 外部调用方优先从 `engine.ts` 使用稳定 API；Battle 内部模块使用具体边界的直接 import，避免经门面形成循环依赖。

## Command、effect 与 event

三者含义不能混用：

- Command 是玩家或流程发出的意图，例如 `attack-enemy`、`resolve-next-enemy`。
- Atomic effect 是规则已经决定要执行的最小写入，例如 `damage`、`apply-status`、`modify-resource`。
- Event 是已经发生的事实，例如 `damage-applied`、`unit-defeated`、`layer-cleared`。

UI 发送 command、消费 event；装备与状态通过 modifier/reaction 改变或追加 effect；event 不能再次当成 command 应用。

## Canonical state

唯一事实来源详见 [`domain/CANONICAL_STATE.md`](domain/CANONICAL_STATE.md)。最重要的约束是：

- 流程只看 `mode`。
- 敌人生死只看 HP；骰子力竭和锈蚀从骰主角色派生。
- 狂暴只由 status 表示。
- UI 动画 phase、timer、DOM 和视觉随机永远不进入领域状态。

## 随机、保存与撤回

正式规则使用状态内 `combat`、`loot`、`flavor` 三条 RNG stream。失败命令不提交 cursor，undo 同时恢复 cursor 与 event sequence。

存档必须通过 `serializeBattleState` / `deserializeBattleState`，迁移和版本策略见 [`persistence/README.md`](persistence/README.md)。不要保存 React state，也不要直接恢复未校验 JSON。

## 新内容入口

维护指南位于 [`docs/README.md`](docs/README.md)：

- [新增角色能力](docs/ADDING_CHARACTER_ABILITY.md)
- [新增敌人意图](docs/ADDING_ENEMY_INTENT.md)
- [新增道具](docs/ADDING_ITEM.md)
- [新增状态](docs/ADDING_STATUS.md)
- [新增词条](docs/ADDING_AFFIX.md)

常规内容应通过 definition + modifier/reaction + 既有原子效果组合。只有现有原语无法表达且需求已确定时，才扩展 effect taxonomy；扩展后必须补 resolver 的穷尽分支和独立测试。

## 验证命令

```sh
npm run typecheck
npx vitest run src/battle
npm run build:battle
npx vitest bench src/battle/engine.bench.ts --run
```

测试矩阵包括：

- 领域 invariant、非法命令和输入不可变。
- fixed-seed golden trace、RNG stream 隔离和 undo 重做。
- JSON round-trip、逐版迁移和敌方回合中途恢复。
- modifier 排序、status 生命周期、reaction exactly-once 与预算保护。
- 力竭、复苏、狂暴、召唤、逃跑、奖励和层结算。
- 攻击/支援/逐只受击/斩杀退场/自动清层的 UI 时序。

只有有意修改规则语义并人工审查首个差异后，才允许更新 golden trace。性能历史与复现条件见 [`ENGINE_PHASE_0_BASELINE.md`](ENGINE_PHASE_0_BASELINE.md)。

## 长期维护禁区

- 不在 UI、selector 或内容定义中直接改 state。
- 不新增第二个 dispatcher、敌方 cursor、随机源或撤回字段白名单。
- 不把函数存进 state、status、item data 或存档 DTO。
- 不依赖对象/数组偶然遍历顺序；modifier/reaction 必须使用稳定排序。
- 不让 AOE 动画并行改变规则执行顺序。
- 不为尚未确定的玩法引入 ECS、脚本 VM 或无限随机词条系统。
