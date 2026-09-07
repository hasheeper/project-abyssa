# Battle 页面与演出

本目录负责玩家输入、战斗／事件／AVG画面和提交后的演出。当前默认为**应用／规则4、内容3**；旧独立Battle的schema4／rules1／content1只是另一套兼容格式。

玩法数值、流程与完成度见[当前机制总览](../../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)，UI基线见[UI_PRESENTATION_BASELINE](UI_PRESENTATION_BASELINE.md)。旧设计日志与工程计划已进[历史档案](../../../docs/archive/README.md)。

## 核心保证

- 正式页面经game-client → runtime → application提交，由正确版本的core执行规则。
- 状态、事实、回执通过CAS保存成功后才播放演出；动画命中帧不能再次执行伤害或发奖励。
- 同一初始配置、seed与命令序列产生确定结果；当前head变化后，旧演出失效。
- React的皮肤、hover、目标选择、动画phase和timer不进入权威存档。
- 旧 `dispatchBattleCommand`／`resolveAtomicEffects` 是规则1接口，不是当前v4唯一入口；各版规则和reader独立校验。

## 数据流

```text
UI → controller → game-client → application → core
                                  │            ↓
                                  └── CAS提交（状态／事实／回执）
                                           ↓
                      已提交批次＋已验证head → 视觉副本 → 动画
```

## 目录职责

| 文件／层 | 当前职责 |
| --- | --- |
| `App.tsx`／`ExpeditionBattleScreen.tsx` | 页面入口与版本接线 |
| `ManorBattleBinding.tsx`／`ManorBattleView.tsx` | 正式庄园／回忆和完整AVG衔接 |
| `controller/useManorBattlePresentation.ts` | 庄园命令、查询、已提交事件与视觉队列 |
| `controller/useExpeditionBattleController.ts` | 旧裂隙兼容页面的提交与表现 |
| `presentation/` | 只读视图、事件转cue、机械仪表、道具坞、场景和角色演出 |
| `expedition*.css`／`battle-story.css`／`battleUiSkins.ts` | 布局、皮肤与过场，不承担规则 |
| `engine.ts` | 旧规则转发门面，仅兼容／测试；正式入口禁止依赖 |
| `src/game-core/battle/` | 分版本纯战斗规则、校验、RNG与selectors |
| `src/game-core/session/` | 远征、房间、资产、成长与结算 |
| `src/content/gameplay/demo-v3/` | 当前默认内容装配；legacy-v1仅用于旧档 |

## Command、effect 与 event

Command表示请求；Event表示规则产生的事实，不能重新当作命令应用。旧规则1通过AtomicEffect规划并执行写入；当前D5的命令／证据按其版本合同处理，不要求页面自行拼效果。具体接口见[开发手册](DEVELOPMENT_GUIDE.md)中的版本适用说明。

## Canonical state

权威记录由[应用服务](../../game-application/README.md)保存。当前普通远征、回忆与剧情状态各有严格reader，不能用旧BattleState字段或React状态反推。旧规则1字段参考仍在[CANONICAL_STATE](../../game-core/battle/domain/CANONICAL_STATE.md)。

## 随机、保存与撤回

当前规则保存自己的RNG、敌方队列和合法撤回点，应用层保留单调head、事实撤回与事务回执。v4掷骰／重掷会清掉此前撤回栈。页面刷新恢复已提交结果，不靠视觉随机决定骰面。

旧 `serializeBattleState`／`deserializeBattleState` 只处理历史独立Battle格式，不能用来保存当前完整Campaign。旧格式的迁移资料见[persistence](../../game-core/battle/persistence/README.md)。

## 新内容入口

先确定目标Catalog／规则版，再扩展对应core契约与内容定义。当前规则4的普通／历史入口分别为 `createD5BattleEngine`／`createD5MemoryEngine`；完整远征另经 `createD5ExpeditionEngine`。新教学路线还需解除现有庄园准入与终局约束，不能只替换敌人素材。

[扩展指南](docs/README.md)中的原子效果示例主要对应规则1；[开发手册](DEVELOPMENT_GUIDE.md)保留具体接口，使用前核对版本。

## 验证命令

```sh
npm run typecheck
npm run test:core
npm exec vitest -- run --project app src/apps/battle
npm run build:battle
```

按改动范围选择检查。确定性基线、规则测试、交互／恢复测试与人工视觉验收分别证明不同事情；通过测试不能代替难度／剧作验收，也不能无审查重录golden trace。

## 长期维护禁区

- 不在UI或selector直接改规则状态，不把函数、DOM、timer存入档案。
- 不绕过版本服务另建玩家资产或随机源。
- 不让AOE并行动画改变已提交的规则顺序。
- 不为未确定玩法引入ECS、脚本VM或无限词条系统。
- 调整布局／接线须保留用户已定的组件与美术语言，避免用另一套样式替换。

## S3 演出合同

此合同仍适用：提交成功后安排演出，impact只更新视觉值，finish安装最新已验证状态。敌方意图按已提交事件顺序呈现；取消、卸载或更新head使旧队列失效，不能因此撤回已提交命令。

装载、投掷、重掷、行动、撤回、深入和离场走正式持久命令；选目标、皮肤、hover为本地UI。终局结算确认后才返回洋馆。全AVG衔接复用SceneSequence，规范见[战斗与AVG交接](../../../docs/design/BATTLE_AVG_SCENE_HANDOFF.md)。旧文档的“命中帧提交状态”仅描述历史实现。
