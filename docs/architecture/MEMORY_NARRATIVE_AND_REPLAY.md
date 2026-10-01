# 记忆：事件、幕、切片与只读回想

更新：2026-10-02。教程、正式 AIRP、商店初见共用 **事件 → 幕 → 切片**。本文维护现行数据与来源边界；视觉交互见[记忆 UI 规范](../design/MEMORY_PANEL_UI.md)。公共记录是存档事实的只读投影，不是新的存档协议或剧情执行引擎。

## 1. 公共记录

实际类型以 [memory-narrative](../../src/game-runtime/memory-narrative.ts) 与 [memory-journal-types](../../src/game-runtime/memory-journal-types.ts) 为准。`NarrativeRecord` 为 `{ schemaVersion: 1, kind: "record", events }`；这里的 1 不等于游戏存档、规则或内容版本。

| 层级 | 当前字段 | 职责 |
| --- | --- | --- |
| 事件 | id、definitionId?、title、summary?、sequence、startedAt、lastRecordedAt、participants、acts | 一次经历的稳定归属与发生顺序 |
| 幕 | id、definitionId?、title、phaseLabel?、coverage、replay、startedAt、slices | 可选择的阅读／回想起点 |
| 切片 | id、definitionId?、recordedAt、presentation、steps | 幕内连续小演出，可含多句对白、局部转场和真实操作回执 |

`id` 表示实际发生实例，不取标题、日期或显示幕号；`definitionId` 可指向同一编排模板，重复发生仍有独立实例身份。`phaseLabel` 是可选阶段文字，不增加“半场”父层，不凭阶段、地点或程序步骤自动生幕。

`coverage` 为 partial／complete／unknown，描述收录完整性；`replay` 为 scene／text，按幕计算。某幕只有文字，不影响同事件其他幕回想。时间为实际来源的 day／phase，未知为 null；事件可以跨日，筛选使用已收录日期交集。

## 2. 切片内容与冻结舞台

| steps.kind | 数据 | 消费方式 |
| --- | --- | --- |
| content | frames | 顺序读取 dialogue／narration／direction／chapter，保留原正文与逐帧来源 |
| choice-result | id、choiceId、optionId、label、source | 显示实际选择，不提供重选选项 |
| receipt | id、operation、items?、moneyDelta?、outcome?、source | 显示实际鉴定／出售／购买／战斗结果，不重复执行 |

一个切片可按 `content → choice-result → content → receipt` 组织，steps 不新增叙事层。零笔购买不补购买回执，购买建议不等于交易事实。多笔操作保留各笔来源，即使显示层汇总，也不能丢掉原始凭据。

`presentation.surface` 为 adv／counter／text；`presentation.opening` 为切片起始舞台快照。`frame.scene` 可保存内部变化后的完整快照，`frame.stage` 保留人物演出提示。可回想内容须能从所选幕独立恢复背景、人物与状态；缺少可信舞台时保留文本能力，不猜背景或人物位置。

## 3. 来源与可见性

每句正文、选择和操作保留 `MemorySource`：kind、saveId、epoch、revision、factId、sceneId、lineId，跳过教程参考另带 `acquisition: "tutorial-skip"`。原 sceneId 是来源，不能改成显示幕号或新幕 ID。

- 核对事实所属存档、版本、提交成员、撤回和实际分支后才进入投影。Schema 校验不能单独证明已经读过或已经交易。
- 未读正文、候选选项、导演私有信息及未来幕名称／数量不进入记忆，部分读完只收录可证明的前缀。
- 正文已读、知识解锁与业务操作完成分别判断；鉴定收费成功不能证明鉴定台词全部读完。
- 正文和既有选择保持原文，只有事件概述负责总结，浏览时不调用模型改写旧记录。
- 来源身份确定后，排序或改标题不能改变其 ID。

## 4. 三类内容的组织

| 来源 | 事件 | 幕与切片 |
| --- | --- | --- |
| 教程 | 「还没吃完的早饭」「赶在午餐前」两个目录事件 | 按早餐／消息／动身、岩窟与返馆等明确编排组织；连续原节点组成切片，小节和战斗程序阶段不自动成为幕 |
| AIRP | 实际事件实例拥有稳定 eventId，重复事件与后续实例分别有身份 | 按保存的程序场景角色、行动索引和真实尝试标记归属；续轮保留各 job／line 来源，生成重试不新增一场经历 |
| 商店 | 完整初见是一事件，旧四句招呼保留真实历史来源 | 开箱、鉴别、去留、补给、托话按叙事归属拆幕；实际分支成为选择结果与正文，交易成为回执，8个程序阶段不自动变8幕 |

格式器负责正文帧，归属由程序适配与明确编排维护，不能靠标题关键词推断叙事身份。尚无充分标记的旧来源采用保守组织，不能临时虚构玩家选择或未来幕。

普通物品鉴定仍在专用鉴定记录。当前本地阅读游标不构成正文已读凭据，因此不凭收费事实补造通用记忆正文。

## 5. 统一开局与教程跳过

正常新档四个起点（序章、清晨、教学、自由行动）使用内容28；无 LLM 和商店初见测试属于调试入口，使用内容27。新起点事实带 `openingFlowVersion: 1`，教学完成或明确跳过后在同一档案进入正式 AIRP。

跳过用开局事实解锁两个教程参考事件，标注 tutorial-skip，只收录作者参考，不补默认选项、胜利、购买或交付。自由行动跳过完整商店初见，普通鉴定文本仍保留；商店初见调试用于查看完整演出。六人正式剧情名单包括原四位队员、艾比希斯与玛丽埃塔，剧情初始化不等于解锁战斗编队。

完整开局／安全恢复规则见 [runtime 入口](../../src/game-runtime/README.md#当前入口与版本) 和 [教学恢复合同](TUTORIAL_RULES_AND_RECOVERY.md)。

## 6. 查询与旧版本

[memory-journal-view](../../src/game-runtime/memory-journal-view.ts) 验证真实存档，组合固定剧情、跳过参考、教学、商店、Director、早期事件池及远征来源。复制／升级延续可核对的时间域，二周目开始新时间域；早期未完整保存正文的来源明确报告限制。

查询返回 ready／unavailable，局部来源失败记录 issues，其余已核对事件继续可读。真实空目录与来源不可用分开。`MemoryEntry.narrative` 承载统一结构，`blocks` 是兼容文字投影；[narrativeActBlocks](../../src/game-runtime/memory-narrative.ts) 由同一幕步骤生成详情原文，避免回想与文字各维护一份分支。

旧存档按原事实重建展示，不覆盖旧 AVG JSON、不放宽旧 reader、不自动迁移内容包。新方案不能追改已经冻结的模型输入、正文或结算。

## 7. 回想隔离

[MemoryReplay](../../src/game-client/memory/MemoryReplay.tsx) 与 [memory-replay](../../src/game-client/memory/memory-replay.ts) 只消费已收录展示记录，不挂载主动剧情组件，不执行选择、交易、奖励、教程或 AIRP 命令，也不请求模型。

按所选幕从冻结舞台起播，真实选择只作为历史结果展示。切片切换不默认重放完整入场动画，原演出提示按来源处理。缺失舞台或不支持的表现保留文本回看。

打开回想冻结本次记录，新追加内容不挤入当前播放；来源撤回／改写或档案身份变化结束旧回放。结束后恢复事件、所选幕、展开状态、滚动位置与焦点，不改变真实阅读游标或资产。

## 8. 规范附件与验证入口

[记录 Schema](memory-narrative/narrative-record.v1.schema.json) 和 [教程](memory-narrative/tutorial.record.example.json)／[AIRP](memory-narrative/airp.record.example.json)／[商店](memory-narrative/shop.record.example.json) 示例作为设计校验资料保留。示例的 demo-save／demo-epoch 及交易数字不是玩家事实；运行实现以 TypeScript 类型、来源适配和应用验证为准，运行时不加载这些附件。

[商店编排示意](memory-narrative/shop.definition.example.json) 是讨论中的 definition 协议示例，未成为可执行接口。现有 parseAvgStory 拒绝未知字段，不能把示例中的 contentRef／handoffRef 直接加入旧脚本或交给模型执行。

有效回归入口：

- [查询测试](../../src/game-runtime/memory-journal-view.test.ts)、[结构测试](../../src/game-runtime/memory-narrative.test.ts)：真实来源、分支、跳过与兼容投影。
- [分幕界面测试](../../src/game-client/memory/MemoryActs.test.tsx)、[回想测试](../../src/game-client/memory/MemoryReplay.test.tsx)：选择、只读能力与退出恢复。
- [浏览器流程](../../tests/smoke/memory-journal.spec.ts)：正式查询与回想接线；发布证据见[10-01审查](../audits/2026-10-01-airp-memory-release.md)。

旧四层叙事讨论、多轮咨询和实施采样已保存到[文档审计](../audits/2026-10-02-documentation-audit.md)列出的外部备份，现行合同只维护此三层结构。
