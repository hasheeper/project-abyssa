# 多人骰子事件：规则与存档契约 v0.1

> 2026-09-07。依据：[战斗 UI 与事件流优化计划](BATTLE_UI_AND_EVENT_FLOW_OPTIMIZATION_PLAN.md) §3、§5、P2-A，以及用户本轮“多人骰子解谜：单独补齐规则与存档契约”。
>
> **交付性质：代码审计后的实施规格提案。** 下文把原计划缺失的生命周期、判定、事务和恢复边界补齐，候选玩法与数值不冒充用户定稿。本轮 P1-D 仍执行旧单人规则；本文件没有启用新协议、新档或多人玩法。P2-A 的独立可操作原型仍待制作，不能据此宣布 P2-A/B 全部完成。

## 1. 实际基线与必须解决的断点

| 实际代码 | 当前行为 | 对 P2 的约束 |
| --- | --- | --- |
| `src/game-core/contracts/demo.ts`：`DemoEventDef` | register/relic/seats，只有文本、cost、reward | 不能靠展示层增加人数或奖励等级 |
| `src/game-core/session/demo-items-events.ts`：`chooseRuleEvent` | `attempt` 提交时选一名存活队员，独立抽一面，当次付费并结算 | 当前不存在可停留的“已掷事件骰”状态 |
| `src/game-core/battle/rules/v2/event-face.ts` | 指定行动面强保全；清醒且点数≥4或万能命数弱保全 | 强判断先于清醒限制；不能无说明地改变旧规则 |
| `src/game-core/battle/rules/v2/journey-validation.ts` | `eventRng.cursor === attempt 结果数`；结果必须对应已完成房间、角色与骰面 | 多人骰与未结算掷骰均会破坏旧校验等式 |
| `src/game-runtime/demo-journey-view.ts` | 事件节点无 encounter、无 battle die，成功面数来自远征冻结配置 | 不可借用上一战的 loaded/spent/剩余骰 |
| `src/game-application/versions/d5-validate.ts` | v4 按事实/证据重建并比较快照，限制 run/attempt 与来源 | 只往 snapshot 塞一个 puzzle 字段不能构成可恢复存档 |
| `src/game-application/transaction.ts` | head 比较 + requestId/fingerprint 幂等 + 原子存档/回执 | 新命令继续使用同一事务底座 |
| `src/game-runtime/player-runtime.ts` | 已登记1/2/3/4；默认规则4／内容3 | 新事件另做版本演进，不替换冻结Catalog |
| `src/game-runtime/versioned-runtime.ts` | 当前v4导入、完整庄园／旧D5复制升级与有限二周目已接入 | 多人事件新状态仍需单独扩展读写、升级和恢复验证 |

核心区别：旧事件是“选人→提交时掷一骰并结算”；新提案是“选解谜选项→提交开骰→看已保存的骰面→选参与者→提交结算”。两者需要独立版本和恢复验证。

## 2. 本版建议采用的玩法边界

1. 每个事件有结构化选项。免费叙事选项直接结算；解谜选项进入一次性的事件骰环节。
2. **先开骰、后选参与者**。开骰对象为该时刻全部存活队员，每人一颗；顺序固定为远征队伍顺序。倒下队员不抽取、不占随机游标。
3. 每个解谜选项声明 `minActors`、`maxActors`。第一批建议 1–2 人；每位角色最多贡献一颗骰子。选中一颗骰子等价于选择其所有者。
4. 开骰时一次扣除选项费用并保存全部骰面；确认时只发奖励。**不得看结果后免费换选项或重掷。** 开始按钮必须明确显示费用及不可重掷。
5. 开骰前可以绕行，免费且不消耗随机数。开骰后可以取消“选中的角色”，但不能撤销开骰；玩家可“放弃整理”，已支付费用不返还，写入独立 abandoned 结果后关闭房间。
6. 退出页面/关浏览器只暂停，回到同一 pending 事件。没有计时、自动确认或离线推进。
7. 未选骰随事件结算一起关闭，不带入战斗、不增加/减少战斗行动次数。战斗骰、事件骰使用不同类型和实例标识。
8. pending 期间禁止换队、装备、成长、道具和房间推进；只允许选人、查看信息、确认或放弃。开骰前可照现有规则使用道具。首批先封闭这个边界，避免骰面被装备/保养修改后失去依据。
9. 无任何存活队员时解谜不可开始；按现有团灭规则处理，不创建空骰局。

以上为本次推荐收口方案，尤其第 4/5/8 项是原计划没有定稿的规则选择，不是对历史定稿的复述。

## 3. 判定定义与算例

### 3.1 规则顺序

所有判定由 core 计算；UI 的可提交、预览结果和不可用原因来自同一个纯查询，不重写算法。

1. 校验参与人数、所有权、唯一性、pendingId、当前房间、参与者存活与配置快照。
2. 先检查 hard：选中骰中行动种类属于 `actionKinds` 的数量达到 `minimumMatches`，得到 strong。每颗骰最多算一次；同一人不能占两个匹配名额。未选骰不参与。
3. 未满足 hard，计算 soft：只有清醒面的点数参与加总。普通命数使用该面的整数点数；万能命数按明确配置 `wildValue` 计，不通过用户输入指定点数。沉睡面计 0。
4. 按从高到低且互斥的阈值命中 weak / partial / failed。hard 按行动种类匹配，不附加清醒条件，延续旧强判断语义；内容若要增加命数条件，必须另行扩展谓词和版本。
5. 奖励按唯一结果档位查表，不叠加强弱奖励；本批只支持散金。所有 cost/reward/threshold 都为有界非负整数。

### 3.2 首个“遗物整理”多人候选卡（待配平）

| 字段 | 建议值 |
| --- | --- |
| 免费选择 | 绕行；不抽骰、不收费 |
| 解谜选择 | 合力整理 |
| 参与人数 | 最少 1、最多 2 |
| 开骰费用 | 2 G 散金 |
| 强保全 | 选中的两颗均命中 heal / expensive-heal / protect / guard-all / wild；奖励 4 G |
| 弱保全 | hard 未满足，清醒点数合计≥8；奖励 2 G |
| 部分保全 | hard 未满足，清醒点数合计 5–7；奖励 1 G |
| 未保全 | 其余情况；奖励 0 G |
| 万能命数 | soft 计 6 点 |
| 开骰后放弃 | abandoned；奖励 0，费用不返还 |

这是**新版候选卡**。旧 v2/v3/v4 遗物整理仍是单人、费用 2 G、强弱均奖励 4 G，不能给旧档套本表。

| 已选择的骰子 | 判断 | 奖励 / 净变化 |
| --- | --- | --- |
| 治疗 + 庇护，不论其命数 | hard 两次命中 → strong | +4 / +2 G |
| 治疗（清醒2）+ 攻击（清醒6） | hard 仅一次；soft=8 → weak | +2 / 0 G |
| 攻击（清醒3）+ 格挡（清醒3） | soft=6 → partial | +1 / −1 G |
| 攻击（沉睡6）+ 攻击（清醒4） | soft=4 → failed | +0 / −2 G |
| 单独一颗清醒万能命数、行动不在 hard 名单 | soft=6 → partial | +1 / −1 G |
| 未选的治疗骰 + 已选两颗低点攻击 | 未选骰不参与判断 | 按已选骰结算 |

不能直接把旧“任一强面即成功”搬到五人先掷后选：假设每人强面率 1/2，五人中至少一人命中达 96.875%。本候选改为两个强匹配，仍需按真实出征骰面配置测 strong/weak/partial/failed 分布及期望净收益。未做这项配平之前不切正式内容。

## 4. 结构化内容契约

以下为拟新增类型，不合并进旧 `DemoEventDef`：

```ts
type EventRequirement =
  | { kind: "living-member"; characterId: string }
  | { kind: "completed-event"; eventId: string; outcome?: "strong" | "weak" | "partial" | "failed" | "read" | "skip" | "abandoned" };

type EventOption = {
  id: string;
  label: string;
  text: string;
  requirements: EventRequirement[]; // 全部满足；空列表为真
} & (
  | { kind: "free"; outcome: "read" | "skip" }
  | {
      kind: "dice-puzzle";
      cost: number; // 仅 looseGold，不使用包裹金币
      minActors: number;
      maxActors: number;
      hard: { actionKinds: ActionKind[]; minimumMatches: number };
      soft: { awakeOnly: true; wildValue: number; weakAt: number; partialAt: number };
      rewards: { strong: number; weak: number; partial: number; failed: number };
    }
);
type PuzzleEventDef = {
  id: string; name: string; text: string;
  illustration?: string; // 本地 presentation 资源 ID；缺图为空
  options: EventOption[];
};
```

Catalog 校验须拒绝：重复选项 ID、未知角色/行动/事件/配图引用、`minActors < 1`、`maxActors` 超队伍上限或小于 min、hard 匹配数超过 max、重复 hard 种类、`weakAt <= partialAt`、无效整数、前置循环/不可达前置。费用检查由 cost 统一产生，不再重复写一个可矛盾的 gold 条件。

前置 `completed-event` 只查询**本次 run 内已完成事件**；相同 eventId 可出现在不同房间，任一已完成实例满足即为真。首批不支持跨档、跨回忆或任意脚本表达式。免费选项不发钱；取消不算 completed-event。配图缺失不阻塞选择，正式配图仍在 P3。

## 5. 状态机与持久化最小字段

```text
事件 awaiting-choice
  ├─ choose-event-option(free) ──→ resolved → room-complete
  └─ begin-event-puzzle ────────→ puzzle-pending
                                    ├─ resolve-event-puzzle → resolved → room-complete
                                    └─ abandon-event-puzzle → abandoned → room-complete
```

pending 是一个有效已保存节点；`resume-run` 不掷骰、不替玩家确认。一次房间实例至多一个 puzzleId 和一次终局结果。

```ts
type EventDie = {
  id: string; ownerId: string;
  faceIndex: number; faceId: string;
};
type EventPuzzlePending = {
  id: string; roomId: string; eventId: string; optionId: string;
  begunAtRevision: number;
  eligibleActorIds: string[]; // 开骰时的存活者，固定队伍顺序
  dice: EventDie[];
  paidCost: number;
  rngBefore: RngStreamState;
  rngAfter: RngStreamState;
};
type EventPuzzleResult = {
  puzzleId: string; roomId: string; eventId: string; optionId: string;
  actorIds: string[]; dieIds: string[];
  outcome: "strong" | "weak" | "partial" | "failed" | "abandoned";
  hardMatches: number; softTotal: number | null;
  paidCost: number; reward: number;
};
```

- pending/result 必须归属于同一 save epoch、runRef、roomInstance 和 contentRef；ID 由 core 按 run/房间稳定派生，客户端不能决定骰子 ID。
- 配置依据为远征已冻结的 `member.config.faces` 和进入事件时状态；pending 禁止修改这些依赖。读取器仍需验证开骰前的权威状态，不信任 pending 自述的 eligibleActorIds。
- `faceIndex`、faceId、ownerId 三者交叉验证；不能只检查 faceId “存在于某角色”。
- 角色选择是本地草稿，不收费不写存档；刷新后选择清空、已掷骰与费用不变。确认请求已发送则 pending-request 保存完整 actorIds/dieIds，恢复相同确认请求。若后续要求选择本身跨设备保存，另增无 RNG 的选择命令，不能偷偷用 localStorage 冒充权威状态。
- 已结算时 activePuzzle 归 null；开骰证据、骰面、RNG 区间和结果留在 run 证据链，不能因清除 pending 丢失验证依据。
- 不保存“正在滚动/走路”等演出相位，不以动画结束写结果。

## 6. RNG 契约

继续独立于 combat/loot/flavor 使用事件流；算法名、seed、cursor 都进存档。

1. seed 初始化方式按新规则明文固定；建议沿用现有 `(runSeed ^ 0x3c6ef372) >>> 0`，不使用时间戳或 Math.random。
2. begin 对 eligibleActorIds 按队伍顺序逐人抽取一次，`faceIndex=floor(draw.value*6)`。一次 begin 抽 N 次，cursor 增 N，付费和 pending 原子落盘。
3. 确认、改变本地选人、放弃、读取、重放、刷新均抽 0 次。
4. 新读取器的等式改为 `cursor = Σ 已提交 puzzle-started 的 eligibleActorIds.length`，包括当前 pending 及后续 abandoned 的骰局。不能继续使用旧 `attempt 次数` 等式。
5. 读取器重算每段 RNG 与骰面，并检查前后 cursor 连续、seed/算法不变。重复相同 requestId 只能读取原回执；不同 requestId 再开同一 pending 不生成新骰。
6. 本地导出包含 RNG，因此保证的是可重放与内部一致性，不宣称防止玩家查看/编辑存档。

## 7. 命令、事务与证据

新命令建议为 `choose-event-option`（仅 free）、`begin-event-puzzle`、`resolve-event-puzzle`、`abandon-event-puzzle`。全部携带 runRef 和 roomId；begin/free 携带 optionId；resolve/abandon 携带 puzzleId；resolve 额外传唯一且一一对应的 actorIds/dieIds。沿用 `protocolVersion/saveId/expectedHead/clientRequestId` 请求封装。

| 命令 | 同一事务内必须提交的变化 | 拒绝条件 |
| --- | --- | --- |
| free | 叙事结果、完成房间、room-complete、对应事实/回执 | 非 free 选项、pending 已存在、前置不满足 |
| begin | 扣费、RNG、pending、started 证据及回执 | 不是当前事件、已开始/完成、钱不足、无人、前置不满足 |
| resolve | core 重算判定、奖励、result、完成房间、清 pending、resolved 证据 | 人数越界、重复/外来/未投骰角色、骰子错配、pendingId 或 head 过期 |
| abandon | abandoned 结果、费用不返还、清 pending、完成房间与证据 | 不是当前 pending；不得再次扣钱 |

- 新证据种类建议 `event-puzzle-started/resolved/abandoned`，纳入新版本 journey operation 的严格解析、重放和 provenance 校验。started 不能只做 UI 事件：它改变余额与 RNG，必须是权威业务证据。
- 业务事实引用 runRef 与房间，origin 为当下 adventure；不得误计作回忆胜利、成长或首通事实。表现回执可以输出 actorIds、dice、outcome，不能触发额外结算。
- expectedHead 冲突：读取最新状态，展示已提交的 pending/结果；不以新 requestId 自动重试原玩法意图。
- 相同 requestId + 相同 fingerprint：复用原回执。相同 ID 不同参数：`request-id-reused`。新 ID 重复 resolve：`command-not-available`，不多领奖。
- 开骰/费用/证据存一半是无效档，不能“修成免费重掷”。明确报损坏并保留原文件。

## 8. 版本、旧档、导入边界

**建议新增 v5（暂定命名，正式注册时检查占用），所有相关版本一起落地。** 独立 schemaVersion、protocolVersion、receipt/fact 版本、archiveVersion、Catalog rulesVersion/contentVersion/content digest，以及 run 读取器。不给旧 2/3/4 定义加必填字段，不修改旧数据摘要后强行打开。

首批采用新版本独立创建入口，默认入口仍保持现状；旧档仍走旧单人事件。旧存档显示层可以使用本轮 P1-D 内嵌 UI。

D5-F 协调项：

- 进行中的远征/回忆不升级事件规则。只在无 active run、无待领取结果、无 pending 请求的安全存档点做显式复制升级，保留源档。
- 升级证明包含源 contentRef、源 head 和受支持的资产/篇章证据；不能把旧单人 eventResult 伪装成新多人掷骰历史。
- 新档复制导入必须重定位 run、room instance、puzzle、die、source fact、结果与请求关联 ID，形成显式映射；不以字符串替换猜关系。
- pending 档只允许同版本原样恢复/受验证的导入，不自动丢弃 pending 来升级。
- v4 导入本来未完成；P2 发布前必须交付支持的新版本导入并保留旧读取器。仅原型阶段则隐藏相关入口并明确其未实现，不能显示“导入成功”后丢状态。

## 9. 页面接线边界

P1-D 已提供上方内嵌事件区与操作坞。P2 接线继续使用这一舞台，不新建模态向导。

- choices：文本 + 结构化选项，disabled 原因由查询给出；图像 ID 为空时显示轻量占位。
- pending：事件专用骰面由已提交状态投影；显示“已选 n/max”、core 给出的条件匹配及确认/放弃。禁止拿战斗 die 的 loaded/spent 当作事件选中标记。
- 事件态角色卡自动折叠按主计划 §3.3 单独实现；战斗恢复既有大卡，间歇不折叠。需在独立原型验证 1600×900 和 1280×720 后接正式页。
- 选择反应仅是本地候选反馈；成功/失败反应必须等 committed 回执。刷新恢复直接显示已保存结果，不重播掷骰、台词或奖励。
- 确认前的配对预览不承诺“下一次随机数”；这里只匹配已经开出的骰面，所有结果可由确定性查询复算。

## 10. 必验矩阵

| 情景 | 权威期望 |
| --- | --- |
| begin 前取消/绕行 | cost 0，RNG 增量 0 |
| begin 存储失败 | 余额、cursor、节点全不变，无骰面演出 |
| begin 成功但响应丢失 | pending 请求恢复同一批骰，费用仅一次，不重播 |
| begin 双击/另一标签同时 begin | 至多一个 pending，另一请求重放或冲突 |
| pending 刷新/切页/关闭/低动效 | 同一 dice/paidCost/RNG，选择草稿清空，永不自动确认 |
| 选第 3 人/重复 ID/外队角色/另一房间的骰 | 核心拒绝；不改钱、不改 RNG |
| 待选队员倒下/配置改变的伪造档 | 重放/依赖校验拒绝；禁止以当前面覆盖已掷面 |
| hard 与 soft 同时满足 | 只发 strong；未选强面不参与 |
| 万能命数、沉睡面、阈值边缘 | wildValue、awakeOnly、阈值准确且可复算 |
| resolve 响应丢失/双击/刷新重试 | 只一个结果、只一次奖励、只一次房间完成 |
| abandon 后再进入 | 该房间已完成，无法重掷、不返还费用 |
| 篡改骰面但保留原 RNG/篡改余额/遗漏 started | 读取器拒绝不一致证据 |
| v2/v3/v4 旧档导入和原有回忆 | 原读取/原规则继续；不调用新事件解析器 |
| 新版归档导出导入 pending 与 resolved | IDs 与证据完整映射；同一骰面/费用/结果 |

## 11. 后续实施顺序与交付边界

1. **P2-A 规则原型**：按本提案做隔离的固定结果预览；比较 1–2 人与真实骰面分布，讨论开骰付费/放弃和 hard 两匹配的体感。只展示模拟数据，不写生产存档。
2. **P2-A 契约实现**：新 Catalog/协议/事件流/状态读取器/证据重放/故障事务测试；冻结本表的最终数值后再写正式内容。与 D5-F 升级和导入清单同步。
3. **P2-B 正式接线**：专用骰、选人数限制、角色卡自动折叠、查询预览、已提交反应、配图占位。旧档保持 P1-D 原行为。
4. **联合验收**：完整事件链、导入恢复、低动效、故障/并发与多分辨率视觉验证；之后才讨论默认入口。

本轮不需要 rp-style-lab 或 LLM 参与随机数、判定、扣费、存档和恢复。将来 LLM 可读取经过可见性筛选的事件投影及事实，生成叙述候选；只能通过同一公开命令入口请求动作，不能成为规则或存档权威。
