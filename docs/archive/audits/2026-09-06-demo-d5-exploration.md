> 历史档案：2026-09-07文档整理时归档。原路径：`docs/audits/2026-09-06-demo-d5-exploration.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# D5 回忆、亲征解锁与成长配装：源码勘探

日期：2026-09-06。性质：**规划前只读审计，未实施 D5**。

执行计划：[D5 详细计划](../plans/DEMO_D5_MEMORY_AND_GROWTH_PLAN.md)。上位范围：[D0–D6 总计划](../plans/DEMO_CHARACTERS_AND_OLD_MANOR_IMPLEMENTATION_PLAN.md)；既定规则：[DEC-01～03 与 D1 实施口径](../design/DEMO_CHARACTER_RULES_REVIEW.md)。

## 1. 当前结论

D4 已提供可以接续的首通凭证、五层与维护路线、严格版本化存档、可恢复短剧情和原战斗界面。D5 的角色六面、四约两阶、成长解析及装备改面也已有基础。

但 **D5 不是取消玛的禁用状态、加几个按钮就能完成**。缺口集中在：有实际战术收益的自动重排；独立于当下远征的历史运行状态；可验证的篇章／成长／赠物凭证；装备库存和装配所有权；由这些记录推导的开放与页面能力。必须同时补严格校验和正常玩家路径。

## 2. 审计依据与证据边界

- 本轮直接阅读 contracts、battle、session、application、runtime、client、角色页、AVG 组件、内容装配及相关测试源文件。
- 对照 D0、D1 实施口径、D4 计划及实施报告；对照原讨论文件中回忆模式与本尊美术的先后效力。
- D4 报告记录的 879 项测试、66 项构建契约、40 项浏览器回归属于前一阶段证据；**本轮没有重新运行游戏测试，也没有验证尚未实现的 D5**。
- 工作树含 S0–D4 大量未提交改动；本轮只新增／更新 Markdown，不重置、提交或整理这些源码改动。
- 未发现适用的 `AGENTS.md`。不启停用户的 5190 服务，不进入 rp-style-lab。

## 3. 逐层发现

| 编号 | 源码事实与落点 | D5 影响 |
| --- | --- | --- |
| A01 | [完整庄园装配](../../../src/content/gameplay/demo-v1/manor-full.ts) 从三层数据复制后发布 `abyssa.demo@1 / rulesVersion:3`；仍继承玛的 `dossier-only` 与初始五人名单 | 不能改已发布的共享表、digest 或直接将玛加入旧 profile；需新的明确发布版本 |
| A02 | [Demo 契约](../../../src/game-core/contracts/demo.ts) 的 covenant pattern/effect 仅有四种；成长十项和两件装备定义已经存在 | 玛的自动铭约没有实现，不能把 `covenant.marietta` 当可执行引用注册 |
| A03 | [引擎 `reorder`](../../../src/game-core/battle/demo-engine.ts) 只替换 `encounter.formation` 并再次校验；未开放玩家命令 | 已有排列原语的雏形，但没有策略、移动预算、事件、表现和业务来源，不等于完整能力 |
| A04 | 同一引擎 `end-turn` 先冻结 hand 与 enemyOrder，再执行铭约；[四约解析](../../../src/game-core/battle/rules/v2/covenants.ts) 顺序为尤→柯→诺→艾 | 玛不能给已用顺劈补算伤害；若放在收束末尾，收益发生在后续玩家回合。重排不得改冻结敌方队列／游标 |
| A05 | [牌型求值](../../../src/game-core/battle/rules/v2/hand.ts) 与[存档校验](../../../src/game-core/battle/rules/v2/validation.ts) 都把 `fullHouse` 定为严格 3＋2 | 如 D5 接受五有效骰的四条／快艇宽判，必须新增明确的铭约条件并同步校验，不悄改旧版经济牌型含义 |
| A06 | [成长配置](../../../src/game-core/battle/rules/v2/configuration.ts) 已实现 Lv.2 醒面／变金、Lv.3 现行、两人三级后凯尔面4变金；装备改写全部原生空面 | 规则解析可复用，不需要重做36面。凯尔里程碑来自成长推导，额外事件只能作证据，不能再改一次战面 |
| A07 | [Demo Campaign](../../../src/game-core/session/demo.ts) 强制 `progress` 等于 profile 初值；亲征可用性仍读 profile.availableCharacterIds | 外部伪造升级当前会被正确拒绝。D5 应以合法领取记录替代“只能等于初值”的限制，不能删除限制而没有新证据链 |
| A08 | 同文件仅有 `{kind:expedition}`，snapshot 仅有 expedition；时钟和资金按 ordinary settlements 验证 | 将回忆塞进普通远征会误走时间、补给、金币、失败与维护资格链。需要互斥的 memory 运行状态和专属终局 |
| A09 | [DemoProgress](../../../src/game-core/contracts/demo.ts) 的 equipment 每项必须有 ownerId；[校验](../../../src/game-core/battle/rules/v2/configuration.ts) 只接受最多两项已装配记录 | 没有“已拥有但未装备”的库存表达，无法仅靠现有数组完成赠物→卸下→转移；需要一份权威实例库存及唯一归属 |
| A10 | [应用命令／事实](../../../src/game-application/versions/demo-contracts.ts) 仅支持远征、庄园故事确认；origin 为 adventure/simulation，runRef 仅 expedition | 回忆、成长、赠物、装卸、二周目没有入口；新增命令必须有严格 parse／receipt／fact／archive 对应，不得返回空成功 |
| A11 | [首通状态](../../../src/game-core/session/manor-progression.ts) 与[首通历史校验](../../../src/game-application/versions/manor-history.ts) 能验证 takeover／story／terminal | 可作为 begin-memory 的前置证据；不能把 takeover 当作亲征解锁证据 |
| A12 | [导入重定位](../../../src/game-application/versions/demo-import.ts) 已处理普通run、敌人、召唤来源、意图、首通和故事引用 | D5 新增 memory attempt、chapter completion、grant、equipment、成长资格及继承来源，也要完整重定位；导入不能变成重新领奖 |
| A13 | [runtime 注册](../../../src/game-runtime/catalogs.ts) 只接受1／2／3；[查询](../../../src/game-runtime/versioned-views.ts)、[角色档案](../../../src/game-runtime/character-views.ts) 仍读静态 profile 开放名单 | 出征、角色页、地图和恢复必须共享一份动态开放投影，不能只更新其中一页。展示 DTO 的 version:2 不等于命令协议号 |
| A14 | [导航](../../../src/game-client/navigation.ts) 与[会话恢复](../../../src/game-client/session.ts) 使用 expeditionId；[pending request](../../../src/game-client/versioned-pending-request.ts) 校验远征／庄园故事身份 | memory 必须带 run kind，旧 URL 要兼容；错误种类或旧 attempt 的请求不得落入当前回忆或普通远征 |
| A15 | [角色页](../../../src/apps/character-status/App.tsx) 使用[只读会话](../../../src/game-client/read-session.ts)，现有骰装交互是检查详情 | 需要在既有布局加受查询授权的领取／装卸动作；不要把整个只读 reader 改成会自动续步的战斗 session |
| A16 | [AVG 页面](../../../src/apps/novel/App.tsx) 是本地场景预览；[VisualNovelScene](../../../src/shared/ui/patterns/VisualNovelScene.tsx) 游标在组件内，没有受控恢复输入 | 不能把 demo 的 onEnd 当奖励事务。可复用原视觉组件，补受控行游标／推进能力；正式入口仍须有存档身份 |
| A17 | [角色记事投影](../../../src/game-application/character-history.ts) 当前只排除 simulation，尚无 memory 分类 | 加 origin 枚举不够；必须修改投影白名单、分组与当下反馈，防止“历史交锋”变成“今天攻击家人” |
| A18 | [庄园结局文案](../../../src/content/presentation/manor-conclusion.ts) 最后一段明确说回忆与亲征未开放 | 新版需按能力改文案，旧包保留原含义；不能全局替换后让旧档显示假入口 |

## 4. 需要在计划中正面解决的机制问题

### 4.1 重排不天然产生战术价值

当前敌人可以逐个直接点选，顺劈只有玛的两个面。纯粹交换敌人图卡，如果没有邻接收益或本尊的阵位机制，就是有动画而没有规则差异。

玩家玛的建议用途是把容易被2＋1顺劈带走的敌人靠拢，持续至死亡收拢或下一次合法重排。本尊侧则需要自己的阵位关联机制；历史队伍中不应为了展示顺劈塞入“正在被挑战的玛”。详细候选见计划第4、5节。

### 4.2 自动策略不能偷看下一轮骰

铭约在本轮末触发，下一轮骰还没掷。策略必须只读此刻存活敌人、公开 HP／意图／阵位，不能按未来骰面、隐藏 RNG 或不存在的“理想连击”选排列。初铭与现行应有可解释差异，候选集包含不移动，避免为了演出强行抖动。

### 4.3 冻结队列与新阵位必须同时成立

已生成的 intent ID、目标、格挡和 enemyOrder/cursor 都不能因图卡换位置而重建。本轮执行仍按原队列；下一轮才按新规则生成新的快照。顺劈一次命令锁定的邻居不被后来的重排追溯替换。

## 5. 历史文本与美术边界

旧讨论文件明确方向：重现凯尔过去与本尊的交锋，固定历史队伍，失败作为重试，不重写历史；曾用《王座前的提线魔女》作篇名。本轮用户补充“就是勇者小队”，计划已按凯尔＋尤斯缇丝、艾洛拉、柯萝萝、诺玛五人落定历史队伍。历史模板参数、场地表现与结局逐句脚本仍未定稿。

[庄园美术稿第6节](../../design/OLD_MANOR_DESIGN.md#6-玛丽埃塔本尊原回忆boss美术归档) 还明确指出：旧稿“魔王城礼仪回廊”不能因为现有庄园背景方便而自动改成旧庄园。旧讨论中“冷酷、残破”的外观也已被新稿“零伤痕、一尘不染”覆盖。

已有 `marietta-memory-boss.png`；没有已确认为历史礼仪回廊的正式背景，也没有本尊重排的独立指尖／红线图层。可以做原UI内的位移与线条演出，但不能把现有千金的救离、断线、碎刀死亡演出套给本尊。D4 缺图授权针对千金沉睡／抱起，不自动等于同意改写 D5 历史场地。

## 6. 工程建议与排除范围

1. D5 使用显式新版规则／存档，旧1／2／3继续严格读取；为D4已结算档设计安全复制升级入口，不隐式改原档。
2. 先完成机制卡与固定历史模板，再接 memory 状态；复用纯战斗规则，不复制第二套引擎或战斗页面。
3. 成长、解锁、装备由业务凭证推导；一份唯一库存负责归属，角色配置是投影。
4. 复用 IndexedDB、CAS、幂等回执、严格导入和D4深冻结查询边界；不新增全局事件总线、第二存档库、通用任务平台或LLM管线。
5. 普通成长片段可以继续使用本地AVG／既有弹层；新增交互适配原组件，不更换配色、边框、五枚羁绊晶石、三格私约、骰盘或动画时序。

这份审计只证明规划依据与现有缺口。D5 的机制、剧情、自动测试、配平和浏览器效果均未实施或验收，不能沿用D4的通过数量冒充D5结果。

本轮文档收尾检查：六份新增／更新文档的本地链接均可解析；对照规划开始时的1051个非文档源码／配置／测试文件哈希，没有变化。游戏样式与运行代码未修改。
