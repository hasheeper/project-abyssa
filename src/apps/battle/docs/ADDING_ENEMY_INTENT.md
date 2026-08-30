# 新增敌人意图

敌人意图分为“新回合公开”和“敌方阶段逐只结算”两步。公开结果存于 `enemy.intent`，结算时必须生成 `EnemyTurnEvent` 和原子效果。

## 接入顺序

1. 在 `domain/state.ts` 的 `EnemyIntent` 判别联合中增加新 `type` 与全部可序列化参数。
2. 若它属于新敌人种类，再扩展 `EnemyKind` 和 `content/enemies.ts` 的手工遭遇配置。
3. 在 `rules/turns.ts` 的 `buildEnemyIntentEffects` 中生成公开意图，并通过 `modify-intent: replace` 写入。
4. 在 `rules/enemy-intents.ts` 新增 `resolveXxx`，把结算拆成既有原子效果。
5. 在 `buildIntentEffects` 增加穷尽分支；TypeScript 必须继续把遗漏视为错误。
6. 确保每只敌人结算后产生 `complete-enemy-intent`，并取消或替换旧意图。
7. 检查意图图标、威胁 selector 和 `getEnemyTurnCue` 是否能表达新结果。

现有倒计时意图的结构是一个可参考的最小非攻击例子：

```ts
{
  type: "countdown",
  title: `倒计时 ${enemy.countdown}`,
  description: enemy.countdown <= 1
    ? "本回合结束时引爆"
    : "若不摧毁，倒计时继续减少"
}
```

它在结算侧组合 `modify-enemy`、`modify-resource`、日志/事实和意图取消；不会在 UI 中直接扣金币。

## 顺序与随机

- `enemyOrder` 在准备敌方回合时冻结；逐只 resolve 不能重新按 DOM 或当前数组排序。
- 每次 `resolve-next-enemy` 只结算 cursor 指向的一只，演出完成后 Controller 才请求下一只。
- 选目标或随机分支使用 `combat` stream。不要在意图生成函数内调用 `Math.random`。
- 同批召唤或 AOE 可共享 `batchId`，但原子效果顺序必须稳定。
- 原目标已力竭、敌人已死亡或意图被取消时，要定义明确 miss/cancel 语义，不能无声跳过 cursor。

## 伤害与死亡

攻击意图应提交 `damage`，由 resolver 统一处理 modifier、HP、`unit-downed` 和锈蚀。敌人自毁、逃跑与普通击杀必须提供不同 defeat reason 和奖励，不要在意图函数中直接写 `hp = 0`。

## 测试清单

- 新意图在固定 seed 下公开稳定，存档后仍可恢复。
- 每种合法、被挡、目标失效和边界数值路径都有测试。
- 两只以上敌人严格逐只结算，event sequence 与 cursor 对齐。
- 输入不变；非法命令不消耗 RNG。
- 召唤、死亡、清层、wipe 与 frenzy recoil 的收束顺序明确。
- UI 能从 `EnemyTurnEvent` 播放并在 impact 帧提交，不新增平行敌方 runner。
