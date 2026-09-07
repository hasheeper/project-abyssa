# Content 边界

`src/content` 保存项目创作的具体实例：角色资料、玩法Catalog、剧本、展示词与资源映射。内容不执行页面状态机或持久事务。

- `gameplay/` 的规则数据依赖 game-core/contracts；不含React、浏览器副作用、图片或本地化组件。
- 人物／剧情展示数据可依赖 shared/domain 与项目素材；表现契约不替代core的规则契约。
- 规则、随机、经济和存档修改由core／application执行；runtime校验并绑定具体内容。
- 编辑器生产和消费这些数据，不把编辑器逻辑塞进内容层。
- 已发行内容包及摘要用于旧档恢复；新增版本独立装配，不能直接覆盖旧包。

当前默认是 [demo-v3](gameplay/demo-v3/README.md) 的内容3／规则4；目录名中的v3是内容版，不是应用协议版。`demo-v1` 提供早期正式角色／庄园基础定义，`demo-v2` 是保留的旧D5内容2装配，`legacy-v1` 服务旧裂隙兼容。

当前机制见[总览](../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)，原型阶段的结构提案已进入[历史档案](../../docs/archive/architecture/CONCEPT_PROTOTYPE_STRUCTURE_AND_SHARED_PLAN.md)。
