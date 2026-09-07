> 历史档案：2026-09-07文档整理时归档。原路径：`docs/audits/2026-09-05-s3-implementation.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# S3 实施验收：独立玩家闭环

日期：2026-09-05。状态：**E0–E6 实施与本地验收完成**。远端 CI 未执行。

执行依据：[S3 计划](../plans/S3_PLAYABLE_LOOP_PLAN.md)、[实施前审计](2026-09-05-s3-playable-loop.md)。使用与协议入口：[game-client](../../../src/game-client/README.md)、[应用服务](../../../src/game-application/README.md)、[runtime](../../../src/game-runtime/README.md)。

## 交付范围

| 阶段 | 实际交付 |
| --- | --- |
| E0 工程边界 | game-client 独立 owner；正反例依赖测试；正式 HTML 传递闭包禁止旧 engine/legacy-battle 和测试夹具；导航检查追踪共享路由表 |
| E1 会话 | 真实记录枚举/坏档隔离；统一会话、单 in-flight、原请求重试、读盘代次、CAS 冲突、跨页失效；三类必要收尾 |
| E2 档案与导航 | Title 新建/继续/列表/导入/导出/诊断；save/epoch 与 Battle expedition 定位；裸页守卫、已结算旧链接；根路径和子路径 |
| E3 编队 | 凯尔加 1–4 名现有伙伴，实际顺序进入应用命令；仅 legacy.rift；持久提交成功才导航；真实库存选择与装备归属检查 |
| E4 战斗 | UI 不再创建本地规则状态；回执先持久化再演出；全部敌人顺序呈现；动态骰槽/人物/连线；取消与刷新不重算规则 |
| E5 回馆 | 终局候选 → settle-expedition → ledger 确认 → 洋馆；真实资金、库存和经历；再次出征创建新身份；本地反应可取消且不阻塞 |
| E6 验收与文档 | 页面/会话/应用/门禁/真实浏览器测试；controller/runtime/application/client 文档与本报告；发行构建检查 |

## 关键协议

GameRecord 的应用 head 是唯一权威。URL、最近档案提示和 sessionStorage 都不保存第二份快照；待确认 envelope 保留原 seed、expectedHead、requestId 和参数。元数据或 IndexedDB 写失败会显示错误，不能转为内存游戏或提前跳页。

Battle 每次提交后重新 open，并核对回执 before/after 与当前 head。旧回执、其他标签页的更高版本或外部失效通知只触发重读，不播放过期演出。玩家动作冲突不自动套到新 head；必要收尾可以重新分类。恢复仅处理旧敌方 cursor、缺失 next-round、最后击杀后缺失 end-turn；每一步都通过应用事务。

终局未入账时允许重试；成功后以 ledger 为准，不由按钮加钱。旧 Battle 链接显示已入账结果。回馆与再次出征都使用同一 save/epoch，新的 expeditionId 与上一趟不同。

## 实测发现并修复的问题

1. 旧战斗测试把规则写入绑定 impact，并连续注入任意 RNG。测试现改为显式导入准备盘面，在真实会话上操作；视觉断言与持久提交断言分开，旧核心黄金轨迹不重录。
2. `usePresentationQueue.cancel()` 原来只清 timeout，等待 Promise 不结束；现在统一 resolve(false)，卸载和换 head 能完整退出。
3. 浏览器发现 3D 骰面透明投影可拦截邻居按钮。装饰 cube 与面不参与 hit testing，按钮负责点击，保持原美术。
4. 满血治疗和未选中装备所属伙伴提前在 UI 拦住；权威合法性仍由应用检查。
5. 回馆时活动远征已移除，S2 coordinator 会拒绝所有反应参与者。现在仅允许当前提交可见的结算 Fact 与 ledger 共同证明的见证人，继续核验 source/head/expedition/scene；不扩大 projectFacts 的当前提交语义。
6. 存档列表不再由 adapter 解释不可信业务摘要；通过真实 key 枚举、逐条应用校验，损坏档不阻断好档。
7. 子路径浏览器验收曾在地图素材还未加载时点击地标。trace 确认测试把离开前页面的“加载提示数为零”误判为目标页已就绪；修正为先等 Map URL/转场完成，再等素材加载。没有增加生产测试后门或强制跳过点击。
8. 档案弹窗复用 RpgModal 后仍残留旧独立面板的 inset，视觉检查发现偏向右下。改由共享模态居中，正文单独滚动，关闭按钮保持可见；末次 CSS 修正后重建 game 并定向复验真实导入/导出流程与截图。

## 验证范围与证据

所有日志位于 [本轮验收目录](../../../dist/reports/s3/implementation)。浏览器使用 Node 22.23.2 / Playwright 1.63.0 与本机已有 Chromium 151.0.7922.34；显式指定 `ABYSSA_BROWSER_EXECUTABLE`。没有远端 CI 运行结果。

| 检查 | 本轮结果 | 日志 |
| --- | --- | --- |
| core / application / app / tooling 类型 | 全部通过 | `typecheck-final.log` |
| 依赖与导航门禁 | 458 源文件、62 core 生产文件；18 入口通过 | `boundaries-final.log`、`entries-final.log` |
| 单元/组件/应用/核心回归 | 90 文件、777 项通过 | `all-tests-final.log` |
| 工程契约与构建负例 | 66 项通过，含生产闭包防绕过、丢失素材、构建隔离与 UI 包契约 | `build-tests-final.log` |
| 无浏览器纯核/应用导入 | 124 兼容运行时导出、5 条 headless 远征结算通过 | `core-import.log` |
| game 发行物 | 593 文件、68.56 MiB；输出闭包通过 | `build-game-final.log`、`output-game-final.log` |
| 固定产物浏览器 | game 31 + storage 5，共 36 项通过；最后的档案弹窗 CSS 修正另做定向复验 | `smoke-final.log`、`smoke-final.json` |
| 最后视觉修正复验 | 1 项真实档案导出/导入/坏档隔离通过，居中与关闭按钮截图复核通过 | `archive-visual-final.log`、`archive-visual-final.json` |
| 18 独立入口 | 全部完成构建与输出检查 | `build-entries-final.log` |
| UI 包发布契约 | 182 个构建文件；打包 184 文件、6.32 MiB，未包含游戏存储或 client | `release-ui-final.log` |
| lab / tools | 分别 201 / 211 文件，构建通过 | `build-lab-final.log`、`build-tools-final.log` |
| 工作台浏览器 | 10 项通过 | `workbench-final.log`、`workbench-final.json` |
| 辅助脚本 / Storybook | 脚本语法、隔离静态预览与 Storybook 构建通过 | `auxiliary-final.log`、`storybook-final.log` |

Storybook 构建成功；Vite 仍提示 axe 与 iframe 的压缩前 chunk 大于 500 kB。

首次并行运行单元与浏览器时，旧 ShopPreview 逐字文案超过默认 1 秒等待，造成 1 项失败；没有修改其断言或超时，独立全量重跑 777/777 通过。地图等待修正前的浏览器结果为 35/36，失败 trace 与 JSON 保存在 [地图等待竞态证据](../../../dist/reports/s3/browser/attempt-map-race)。这些失败不计作最终通过结果。

浏览器主循环通过实际 UI 点击新建、编队、掷骰/装载/攻击、离场、结算和再次出征；探针只读取应用记录做因果断言。固定初始 seed 只在测试注入，不存在生产 URL 后门。通关、全灭和罕见中断通过正式导入入口准备有效旧存档后操作 UI；它们不等同于从第一层玩到第五层的内容验收。

当前 Catalog 没有 item/equipment 定义。真实浏览器覆盖空库存显示与空包出征；物品/装备实例转交、磨损与归还由测试 Catalog 的应用回归覆盖，不宣称正式内容已有道具可领取。

### 浏览器视觉与追踪

截图以 1600×900 舞台检查，已核对标题、地图、两人/三人战斗、终局、回馆和商店。完整 36 项运行的截图与 trace 归档在 [game-storage](../../../dist/reports/s3/browser/game-storage)，最后弹窗修正后的记录在 [archive-final](../../../dist/reports/s3/browser/archive-final)。这些是忽略的本地验收产物，清理 dist 后会移除；本报告保留结果与复现命令。

| 画面 | 证据 |
| --- | --- |
| 最终档案弹窗 | [居中、列表和导入/导出](../../../dist/reports/s3/browser/archive-final/game-archive-lists-corrupt-23abb-port-creates-a-new-identity-game/archive.png) |
| 五人编队地图 | [Map](../../../dist/reports/s3/browser/game-storage/game--UI-creates-fights-se-779f3--starts-a-second-expedition-game/map-5-members.png) |
| 两人 / 三人战斗 | [两人](../../../dist/reports/s3/browser/game-storage/game-two-member-formation--d4b66-st-retry-use-real-IndexedDB-game/two-member-battle.png)、[三人](../../../dist/reports/s3/browser/game-storage/game--UI-creates-fights-se-779f3--starts-a-second-expedition-game/three-member-battle.png) |
| 回馆 / 商店 | [真实收益与经历](../../../dist/reports/s3/browser/game-storage/game--UI-creates-fights-se-779f3--starts-a-second-expedition-game/mansion-after-settlement.png)、[真实余额与交易边界](../../../dist/reports/s3/browser/game-storage/game--UI-creates-fights-se-779f3--starts-a-second-expedition-game/shop.png) |

## 保留的版本与后续边界

保持 `abyssa.legacy/contentVersion=1/rulesVersion=1`、legacy.rift、旧五人、Battle schema v4 与现有 GameRecord 格式。没有修改冻结 Catalog digest、玩法定稿、美术资源或依赖锁文件。新增的 CurrencyAmount gold 明确标记旧规则金币，没有擅自换算为里拉。

以本轮开始时的 1391 条工作树路径为基准，681 个指定保护路径全部保持原哈希或原删除状态；S3 没有新增删除。没有 reset/clean，也没有重录 956 步黄金轨迹。机器证据见 [保护检查](../../../dist/reports/s3/implementation/protection.json)、[本轮文件清单](../../../dist/reports/s3/implementation/change-manifest.json) 与 [最终验收索引](../../../dist/reports/s3/implementation/verification.json)。不把原工作树中 S0/S1/S2 或用户已有改动计作本轮改动。

新档默认第 1 天晨、零资金、容量 32、空库存。洋馆建设/生产/升级/修缮与手动推进相位、商店买卖/鉴定、托管出征暂不开放。旧经营/商店样本仍在显式原型与测试内。四套战斗皮肤、标题 CG、立绘和转场保留。

S4 继续负责 rp-style-lab 的模型调用、上下文组装与复杂管线。Abyssa 的命令、RNG、存档、资产和结算不依赖宿主；模型只消费受控事实，不获得直接写规则状态的权限。新战术骰、玛丽埃塔、其他副本、物品与经营经济应各自版本化，不借 S3 悄悄更换冻结规则。
