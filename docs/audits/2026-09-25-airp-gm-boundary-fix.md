# GM职责交接与强制重复接单：context20修复

> 文档整理说明（2026-09-25）：下文按原实施日期理解；已删除的阶段引用改为文字，不改写当时的结果。原引用文件保存在文档索引列出的仓库外备份。

日期：2026-09-25。用户授权：核对两个问题的对应关系，修提示词和相关程序。不增加GM架构，不改文学预设，不开子智能体，不做视觉验收，不清档／提交／部署。

## 结论与原因

两个问题对应两个落点，并不是“GM写好了三句台词再让Gemini照抄”：

1. 工作稿原台词通过`requestReference/requestDefinition`进入正文，动机字段还是“依据原工作稿”的元指令，抢占了正文模型的事件表达。药箱首场逐字复现原稿三句有实际证据。
2. 场景GM的`complete=true`过去只结束offer；真实`participate`仍无条件新建acceptance，且下一阶段没有上一阶段评估。这是程序缺少“已满足的接单对白可省”接线，不是封装否决GM。旧S4报告offer-turn-1已经true，仍新建496字acceptance；S2报告（历史稿已清理）当时将该问题归为“只是文案偏长”，范围判断不足。

## 实现

- **新请求context20，旧版本不改。** 正式洋馆新帧自动升级；现存正文、失败重试、已经创建的旧帧仍按原版本。旧档原台词不会被换写。
- [事件输入适配](../../src/game-application/airp-director/event-brief-v20.ts)：只对三张首批工作稿及匹配sourceDigest使用事件资料投影：处境、剧情内动机、请求、限制、线索来源。去掉这些工作稿的成品对白／动作模板；原catalog和作者原件不变，不摘要人物卡和世界书。未知／已换稿的作者材料不会被该映射偷偷改写。
- 传话卡的核对解释只在实际对应反馈阶段进入`plannedBeat`，并明确“待演出而非已发生”；小景不预写玩家已坐下；药箱保留黄铜搭扣、空箱用途、残药限制和玛丽埃塔线索来源。实际层数／目标仍服从程序。
- [GM提示词](../../src/game-application/airp-director/scene-gm-v20.ts)只决定结束或续谈范围／软字数，不起草台词、语气或逐段排演；正常人物主动回应和必要结果反馈不是被禁止的“闲话”。正文不再被限定成问答客服。
- `coveredAcceptance: [{choiceId,basisSceneIds,reason}]`是同一次GM评估附带的条件性标记，仅针对当前offer紧邻的接单回应，不是通用跳步骤工具。
- [覆盖读取／应用条件](../../src/game-application/airp-director/acceptance-coverage.ts)区分未读、实际选择、事件实例／阶段／时段。必须读完相应文本、真实选择匹配、没有延后或阶段变化才应用。未提供／无效可选字段只保存诊断并保留正常回应，不把有效正文硬拒掉。
- [推进](../../src/game-application/airp-director/reducer.ts)仍先保存真实选择和decision事实，再省略已覆盖acceptance；保存`narrativeSkips`回执，不伪造已读场景。不自动出征／交付／结算；未覆盖、拒绝、新问题及必要反馈保留原流程。
- 复用现有“任务已接下／下一步行动”出口，无UI另造。正常一轮仍为Gemini正文→DeepSeek中文封装→Sol GM，三次；被省略的一场零调用。

提示词顾问原答与取舍（历史稿已清理）。model-consult只影响上述交接措辞；没有代替用户确认文风。

## 真实药箱短链

隔离报告：[airp-cl-f-UGUJZh](../../dist/reports/airp-cl-f-UGUJZh/scene-gm-verification.json)。content24／context20／reader6；日程是固定药箱夹具，正文、封装和场景GM真实调用，不冒充日度GM／全副本验收。

| 场次 | 中文／段数 | GM与程序结果 |
| --- | --- | --- |
| [提出0](../../dist/reports/airp-cl-f-UGUJZh/offer-turn-0-cn.md) | 663字／21段 | GM原答true；原有首次回应规则保留一次态度机会，因此有效complete=false；next=null |
| [回应1](../../dist/reports/airp-cl-f-UGUJZh/offer-turn-1-cn.md) | 601字／18段 | GM true，并标记participate接单对白已覆盖 |
| 真实点击参与后 | 不生成acceptance | waiting-action／action／actionPhase=2，run=null，等待玩家出征 |

字数为非空白字符，含标点；续轮还含正文自带的narrator前缀，不冒充精准汉字数。实际覆盖依据、选择factID及应用phase见[回执](../../dist/reports/airp-cl-f-UGUJZh/narrative-skips.json)。只有两场实际已读，未捏造第三场、未自动获得物品或交付。完整隔离档重放与require-ready检查通过，零额外网络调用。

请求349～354，共6次游戏调用、失败0，账本348→354／500，返回用量149,140 tokens；顾问1次、6,559 tokens单计。未重抽稿、未手工强制第二轮complete、未改原玩家档。最后停在expedition-plan，没有继续出征。

## 文本审读：不宣称文学通过

新请求不再包含三句原工作稿台词或“以原稿为依据”的伪动机，完整卡书、r8条目、原Plan、采样仍在。

但本次仍有四项残留：

- 回应1仍重复安全叮嘱、继续告别，601字偏长。首次GM原答true被既有回应保护改false，但其next为空，下一轮没有软字数指导；本批保留旧首轮交互，不伪称GM软篇幅已验证。
- 首轮候选出现“点头应下、答应巡查”，超出态度标签；正文随后演成承诺。程序直到单独点击参与才接单，但叙事边界仍有问题。
- 正文自由补出木匠报价“三个银币”等未经事件资料支持的细节，不能因此写成权威商品或数值。
- 回应1的旁白里带有`narrator：`字面前缀。canonical回填保留了它，`restored=true`；本次没有更改提取器或旧版本回放。首场`restored=false`。没有证据把重复剧情归责于封装自由续写。

因此，本批修复的是工作稿成品对白的错误交接和额外acceptance强制生成；不是已解决全部文风、轮内重复、选项或提取显示问题。

## 技术验证

新增7项应用回归覆盖条件性省略、真实选择／无自动行动、过期／推迟／不同选项不生效、拒绝／新问题继续、可选字段宽容、全文资料保留、三张工作稿适配和存档重放；客户端10项通过，含真实hook省略时不再发模型调用及阶段出口。

第一次合跑24项断言全部通过，但发生Vitest `onTaskUpdate`通信超时，进程退出1；该轮不算干净通过。随后低并发分批复跑：旧14～19 GM 13项、context20与阶段多轮11项均退出0；加上客户端10项，本批34项不同用例干净通过。保留该基础设施失败记录，没有修改测试断言或加全局超时掩盖它。

core／application／app类型检查、模块边界、r8冻结基线及34条目逐字节检查通过。未更改tooling配置或全项目其他施工。

`build:game`与`check:output -- game`通过：815文件、146.71 MiB，仅既有大chunk体积警告。私有Key／Base URL标记扫描命中0；没有上传或发布。原context18真实短链以`--check-only --require-ready`只读复验通过；本批8份文档的本地链接无错误，两个相关验收脚本语法检查通过。
