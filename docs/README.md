# ABYSSA 文档入口

更新：2026-09-07。先看总览和状态，再进入具体计划；已完成阶段与旧版本资料统一放入archive。

## 当前必读

| 要了解什么 | 文档 |
| --- | --- |
| 游戏现在有哪些机制、如何循环、哪些仍未接通 | [当前机制与游戏闭环总览](GAME_SYSTEMS_AND_CONTENT_SPEC.md) |
| 哪些已定稿、完成度怎样、接下来先做什么 | [定稿与当前工作](DESIGN_DECISIONS_AND_CURRENT_STATUS.md) |
| 从CG开始的新玩家流程如何制作 | [初章与引导计划](plans/DEMO_PROLOGUE_AND_ONBOARDING_PLAN.md) |
| 为什么已有Demo仍未达标 | [战斗压力与剧作审计](audits/2026-09-07-demo-experience-quality.md) |

## 仍有效的专项文档

| 类别 | 入口 | 边界 |
| --- | --- | --- |
| 庄园美术与叙事 | [庄园设计](design/OLD_MANOR_DESIGN.md) | 美术／世界叙事依据；现行数值查总览 |
| 人物写法 | [对白声音指南](design/DEMO_DIALOGUE_VOICE_GUIDE.md) | 与原始人设共同使用，不代表现有剧本质量已通过 |
| 剧情表现 | [战斗与AVG衔接](design/BATTLE_AVG_SCENE_HANDOFF.md) | 现有组件和转场契约 |
| 战斗表现尾项 | [UI与事件流工作清单](plans/BATTLE_UI_AND_EVENT_FLOW_OPTIMIZATION_PLAN.md) | 已接入功能与剩余事项，不重开已经修复的问题 |
| 多人事件 | [规则与存档提案](plans/MULTI_ACTOR_DICE_EVENT_RULES_AND_SAVE_CONTRACT.md) | 尚未实施，不当作现行单人事件规则 |
| 世界与角色 | [原始设定](../st/setting) | 人设和世界基础，保留源文件 |
| 庄园素材 | [素材清单](../src/assets/battle/old-manor/README.md) | 图像、源图与成品映射 |

## 工程与历史

- [工程配置／运行与构建](../config/README.md)
- [core](../src/game-core/README.md) · [application](../src/game-application/README.md) · [runtime](../src/game-runtime/README.md) · [client](../src/game-client/README.md)
- [Battle维护](../src/apps/battle/DEVELOPMENT_GUIDE.md) · [表现基线](../src/apps/battle/UI_PRESENTATION_BASELINE.md)
- [历史档案与迁移清单](archive/README.md) · [本次整理记录](audits/2026-09-07-documentation-consolidation.md)

同一范围只维护一个当前状态：玩法事实改总览，决策／排期改状态页，新增方案进plans。完成后的阶段报告进入archive，未验收的问题留在当前状态，避免用一长串“同日最新更新”掩盖冲突。
