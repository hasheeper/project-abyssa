# 游戏装配层

本层装配内容、纯规则、应用服务与外部适配，向[game-client](../game-client/README.md)提供查询与驱动。规则层不依赖runtime，UI组件包不发布runtime。

## 当前入口与版本

[player-runtime.ts](player-runtime.ts)中的`PLAYER_CATALOGS`是完整注册表。当前`defaultCreation`为协议4／内容28；正常起点（序章、清晨、教程、自由行动）共用正式AIRP内容28。无LLM游玩与商店初见放在调试入口，使用内容27；早期18／19只保留协议兼容。所有读取按Catalog ID、版本和摘要选择，不自动替换旧包。

| 装配 | 内容 | 用途 |
| --- | --- | --- |
| `estate-context.ts` | 27／28 | 无LLM调试／当前统一流程，周一公款与单项施工 |
| `facilities-context.ts` | 25／26 | 冻结前版，真实设施供应与免费启用 |
| `shop-wave-context.ts` | 23／24 | 日期商店与九件装备的冻结前版 |
| `airp-game-context.ts` | 22 | 正式AIRP副本／节点／结算底座 |
| `ordinary-drops-context.ts` | 21 | 两地普通掉落表 |
| `tide-reef-context.ts` | 20 | 三层溶洞与早期固定掉落 |
| `airp-direct-context.ts`／`airp-director-context.ts` | 18／19 | 早期直连试读／总调度 |
| `copper-economy-context.ts` | 17 | 铜G经济与教学四件物 |
| 其余登记项 | legacy、旧庄园、demo 1～16 | 原版本恢复与显式兼容 |

`createNewGame`先创建，再以独立幂等请求提交`select-game-start`，成功后才导航。快捷起点奖励只随起点事实一次发放；不生成虚假战斗、默认分支或时间流逝。新完整SHOP首访按物品来源与实际持有判断，不能仅看旧介绍的豁免标记。

新起点事实带`openingFlowVersion: 1`，正常完成或跳过教程后开放AIRP，无需先完成庄园首通。教程沿用固定演出和教学规则，生成驱动在教学期间不初始化；教程结束后在原存档继续日度、出征和场景流程。跳过时解锁同名的两条教程记忆，正文引用起点事实并注明`acquisition: tutorial-skip`，不补造选择或战斗记录。旧档没有这个标记，读取与创建重试仍沿用原内容和原命令。

`continueSave`是另一路受限复制升级／二周目接口，默认目标仍9，显式可选8／9／10；不是把旧档升级到27／28。普通另存、在线活动链的复制限制、原身份恢复分别校验。

## 会话、查询和存储

`queries.memoryJournal`只投影可核对的阅读与选择回执，统一为事件／幕／切片；生成完成或仅进入阅读不代表已读。连续的洋馆事件与同趟远征跨日延续，远征节点按幕回想，参与者包含已读场景中没有发言的人物。概述使用公开的场景信息，不输出GM规划、动机或未读后续。回想由client维护独立游标，撤回或改动来源时立即关闭，浏览、筛选、回想均不写存档或请求模型；缺少场景资料的早期记录保留文字阅读。

- [browser.ts](browser.ts)：浏览器runtime与存储装配，创建时取得平台能力。
- [versioned-runtime.ts](versioned-runtime.ts)：按版本分流创建、读取、命令、恢复、导入导出和复制。
- [catalogs.ts](catalogs.ts)：校验并冻结Catalog及记录；外部对象不因head相同跳过校验。
- [versioned-views.ts](versioned-views.ts)：角色、战斗、队伍、续行与历史查询；DTO版本不等于命令协议。
- [browser-reader.ts](browser-reader.ts)：只读角色页，不自动推进战斗命令。
- [facilities-view.ts](facilities-view.ts)、[equipment-view.ts](equipment-view.ts)：同一存档的生产／配装投影，不在查询中产生物品。
- [save-slots.ts](save-slots.ts)、[save-presentation.ts](save-presentation.ts)：手动槽位与列表摘要，日期只读真实记录，不补造历史时间。
- `legacy-battle.ts`和`testing/`分别服务显式兼容与夹具，不进入正式玩家闭包。

命令保持expectedHead／clientRequestId及CAS语义，请求ID与种子在首次创建时确定，重试不另造。resume只推进合法的已保存位置，再查continuation；UI不直接patch资产。池化存档导入先解包，再按原内容引用与事实链验证。

## AIRP与资源

正式AIRP的三槽配置共用[airp-configuration.ts](airp-configuration.ts)，日度／场景、出征、节点、结算由各自驱动执行。浏览器直连、资料、权限和旧rp兼容见[LLM与AIRP](../../docs/architecture/LLM_AND_AIRP.md)，后台任务由client按存档身份接管。

内容28的角色资料、Low与居住安排统一由[airp-director-configuration.ts](airp-director-configuration.ts)装配：原四人加艾比希斯、玛丽埃塔。正式流程在教程结束或跳过后，以可重放的`airp-director-enable-residents`事实初始化六人，无需填写连接或生成今日安排；随后同步六人结算政策。已有内容28四人档在安全洋馆节点自动补齐，原连接、预设、剧情帧、游标和战斗名单保留；进行中的请求、远征和未完成结算先沿用原输入，完成后再升级。新建时旧`airp-demo`／`airp-director`别名统一为自由行动，旧内容装配隔离在[historical-airp-configuration.ts](historical-airp-configuration.ts)，仅供既有存档兼容，不创建旧版AIRP档。

`createReactions`仍是legacy反应适配，不能代指正式AIRP。正常开局的教程不调用模型，之后进入正式AIRP；无LLM的固定玩法放在调试入口。不从旧适配器是否开启推断正式AIRP状态。

[应用层](../game-application/README.md)维护事务契约，[游戏总览](../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)维护玩法。正式路由、章节、掉落、货架和设施分别从版本化数据装配，避免在本文重复逐阶段施工流水。
