# 游戏装配层

本层绑定内容、纯规则、应用服务与存储适配。规则不依赖 runtime；UI 包不发布 runtime。正式页面经 [game-client](../game-client/README.md) 接入，默认不需要网络或模型配置。玩法范围见[当前机制总览](../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)。

## 当前默认与兼容注册

`player-runtime.ts` 的 `PLAYER_CATALOGS` 同时服务可写页面、地图与角色只读页：

| 装配 | 内容／规则 | 用途 |
| --- | --- | --- |
| `legacy-context.ts` | legacy内容1／规则1 | 老裂隙存档 |
| `manor-context.ts` | 庄园片段内容1／规则2 | 老三层存档 |
| `full-manor-context.ts` | demo内容1／规则3 | 老五层存档 |
| `d5-foundation.ts` | demo内容2／规则4 | 旧D5本尊回忆存档 |
| `loop-context.ts` | demo内容3／规则4 | 当前默认；刻仪兽回忆／维护和真实商店 |

`defaultCreation` 为 `{protocolVersion:4, contentVersion:3, profileId:"profile.demo.first-run"}`。完整引用还包含 Catalog ID 和摘要；读取跟随档案引用，不把旧档自动套到新包。复制升级与二周目由 `continueSave` 显式创建新档。

## 入口与查询

- `browser.ts`：`createBrowserGameRuntime(databaseName?)`，装配 IndexedDB 与平台 ID／seed；浏览器能力只在创建时取得。
- `versioned-runtime.ts`：`createVersionedGameRuntime(store, registrations)`，按版本分流 create／open／list／dispatch／resume／importSave／exportSave／exportDiagnostic／continueSave。
- `catalogs.ts`：校验并冻结注入内容，按记录信封选择严格 reader。
- `versioned-views.ts`：同档案的角色、队伍、战斗、续行、历史查询；展示 DTO 的版本不等于命令协议，发令必须使用实际记录版本。
- `browser-reader.ts`：角色档案的只读装配，只暴露读取、查询、诊断与关闭，不自动恢复游戏命令。
- `battle-view.ts`／`views.ts`／`create-runtime.ts`：legacy 只读投影与旧服务装配；不能拿旧 reader 读取正式v4记录。
- `legacy-battle.ts`：旧124个导出，仅供兼容／显式原型测试，正式玩家入口禁止依赖。
- `testing/`：独立Catalog、场景、浏览器探针和中断样本，不进入生产闭包。

角色查询从同一 head 派生有效六面、冻结或长期配置、装备实例、下一成长与记事。正式规则计算属于 core，显示词与资源映射属于 client。`demo-v1` 基础定义里的玛铭约延后引用由完整D5装配补齐；测试fixture不会替代发行Catalog。

## 提交、冻结与恢复

`runtime.application` 承担权威读写。底层版本化 create／importSave 以 `{contentRef, request}` 选择内容服务；玩家装配负责将标题请求映射到正确引用。命令保留 expectedHead／clientRequestId 和幂等语义。resume 每次只推进合法的已保存位置，调用方重新读 head 后再查 continuation。请求 ID 与 seed 在生成时确定，重试不重新生成。

`catalogs.read` 对存储／导入／外部对象执行完整校验，返回自己的深冻结副本。只有同一 registry 已校验冻结的对象可复用；不按 head 信任外部对象，不缓存可变输入。journey 缓存使用快照身份；命令服务仍独立校验存储记录并通过 CAS 提交。

## 可选反应边界

`createReactions(currentScene)` 目前仍由 legacy 服务装配：先读已提交档案，再投影可见事实；不能把它当作v4已有完整LLM管线。head／场景改变时拒收旧结果，取消／close 清理任务。普通v4玩法与手写本地反馈不依赖这条链路。

完整事务、版本和 Port 说明见[应用层](../game-application/README.md)；历史阶段证据见[归档索引](../../docs/archive/README.md)。
