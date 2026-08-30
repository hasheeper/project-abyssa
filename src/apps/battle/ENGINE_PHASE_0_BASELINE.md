# Battle 引擎阶段 0 基线

> 记录日期：2026-08-28
>
> 目的：为 `ENGINE_REFACTOR_PLAN.md` 的行为等价迁移提供可重复证据；本文件不是玩法规格。

## 环境

- macOS 14.8.7 arm64
- Node.js v23.11.0
- npm 10.9.2
- Vitest 3.2.7

## 原有行为测试

命令：

```sh
npx vitest run src/apps/battle/engine.test.ts src/apps/battle/ExpeditionBattleScreen.test.tsx
```

基线结果：

- `engine.test.ts`：86/86 通过。
- `ExpeditionBattleScreen.test.tsx`：41/41 通过。
- 合计：127/127 通过。
- 本机单次运行总耗时：5.28 秒，其中测试执行约 4.34 秒。

## 阶段 0 新增安全网

命令：

```sh
npx vitest run \
  src/apps/battle/engine.baseline.test.ts \
  src/apps/battle/testing/scenario.test.ts \
  src/apps/battle/testing/invariants.test.ts
```

基线结果：15/15 通过，覆盖：

- 五个固定 seed 的完整自动远征语义 trace。
- 同 seed、同命令序列得到相同 trace。
- roll、reroll、load、玩家行动、敌方逐步结算、结束回合和贪心转换的输入不可变性。
- 场景构造器的确定性、隔离性和显式 fixture patch。
- 当前引擎状态 invariant 的正常路径与故意破坏路径。

固定 seed：

| Seed | Trace 步数 | 终局 |
| ---: | ---: | --- |
| 11 | 169 | 第五层全员力竭 |
| 29 | 227 | 第五层全员力竭 |
| 47 | 181 | 完成第五层 |
| 83 | 165 | 完成第五层 |
| 131 | 214 | 完成第五层 |

每一步 golden 项格式为 `index:command:fingerprint`。摘要包含流程、队伍、骰子、敌人、意图、资源、结算、终局以及最近日志/事实；不包含完整 undo 栈，避免递归放大夹具。

只有在确认玩法规格发生有意变化后，才允许使用以下命令重新生成并人工审查 golden 输出：

```sh
UPDATE_BATTLE_BASELINE=1 npx vitest run src/apps/battle/engine.baseline.test.ts
```

## 类型与构建

```sh
npm run typecheck
npm run build:battle
```

记录时两项均通过。Battle 构建耗时约 428ms；产物大小只作观察，不作为引擎重构门槛。

## 性能基线

命令：

```sh
npx vitest bench src/apps/battle/engine.bench.ts --run
```

场景：对 seed 1–1000 依次执行创建远征、首次掷骰、两次重掷和一次同步敌方结算。

记录结果：

| 指标 | 数值 |
| --- | ---: |
| 每批 1,000 次模拟平均耗时 | 140.33ms |
| 最小值 | 137.38ms |
| 最大值 | 142.85ms |
| 批次吞吐 | 7.126 批/秒 |
| 样本数 | 10 |
| RME | ±0.82% |

性能数字受机器、电源和后台负载影响，不设置绝对 CI 时间阈值。阶段 8 应在相同机器和相同命令下比较中位趋势；若出现明显回退，再用 profiler 定位，不能仅凭一次波动否定实现。

## 基线文件

- `engine.baseline.test.ts`：golden trace 与公开转换不可变性。
- `engine.bench.ts`：可重复微基准。
- `testing/baseline.ts`：确定性参考玩家、状态摘要和 fingerprint。
- `testing/scenario.ts`：测试场景构造器。
- `domain/invariants.ts`：生产与测试共用的当前状态不变量检查。

## 阶段 8 最终回归记录

验证命令：

```sh
npm run typecheck
npx vitest run src/apps/battle
npm run build:battle
npx vitest bench src/apps/battle/engine.bench.ts --run
```

最终功能结果：

- 类型检查通过。
- Battle 16 个测试文件、195/195 测试通过；其中原有 `engine.test.ts` 86/86、UI 41/41 均保持通过。
- fixed-seed golden trace、schema v4 persistence、敌方回合中途恢复与 RNG/undo 测试通过。
- Battle 生产构建通过。

最终性能结果（同机、10 次迭代、2 次预热）：

| 路径 | 平均耗时 | 最小值 | 最大值 | 吞吐 | RME |
| --- | ---: | ---: | ---: | ---: | ---: |
| 兼容参考路径，1,000 轮 | 205.62ms | 202.79ms | 209.55ms | 4.863 批/秒 | ±0.61% |
| command dispatcher 路径，1,000 轮 | 203.78ms | 202.42ms | 204.74ms | 4.907 批/秒 | ±0.32% |

与阶段 0 的 140.33ms 相比，两条最终路径分别慢约 46.5% 和 45.2%；单轮仍约 0.204–0.206ms。重构中期完整 effect/event 管线一度约为 560ms/1,000 轮，针对 profiler 指向的状态拷贝与重复派生后降低约 63%。采用的优化只有：

- Battle JSON 状态专用 clone，避免同步 resolver 使用更慢的通用 clone。
- 空 effect/queue 直接返回，不创建状态副本。
- stall 检查使用所需字段的浅投影，不复制整棵状态。

未为了微基准引入实体索引、ECS 或缓存第二份规则状态。剩余差异是结构化事件、完整可序列化状态和统一 resolver 的可测开销；本文保留实际数据供后续趋势比较，不声称相对阶段 0 没有回退。

### Golden 指纹规范化

schema v4 删除 `enemy.dead` 后，旧倒计时陷阱可能出现的冲突形态“`dead: true` 但 HP 仍为正数”必须规范为 `hp: 0`。因此五条 trace 中共有 159 个后续 fingerprint 经过人工审查后更新。

该变化只移除了重复状态源：命令顺序、RNG cursor、事件/日志语义和五个 seed 的终局均未改变。以后不得以普通重构为由批量重录 golden；任何更新仍需定位并说明首个语义差异。
