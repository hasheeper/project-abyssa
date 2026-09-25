# Content 边界

`src/content` 保存项目创作的具体实例：角色资料、玩法Catalog、剧本、展示词与资源映射。内容不执行页面状态机或持久事务。

- `gameplay/` 的规则数据依赖 game-core/contracts；不含React、浏览器副作用、图片或本地化组件。
- 人物／剧情展示数据可依赖 shared/domain 与项目素材；表现契约不替代core的规则契约。
- 规则、随机、经济和存档修改由core／application执行；runtime校验并绑定具体内容。
- 编辑器生产和消费这些数据，不把编辑器逻辑塞进内容层。
- 已发行内容包及摘要用于旧档恢复；新增版本独立装配，不能直接覆盖旧包。

当前普通默认为[demo-v27](gameplay/demo-v27/README.md)，正式AIRP起点为[demo-v28](gameplay/demo-v28/README.md)，均为规则4。目录版本是内容版本，不是应用协议。较早Catalog继续按原摘要注册；`demo-v1`提供基础角色／庄园定义，`legacy-v1`服务旧裂隙兼容。完整注册以`game-runtime/player-runtime.ts`为准。

当前机制见[总览](../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)。作者原文和演出定义、当前规则包、旧档兼容包分别维护，不因清理文档改写冻结数据。