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
| `loop-context.ts` | demo内容3／规则4 | 旧刻仪兽回忆／维护和真实商店 |
| `prologue-context.ts` | demo内容4／规则4 | CG序幕旧档 |
| `first-morning-context.ts` | demo内容5／6，规则4 | 首晨S1／S2 |
| `tide-cave-context.ts` | demo内容7／规则4 | 四场教学与返馆 |
| `guided-tide-context.ts` | demo内容11／规则4 | 保留 G3/G4 五房教学原档及原事件序列 |
| `chapter-one-context.ts` | demo内容12／规则4 | 当前新档默认；章一定稿六场／诺玛 E1／S4-1 收束 |
| `airp-context.ts` | demo内容8／9／10，规则4 | 单条手写／原四型卡池／显式在线两场 |

`defaultCreation` 为 `{protocolVersion:4, contentVersion:12, profileId:"profile.demo.first-run"}`。完整引用还包含 Catalog ID 和摘要；读取跟随档案引用，不把旧档自动套到新包。复制升级与二周目由 `continueSave` 显式创建新档。内容12从11隔离发布：E1 改由诺玛真实独立抽面，事件种子7，战斗种子不变；正文结束于S4-1。旧11摘要及艾洛拉事件序列保持原样，不隐式迁移。

标题“新的开始”先选起点，再调用`application.createNewGame({saveId, epoch, clientRequestId, startAt})`。`startAt`为`prologue / first-morning / tutorial / hub`：创建内容12原生新档后，以独立、确定的请求ID提交`select-game-start`，事实为`game-start-selected`。仅第1次提交且无来源副本可用；跳过教程使用`exempt / player-skipped`，不是旧档豁免或胜利，不生成奖励、默认分支与时间流逝。两步均可重试，成功后才导航；标题直到卸载一直锁定，避免连点建第二份档。底层`create`及显式在线10保持原契约。

G3阶段曾将新建档默认切为内容11，09-15起默认12；原身份恢复沿用G2合同，`continueSave`不提供迁移到11／12，旧档不会因注册新包而新增升级推荐。`tutorialView`增加node、独立battle编号和guide的step／operation／canExit／canUndo；关闭提示不退出带做，续算仍走原查询。原控件通过`tutorialOperationAllowed`镜像当前查询的操作限制，不直接导入规则或校验器。G2摘要、种子及轨迹未变；见[G2验收](../../docs/audits/2026-09-13-tide-guided-g2.md)与[G3验收](../../docs/audits/2026-09-13-tide-guided-g3.md)。

显式在线内容10使用 `airp-online-driver.ts` 调用rp应用。明确接受包0.1.0～0.1.3、0.2.0／0.2.1、0.3.0～0.3.2；0.2起历史字段 `writingPipelineVersionId` 指向最终formatter。当前0.3.2更正小模型为deepseek-flash并收紧Writing，兼容、玩家链、恢复和浏览器隔离回归通过，两情境四场真实闭环、摘要召回、幂等重放及AVG通过，文稿质量待修订，见[本轮记录](../../docs/audits/2026-09-12-airp-032-acceptance.md)。未知版本仍拒绝，合同、hash及精确Result／Checkpoint保护不变；incomplete即使`stateContinuable=true`也不接纳或确认。旧档不迁移，修订动作未向玩家开放。

## 入口与查询

内容11／12到达教程后建立远征、播放S3-1，再展示前端只读总览；确认“开始战斗”才提交原`tutorial-read`进入战1。查阅总览不改变战斗、事件或奖励，阅读位置使用独立呈现缓存。已经active的存档沿原恢复链继续，旧四房教程入口不变。

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
