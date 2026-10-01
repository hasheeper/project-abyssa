# ABYSSA 文档索引与维护规范

更新：2026-10-02。正常起点统一使用内容28，教学完成／跳过后接正式AIRP；无LLM与商店初见调试使用27。先读当前状态，再按专题查看合同与来源，历史记录只证明写作当时的范围。

## 项目入口

| 文档 | 维护什么 |
| --- | --- |
| [项目README](../README.md) | 项目介绍、启动、目录与快速入口 |
| [当前状态与下一步](DESIGN_DECISIONS_AND_CURRENT_STATUS.md) | 唯一完成度、限制和优先级 |
| [游戏机制总览](GAME_SYSTEMS_AND_CONTENT_SPEC.md) | 当前玩法、经济、掉落、设施和版本 |
| [运行与构建](../config/README.md) | 命令、端口、入口、产物与工程边界 |
| [发布台账](deployment/AIRP_STATIC_HTTPS.md) | 唯一线上运行源码、部署ID、清单与验收记录 |

## 当前机制与设计合同

| 专题 | 文档 |
| --- | --- |
| 第一章／教学 | [剧情与分工](design/CHAPTER_ONE_AND_TUTORIAL.md) · [规则与恢复](architecture/TUTORIAL_RULES_AND_RECOVERY.md) · [首晨实现](design/FIRST_MORNING_IMPLEMENTATION.md) |
| 记忆 | [视觉与交互](design/MEMORY_PANEL_UI.md) · [事件／幕／切片、来源与回想](architecture/MEMORY_NARRATIVE_AND_REPLAY.md) · [三张原始参考](design/memory-journal-2026-09-30/README.md) |
| 经济／商店 | [经济B定稿](design/ECONOMY_BASELINE_B.md) · [九件装备](design/SHOP_FIRST_WAVE_ITEMS.md) · [日期货架](design/SHOP_SCHEDULE.md) · [正式首访](audits/2026-09-25-shop-first-visit-alignment.md) |
| 普通远征 | [溶洞路线与美术](design/TIDE_REEF_DUNGEON.md) · [正式掉落表](design/ORDINARY_DUNGEON_DROPS.md) · [庄园设计来源](design/OLD_MANOR_DESIGN.md) |
| 洋馆 | [设施与修缮](design/MANSION_FACILITIES_AND_UPKEEP.md) · [原材料与补给](design/MANSION_SUPPLY_PRODUCTION.md) · [材质处理](design/MANSION_MATERIAL_PASS.md) |
| AIRP | [运行链与权限](architecture/LLM_AND_AIRP.md) · [连接设置](architecture/AIRP_CONNECTION_SETTINGS.md) · [生成／侧栏／阅读恢复](architecture/AIRP_FLOW_AND_RECOVERY.md) |
| GM方向 | [事件流设计](plans/2026-09-23-airp-director-and-event-flow.md) · [最小职责](plans/2026-09-24-airp-gm-demo-scope.md) · [六人调度与双库](plans/2026-09-25-airp-household-cast.md) · [运行指导原文](../st/setting/airp_household_guidance.md) |
| AIRP奇物 | [实例与商店合同](plans/2026-09-25-gm-special-appraisal.md) · [接入验证](audits/2026-09-25-gm-special-appraisal.md)，价格／掉落由程序控制 |
| 演出／美术 | [AVG JSON](design/AVG_JSON_AND_GENERATION_CONTRACT.md) · [情绪词](design/AVG_EMOTION_CUE_CONTRACT.md) · [战斗交接](design/BATTLE_AVG_SCENE_HANDOFF.md) · [敌方舞台](design/ENEMY_STAGE_INTEGRATION.md) · [素材命名](design/ART_ASSET_NAMING_CONTRACT.md) |
| 发布 | [安全审计](audits/2026-09-25-release-security.md) · [静态发布与远端验收](deployment/AIRP_STATIC_HTTPS.md)；HTTPS已发布，真实调用和更新回退仍待验收 |
| 独立待实施方案 | [多人骰子事件](plans/MULTI_ACTOR_DICE_EVENT_RULES_AND_SAVE_CONTRACT.md) |

## 作者来源、运行输入与冻结资料

- [世界与角色](../st/setting)、[人物声音指南](design/DEMO_DIALOGUE_VOICE_GUIDE.md)、[玩家行为边界](design/NON_LLM_PLAYER_AGENCY_CONTRACT.md)。后两份由生成代码直接导入。
- 序幕：[中文原稿](design/PROLOGUE_SCREENPLAY_SOURCE_ZH.md)、[当前分屏](design/PROLOGUE_SCREENPLAY.md)、[CG方向原文](design/PROLOGUE_CG_DIRECTION_SOURCE_V1.md)、[接线说明](design/PROLOGUE_CG_IMPLEMENTATION.md)。
- 首晨与章一：[09-12首晨定稿](design/FIRST_MORNING_SCREENPLAY_SOURCE_2026_09_12.md)、[09-15章一定稿](design/CHAPTER_ONE_SCREENPLAY_SOURCE_2026_09_15.md)由测试核对；[早期首晨](design/FIRST_MORNING_SCREENPLAY_SOURCE.md)和[出发原稿](design/FIRST_MORNING_DEPARTURE_SOURCE.md)保留跨仓来源。
- [r8冻结基线](baselines/airp-style-r8/README.md)：预设、请求、响应、中文样本及失败原样保留，文风暂定认可不等于剧情／协议通过。
- [双语实验提示词](plans/2026-09-23-airp-bilingual-performance-prompt.md)仍由实验脚本读取，原字节保留供复现，不代表正式方案。
- [素材库与授权](../src/assets/README.md)、[退潮黑礁](../src/assets/battle/tide-reef/README.md)、[旧庄园](../src/assets/battle/old-manor/README.md)及各图标来源说明。
- [Slice & Dice道具研究](design/SLICE_AND_DICE_ITEM_DESIGN_REFERENCE.md)、[动效研究](design/UI_MOTION_INDUSTRY_REFERENCE.md)保留有效参考。

## 维护规则

1. **一项事实一个维护位置。** 完成度与待办写状态页，玩法写机制合同，视觉／交互写设计合同，部署写发布台账；其他入口保留摘要与链接。
2. **现行、提案、历史明确分开。** 当前合同按真实代码更新；未实施方案注明提案；历史记录保留当时日期、内容版本、测试条件和失败，不追改成今天的结果。
3. **计划完成后收敛。** `plans`新增内容应有明确未完成目标；完成的施工规则并入稳定专题。已有长期GM方向、实验输入与兼容入口按标注范围保留，不继续追加日常状态。
4. **审计只记录必要证据。** `audits`保留关键失败、恢复、验收、来源或兼容依据。连续修订更新同一记录；小改动、咨询调用流水、原型代码与逐帧截图放 `dist/reports` 或仓库外备份。
5. **参考图保留原件与来源。** 正式设计保留必要参考，重复交付包、ZIP和派生截图不反复入库；不能用概念文字冒充作者原文或真实玩家事实。
6. **来源与兼容受保护。** 整理前检查代码／测试／脚本消费者及外仓引用。运行输入、原稿、授权和冻结基线不因“日期旧”删除；未核实的兼容重定向保持薄入口。
7. **移出前可追溯。** 含未跟踪文件的原件先备份，逐文件保存SHA、去向与合并位置；活跃目录不留第二份过时实现。
8. **验收按范围表达。** 文档变化检查链接／锚点与受保护来源SHA；运行输入变化另跑对应校验。构建、定向测试、真人体验、模型质量及线上部署各自记录。

## 历史与本轮整理

[audits](audits)的最近证据统一由[状态页](DESIGN_DECISIONS_AND_CURRENT_STATUS.md#3-最近收口与证据)索引；[archive](archive/README.md)保留独特旧创作稿、战斗参考和未决编辑副本。

09-25备份仍位于 `/Users/liuhang/Documents/abyssa-docs-20260925-q29uc52g`。10-02清理前原件、逐文件SHA及迁移清单位于 `/Users/liuhang/Documents/abyssa-docs-20261002-0hlyytk3`；本轮结果见[文档审计](audits/2026-10-02-documentation-audit.md)。外部备份和忽略报告不参与运行或发布。

## 工程维护入口

[core](../src/game-core/README.md) · [application](../src/game-application/README.md) · [runtime](../src/game-runtime/README.md) · [client](../src/game-client/README.md) · [battle](../src/apps/battle/DEVELOPMENT_GUIDE.md) · [共享UI](../src/shared/README.md) · [Stage](../src/shared/stage/README.md) · [动效](../src/shared/ui/motion/README.md) · [加载／切场](../src/shared/loading/README.md)。

文档变更后运行 `node scripts/check-doc-links.mjs`。整理目录不改剧情、模型输入、存档或素材授权。
