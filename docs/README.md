# ABYSSA 文档入口

更新：2026-09-18。这里的推进对象是Abyssa游戏；rp只是提供通用宿主，不把它的工作台改造清单当成游戏前置。

## 当前必读

- [09-18 集成基线收口](audits/2026-09-18-integrated-baseline.md)：本次提交范围、发布检查、已知限制；[战斗优化与换层载入](plans/2026-09-18-battle-motion-performance.md)记录 B1～B5。
- [定稿、完成度与当前工作](DESIGN_DECISIONS_AND_CURRENT_STATUS.md)：有效决策与真实缺口。
- [Abyssa DEMO推进计划](plans/ABYSSA_DEMO_NEXT_STEPS.md)：rp够不够、0.3.2模型名修正／真实补验、四型／多人扩展与游戏质量顺序。
- [当前机制与游戏闭环](GAME_SYSTEMS_AND_CONTENT_SPEC.md)：默认内容12、显式在线内容10、规则／存档与可玩范围。
- [第一章定稿](design/CHAPTER_ONE_SCREENPLAY_SOURCE_2026_09_15.md)与[实施计划](plans/2026-09-15-chapter-one-finalization.md)：六场78帧、诺玛E1、S4-1收束、组件化洋馆记事，旧档不迁移。
- [S4精修与项目独立上下文](design/ABYSSA_S4_PRODUCTION_CONTEXT.md)：供其他LLM独立讨论；含两场现稿与未决项、设定与玩法关系、战斗／成长／资产、三轴AI循环及实现边界，不是新剧情定稿。
- [四战＋事件逐步教程计划](plans/TIDE_CAVE_GUIDED_TUTORIAL_PLAN.md)：G1～G4历史契约与工程基线；09-15默认12使用新定稿与诺玛事件，历史11保留原稿和原事件序列。下一批G5真人试教仍需单独进行。
- [美术资产命名合同](design/ART_ASSET_NAMING_CONTRACT.md)与[退潮黑礁素材清单](../src/assets/battle/tide-reef/README.md)：资产／图鉴／遭遇三层分离，记录教学关五敌、两只黑礁海兽、三张背景和地图立牌的定稿 ID、提示词视觉锚与接线状态。

当前本机为0.3.2：用户确认小模型应叫`deepseek-flash`，已建立正确目标并切换新版本绑定；Writing事实承接与口吻约束已修正，4来源／11摘录保留，隔离回归通过。两情境四场真实闭环、摘要召回、幂等重放及AVG通过，本批16次完成加2次取消、累计18/24次；内容仍有玩家行为推断和无来源价格，第二批未退出。上批0.3.1的错误模型名、6次请求及正文越界保留历史记录；旧档不迁移，质量过关后才扩内容，不等待rp界面改造。

## 仍有效的设计与专项

- [玩法手册运行时 JSON](../src/content/presentation/tutorial/handbook.json)：五章详细机制与实战算例，入口总览／实战手册直接读取；修改后随开发热更新或重新构建生效。
- [旧纯教程文案编辑 JSON](TUTORIAL_COPY_EDITABLE.json)：此前导出的266条教学文案副本；其中旧总览已由上述手册替代。剧情对白与非教学条目在[分离文案](SCENE_COPY_SEPARATED.json)。两份 `docs` JSON 均未自动回填，保留已有编辑，不覆盖它们。

| 范围 | 文档 |
| --- | --- |
| 在线叙事总设计 | [AIRP叙事闭环设计](plans/AIRP_NARRATIVE_DEMO_PLAN.md)；规模目标、四型、时局与知情原则 |
| 两仓接入合同 | [AIRP应用接口](plans/AIRP_4_APPLICATION_INTEGRATION_PLAN.md)；[状态权威](plans/AIRP_4_APPLICATION_INTEGRATION_PLAN.md#3-状态权威与跨端接纳)、[变量与记忆](plans/AIRP_4_APPLICATION_INTEGRATION_PLAN.md#5-变量与记忆) |
| 初章后续制作 | [初章与引导](plans/DEMO_PROLOGUE_AND_ONBOARDING_PLAN.md)、[岩窟教学设计](plans/TIDE_CAVE_COMBAT_TUTORIAL_DESIGN_V0_1.md)、[规则与存档](plans/TIDE_CAVE_RULES_AND_SAVE_CONTRACT_V0_1.md) |
| 固定剧情精修 | [O1-W工作区](plans/O1_W_LLM_WORKBENCH.md)、[工具说明](../llm/README.md)；不是在线运行后端 |
| 原始资料 | [世界／人物原文](../st/setting)、[rp资料导入状态](../../rp-style-lab/applications/airp/resources/SOURCE_IMPORT.md)；入库不等于送模 |
| 作品与人物 | [庄园设计](design/OLD_MANOR_DESIGN.md)、[对白指南](design/DEMO_DIALOGUE_VOICE_GUIDE.md)、[主角行为契约](design/NON_LLM_PLAYER_AGENCY_CONTRACT.md) |
| 序幕定稿 | [原文分屏](design/PROLOGUE_SCREENPLAY.md)、[CG实施与素材缺口](design/PROLOGUE_CG_IMPLEMENTATION.md) |
| 首晨定稿 | [09-12十二节新稿](design/FIRST_MORNING_SCREENPLAY_SOURCE_2026_09_12.md)、[首晨实施](design/FIRST_MORNING_IMPLEMENTATION.md)；[09-09出发旧稿](design/FIRST_MORNING_DEPARTURE_SOURCE.md)与[旧旁白裁决](design/FIRST_MORNING_NARRATION_AUDIT.md)保留历史，不覆盖新稿 |
| AVG表现 | [JSON与生成契约](design/AVG_JSON_AND_GENERATION_CONTRACT.md)、[战斗交接](design/BATTLE_AVG_SCENE_HANDOFF.md)、[情绪差分](design/AVG_EMOTION_CUE_CONTRACT.md) |
| UI动效 | [M0–M4 合并管理计划](plans/2026-09-17-ui-motion-consolidation.md)已收口：[M1 残留清理](audits/2026-09-17-ui-motion-m1.md)、[M2 预设／组件库展示](audits/2026-09-17-ui-motion-m2.md)、[M3 四页生命周期](audits/2026-09-17-ui-motion-m3.md)、[M4 扫描／产物／运行验收](audits/2026-09-17-ui-motion-m4.md)。三页主板和[洋馆功能窗](audits/2026-09-17-mansion-ui-motion.md)参数统一管理，页面保留就绪、输入和专用编排；Logo／视差／战斗等不变。M4 暂停隐藏黑幕活动点，未改可见效果；洋馆首次开窗长帧仍待单点调查，不宣称全项目卡顿已解决。此前 U3 以[回退记录](audits/2026-09-16-ui-motion-rollback.md)为历史边界；[旧总计划](plans/UI_MOTION_FOUNDATION_PLAN.md)、[旧分批计划](plans/UI_MOTION_U3_ROLLOUT_PLAN.md)不作为恢复迁移指令。 |
| 其他待办 | [战斗UI尾项](plans/BATTLE_UI_AND_EVENT_FLOW_OPTIMIZATION_PLAN.md)、[多人事件提案](plans/MULTI_ACTOR_DICE_EVENT_RULES_AND_SAVE_CONTRACT.md)；不计为已完成 |

## 已有证据与阶段记录

- [AIRP-1契约与样本](plans/AIRP_1_CONTRACTS_AND_FIRST_ERRAND.md)、[AIRP-2首条手写闭环](plans/AIRP_2_IMPLEMENTATION.md)、[AIRP-3四型与时局](plans/AIRP_3_IMPLEMENTATION.md)：已有范围，不重复开工。
- [AIRP-4实施记录](plans/AIRP_4_IMPLEMENTATION.md)：保留各轮语境；[0.2.1真实模型验收](audits/2026-09-10-airp-three-stage-acceptance.md)与[0.3.0第一批隔离验收](audits/2026-09-12-airp-package-compatibility.md)分开记录。
- [0.3.1第二批资料接线](audits/2026-09-12-airp-source-context.md)：来源、阶段权限、预算与隔离回归；真实文风尚未验收。
- [0.3.1本机安装与真实试读](audits/2026-09-12-airp-live-source-acceptance.md)：备份与旧资料保护、通用图标校验修复、6次真实请求、Format授权阻塞与正文质量问题；第二批未退出。
- [0.3.2模型名修正与补验](audits/2026-09-12-airp-032-acceptance.md)：当前安装、`deepseek-flash`绑定、Writing约束、预算回归与本轮真实状态。
- [早期叙事勘探](audits/2026-09-09-airp-narrative-exploration.md)：历史调查，现状以本页前三份文档为准。
- [岩窟O3-T接线](audits/2026-09-09-tide-cave-o3-closeout.md)、[序幕／首晨收口](archive/audits/2026-09-09-opening-avg-closeout.md)、[加载／路由／演出收口](archive/audits/2026-09-09-loading-routing-motion-closeout.md)。
- [战斗压力与剧作审计](audits/2026-09-07-demo-experience-quality.md)：内容3历史样本与未关闭的质量问题，不冒充今日全量试玩。
- [历史档案](archive/README.md)：已撤销的[静态内容发布器](archive/plans/AIRP_4_CONTENT_PUBLISHER_PLAN.md)已移出当前计划目录，完整原文保留。

## 工程入口

- [运行与构建](../config/README.md)；[core](../src/game-core/README.md)／[application](../src/game-application/README.md)／[runtime](../src/game-runtime/README.md)／[client](../src/game-client/README.md)。
- [Battle维护](../src/apps/battle/DEVELOPMENT_GUIDE.md)、[表现基线](../src/apps/battle/UI_PRESENTATION_BASELINE.md)、[教程画布](../src/shared/tutorial/README.md)。
- [庄园素材](../src/assets/battle/old-manor/README.md)、[早期文档整理记录](audits/2026-09-07-documentation-consolidation.md)。

现状写主文档，优先级写Abyssa推进计划，专项合同与历史证据保留独立用途。源码实现、本机部署、真实调用、玩家体验四种状态分别记录；不再叠加互相矛盾的“下一步”。
