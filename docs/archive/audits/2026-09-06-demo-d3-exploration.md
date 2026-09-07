> 历史档案：2026-09-07文档整理时归档。原路径：`docs/audits/2026-09-06-demo-d3-exploration.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# D3 庄园前三层：源码勘探与开工审计

> 日期：2026-09-06；性质：实施前审计。执行入口：[D3 详细计划](../plans/DEMO_D3_OLD_MANOR_PLAN.md)。
>
> 结论：D1 规则与 D2 读取／角色展示可以复用；D3 的生产内容、非战斗房间、物资／经济和版本化玩家写链路仍需实施。本轮仅修改规划文档，没有把下列缺口标成已修复。

## 1. 本次范围与依据

读取了 [D0 契约](../design/DEMO_D0_SCOPE_AND_CONTRACTS.md)、[D1 实施口径](../design/DEMO_CHARACTER_RULES_REVIEW.md#11-d1-实施口径记录2026-09-06)、[D2 验收](2026-09-06-demo-d2-implementation.md)、总规格与 D3 工作包；核对了 core → application → runtime → client → title／map／battle／mansion 的实际代码，以及庄园本地素材清单／总览。

本次源码行号是勘探时定位，后续实施会变化。以下「缺口」多数是此前明确留给 D3 的工作，不等于 D1/D2 验收失败。

| 可复用项 | 已有依据 |
| --- | --- |
| 正式六人、有效六面、成长／装备解析、四约、力竭／临时锈 | [demo-engine.ts](../../../src/game-core/battle/demo-engine.ts)、[v2 规则](../../../src/game-core/battle/rules/v2/configuration.ts)、D1 实施口径 |
| 版本化记录、严格 Catalog／请求、原子存储与回执 | [demo-service.ts](../../../src/game-application/versions/demo-service.ts)、[versioned-runtime.ts](../../../src/game-runtime/versioned-runtime.ts) |
| 同档只读角色页、真实配置、历史与换档保护 | [browser-reader.ts](../../../src/game-runtime/browser-reader.ts)、[read-session.ts](../../../src/game-client/read-session.ts)、[character-views.ts](../../../src/game-runtime/character-views.ts) |
| 既有 Battle 展示壳、骰子、回执演出队列、红线与雾 | [ExpeditionBattleScreen.tsx](../../../src/apps/battle/ExpeditionBattleScreen.tsx)、[ExpeditionDie3D.tsx](../../../src/apps/battle/ExpeditionDie3D.tsx)、[EnemyMist.tsx](../../../src/apps/battle/presentation/EnemyMist.tsx) |
| 庄园三普通敌人、管家、两张首段背景、地图素材 | [素材清单](../../../src/assets/battle/old-manor/README.md)，本次另查看了[总览](../../design/old-manor/asset-overview.jpg) |

## 2. 源码发现与处理落点

### D3-A01：已有层／room 数字，不等于已有事件房生命周期

[contracts/demo.ts](../../../src/game-core/contracts/demo.ts) 第 68–87 行：enemy behavior 只有四种；route 的 `layers: string[][]` 直接引用 encounter。[demo-state.ts](../../../src/game-core/battle/domain/demo-state.ts) 第 65–101 行：状态必须有 encounter，run 只有数字 layer／room 与基本金币字段。

[demo-engine.ts](../../../src/game-core/battle/demo-engine.ts) 第 32–66、267–302 行：创建和 `continueRoute` 总会建立下一场战斗；后者是受信任 lifecycle primitive，未提供事件／出口／层结算策略。[demo-contracts.ts](../../../src/game-application/versions/demo-contracts.ts) 第 46–60 行也没有 advance-room、choose-event、choose-exit 或 settle-expedition。

**影响**：直接把登记簿和出口放进现有二维数组会被当成遭遇；三层数组结束也不能代表正式首通。需要计划 A/B 的明确 Expedition 节点状态和独立完成／结算凭证。

### D3-A02：角色模块不是可直接发布的完整 Catalog

[demo-v1/README.md](../../../src/content/gameplay/demo-v1/README.md) 明确玛的铭约尚未实现；[demo-validation.ts](../../../src/game-core/contracts/demo-validation.ts) 第 121–125、183–201 行显示，正式 Catalog 校验仍要求铭约引用完整。[demo-fixtures.ts](../../../src/game-runtime/testing/demo-fixtures.ts) 第 17–25 行通过显式置空玛铭约建立 `abyssa.fixture.demo-d1`，它只是测试内容。

[browser-reader.ts](../../../src/game-runtime/browser-reader.ts) 第 8–16 行的生产默认注册仅 legacy。[browser.ts](../../../src/game-runtime/browser.ts) 仍使用旧 runtime。

**处理**：计划选择单独的三层阶段包，以及可区分的「仅资料／可执行」能力声明。所有执行引用仍须完整，延期玛不能出现在任一可出征 profile。不能直接改 fixture 的 ID，不能在已发布五层包上隐藏两层。

**版本影响**：D0 保留的完整 `abyssa.demo` 目标不被三层覆盖；D3 首次对玩家生成的阶段档须冻结内容，D4 保留其 reader。旧 v1 玩家档继续原规则；未发布 v2 fixture 可明确换版本重建。

### D3-A03：生产写链路仍是 v1，遗漏标题／回馆会形成半条路径

- [session.ts](../../../src/game-client/session.ts) 第 1–8、53–56 行：`GameRecord`、`GameCommand`、`protocolVersion: 1`。
- [useTitleArchive.ts](../../../src/apps/title/useTitleArchive.ts) 第 1–17、47–79 行：创建、继续、导入依赖旧 runtime／旧 expedition 字段。
- [MapPage.tsx](../../../src/apps/map/MapPage.tsx) 第 39–49 行：只有 `tower` 发 start-expedition；携带品来自旧 inventory，routeId 来自旧 gameContent。
- [useExpeditionBattleController.ts](../../../src/apps/battle/controller/useExpeditionBattleController.ts) 第 26–38 行和 [battle-view-model.ts](../../../src/apps/battle/presentation/battle-view-model.ts) 第 1–15、46–88 行：旧 expedition／旧动作命令，静态 CHARACTERS／MAX_HP。
- [CampaignPanel.tsx](../../../src/game-client/CampaignPanel.tsx) 的 appliedSettlements、inventory、继续入口和事实文案均按旧记录读取。

**处理**：计划 E/F 覆盖标题、菜单、地图、战斗、回馆和角色读取适配。Battle 复用既有视觉组件，用语义 DTO 接新规则，不以类型强转复用旧命令推断。角色页继续只读。

### D3-A04：恢复只有敌回合分类，固定六步不能承载新流程

[versioned-views.ts](../../../src/game-runtime/versioned-views.ts) 第 143–210 行的 v2 continuation 只包含 resolve-next-enemy、next-round、最后击杀后的 end-turn；没有房间、入袋和终局。[session.ts](../../../src/game-client/session.ts) 第 65–90 行每个 execute 最多六步。

[versioned-pending-request.ts](../../../src/game-client/versioned-pending-request.ts) 第 33–41 行对非 start 的 v2 请求要求当前 activeRunRef 匹配。D3 结算将清空该字段，必须区分「已提交旧请求待确认」和「另一趟的失效操作」。

**处理**：明确 automatic／waiting／terminal 分类，一步一提交并检查进展；超过六步的合法链可分批继续，事件／走廊／出口等待玩家。pending 先确认回执与身份，不盲目重发或因 run 已结束丢失确认。D2 read-session 不参与恢复。

### D3-A05：正式敌人与道具需要补目标域和校验，不只是内容表

[lifecycle.ts](../../../src/game-core/battle/rules/v2/lifecycle.ts) 第 35–56、68–88 行已有攻击、蓄力和安排下一轮封锁，可沿用确定性目标与 cursor；没有女佣修复、管家循环定义。

[validation.ts](../../../src/game-core/battle/rules/v2/validation.ts) 第 275–309 行限制 rerolls 为 0–2，并要求 act 阶段的存活未封锁骰已有 faceIndex；第 337 行之后的 intent target 只校验为队员 ID。

**具体冲突**：封锁骰初次 ROLL 被跳过，若圣水只把 sealed 改为 false，act 状态仍会留下没有面的骰而无法通过当前验证；幸运符 +1 也会触碰硬上限。

**处理**：计划 C/D 增加修复敌方目标域、管家阶段；圣水补掷只有被解除且无面的那一颗，同一事务提交；重掷次数依据实际额外额度验证。不能仅放宽成任意大数或接受非法空面状态。

### D3-A06：v2 有金币累积，没有正式入袋／失败／配给结算

[combat.ts](../../../src/game-core/battle/rules/v2/combat.ts) 第 77–79、280–283 行分别加基础赏金和扣昂贵治疗散金；[demo-engine.ts](../../../src/game-core/battle/demo-engine.ts) 第 199–203 行累加每回合牌型。[session/demo.ts](../../../src/game-core/session/demo.ts) 第 10–18 行没有库存、结算凭证或非战斗运行状态；第 55–57 行仍将成长 progress 严格限定为创建 profile。

**风险推导**：若直接把累计 handBonus 接入最终乘法，长期拖延战斗就能放大收益；当前没有可供庄园使用的经济封顶政策。这是源码推导，不是本轮已复现的生产刷钱漏洞，因为生产尚未发布该经济。

**处理**：计划 B/D 给出实际绑定配给、层结算和终局账本；P10 推荐累计加成上限，并与 D1 牌型／铭约分开。保留成长验证不变；不要将物资塞入 progress 然后取消反伪造限制。

**已定口径复核**：D0 已确定补足绑定配给、只返还剩余、失败只损本趟、零货币开局及结算推进一相位。本次未重新把它们列成待确认。只将上限、赏金／倍率、事件成本和奇数折半列为待模拟候选。旧水杯 +10G 属于本次排除的小件，不进入 D3。

### D3-A07：事实与导入必须带新增节点及终局上下文

[demo-validate.ts](../../../src/game-application/versions/demo-validate.ts) 第 111 行起的事实白名单主要是战斗事实，expedition-started 仅含 runId，未覆盖道具、事件、层入袋和结算。[demo-service.ts](../../../src/game-application/versions/demo-service.ts) 第 68–101 行的 fact mapper 从提交后 snapshot 取 activeRunRef／encounter；若结算先清空运行，新结果就会失去归属。

**处理**：start 补实际 partyIds，转换携带原 run／room／layer／terminal 上下文；新增事实逐项严格验证，终局记事不重复。扩展 [demo-import.ts](../../../src/game-application/versions/demo-import.ts) 的身份映射与反向引用检查，复制已结算档不会重领。保留 simulation／originRef／撤回与可见性过滤，不提前接 LLM。

### D3-A08：美术足够开始首段接线，专用动作帧和取景仍未验收

[expedition-visuals.ts](../../../src/apps/battle/presentation/expedition-visuals.ts) 的 ENEMY_ART 仍是裂隙三怪；[map/types.ts](../../../src/apps/map/types.ts) 第 1–6 行只导入现有三地标，[createMapScene.ts](../../../src/apps/map/createMapScene.ts) 的路线绘制按 cave／tower／church 取点。庄园图不能靠改显示名称自动接入。

本地素材核对：四张 D3 敌人图都是 1376×768 透明 PNG；前两张背景为 1376×768 JPG；庄园地标为 1408×768 PNG（尺寸来自归档清单）。总览确认三只普通怪、屏风管家身份正确，无分餐侍从。已确认 [battle-frame-threads.svg](../../../src/assets/ui/old-manor/battle-frame-threads.svg) 及对应[装饰说明](../../../src/assets/ui/old-manor/README.md)。

[EnemyMist.tsx](../../../src/apps/battle/presentation/EnemyMist.tsx) 现有单 canvas、24Hz 绘制、隐藏页暂停、reduced-motion 和 context 恢复逻辑；[ExpeditionDie3D.tsx](../../../src/apps/battle/ExpeditionDie3D.tsx) 保留 memo 六面和既有滚动算法。D3 应接状态和素材标定，不默认重写这些已确认表现。

专用举盘／闭门帧未在素材批次中提供；静态整图不能宣称已经完成相应姿态动画。D3 先以可读意图、现有图和轻量反馈做到工程可玩，记录表现限制。千金碎刀／断线／沉睡拆层在 D4，不阻塞前三层规划。

## 3. 待实施决策的状态

| 项 | 继承的确定部分 | 本轮推荐但未实现／未配平 |
| --- | --- | --- |
| P07 | 七件效果、四槽、两件／轮、食物胃口、绑定配给方案 | 4/2/2/2/1/1/2 上限，默认食物／药水／护符／圣水，净化只处理已实现封锁，解除后补掷 |
| P08 首段 | 三小怪基础数值，管家封锁＋3伤，不使用废稿 | 女佣锁定修复对象；管家 HP16 起测、封锁／落幕两阶段；无额外杂兵 |
| P09 | 手写事件、可略过、确定性结果，不靠 LLM | 登记簿无骰；遗物单人强弱判定、2G费用／4G成功奖励、独立事件 RNG、卦签范围 |
| P10 | 只扣本趟、一次层倍率、零资金仍可配给再尝试 | 3/5/3/12赏金，1/1.25/1.5深度，层经济 +2封顶，四舍五入及失败向下折半 |
| 发布策略 | v1旧档旧玩法；完整五层不能伪装已经发布 | 独立三层阶段包、六人资料与五人执行的能力声明、发布后冻结 |

具体例子、候选对比和实施落点以[计划](../plans/DEMO_D3_OLD_MANOR_PLAN.md)为唯一执行表。本报告不要求额外确认；用户若随后授权实施 D3，先按该表落到实施记录，再用模拟决定实际数值。

## 4. 本轮实际验证

环境使用仓库要求的 Node 22.23.2：`/tmp/abyssa-s0-toolchain/node-v22.23.2-darwin-arm64/bin`；Vitest 3.2.7。未启动浏览器服务、未访问玩家 IndexedDB、未停止或重启 5190。

| 检查 | 实际结果 | 本地日志 |
| --- | --- | --- |
| v2规则、应用事务、角色查询、版本pending、执行会话 | **5文件／61项通过**：37＋7＋6＋1＋10 | [targeted-tests.log](../../../dist/reports/demo-d3/exploration/targeted-tests.log) |
| 模块边界 | **508 source files／73 core production files；无非预期违规** | [boundaries.log](../../../dist/reports/demo-d3/exploration/boundaries.log) |
| 素材核对 | 读取正式清单与总览，确认 D3 四敌／两背景／地图图标已有文件 | [素材清单](../../../src/assets/battle/old-manor/README.md) |

测试复现：

```bash
npm exec vitest -- run \
  src/game-core/battle/testing/demo-rules.test.ts \
  src/game-application/testing/demo-application.test.ts \
  src/game-client/versioned-pending-request.test.ts \
  src/game-client/session.test.ts \
  src/game-runtime/testing/character-views.test.ts
npm run boundaries:check
```

本次没有重跑全量 848 项／46 项浏览器用例，也没有重新构建或测 Battle 性能。那些数字仅属于 [D2 实施验收](2026-09-06-demo-d2-implementation.md)。新敌人、新路线、新物资／经济尚未实现，因而本轮没有可报告的庄园胜率、时长或性能改善。D3 执行时再获取当前 Battle 基线和完整验收证据。

## 5. 变更保护与交付

勘探时工作树已有大量前序迁移、界面和素材的未提交改动。本轮写文件前记录了 **1508 个受 Git 管理或未忽略路径**的哈希／缺失状态；未 reset、clean 或批量暂存。

规划交付包含本报告、[详细计划](../plans/DEMO_D3_OLD_MANOR_PLAN.md)，以及 README／总计划／当前状态入口的更新。开工基线、检查日志、最终文件差异记录位于 `dist/reports/demo-d3/exploration/`，属于本地可再生成报告；正文不依赖这些临时产物存在才可理解。

最终文档链接与文件差异校验见 [verification.json](../../../dist/reports/demo-d3/exploration/verification.json)。本轮完成的是「D3 可以按计划开工」，不是「D3 庄园已经可玩」。
