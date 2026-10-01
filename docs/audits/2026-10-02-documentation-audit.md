# 文档审计：现状漂移、过程材料与保留来源

日期：2026-10-02。基线为工作区 `4f6b126`，包含本轮尚未提交的代码清理。第1～6节保留清理前勘探结果，统计在新增本报告前完成；执行结果见第7节。已退出活跃目录的链接改为历史路径，原件可从外部备份追溯。

## 1. 结论与范围

现在最需要处理的是两个问题：正式入口文档没有跟随开局、记忆和发布迁移更新；记忆界面的多轮施工材料仍与现行规范混放。

| 范围 | 结果 |
| --- | --- |
| 全仓 Markdown | 212 份，其中 60 份未跟踪 |
| docs | 147 份 Markdown，全部附件合计 404 个文件 |
| 记忆与统一叙事材料 | 58 份 Markdown、287 个文件、29,054,878 bytes，约 27.7 MiB |
| 本地链接 | 960 条，3 处失效源码链接 |
| 重复内容 | 8 组生图交付文件完全重复；动效截图另有 6 组重复帧 |

记忆材料包含当前设计、结构合同和用户参考图，不能把上述 58 份全部判为无用。合适的收敛目标是：**一份现行 UI 规范、一份叙事／数据／回想合同、一处参考图来源**。阶段说明、咨询调用记录和旧动画采样退出活跃目录。

本轮建立了文档链接图、Markdown 与附件摘要，并核对 src／scripts／tests／config 的 1774 个代码文件。没有发现代码导入记忆过程目录；文档之间的互相链接较多。没有入链只作为辅助证据，清理判断以内容是否独特、是否被替代及是否为运行输入为准。

## 2. 明确过时、应更新的有效文档

### 2.1 开局与版本：多处仍描述已经取消的独立 AIRP 入口

真实依据：

- [NewGameDialog](../../src/apps/title/NewGameDialog.tsx:13)：正常入口只有序章、清晨、教学、自由行动；无 LLM 和商店初见属于调试项。
- [player-runtime](../../src/game-runtime/player-runtime.ts:92)：正常新档内容 28，调试项内容 27；旧 AIRP 别名只承担历史创建恢复。
- [runtime README](../../src/game-runtime/README.md:7)：已经维护统一开局、教程结束／跳过后接 AIRP 的当前说明。

| 文档 | 现有错误／落后内容 | 建议 |
| --- | --- | --- |
| [项目 README](../../README.md:5) | 普通新档27／AIRP新档28的并列说明；发布段仍写首次基线 `14bf250` | 更新正常／调试入口，发布版本引用统一发布页 |
| [文档索引](../README.md:3) | 主线仍写普通27／AIRP28，缺记忆及统一叙事入口；把 HTTPS 与远端验收一并列为尚未实施 | 更新入口与专题索引，分开已发布与未完成验收 |
| [项目状态](../DESIGN_DECISIONS_AND_CURRENT_STATUS.md:7) | 独立普通／AIRP开局；没有10-01记忆与洋馆 UI 收口；仍称 `c7735a9` 为当前线上源码 | 以代码和最新发布记录重写现状、完成度及待办 |
| [机制总览](../GAME_SYSTEMS_AND_CONTENT_SPEC.md:53) | 正常起点仍列五项含 AIRP；Menu 说明缺 MEMORY；新角色初始化仍仅描述新日程前配置 | 更新开局、跳过记忆、商店首访例外和事件／幕／切片回想边界 |
| [LLM 与 AIRP](../architecture/LLM_AND_AIRP.md:9) | 入口表仍有独立 AIRP／快速体验；新角色接入描述落后；末尾一并称公网 HTTPS／跨域未验收 | 与当前装配一致；区分 HTTPS／OPTIONS 技术验证和真实模型生成、回退验收 |
| [教学恢复合同](../architecture/TUTORIAL_RULES_AND_RECOVERY.md:15) | 当前默认27／正式28的旧分流，没有统一开局和跳过后记忆来源 | 保留旧版表，更新当前入口及 `openingFlowVersion` 边界 |
| [第一章说明](../design/CHAPTER_ONE_AND_TUTORIAL.md:7) | 仍称普通23／AIRP24为当前新档 | 更新入口版本与教学结束后的正式 AIRP 接续 |
| [首晨实现](../design/FIRST_MORNING_IMPLEMENTATION.md:5) | 当前入口仍是27／28分流；当前段落只把首晨列为已迁移的共享选择界面 | 更新顶部当前行为；09-09／09-12历史结果保留日期语境 |
| [序幕 CG 实现](../design/PROLOGUE_CG_IMPLEMENTATION.md:7) | 普通起点默认27；已接入的章一仍在末尾待补列表中重复出现 | 清掉当前／待办矛盾，音频及动作素材缺口继续保留 |
| [AIRP 测试配置](../../config/AIRP_TEST_CONFIG.md:30) | 操作步骤要求点击已经没有的「AIRP 游玩」；调试说明仍提供内容18的新建入口 | 改为当前正常／调试路径，旧18只描述既有档恢复 |

工程层同样需要同步：

- [apps README](../../src/apps/README.md:17)：标题普通27／AIRP28及旧18调试入口说明落后。
- [Battle README](../../src/apps/battle/README.md:3)：仍将内容25／26及相应目录称为当前新档。
- [content README](../../src/content/README.md:11)、[core README](../../src/game-core/README.md:3)、[application README](../../src/game-application/README.md:20)：顶部当前入口还是旧分流。其规则、事务与兼容章节仍有用途。
- [client README](../../src/game-client/README.md:68)：刚补充的设置／RP清理说明有效，但末尾“当前内容边界”还保留普通27／正式28的旧开局说明；需要一起同步。
- [内容28 README](../../src/content/gameplay/demo-v28/README.md:5)：新角色说明只写新日程前配置，未覆盖教程后自动初始化和安全恢复。
- [AIRP 兼容入口](../plans/AIRP_4_IMPLEMENTATION.md:3)、[叙事入口](../plans/AIRP_NARRATIVE_DEMO_PLAN.md:5)：仍把26称为当前内容。
- [旧庄园设计](../design/OLD_MANOR_DESIGN.md:5)：导语仍写“当前默认内容3”。应改为历史适用范围，保留作者设计与裁决。

### 2.2 发布状态有三种不同的“当前”

项目 README 写 `14bf250`，项目状态页写 `c7735a9`，而[统一发布页](../deployment/AIRP_STATIC_HTTPS.md:5)记录10-01最新运行源码为 `7fcfce1`，并有部署 ID、清单 SHA 和后续文档提交的区别。

本轮没有查询外部部署状态。结论是仓库内说明互相冲突；整理时以已核对的发布证据为来源，首页和状态页只保留短摘要与链接，发布台账由一页维护。

### 2.3 记忆计划在多个时间点混写

| 文档 | 具体矛盾 | 去向 |
| --- | --- | --- |
| [UI 设计稿](../design/MEMORY_PANEL_UI.md) | 有效设计基准，但开头仍主要按 A／B 介绍；缺少最新图标、头像、分幕及旧来源边界的统一说明 | 保留并更新为现行视觉与交互规范 |
| 实施计划（已归档，原路径 `../design/MEMORY_PANEL_IMPLEMENTATION_PLAN.md:40`） | 前面仍建议“两行原文节选”、SystemTabs 和 embedded 参数，后面已经记录单行概述及 A／B／C 完成 | 完成内容并入现行规范，施工顺序和首轮几何退出活跃目录 |
| 时间带规划（已归档，原路径 `../design/MEMORY_TIME_RANGE_PLAN.md:3`）、时间带交付（已归档，原路径 `../design/memory-time-range-2026-10-01/README.md:3`） | 仍称真实查询待 B 接入 | 有效范围筛选规则并入 UI 规范，旧阶段状态不再单独维护 |
| 底栏交付（已归档，原路径 `../design/memory-footer-2026-10-01/README.md`） | 以暂未开放“回想场景”为本轮前提 | 最新页脚规则并入 UI 规范，交付记录归档 |
| 旧叙事讨论（已归档，原路径 `../design/memory-narrative-structure-2026-10-01/README.md:7`） | 场→半场→幕→切片，教程合并建议已被后续三层方案替代 | 退出活跃设计目录，保存讨论原件 |

当前源码证据是 [MenuPage](../../src/apps/menu/MenuPage.tsx:126) 的真实查询、[memory-narrative](../../src/game-runtime/memory-narrative.ts) 的事件／幕／切片、[MemoryReplay](../../src/game-client/memory/MemoryReplay.tsx) 的只读回想。

[情绪合同](../design/AVG_EMOTION_CUE_CONTRACT.md:83)末尾还在描述旧 Provider 短回复接口及“模型尚未配置”。上一轮已删除该无调用实现，[AVG JSON 合同](../design/AVG_JSON_AND_GENERATION_CONTRACT.md:78)已正确标为历史协议。应同步这段；情绪映射与校准正文继续保留。

## 3. 可退出活跃目录的过程材料

### 3.1 已被替代的方案与原型

| 候选 | 判断依据 | 建议处理 |
| --- | --- | --- |
| `MEMORY_PANEL_OPUS_55_V2/V3/V4/V6/V7.md`、`MEMORY_PANEL_OPUS_55_LAYOUT_REVIEW.md`、`MEMORY_PANEL_LAYOUT_REVIEW_2026-09-30.md`、`MEMORY_PANEL_UI_V7_REJECTED.md`，共8份 | 用户否定的构图与多轮咨询；已由三张参考图和当前实页替代；无代码消费者 | 原答和反馈保存到外部设计档案，活跃目录移除 |
| `memory-ui-v2/`，6个文件 | 未接线的旧 TSX／CSS 原型，与正式 MemoryPanel 分离；目录方向已否定 | 外部归档后移除，避免形成第二份 UI 实现 |
| `memory-narrative-structure-2026-10-01/`，8份 Markdown | 四层提案、商店试拆与咨询补稿；已有三层实装合同 | 只把独特裁决并入现行合同，讨论原件外存 |
| `memory-ai-handoff-2026-09-30/` | 生图前交付包、请求、状态和框架；已有最终用户参考 | 保留必要设计来源，去掉重复交付层和压缩包 |
| `docs/design/drafts/airp-flow/`，5个文件 | README明确是未接线参考代码；正式功能在 game-client | 归档原稿，移除活跃目录中的假实现 |
| 静态第三阶段计划（已归档，原路径 `../plans/2026-09-23-airp-static-phase-three.md`） | 248行旧施工计划仍写“尚未部署”和内容17／18；发布已经独立维护 | 剩余完整试玩、真实调用和回退待办并入状态／发布页，计划退出活跃目录；更新两个入链 |

生图包的外层与 `memory-ui-ai-reference-pack/` 有 **8组完全相同文件**：两份原答、提示词txt、咨询状态、框架json、渲染脚本、框架png、存档png。ZIP还携带同一交付包。这里有明确去重收益，不需要保留三层拷贝。

### 3.2 已完成阶段的小文档与派生附件

以下阶段目录的规则和结果可合并进两份现行合同。它们目前均无代码导入，主要互相引用：

- `memory-a-2026-10-01/`、`memory-b-2026-10-01/`、`memory-c-2026-10-01/`：A／B／C交付和多轮命名／概述原答。
- `memory-motion-2026-10-01/`：4份 Markdown、133个文件、约10.1 MiB，多轮 open／close／return 逐帧截图及JSON采样。摘要核对还发现6组重复帧。
- `memory-time-range-2026-10-01/`、`memory-footer-2026-10-01/`、`memory-participants-2026-10-01/`、`memory-icons-2026-10-01/`：局部施工、失败方案、布局研究HTML及阶段截图。
- `memory-opening-flow-2026-10-01/`：内容有效，统一开局说明应进入当前状态／开局合同，验证截图外存。
- `memory-implementation-2026-09-30/`：旧源码勘探、空咨询返回、裁切研究和请求记录。现在已有实际实现。
- `unified-narrative-syntax-2026-10-01/implementation/`：实施结果并入稳定叙事合同，截图和测试快照归档。

保留少量当前目录／详情／回想截图就足够说明界面；每次微调的全部采样帧、响应 JSON、临时原型脚本适合放在忽略报告目录或仓库外设计档案。

### 3.3 审计记录的合并候选

`docs/audits` 有31份 Markdown，不能按日期或篇幅全部删除：

- 日志排版实施（已归档，原路径 `2026-09-25-journal-layout-integration.md`）和Opus v3 原代码稿（已归档，原路径 `2026-09-25-journal-layout-opus-v3.md`）：已有正式组件和 client 布局说明。保留必要设计来源，原模型代码可移出活跃维护区；先处理两处文档入链。
- 洋馆 AVG 素材接线（已归档，原路径 `2026-09-25-mansion-avg-integration.md`）：无 Markdown 入链，资产来源／处理／映射规则可并入素材 README；阶段验证外存。
- 经济、普通掉落、货架、设施、委托实物等实施记录：当时版本与统计应保持历史语境。合同已有完整当前规则时可以归档；保留独特失败、恢复、来源和兼容证据，先更新所有入链。
- 09-17 开窗长帧和动效测量、GM-S4／池化／context21 的失败与实测记录：仍对应未完成质量或性能问题，应保留原条件，不能把新界面上线当作旧问题已解决。
- 10-01 的三份发布／恢复审查及10-02代码清理审计：与当前运行版本或未提交清理直接相关，现阶段保留。

## 4. 有实际用途的保留项

| 内容 | 保留依据 |
| --- | --- |
| [三张用户参考图及来源](../design/memory-journal-2026-09-30/README.md) | 用户明确要求保留原图；它们是当前方案的来源，保留图和SHA，压缩重复说明即可 |
| 统一叙事语法（已归档，原路径 `../design/unified-narrative-syntax-2026-10-01/README.md`） | 当前三层结构、三类场景和只读回想的有效合同；建议提升为稳定路径并加入索引 |
| `DEMO_DIALOGUE_VOICE_GUIDE.md`、`NON_LLM_PLAYER_AGENCY_CONTRACT.md` | generation-documents 直接 `?raw` 导入并冻结SHA；改写会改变模型输入 |
| `st/setting/`，包括 `airp_household_guidance.md` | 运行时的世界、角色和双库资料；文件不是普通工程日志 |
| 首晨09-12、章一09-15原稿 | first-morning-json／chapter-one测试直接核对作者原文 |
| 序幕、旧首晨、出发与旧庄园原稿 | 独特作者来源和设计裁决；可标清历史范围，不用当前实现覆盖原文 |
| `docs/baselines/airp-style-r8/` | preset运行导入、文风复现和基线校验；已知失败样本也是证据 |
| 双语实验提示词 | assess-airp-bilingual脚本直接读取；在实验脚本退役前不能删除 |
| 素材 README／ATTRIBUTION、archive编辑副本 | 来源、授权、校准、未决文案差异的唯一记录 |
| [多人骰子事件提案](../plans/MULTI_ACTOR_DICE_EVENT_RULES_AND_SAVE_CONTRACT.md) | 未实施但明确区分提案与现行规则；未发现后续方案将其替代 |
| `ABYSSA_DEMO_NEXT_STEPS.md`／`AIRP_4_IMPLEMENTATION.md`／`DEMO_PROLOGUE_AND_ONBOARDING_PLAN.md` | 几行重定向有来源兼容作用，文档声明存在相邻rp／原稿引用；本轮未核对外仓，先保留薄入口 |

相邻rp声明不等于本轮已经验证其引用。若要取消这些兼容路径，应先查外仓并更新消费者；当前只改过时的短导语。

## 5. 三处失效链接

1. [AIRP 阅读恢复](../architecture/AIRP_FLOW_AND_RECOVERY.md:45) → 已不存在的 `src/game-client/JournalAppraisal.tsx`。应指向当前 JournalEntries／JournalBrowser 的实际职责，不能只机械改文件名。
2. [设施实施](2026-09-25-mansion-facilities-implementation.md:49) → 已不存在的 `MansionFacilityPanel.tsx`。现由 MansionRoomDrawer／MansionFacilitySections 承载。
3. 同一设施记录第70行 → 已不存在的 `MansionFacilityPanel.test.tsx`。标明历史测试，提供当前测试入口或改为非链接历史记录。

最新代码清理审计中提到已删模块的文字属于明确标记的原始审计证据，不应当作悬空运行引用删除。

## 6. 建议实施顺序

1. 更新项目入口、状态、机制总览、AIRP／教学合同和测试操作步骤，使当前事实先统一；部署版本由发布页维护。
2. 收敛记忆 UI、统一叙事与回想合同，保留三张参考图及原文出处；把图标、头像、时间带、底栏、跳过来源与兼容规则合入对应章节。
3. 按逐文件清单、摘要和外部备份移出被替代稿件、重复包及派生采样。未跟踪文档同样进入备份清单。
4. 整理历史实施审计的入口关系；有独特失败或验收证据的记录保留或归档，已完成施工清单不再作为当前状态。
5. 运行本地链接／锚点检查；若触及运行时原稿、基线或原稿测试输入，核对对应SHA与消费者。

本地证据：`dist/reports/documentation-audit-2026-10-02.local.json`（逐文档标题、入链、代码引用及链接检查）；`dist/reports/documentation-duplicates-2026-10-02.local.json`（全部附件重复SHA与记忆目录统计）。均位于忽略目录。本轮没有联网调用模型、重测游戏或确认外部部署。

## 7. 清理与规范化执行结果（2026-10-02）

本节记录用户批准后的执行结果。第1～6节的版本、统计与建议是清理前证据，已归档条目不再作为现行入口。

### 7.1 备份与收敛

清理前原件保存在 `/Users/liuhang/Documents/abyssa-docs-20261002-0hlyytk3/originals`；同级 `cleanup-manifest.json` 记录每个文件的原SHA-256、处理状态、迁移目标及整理后的摘要。备份覆盖496个文件，包括未跟踪稿件、附件和受保护资料；移出前逐文件核对原件与备份相同。

| 范围 | 执行前 | 执行后 |
| --- | --- | --- |
| 全仓Markdown（不计node_modules／dist／Git） | 213 | 153 |
| docs Markdown | 148 | 88 |
| docs全部文件 | 408 | 123 |

共移出292个文件，其中61份Markdown；包括被替代的记忆稿、阶段交付、咨询流水、重复生图包、逐帧采样、未接线原型、旧静态发布施工计划，以及三份已合并的日志／素材阶段记录。新增一份稳定叙事合同，Markdown净减少60份。移出的原始文件共24,054,963 bytes，约22.9 MiB；去除重复附件后docs活跃目录约7.2 MiB。

现行维护位置：

- [记忆UI](../design/MEMORY_PANEL_UI.md)：时间手记、概述、图库图标、全员面部头像、连续范围、两态动效、选幕和页脚。
- [叙事与回想](../architecture/MEMORY_NARRATIVE_AND_REPLAY.md)：三层数据、三类来源、真实选择／回执、跳过参考、旧档投影和只读隔离。
- [三张原图与来源](../design/memory-journal-2026-09-30/README.md)：PNG与references.json原字节保留；唯一侧景裁切研究迁入同目录。保留旧参考路径，使资产crops.json的来源仍有效。
- [Schema及示例](../architecture/MEMORY_NARRATIVE_AND_REPLAY.md#8-规范附件与验证入口)：5份JSON原样迁移，标明设计示例与实际执行协议的区别。
- 日志有效布局并入[client说明](../../src/game-client/README.md#终局与经历)；背景处理、来源与局部QA边界并入[素材说明](../../src/assets/backgrounds/mansion/README.md)。完整原答和历史验证仍可从备份追溯。

### 7.2 现状与维护规则

正常四个起点统一为内容28，教程完成／跳过后接正式AIRP；无LLM与商店初见调试使用27。首访例外、tutorial-skip参考、六人剧情初始化、旧任务冻结边界已同步到首页、状态、机制、AIRP／教学合同、测试操作及相关工程README。

发布说明以10-01运行源码7fcfce1的仓库证据为准，首页／状态链接唯一发布台账；不把未提交的10-02清理写成已部署。HTTPS／OPTIONS技术检查与真实模型POST、完整试玩、缓存更新／回退分别表达。第三阶段计划中的实际未完成项已进入发布说明与状态页。

[文档索引与维护规范](../README.md#维护规则)明确：一项事实一个维护位置，当前／提案／历史分开，计划完成后并入稳定专题，过程附件外存，删除前核对消费者并备份；作者来源、运行输入、授权和冻结基线受保护。历史兼容重定向、独特失败和未决性能证据继续保留。

### 7.3 校验范围与结果

- 文档本地链接／章节锚点检查通过，原3处悬空源码链接已处理；历史测试记录保留原日期与条件。最终链接数量见本机验证报告。
- 64个受保护文件逐字节SHA一致，包括作者SOURCE稿、生成直接导入的声音／玩家边界规范、st资料、r8全部文件、archive原件，以及三张PNG与references.json。
- 6个迁移附件与备份原SHA一致：5份叙事JSON及1份侧景裁切研究。旧庄园作者正文保持原样，仅更新工程导语。
- `check-airp-style-baseline.mjs`通过，20个payload文件完整；`check-airp-low-r8.mjs`通过，34项请求与原r8字节一致，两项检查networkCalls均为0。
- `git diff --check`通过。此轮修改范围为文档与设计资料整理，未修改游戏运行代码、原稿、模型输入、存档或素材授权，未提交、推送或部署。

本轮没有重跑游戏构建、付费模型或真人体验，文档校验不替代这些验收。本机细目在 `dist/reports/documentation-cleanup-verification.local.json` 与 `documentation-cleanup-validation.local.json`，均不参与发布。
