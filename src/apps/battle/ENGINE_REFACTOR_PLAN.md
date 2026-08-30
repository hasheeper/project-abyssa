# Battle 引擎兼容底座重构计划

> 状态：已完成（阶段 0–8 均已通过验收）
>
> 日期：2026-08-28
>
> 适用范围：`src/apps/battle/engine.ts`、`ExpeditionBattleScreen.tsx` 及未来的道具、装备、角色特质、状态和遭遇规则

当前进度：阶段 0–8 已完成并通过验收。最终结果见 `ENGINE_PHASE_0_BASELINE.md`，长期维护入口见 `README.md`。

## 1. 结论与目标

当前 Battle 应按“固定五人、小规模敌群、手工策划内容、确定顺序结算”的中型回合制效果系统建设。

本次重构的目标不是重写玩法，也不是立刻制作道具和词条，而是在完全保留当前行为与演出的前提下，建立以下兼容底座：

- 所有规则变化只能通过统一命令入口发生。
- 一次命令可以产生有序、可追踪、可播放的领域事件。
- 伤害、治疗、护盾、状态、骰子、意图、资源和奖励由统一效果解析层处理。
- 被动、装备和词条拥有固定触发顺序，不依赖散落在函数中的条件判断。
- 战斗进行到敌方行动或触发链中途时仍可序列化、恢复和确定性续演。
- 撤销必须同时恢复规则状态和随机数位置。
- UI 只消费状态与事件，不再比较前后状态猜测发生了什么。
- 现有导出函数、现有规则结果和现有动画在迁移期保持兼容。

这是一条线性迁移路线。阶段必须按 `0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8` 推进；上一阶段的验收门槛未通过，不进入下一阶段。

### 1.1 当前基线

- [`engine.ts`](./engine.ts) 约 2,193 行，同时承担内容定义、规则、流程、随机数、撤销、日志和结算。
- [`ExpeditionBattleScreen.tsx`](./ExpeditionBattleScreen.tsx) 约 1,890 行，同时承担控制器、三套演出时序和页面渲染。
- [`expedition.css`](./expedition.css) 约 5,009 行；样式拆分只随阶段 6 的组件边界进行，不提前改视觉。
- 当前共有 127 项 Battle 测试，是行为等价迁移的基础安全网。
- 玩家行动目前只有 `state/error`，没有统一领域事件；UI 会比较前后状态推断支援效果。
- 敌方行动队列和 closing hand 暂存在 UI 异步函数中，无法在结算中途可靠恢复。
- 撤销快照依赖字段白名单，RNG cursor 不在状态中。
- `party`、`dice`、`enemy` 和意图之间存在需要手工同步的重复事实。

## 2. 已确认的玩法复杂度

### 2.1 必须覆盖的效果族

| 效果族 | 当前或设定依据 | 底座需要支持的能力 |
| --- | --- | --- |
| 伤害、治疗、护盾 | 当前攻击、格挡、治疗 | 来源、目标、标签、原始值、修正值、实际值 |
| 多目标与复合行动 | 旧 Battle 群体技能、角色范围能力 | 一个批次下多个独立目标事件，允许顺序或同批表现 |
| 状态与控制 | 封骰、狂暴、锈蚀、致盲、中毒、腐蚀、沉默、缴械 | 添加、刷新、叠层、消耗、移除、免疫、净化 |
| 数值修正 | 品质倍率、狂暴增攻、特攻、压制、贯穿 | 加算、乘算、减免、无效、穿透，顺序稳定 |
| 意图干预 | 格挡意图、死亡取消、行动封锁 | 削弱、取消、延后、替换、改目标 |
| 骰子与牌型 | 重掷、装载、封锁、万能点、锈面、金铭 | 点数、面、品质、可用性、消耗、重掷和倍率修正 |
| 单位生命周期 | 召唤、斩杀、逃跑、自伤死亡、力竭 | 生成、入场、击败原因、退场、复苏、清场判断 |
| 资源与奖励 | 金币、战利品、层倍率、晶石、治疗成本 | 增减、花费、保护、掉落和结算修正 |
| 道具与装备 | 药水、屏障符文、特攻武器、耐久 | 主动使用、次数、耐久、副作用、被动修正 |
| 遭遇规则 | 瘴气、环境克制、阵地能力 | 整场光环、环境标签、进入与离开时触发 |

### 2.2 生命周期范围

状态和效果至少需要以下持续范围：

```text
单次效果 → 单次行动 → 当前回合 → 下一回合 → 当前层 → 整次远征
```

装备耐久、专武重铸和永久特质属于远征外数据；Battle 只接收战斗开始时的快照，并输出耐久消耗等结算结果。

### 2.3 合理的复杂度上限

底座需要承载的最复杂现实链条约为：

```text
范围技能
→ 每个目标分别计算特攻、抗性和穿盾
→ 造成伤害并附加状态
→ 处理击倒或击杀
→ 触发吸血、掉落或装备被动
→ 处理延迟印记、召唤或清场
```

约束如下：

- 队伍固定五人，敌人按当前规则封顶约五只。
- 一件装备或一个词条原则上包含 1–3 个声明式效果。
- 常规因果链预期不超过 3–4 层。
- 引擎仍必须设置事件数量和触发深度上限，避免循环。
- 不为战棋格、实时制、TCG 优先权栈、任意用户脚本或数百实体预建架构。

## 3. 非目标

以下内容不属于本次底座重构：

- 不改当前战斗数值、骰面、敌人配置、层结算和狂暴规则。
- 不借重构调整当前视觉、动画时长、卡牌布局或 CSS 风格。
- 不立即实现完整道具栏、装备管理、商店联动或真实新词条。
- 不引入 XState、Redux、ECS、事件溯源数据库或脚本虚拟机。
- 不实现 Diablo 式随机前后缀、套装、宝石孔或无限随机词条。
- 不实现地格、移动、射程、视线、实时反应或联机回滚。
- 不让 UI 的动画时间成为规则状态的一部分。

## 4. 核心设计约束

### 4.1 单一权威状态

领域状态必须可序列化，不保存函数、DOM、计时器、Promise 或 React 引用。

重复事实逐步收敛：

- `party.rustLevel` 为命数锈蚀权威值，骰子视图从中派生。
- `party.downed` 为角色力竭权威值，骰子不可用状态从中派生。
- 敌人生命与击败状态只能有一个权威来源，不能靠 `hp/dead` 多路径手工同步。
- 格挡分配附着于公开意图；角色卡盾牌数字由 selector 汇总。
- UI 展示数据只通过 selector 读取，不把展示缓存写回领域状态。

### 4.2 唯一命令入口

目标契约：

```ts
type BattleTransition = {
  state: BattleState;
  events: BattleEvent[];
  error: BattleError | null;
};

function dispatchBattleCommand(
  state: BattleState,
  command: BattleCommand
): BattleTransition;
```

命令表达玩家或流程提出的意图；效果负责修改规则状态；事件描述已经发生的事实。UI 不得重新应用事件，也不得自行修改领域状态。

### 4.3 事件必须可追踪

所有事件使用统一信封：

```ts
type BattleEventEnvelope<TType, TPayload> = {
  id: string;
  type: TType;
  payload: TPayload;
  source: EffectSourceRef;
  causeId: string | null;
  batchId: string | null;
  sequence: number;
};
```

- `source` 说明事件来自骰面、角色、装备、消耗品、状态、敌人或环境。
- `causeId` 串起行动、伤害、击杀和后续触发。
- `batchId` 表达同一次范围行动中的多个目标。
- `sequence` 是规则顺序；动画可以把同批事件并行表现，但不能改变规则顺序。

### 4.4 效果数据与处理代码分离

效果实例只能保存数据：

```ts
type EffectInstance = {
  instanceId: string;
  definitionId: string;
  source: EffectSourceRef;
  stacks: number;
  duration: EffectDuration | null;
  data: JsonValue;
};
```

处理函数放在代码侧 registry 中。不得把函数写入 BattleState，否则 `structuredClone`、存档和确定性回放都会失效。

### 4.5 确定性与有限触发

- 所有规则随机数都来自状态内可序列化的 RNG stream。
- 初始建议拆成 `combat`、`loot`、`flavor` 三条流；视觉随机不进入引擎。
- 相同初始状态、seed 和命令序列必须得到完全相同的 state 与 event trace。
- modifier 以 `priority → sourceId → instanceId` 稳定排序。
- 暂定每条命令最多 256 个事件、最大触发深度 8；阶段 4 用压力测试确认最终值。
- 达到预算必须产生明确错误事件并安全终止，不能静默截断或卡死。

### 4.6 一条命令对应一个撤销点

玩家命令及其全部派生触发必须原子提交：

- 不能只撤销主伤害而保留中毒、吸血或掉落。
- 撤销需要恢复领域状态、RNG cursor、日志所依据的事件游标。
- 演出状态、DOM 状态和计时器不进入撤销快照。
- 保留当前“掷骰/重掷不可撤销”等产品规则；重构不能擅自扩大可撤销范围。

## 5. 目标模块边界

迁移完成后的建议目录：

```text
src/apps/battle/
  engine.ts                       # 兼容导出门面，迁移期保留
  domain/
    commands.ts                   # BattleCommand / BattleError
    events.ts                     # BattleEvent 与事件 payload
    state.ts                      # BattleState 与生命周期 mode
    targets.ts                    # TargetRef 与合法目标
    invariants.ts                 # 状态不变量校验
    versions.ts                   # schema/rules/content 版本
  content/
    characters.ts
    enemies.ts
    encounters.ts
    effect-definitions.ts
  rules/
    dispatcher.ts                 # 唯一命令入口
    resolver.ts                   # 原子效果解析
    modifiers.ts                  # before 阶段修正
    reactions.ts                  # after-event 触发
    lifecycle.ts                  # 回合、层、远征推进
    dice.ts
    hand.ts
    economy.ts
  selectors/
    battle-selectors.ts
    targeting-selectors.ts
    presentation-selectors.ts
  persistence/
    dto.ts
    migrate.ts
    rng.ts
  controller/
    useExpeditionBattleController.ts
    presentationQueue.ts
```

依赖方向固定为：

```text
content → domain ← rules ← compatibility façade
                    ↑
              persistence

UI/controller → commands + selectors + events
```

`domain` 不依赖 React、CSS、图片和内容注册表；`rules` 不依赖 UI；UI 不导入内部 resolver。

## 6. 初始原子效果与触发窗口

### 6.1 原子效果

首轮只建立能覆盖已有与强确定需求的有限原语：

- `Damage`
- `PreventDamage` / `RedirectDamage` / `BlockDamage`
- `Heal` / `Revive` / `Cleanse`
- `ApplyStatus` / `RemoveStatus` / `ModifyStatus`
- `ModifyStat`
- `ModifyDie`
- `ModifyIntent`
- `SpawnUnit` / `DespawnUnit`
- `ModifyResource`
- `ModifyReward`
- `ApplyEncounterRule` / `RemoveEncounterRule`

组合能力由多个原子效果构成，不为每个角色技能创建新的引擎动词。例如“毒刃”应是 `Damage + ApplyStatus(poison)`，而不是新增 `PoisonKnife` 核心分支。

### 6.2 初始触发窗口

触发顺序先固定为有限集合：

```text
encounterStart
layerStart
roundStart
beforeRoll → afterRoll
actionDeclared
beforeEffect
beforeDamage / beforeHeal
effectApplied
afterDamage / afterHeal
unitDowned / unitDefeated
actionResolved
roundEnd
layerCleared
beforeReward → rewardResolved
expeditionEnd
```

新增窗口必须有真实玩法需求和顺序测试，不允许为了单个词条随意插入匿名 hook。

## 7. 线性实施阶段

### 阶段 0：冻结当前行为基线

#### 目标

先证明“现在是什么”，避免重构过程中凭体感判断等价。

#### 工作项

- [x] 记录当前 127 项 Battle 测试清单与通过结果。
- [x] 为五个固定 seed 建立完整远征 golden command trace。
- [x] 固定攻击、治疗、格挡、偷取、撤销、牌型、力竭、锈蚀、狂暴、逃跑、召唤和层结算快照。
- [x] 建立 scenario builder，替代测试中大面积直接修改 state。
- [x] 添加输入不可变测试，确保命令不修改传入状态。
- [x] 添加核心 invariant 检查：唯一 ID、生命范围、骰子与角色对应、死亡意图清理、合法 mode。
- [x] 记录 1,000 次确定性模拟的耗时和内存基线，只作回归参照。

#### 验收门槛

- 所有现有规则都能由测试明确复现。
- 同 seed、同输入的当前实现 trace 完全一致。
- 后续阶段出现差异时，可以定位到具体命令和首个不同事件。

### 阶段 1：建立模块壳与兼容门面

#### 目标

只移动类型和纯查询，不改变调用方式和运行结果。

#### 工作项

- [x] 建立 `domain/content/rules/selectors/persistence/controller` 目录。
- [x] 把类型、静态角色/敌人定义和纯 selector 从 `engine.ts` 分离。
- [x] 保留 `src/apps/battle/engine.ts`，重新导出当前所有公共 API。
- [x] 建立 `schemaVersion`、`rulesVersion`、`contentVersion`。
- [x] 写明 canonical state 决策，暂时通过 adapter 保持旧 UI 数据形状。
- [x] 为所有 import 路径增加兼容测试。

#### 验收门槛

- 现有 UI 与测试无需改调用方式即可运行。
- golden state、日志、RNG 消耗次数和动画触发条件不变。
- 没有规则同时存在两份实现。

### 阶段 2：引入 Command、Transition 与领域事件

#### 目标

先建立统一协议，内部仍可临时调用旧函数。

#### 工作项

- [x] 定义穷尽的 `BattleCommand` 联合类型。
- [x] 定义 `BattleTransition { state, events, error }`。
- [x] 定义通用 `TargetRef`，覆盖角色、敌人、骰子、意图、资源和整场战斗。
- [x] 为攻击、治疗、格挡、偷取、装载、重掷、结束回合建立命令适配器。
- [x] 玩家动作补齐结构化事件，与已有敌方事件统一。
- [x] 事件加入 `source/causeId/batchId/sequence`。
- [x] 日志暂时保留，但增加“事件 trace 与最终 state 一致”测试。

#### 验收门槛

- 所有玩家规则都能通过 `dispatchBattleCommand` 调用。
- UI 仍可通过旧 API 工作，旧 API 内部只做代理。
- 攻击数字、实际治疗、盾牌目标、击杀和金币变化都能直接从事件读取，不再需要 diff state。

### 阶段 3：收回流程状态、随机数和撤销权威

#### 目标

让任意规则帧都可以保存、恢复、续演和撤销。

#### 工作项

- [x] 将 `phase/status/lastOutcome` 收敛为合法状态可表达、非法组合不可表达的 `mode`。
- [x] 将敌方行动队列、cursor、closing hand 放入领域状态。
- [x] 将待处理 effect/reaction 队列放入可序列化状态。
- [x] RNG 改为状态内 seed/cursor，并拆分 `combat/loot/flavor`。
- [x] 撤销改为完整核心 checkpoint，不再维护字段白名单。
- [x] 定义 JSON DTO 和 runtime validation。
- [x] 添加敌方行动中途保存、恢复后继续的测试。
- [x] 添加“行动 → 撤销 → 重做”不改变后续随机序列的测试。

#### 验收门槛

- 任意敌人行动前后保存并恢复，最终 trace 与不中断运行完全一致。
- 撤销同时恢复状态与 RNG cursor。
- `JSON.parse(JSON.stringify(state))` 后可以继续执行。
- UI 不再持有任何规则队列或规则 cursor。

### 阶段 4：建立原子效果、修正器与反应管线

#### 目标

让新道具或词条通过组合原语接入，而不是修改所有行动函数。

#### 工作项

- [x] 实现有限原子效果 resolver。
- [x] 实现 `before` modifier 管线：加算、乘算、减免、无效、穿透。
- [x] 实现 `after-event` reaction 管线。
- [x] 定义状态的层数、持续范围、刷新、消耗和到期规则。
- [x] 固定 `priority/sourceId/instanceId` 排序。
- [x] 实现触发深度和事件预算保护。
- [x] 规定死亡、力竭、奖励和清场只在统一收束步骤处理。
- [x] 规定一次命令与全部触发只产生一个撤销 checkpoint。

#### 验收门槛

- modifier 顺序、状态到期、重复触发和循环保护均有独立测试。
- 同批多目标逐目标独立计算，事件顺序固定。
- 任何效果都不能绕过 resolver 直接修改受保护字段。
- 压力测试不会出现无限循环或不稳定顺序。

### 阶段 5：迁移全部现有规则

#### 目标

用新底座完整复现当前 Battle，不引入新玩法。

#### 迁移顺序

1. [x] 攻击、格挡、治疗、偷取和昂贵治疗。
2. [x] 敌方攻击、蓄力、封锁、倒计时和召唤。
3. [x] 力竭、锈蚀、狂暴预警、持续狂暴、自伤和逃跑。
4. [x] 掷骰、装载、重掷、万能点、牌型与品质修正。
5. [x] 赏金、倍率、层结算、包裹、全灭和晶石。
6. [x] 撤销、日志、事实文本与清层流程。

每迁移一组规则，都在测试中并行运行 legacy 与新 transition，比较：

- 最终核心状态。
- RNG cursor。
- 事件 trace。
- 日志语义。
- 可撤销结果。

#### 验收门槛

- 127 项现有 Battle 测试全部通过。
- 阶段 0 的全部 golden trace 等价。
- `engine.ts` 不再包含核心规则实现，只作为兼容导出门面。
- 当前游戏中不存在 legacy/new 混合写状态路径。

### 阶段 6：UI 改为事件驱动的控制器

#### 目标

让 React 负责交互与演出，不负责推断或推进规则。

#### 工作项

- [x] 抽出 `useExpeditionBattleController`。
- [x] 把 `heldActor` 泛化为 `TargetingMode`：角色、道具、能力或取消选择。
- [x] 合并攻击、支援和敌方行动的 timer/busy/run refs 为统一 presentation queue。
- [x] 用领域事件直接驱动伤害、治疗、盾牌、击杀、状态、召唤和资源反馈。
- [x] 支持 `batchId`：规则顺序不变，表现层可让同批 AOE 同时播放。
- [x] 层清由 `LayerCleared` 事件触发；动画完成后只发送 acknowledgement。
- [x] 敌方每次演出结束后由控制器请求下一规则步骤，不在 async 局部变量中保存 cursor。
- [x] 保留 reduced-motion、runId 取消、敌人退场和 FLIP 补位。
- [x] 按现有区域逐步拆展示组件，视觉和 CSS 选择器保持不变。

#### 验收门槛

- 删除通过前后 state 差值推断支援类型的逻辑。
- 删除 UI 对攻击 `face.power`、死亡结果和清层结果的重复推断。
- 连续敌方行动、斩杀退场、防御、治疗和自动清层的现有体感不变。
- UI 不导入内部 rule/resolver，只使用 command、selector 和 event。

### 阶段 7：验证道具、装备和词条兼容缝

#### 目标

不正式扩充内容，只证明底座确实能承载未来玩法。

#### 工作项

- [x] 定义 `ItemInstance`、`EquipmentInstance`、`TraitInstance`、`StatusInstance` 的纯数据结构。
- [x] 定义战斗输入 loadout 快照和战斗输出耐久/消耗结算。
- [x] 用现有“越限奇迹消耗金币”迁移为第一个组合 effect。
- [x] 用现有狂暴迁移为第一个带持续时间和回合触发的 status。
- [x] 添加仅测试使用的四个 fixture：目标标签特攻、命中施毒、击杀加金币、范围伤害后吸血。
- [x] 验证净化、免疫、穿盾、耐久消耗和副作用可由现有原语组合。
- [x] 验证新增 fixture 不需要修改 UI 动画编排和已有行动函数。

#### 验收门槛

添加一个手工策划装备时，通常只需要：

1. 新增内容定义。
2. 组合已有 effect/modifier/reaction。
3. 增加内容级测试和展示文案。

不应要求修改伤害、治疗、敌方回合、撤销、UI 计时器和清层代码。

### 阶段 8：清理、性能回归与文档固化

#### 目标

删除迁移脚手架，固定长期维护规则。

#### 工作项

- [x] 删除 legacy 双跑和废弃适配器；保留必要公共 API 门面。
- [x] 删除重复字段和失效分支。
- [x] 让 TypeScript 对 command、event、intent 和 effect handler 做穷尽检查。
- [x] 对照阶段 0 基线运行模拟性能与 UI 交互性能回归。
- [x] 只针对测量出的热点优化；当前小规模数组无需提前改 ECS 或实体索引。
- [x] 编写“新增角色能力 / 敌人意图 / 道具 / 状态 / 词条”的维护指南。
- [x] 更新 Battle README、存档版本策略和迁移说明。

#### 验收门槛

- 类型检查、构建、全部 Battle 测试和性能基线通过。
- 没有未说明的规则随机源。
- 没有 UI 反推领域结果的路径。
- 没有绕过 dispatcher/resolver 的核心状态写入。
- 新内容接入路径有文档和最小示例。

#### 完成记录

- 类型检查、Battle 生产构建、16 个测试文件与 195/195 测试通过。
- schema v4 已删除生命周期、敌人生死/狂暴和骰子角色状态镜像，并能迁移根状态与 undo checkpoint。
- 正式 Controller 只用外部随机生成一次 seed，后续规则随机来自状态内三条 stream；另有边界测试锁定。
- 最终 10 样本基准为 205.62ms（兼容参考路径）与 203.78ms（command 路径）/1,000 轮；完整对比和剩余开销说明见阶段 0 基线文档。
- `README.md`、canonical state、persistence、Controller 和五类内容维护指南已固化。

## 8. 测试矩阵

| 层级 | 必测内容 |
| --- | --- |
| Domain | command 穷尽、非法命令、状态 invariant、输入不可变 |
| Determinism | 同 seed 同 trace、RNG stream 隔离、撤销恢复 cursor |
| Persistence | JSON round-trip、版本校验、敌方回合中途恢复 |
| Effects | modifier 顺序、状态叠层/到期、免疫、净化、穿透 |
| Reactions | cause 链、exactly-once、深度限制、事件预算 |
| Lifecycle | 力竭、复苏、召唤、逃跑、不同击败原因、清层 |
| Economy | 花费、偷取、赏金、层结算、掉落修正、耐久输出 |
| UI contract | 事件到演出映射、同批 AOE、逐只敌方行动、取消与重启 |
| Regression | 原有 127 项行为测试、当前全部 195 项测试、固定 seed golden trace、模拟性能基线 |

## 9. 关键风险与控制措施

| 风险 | 控制措施 |
| --- | --- |
| 重构时悄悄改变规则顺序 | 阶段 0 golden trace；阶段 5 legacy/new 双跑 |
| 事件被 UI 当成命令再次应用 | 明确事件是已发生事实；UI 只读事件 |
| 一次行动产生重复日志或重复动画 | event id、causeId、exactly-once 测试 |
| 部分迁移导致双重状态真相 | 每组规则迁移后立即切断旧写路径 |
| 撤销遗漏新增字段 | 完整核心 checkpoint，不使用字段白名单 |
| 随机触发无法复现 | 状态化 RNG stream 与 cursor |
| 词条互相循环 | 稳定排序、最大深度、事件预算和错误事件 |
| AOE 动画改变规则顺序 | batch 只影响表现并行，不影响 sequence |
| 文件拆开但耦合没有降低 | 以唯一命令入口和依赖方向作为验收条件 |
| 为未来过度设计 | 只加入已有规则或明确设定能证明的原语 |

## 10. 全部完成的定义

只有同时满足以下条件，本次底座重构才算完成：

- [x] 当前 Battle 规则、数值、UI 行为和动画体感没有非预期变化。
- [x] 所有状态变化都经由 command 和 effect resolver。
- [x] 所有可见结果都有结构化 event，不依赖 UI diff state。
- [x] 敌方行动和触发链中途可以保存并确定性恢复。
- [x] 撤销可以恢复状态和 RNG，且一条命令只有一个原子撤销点。
- [x] modifier 和 reaction 顺序固定、可测试、有限且不会死循环。
- [x] 道具、装备、特质和状态均为可序列化数据实例。
- [x] 新增一个常规装备或词条不需要修改多个核心分派函数。
- [x] 原有 127 项行为测试、当前全部 195 项测试、golden trace、类型检查、构建和性能回归全部通过。
- [x] `engine.ts` 仅保留兼容门面，不再成为新的规则堆积点。

## 11. 执行纪律

- 每次只推进一个阶段，提交中不混入视觉调整和玩法改动。
- 每阶段先加测试与兼容层，再迁移实现，最后删除旧路径。
- 若发现当前规则本身存在 bug，先单独记录并用测试复现；不要在“行为等价重构”中顺手修改。
- 任意新抽象必须至少承载两个现有用例或一个已确认的近期需求。
- 所有未来新玩法先用现有原子效果组合；只有无法表达且需求明确时，才扩展 effect taxonomy 或触发窗口。
