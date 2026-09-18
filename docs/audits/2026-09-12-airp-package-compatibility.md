# AIRP-4D 第一批：Abyssa／rp 应用包兼容验收

日期：2026-09-12。范围见[Abyssa推进计划](../plans/ABYSSA_DEMO_NEXT_STEPS.md)第一批。本报告区分源码隔离验收与本机真实安装，不把模拟模型结果当作文学质量验收。

接续状态：下文保留第一批发生时的事实。随后完成0.3.1资料接线与本机安装，真实试读停在小模型授权问题，并补齐了通用模型槽图标校验。当前结果见[本机安装与真实试读](2026-09-12-airp-live-source-acceptance.md)。

结论：**第一批代码与隔离验收完成，原0.3.0版本阻塞解除。** rp通用基底无需修改；下一批处理药箱相关资料接线，真实安装与真实模型试读尚未执行。

## 1. 问题与最小修复

修复前，当前 rp 应用包0.3.0在两个实际跨仓脚本中均被 Abyssa 的 `package.version` 拒绝，尚未开始生成。新增回归用例后复现4项失败，其余57项通过。

[会话适配](../../src/game-application/airp/rp-session.ts)现在用同一张明确兼容表检查 Release 和 Runtime，并选择最终结果资源。没有放开任意版本，也没有增加存档字段或改变内容摘要。

| Package | `writingPipelineVersionId` 的真实含义 | 本轮兼容范围 |
| --- | --- | --- |
| 0.1.0／0.1.1／0.1.2／0.1.3 | `pipeline.writing`，旧版直接生成结构化文本 | 保持历史读取与精确包hash校验 |
| 0.2.0／0.2.1 | `pipeline.formatting`，三段流最终JSON | 保持旧三段流读取，不变更旧Release |
| 0.3.0 | `pipeline.formatting`，不是文学writer或修订formatter | 当前源码应用包隔离复验 |
| 其他版本／预发布版本 | 无 | Release和Runtime均拒绝，先评审再接纳 |

历史字段名不更名，避免无必要的存档迁移。Package／Release hash、资源精确版本、原生Result hash、输入／输出Entry及Checkpoint验证全部保留。即使文学writer或修订formatter给出合法JSON，也不能作为当前生成结果接纳。

## 2. 0.2.1 → 0.3.0 合同核对

以 rp 的 `c14fc36`（包0.2.1）与当前源码比较，不以界面或版本号推测兼容：

| 项目 | 核对结果 | Abyssa处理 |
| --- | --- | --- |
| Request／Scene合同 | `server/contracts.ts`未改；仍为药箱、艾洛拉、return／followup、14情绪及原预算 | 不放宽游戏输入与正文reader |
| 生成／确认／丢弃 | `generate-scene`、`confirm-scene`、`discard-scene`原有合同保持；生成输出仍为 `airp-action-output-v1` 字符串Entry | 沿用已有三种玩家动作 |
| 原生执行 | `workflow.scene`仍为大纲纯文字→正文纯文字→formatter，最终节点为formatting；读后required Updater独立执行 | 不给文本模型增加JSON职责 |
| 状态／修复 | 原记忆状态、确认／丢弃转移与有限格式反馈保持；新增摘要编辑分支 | 不扩大模型的玩法变量权限 |
| 新动作 | `reformat-scene`消费精确Writing revision；`revise-summary`限制最近有效、无后续依赖摘要 | 本轮不向玩家开放；新动作和结果不混入正常生成 |
| 资源来源 | 人物／场景从Program内置数据改为冻结的 `resource.character`／`resource.scene`，Outline和Writing通过显式资源端口消费 | 使用应用包默认药箱资料；不是27份导入资料已接线 |
| 新资源 | 新增 `pipeline.reformatting`、`workflow.reformat`，允许部分资料派生 | 保持 `pipeline.formatting` 与 `workflow.scene` 的精确身份 |

本轮没有修改 rp 通用宿主或领域应用代码。模型、供应商、密钥和本机应用配置不变。

## 3. 验收记录

本节区分每层证据，模拟模型不计入真实模型质量验收：

- Node 22.23.2下接入／契约／客户端／旧reader轻量专项199项通过，包含两个合法JSON错误生产者负例。
- 四组TypeScript检查与模块边界检查通过。
- 隔离game构建790文件／120.48 MiB，产物引用与hash检查通过。
- 真实源码0.3.0应用包→独立Session→三段生成→已读摘要→后续召回通过；重复确认、过期head、格式失败丢弃、required Updater失败拦截通过，15次模拟模型调用，真实上游0次。
- 通用Managed V8 HTTP接纳／幂等重放通过，2次模拟调用；3个作者选项／256个游戏时钟语义对照通过。
- 内容10真实命令／存档7项通过，从合法旧玩法生成本轮gate；非伪造的快照投影。
- 实际玩家→原生0.3.0应用包→原AVG→阅读确认→后续召回通过，8次模拟调用。原身份丢失响应备份恢复不增加调用，不覆盖较新的本地档。
- 原生writer／Updater重启恢复通过，分别2／4次模拟调用；中断重放不重新调模型，明确手写降级或阻断依赖，保留已读事实与资产。
- 构建产物上的浏览器专项4项通过：真实IndexedDB与Web Locks双窗口丢失响应恢复、格式失败手写降级、required Updater失败拦截、Session创建丢失响应后唯一实例恢复。使用临时原生HTTP宿主与本轮合法gate；截图核对保留原AVG与创作记录展示。
- 构建基础设施69项通过；旧内容8共21项、首通前再战2项通过。内容9首轮9项通过／5项因需要已生成fixture而跳过，再用本轮合法检查点定向补跑5项全部通过（这次过滤掉此前已通过的9项）。两轮合计14项均已执行通过，覆盖旧8升级、三条出击、余波、失败重绑、全清与归来入口。

合计243项不同的Vitest专项、69项构建基础设施测试、4项浏览器测试通过；原生跨仓脚本另列，不混入该计数。没有未解决的本轮测试失败。四组类型检查、模块边界与11份更新文档的247个本地链接／13个锚点检查通过。本次范围并非整个仓库所有测试，也没有进行真实模型文风／费用评审。

## 4. 版本与运行边界

| 层 | 本轮基线 |
| --- | --- |
| Abyssa源码 | HEAD `89597fc` ＋现有工作区＋本轮最小兼容补丁；未提交，不用HEAD冒充完整工作区身份 |
| 游戏合同 | `abyssa.demo` 内容10／规则4／协议4；默认新档仍为内容9 |
| 内容10摘要 | `3861b4a84990990856689019a3222fc5c3a41cff4527cf19f19270946b6da090` |
| rp宿主源码 | HEAD `a262cfc` ＋现有未提交变更；不是裸提交复验 |
| 原生协议 | Release manifest v4／Runtime v6／Timeline v6／Checkpoint snapshot v5 |
| 应用包 | `app.abyssa.airp` 0.3.0，从当前源码构建并安装到临时库 |
| 包hash | `f42714e9285eb012298a8038085fc588cfeecbd5460e34a95f982053472cb64c` |
| 一次隔离Release样本 | ID `5d82b10e-ecb2-416d-b0cd-c627236c2384`；hash `2813907e7e132fd0aa3cdd302d94e05249395a5760dfe54d67e31097f11b0b4b` |
| 最终资源样本 | `pipeline.formatting` 版本 `2845d4e2-4e85-40c2-a0c3-da8b650448cf` |
| 测试Node | Abyssa测试／构建22.23.2；跨仓rp测试23.11.0，匹配现有SQLite原生扩展，不修改项目Node基线 |

隔离Release及资源UUID每次构建测试会变化，临时库在测试后清理，**不是可供玩家连接的Release ID**。实际部署必须重新读取用户选择的Release及hash，不能硬编码本报告身份。

本轮不安装／升级真实应用包、不新建真实游玩Session、不迁移旧档、不重启用户服务，也没有真实模型调用。历史0.2.1真实两场的质量／费用边界仍见[09-10报告](2026-09-10-airp-three-stage-acceptance.md)。

源码兼容通过后，下一工作是第二批资料接线；安装0.3.0或后续版本到本机、创建新Release与真实模型试读，另由用户确认。旧Release与已有在线档不自动改绑。

## 5. 复验入口

- 单元与边界：`rp-session.test.ts`、`contracts.test.ts`、`rp-http-client.test.ts`及现有control／online-driver／旧reader专项。
- 真实包与HTTP：`scripts/verify-airp-rp-application.mjs`、`scripts/verify-airp-rp-contract.mjs`、`scripts/verify-airp-rp-context.mjs`，显式传入 `--rp-root`。
- 玩法与恢复：先运行 `src/game-application/testing/airp-online-gameplay.test.ts` 生成合法 `dist/reports/airp-4/checkpoints.json`，再把该路径作为 `ABYSSA_AIRP_ONLINE_FIXTURE` 传给 `verify-airp-player-application.mjs` 和 `verify-airp-player-recovery.mjs`。脚本仍完整校验档案，不信任快照；不提供fixture时会自行从玩法命令生成。
- 浏览器：`tests/smoke/airp-online.spec.ts`，设置 `ABYSSA_RP_ROOT`、匹配SQLite扩展的 `ABYSSA_RP_NODE` 及 `ABYSSA_SMOKE_PORT=15176`。本轮game构建使用独立临时outDir，临时Playwright配置仅改产物服务与报告路径，没有改用户现有配置或占用现有服务。
- 旧内容：`airp-live.test.ts`（8）、`airp-pool.test.ts`（9）、`airp-reprise.test.ts`。首轮生成检查点后，用 `ABYSSA_AIRP_FIXTURE=dist/reports/airp-2/checkpoints.json` 与 `ABYSSA_AIRP_POOL_FIXTURE=dist/reports/airp-3/checkpoints.json` 补跑卡池的5项fixture依赖用例；跨工作目录执行时使用绝对路径。不能把skip算通过。

本轮浏览器报告、截图与隔离game产物位于 `/tmp/abyssa-batch1-runtime.5i0mxE`；临时路径可被系统清理，不作为产品运行依赖。测试生成的玩法检查点在 `dist/reports/airp-2`、`airp-3`、`airp-4`，不是用户存档或应用主库。
