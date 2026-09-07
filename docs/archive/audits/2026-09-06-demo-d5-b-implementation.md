> 历史档案：2026-09-07文档整理时归档。原路径：`docs/audits/2026-09-06-demo-d5-b-implementation.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# D5-B：版本与合法进度实施记录

> 后续C已安装实际战斗读取器，并将战斗事实改为紧凑日志、历史终局改为同事务两份事实，见[C实施记录](2026-09-06-demo-d5-c-implementation.md)。下文保留B完成时的范围与验证数字。

日期：2026-09-06。范围：[D5-B工作包](../plans/DEMO_D5_MEMORY_AND_GROWTH_PLAN.md)，采用[D5-A规格](../design/DEMO_D5_A_RULES_AND_STORY_SPEC.md)。本报告仅描述版本及进度底座，不代表本尊战、回忆播放或页面领取已实现。

## 1. 本次实际交付

| 部分 | 交付与边界 |
| --- | --- |
| 独立内容 | `abyssa.demo@2 / rulesVersion:4`，有独立摘要、固定历史模板、十事件和两件赠物引用；原v2／v3内容未改 |
| 版本契约 | schema／protocol／receipt／archive／fact均为4；拒绝错版、错摘要、未知字段和引用不闭合 |
| 进度来源 | 仅从已绑定事务的证据推导成长、亲征、物品归属和当前快照；不能往数组填一个growth ID就获得升级 |
| 运行状态 | 单一 `snapshot.run` 判别联合，与 `campaign.activeRunRef`严格对应；memory额外绑定attempt，不能并存两个run |
| 回忆状态边界 | 首通及首通收束后才可进入；固定seed重试、历史完成与当下兑现分开；不推进当下时间／结算 |
| 成长与赠物 | 本人参加、合法归来、Lv.2后新出征、维护门槛、最终故事游标与一次领取均有纯规则校验 |
| 装备归属 | 赠物产生两个唯一实例；库存／已装备／出征预留三态，转移原子推导，返还同一实例；配置是归属投影 |
| 持久底座 | 独立foundation service可创建、读取、导出v4基线；共享已有CAS存储，不开另一种数据库事务协议 |
| 尚未接入 | 可执行v4战斗读取器及战斗策略、实际回忆／领取／装卸命令、旧档复制升级、页面写操作和默认v4入口 |

后四项中的“校验／推导”与“可供玩家点击的命令”分开验收。D5-B不把尚未实现的操作返回空成功；foundation service解析请求后明确返回 `content-unavailable`，不提交进度或伪回执。生产默认仍为D4／v3，原界面、骰子动效和素材保持。

## 2. 文件与职责

| 入口 | 职责 |
| --- | --- |
| [D5内容](../../../src/content/gameplay/demo-v2/foundation.ts) | 从已冻结庄园数据复制装配，附加D5身份与固定数值模板；不修改源对象 |
| [Catalog契约](../../../src/game-core/contracts/d5.ts)／[校验](../../../src/game-core/contracts/d5-validation.ts) | v4内容引用、十事件完整性、固定五人、空装备、两件赠物及结构限制 |
| [状态契约](../../../src/game-core/session/d5-types.ts) | 当前进度、run身份、memory局部补给、故事游标、唯一装备位置及战斗读取器边界 |
| [证据解析](../../../src/game-core/session/d5-parse.ts)／[进度推导](../../../src/game-core/session/d5-progress.ts) | 按事务先后处理合法证据；推导资格、奖励、归属、时钟和一次里程碑 |
| [快照校验](../../../src/game-core/session/d5-snapshot.ts) | 快照必须等于证据投影；run体与身份、配置、历史模板一致 |
| [应用契约](../../../src/game-application/versions/d5-contracts.ts)／[请求解析](../../../src/game-application/versions/d5-parse.ts) | 外部命令与内部语义证据分开；memory请求强制attempt，客户端不能直接提交grant事件 |
| [记录／回执／归档校验](../../../src/game-application/versions/d5-validate.ts) | head、commit、fact、run、时间、业务资格与内容引用核对 |
| [foundation service](../../../src/game-application/versions/d5-foundation.ts) | 最小真实持久链、CAS和创建回执恢复；未安装的玩法命令拒绝执行 |
| [独立装配上下文](../../../src/game-runtime/d5-foundation.ts) | 明确提供未发布D5上下文，不加入玩家registry |

application和内容层通过core公开入口导入；内部模块不绕过现有依赖边界。新增公开类型没有扩大旧版 `DemoCatalog`、`AnyGameRecord` 或旧版请求解析器的可接受集合。

## 3. 合法进度如何成立

### 3.1 一份来源，严格核对投影

新增进度证据存于 `facts`，每份都绑定本档案的save／epoch／revision、commit业务种类和规范fact ID。core只接收应用层校验后的证据序列并重放进度。`snapshot.campaign`内的等级、库存、解锁、资金和时钟是可核对投影，不能独立修改。

B阶段每个进度事务对应一份语义证据；最后故事确认在一个结果内派生成长／物品，以及适用时的凯尔里程碑。没有“先记事件已看完、之后再发奖励”的半完成状态。D5-C需在此基础上加入战斗事实及撤回分组，不能把进度凭证加入可撤回战斗链。

普通归来的凭证同时包含结算摘要和最终远征体，须由可信core读取器验证终局，再核对出发时冻结的队伍、配置、路线及返还实例。回忆完成同样保留最终战斗证明；只有正确本尊终局和固定历史模板才能推导完成。单个 `completed:true`、任意terminal ID、单纯动画回调都不足以发奖励。

离线归档校验保证引用和规则内部一致，不宣称能防止用户有意重新编造一整份自洽历史。

### 3.2 固定模板与读写能力分开

`D5RunReaders`是由代码装配的core能力，不是存档或请求可传入的函数。没有对应读取器时，活动远征、本尊战体及终局证明一律拒绝，不把任意JSON保存为合法战斗。D5-C将安装真正的规则读取器；D5-B的终局正例用明确封存的测试夹具验证接口与来源关系，不构成“已运行本尊战”的证据。

memory补给的类型及来源为 `memory.marietta.allowance`，身份由局部run和定义生成；数量、充能、固定成员与Lv.2参数均核对。它们不能冒用真实库存的配给来源。回忆的局部终局不进入普通settlements，也不产生金币、普通失败或时间推进。

活动战斗与终局的RNG种子必须绑定该回忆检查点，撤回检查点也不能换种子。战斗已终局但没有提交完成证据的snapshot被拒绝；不会把这类不完整状态当作可恢复的普通战斗。

“历史完成”只产生待兑现结果。到达并完成 `story.marietta.return`的合法末节点后才开放玛亲征；这个事务清掉memory占用。未完成尝试离开后只可恢复同seed检查点，不可新建run刷开局。成功待兑现不能通过“离开”丢弃。

### 3.3 成长、故事与唯一装备

十项成长按A稿门槛推导：第三层撤离／五层通关、本人在出征名单中；Lv.3额外核对Lv.2领取之后才开始的新run。玛还要求已兑现回忆且本人参加维护。失败、缺席和simulation来源均不成为资格。

事件保存独立session与游标。稍后可以保留多个片段的阅读位置，但同一时刻只有一个活动故事；先稍后再出征，不丢资格。完成按钮／跳过对白都须到合法结果节点；再次完成同一成长或赠物被拒绝。任意第二人领取Lv.3时，在同一派生结果里记录凯尔面4变金一次，不清锈、不改护卫强度。

两件装备的实例由赠物grant与definition共同派生，记录唯一位置。所有原生空面依旧交D1配置解析；不会借装备用新字段唤醒沉眠。预留装备仍在同一权威库存中，以位置引用出征；run配置只是实例引用，不是另一份所有权。

## 4. 与旧版及后续分包的衔接

- 旧v1／2／3的Catalog、引擎、快照和记录校验不放宽；旧版进度仍按旧版规则验证。
- v4复用旧庄园的**结构校验函数**，临时 `shared`校验上下文不写入存档、不调用为v4战斗，也不把真实旧档改版本冒充升级。
- D5-C：实现真实v4战斗读取器、重排、本尊及相关事件；增加战斗facts／撤回模型并校验已提交终局。
- D5-D/E：将运行结果接到本次的进度证据，实施故事推进、结果领取和装卸命令，再接原页面。不能直接从UI写投影。
- D5-F：B明确拒绝来源升级／继承字段；F须实现来源验证与全部引用重定位后再开放复制，不接受只填sourceId的“证明”。
- D5-G/H：完成集成、数值、界面及持久链验收后，才把完整v4加入玩家默认入口。

## 5. 验证记录

工具链：Node `22.23.2`，Vitest `3.2.7`；原生存储探针使用本机已有Chromium 1234缓存。以下均为本轮运行，日志与机器可读结果位于忽略目录 `dist/reports/demo-d5-b/`。

| 检查 | 本轮结果 |
| --- | --- |
| D5 core／application定向 | **52项通过**：core 30，application 22 |
| 原战斗页面复测 | **49项通过**，连同上述D5用例共101项；单worker，未改超时配置、页面或动画 |
| 四组TypeScript | core、application、app、tooling全部通过 |
| 入口／边界 | 18个页面检查通过；560个源码文件、89个core生产文件无越界 |
| 构建检查器测试 | **66项通过** |
| 纯core／application导入 | 124个兼容导出检查通过；5次既有headless远征完成；这不是D5战斗验收 |
| 原生IndexedDB | 两连接创建竞争只提交一次；回执重放；刷新后读取／归档往返一致；同库v3仍可读取，v4读取器拒绝错版；未安装命令拒绝且head不前进 |
| 文件边界 | 对比开工前1353项散列：现有文件仅README及3个公开入口变化；新增16个源码／测试／内容说明文件；无删除。页面、共享UI、素材、配置、脚本和原测试等1069项受保护文件全部一致 |
| 文档／差异 | 6份文档的124个本地链接及锚点通过；`git diff --check`通过 |

全量 `check:baseline` 的首次完整测试批次为104文件通过、2文件失败（925用例通过、2失败）：一项既有战斗界面用例在并发运行下超过5秒；一项本轮新增道具请求测试写成了错误的`memberId`字段。后者已改回既有契约的`id`，前者保持实现与测试不变，以单worker复测49项全过，原超时用例耗时872ms。随后D5最终52项及其余基线门禁全部通过。**没有将该次全量命令标记为一次性全绿，也未把分批结果相加冒充新的全量运行。**

可复现的定向命令：

```sh
npm test -- --maxWorkers=1 src/game-core/session/d5-progress.test.ts src/game-application/testing/d5-foundation.test.ts src/apps/battle/ExpeditionBattleScreen.test.tsx
npm run typecheck
npm run check:entries
npm run boundaries:check
npm run test:build
npm run check:core:import
```

对应记录：`targeted-final.log`、`check-baseline.log`、`final-gates.log`、`native-storage.json`、`source-diff.json`、`document-validation.json`。原生存储探针只启动临时本地端口和隔离数据库，结束后关闭浏览器／服务并删除测试数据库；不是玩家页面或本尊战试玩。

核心用例覆盖全部十个成长、里程碑、合法归来、缺席／失败、后续出征顺序、事件末节点、稍后恢复、两件实例的预留与返还、占槽／不适用、回忆与当下隔离、待兑现、attempt、固定seed与终局凭证，以及无战斗读取器时拒绝证明。

应用用例覆盖新档持久化、两连接CAS、提交前失败、提交后回执丢失、严格归档往返、来源／head／run kind／时间篡改、未绑定grant／物品和内部续步边界。

本次未改战斗／角色页样式和素材；没有启停用户5190服务，没有接入rp-style-lab／LLM，没有重置或提交已有S0–D4工作树。
