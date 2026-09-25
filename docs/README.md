# ABYSSA 文档索引

更新：2026-09-25。先读当前状态，再按专题查看合同和来源。当前主线为普通内容27／正式AIRP内容28；历史验收只证明写作当时的范围。

## 项目入口

| 文档 | 维护什么 |
| --- | --- |
| [项目README](../README.md) | 启动、目录和快速介绍 |
| [当前状态与下一步](DESIGN_DECISIONS_AND_CURRENT_STATUS.md) | 唯一完成度、限制和优先级 |
| [游戏机制总览](GAME_SYSTEMS_AND_CONTENT_SPEC.md) | 当前玩法、经济、掉落、设施和版本 |
| [运行与构建](../config/README.md) | 命令、端口、入口、产物与工程边界 |

## 当前机制与设计合同

| 专题 | 文档 |
| --- | --- |
| 第一章／教学 | [剧情与分工](design/CHAPTER_ONE_AND_TUTORIAL.md) · [规则与恢复](architecture/TUTORIAL_RULES_AND_RECOVERY.md) · [首晨实现](design/FIRST_MORNING_IMPLEMENTATION.md) |
| 经济／商店 | [经济B定稿](design/ECONOMY_BASELINE_B.md) · [九件装备](design/SHOP_FIRST_WAVE_ITEMS.md) · [日期货架](design/SHOP_SCHEDULE.md) · [正式首访](audits/2026-09-25-shop-first-visit-alignment.md) |
| 普通远征 | [溶洞路线与美术](design/TIDE_REEF_DUNGEON.md) · [正式掉落表](design/ORDINARY_DUNGEON_DROPS.md) · [庄园设计来源](design/OLD_MANOR_DESIGN.md) |
| 洋馆 | [设施与修缮边界](design/MANSION_FACILITIES_AND_UPKEEP.md) · [原材料／补给与旧名称对应](design/MANSION_SUPPLY_PRODUCTION.md) · [材质处理](design/MANSION_MATERIAL_PASS.md) |
| AIRP | [运行链与权限](architecture/LLM_AND_AIRP.md) · [连接设置](architecture/AIRP_CONNECTION_SETTINGS.md) · [生成面板／侧栏／阅读恢复](architecture/AIRP_FLOW_AND_RECOVERY.md) |
| GM设计与待办 | [事件流设计](plans/2026-09-23-airp-director-and-event-flow.md) · [最小职责定稿](plans/2026-09-24-airp-gm-demo-scope.md) · [六人调度与双库](plans/2026-09-25-airp-household-cast.md) · [运行指导原文](../st/setting/airp_household_guidance.md) |
| AIRP奇物 | [实例规划与商店合同](plans/2026-09-25-gm-special-appraisal.md) · [接入与验证](audits/2026-09-25-gm-special-appraisal.md)；价格与掉落仍由普通表控制 |
| 发布打包 | [本地安全审计](audits/2026-09-25-release-security.md) · [静态包与发布流程](deployment/AIRP_STATIC_HTTPS.md)；本地通过、来源冻结和公网验收分开记录 |
| 演出／美术 | [AVG JSON](design/AVG_JSON_AND_GENERATION_CONTRACT.md) · [情绪词](design/AVG_EMOTION_CUE_CONTRACT.md) · [战斗与AVG交接](design/BATTLE_AVG_SCENE_HANDOFF.md) · [敌方舞台](design/ENEMY_STAGE_INTEGRATION.md) · [命名合同](design/ART_ASSET_NAMING_CONTRACT.md) |
| 尚未实施的独立方案 | [多人骰子事件](plans/MULTI_ACTOR_DICE_EVENT_RULES_AND_SAVE_CONTRACT.md) · [HTTPS发布](deployment/AIRP_STATIC_HTTPS.md)及[远端验收计划](plans/2026-09-23-airp-static-phase-three.md) |

## 原稿与不可当作工程垃圾删除的资料

- [世界与角色](../st/setting)、[人物声音指南](design/DEMO_DIALOGUE_VOICE_GUIDE.md)、[玩家行为边界](design/NON_LLM_PLAYER_AGENCY_CONTRACT.md)。后两份由生成代码直接导入。
- 序幕：[中文原稿](design/PROLOGUE_SCREENPLAY_SOURCE_ZH.md)、[当前分屏](design/PROLOGUE_SCREENPLAY.md)、[CG原始方向](design/PROLOGUE_CG_DIRECTION_SOURCE_V1.md)、[接线说明](design/PROLOGUE_CG_IMPLEMENTATION.md)。
- 首晨与章一：[09-12首晨定稿](design/FIRST_MORNING_SCREENPLAY_SOURCE_2026_09_12.md)、[09-15章一定稿](design/CHAPTER_ONE_SCREENPLAY_SOURCE_2026_09_15.md)由测试核对；[早期首晨原稿](design/FIRST_MORNING_SCREENPLAY_SOURCE.md)和[出发原稿](design/FIRST_MORNING_DEPARTURE_SOURCE.md)仍为跨仓来源。
- [r8文风冻结基线](baselines/airp-style-r8/README.md)：预设、请求、响应、中文样本及已知失败原样保留；文风暂定认可不等于剧情／协议通过。
- [旧双语实验提示词](plans/2026-09-23-airp-bilingual-performance-prompt.md)仍被实验脚本直接读取，原字节保留供复现；不代表正式生成方案。
- [素材库与授权](../src/assets/README.md)、[退潮黑礁](../src/assets/battle/tide-reef/README.md)、[旧庄园](../src/assets/battle/old-manor/README.md)、各图标归属说明。
- 有具体参考价值的[Slice & Dice道具研究](design/SLICE_AND_DICE_ITEM_DESIGN_REFERENCE.md)和[动效研究](design/UI_MOTION_INDUSTRY_REFERENCE.md)保留；被否定的结算边框方案与咨询截断稿已清理。

## 验证记录与历史

[audits](audits)仅保留关键实现／实测、尚未解决的问题证据，以及被原稿或相邻rp应用引用的记录。最近功能的证据入口集中在[状态页](DESIGN_DECISIONS_AND_CURRENT_STATUS.md#3-最近收口与证据)，不再逐次把微调和调用流水追加到索引。

[archive](archive/README.md)只保留独特旧创作稿、长期战斗设计参考和未决编辑副本。完成的施工计划、重复状态快照、咨询中间版和已经替代的探索稿已从仓库移除；旧兼容入口仅在确有跨仓／原稿引用时保留。

2026-09-25整理后，Markdown由381份收敛到138份。清理前原件与逐文件SHA位于仓库外备份 `/Users/liuhang/Documents/abyssa-docs-20260925-q29uc52g`，同目录`cleanup-manifest.json`记录删除及迁移清单。备份不参与运行或发布。后续只更新专题合同与统一状态，避免重新为每次小修复积累一份报告。

## 工程维护入口

[core](../src/game-core/README.md) · [application](../src/game-application/README.md) · [runtime](../src/game-runtime/README.md) · [client](../src/game-client/README.md) · [battle](../src/apps/battle/DEVELOPMENT_GUIDE.md) · [共享UI](../src/shared/README.md) · [Stage](../src/shared/stage/README.md) · [动效](../src/shared/ui/motion/README.md) · [加载／切场](../src/shared/loading/README.md)。

文档变更后运行 `node scripts/check-doc-links.mjs` 检查本地链接和章节锚点；涉及原稿或r8时另核对来源哈希。不要为整理目录改动剧情、模型输入、存档或素材授权。
