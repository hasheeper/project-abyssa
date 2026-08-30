# Apps 边界

`src/apps` 存放可独立运行、面向玩家或评审者的概念原型。每个子目录拥有自己的入口、页面状态、局部规则与样式。

- app 可以组合 `shared`、`content` 与 `assets`；
- app 不得直接引用另一个 app，也不得依赖 `tools`；
- 只服务单一原型的页面、状态机和规则留在该 app 内；
- 当前各 app 仍是独立验证入口，不代表已经存在统一游戏流程。

跨原型复用必须先满足 [`src/shared/README.md`](../shared/README.md) 的准入规则。

## 当前入口

`catalog` 是组件目录；其余十个目录是彼此独立的场景或实验入口：

| 目录 | 当前职责 |
| --- | --- |
| `menu` | 守望者之崖枢纽。通过普通 URL + `shared/transition` 前往洋馆、商店和战斗，不导入目标 app。 |
| `loading` | `shared/transition` 的视觉实验壳，用于独立重放黑幕、抵达标题和揭幕；不是正式游戏目的地。 |
| `battle` | 裂隙远征规则、Controller、五人命数骰战斗表现与四套 UI 皮肤。 |
| `mansion` | 洋馆房间、角色 ADV、修缮、设施收益与领地库存原型。 |
| `shop` | 商店交易、库存与小界面入场原型。 |
| `character-status`、`dice`、`map`、`novel`、`rp` | 各自验证角色档案、骰局、地图、AVG 与跑团演出。 |

跨文档导航不等于 app 间依赖：发起方只保存目标 URL 和交接文案，目标页面仍由自己的 HTML/Vite 入口独立挂载。只有稳定的交接协议位于 `shared/transition`。
