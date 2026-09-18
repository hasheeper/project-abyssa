# 内容7：退潮岩窟教学包

O2-T规则与存档后端。继承内容6原样数据，增加独立单层四场教程、首掷种子8267、七个故事接点与一次返馆报酬。继续用规则／协议4。

**O3-T已接入玩家目录，作为教学发布基线。** 后续内容包继承此流程，当前默认见 `game-runtime/player-runtime.ts`。首晨→四场战斗→返馆AVG→一次领奖→自由枢纽已接通。复用原战斗与共用高亮画布；五张SVG为内部轮廓占位，正文仍为O1-W短文占位。

实现与版本／奖励／检查点边界见[正式契约](../../../../docs/plans/TIDE_CAVE_RULES_AND_SAVE_CONTRACT_V0_1.md)。数值是工作配置；文案与美术另外管理，未替换既有首晨正文。

复验：`node scripts/simulate-tide-cave.mjs 64`。输出到`dist/reports/tide-cave/`，不会写入玩家存档。
