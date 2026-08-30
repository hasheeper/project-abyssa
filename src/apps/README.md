# Apps 边界

`src/apps` 存放可独立运行、面向玩家或评审者的概念原型。每个子目录拥有自己的入口、页面状态、局部规则与样式。

- app 可以组合 `shared`、`content` 与 `assets`；
- app 不得直接引用另一个 app，也不得依赖 `tools`；
- 只服务单一原型的页面、状态机和规则留在该 app 内；
- 当前各 app 仍是独立验证入口，不代表已经存在统一游戏流程。

跨原型复用必须先满足 [`src/shared/README.md`](../shared/README.md) 的准入规则。
