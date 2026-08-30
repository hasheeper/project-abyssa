# Tools 边界

`src/tools` 存放内容生产、标注与参数校准工具，不属于玩家运行时。

- tool 可以消费 `shared`、`content` 与 `assets`；
- tool 不得成为 app 所需契约或默认内容的所有者；
- app 不得依赖 tool，tool 也不得直接引用 app；
- 可复用契约进入 `shared/domain`，项目实例数据进入 `content`。

当前包含洋馆热区标注器与立绘参数工作台。
