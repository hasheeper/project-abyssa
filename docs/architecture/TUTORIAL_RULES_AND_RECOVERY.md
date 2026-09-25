# 第一章教学：规则、存档与恢复

核对：2026-09-25。本文归纳当前代码的教学合同，取代分散阶段计划中的现状说明。教学内容和G5待办见[第一章说明](../design/CHAPTER_ONE_AND_TUTORIAL.md)；历史Catalog及测试保留，不因文档整理修改冻结规则或存档。

## 1. 版本与默认入口

| 内容版本 | 教学／阅读合同 |
| --- | --- |
| 7～10 | 四房、旧七段剧情；8／9增加离线AIRP，10显式在线。旧包定义及摘要保留 |
| 11 | 继承9的离线卡池；四战＋E1五房、`tide.guide.v1`，G4七场正文 |
| 12 | 章一定稿旧档；继承11、`tide.guide.v2`、诺玛E1、六场中文定稿，归来序列仅S3-5／S4-1 |
| 13 | 单层商店教学旧档；继承12，首战金币与Boss战利品，独立持有／鉴定／出售事实 |
| 14 | 四层结构的冻结基线；四层五房、`tide.guide.v3`，按层独立结算，Boss在第4层 |

内容17加入铜G和四批教学物，25／26接真实设施库存，27／28接周款与施工；当前普通默认27／正式AIRP28。以上沿用规则4／应用协议4，`guide`保存结构的`version: 1`不等于计划ID中的v1／v2／v3，也不等于内容版本。

当前新档、旧档升级和首晨续接是三个不同入口：[player-runtime.ts](../../src/game-runtime/player-runtime.ts)的普通新档为27，正式AIRP为28；`continueSave`默认目标9、显式8／9／10；旧首晨按来源证明分别续接内容6或7。不存在把活动旧档原地升级到11／12／13／14的默认操作。

## 2. 权威状态与操作

当前四层依次为T1、T2＋E1、T3、T4；E1留在第二层。层内房间下标不等于教学遭遇序号，检查点和证明必须同时对应正确楼层与房间。每层完成后正式结算，再允许继续前进；结构与回归见[四层修正记录](../audits/2026-09-20-tutorial-four-layers.md)。

教学由core状态机执行，UI不计算奖励、掷骰或凭动画授予进度。定义见[状态类型](../../src/game-core/session/tutorial-types.ts)、[执行器](../../src/game-core/session/tutorial-engine.ts)、[带做门禁](../../src/game-core/session/tutorial-guide.ts)和[重放校验](../../src/game-core/session/tutorial-validation.ts)。

- Campaign进度：`pending`、绑定run的`active`、有原因的`exempt`、带终局／领取／货物证明的`completed`。
- 教学run阶段：`story → active → story`，失败进入`failed`；最后归来剧情读完进入`claimable`，不自动领取。
- run保存attempt、故事游标、选择与已读场景、真实教学事件证据、整章entry和当前checkpoint；guide保存计划ID、游标、proofs及退出证明。
- `tutorial-read`校验当前storyId／step／合法choice；`tutorial-observe`绑定planId／attempt／stepId／basis；不能用过期页面推进。
- `tutorial-guide`的明确退出写入真实退出状态；提示框收起只是显示状态，不等于这个命令。
- 业务命令仍经过应用事务、expectedHead、requestId与fingerprint校验；失败重试使用原身份，不另发奖励或重跑已提交随机结果。

首晨和章一的节点内分页是表现状态；重载可能从当前持久节点第一页重读，不意味着重做玩家选择。原始阅读游标与分页状态不可混为新存档协议。

## 3. 五房、随机与事件

固定编队为玩家、尤斯缇丝、艾洛拉、柯萝萝、诺玛；原教程配给与四战敌群继续由版本Catalog决定。四战之间增加E1，不把独立事件当成战斗剩余骰。

- 首战seed 8267继承内容7；内容11／12后续战斗与带做计划按[guide定义](../../src/content/gameplay/demo-v11/guide.ts)固定。
- 内容12专门设置E1事件seed 7，`E1.attempt`要求诺玛，证据为strong单人判定、cost 0、reward 0及room-completed；这是版本化规则，不是UI代选或通用多人玩法。
- E1不治疗、不补给、不额外奖励。普通战斗和事件各用原有RNG／证据路径，不从前一场已展示骰子虚构结果。
- 内容12删除旧S4-2业务槽并改变返程序列，旧11仍保留旧序列；差异见[内容12定义](../../src/content/gameplay/demo-v12/content.ts)。

## 4. 失败、撤回与恢复

本场重试恢复当前checkpoint；整章重来恢复原entry。两者均要求当前failed阶段与匹配attempt，使用原合同保留／重建对应guide、证据和资产身份，不靠页面重置模拟新局。

UNDO同时恢复可撤回窗口中的教学证据及guide；不能跳过随机／阶段推进的原有撤回边界。保存后的故事、战斗、事件与领取均按同一身份恢复；未知版本、错误计划ID和不一致证据应拒绝，不通过放宽reader来迁移。

新游戏跳过由[game-start.ts](../../src/game-core/session/game-start.ts)写真实起点选择，不补剧情分支、胜利、货物或通关奖励；跳到hub使用`player-skipped`豁免。旧冒险档的`pre-tutorial-save`豁免与玩家主动跳过是不同来源。

## 5. 结算与隔离

内容14的历史路线为四层4／5／20／12旧单位＋返馆8，共49旧单位；内容17起改为铜G，当前标准带做3,600＋800＝4,400 G。旧档不改写数值或事实。每层重置散金和牌型累计；层深倍率为1／1.25／1.5／1.75，其他倍率照普通规则。

教程与庄园成长奖励隔离。内容13标准带做路线为13散金，清层43 G加返馆8 G，共51 G；旧11／12仍为36＋8＝44 G。三类追回货物（草药、古籍、旧毛毯）属于归还证明，不可出售；旧毛毯沿用内部ID `cargo.workshop-parcel`。具体值来自Catalog和真实终局证明。

内容13在Boss房完成时生成唯一实例并记录`loot-found`。`carriedLoot`纳入checkpoint／entry校验；仅完整通关把同一实例带到`returnedLoot`，领取与金币一起写入Campaign `loot`。实例由run／grant身份稳定产生，重放、重试和导入不重发。随后`appraise-loot`与`sell-loot`按服务端内容报价原子变更资金及持有状态，`lootTrades`保留结果和成交记录。收获提示、听下一句、收好和回看仅为阅读操作，不创建普通活动剧情。详见[SHOP 日期货架与交易合同](../design/SHOP_SCHEDULE.md)。

S4-1读完只到claimable；玩家手动领取后一次入账、一次相位推进及完成证明。重复点击、刷新或原身份重放不能再次领奖。失败与重试不按普通团灭策略私自改写教程checkpoint；不在文档里另发补给或添加新的结算方式。

## 6. 验证入口与变更要求

- 版本／规则：[内容11](../../src/content/gameplay/demo-v11/content.ts)、[内容12](../../src/content/gameplay/demo-v12/content.ts)、[tutorial测试](../../src/game-core/session/tutorial.test.ts)、[G2测试](../../src/game-core/session/tide-guided-g2.test.ts)。
- 原文与阅读：[章一逐句测试](../../src/content/presentation/chapter-one.test.ts)、[首晨原文测试](../../src/content/presentation/first-morning-json.test.ts)。
- 教学结构证据：[四层修正](../audits/2026-09-20-tutorial-four-layers.md)。现行流程见[第一章与教学](../design/CHAPTER_ONE_AND_TUTORIAL.md)；历史测试数字不作为后续商店功能的验证证据。

变更演员、事件seed、业务场景序列或领取条件须核对版本化契约，不能改旧包假装兼容。修改显示文案须区分运行时JSON、正式原稿与待审编辑副本；本次整理不回填或润色任何剧情。
