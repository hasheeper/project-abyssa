> 历史档案：2026-09-07文档整理时归档。原路径：`docs/audits/2026-09-06-demo-d1-implementation.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# D1 正式角色规则：实施与验收

日期：2026-09-06。执行依据：[D1 详细计划](../plans/DEMO_D1_CHARACTER_RULES_PLAN.md)。用户在完成规划后授权开始 D1；本次交付正式角色规则、版本化存档与查询接口。

## 1. 已交付与阶段边界

| 工作包 | 本次交付 |
| --- | --- |
| D1-A 版本分流 | 注入式 Catalog 注册表，按 schema／协议、内容 ID、内容版本、规则版本及 digest 分流；schema 2 记录、协议、回执与事实；未知内容可诊断导出 |
| D1-B 配置 | 六人 36 面、十项 Lv.2／3 奖励解析、凯尔团队品质成长、两件装备全部原生空面改写；进度与冻结配置重算校验 |
| D1-C 动作 | 三向万能、护卫、散金不足仍可昂贵治疗；左右邻接快照、提线、挣脱、缠线、绞杀和每意图格挡；统一实际伤害后击杀／赏金路径 |
| D1-D 手牌／四约 | 四自然同色同花、唯一万能代点、品质贡献者、独立宽判；四约两阶与固定顺序；一次提交手牌收益和铭约效果 |
| D1-E 生命周期 | 回合、遭遇、层分开；同层下一场 1 HP、跨层雨夜至少 2 HP；临时锈跨场；每场首回合威压；阵位与执行队列分离 |
| D1-F 持久化／查询 | 双连接 CAS、幂等回执、撤回、显式实例映射导入；按档案查询角色／队伍／战斗／续行／可见事实；版本化待发送请求工具 |
| D1-G 验收 | 核心与应用回归、真实 IndexedDB、旧格式／导出兼容、构建和交接记录，结果见第 4 节 |

当前默认玩家入口仍运行 legacy。D1 没有接管角色页或替换现有战斗页面；D2 开始使用正式读模型，D3 接入正式路线与动作交互。庄园红线、雾气、骰子旋转／归位和布局不在本次改动范围。

`demo-v1` 是正式角色模块，完整执行验证使用 `abyssa.fixture.demo-d1`。测试包显式取消玛的未完成铭约引用，不注册生产 `abyssa.demo`，也不把测试路线冒充庄园。

## 2. 规则口径与重要修复

已将计划推荐细则写回[规则实施记录](../design/DEMO_CHARACTER_RULES_REVIEW.md#11-d1-实施口径记录2026-09-06)。这些是本次 D1 授权下采用的实现口径，区别于用户此前逐项确认的 DEC-01～03。

- 装备改写全部原生空面；柯的多个空面会同时改变动作，沉眠照旧。没有额外选面步骤。
- 清空敌阵后关闭追加玩家输入，经唯一 end-turn 路径收束；已触发治疗可收尾。遇到存储失败，整个收束不生效；重试采用同一请求与随机状态。
- 导入只重写具有运行身份语义的字段。测试刻意把 runId 设为 `kael`，证明角色／定义 ID 不受同名运行 ID 影响。
- 敌方游标先取队列 ID 再递增，避免数组查找谓词重复推进游标；定身跳过也推进一次，保留蓄力。
- 撤回只撤实际游戏效果事实，不撤创建／导入、运行开始或此前的撤回记录；导入后撤回同样成立。
- 归档校验覆盖配置、阵位成员、遭遇构成、阶段、手牌图案／贡献算术、事实引用、撤回账本及回执版本。严格 JSON 限额继续生效。

## 3. 可调用接口与后续接线

| 入口 | 使用方式／后续职责 |
| --- | --- |
| [createVersionedGameRuntime](../../../src/game-runtime/versioned-runtime.ts) | 注入共享 store 与 `{ version, catalog }[]`；提供 create／open／list／dispatch／resume／importSave／exportSave／exportDiagnostic；不维护全局当前包 |
| [versioned-views](../../../src/game-runtime/versioned-views.ts) | character、party、battle、continuation、history 以已验证 record 的内容和 head 查询；D2/D3 不再抄写数值 |
| [demo-engine](../../../src/game-core/battle/demo-engine.ts) | create／restore／dispatch／select；合法动作及目标与实际执行同源；收束后的 `settledHand` 与回执有序事件供 D3 表现 |
| [versioned-pending-request](../../../src/game-client/versioned-pending-request.ts) | 按 protocol／save／epoch 保存待发送请求，核对活动 run；保留独立 legacy 键；恢复时不再生成随机种子或新请求 ID |
| [demo 内容](../../../src/content/gameplay/demo-v1/README.md) | D2 角色展示规则源；D3 在正式遭遇、物品与交互闭合后注册生产 Catalog |

创建的外层请求为 `{ contentRef, request: { protocolVersion, saveId, epoch, clientRequestId, profileId } }`。DEMO 创建不接受任意 initial 覆写。导入同样显式选择注册内容，内层为 `{ protocolVersion: 2, saveId, epoch, clientRequestId, archive }`；新 saveId 和 epoch 必须与原档不同。

`resume` 每次推进一条已保存的敌方队列；`queries.continuation(record)` 给出下一条同版本命令。队列结束后返回 next-round，交给 dispatch；新 head 必须重新查询。过期 head／run 请求被拒绝，不推进其他战斗。

`continueRoute` 是 **core 的可信场间原语**，用于验证同层／跨层边界，尚无公开应用命令。它不执行入袋、不清零散金、不结算整趟。D3 必须先实现房间完成、层入袋、终局结算及业务去重，再开放节点推进；不能直接将这个原语接到玩家“下一层”按钮。

`reorder` 校验完整存活敌阵排列，保持已有意图和敌队列；它没有玩家命令，也没有代替玛的自动排列策略。D5 负责玛两阶铭约、本尊参数、回忆隔离、亲征解锁及实际成长／装备获取。

事实保留来源 head、runRef、encounterId、可见性、导入来源和撤回关系。测试包事实为 simulation；未把 schema 2 record 强塞进现有 v1 AI Port。rp-style-lab 上下文和模型管线继续留在 S4。

## 4. 本地验证

工具链：Node 22.23.2、npm 10.9.8、Vitest 3.2.7、Playwright 1.63.0；真实浏览器为本机缓存 Chromium 151。使用独立 5199 测试服务，用户的 5190 服务未操作。

| 检查 | 实际结果 | 日志 |
| --- | --- | --- |
| 全部 TypeScript 检查 | core、application、app、tooling 全部通过 | [types.log](../../../dist/reports/demo-d1/implementation/types.log) |
| 核心／应用测试 | 22 文件、257 项通过；本次新增 44 项，含 7,776 种初始面组合枚举 | [core-application.log](../../../dist/reports/demo-d1/implementation/core-application.log) |
| 页面／客户端测试 | 72 文件、571 项通过，含新增版本化待发送请求测试 | [app.log](../../../dist/reports/demo-d1/implementation/app.log) |
| 真实 IndexedDB | 8 项通过，含新增 rules2 双连接／导入撤回／重开，以及 abort／quota 回滚重试 | [storage.log](../../../dist/reports/demo-d1/implementation/storage.log) |
| 依赖边界 | 489 个源文件、73 个 core 生产文件，无新增违规 | [boundaries.log](../../../dist/reports/demo-d1/implementation/boundaries.log) |
| 无浏览器导入与兼容 | 保留 124 个旧导出；5 条旧 headless 应用远征结算通过 | [pure-import.log](../../../dist/reports/demo-d1/implementation/pure-import.log) |
| 游戏构建 | 599 文件、76.47 MiB，成功 | [build.log](../../../dist/reports/demo-d1/implementation/build.log) |

测试包含手写牌型真值表、初铭／现行随机上下界、同层多战、不同恢复时点、拒绝命令无状态改变、导入同名身份、损坏回执／引用、simulation 来源保留和真实事务失败。规则 2 的测试不依赖浏览器或模型调用。未运行远端 CI。

与本轮开始时的文件哈希相比，共修改／新增 48 个文件，没有删除文件；既有 `src/apps/`、美术素材、legacy 内容及旧黄金样本均无本轮差异，原工作树其他改动保留。清单见 [changed-files.json](../../../dist/reports/demo-d1/implementation/changed-files.json)。

## 5. 明确后置

玛完整铭约与回忆、正式 `abyssa.demo` 内容摘要、庄园怪物／Boss 数值、七件道具、层倍率与金额舍入、首通奖励、失败返馆／重新补给、成长事件和装备领取均不以本次测试夹具宣称完成。D2 可开始正式角色页实施；D3 和 D5 继续按各自计划补玩法闭环。
