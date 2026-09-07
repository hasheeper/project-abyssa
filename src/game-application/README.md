# Abyssa 应用服务

应用层以唯一三层快照执行命令，在同一事务中提交新 head、状态、Fact、结算 ledger 和请求回执。仅事务完成后返回成功；回执不是最新状态缓存。

依赖仅限自身与 core 公共入口。Storage 和 AI 都是注入 Port；此目录不读浏览器、不调用网络、不加载具体 Catalog。实际页面从 [browser runtime](/Users/liuhang/Documents/project-abyssa/src/game-runtime/browser.ts) 装配。

## 当前正式入口（规则／协议4）

新档默认使用内容3。`versions/d5-service.ts` 的 `createD5Application(catalog, store, readers)` 执行v4普通远征、回忆、成长／赠物、装备与补给交易；`versions/d5-lineage.ts` 处理显式复制升级及二周目。runtime按完整内容引用选择服务，不由UI猜测版本。

| 能力 | 当前入口／约束 |
| --- | --- |
| 建档、读取与导入导出 | 经版本化runtime选Catalog与reader；只接受注册profile，不开放任意资产patch |
| 普通出征与结算 | `start-expedition`／`settle-expedition`，绑定run与终局证据；归来资产、剩余补给、时间与接管一次提交 |
| 战斗与续行 | 命令按普通／历史run分派到D5引擎；已保存敌方位置逐步续行，UI演出不写规则 |
| 回忆与当下结果 | 固定历史配置、重试／暂离及篇章证据；当前内容3使用刻仪兽，旧内容2保留本尊战 |
| 成长／赠物／装备 | 显式故事完成后授予；装卸／转交校验唯一实例、适用者、槽位和出征保管 |
| 商店 | `purchase-supply`，校验报价、充能上限、金币与当前流程；仅支持有economy定义的内容包 |
| 档案继承 | 不覆盖来源档；升级要求来源可升级且无活动流程，二周目重置当下资产／成长并保留篇章证明 |

通用head／幂等／CAS／存储Port原则仍适用；下文显式标为v1的命令结构、余额语义和Battle导入格式仅供兼容维护。具体机制和现行版本表见[总览](../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)。

## API

本节是保留的**规则1兼容API**。`createGameApplication({catalog, store})` 返回以下操作；所有外部输入在运行时重新校验。不要把表中的 `protocolVersion:1` 用于当前v4存档。

| 操作 | 输入与行为 |
| --- | --- |
| `create` | `{protocolVersion:1, saveId, epoch, clientRequestId, initial?}`；只创建不存在的档位。initial 可设置受校验资金、时钟、开放角色、库存和 traits，默认零资金、32容量、旧五人 |
| `open(saveId)` | 只读；完整校验后返回 `{ok:true, record}`，不会自动续敌方回合、结算或发送 AI |
| `list()` | 通过 store.listSaveIds() 枚举真实存储主键并逐档校验；返回 ready/unavailable 联合类型，坏档带原 saveId 可诊断，不阻断好档；存储整体故障仍返回顶层错误 |
| `dispatch` | `{protocolVersion:1, saveId, clientRequestId, expectedHead, command}`；白名单命令、幂等、CAS、领域校验与提交 |
| `resumeEnemyTurn` | 与 dispatch 同 envelope，command 仅 `resume-enemy-turn`；专用于旧存档中断 cursor，完成未执行敌人及回合收尾 |
| `exportSave(saveId)` | 返回 JSON 字符串 `{archiveVersion:1, record}`；含所有提交、事实、作废引用、undo 来源、资产和结算候选 |
| `importSave` | `{protocolVersion:1, saveId, epoch, clientRequestId, format:'legacy'或'application', archive:字符串}`；只创建新档位 |
| `exportDiagnostic(saveId)` | 校验 JSON 安全边界后导出原始记录，供损坏档案排查；不是可直接导入的正式档案包 |

成功写操作返回 `{ok:true, receipt, replayed}`；失败返回 `{ok:false, error, receipt?}`。error 包含 code/path/message。典型 code：`malformed`、`unsupported-schema`、`unsupported-rules`、`missing-content`、`content-mismatch`、`invariant-violation`、`not-found`、`conflict`、`request-id-reused`、`already-settled`、`not-finished`、`resume-required`、`storage-quota`、`storage-aborted`、`storage-blocked`、`storage-unavailable`。

`HeadRef = {saveId, epoch, revision}`；成功推进 revision，领域拒绝与冲突不推进。合法请求的拒绝回执保留；非法协议不建立回执。相同请求必须包含完全相同的 expectedHead 和参数；对象键顺序不影响指纹。换请求 ID 不绕过结算 ledger。

## 出征、战斗和回馆

以下为首版v1 command与示例，当前v4使用上方D5服务：

- `start-expedition`：`expeditionId, routeId, partyIds, itemIds, equipmentIds, seed`。亲征要求领队加至少一名开放伙伴，最多五人。带入仅接受在馆 instanceId；事务中转交保管，traits 复制能力快照。
- `battle-command`：`expeditionId, command`。内部命令沿用既有 Battle 名称；不公开 `begin-enemy-turn / resolve-next-enemy / finish-enemy-turn / undo`。一次 `end-turn` 执行完整敌方批次；`next-round` 开始下一轮。
- `undo`：`expeditionId`。机械 checkpoint 恢复，应用 revision 单调增加，对应 Fact 追加作废关系。
- `settle-expedition`：`expeditionId, terminalRef`。只能消费已持久化 finished 候选。奖励、余物与磨损从引擎推导，客户端不能提交 reward/patch。

v1 Campaign 有时钟、public/party/crystals 余额、开放角色、库存、traits、活动远征引用和ledger。该旧版收益进入party/crystals，不推进时间、不添加永久伤势。当前v4普通远征会推进时间并处理配给／成长证据，不能沿用旧版语义。

```ts
import { createBrowserGameRuntime } from "../../game-runtime/browser";

const runtime = createBrowserGameRuntime();
const saveId = runtime.newId();
const epoch = runtime.newId();
const created = await runtime.application.create({
  protocolVersion: 1, saveId, epoch, clientRequestId: runtime.newId()
});
if (!created.ok) throw new Error(created.error.message);

const startRequest = {
  protocolVersion: 1, saveId, clientRequestId: runtime.newId(),
  expectedHead: created.receipt.after!,
  command: {
    type: "start-expedition", expeditionId: runtime.newId(),
    routeId: "legacy.rift", partyIds: ["kael", "eustice"],
    itemIds: [], equipmentIds: [], seed: runtime.newSeed()
  }
};
const committed = await runtime.application.dispatch(startRequest);
// 网络/页面反馈不确定时重试同一份 startRequest。
if (!committed.ok) throw new Error(committed.error.message);
const loaded = await runtime.application.open(saveId);
// 用 loaded 中的最新状态更新页面；committed.receipt.events 用于演出。
```

S3 的 controller 在提交成功后安排演出；impact 只更新视觉值。冲突时重新读取，让玩家形成新请求，不能自动把旧命令套到新 head。存储失败时保留旧画面权威值；重试同请求核对结果。敌方动画 ack 不写规则进度。

## 存储与恢复

Memory 和 IndexedDB 使用同一 compare-and-commit 协议。IndexedDB 的 `saves` store 将整个 GameRecord（包括 commits/facts）作为一份快照保存，`receipts` 单独按 `[saveId,epoch,requestId]` 索引；同一个 readwrite transaction 覆盖二者。规则与内容摘要计算都在事务外，事务内没有 await。

普通重开保留来源、资产和回执。历史应用导入要求新 saveId 和 epoch；保留连续 revision 历史并追加 import 提交，重映射 Fact、远征、checkpoint、结算身份，保存 originRef。旧请求成功历史留在 commit 中，旧存储回执（包括拒绝回执）不迁入新作用域，也不作为新请求去重依据。资产直接作为快照恢复，不重播奖励。

旧 Battle schema 1—4 先迁移再深层校验；只进入独立、零资金 Campaign。旧存档没有可证明的应用 Fact 历史，其旧 undo checkpoint 关联导入提交；导入后的新 Fact 才有逐提交来源。不能拿旧终局向已有钱包付款。

档案 JSON 上限 8 MiB UTF-8、深度 40、节点 300000；普通集合/提交历史/Fact 每项上限 4096，undo 256，物品与库存容量 256。达到限制时明确拒绝写入，不静默删除去重历史。S2 使用整份快照事务，历史分页/压缩留待有容量测量后升级 schema。

## Fact 与可选 AI

下面的 `projectFacts`／短反应Port描述legacy已接入的能力；v4有独立事实与玩家反馈，但尚未接完整模型上下文管线。

Fact ID 来自全局 head 与批内序号的 SHA-256，不能用旧 event.id 代替。有限白名单从结构化事件映射出伤害、治疗、资源、清层、终局等事实；未映射的事件不会从 log 文本反推。每个 Fact 记录 source、世界时间、参与者可见性与远征/遭遇身份，内容版本由所属 GameRecord 唯一指定。

`projectFacts(record, actorIds, source?)` 只输出该提交中所有请求参与者均可见、未作废的 party Fact。player/internal/simulation/未知类型不进入短反应。投影不包含 RNG、未来遭遇、角色背景或完整 Catalog。

`react-to-commit` 请求只携带这些投影及允许的说话者/表情/动作、场景、来源、deadline 和预算。返回对白至多 3 行、总字符预算至多 240；必须引用授权 FactId。Abyssa 重新校验返回值、当前 head/远征/场景和 cue 状态。旧 head、取消、超时、重复、越权输出都跳过；不改机械状态、不重试游戏命令、不写永久关系。

`runtime.createReactions(currentScene).start(options)` 自动读取已提交状态；低层 coordinator 只用于受控装配与测试，调用方须提供应用 open 的记录。页面卸载时 dispose；重新开页不恢复旧 cue。默认 `LocalReactionPort` 无网络；后续复杂管线应在适配层接入，不把 Provider/Session/Pipeline 塞入游戏存档。

## 验证入口与 S3 交接

```sh
npm run check:application
npm run check:baseline
npm run build:all
npm run test:storage
npm run test:smoke
```

application/testing 的共同 store contract 在 Node Memory 与 Chromium 的两个 IndexedDB 连接各运行一次，使用真实玩家命令取得正收益再结算。另有完整旧兼容轨迹、历史迁移、物品保管、故障、撤回和 AI 接受测试。

页面已经按 Title 档案 → Map 提交出征 → Battle 已提交事件演出 → 终局结算 → Mansion 读取Campaign接线。以下S3／D1／D4小节保留对应旧版的技术演进范围，当前内容能力以上方v4入口为准。

## S3 玩家接线

正式页面经 [game-client](../game-client/README.md) 调用本服务。Storage Port 的 `listSaveIds()` 只枚举身份，不解释业务状态；open 会核对存储 key 与 head.saveId 一致。`projectPlayerHistory(record, expeditionId)` 是跨提交玩家经历投影，过滤内部、simulation、撤回和其他档案事实；原 `projectFacts` 仍严格限定当前提交与 actor 可见性。

S3 没有改变 GameRecord/schema、Catalog digest、公开游戏命令或旧经济规则。新增恢复协调在客户端调用既有应用命令，每步仍独立经过 CAS 与原子事务。

入账后的短反应只允许当前提交的可见 expedition-settled Fact 与 ledger 一致时授权见证人；request 保留原 expeditionId 并核验当前 head/scene。其他历史 Fact 不会因回馆而进入当次模型上下文。

## D1 规则 2 补充

`versions/` 提供独立 schema 2／protocol 2 的严格记录、命令、回执和事实读取器，以及 `createDemoApplication`。旧 reader 和 legacy Battle schema 4 保留；存储 Port 的泛型以旧记录／回执为默认类型，IndexedDB 仍用原物理数据库与两张表。

规则 2 创建只接受已注册 profile，该版没有任意 initial 覆写或实际成长授予命令。end-turn 在一次 CAS 中保存手牌加成、四约效果与待执行队列；resume-run 推进一条已保存意图。重试读回执，写入失败不落候选状态。undo 恢复 RNG／阵位／线状态并追加事实撤回记录。

导入要求新 saveId／epoch，显式映射 run／encounter／敌人／事实／检查点引用，保留角色和定义 ID；adventure／simulation 与导入 originRef 分开。玩家事实查询过滤模拟和已撤回效果；现有 AI Port 暂不接收 v2 record。详见 [D1 实施验收](../../docs/archive/audits/2026-09-06-demo-d1-implementation.md)。

## D4 规则 3 补充

完整庄园复用 `createDemoApplication`，严格按 Catalog rulesVersion 选择 schema／protocol／receipt／fact 版本。v3 增加有限召唤来源、席位与解除事实、五层完成证据、接管／奖励和剧情游标；v2 不接受这些字段。`versions/manor-history.ts` 核对终局与已提交胜利、房间、原子结算及阅读记录。

普通收益、剩余配给、时间、清 active run、一次接管与20G奖励同一事务提交；阅读继续／跳过只更新游标。导入重定位全部相关引用并保留领奖状态。AI Port 未扩为 v2／v3 管线，游戏与本地反馈不依赖它。验证与待补项见 [D4 实施记录](../../docs/archive/audits/2026-09-06-demo-d4-implementation.md)。
