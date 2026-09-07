# Apps 边界

`src/apps` 存放独立挂载的玩家页面和演示入口。正式页面已经经 game-client 共用存档与应用事务；“独立HTML入口”不等于各自拥有一套玩家进度。

- app 可以组合 game-client、shared、展示内容与素材；不得直接引用另一个 app 或制作工具。
- 页面负责交互、布局、动画及本地选择，不持有正式战斗／成长／经济规则。
- 正式规则属于 game-core，提交与持久化属于 game-application；页面不绕过这些边界修改权威状态。
- 仅实验使用的状态必须留在显式预览或独立实验中，不作为正式新档默认值。

## 当前入口

实际清单以 [config/entries.mjs](../../config/entries.mjs) 为准；共9个game、4个lab、5个tool。分类为game不保证已接共享经济。

| 目录 | 当前职责与边界 |
| --- | --- |
| `title` | 建档／继续／导入导出／诊断／符合条件的复制升级与二周目；新档仍进入菜单，初章尚无。 |
| `menu` | 枢纽导航与真实资金／进度，不直接导入目标app。 |
| `map` | 真实名册、编队、配给和庄园出征；其他主题地图尚非正式路线。 |
| `battle` | 正式庄园、回忆、事件、AVG接线与演出；确定性规则在core。 |
| `mansion` | 洋馆场景、资产、归来／成长／赠物与导航；建设生产等操作未开放。 |
| `shop` | 内容3档案可购买五类战术补给；完整商品经济仍未开放。 |
| `character-status` | 同档角色配置、成长、记事、装备管理与玛回忆入口。 |
| `dice` | 码头骰局，已有独立玩法及可选外部管线实验；资金未接Campaign。 |
| `settings` | 参数预览，尚无跨页持久设置；AI服务栏为占位。 |
| `catalog`／`loading` | 组件目录与过场实验壳，不是正式冒险内容。 |
| `novel`／`rp` | AVG／NVL与跑团演出实验，不能当作已完成初章。 |

跨页使用统一导航传递 save／epoch 等身份，由目标页面自己挂载和读取；共享视觉过场位于 shared/transition。复用准入见[shared说明](../shared/README.md)，完整玩法边界见[机制总览](../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)。制作工具在 `src/tools`。
