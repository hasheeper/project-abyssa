> 历史档案：2026-09-07文档整理时归档。原路径：`docs/audits/2026-09-06-demo-d4-exploration.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# D4 规划前勘探审计：五层、千金与首通

> 日期：2026-09-06；性质：**源码与资产审计，非 D4 实施验收**。
>
> 执行计划：[D4 详细计划](../plans/DEMO_D4_OLD_MANOR_PLAN.md)。本轮仅编写文档与更新入口，没有修改游戏代码、素材、存档或运行服务。

## 1. 结论与证据边界

现有三层庄园已经进入原共享战斗界面，可以作为 D4 的接线基础。D4 的主要工作是补充末两层的状态和内容：动态伤害意图、有限补席、Boss 解除胜利、末层终局、首通凭证、恢复及维护路线。不是重新制作战斗页面。

阅读范围涵盖 D0 契约、总规格和实施计划、庄园设计稿、D3 最新纠偏报告，以及当前 content／core／application／runtime／client／页面接线和本地资产。下面的行号是本轮工作树定位，后续实施可能变化；被列为“缺口”不表示 D3 承诺过实现 D4 功能。

本轮未运行游戏测试、浏览器或配平模拟。D3 已有结果引用[纠偏报告](2026-09-06-d3-ui-correction.md)，不冒充本轮新验证。开工前对 1451 个现有仓库文件记录哈希，用于验证本次变更仅涉及规划文档；临时记录位于 `/tmp/abyssa-d4-planning-baseline-20260906.json`，不作为产品依赖。

## 2. 实际实现与 D4 缺口

| 级别 | 证据位置 | 当前行为 | D4 必须处理 |
| --- | --- | --- | --- |
| 版本 | [player-runtime.ts](../../../src/game-runtime/player-runtime.ts)，10／22 行 | 只注册 legacy 和 manor-segment，新建默认协议 2 | 完整包单独注册，默认切换放在验收后；旧包不变 |
| 版本 | [catalogs.ts](../../../src/game-runtime/catalogs.ts)，8／46 行；[versioned-runtime.ts](../../../src/game-runtime/versioned-runtime.ts) | schema／protocol 与 rules 同号，分支多为 1 或 else 2 | 显式 v3 reader／service／查询／导入路由，不能仅改 Catalog 字符串 |
| 内容 | [manor.ts](../../../src/content/gameplay/demo-v1/manor.ts) | 三层、4 敌、2 事件、2 场景、不可深入出口 | 新包提供五层首通和维护；保留阶段包 digest |
| 意图 | [demo-state.ts](../../../src/game-core/battle/domain/demo-state.ts)，24 行；[lifecycle.ts](../../../src/game-core/battle/rules/v2/lifecycle.ts)，12／62 行 | attack 伤害数字在回合开始写入，执行读取该值减 blocked | 需要公式来源＋统一实时求值；保留格挡与锁定目标 |
| 召唤 | [demo.ts](../../../src/game-core/contracts/demo.ts)，70／79 行；[validation.ts](../../../src/game-core/battle/rules/v2/validation.ts)，373 行 | 无 Boss／召唤定义；校验要求历史实体定义序列等于初始编队 | 新版登记生成来源、序号、出生轮、席位和有限储备；不能直接取消组成校验 |
| 胜利 | [combat.ts](../../../src/game-core/battle/rules/v2/combat.ts)，53／133 行；[validation.ts](../../../src/game-core/battle/rules/v2/validation.ts)，381／449 行 | HP归零即普通死亡赏金；阵位含所有活敌，活敌存在则不能胜利 | 区分 defeated／released；Boss 解除策略与普通清场分别验证 |
| 时序 | [demo-engine.ts](../../../src/game-core/battle/demo-engine.ts)，194–229 行附近 | end-turn 结牌、冻结敌方顺序、执行铭约，再判胜负 | 保留最后回合一次收益；补席不插入当前队列；同批伤害后解除 |
| 路线 | [demo-journey-validation.ts](../../../src/game-core/contracts/demo-journey-validation.ts)，62 行；[demo-expedition.ts](../../../src/game-core/session/demo-expedition.ts)，71 行 | 末房必须 exit；terminal 只有 extracted／wipe | v3 增加末层完成策略与 cleared；不把救离当作普通撤离 |
| 事件 | [demo.ts](../../../src/game-core/contracts/demo.ts)，101 行；[demo-items-events.ts](../../../src/game-core/session/demo-items-events.ts) | 只有 register／relic | 补空席核对，读／略过、免费、无 RNG；卦签按事件内容显示 |
| 首通资金 | [session/demo.ts](../../../src/game-core/session/demo.ts)，67／146 行 | party funds 必须等于普通结算之和；无首通／奖励凭证 | 增加受验证的奖励来源账本；禁止把首通币发两次或放宽金额校验 |
| 解锁 | [session/demo.ts](../../../src/game-core/session/demo.ts)；[character-views.ts](../../../src/game-runtime/character-views.ts) | 成长必须等于 profile，角色可用性主要来自 profile | 首通只派生维护／回忆前置；继续锁玛与成长写操作 |
| 事实 | [demo-validate.ts](../../../src/game-application/versions/demo-validate.ts)，112 行起 | 严格字段白名单；未登记席位变化、召唤、接管、首通奖励 | v3 有明确载荷与来源校验，导入和撤回同步 |
| 长期反馈 | [manor-log.ts](../../../src/game-runtime/manor-log.ts)；[ai/local.ts](../../../src/game-infrastructure/ai/local.ts) | 庄园日志依赖 active run；本地 AI 适配仍是 v1 通用短句 | 从长期结算与首通证据作本地投影；不强迫新流程接旧 AI 协议 |
| 多路线投影 | [demo-journey-view.ts](../../../src/game-runtime/demo-journey-view.ts)，23／28 行 | defaultRouteId 静态，layerCount 从默认路线取 | 根据档案进度、活动 route 查询；同时在出征命令校验前置 |
| 内容文字 | [MapPage.tsx](../../../src/apps/map/MapPage.tsx)，179 行附近；[ManorBattleBinding.tsx](../../../src/apps/battle/ManorBattleBinding.tsx)，181 行；[manor-log.ts](../../../src/game-runtime/manor-log.ts) | 委托、出口和非失败终局描述固定为“三层／管家考核” | 用 route 和结果原因提供文案；保持原组件／class／布局 |
| 终击表现 | [useManorBattlePresentation.ts](../../../src/apps/battle/controller/useManorBattlePresentation.ts)，207 行；[manor-battle-model.ts](../../../src/apps/battle/presentation/manor-battle-model.ts)，109 行 | 通用 lethal→defeat，hp≤0→defeated | Boss 解线与宾客解除走专用实体表现，避免错误死亡动画 |

持久化、CAS、请求回执、逐项敌方恢复和共享 UI 已有，不需要再建设任务平台、通用剧情 DSL 或第二个战斗系统。新增版本是为了保留已发布档案的解释，不是允许重新定义角色六面、牌型和旧战斗行为。

## 3. 资产核对

依据：[庄园资产清单](../../../src/assets/battle/old-manor/README.md)、[当前表现映射](../../../src/content/presentation/old-manor.ts)。本轮直接查看了千金 PNG，并读取文件尺寸。

| 项 | 核到的状态 | 影响 |
| --- | --- | --- |
| 宴会厅 | [banquet-hall.jpg](../../../src/assets/backgrounds/old-manor/banquet-hall.jpg)，1376×768 | 本地文件存在；当前映射仅迎客门厅／服务走廊，尚未接入 |
| 千金 | [last-seat-puppet-heiress.png](../../../src/assets/battle/old-manor/last-seat-puppet-heiress.png)，1216×832，透明整图 | 横向桌裙、刀具、吊线在同图；可用于静态取景，不能当成已拆层 |
| 碎刀／断线 | 清单明确缺逐排碎裂、吊线切断独立层；目录未见对应资产 | 需修复无刀／无线底图并拆层，否则覆盖特效后原像素仍在 |
| 脱落／沉睡／抱起 | 未提供相应姿态或关键图 | 正式救离演出缺项；不能用通用消失代替 |
| 本尊 | a7 对应 `marietta-memory-boss.png` | 留 D5；不能作千金第二阶段 |
| 刻仪兽 | 有候补素材 | 不因有图就进入第四层首发 |
| 原红线边框／雾 | 现有 SVG 与 EnemyMist 已在原共享界面 | D4 只复用，不能顺便重画装饰 |

本轮不对用户已接受的千金静态形象重新定调。需要补的是同一形象的可执行图层、姿态和舞台标定。资产 README 中早期“舞台尚未接线”的说明是历史整理状态，D3 已接入的门厅／走廊应以实际代码及纠偏记录为准。

## 4. D3 可继承的证据与不能声称的结论

| 已记录 | 实际说明 | 不能推出 |
| --- | --- | --- |
| 一趟真实三层，85 个战斗操作，67G 返回并再出征 | 正常命令路径可用，单笔结算成立 | 五层胜率、千金配平或默认新手体验已验证 |
| 40 项浏览器检查 | root／subpath，新庄园与旧路径、角色页等通过 | 召唤、首通、维护或新终局恢复通过 |
| 四组类型、边界、入口、构建及纯核心导入检查 | 当前底座可继承 | v3 新字段和行为已受验证 |
| 全量 862 项通过，1 项整趟测试超时；修正后 22 项定向复测通过 | 需区分全量与定向证据 | “全量 863 项本轮通过” |
| 19 个原表现文件与开工基线一致 | 已确认样式与动效资源得到保留 | Browser FPS 已达标或所有 JSX 永远无需接数据 |

D3 仍需补数值矩阵、五趟人工、未覆盖故障点和性能对照。D4 规划可继续，完整包发布前必须按详细计划补齐，不应把 D3 标成未实施或已全验收这两个极端。

## 5. 本轮确定的规划落点

1. 原界面保持；新增内容、数据投影与 Boss 实体表现，旧骰子／外框／好感界面均为回归约束。
2. 完整庄园采用 `abyssa.demo` v3，保留三层 v2；显式修订 D0 的早期版本目标，无自动迁移。
3. 千金卡提供候选 HP18、初始两客／上限三客、举杯与补席交替、整场最多补六客。数值需实测，不称已定稿。
4. 首通动作按必经分区胜利证明推进；可选事件不控制核心解锁；第三层撤离不能写接管。
5. terminal 与普通结算继续复用事务底座；首次结算原子写接管、奖励和故事引用。播放／跳过不决定结果。
6. 首通后开放维护及回忆前置，亲征／成长／装备留 D5；维护不复活原管家与千金。

具体机制、奖励、故事段落、字段所有权、文件落点、依赖与验收矩阵集中在[D4 计划](../plans/DEMO_D4_OLD_MANOR_PLAN.md)。本审计不另立第二套数值表。

## 6. 本轮文档交付检查

交付包括本审计、D4 详细计划，以及 README、总计划、总规格、庄园设计和当前状态入口的修正。保留历史审计原始结果，明确当前 D3 已实施但整体验收未齐，D4 仅规划。

交付检查已完成：两份新文档的本地文件链接全部可解析；总入口与阶段边界已相互核对。与开工前哈希比较，仅 9 份 Markdown 新增或修改，原有源码、素材和配置均未变化；`git diff --check` 通过。没有执行 D4 代码、迁移档案、生成素材、切默认包或重启服务；实际实施验收将在执行 D4 时另行产生。
