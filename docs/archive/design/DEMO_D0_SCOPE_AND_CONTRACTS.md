> 历史档案：2026-09-07文档整理时归档。原路径：`docs/design/DEMO_D0_SCOPE_AND_CONTRACTS.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# DEMO D0：范围与契约收口

> 日期：2026-09-06；版本：v0.2。
>
> 状态：D0 文档交付完成；用户已定稿首通后回忆开放玛、Lv.3 封顶且仅两件空面装备、敌方阵位重排。本文保留 D0 时点的目标契约，后续实现及修订见下。
>
> 上位依据：[DEMO 实施规格](DEMO_CHARACTERS_AND_OLD_MANOR_SPEC_V0_1.md)；执行进度：[D0–D6 计划](../plans/DEMO_CHARACTERS_AND_OLD_MANOR_IMPLEMENTATION_PLAN.md)；下一轮入口：[角色规则讨论单](DEMO_CHARACTER_RULES_REVIEW.md)；核验记录：[D0 交付审计](../audits/2026-09-06-demo-d0-closure.md)。

本轮三项定稿与覆盖关系见[正式决策记录](DEMO_CHARACTER_RULES_REVIEW.md#0-本轮定稿记录)。本文件同步为当前范围；初次 D0 审计中的 Lv.2 基线保留为历史记录。

2026-09-07最新范围修订：用户要求新增**新档 CG 世界介绍→洋馆介绍→基础教程与简单初始副本**，包含强盗／经典小怪和初始钩子，先按[初章计划 O0–O4](../../plans/DEMO_PROLOGUE_AND_ONBOARDING_PLAN.md)制作。下文首发可达表据此修订为目标范围；初章尚未接线，不属于已经完成的 D0 契约。开场进度、教学路线、奖励与旧档策略需 O2 补齐，不能直接复用庄园首通身份或套用本文件早期版本号。

2026-09-07范围修订：用户确定初战千金、维护／回忆刻仪兽；回忆入口在角色「记事」顶部，原本尊战由刻仪兽替代。首通并列开放回忆和维护，完成回忆及当下兑现才开放玛亲征。此项覆盖下文D0“刻仪兽候补／排除首发”及原本尊遭遇绑定，详见[总规格§9](DEMO_CHARACTERS_AND_OLD_MANOR_SPEC_V0_1.md#9-首通回忆与重复挑战)。D0原身份表保留历史依据，新内容和版本映射按[D5计划§0](../plans/DEMO_D5_MEMORY_AND_GROWTH_PLAN.md#0-本轮替换范围与实施顺序)补齐；历史隔离、资产归属与有限继承边界继续有效。

后续 D1 已完成[勘探与详细规划](../plans/DEMO_D1_CHARACTER_RULES_PLAN.md)，具体版本分流、状态类型、配置解析与验收依此推进；[源码审计](../audits/2026-09-06-demo-d1-exploration.md)记录实际缺口。本 D0 继续作为目标契约；D1 必需子集现已实施，见[实施验收](../audits/2026-09-06-demo-d1-implementation.md)，其余内容按 D3/D5 分期接入。

2026-09-06 后续版本记录：D3 已发布三层包 `abyssa.demo.manor-segment`／规则 2，原界面接入情况见[纠偏记录](../audits/2026-09-06-d3-ui-correction.md)。[D4 计划](../plans/DEMO_D4_OLD_MANOR_PLAN.md#3-内容发布与版本隔离)将完整包目标修订为 `abyssa.demo`／contentVersion 1／规则 3，并配套第三版 schema、协议、归档和事实 reader；保留已发布 v2，不自动迁移。此项尚属规划，覆盖下文早期完整包版本目标；稳定内容 ID、资产归属与首通开放顺序保持。

## 1. 本次收口的含义

用户本轮指定：**完成 D0，在正式角色规则实施之前停下，角色规则单独定稿和讨论。** 因此本次只产出文档、内容身份清单、版本与状态契约、范围决策和核验记录，不创建正式 Catalog，不改 TypeScript、页面、素材、数据库或存档。

本文区分三种效力：

- **用户定稿**：已明确的六人名单、36 面、成长奖励表、庄园身份与美术、三轨模式，以及本轮三项决策。
- **D0 工程决策**：本次选定的版本隔离、权威归属、事务、恢复、引用和事实契约，是后续工程输入，尚未实现。
- **D0 产品基线**：为首发排期选定的开放顺序和可达范围，是本次具体方案，不冒称用户逐项定稿；下一轮可以调整，调整时同步本文范围与依赖。

P01 的首通／回忆／亲征顺序、P12 的 Lv.3 上限及两件装备范围、P05 的重排对象现已确认。P02、P03、P06 及铭约／成长获取的具体细则保留原状态，不以本轮三项确认自动覆盖；后续授权的 D1 实施口径见规则记录第 11 节。

## 2. 首发范围与玩家可达表

### 2.1 采用的产品基线

| 决策 | 有效范围（含后续修订） | 理由与改变时的影响 |
| --- | --- | --- |
| 首发角色 | 凯尔、尤斯缇丝、艾洛拉、柯萝萝、诺玛、玛丽埃塔 | 继承最新六人范围；亲征仍为凯尔＋最多四名成员 |
| 新档开放 | 凯尔＋勇者四人可操作；玛在洋馆履职但亲征未开放 | 区分人物早已存在与操作层逐步开放 |
| 初章入口（新增） | 新的开始先进 CG 与世界介绍，再进洋馆介绍、初始教程和简单副本 | 不直接进入菜单；初章详细剧本／关卡／进度契约另立 O 阶段，尚未实施 |
| 玛开放顺序（已定） | 庄园首通→当下引入→手写回忆→回到当下开放亲征 | 勇者队须独立首通；不采用第三层撤离后提前开放玛的方案 |
| 当下内容 | 前置简单教学副本；庄园首通五层，第 3 层出口，第 5 层千金；首通后维护委托 | 教学独立于庄园两条路线与奖励；不反复绑回获救千金 |
| 刻仪兽 | D0原候补决定已被覆盖：维护／回忆最终Boss | 第4层仍沿用普通敌人；新终战机制、脚本及版本承接见总规格§9 |
| 回忆篇 | 玛丽埃塔一篇，勇者小队对刻仪兽＋当下收束 | 已由用户确认替代本尊战；首通后从角色记事顶部进入 |
| 角色页 | 概要、骰装、记事均读同一档案 | 先接真实只读投影，再开放已具备合法命令的领取／装卸 |
| 成长首发范围（已定） | 五名可成长角色覆盖 Lv.1→Lv.2→Lv.3，三级封顶 | Lv.2 升骰面、Lv.3 升现行铭约；包含艾的现行净化；Lv.4／5 后置 |
| 凯尔团队成长 | 任意两人达到 Lv.3，面 4 护卫素→金，生效一次 | 沿用既定团队里程碑，因三级可达纳入；不自动开放晶石除锈或专武 |
| 装备首发范围（已定） | 三槽契约；只开放备用短刃、应急药囊两件空面装备 | 不追加专武／小件；原 Lv.3 专武赠礼在本 DEMO 后置 |
| 玛铭约方向（已定） | 敌方阵位重排 | 改变横排邻接，服务顺劈；自动策略及初铭／现行参数待细化 |
| 常备包 | 七选四；七件效果都可用；DEMO 绑定配给保障失败后再试 | 数量和精确合法时机在 P07 配平，数量未定不等于来源未定 |
| 经营与 AI | 有真实配给／奖励／回馆反馈；完整生产链、商业经济、真实 LLM 管线后续 | Abyssa 独立完成闭环，S4 的可选 AI 排期不变 |

首发上限及装备范围已由用户定稿。完整设计中的 Lv.4／5、专武、小件和凯尔晶石线保留供后续使用，不作为本 DEMO 前置；Lv.3 现行及可达的凯尔团队里程碑不再留在后续清单。

### 2.2 玩家什么时候得到什么

| 时点 | 可操作／可领取 | 不在此时自动发生 |
| --- | --- | --- |
| 新档（新增初章后的目标） | 五名初始成员；先进 CG 与洋馆介绍，再按教学顺序接触战斗与备包 | 初章尚未接线；无满级、无默认专武、无玛亲征解锁 |
| 教学副本归来（新增） | 兑现初始小委托；建议此后开放自由枢纽并承接庄园，奖励与具体条件在 O2 收口 | 不接管庄园、不算千金首通、不自动触发原成长／赠物／回忆 |
| 第 3 层主动撤离 | 带回合法收益、剩余物品；触发对应归来记录；可补给再出征 | 不接管庄园，不结束家宴，不完成回忆 |
| 符合条件的庄园归来 | 当前为第 3 层撤离或第 5 层通关，提供实际参战者的勇者 Lv.2 事件候选与整备赠物入口 | 教学归来不能仅凭层数误触发；不以全队统一升级替代个人领取 |
| 第 5 层首通 | 千金救离、旧程序结束、庄园接管；首通奖励凭证；维护委托和回忆引入可用 | 不自动完成回忆，不自动开启玛全部成长 |
| 回忆完成并回到当下 | 玛亲征开放及篇章结果一次领取；角色页／地图同步 | 不领取当下远征掉落，不扣当下补给 |
| 玛参加维护委托后归来 | 玛的 Lv.2 事件候选；新编队的实际经历反馈 | 不自动升满，不获得尚未定案的生命小件 |
| 完成各角色 Lv.3 的手写成长条件 | 对应角色进入现行铭约，三级封顶 | 不跳过 Lv.2，不应用 Lv.4 全醒或 Lv.5 终铭；具体条件尚需内容卡 |
| 任意两名角色已达 Lv.3 | 凯尔面 4 护卫品质一次性变金 | 不增加护卫战面强度，不发无铭之剑，不移除其面 1 的成长锈 |

“合法归来”采用撤离或通关；是否把普通失败纳入某个关系事件条件留给手写事件本身。以上事件候选不直接加等级，必须有作者定义的结果和用户实际完成记录。Lv.2 的各面奖励及 Lv.3 的现行条款继续引用已定表；三级并不代表已经达到 Lv.4 全醒状态。

备用短刃与应急药囊的现有获取建议是一次性的手写整备赠物，各一件，进入正式库存；没有买卖、分解或重复领取。赠物时点／数量、可装备对象和空面改写后对铭约的影响在角色讨论单 R07 中收口后实施；本轮确认的是两件装备范围。

### 2.3 数据、测试与后续内容边界

| 类别 | 明确清单 | 实施门槛 |
| --- | --- | --- |
| 首发必须可达 | CG开场、洋馆介绍、基础教程／简单副本与钩子；六人亲征开放链；初铭／现行；五人的 Lv.2／3；凯尔团队里程碑；两件空面装备；七件道具；庄园首通、回忆和维护 | 初章按 O 线新增；D6 必须走正常玩家路径，不能用夹具改存档 |
| 保留设计／后续验证 | 五人 Lv.4／5、专武与小件、其他通用池、凯尔晶石除锈 | 不因写了表就全注册为可取得内容；Lv.5 终铭不进入首发测试／实现前置 |
| 本次不实现 | 阿尔薇特亲征、其他三座主题地牢、艾比希斯亲征、托管、全力模式、完整洋馆生产经济、玛未定专武小件 | 初章教学、刻仪兽和已接入的基础商店购买不在此排除范围；已有设计和素材保留 |

没有效果实现的条目不得出现在生产 Catalog 的可用引用图中。开发夹具可单独验证高等级，必须标明 fixture 来源，不能写入普通 Campaign 的实际获得记录。

二周目允许跳过已完成篇章的方向保留。本次采用**从有效通关档派生新档**的范围：继承篇章完成证明，只让玩家选择跳过对应回忆；不继承资产、成长、首通奖励或庄园接管。首通仍须在新档实际完成，然后凭证明跳过回忆并在当下开放玛；这与完整备份导入是两种操作。

## 3. 新档、旧档与版本契约

### 3.1 版本矩阵（D0 工程决策）

| 边界 | 现行 legacy | 新 DEMO 目标 | 说明 |
| --- | --- | --- | --- |
| Catalog | `abyssa.legacy`／content 1／rules 1 | `abyssa.demo`／content 1／rules 2 | 新内容语义另包，digest 由最终内容生成，本次不编造 |
| 应用记录 | `GameRecord.schemaVersion = 1` | `2` | Campaign 进度、房间和 memory 状态由此版本覆盖 |
| 应用归档 | `archiveVersion = 1` | `2` | 归档包与记录版本显式匹配 |
| 命令协议 | `protocolVersion = 1` | `2` | 新命令及 runRef 必须有独立解析分支 |
| 回执 | `CommandReceipt.version = 1` | `2` | 新事件／事实结构不伪装为旧回执 |
| 结构化事实 | `GameFact.version = 1` | `2` | 新增 memory 语义、runRef 和节点／篇章上下文 |
| 旧独立 Battle 存档 | battle schema 4／rules 1 | 保持旧格式只服务旧包 | 新 DEMO 只用应用归档，不在首发另造独立战斗导入格式 |
| IndexedDB | 数据库 `abyssa-game-v1`，物理版本 1；saves＋receipts | 物理结构可保持 1，存放版本化记录／回执 | 数据库版本不等于内容／记录版本；不清库、不改名使旧档消失 |

Campaign、Expedition、Encounter 和 Memory 不再各设一个随意变化的数字版本；其持久字段受应用记录 schema 2 统一约束，文档分别登记所有权。若以后确需独立导出，才为独立格式设版本。

规则 2 和 schema 2 是目标契约，**常量与运行时当前仍为旧值**。D1 讨论后才能实施。新包在未发布前可迭代；一旦向玩家产生持久档案，同一版本的内容与 digest 不得原地改写。

### 3.2 读取与迁移流程

1. 从存储读取有大小／深度限制的原始 JSON，仅解析版本、head 和 CatalogRef 所需的最小信封。
2. 按已登记的 schema＋catalogId＋contentVersion＋rulesVersion 找到对应 reader 和 Catalog；先路由再执行该版本的严格验证。
3. 校验 digest、所有引用、实例身份和状态不变量；成功才创建该档案的 application／runtime。不能先用硬编码 legacy 验证器读取新档，再尝试补救。
4. 旧档继续旧规则；新档使用新包。首发没有 legacy→DEMO 的玩法迁移命令。
5. 新版应用导入必须使用新 saveId／epoch，保留原档；引用重映射闭合，旧请求回执不能成为新档可重放的请求。
6. 未知版本、缺 Catalog 或 digest 不符：显示可解释的不可用状态，可导出诊断原文；不回退、不覆盖、不自动清档。

活动远征绑定开始时的完整 CatalogRef。期间不切版本、不让未来角色调整改写当前骰面。导入是复制既有档案，不能凭导入重新领取首通、装备或成长。

**当前额外缺口**：`service.ts` 的应用导入按 `:encounter:` 后缀和层号重建遭遇 ID。新房间／回忆存在后必须建立显式 ID 映射，不能复用字符串拆分技巧。映射范围包括 run、room instance、encounter、enemy instance、fact、claim、checkpoint、pending result 及其所有反向引用。

## 4. 内容身份与引用清单

以下是 **D0 的命名契约**，不是新建的生产 Catalog。ID 表可用于后续校验，动作数值和铭约算法仍来自单独角色定稿。

### 4.1 角色与玩法定义

| 类型 | 预留 ID／展开规则 | 归属与状态 |
| --- | --- | --- |
| 角色 | `kael`、`eustice`、`elora`、`kororo`、`norma`、`marietta` | 沿用现有角色英文身份；不因换包改名 |
| 六面 | `face.<角色ID>.01` 至 `.06` | 六角色各六个稳定面位；凯尔 `.06` 不是原生点数 6 |
| 基础动作 | `action.attack`、`action.guard`、`action.heal`、`action.wild`、`action.blank` | 基础语义；不把“淬毒飞刀”面名解释成自带毒 |
| 特定动作 | `action.kael.protect`、`action.elora.expensive-heal`、`action.marietta.cleave-right`、`action.marietta.cleave-left`、`action.marietta.bind`、`action.marietta.guard-all`、`action.marietta.thread-strike` | 绑定对应面；行为待角色规则定稿 |
| 铭约 | `covenant.eustice`、`covenant.elora`、`covenant.kororo`、`covenant.norma`、`covenant.marietta` | 阶段是定义内的 stage；凯尔没有触发铭约 ID |
| 铭约重排动作 | `action.marietta.reorder` | 对象已定为敌方阵位；自动策略及两阶参数未写全，尚不可执行 |
| 状态 | `status.bound-stun`、`status.bound-thread`、`status.bound-escape`、`status.sealed`、`status.temporary-rust` | 严格区分目标实例与生命周期，不以 display name 匹配 |
| 首发成长 | `growth.<角色ID>.lv2`、`growth.<角色ID>.lv3`，角色集合为尤／艾／柯／诺／玛 | 十个奖励定义；Lv.2 升骰面，Lv.3 升铭约阶段，分别关联合法获得条件 |
| 团队里程碑 | `growth.kael.team-lv3-guard` | 任意两名成长角色达到 Lv.3 后一次生效，改凯尔面 4 品质 |
| 通用装备 | `equipment.spare-blade`、`equipment.emergency-pouch` | 首发两种；其他装备仅原设计保留，未加入本清单 |
| 共鸣 | `resonance.earth-market`、`resonance.rainy-night`、`resonance.sovereign` | 本六人可达三种；圣辉仅保留未来定义方向 |
| 道具 | `item.food`、`item.potion`、`item.ward`、`item.holy-water`、`item.maintenance-kit`、`item.lucky-charm`、`item.divination-slip` | 七种；实例充能不写在静态 ID 中 |

面与动作的完整映射沿[实施规格第 4 节](DEMO_CHARACTERS_AND_OLD_MANOR_SPEC_V0_1.md#4-正式六人规则清单)。原始面、成长后面和装备后面保持同一 faceId，变化来源由解析记录表达。

### 4.2 敌人、路线与房间

敌人定义前缀为 `enemy.old-manor.`：`waiting-guest`、`platter-bearer`、`mending-maid`、`curtain-butler`、`puppet-heiress`；本尊单列 `enemy.memory.marietta`。同一个定义可以生成多个 enemy instance，实例 ID 不能拿定义 ID 顶替。

首发路线为 `old-manor.first-clear`、`old-manor.maintenance`。表内 room 和 encounter 都是**定义 ID**；每趟另分配实例身份。

| route | 层 | room ID（前缀 `room.old-manor.`） | 引用 encounter／event（完整 ID） |
| --- | --- | --- | --- |
| first-clear | 1 | `first.foyer` | `encounter.old-manor.first.foyer` |
| first-clear | 1 | `first.register` | `event.old-manor.register` |
| first-clear | 2 | `first.service` | `encounter.old-manor.first.service` |
| first-clear | 2 | `first.relic` | `event.old-manor.relic` |
| first-clear | 3 | `first.butler` | `encounter.old-manor.first.butler` |
| first-clear | 3 | `first.exit` | 无；引用当前路线的第 3 层出口策略 |
| first-clear | 4 | `first.banquet` | `encounter.old-manor.first.banquet` |
| first-clear | 4 | `first.seats` | `event.old-manor.seats` |
| first-clear | 5 | `first.heiress` | `encounter.old-manor.first.heiress` |
| maintenance | 1–5 | `maintenance.layer-1` 至 `maintenance.layer-5` | `encounter.old-manor.maintenance.layer-1` 至 `.layer-5`，一一对应 |
| maintenance | 3 | `maintenance.exit` | 无；引用维护路线第 3 层出口策略 |

| encounter 后缀（前缀 `encounter.old-manor.`） | 可引用的敌人定义后缀 | 状态 |
| --- | --- | --- |
| `first.foyer` | `waiting-guest` | 编队数量按第 1 层教学配平 |
| `first.service` | `platter-bearer`、`mending-maid`、`waiting-guest` | 蓄力／修复考题 |
| `first.butler` | `curtain-butler` | 不沿用旧衣橱 HP |
| `first.banquet` | `waiting-guest`、`mending-maid` | 席位与清杂预热 |
| `first.heiress` | `puppet-heiress`、`waiting-guest` | 首通独有千金；宾客上限和数量 D4 定 |
| `maintenance.layer-1` 至 `.layer-5` | `waiting-guest`、`platter-bearer`、`mending-maid` | 维护编队只使用三普通敌人；第 3 层完成考核编队才开出口，不复活原管家或千金 |

召唤来源必须在所属 encounter／enemy 能力中明确引用 `enemy.old-manor.waiting-guest`，不把现有全局 `summonEnemyId` 当所有路线的通用默认。

维护编排在 D4 具体配平；其范围现在确定为五层、第三层出口、末层清理战。支线残余不再具有制造主人的权限。正式卡未完成前整条维护路线处于未发布状态。

### 4.3 篇章、进度、奖励与资源

| 类型 | ID | 引用关系 |
| --- | --- | --- |
| 庄园手写事件 | `event.old-manor.register`、`event.old-manor.relic`、`event.old-manor.seats` | 分别为迎宾簿、遗物整理、空席核对；被上表对应房间引用，判定卡在 D3/D4 完成 |
| 回忆篇章 | `chapter.marietta.memory` | `encounter.memory.marietta` → `enemy.memory.marietta`；使用独立历史队伍模板，模板详情 D5 定 |
| 当下首通剧情 | `story.old-manor.release` | 来自首通胜利凭证；救离、结束规约、接管同一结果 |
| 当下篇章收束 | `story.marietta.return` | 来自 memory 完成凭证，开放亲征 |
| 当前庄园进度 | `progress.old-manor.takeover` | 从 absent 变 completed；首通发生一次，重复委托不重置 |
| 亲征开放 | `unlock.marietta.sortie` | 篇章收束生效；不是首通直接赠送 |
| 成长事件 | `event.growth.<角色ID>.lv2`、`event.growth.<角色ID>.lv3`（同上五人） | 各自引用同角色／同等级 growth，完成一次后不再发奖；具体手写条件待补 |
| 整备赠物 | `event.demo.preparation-gift` | 现有建议：`reward.demo.preparation-gift` → 两种首发通用装备各一；领取细则待收口 |
| 新档模板 | `profile.demo.first-run` | 初始五人、Lv.1、空装备槽、四槽备包、未首通／未完成回忆 |
| 补给策略 | `supply.demo.allowance` | 引用七种 item；充能量表 D3 定；不允许卖出／分解 |
| 首通奖励 | `reward.old-manor.first-clear` | 固定叙事进度＋数额待 P10 的货币奖励；不暗中包含解锁玛亲征 |
| 回忆结果 | `reward.marietta.memory` | 亲征开放＋手写收束；本次不预设赠送未定专武 |
| 常规路线奖励 | `reward.old-manor.layer`、`reward.old-manor.maintenance` | 只登记奖励表身份；数额与召唤赏金预算 D3/D4 定 |

定义引用不允许跨到未发布候补。内容包发布检查必须拒绝：缺定义、六面不齐、房间跨错层、路线无出口、未知奖励、成长指向未知角色、回忆战使用当下随机队伍、被废弃敌人仍在引用图中。分餐侍从及旧衣橱／纯家具 Boss 不进入清单。

## 5. 状态所有权与生命周期

### 5.1 持久状态矩阵

| 所有者 | 持久数据 | 生命周期／权威来源 |
| --- | --- | --- |
| Catalog | 基础六面、效果、敌人卡、路线、事件、成长与奖励定义 | 不可变内容；不存某玩家剩余次数 |
| Campaign | 时钟、public／party／crystals、库存、装备归属、角色成长领取、篇章完成、首通、奖励凭证与领取记录、当前活动 runRef | 跨趟长期；变更只经应用事务 |
| Expedition | 唯一 ID、routeId、冻结 CatalogRef 与队伍配置、层／room 游标、残血、临时退化、携带实例及充能、胃口、散金／入袋资源、层奖励记录、事件选择与 RNG | 只属于本趟；离场返还剩余物品、结算后清除 |
| Room | instanceId、definitionId、类型、可选／必经、未开始／待选择／进行／完成、一次结果引用 | 嵌入 Expedition 或 Memory 的节点进度；不另造全局房间仓库 |
| Encounter | 实例 ID、敌人实例与顺序、意图、骰子朝向／锁定／已用、回合、敌方执行游标、格挡、效果队列与本场状态 | 每场；场间不清除整趟残血、补给与装备成长 |
| Memory | runId、chapterId、固定队伍和局部规则状态、历史节点游标、局部 RNG、待兑现篇章凭证 | 与 Expedition 互斥；不得引用真实出征物品实例 |
| 应用回执／事实 | requestId、前后 head、事件、事实、撤回关系、来源 | 只有事务成功才是真实结果；日志文案不是事实依据 |
| 展示进度 | sceneId、已提交结果引用、段落／演出游标 | 可恢复／可跳过；不拥有奖励、HP 或解锁权 |

新记录的 `activeRunRef` 采用 expedition／memory 二选一，不同时维护可独立变更的 `activeExpeditionId` 与 `activeMemoryId`。旧 schema 1 保持原字段。Encounter 的所属 runRef 必须唯一，页面 stale URL 不可操作另一趟或另一段回忆。

`availableCharacterIds` 在新包由初始开放和已领取篇章结果推导，不再与 `unlock.marietta.sortie` 形成两份独立真相；如为性能缓存必须能校验重建。羁绊等级同理由已应用的成长进度推导，不让“等级是 2、面却没升级”成为合法存档。

### 5.2 必须保持的不变量

1. 一个物品／装备实例任一时点只在 Campaign 库存或一个活动 Expedition 中；出征预留与启动同事务，返还只一次。
2. room 完成不必等于 layer 完成，encounter 胜利也不必等于 room 最终完成。只有层的必经节点全部满足才入袋一次。
3. round、encounter、layer、expedition 的清理分别执行；定身、缠线、挣脱、归队等具体边界先经过角色定稿再填写状态表，D0 不替它们选值。
4. 所有队伍配置／敌人／实例 ID 必须引用同一个冻结 CatalogRef，不允许 UI 用新包头像顺便换掉旧包规则。
5. 出征期间禁止馆内成长领取和装备装卸；查看角色页只读本趟冻结配置。先采用这一简单限制，避免首发产生两份可变装备配置。
6. 人格档案、作者历史与本次冒险记录分开；旧样稿的 62/100、轻伤休养两天等不能灌入新档。
7. 终局进度、奖励凭证与待结算状态先提交，演出不能回滚这些事实。取消演出不等于撤销通关。

### 5.3 时间契约

D0 采用：普通远征完成最终结算时推进一个当下相位，撤离／通关／失败均一次；进入下一层、刷新、动画结束和重复请求不推进。当前 S3 的结算代码没有这项新行为，后续需明确实现并测试。

memory 开始、战斗、失败、重试、完成不推进当下时钟；回到当下的短收束默认也不额外推进。后续长日常活动若消耗时间须由其自己的手写定义声明，不能让 LLM 根据文本长度推断时间消耗。

## 6. 资产、配给与奖励契约

### 6.1 资金所有权

| 资金／资源 | 所属 | 本阶段处理 |
| --- | --- | --- |
| public | 洋馆公款 | 与本趟冒险金币隔离；完整经营后续接入 |
| party | 已结算的冒险公用金 | 本趟结算到账；新的一趟失败不扣以前余额 |
| crystals | 已结算晶石 | 单独记账；本次不因此开放未定晶石装备线 |
| loose gold | 本层散金 | 属于 Expedition；昂贵治疗从这里扣，失败时丢失 |
| banked gold／materials | 本趟已入袋资源 | 出口／终局结算带回；尚未等于 Campaign 已到账 |

D0 选择失败账本范围为**本趟**：丢失本层未入袋资源，本趟已入袋金币按 P10 确定的减半舍入处理，已入袋非货币材料保留，不扣以前的 party/public/crystals。这是本次对“金币减半”范围的基线澄清，数字配平与舍入仍待 D3。

新档起始资金由 `profile.demo.first-run` 定义，采用零货币开局的工程基线，配给不依赖有钱；任何真实赠款都必须有 grant 来源。不能把页面里的显示余额导入。

### 6.2 DEMO 配给

以 `supply.demo.allowance` 作为首发过渡来源：开始新远征时，将所选四种道具补至各自的本趟上限，再原子移入 Expedition。不是每点一次领取就加一份，也不是复制当前库存。

未消耗配给返还为同来源的绑定库存，下一趟只补差额；失败也可再申请。配给不能出售、分解、换币或变成普通购买物品，结算只返还真实剩余量。物品定义 ID 相同但来源不同的实例不随意合并。

这样可以在生产链未上线时完成多趟测试，同时保留真实持有／消耗／返还链。七种上限仍以历史占位 4/2/2/2/1/1/2 为模拟候选，**D0 不将其冻结**。P07 必须在 D3 开打前完成数量和总量限制。

### 6.3 奖励与领取

普通层入袋、整趟结算、首通结果、篇章结果、成长和整备赠物分别去重。工程使用业务 key，不仅依赖一次点击的 requestId。

| 业务 | 去重键语义（规范化数组再哈希） | 同事务内容 |
| --- | --- | --- |
| 层完成 | saveId、epoch、runId、layerId | 完成标记、散金转入袋、层效果、事实 |
| 整趟结算 | saveId、epoch、runId、settlement | 到账、剩余返还、时钟、结算记录、活动 run 清空 |
| 首通 | saveId、epoch、`progress.old-manor.takeover` | 救离／接管进度、首通奖励凭证、后续入口资格 |
| 篇章 | saveId、epoch、chapterId、completion | 篇章凭证；回到当下时一次兑现亲征开放 |
| 成长 | saveId、epoch、growthId | 资格消费、成长变化、实际记事；若本次达到两人 Lv.3，一并兑现凯尔里程碑且独立去重 |
| 赠物 | saveId、epoch、rewardId | 物品实例、领取记录、对应事件结果 |

首通叙事状态不因背包满而丢失：先原子记录有权领取的奖励凭证，领取物品时再检查容量；容量不足不标已领，不消耗凭证。可以立即到账的货币在终局事务中直接发放，但同一 reward 的已发／待领部分必须明确，不能让后续重领再发货币。

首发没有出售／交易，因此这里的凭证只是持久结果的一部分，不扩建通用邮件、拍卖或奖励服务。

## 7. 命令、失败与恢复契约

### 7.1 请求外壳

新普通命令使用 protocol 2，仍携带 `saveId`、`expectedHead`、`clientRequestId`、`command`。runRef 为 `{ kind: expedition 或 memory, id }` 的可辨识引用。新建／导入是独立入口，不强行要求已经存在的 expectedHead。

UI 只传玩家选择的 ID，不传本应由规则决定的最终奖励、升级后面、敌人剩余血或已成功判定。新档入口接受正式 profileId；现有可注入 initial funds/inventory 的开发能力不向生产新档开放。

### 7.2 命令清单（目标名称，尚未实现）

| 命令 | 输入要点 | 成功事务／拒绝条件 |
| --- | --- | --- |
| `create-save` | profileId、目标包；可选有效二周目来源 | 建新 save/epoch；不覆盖源档；不可注入任意资产或开放名单 |
| `import-save` | archiveVersion＋归档 | 识别原包、验证、复制与完整引用重映射；不做玩法迁移 |
| `start-expedition` | routeId、partyIds、四槽备包选择、装备实例引用 | 校验开放／成员／物品，补给与预留、冻结配置、创建 run 同时完成 |
| `battle-command` | runRef＋核心命令 | 对正确活动实例执行；不可调用内部敌方续步或伪造结果 |
| `choose-event` | runRef、roomInstanceId、choiceId、必要角色选择 | 校验位置、资格、代价；一次 RNG 与结果；已完成房间不可再次收费／领奖 |
| `advance-room` | runRef、当前 roomInstanceId | 只进入已合法解锁下一房间；不能越过必经事件或出口选择 |
| `choose-exit` | runRef、出口实例、leave／continue | 必须已通过该出口考核；保存选择；离开生成合法终局 |
| `use-item` | runRef、itemInstanceId、合法目标 | 同步效果、充能与本轮计数；时机／目标无效不消费 |
| `settle-expedition` | runRef、terminalRef | 仅接受正式终局；结算／返还／时钟一次；结算内容由权威状态计算 |
| `begin-memory` | chapterId | 无活动远征；创建独立模板与局部物资，不转移当下资产 |
| `retry-memory`／`leave-memory` | memory runRef | 重建失败片段或返回当下；不形成远征 wipe 与补给赔付 |
| `claim-chapter-result` | chapterId、完成凭证引用 | 当下一次性开放角色；若有场景选择先持久化，不让动画按钮授予能力 |
| `claim-growth` | growthId、事件完成引用 | 检查门槛与未领取；应用已定成长；活动 run 中拒绝 |
| `equip`／`unequip` | actorId、slot、equipmentInstanceId | 校验拥有、槽位、适用性与角色开放；原子转移归属；活动 run 中拒绝 |
| `claim-reward` | reward 凭证引用 | 校验容量、领取差量，不能自报数量；已领返回原结果或明确拒绝 |
| `resume-run`（内部） | runRef、保存游标 | 只完成已决定的结算后续；不代选事件、出口、道具或成长 |
| `undo` | runRef、可撤回边界 | 根据角色规则与检查点恢复本次影响，发撤回事实；跨永久领取／结算边界拒绝 |
| `ack-scene` | sceneId、已提交结果引用、展示游标 | 只保存演出／阅读进度；不可改变玩法结果 |

命令不要求一阶段全部实现：D1 只在角色定稿后建立必需契约，D3 接出征／房间／道具，D4 接首通，D5 接回忆／成长／装备。尚未支持的命令明确拒绝，不能 no-op 却返回成功。

### 7.3 失败与并发

- 同 requestId、同规范输入返回原回执；同 requestId、不同输入返回 `request-id-reused`。
- expectedHead 不匹配返回 conflict，刷新后由玩家重新决定；不把旧选择自动施加到新房间。
- 校验失败、无目标、资源不足、容量不足不扣款、不消耗、不前移 RNG、不写成功事实。
- 未知版本／缺内容／存储不可用均保留原档。存储事务失败不能先播放“升级完成”或“已到账”。
- 两个标签各用不同 requestId 同时领奖仍受业务 claim key 和 CAS 保护；只靠按钮禁用不够。
- 恢复只走已经确定的内部续步。现有六步循环上限不能盲目增大；到待选择节点必须停，另用有界批次完成长后续。

撤回必须恢复费用、道具计数、RNG 和战斗状态，并使相应事实失效；房间选择／永久领取是否可撤回由其契约明示。首发默认永久领取、已完成终局和首通结果不能跨边界撤回，不能留下角色已解锁而对应完成证据消失的记录。

## 8. 回忆、事实与未来 LLM

GameFact v2 保留 source head、世界时间、可见性和撤回关系；补 runRef、room／chapter 上下文。origin 增加 memory；导入来源由 originRef／导入元信息表达，不覆盖已有 adventure 或 memory 语义。无法识别的旧 imported 事实保持旧版隔离，不根据文案猜测来源。

| 事实类别 | 默认语义与可见性 | 允许用途 |
| --- | --- | --- |
| 当下冒险 | adventure，真实参加者或明确见证者可见 | 冒险高光、撤离／失败、维护反馈 |
| 回忆战斗 | memory；默认玩家可见，角色知情范围由作者声明 | 历史体验记录；不自动成为“今天攻击家人” |
| 回忆后的赠物／开放 | 当下结果；引用 chapter 完成凭证 | 角色页开放、当下互动、真实赠物 |
| 开发测试 | simulation | 不写普通角色记事，不送日常 LLM 上下文 |
| 隐藏判定／未选分支 | internal | 仅诊断，不给模型以免泄露未来信息 |

首通即便玛未在可操作队伍，也可以作为救离的作者指定见证者；不能把“party 可见”机械等同于所有剧情参与者都不知道结局。可见性扩展由脚本白名单授权，而非 UI 或模型随意添加角色。

AI 以后只接收已提交、可见、未撤回的事实和场景版本；不拥有奖励、成长、角色开放、事件结果或战斗命令权限。摘要、检索、提示词、调用路由仍归 rp-style-lab。当前本地手写反馈即可完整验收。

## 9. 角色、素材与待定资产核验

已对原讨论和当前规格核对六人面位、面名、命数、品质、花色；动作与成长奖励逐表复核，当前 36 面未改。六人初始醒数依次为凯 6、尤 5、艾 5、柯 3、诺 5、玛 4；每人初始金面一面；只有凯的可除锈与玛的永久锈。

| 资产 | 核验事实 | 下一步 |
| --- | --- | --- |
| 凯尔 | 已有 `src/assets/characters/portraits/kael.png`，已有 partyFigureCalibration；profiles 中未登记，未找到同名 avatars 文件 | D2 优先复用现有立绘；补头像裁切／映射与档案登记，不重新宣称整个人物缺图 |
| 玛丽埃塔 | 已有头像、立绘、纸娃娃分层，以及独立本尊 Boss 图 | 战斗／角色页分别标定，不拿本尊 Boss 图顶替日常资料 |
| 庄园普通怪／管家 | 现有透明图完整保留吊线 | 身体与线边界分开标定；举盘、屏风闭合状态另做可读表达 |
| 千金 | 只有整张透明立绘 | 餐刀排、可断吊线、化灰、沉睡／被接住方案 D4 前完成 |
| 回忆场地 | 本尊图存在；三张庄园背景不自动证明历史地点 | D5 脚本决定能否复用，或需补场景；不擅改历史 |
| 三背景／地图 | 11 张源图已归位，迎客门厅已作配色预览 | 在真实路线中接线；本轮不改比例／裁图／抠图 |

## 10. P 项收口状态与 D1 停止线

| 原 P 项 | 本轮结果 | 后续 |
| --- | --- | --- |
| P01 | 首通后完成回忆再开放玛亲征已由用户定稿；新档／二周目继承按既有契约 | D4/D5 落实叙事与进度，不重新调整开放先后 |
| P04 | 工程契约完成：新包新档、版本矩阵、无热迁移、导入引用映射 | 等 D1 获准后实施 |
| P14 | D0原候补排期已被2026-09-07修订覆盖：刻仪兽为维护／回忆最终Boss | 机制卡、脚本、版本承接与验收见总规格§9及D5计划§0 |
| P15 | 工程契约完成：memory 隔离、事实来源／导入保留、时间与见证者边界 | D5 实施与验收 |
| P12 | 五人 Lv.3 封顶与两件空面装备已定；既定凯尔团队里程碑随之可达 | Lv.2／3 获取细则待补，D5 实施 |
| P05 | 敌方阵位重排已定；初铭／现行参数、自动目标与排列策略待补 | 首发只要求两阶，不把 Lv.5 终铭作为前置 |
| P02／P03／P06／P13 | 其他规则细则保留原状态；玛专武／小件由两件装备范围排除出首发 | **本轮不进入 D1 代码实现** |
| P07／P08／P09／P10／P11 | 资产来源、失败范围、路线身份已落契约；数量、敌人卡、事件算法仍有明确落点 | D3/D4 细化，不因 D0 完成自动发布 |
| P16 | 核验现有资产及缺项，修正凯尔缺图口径 | D2/D4/D5 各自完成 |

D0 的工程契约保持不变，本轮三项产品选择已定稿并同步首发范围。其余机制细则按当前方向收口；随后用户授权实施 D1，完成范围以 D1 实施报告为准。
