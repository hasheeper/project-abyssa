# Content 边界

`src/content` 存放 Abyssa 项目创作出来的具体数据，例如角色资料、洋馆区域参数、剧本与物品定义。

依赖规则：

- 可以依赖 `shared/domain` 的类型与纯函数；
- 可以引用 `src/assets` 中的项目素材；
- 不包含 React 组件、页面状态、路由或浏览器副作用；
- 不拥有编辑器逻辑；编辑器只是这里内容的生产者和消费者；
- 内容实例与领域契约分开：实例进入 `content`，契约进入 `shared/domain`。

完整规划见 [`docs/architecture/CONCEPT_PROTOTYPE_STRUCTURE_AND_SHARED_PLAN.md`](../../docs/architecture/CONCEPT_PROTOTYPE_STRUCTURE_AND_SHARED_PLAN.md)。
