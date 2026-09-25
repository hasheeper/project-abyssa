# 游戏装配层

本层装配内容、纯规则、应用服务与外部适配，向[game-client](../game-client/README.md)提供查询与驱动。规则层不依赖runtime，UI组件包不发布runtime。

## 当前入口与版本

[player-runtime.ts](player-runtime.ts)中的`PLAYER_CATALOGS`是完整注册表。普通`defaultCreation`为协议4／内容27；`createNewGame`对`airp-director`选择内容28，对`airp-demo`保留早期18，其余正常起点为27。所有读取按Catalog ID、版本和摘要选择，不自动替换旧包。

| 装配 | 内容 | 用途 |
| --- | --- | --- |
| `estate-context.ts` | 27／28 | 当前普通／正式AIRP，周一公款与单项施工 |
| `facilities-context.ts` | 25／26 | 冻结前版，真实设施供应与免费启用 |
| `shop-wave-context.ts` | 23／24 | 日期商店与九件装备的冻结前版 |
| `airp-game-context.ts` | 22 | 正式AIRP副本／节点／结算底座 |
| `ordinary-drops-context.ts` | 21 | 两地普通掉落表 |
| `tide-reef-context.ts` | 20 | 三层溶洞与早期固定掉落 |
| `airp-direct-context.ts`／`airp-director-context.ts` | 18／19 | 早期直连试读／总调度 |
| `copper-economy-context.ts` | 17 | 铜G经济与教学四件物 |
| 其余登记项 | legacy、旧庄园、demo 1～16 | 原版本恢复与显式兼容 |

`createNewGame`先创建，再以独立幂等请求提交`select-game-start`，成功后才导航。快捷起点奖励只随起点事实一次发放；不生成虚假战斗、默认分支或时间流逝。新完整SHOP首访按物品来源与实际持有判断，不能仅看旧介绍的豁免标记。

`continueSave`是另一路受限复制升级／二周目接口，默认目标仍9，显式可选8／9／10；不是把旧档升级到27／28。普通另存、在线活动链的复制限制、原身份恢复分别校验。

## 会话、查询和存储

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

`createReactions`仍是legacy反应适配，不能代指正式AIRP。默认普通游戏不依赖模型服务；不从旧适配器是否开启推断正式AIRP状态。

[应用层](../game-application/README.md)维护事务契约，[游戏总览](../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)维护玩法。正式路由、章节、掉落、货架和设施分别从版本化数据装配，避免在本文重复逐阶段施工流水。
