> 历史档案：2026-09-07文档整理时归档。原路径：`docs/audits/2026-09-05-s2-implementation.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# S2 实施与验收记录

日期：2026-09-05。状态：**E0—E6 全部完成，本地验收通过；远端 CI 未执行。**

依据：[S2 计划](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S2_APPLICATION_FOUNDATION_PLAN.md)、[实施前审计](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-s2-application-foundation.md)。本记录描述实际实现，不把原型页面或拟议玩法算作已经上线。

## 1. 已落地的调用边界

```text
旧 Battle 页面 → engine.ts → game-runtime/legacy-battle → 唯一规则实现

新页面（S3 接线） → game-runtime/browser
                        ├─ content/gameplay/legacy-v1 + 发行摘要
                        ├─ game-application → game-core/contracts,battle,session
                        ├─ storage Port ← Memory / IndexedDB
                        └─ AI Port ← LocalReactionPort
```

core 仅含纯 TypeScript；application 仅引用 core 公共入口和自身。具体内容、平台时钟、随机 seed/ID、存储与本地短反应在外部装配。没有修改或启动 rp-style-lab，没有引入 Provider/Session/Pipeline 存档字段。

## 2. 实施前缺口与落点

| 审计项 | 实际处理 | 主要实现 |
| --- | --- | --- |
| A01 内容固定耦合 | 93 个内容相关规则函数显式接收 context；旧内容迁出 core，创建/dispatch/select/restore 全链注入 | [Catalog](/Users/liuhang/Documents/project-abyssa/src/game-core/contracts/catalog.ts)、[正式引擎](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/engine.ts) |
| A02 混合平坦状态 | 显式字段所有权表，checkpoint 同样拆合，新增字段会触发类型检查 | [三层状态](/Users/liuhang/Documents/project-abyssa/src/game-core/session/state.ts)、[纯投影](/Users/liuhang/Documents/project-abyssa/src/game-core/session/projection.ts) |
| A03 未知命令无规范拒绝 | unknown 解析器，字段/版本/ID/额外属性校验；公开玩家命令与敌方中断恢复分开 | [命令解析](/Users/liuhang/Documents/project-abyssa/src/game-application/parse.ts) |
| A04 坏存档/未知定义 | JSON 规模、Schema、内容引用、跨字段、全部 checkpoint、loadout 基线与守恒校验；正式存档还验证历史来源和结算身份 | [Battle 校验](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/persistence/validate.ts)、[应用校验](/Users/liuhang/Documents/project-abyssa/src/game-application/validate.ts) |
| A05 初始化 RNG 元数据 | 正式 seed 创建保存初始敌人与意图抽取后的游标，恢复直接续流 | [engine.create](/Users/liuhang/Documents/project-abyssa/src/game-core/battle/engine.ts) |
| A06 提前 completion、重复奖励 | finished guard；Campaign/远征唯一保管；稳定 settlementId、terminalRef、ledger 与回执原子提交 | [Campaign 规则](/Users/liuhang/Documents/project-abyssa/src/game-core/session/campaign.ts)、[应用服务](/Users/liuhang/Documents/project-abyssa/src/game-application/service.ts) |
| A07 局部 ID 与文本 facts | FactId 来自 head/批内序号；结构化白名单映射；undo 追加撤回关系，来源不回退 | [Fact](/Users/liuhang/Documents/project-abyssa/src/game-application/facts.ts) |
| A08 UI 才是权威状态 | 新服务已实现先持久化再返回回执；旧页面仍走兼容路径，S3 替换 controller | [S3 API 指南](/Users/liuhang/Documents/project-abyssa/src/game-application/README.md) |

## 3. 实际协议与规划调整

1. **路由显式绑定。** 正式入口是 `createBattleEngine(validatedCatalog, routeId)`，避免恢复/换层时隐式选默认路线。两个不同 Catalog 可同时执行，模块没有可变“当前内容”。
2. **统一机制 ID。** `CharacterId` 拓宽为字符串，没有引入泛型旧五人联合。现有页面/Record 使用通过类型与完整组件验证；旧内容仍固定五人，未知角色在 Catalog/编队校验拒绝。UI 将来引入第六角色时仍须补展示映射。
3. **不建空 Mansion 状态。** Campaign 只纳入出征/交接实际消费的资金、库存、traits、开放角色、时钟、活动引用及 ledger。房间、修缮等由 S3 引入有规则消费的版本化字段。
4. **整份快照事务。** IndexedDB schema 1 使用 `saves` 与 `receipts` 两个 store。commits/facts 与 snapshot 同存 GameRecord，不独立分页；两份 store 在同一事务 CAS/写入，只有 oncomplete 才确认成功。
5. **历史新档位。** 应用备份保留历史 revision 序列、重映射来源后追加 import 提交；不将 head 归零造成旧 Fact/checkpoint 指向未来。新 saveId/epoch 与原资产快照一起恢复，原档位不变，旧回执不作为新请求去重凭证。
6. **旧 Battle 独立导入。** schema 1—4 先迁移再严格校验，进入新的零资金 Campaign。原始中断 cursor 只执行未完成敌人；玩家 `next-round` 不能跳过未完成批次，返回 `resume-required`。
7. **有限生产机制。** legacy-v1 没有生产 reaction handler；非空 Catalog reactions 明确拒绝。解析器原有反应机制仍由测试 registry 验证。非空 pending effect/reaction 队列不能当作已提交存档导入。
8. **保守 AI 语义。** 首个任务仅 `react-to-commit`，使用当前提交的共同可见 party Fact；player/internal/simulation 不发给短反应。来源前进、场景改变、取消、过期、重复或非法响应一律跳过；不修改永久关系或资产。
9. **明确容量边界。** JSON 8 MiB UTF-8，深度 40，节点 300000，常规集合/提交/Fact 4096，checkpoint 256，库存容量/单类实例 256。原冻结夹具约 184 KB；没有通过截断历史、库存或未知定义来满足上限。

legacy 内容身份固定为 `abyssa.legacy / content 1 / rules 1`，发行 SHA-256 为 `8e08b82cc9828456581b69af44757693154d3a2a2202d70e3a2707f05077a80f`。runtime 校验清单并深冻结内容。旧 Battle schema 4 保持，应用 schema 独立从 1 开始。

## 4. 验证矩阵

最终数值以本节末尾的验收结果为准，不累计规划/S1 的历史测试次数。

| 验收 | 覆盖方式 |
| --- | --- |
| V01 旧兼容 | 原 S1 956 步完整 state/event/RNG/旧序列化与 124 运行时导出；fixture 未重录 |
| V02 内容注入 | 重排/缩小编队、合成第六候选、替代遭遇；双 Catalog 隔离；正式创建/执行/select/恢复 |
| V03 加载与版本 | 坏数值、未知引用、错版本/摘要、checkpoint/Fact/候选/历史引用拒绝；失败记录保留 |
| V04 确定性 | 失败/CAS 不修改快照或 RNG；读档续流；AI 结果不触及存储 |
| V05 三层投影 | 旧迁移与敌方中断逐字段 round-trip、checkpoint、终局/正常推进；所有权类型清单 |
| V06 幂等 | 同 ID 重试、异参拒绝、领域拒绝稳定保留、旧回执不覆盖最新快照 |
| V07 真实存储 | 同一 contract 跑 Memory 与 Chromium IndexedDB 双连接；重开、abort、quota、blocked、versionchange |
| V08 带入/归还 | 合成合法物品/装备/trait，在馆与远征唯一保管、非法带入失败不扣物；checkpoint 不能修改带入基线 |
| V09 真实收益结算 | 实际掷骰/锁骰/攻击/结束回合/离开，获得正收益；终局重开与成功响应丢失重试；不同 ID 重结算只入账一次 |
| V10 备份与来源 | 旧 schema 1—4、已结算/未结算应用备份、带 undo 的备份新档位恢复；来源和资产一起恢复 |
| V11 撤回事实 | 全局 ID 唯一、机械撤回后 Fact 作废、import 来源事实不作废、私密/模拟来源不投影 |
| V12 AI | 本地正常响应、失败、取消、永不返回的超时、dispose、乱序、旧 head/场景/远征、越权人物/资产/Fact、超预算、额外 patch |
| V13 边界 | core/application 无 DOM 类型项目、AST 导入/环境/循环门禁、禁 UI 包闭包污染、独立 Node 纯闭包 |
| V14 原有发行 | 全组件测试、四类聚合构建、18 兼容入口、UI 包契约、辅助产物、Storybook 和原35浏览器检查 |

## 5. 工作树保护与交接

本轮保留开始时的大量 S0/S1 与素材/设定未提交修改，没有 reset/clean 或重录语义预期。保护核对以 `dist/reports/s2/implementation/before-hashes.json` 为基准，记录的是工作树而非 HEAD；值为 null 的路径在本轮开始时就已删除，不能算作 S2 新删除。

S3 从 [应用服务说明](/Users/liuhang/Documents/project-abyssa/src/game-application/README.md) 与 [browser runtime](/Users/liuhang/Documents/project-abyssa/src/game-runtime/browser.ts) 接入。必须逐页替换各自独立的钱包/状态来源，先提交再演出，验证地图→战斗→结算→洋馆及刷新窗口。当前页面兼容回归通过仅证明 S2 未破坏原页面，不能证明 S3 玩家流程已经闭环。

GitHub CI 已纳入 application Node 项目和真实 IndexedDB 测试；本轮只报告本地执行，未触发远端 CI。

## 6. 本地验收结果

工具链：Node 22.23.2 / npm 10.9.8 / TypeScript 7.0.2 / Vitest 3.2.7。真实浏览器使用本机已安装的 Chromium 151（Playwright 缓存 1234），通过 `ABYSSA_BROWSER_EXECUTABLE` 显式指定；CI 使用该 Playwright 版本安装的 Chromium。

| 检查 | 本轮实际结果 | 本地证据 |
| --- | --- | --- |
| 全工程基线 | 85 文件 / 752 测试通过（core 168、application 37、app 547）；类型、入口、边界、Node 导入通过 | [baseline.log](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/implementation/baseline.log) |
| 最终 application 定向复测 | 3 文件 / 37 测试通过；包含新增的敌方中断防跳过、备份后撤回、dispose 与 simulation 过滤断言 | [application-final.log](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/implementation/application-final.log) |
| 工程与 AST 失败用例 | 55 项通过（增加 application 类型引用循环测试）；类型检查再次通过 | 同轮终端记录，baseline.log 首次54项；追加用例后重跑55项，最终46项边界测试另存 [boundary-final.log](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/implementation/boundary-final.log) |
| 无环境依赖闭包 | core/application 无外部依赖；124旧导出一致；独立 Node 完成5趟应用远征与入账 | [report.json](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/import/report.json) |
| 四类发行构建 | ui 182文件、game 594、lab 201、tools 211；产物检查通过 | [build-all.log](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/implementation/build-all.log) |
| 兼容构建 | 18/18入口通过 | [build-entries.log](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/implementation/build-entries.log) |
| UI包发布契约 | 184个打包文件；index/branding/patterns/primitives 分别103/14/32/57个运行时导出；未包含游戏服务 | package release 检查终端记录 |
| 辅助/Storybook | 通过；仅原有大chunk提示 | [auxiliary.log](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/implementation/auxiliary.log)、[storybook.log](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/implementation/storybook.log) |
| 浏览器 | 固定产物后的完整40/40通过（原35项 + IndexedDB 5项），约3分钟，0跳过/0重试 | [browser-stable.log](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/implementation/browser-stable.log) |
| 工作树保护 | 661个指定保护路径哈希不变；当前维护文档链接有效，新文件无空白/冲突标记问题 | [protection.json](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/implementation/protection.json) |

首次浏览器运行有1项失败、39项通过：当时另一个工程测试正在重建 `dist/game`，trace 明确记录 `GET /mansion.html` 返回404。该失败不是规则或页面逻辑断言失败。停止并行改写产物后重新执行整套浏览器检查，40/40通过；保留 [首次报告](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/implementation/smoke-initial.json) 和 [trace](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/implementation/initial-mansion-trace.zip)，不降低等待阈值或跳过测试。CI 本来就是先构建、后浏览器，顺序未改变。

S1 fixture SHA-256 保持 `d0068a78b3a34d6c6b0e9aea0bbe9aec10081a1255ec8f9b6e1e3ce0e0d9afd6`。所有报告位于忽略的 dist 目录，原始 fixtures 与玩法定稿未改。


最终机器记录：[verification.json](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/implementation/verification.json)。浏览器完整结果：[smoke-final.json](/Users/liuhang/Documents/project-abyssa/dist/reports/s2/implementation/smoke-final.json)。S2交付完成，剩余玩家流程明确归S3，真实服务适配归S4。

后续交接（2026-09-05）：[S3 已完成实际页面闭环与本地验收](2026-09-05-s3-implementation.md)。Title、Menu、Map、Battle、Mansion、Shop 统一消费应用服务；本记录中的“旧页面仍走兼容路径”是 S2 完成时的历史状态。当前客户端协议见 [game-client](../../../src/game-client/README.md)，真实模型服务适配仍归 S4。
