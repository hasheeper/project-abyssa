# Abyssa 游戏内核

纯规则层，不依赖具体内容、浏览器、React、存储或 AI；不进入 `@abyssa/ui` 导出。当前默认是规则4／内容3，实际机制以[当前总览](../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)为准。

## 正式入口

- [contracts](/Users/liuhang/Documents/project-abyssa/src/game-core/contracts/index.ts)：Catalog、版本摘要、JSON/内容校验。
- [battle](battle/index.ts)：当前v4使用 `createD5BattleEngine`／`createD5MemoryEngine` 和对应严格reader；规则2／3使用 `createDemoBattleEngine`；`createBattleEngine` 保留规则1兼容。同一已验证Catalog贯穿执行与恢复。
- [session](session/index.ts)：Campaign / Expedition / Encounter 的字段归属、出征保管与结算；当前普通远征入口为 `createD5ExpeditionEngine`，成长／装备／经济在相应 `d5-*` 模块。

下面是规则1兼容调用示例，不能用它创建当前v4正式战斗：

```ts
// catalog 由装配层 validateCatalog(data, releaseManifest) 后注入。
const engine = createBattleEngine(catalog, catalog.data.defaultRouteId);
let state = engine.create({ seed: 42, partyIds: [...catalog.data.defaultParty] });
const rolled = engine.dispatch(state, { type: "roll-dice" });
if (!rolled.error) state = rolled.state;
const restored = engine.restore(JSON.parse(JSON.stringify(state)));
```

以上只计算规则，不表示已保存。页面应消费 [game-application](/Users/liuhang/Documents/project-abyssa/src/game-application/README.md)，由该层执行命令、CAS、回执、Fact 与事务提交。临时平坦 BattleState 只用于执行；新应用存档保存三层快照。

## 兼容边界

具体旧数据在 [content/gameplay/legacy-v1](/Users/liuhang/Documents/project-abyssa/src/content/gameplay/legacy-v1/README.md)，124 个旧运行时导出在 [game-runtime/legacy-battle.ts](/Users/liuhang/Documents/project-abyssa/src/game-runtime/legacy-battle.ts)。显式旧 Battle 原型可经 engine.ts 使用兼容装配；正式玩家页经应用／运行时接线，core 不反向导入页面。

旧 Battle schema 4 / rules 1 / content 1 的迁移与序列化保持。正式应用 schema 从 1 开始，并检查 Catalog ID 和 SHA-256 摘要。旧 wrappers 的局部 eventSequence 和 raw 外部 RNG 限制仅留在兼容面；不能当作应用 Commit 身份或正式创建接口。

规则与 CharacterId 现在接受 Catalog 中的稳定字符串 ID。legacy-v1 仍只包含五名已实现角色；未知内容必须拒绝。规则 v1 尚无生产 reaction handler，非空 Catalog reactions 会明确拒绝；原测试注入的 reaction registry 只用于验证解析器扩展缝。

## 验证

```sh
npm run check:core
npm run check:application
npm run check:baseline
```

core/application 各有不加载 DOM、React、Node ambient types 的类型门禁。AST 检查纯依赖、环境调用、循环及 UI 包污染。`structuredClone` 使用 Node 22/现代浏览器原生实现。

`npm test` 包含 core（Node）、application（Node）和 app（jsdom）三个项目。冻结兼容测试位于 `src/game-runtime/testing/battle`；S1 956 步的 JSON fixture 保留原路径与原字节。禁止用 `UPDATE_BATTLE_BASELINE=1` 重录预期。纯闭包和独立 Node 进程验证结果在 `dist/reports/s2/import`。

历史实施记录见 [S2 计划](../../docs/archive/plans/S2_APPLICATION_FOUNDATION_PLAN.md)。实际页面／回馆已经接通；复杂rp-style-lab适配仍未进入正式游戏。

## 版本复用与当前庄园

`createDemoBattleEngine` 按 Catalog rulesVersion 复用角色与战斗规则，`rules/v3/manor.ts` 提供关联意图、有限补席与批次末救离。`session/manor-progression.ts` 负责五层证据及接管前置，应用层另验事实历史。v4进一步提供玛铭约、历史战、成长／装备、经济与继承；当前内容3把回忆和维护终战改为刻仪兽。各旧版reader继续保留，不能用旧文档中的schema编号判断当前规则。
