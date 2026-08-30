# Shared 边界

`src/shared` 只存放与具体应用入口无关、已经被多个原型实际复用的稳定能力。

允许的内容：

- 稳定领域契约与纯函数；
- 无场景流程的 UI primitive、pattern 与装饰构件；
- 固定舞台、ADV 等跨场景呈现能力；
- 无业务语义的基础工具和测试夹具。

依赖规则：

- `shared` 不得引用 `apps`、`tools` 或 `content`；
- `shared/domain` 不依赖 React 与 UI；
- 具体角色、房间、剧本和页面状态不进入 `shared`；
- 没有第二个真实消费者的代码默认留在原型内部；
- 不建立导出全部内容的根级 barrel，按稳定叶子模块显式引用。

完整规划见 [`docs/architecture/CONCEPT_PROTOTYPE_STRUCTURE_AND_SHARED_PLAN.md`](../../docs/architecture/CONCEPT_PROTOTYPE_STRUCTURE_AND_SHARED_PLAN.md)。
