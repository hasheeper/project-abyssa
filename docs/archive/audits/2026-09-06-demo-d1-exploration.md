> 历史档案：2026-09-07文档整理时归档。原路径：`docs/audits/2026-09-06-demo-d1-exploration.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# DEMO D1 勘探审计

日期：2026-09-06。范围：正式角色规则、版本装配、持久化、查询和既有测试基线。对应[详细计划](../plans/DEMO_D1_CHARACTER_RULES_PLAN.md)。

## 1. 结论

**D1 可按版本与配置先行的顺序实施；当前还不能靠替换角色数组直接进入正式内容。** 旧底座具有确定性执行、原子事务和恢复能力；缺口集中在规则 2 的表达、结束回合、独立遭遇生命周期和按档案查询。

本轮只勘探、运行既有验证并更新 Markdown，没有创建正式 Catalog、修改游戏源码、迁移档案或启动 D1 规则实现。三项已定选择保持：先通庄园再回忆开放玛、Lv.3／两件空面装备、重排敌方阵位。

## 2. 源码发现与实施影响

| ID | 证据 | 现状与影响 | 计划处理 |
| --- | --- | --- | --- |
| F01 | [catalog.ts](../../../src/game-core/contracts/catalog.ts)、[catalog-validation.ts](../../../src/game-core/contracts/catalog-validation.ts) | CatalogRef／BattleCatalog 的 rulesVersion 是字面量 1，校验器拒绝其他规则；旧 Catalog 还强制需要路线、召唤及狂暴定义 | A：新增正式契约和完整引用校验；不伪造庄园路线满足旧表 |
| F02 | [create-runtime.ts](../../../src/game-runtime/create-runtime.ts)、[service.ts](../../../src/game-application/service.ts)、[validate.ts](../../../src/game-application/validate.ts) | runtime 注入唯一 legacy Catalog；应用 validate 闭包绑定单包，record／archive 均只收版本 1 | A/F：先解析信封、按版本和内容身份分流，再做严格校验 |
| F03 | [state.ts](../../../src/game-core/battle/domain/state.ts) | FaceDef 没有 faceId、命数或花色；CharacterDef 没有主副色、成长、铭约元数据；玩家 maxHP 当前来自全局平衡常量 | B：正式配置类型；maxHP 从已解析角色配置读取，初值沿既定设计 |
| F04 | [dice.ts](../../../src/game-core/battle/rules/dice.ts)、[state-helpers.ts](../../../src/game-core/battle/rules/resolver/state-helpers.ts) | rustLevel 按基础素→金顺序推导退化；力竭时只增加计数 | B/E：临时锈记录具体面和来源；保持旧路径不改 |
| F05 | [hand.ts](../../../src/game-core/battle/rules/hand.ts) | 有效骰只排除封锁／力竭／未掷；没有命数过滤或同花；枚举万能但结果不保存最终代点 | D：同一快照、唯一代点、贡献者与独立铭约真值表 |
| F06 | [actions.ts](../../../src/game-core/battle/rules/actions.ts)、[battle-view-model.ts](../../../src/apps/battle/presentation/battle-view-model.ts) | attack／guard 接受 wild，heal 只接受 heal；UI 的 wild 点友方走格挡 | C/F：三向行动能力与明确命令；D3 才接正式选择交互 |
| F07 | [actions.ts](../../../src/game-core/battle/rules/actions.ts)、[combat-effects.ts](../../../src/game-core/battle/rules/resolver/combat-effects.ts) | attack 在 resolver 前按基础 power 判断 lethal 和赏金，而实际伤害会经过 modifier | C：正式规则按实际死亡结果派生奖励，覆盖顺劈和铭约；不是改旧轨迹 |
| F08 | [effect-runtime.ts](../../../src/game-core/battle/rules/effect-runtime.ts)、[reactions.ts](../../../src/game-core/battle/rules/reactions.ts)、[action-effects.ts](../../../src/game-core/battle/rules/action-effects.ts) | 有通用队列、modifier／reaction 模板；默认 reaction registry 为空，action-effect 展开目前只处理治疗扣款 | C/D：配置 ID 必须匹配可执行纯处理器；铭约显式由回合收束编排 |
| F09 | [turns.ts](../../../src/game-core/battle/rules/turns.ts)、[lifecycle-effects.ts](../../../src/game-core/battle/rules/resolver/lifecycle-effects.ts) | prepareEnemyTurnTransition 结算手牌及拖延规则并冻结敌序；没有正式四约；prepare 会清 undoStack | D/F：明确不可撤回边界、手牌＋铭约原子提交、之后恢复敌队列 |
| F10 | [state-helpers.ts](../../../src/game-core/battle/rules/resolver/state-helpers.ts)、[settlement.ts](../../../src/game-core/battle/rules/settlement.ts)、[projection.ts](../../../src/game-core/session/projection.ts) | 最后敌人死亡和最终结算都存在 layer-cleared 事件；encounter ID 和定义按层号生成／查询 | A/E：v2 区分遭遇结束和层入袋；同层两战必须可表示、身份唯一 |
| F11 | [expedition.ts](../../../src/game-core/battle/rules/expedition.ts)、[state.ts](../../../src/game-core/battle/domain/state.ts)、[lifecycle.ts](../../../src/game-core/battle/rules/lifecycle.ts) | 归队发生在 startLayer；EffectDurationScope 没有 encounter；敌人死亡保留实体但取消意图，召唤追加数组 | C/E：独立场次生命周期、存活阵位、状态边界及归队标记 |
| F12 | [session/state.ts](../../../src/game-core/session/state.ts)、[campaign.ts](../../../src/game-core/session/campaign.ts) | Campaign 有库存及 availableCharacterIds，没有成长领取和篇章进度；出征转移库存实例但未解析正式六面成长 | A/B：定义长期来源与冻结配置；真实获取和解锁命令仍在 D5 |
| F13 | [service.ts](../../../src/game-application/service.ts)、[facts.ts](../../../src/game-application/facts.ts)、[validate.ts](../../../src/game-application/validate.ts) | 导入按 `:encounter:` 后缀和层号重建 ID，fact.origin 改为 imported；事实 schema 与 kind 白名单严格固定 | F：显式引用重映射、来源与语义分离；新增事实双向校验 |
| F14 | [views.ts](../../../src/game-runtime/views.ts)、[battle-view.ts](../../../src/game-runtime/battle-view.ts)、[live-roster.ts](../../../src/apps/map/sortie/live-roster.ts)、[session.ts](../../../src/game-client/session.ts) | 查询和角色常量绑定 legacy；自动 continuation 与 client 命令固定 protocol 1 | F：按 record 查询与发请求，防止新规则正确但页面读旧值 |
| F15 | [resolver.ts](../../../src/game-core/battle/rules/resolver.ts)、[transaction.ts](../../../src/game-application/transaction.ts)、[indexeddb.ts](../../../src/game-infrastructure/storage/indexeddb.ts) | resolver 在副本上同步原子执行，有 256 事件／8 层默认预算；存储在事务完成后返回，支持 CAS 与回执去重 | 继续利用现有约束；新规则别绕过提交或分刀发存储请求 |
| F16 | [ai.ts](../../../src/game-application/ai.ts)、[facts.ts](../../../src/game-application/facts.ts) | AI 消费可见的事实投影，当前 AI 请求是独立版本 1 且用 expeditionId | F：v2 事实投影适配与旧协议分别处理；不因 D1 自动启动真实 LLM 接入 |

F01–F14 是正式规则接入差距，不代表旧行为都应当立即修成新设计。特别是旧金币公式、默认脸、终局事件和导入格式，要保留在 legacy 分支。

## 3. 需要纠正的实施预期

1. **D1 不能只做 Catalog。** schema／请求／回执／查询均需识别规则 2，但不必在本阶段把五层庄园、回忆和获取事件写完。
2. **六面能力与铭约不是同一交付。** D1 可以完整验证玛六面；没有自动排列卡时不能宣称完整五约。
3. **“重排敌方阵位”有下一回合的收益时机。** 铭约位于回合末，不能倒回重算刚才的顺劈。阵位持久方式和自动策略交 D5 细化，D1 先分开阵位与执行队列。
4. **Lv.3 不只是所有数值加一。** 艾现行净化、柯／艾的互异目标、诺逐刀随机、凯尔团队变金都必须覆盖；Lv.5 溢伤等不混入。
5. **有通用效果类型不等于内容已经能用。** 正式处理器注册、状态持续和目标校验仍须实际实现和测试。
6. **旧场次等于层的假设必须在规则阶段拆开。** 否则 D3 的房间会迫使再次修改归队、奖励、状态和导入格式。
7. **空面装备的范围还缺一句定义。** 原文未明确改写全部空面还是指定一面，已补入 R07；两件装备范围不重开，但不能擅自决定柯的三个空面如何变化或提前增加选面 UI。

本轮给出了 R01–R06 的细则推荐、阶段依赖与例子，没有把这些推荐统一改成用户定稿，也没有再次索要三项已确认方向。

## 4. 实际基线检查

先记录 1,454 个 tracked／非忽略 untracked 路径的内容摘要，包括已有删除；保留 S0–S3、战斗 UI 与素材的既存工作树改动。

本机默认 Node 为 23.11.0／npm 10.9.2，不满足仓库约定。本轮使用已有 `/tmp/abyssa-s0-toolchain/node-v22.23.2-darwin-arm64/bin`，实测 Node 22.23.2／npm 10.9.8；未安装依赖、改全局环境或修改 lockfile。

| 检查 | 本轮结果 |
| --- | --- |
| `npm run typecheck:core` | 通过 |
| `npm run typecheck:application` | 通过 |
| `npm run typecheck:app` | 通过 |
| `npm run boundaries:check` | 通过；462 个源码文件，62 个 core 生产文件，无额外违规 |
| `node node_modules/vitest/vitest.mjs run --project core --project application` | 20 个测试文件，213 项测试通过；3.02s |
| `npm run check:core:import` | 通过；core/application 纯依赖闭包、124 个兼容导出、5 趟无界面应用远征完成结算 |

core 测试包含冻结抽取轨迹、旧存档、效果、RNG 和不变量；application 测试包含命令、库存、回执、撤回和 AI 投影。这些是既有能力的基线，不证明尚未实现的 36 面／正式铭约已经通过。

日志保存在本机临时目录 `/var/folders/2t/qp430h4s28lfj8fwhfj3trdc0000gn/T/abyssa-d1-planning-_gp2ox6t/`。`check:core:import` 还按其现有行为重建忽略目录 `dist/reports/s2/import`；不把其中路径的 S2 名称当成本轮新增功能。

本轮没有运行新的浏览器存储／页面 smoke、远程 CI、整包发布或性能压测；没有接触用户 5190 服务和真实玩家档案。后续 D1 跨版本存储验证仍必须实际执行，不能借用这次 Node 内测试替代。

## 5. 文档交付与停止点

新增详细 D1 计划与本审计；更新总计划、定稿讨论单及上位索引，让“D1 勘探规划完成”和“D1 代码未实施”可区分。

详细计划已覆盖 A–G 工作包、候选文件、类型／命令／状态分工、规则例子、RNG 和原子提交、导入、查询、验收矩阵及 D2/D3/D5 交接。

文档核验：本轮路径摘要从 1,454 项变为 1,456 项，仅新增 2 份 Markdown、更新 6 份已有 Markdown；未改变非文档路径。8 份改动文档中的 154 处本地链接／锚点全部解析成功；代码围栏配对，D1.1–D1.8 实施项仍未勾选。未创建 `src/content/gameplay/demo-v1/`。

下一步的首个实施批次是版本分流和配置解析。正式角色规则实现尚未开始；本轮结束在用户要求的勘探与规划交付处。
