# ABYSSA 文档入口

更新：2026-09-09。先看总览和状态，再进入具体计划；已完成阶段与旧版本资料统一放入archive。

## 当前必读

| 要了解什么 | 文档 |
| --- | --- |
| 游戏现在有哪些机制、如何循环、哪些仍未接通 | [当前机制与游戏闭环总览](GAME_SYSTEMS_AND_CONTENT_SPEC.md) |
| 哪些已定稿、完成度怎样、接下来先做什么 | [定稿与当前工作](DESIGN_DECISIONS_AND_CURRENT_STATUS.md) |
| 从CG开始的新玩家流程如何制作 | [初章与引导计划](plans/DEMO_PROLOGUE_AND_ONBOARDING_PLAN.md) |
| 序幕每一屏实际显示的原文 | [序幕原文分屏稿](design/PROLOGUE_SCREENPLAY.md) |
| 序幕已做什么、如何播放、还缺哪些素材 | [序幕CG实施记录](design/PROLOGUE_CG_IMPLEMENTATION.md) |
| 本轮序幕与首晨基线、验证和后续入口 | [序幕与首晨AVG阶段收口](archive/audits/2026-09-09-opening-avg-closeout.md) |
| 序幕后第一场的台词、差分、选项与AVG／RP切换 | [洋馆首晨实施记录](design/FIRST_MORNING_IMPLEMENTATION.md) |
| 诺玛破窗后情报、出门与第05轮两选项最新稿 | [首晨S2用户中文稿](design/FIRST_MORNING_DEPARTURE_SOURCE.md) |
| JSON剧本如何制作、LLM如何接入、旧档如何整理 | [AVG JSON主控与生成契约](design/AVG_JSON_AND_GENERATION_CONTRACT.md) |
| 首晨旁白与演出职责排查 | [用户排查原文及后续裁决](design/FIRST_MORNING_NARRATION_AUDIT.md) |
| 为什么已有Demo仍未达标 | [战斗压力与剧作审计](audits/2026-09-07-demo-experience-quality.md) |

## 仍有效的专项文档

| 类别 | 入口 | 边界 |
| --- | --- | --- |
| 庄园美术与叙事 | [庄园设计](design/OLD_MANOR_DESIGN.md) | 美术／世界叙事依据；现行数值查总览 |
| 人物写法 | [对白声音指南](design/DEMO_DIALOGUE_VOICE_GUIDE.md) | 与原始人设共同使用，不代表现有剧本质量已通过 |
| 玩家主角 | [非LLM主角行为与占位符契约](design/NON_LLM_PLAYER_AGENCY_CONTRACT.md) | 三层行为模型、`{{user}}` 与内部 `kael` 兼容边界 |
| 剧情表现 | [战斗与AVG衔接](design/BATTLE_AVG_SCENE_HANDOFF.md) | 现有组件和转场契约 |
| 情绪差分 | [AVG情绪联动与校准](design/AVG_EMOTION_CUE_CONTRACT.md) | 单触发词、逐角色表情／气泡／动作、用户校准与预览 |
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
