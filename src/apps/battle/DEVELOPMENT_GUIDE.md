# Battle 开发手册

> 版本适用说明（2026-09-07）：当前默认为应用／规则4、内容3。正式页面使用game-client与应用事务，权威命令先提交，impact只更新视觉副本。下文保留的BattleCommand、AtomicEffect、三条RNG及独立BattleSaveDto主要是**规则1兼容API**，不能直接套到D5；UI演出原则仍有效。入口、取消与恢复见 [Battle README](README.md#s3-演出合同) 和 [客户端说明](../../game-client/README.md)。

> 旧独立Battle格式：schema v4 / rules v1 / content v1；它与应用v4存档不同。
> 适用目录：`src/apps/battle/` 与 `src/game-core/battle/`
> 文档目标：让后续开发者能快速定位接口、沿正确边界新增功能，并完成必要验证。

本文保留实际存在的接口参考，并区分当前路径与兼容实现。文件定位使用“路径 + 导出符号”，不绑定行号；可用 `rg "符号名" src/apps/battle src/game-core/battle` 查找。完整现行机制见[总览](../../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)。

当前生产定位：`ManorBattleBinding`／`useManorBattlePresentation`负责页面与演出；`createD5Application`负责事务；`createD5ExpeditionEngine`负责普通远征；`createD5BattleEngine`／`createD5MemoryEngine`负责战斗。`rules/v2`、`v3`、`v4`按版本复用，内容由`game-runtime/loop-context.ts`绑定。

产品理念和长期设计讨论请参考 [`DESIGN_REFERENCE_LOG.md`](../../../docs/archive/battle/DESIGN_REFERENCE_LOG.md)。它用于解释设计动机，不代表其中所有内容已经实现。

## 1. 快速开始

Battle 页面入口：

- HTML：项目根目录 `battle.html`
- React 启动：`src/apps/battle/main.tsx`
- 页面壳：`src/apps/battle/App.tsx`
- 主战斗界面：`src/apps/battle/ExpeditionBattleScreen.tsx`
- 正式庄园／回忆接线：`src/apps/battle/ManorBattleBinding.tsx`
- 旧兼容门面：`src/apps/battle/engine.ts`，正式入口禁止依赖

本地运行与验证：

```sh
npm run dev:battle
npm run typecheck
npm run test:core
npm exec vitest -- run --project app src/apps/battle
npm run build:battle
npm exec vitest -- bench --project core --run
```

正式UI从game-client → runtime/application提交事务；旧兼容测试可使用`engine.ts`。`createBattleEngine(validatedCatalog, routeId)`仅绑定规则1；当前规则4使用上方D5入口。内核不得回到app facade。

本指南的 domain/rules/selectors/persistence 路径以 `src/game-core/battle` 为基准；testing 在 `src/game-runtime/testing/battle`，content 在 `src/content/gameplay/legacy-v1`。controller/presentation/engine.ts 仍以 `src/apps/battle` 为基准。S2 已参数化 Catalog 和应用事务。以下扩展说明以旧规则为例；新内容须独立版本，生产 Catalog 暂不接受未注册 reactions。

最小规则1兼容调用（catalog由装配层校验并传入）：

```ts
import { createBattleEngine } from "../../game-core/battle";
const engine = createBattleEngine(catalog, catalog.data.defaultRouteId);
let state = engine.create({ seed: 42, partyIds: [...catalog.data.defaultParty] });
const rolled = engine.dispatch(state, { type: "roll-dice" });
if (!rolled.error) state = rolled.state;
```

该调用只计算规则。正式存档、请求回执、Fact 和页面接线见 [应用层说明](/Users/liuhang/Documents/project-abyssa/src/game-application/README.md)。

## 2. 架构与依赖方向

下图为旧规则1内部的效果解析结构；正式页面外层还有应用事务，完整数据流见[Battle README](README.md#数据流)。

```text
content definitions
        │
        ▼
UI → controller → BattleCommand → dispatcher → rule planner
                                                   │
                                                   ▼
                                      AtomicEffect resolver
                                         │             │
                                         ▼             ▼
                                  canonical state   BattleEvent[]
                                         │             │
                                         ├→ selectors → UI
                                         └→ persistence
```

当前依赖方向与旧兼容路径：

```text
正式UI / controller → game-client → runtime/application → 对应版本core
旧兼容测试 → app engine facade → game-runtime legacy-battle → 规则1实现
内容由runtime显式绑定，core不反向依赖app
```

`domain/` 不依赖 React、DOM 或表现代码。UI 不得导入内部 resolver 并直接写规则状态。

### 2.1 目录地图

本表列出规则1兼容实现；当前D5另见文首路径。

| 位置 | 核心符号 | 职责 |
| --- | --- | --- |
| `domain/state.ts` | `BattleState`、`ExpeditionState`、`BattleMode`、loadout/status 类型 | Canonical 可序列化状态。 |
| `domain/commands.ts` | `BattleCommand`、`BattleTransition`、`BattleError` | 规则输入与统一返回值。 |
| `domain/effects.ts` | `AtomicEffect`、modifier/reaction 接口 | 最小规则写入与扩展协议。 |
| `domain/events.ts` | `BattleEventPayloadMap`、`BattleEvent` | 已发生事实及其 payload。 |
| `domain/targets.ts` | `TargetRef`、`EffectSourceRef` | 命令、效果、事件共用的可序列化引用。 |
| `domain/invariants.ts` | `collectExpeditionInvariantViolations` | 生产存档和测试共用的一致性校验。 |
| `domain/versions.ts` | 三个 `BATTLE_*_VERSION` | schema、规则与内容版本。 |
| `src/content/gameplay/legacy-v1/catalog.ts（balance）` | HP、层数、重掷、狂暴等常量 | 旧裂隙玩法数值。 |
| `src/content/gameplay/legacy-v1/catalog.ts（characters）` | characters/defaultParty | 角色与六面骰数据。 |
| `src/content/gameplay/legacy-v1/catalog.ts（enemies/encounters/routes）` | 敌人模板与遭遇表 | 通用工厂在 core 的 `rules/enemies.ts`。 |
| `src/content/gameplay/legacy-v1/catalog.ts（effects/actionEffects）` | effect/action definition registries | 可序列化 definition 与代码 handler 的连接点。 |
| `rules/dispatcher.ts` | `dispatchBattleCommand` | 规则1命令入口、RNG stream选择。 |
| `rules/actions.ts` | `performAttack/Block/Heal/Steal` | 玩家动作合法性与效果规划。 |
| `rules/dice-actions.ts` | roll/reroll/load transitions | 骰子动作。 |
| `rules/turns.ts` | 敌方阶段准备、狂暴、下一回合 | 回合生命周期与意图公开。 |
| `rules/enemy-intents.ts` | `resolveEnemyIntentTransition` | 严格结算一只敌人的已公开意图。 |
| `rules/settlement.ts` | 层结算、贪心、离场 | 奖励与远征终局。 |
| `rules/resolver.ts` | `resolveAtomicEffects`、`resolveEffectsCommand` | 唯一核心效果写入、事件、reaction 与 undo。 |
| `rules/effect-runtime.ts` | `compileEffectRuntime` | 从道具、装备、特质、状态编译 modifier/reaction。 |
| `rules/modifiers.ts` | `applyNumericModifiers` | 伤害/治疗前数值修正。 |
| `rules/reactions.ts` | `collectEventReactions` | 事件触发和 exactly-once。 |
| `rules/lifecycle.ts` | `advanceStatusDurations` | 显式推进状态期限。 |
| `rules/compatibility.ts` | 旧函数式 API | 仅兼容已有调用；新代码优先使用 command。 |
| `selectors/` | battle/targeting/presentation selectors | 无副作用派生值。 |
| `persistence/` | DTO、迁移、clone、RNG | 保存、恢复与确定性。 |
| `controller/` | Battle hook、presentation queue、event cue | React 编排边界。 |
| `testing/` | scenario、baseline、effect fixtures | 构造场景和扩展缝验证。 |

### 2.2 UI 文件地图

| 位置 | 内容 |
| --- | --- |
| `App.tsx` | 受控 `uiSkin` 所有者；同步 Stage 背景主题、区域抵达标题与内部战斗框。 |
| `battleUiSkins.ts` | `timber` / `hero-party` / `demon-cadre` / `demon-lord` / `old-manor` 的文案与装饰资产登记。 |
| `ExpeditionBattleScreen.tsx` | 交互路由、演出阶段、命中帧提交、敌人逐只 runner、主布局。 |
| `ExpeditionDie3D.tsx` | 3D 骰子、骰面与旋转。 |
| `ExpeditionGlyph.tsx` | Battle 图标映射。 |
| `ExpeditionReels.tsx` | 数值转轮与包裹金币。 |
| `expedition.css` | Battle 主视觉、五套主题 token、背景滤镜、框体层级、布局合同、动画和区域裁剪。 |
| `app.css` | Battle 页面壳样式。 |
| `../../shared/transition/` | 跨 HTML 黑幕、区域标题与 `panel-drop`；不持有 Battle 状态。 |
| `controller/presentation-events.ts` | 领域事件到攻击/支援/敌方演出 cue。 |
| `controller/usePresentationQueue.ts` | 唯一 busy/runId/timer 队列。 |

攻击特效必须保留在敌方 formation 的裁剪区域内；跨区意图线使用独立层，不能因为裁剪攻击特效而截断。相关契约已有 UI 测试。

主题切换属于纯表现状态，不允许写入 `BattleState`、checkpoint、save DTO 或 event。修改皮肤 token、装饰层或 Battle 专属 content bleed 前，先阅读 [`UI_PRESENTATION_BASELINE.md`](UI_PRESENTATION_BASELINE.md)，并同时检查五套主题；外层 Stage 和内部 frame 必须消费同一个受控 `uiSkin`。

## 3. 核心接口

本节接口均为旧规则1技术参考；当前D5命令和存档按对应版本合同执行。

### 3.1 `BattleCommand`

位置：`domain/commands.ts`

所有正式规则操作都由判别联合 `BattleCommand` 表示。新增命令后，`dispatcher.ts` 的穷尽 switch 必须同步处理，否则类型检查失败。

| Command | 必要参数 | 合法状态/用途 |
| --- | --- | --- |
| `roll-dice` | 无 | `awaiting-roll`；自动首次掷骰。 |
| `reroll-dice` | 无 | `player-turn` 且有剩余重掷。 |
| `toggle-load` | `dieIndex` | 装载或卸载一枚可用骰。 |
| `attack-enemy` | `actorId/enemyId` | 已装载攻击或万能面。 |
| `block-intent` | `actorId/enemyId` | 已装载防御或万能面，目标须有攻击意图。 |
| `heal-member` | `actorId/targetId` | 已装载治疗面，目标存活且非满血。 |
| `steal-from` | `actorId/enemyId` | 已装载金币面。 |
| `undo` | 无 | 玩家阶段且 undo 栈非空。 |
| `end-turn` | 无 | 同步结算整段敌方回合；也用于最后一击后的清层确认。 |
| `begin-enemy-turn` | 无 | UI 分段演出：冻结敌方顺序与 closing hand。 |
| `resolve-next-enemy` | 无 | 只结算 `enemyOrder[cursor]` 指向的一只。 |
| `finish-enemy-turn` | 无 | cursor 到末尾后执行狂暴反噬和回合结算。 |
| `next-round` | 无 | outcome 为 continue 后进入下一玩家回合。 |
| `go-deeper` | 无 | `greed` 状态进入下一层。 |
| `leave-expedition` | 无 | `greed` 状态带宝离场。 |

正式调用签名：

```ts
function dispatchBattleCommand(
  state: ExpeditionState,
  command: BattleCommand,
  context?: BattleDispatchContext
): BattleTransition;
```

`BattleDispatchContext.rng` 是兼容测试入口。新生产调用不传 context，随机数从 state 读取。

### 3.2 `BattleTransition`

位置：`domain/commands.ts`

```ts
type BattleTransition = {
  state: ExpeditionState;
  events: BattleEvent[];
  error: BattleError | null;
};
```

调用约定：

- `error === null`：可以提交 `state`，并按 `events` 驱动演出。
- `error !== null`：不得提交结果状态，也不得播放成功演出。
- 应用层在事务提交前执行该检查，Controller 只接收已提交回执。
- 规则函数不得修改输入对象；测试应保留一份输入快照验证。

玩家动作错误包括：`not-act-phase`、`die-not-loaded`、`die-spent`、`die-sealed`、`wrong-face`、`invalid-target`、`target-full-hp`、`no-attack-intent`。流程不允许时返回 `command-not-available`。

### 3.3 `BattleState` / `ExpeditionState`

位置：`domain/state.ts`。`ExpeditionState` 是现有 UI 保留的兼容名称，实际等同 `BattleState`。

主要字段分组：

| 分组 | 字段 |
| --- | --- |
| 远征进度 | `location/layer/deepestLayer/round/mode/result` |
| 战斗指标 | `layerStartEnemies/lastTossed/stalledRounds/lastEnemyHp/rerollsRemaining` |
| 经济 | `gold/bagGold/handMultiplier/lastLayerSettlement` |
| 实体 | `party/dice/enemies` |
| 确定性 | `rng/eventSequence/enemySequence` |
| 效果运行时 | `pendingEffects/pendingReactions/statuses/encounterRules` |
| 装配 | `loadoutAtStart/loadout` |
| 回退与历史 | `undoStack/log/facts` |

`BattleMode` 是流程唯一权威：

```ts
type BattleMode =
  | { type: "awaiting-roll" }
  | { type: "player-turn" }
  | {
      type: "enemy-turn";
      enemyOrder: string[];
      cursor: number;
      closingHand: HandEvaluation | null;
      outcome: RoundOutcome | null;
    }
  | { type: "greed" }
  | { type: "finished" };
```

不要重新添加 `phase/status/lastOutcome`、`enemy.dead`、骰子 `downed/rustLevel` 等镜像。完整权威规则见 `domain/CANONICAL_STATE.md`。

### 3.4 `TargetRef` 与 `EffectSourceRef`

位置：`domain/targets.ts`

`TargetRef` 统一描述角色、敌人、骰子、意图、资源或整场战斗。`EffectSourceRef` 描述效果来自角色骰、敌人、状态、装备、道具、特质、遭遇或系统。

不得把 React key、DOM 节点或数组下标写入 target/source。实体目标使用稳定角色 ID、敌人 ID 或 instance ID。

### 3.5 `AtomicEffect`

位置：`domain/effects.ts`；执行位置：`rules/resolver.ts`。

所有原子效果共享：

```ts
type AtomicEffectBase = {
  id: string;
  source: EffectSourceRef;
  causeId: string | null;
  batchId: string | null;
  tags: string[];
};
```

现有效果族：

| 效果族 | 类型示例 |
| --- | --- |
| 动作边界 | `declare-action`、`complete-action`、`complete-enemy-intent` |
| 数值 | `damage`、`heal`、`guard`、`modify-stat` |
| 骰子/角色 | `commit-dice-roll`、`modify-die`、`set-die-load`、`revive` |
| 状态 | `apply-status`、`modify-status`、`remove-status`、`cleanse` |
| 敌人/意图 | `modify-enemy`、`modify-intent`、`spawn-unit`、`despawn-unit`、`flee-unit` |
| 资源/奖励 | `modify-resource`、`modify-reward` |
| 道具/装备 | `consume-item`、`consume-equipment-durability` |
| 流程 | `prepare-enemy-turn`、`finalize-round`、`start-player-round`、`start-layer`、`enter-greed`、`finish-expedition` |
| 记录 | `append-log`、`append-fact`、`report-damage` |

规则规划器负责判断“应该发生什么”，resolver 负责修改 state、应用 modifier、收束死亡/力竭、发 event 和运行 reaction。

调用接口：

```ts
resolveAtomicEffects(input, effects, options?): EffectResolution;

resolveEffectsCommand(
  input,
  actionLabel,
  effects,
  options?
): EffectResolution;
```

只有需要一个可撤回玩家动作时使用 `resolveEffectsCommand`；它会保存完整命令前 checkpoint。自动掷骰、敌方步骤和生命周期使用 `resolveAtomicEffects`。

### 3.6 Modifier 与 Reaction

定义位置：`domain/effects.ts`
编译位置：`rules/effect-runtime.ts`
执行位置：`rules/modifiers.ts`、`rules/reactions.ts`

```ts
type EffectModifier = {
  instanceId: string;
  definitionId: string;
  sourceId: string;
  priority: number;
  window: "before-damage" | "before-heal";
  operation: "add" | "multiply" | "reduce" | "prevent" | "pierce" | "redirect";
  value: number;
  requiredTags: string[];
  targetKinds: ("party-member" | "enemy")[];
  redirectTarget?: UnitTargetRef;
};
```

```ts
type ReactionBinding = {
  instanceId: string;
  definitionId: string;
  sourceId: string;
  priority: number;
  eventTypes: BattleEvent["type"][];
  data: JsonValue;
};
```

两者都按 `priority → sourceId → instanceId` 升序执行。Reaction handler 的接口为：

```ts
type ReactionHandler = (context: {
  state: Readonly<ExpeditionState>;
  event: BattleEvent;
  binding: ReactionBinding;
}) => AtomicEffect[];
```

handler 只能返回效果，不得修改只读 state。单个 binding 对同一 event 至多触发一次。

内容 definition 与运行参数：

```ts
type BattleEffectDefinition = {
  definitionId: string;
  modifiers: readonly EffectModifierTemplate[];
  reactions: readonly ReactionBindingTemplate[];
};

type EffectResolutionOptions = {
  modifiers?: readonly EffectModifier[];
  reactions?: readonly ReactionBinding[];
  reactionRegistry?: ReactionRegistry;
  effectDefinitions?: BattleEffectDefinitionRegistry;
  maxEvents?: number;
  maxDepth?: number;
};
```

默认上限为 256 个事件和 8 层触发深度。解析错误为 `event-budget-exceeded`、`trigger-depth-exceeded`、`invalid-effect-target` 或 `missing-reaction-handler`；存在错误时调用方不得提交返回状态。

### 3.7 Status 与内容实例

位置：`domain/state.ts`

- `StatusInstance`：战斗状态。
- `EncounterRuleInstance`：当前遭遇规则。
- `ItemInstance`：带 `charges/maxCharges`。
- `EquipmentInstance`：带 slot 与耐久。
- `TraitInstance`：角色固有或装配特质。

实例只保存 `definitionId` 和 JSON `data`；函数保存在 registry。`compileEffectRuntime` 会收集仍有效的道具、装备、特质、状态和遭遇规则。

状态通过 `apply-status` 进入，支持 `replace/refresh/stack/extend`。持续时间由 `advanceStatusDurations` 在明确生命周期边界推进，不会随 UI timer 自动减少。

### 3.8 `BattleEvent`

位置：`domain/events.ts`

事件由 `BattleEventPayloadMap` 映射成判别联合，因此新增 event type 时 payload 与消费方能够自动收窄。

```ts
type BattleEventEnvelope<TType extends string, TPayload> = {
  id: string;
  type: TType;
  payload: TPayload;
  source: EffectSourceRef;
  causeId: string | null;
  batchId: string | null;
  sequence: number;
};
```

- `id`：跨本次状态历史唯一，基于 `eventSequence`。
- `causeId`：指向命令或触发它的事件/效果。
- `batchId`：表现层可并行动画的视觉批次，不改变规则顺序。
- `sequence`：当前 transition 内严格规则顺序。

常用演出事件：`damage-applied`、`guard-applied`、`healing-applied`、`unit-defeated`、`unit-downed`、`enemy-intent-resolved`、`layer-cleared`、`resource-changed`。

消费时使用判别联合收窄，不要把 payload 强制断言成任意对象：

```ts
type DamageEvent = Extract<BattleEvent, { type: "damage-applied" }>;

function readDamage(event: DamageEvent) {
  return event.payload.applied;
}
```

### 3.9 Loadout 输入与战斗输出

位置：`domain/state.ts`、`rules/loadout.ts`

```ts
type BattleStartInput = {
  location?: string;
  loadout?: BattleLoadoutSnapshot;
};

type BattleCompletionOutput = {
  result: ExpeditionResult | null;
  loadout: BattleLoadoutSettlement;
};
```

`loadoutAtStart` 是开战快照，`loadout` 是战斗中剩余次数/耐久。`createBattleCompletionOutput(state)` 输出最终结果与实际消耗差值，战斗外系统不应解析日志计算消耗。

### 3.10 `BattleSaveDto`

位置：`persistence/dto.ts`

```ts
type BattleSaveDto = {
  schemaVersion: typeof BATTLE_SCHEMA_VERSION;
  rulesVersion: typeof BATTLE_RULES_VERSION;
  contentVersion: typeof BATTLE_CONTENT_VERSION;
  state: ExpeditionState;
};
```

三个版本号语义独立。字段形状变化递增 schema；规则计算变化递增 rules；手工内容语义变化递增 content。

## 4. 公共 API 与使用边界

| 稳定级别 | 入口 | 约定 |
| --- | --- | --- |
| 旧测试兼容入口 | `src/apps/battle/engine.ts` | 转发game-core legacy，正式页面禁止依赖。 |
| 新内部入口 | `src/game-core/battle/index.ts` | 状态内 RNG、typed 命令与 Battle 存档；外部 JSON 仍需应用层验证。 |
| 规则1命令入口 | `dispatchBattleCommand` | 只适用于规则1，当前v4通过D5引擎。 |
| 规则内部接口 | `rules/*Transition`、resolver | 供 Battle 内部组合与测试，不应由 React 直接调用。 |
| 旧调用兼容 | `rules/compatibility.ts` | 只做代理；不要继续加入核心实现。 |
| 表现接口 | Controller、selectors、presentation cues | 只读状态/事件，不拥有规则真相。 |

### 4.1 创建战斗

| API | 位置 | 用途 |
| --- | --- | --- |
| `createExpeditionFromSeed(seed, location?)` | `rules/compatibility.ts` | 测试、回放和普通固定 seed 创建。 |
| `createExpedition(rng, location?)` | `rules/compatibility.ts` | 兼容既有函数式调用。 |
| `createExpeditionStateFromInput(rng, input)` | `rules/expedition.ts` | 带 loadout 的领域构造 helper。 |
| `createExpeditionTransition(...)` | `rules/expedition.ts` | 需要创建事件的内部流程。 |

本表是旧规则1创建方式。当前正式出征已通过版本化命令传入seed、队伍和补给，并冻结配置；不要再新增绕过事务的UI创建门面，也不要把不可追踪RNG传入存档流程。

### 4.2 读取状态

优先使用 `selectors/`：

- 流程：`getBattlePhase`、`getExpeditionStatus`、`getRoundOutcome`。
- 生死/骰子：`isEnemyDefeated`、`isDieDowned`、`getStateFace`。
- 交互：`canToggleLoad`、`canActWith`、`canUndo`。
- 敌方威胁：`getIncomingDamageFor`、`getIntentThreat`。
- 展示：`getFrenzyWarningRounds`、`getGreedSummary`。
- 统计：`getEnemyTotalHp`、`getPartyTotalHp`、`getLayerPayout`。

如果一个值可从 canonical state 计算，应新增 selector，不应添加新的可写字段。

### 4.3 保存与恢复

位置：`persistence/`

```ts
import {
  deserializeBattleState,
  serializeBattleState
} from "./engine";

const json = serializeBattleState(state);
const restored = deserializeBattleState(json);
```

相关接口：

| API | 作用 |
| --- | --- |
| `createBattleSaveDto` | 生成带三种版本戳的深拷贝 DTO。 |
| `serializeBattleState` | DTO → JSON。 |
| `migrateBattleSaveDto` | 未知输入 → 逐版迁移 → shape/invariant 校验。 |
| `deserializeBattleState` | JSON → 当前 canonical state。 |
| `createBattleRngState/createRngCursor` | 状态 RNG 基础设施。 |

旧独立Battle的schema v1→v2→v3→v4迁移链见core中的`persistence/README.md`；当前应用导入与复制升级另由应用服务负责。

### 4.4 Controller 接口

位置：`controller/useExpeditionBattleController.ts`

Hook 返回：

| 字段/方法 | 用途 |
| --- | --- |
| `state/getState()` | 当前视觉副本；不是可写存档。 |
| `submit(command)` | 提交会话命令，等待持久批次与必要收尾。 |
| `show(state)` | 安装回执事件的视觉投影。 |
| `finish()` | 结束演出并安装最新已验证存档。 |
| `current(batch)` | 检查批次仍匹配当前 head。 |
| `heldActor/holdActor` | UI 目标选择。 |
| `ready/presenting/generation` | 输入锁与外部失效代次。 |

挂载必须已有匹配的存档和 expeditionId。新远征只由 Map 的 start-expedition 创建；终局由 settle-expedition 入账后返回洋馆。完整协议见 [controller README](controller/README.md)。

### 4.5 演出 Cue

位置：`controller/presentation-events.ts`

- `getPlayerAttackCue(events)`：从敌方 `damage-applied` 读取攻击者、目标、伤害和 lethal。
- `getPlayerSupportCue(events)`：从 `guard-applied/healing-applied` 读取支援类型与实际数值。
- `getEnemyTurnCue(events)`：读取 `enemy-intent-resolved`。
- `groupPresentationEventsByBatch(events)`：按 `batchId` 分组，保持领域顺序。

UI 不比较前后 HP、盾牌或金币来猜动作类型。

## 5. 运行流程

### 5.1 玩家动作与命中帧

1. 只读 selector 判断交互，UI 构造 command。
2. controller.submit 经 GameSession 提交完整请求，在 IndexedDB 事务完成后返回。
3. 会话从持久态驱动必要收尾并再次读取，核对回执和 head。
4. 从已提交 events 提取 cue，播放 anticipate/release 等阶段。
5. impact 仅将 hpAfter/shieldAfter 等观察值应用到视觉副本。
6. 演出完成安装最新持久状态；刷新/换 head 取消旧队列。

### 5.2 敌方逐只呈现

一次公共 end-turn 执行完整敌方规则批次；outcome=continue 时会话再提交 next-round。动画按 enemy-intent-resolved 拆成顺序小组，逐只播放，但不调用 begin/resolve-next/finish 等内部命令。导入旧 enemy-turn/outcome=null 时，resumeEnemyTurn 从持久 cursor 继续，已经发生的行动不重放规则。

### 5.3 最后一击与自动清层

最后击杀提交后，若持久态仍是 player-turn 且所有敌人死亡，会话调用既有 end-turn 将本层散金与最后牌型计入包裹。此步骤在演出前完成；斩杀退场与结算弹窗之间可以保留视觉延迟。刷新时由同一恢复协议完成，不等待动画 ack。

### 5.4 力竭与下一层复归

HP 降至 0 时，resolver 统一设置力竭、清盾、卸载骰子并增加锈蚀。角色本层后续回合保持力竭；只有 `startLayerTransition` 在下一层用 `revive` 效果恢复至 `DOWNED_RETURN_HP`。UI 只显示该状态，不负责复活。

## 6. 功能需求定位表

| 需求 | 首要修改位置 | 通常还需检查 |
| --- | --- | --- |
| 调整 HP、重掷、层倍率、狂暴数值 | `src/content/gameplay/legacy-v1/catalog.ts（balance）` | economy/turn tests、golden trace、UI 文案。 |
| 修改角色骰面 | `src/content/gameplay/legacy-v1/catalog.ts（characters）` | dice/hand/action tests。 |
| 给现有骰面增加资源副作用 | `src/content/gameplay/legacy-v1/catalog.ts（effects/actionEffects）`、`rules/action-effects.ts` | `actions.ts` 组合点、event 测试。 |
| 增加玩家命令 | `domain/commands.ts`、`rules/dispatcher.ts` | 新规则 planner、Controller 路由、穷尽检查。 |
| 增加原子效果 | `domain/effects.ts`、`rules/resolver.ts` | effect target、事件、预算测试。 |
| 增加领域事件 | `domain/events.ts` | resolver emitter、reaction、presentation cue。 |
| 增加敌人/层配置 | `src/content/gameplay/legacy-v1/catalog.ts（enemies/encounters/routes）` | `EnemyKind`、意图生成、素材映射。 |
| 增加敌人意图 | `domain/state.ts`、`rules/turns.ts`、`rules/enemy-intents.ts` | UI glyph/cue、串行行动测试。 |
| 增加状态 | effect definition、应用它的 planner | lifecycle boundary、清除/免疫/死亡测试。 |
| 增加被动装备/词条 | `src/content/gameplay/legacy-v1/catalog.ts（effects/actionEffects）` | modifier/reaction registry、loadout 测试。 |
| 增加主动道具 | 新 `use-item` command 与通用处理器 | `TargetingMode.item`、消耗/undo/演出。 |
| 增加 selector | `selectors/*-selectors.ts`、`selectors/index.ts` | module boundary test、UI 调用。 |
| 增加 canonical state 字段 | `domain/state.ts`、`domain/invariants.ts` | schema 版本、迁移、checkpoint、golden。 |
| 修改攻击/治疗/受击动画 | `ExpeditionBattleScreen.tsx`、`expedition.css` | cue 合同、reduced-motion、裁剪和 UI 时序测试。 |
| 修改存档形状 | `domain/versions.ts`、`persistence/migrate.ts` | DTO 校验、嵌套 undo 迁移、persistence tests。 |

更具体的内容指南：

- `docs/ADDING_CHARACTER_ABILITY.md`
- `docs/ADDING_ENEMY_INTENT.md`
- `docs/ADDING_ITEM.md`
- `docs/ADDING_STATUS.md`
- `docs/ADDING_AFFIX.md`

## 7. 常见扩展流程

### 7.1 新增 Command

1. 在 `BattleCommand` 增加判别成员，参数只用可序列化 ID/值。
2. 在 dispatcher switch 增加分支。
3. 新建或复用规则 planner，先检查 mode、actor、资源和 target。
4. 规划原子效果；玩家可撤回动作使用 `resolveEffectsCommand`。
5. 返回 event，Controller 只消费 event。
6. 增加合法、非法、输入不可变、undo/RNG 和 UI 路由测试。

不要在 command handler 里直接改输入 state。

### 7.2 新增 Atomic Effect

1. 扩展 `AtomicEffect` 判别联合。
2. 在 resolver 的 `effectTarget` 和 `applyAtomicEffect` 穷尽 switch 中处理。
3. 明确 target 缺失、数值边界和死亡收束。
4. 发一个描述结果的专用 event；`effect-applied` 只是通用审计，不替代业务事件。
5. 测试 modifier/reaction 交互、事件预算和失败路径。

只有现有原子效果无法组合需求时才增加类型。

### 7.3 新增 Event

1. 在 `BattleEventPayloadMap` 增加 payload。
2. 由 resolver/dispatcher 的 typed emitter 发出。
3. 若可触发词条，测试 reaction narrowing 与 exactly-once。
4. 若玩家可见，在 `presentation-events.ts` 增加 cue 或扩展现有 cue。
5. 不把 event 再作为 command 应用；event 表示事实，不是请求。

### 7.4 新增状态字段或改 schema

1. 先判断能否由 selector 派生。
2. 确实需要存储时，更新 state 类型与初始值。
3. 增加 invariant。
4. `BATTLE_SCHEMA_VERSION + 1`。
5. 新增严格的单步迁移，包含 `undoStack[*].state`。
6. 增加旧版 → 当前版、非法输入、中途恢复和 JSON round-trip 测试。

不能用 `as ExpeditionState` 代替迁移与校验。

### 7.5 新增动画

1. 先确认规则已发出足够 event。
2. 在 cue helper 抽出展示所需的最小只读数据。
3. 复用统一 presentation queue，不另建独立全局 busy/timer 系统。
4. 规则先持久提交，impact 只更新可丢弃的视觉副本。
5. 提供 reduced-motion 时长路径和 runId 取消。
6. 检查敌方区域裁剪、DOM 留存退场、FLIP 补位和交互锁定。

动画 phase 不进入存档，也不进入 undo。

## 8. RNG、Undo 与确定性

下文三条RNG与checkpoint细节对应规则1；当前v4还有事件／回忆边界，且掷骰／重掷清除此前撤回栈，不能沿用旧版撤回许可。

### 8.1 RNG stream

位置：`persistence/rng.ts`

| Stream | 用途 |
| --- | --- |
| `combat` | 骰面、敌人选择、遭遇战斗随机。 |
| `loot` | 奖励、结算和晶石等。 |
| `flavor` | 不影响主数值的随机事实。 |

每条 stream 保存 `algorithm/seed/cursor`。命令成功才提交 cursor，失败命令不得消耗随机。`Math.random` 只能用于创建正式运行的初始 seed，或用于不影响规则的视觉随机。

### 8.2 Undo

`BattleCheckpoint` 保存完整命令前核心状态，但不递归包含 undo 栈。一条玩家命令、它的副作用、reaction、道具消耗和耐久变化必须共用一个 checkpoint。

以下是规则1兼容行为；当前v4以对应规则及前述撤回边界为准：

- 装载/卸载和角色行动可撤回。
- 首次掷骰与重掷不建立动作 checkpoint。
- 重掷会清理此前不可继续使用的撤回历史。
- 演出进行中UI禁用undo；持久命令先于演出提交，演出结束后按规则开放。

## 9. 测试位置与职责

| 测试 | 覆盖内容 |
| --- | --- |
| `engine.test.ts` | 当前玩法与兼容 API 主回归。 |
| `ExpeditionBattleScreen.test.tsx` | 交互、演出时序、逐只受击、斩杀退场、自动清层与样式合同。 |
| `engine.baseline.test.ts` | 五个 seed 的完整 golden trace、输入不可变。 |
| `rules/resolver.test.ts` | 原子效果、modifier、reaction、状态、预算、undo。 |
| `rules/dispatcher.test.ts` | Command 网关、事件与错误。 |
| `rules/turns.test.ts` | 狂暴与回合生命周期。 |
| `rules/enemy-intents.test.ts` | 单只敌方意图结算。 |
| `rules/effect-compatibility.test.ts` | 道具/装备/词条扩展缝。 |
| `persistence/persistence.test.ts` | JSON、迁移、RNG、undo 与中途恢复。 |
| `controller/presentation-events.test.ts` | Event → cue。 |
| `controller/useExpeditionBattleController.test.ts` | 正式 RNG 边界。 |
| `module-boundaries.test.ts` | facade 与模块导出边界。 |
| `testing/scenario.ts` | 推荐的场景构造器。 |

新增规则的最低测试组合：

1. 成功路径。
2. 非法阶段/目标/资源路径，且输入不变。
3. event payload 和顺序。
4. undo 与 RNG cursor。
5. 存档 round-trip（新增状态时）。
6. UI cue/impact 时序（玩家可见时）。

只有确认是有意规则变化并审查首个差异后，才可运行：

```sh
UPDATE_BATTLE_BASELINE=1 npm run test:core
npm exec vitest -- run --project app src/apps/battle/engine.baseline.test.ts
```

不能为了让测试变绿直接批量更新 golden。

## 10. ID、排序与批次约定

- Definition ID：稳定、带命名空间，例如 `status.frenzy-active`。
- Instance ID：标识当前这一件/这一层状态，例如 `frenzy-active:enemy-3`。
- Effect ID：同一命令内唯一且确定，不使用 `Date.now()` 或 UUID。
- Enemy ID：由 `enemySequence` 生成，不使用数组位置。
- Modifier/reaction 顺序：`priority → sourceId → instanceId`。
- Event 顺序：transition 内 `sequence` 从 0 递增。
- AOE：每个目标独立 effect/event，可共享 `batchId`。
- `batchId` 只控制表现并行，不允许改变规则先后。

## 11. 当前扩展边界

以下能力已有底座，但不是完整成品，开发时不要误判：

- 核心可描述 item/ability 目标，但正式页面尚无通用 `use-item/use-ability` command。
- 道具次数、装备耐久及离场结算底座已实现，Map/洋馆已接真实库存；冻结 Catalog 尚无 item/equipment 定义，真实可用内容另行版本化。
- 通用 status duration helper 已实现，但每种期限仍必须在正确 canonical transition 显式推进。
- 手工词条可由 modifier/reaction 表达，但没有随机前后缀、词条池或独立 `AffixInstance`。
- `pendingEffects/pendingReactions` 是可序列化槽位，但当前 resolver 不暴露暂停帧并会同步清空；不要手工写入非空队列，也不要依赖“保存一半触发链”续跑。
- `rules/compatibility.ts` 仍是必要公共兼容门面，不应继续堆新规则实现。

## 12. 提交前检查清单

- [ ] 没有修改输入 state。
- [ ] 所有正式写入经 command 与 resolver。
- [ ] 没有新增可由 selector 派生的镜像字段。
- [ ] 没有新增 `Math.random` 规则调用。
- [ ] Command、effect、intent、modifier 等 switch 仍穷尽。
- [ ] 可见结果有结构化 event，UI 没有 diff state 猜结果。
- [ ] Reaction 可终止且 exactly-once。
- [ ] Undo 包含全部副作用、消耗和 RNG。
- [ ] 新 schema 有顺序迁移与嵌套 checkpoint 处理。
- [ ] 敌方行动仍逐只演出。
- [ ] 动画支持取消、reduced-motion 和交互锁定。
- [ ] 攻击特效没有越出敌方容器，意图线未被错误裁剪。
- [ ] 表现层改动已按 `UI_PRESENTATION_BASELINE.md` 检查五套主题、装饰压接、语义色和场景入场。
- [ ] 类型检查、全部 Battle 测试、Battle 构建通过。
- [ ] 有性能敏感改动时运行同机 10 样本基准并记录真实数据。

架构原则见 `README.md`，canonical 字段见 `domain/CANONICAL_STATE.md`，存档策略见 `persistence/README.md`，历史重构证据见 `ENGINE_PHASE_0_BASELINE.md`。
