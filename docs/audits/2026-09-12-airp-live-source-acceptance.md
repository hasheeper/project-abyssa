# 0.3.1 本机安装与两情境真实试读

日期：2026-09-12。承接[资料接线验收](2026-09-12-airp-source-context.md)，对应[推进计划](../DESIGN_DECISIONS_AND_CURRENT_STATUS.md#4-下一步顺序)第二批的真实验收，不是四型／多人扩版。

接续：用户随后明确小模型正确名称为`deepseek-flash`。已在0.3.2创建正确目标并修正Writing，当前补验见[0.3.2记录](2026-09-12-airp-032-acceptance.md)。下文保留当时实际误配、失败与用量，不将错误名称事后替换成成功历史。

## 1. 结论

**0.3.1 已安装到本机 Abyssa 主应用；完整试读未通过，停止在小模型授权失败。** 两组均实际完成纯文字大纲和正文，但 Format 返回 `UPSTREAM_AUTH`，没有最终场景、阅读确认、摘要或后续生成。不能以两段正文返回成功宣称三段流／记忆闭环通过。

本轮另外发现并修复 rp 通用执行证据对合法 Model Slot 图标的校验遗漏。修复后才进入真实 Provider；没有新建专用路由、Agent 循环或记忆服务。真实正文也暴露事实越界，故供应商问题解决后仍须做文本质量复验。

- 实际请求 **6 次：4 次完成，2 次授权失败**；第一轮图标错误发生在 Provider 前，0 次调用。总额低于获准的24次上限，停止后没有自动重试或换模型。
- 安装前备份；27份用户资源、3个模型绑定和6个旧Release逐项核对未变，旧玩家档不迁移。
- 默认内容9不变；显式内容10仍只有药箱归来／后续。没有开放修订动作、扩容量、改写序幕／首晨或部署公网。

## 2. 安装与保护

| 对象 | 本次实际值 |
| --- | --- |
| 主应用 | Abyssa，`a1abd682-8fdc-4ccb-a293-f84163f909dd` |
| 主库 | `rp-style-lab/.data/rp-style-lab.sqlite`，安装前 SQLite quick check 正常、migrationVersion 5 |
| 包 | `app.abyssa.airp`，0.2.1 → 0.3.1 |
| 包 hash | `ea0390cd2dc3c54fabe3232cf416205b5818afdc0e9db5ac44d75e83dd002c90` |
| 当前验收 Release | `0.3.1-acceptance.2`，`9e28521b-b580-44b4-a4f0-c08fcb48436d` |
| Release hash | `22001e7cb9eb8060687335d7e1d109e3444d262c4229806a2022a24ba3921220` |
| 旧0.2.1 Release | `51c92407-ce8a-4e88-917b-35299a722561`，完整冻结内容未改 |

原生一致性备份：

- `rp-style-lab/.data/backups/rp-style-lab-manual-2026-09-12T06-52-27.580Z-2d28755a.sqlite`，8,556,544 bytes。
- SHA-256：`373f368e921a4e4717966eaa02937b842edcb82acc9cb6c951e19032deab2471`；quickCheck 正常、外键错误0。

使用原生 Package CLI 安装，再经 Upgrade V2 plan／apply；以 binding revision 6、application revision 40 和 planHash 做 CAS。升级新增6项 managed 资源，没有删除资源。原生升级会恢复包内槽位声明，因此之后通过正常 Draft 保存恢复原英文标签和合法图标，再创建验收Release。模型目标及绑定未变，未访问或打印密钥。

升级自动创建的 `0.3.1`、首次验收 `0.3.1-acceptance.1`（`c4edef09-4581-4d26-8e6d-3fe10205b55f`）和第二次验收Release均保留；验收版本名不代表质量合格。后端为加载包／通用修复作了优雅重启，8787正常服务保留，原5176前端未改。临时15176游戏预览服务已关闭，因为没有可供本次AVG验收的最终场景。

## 3. 首轮失败与最小宿主修复

首轮两组均在规划阶段报 `workflow-node-plan-failed:INTERNAL_ERROR`，原生记录中没有模型Run。用主库的一致性副本重现，阻断 credentialStore 和 Provider I/O：`buildModelInvocationContextEvidence → inspectV7Resolution` 的 `validModelSlot` 只接受 `id / displayName / description`，不接受已被 Draft 合法保存的可选 `icon`。

修复 [v7-resolution.ts](../../../rp-style-lab/server/src/core/model-invocation-integrity/v7-resolution.ts)：仅允许原字段加可选图标，复用现有 `botIconIds` 白名单；未知字段、非法图标、空值和篡改仍拒绝，hash／冻结身份检查不变。

[回归用例](../../../rp-style-lab/server/test/execution/invocation-context-evidence.test.ts)通过正常 Draft → Release → Session → Evidence 验证，修改前红、修改后绿；覆盖全部合法图标、非法值和篡改，0次Provider调用。同一真实配置在隔离副本中重新规划通过，随后使用新验收Release／独立Session试读，未复用已失败的楼层。

本次36项定向测试通过；Server生产及测试 TypeScript、改动TS的ESLint／Prettier、原架构检查通过。按原工具更新依赖统计快照，不改架构政策；未重跑全仓CI。不能沿用上轮“没有修改通用宿主”的结论。

收口时再次单独复跑Evidence文件3项全部通过（不与36项重复累计）；3个新增／改动验收脚本语法、两仓`git diff --check`、14份文档262个本地链接检查通过。主应用及Package Binding接口均返回200，确认当前仍为0.3.1；这些检查没有调用模型。

## 4. 两组合法来源与真实调用

由 [prepare-airp-live-cases.mjs](../../scripts/prepare-airp-live-cases.mjs) 从既有通过完整重放校验的源档开始，经正常内容升级、选择、巡守、退出／完成命令构造两组独立测试档，没有编辑快照或伪造事实。

| 情境 | 委托选择 | 实际结果 | 大纲 | 正文 | Format | 生成至失败 |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| extracted | C：取到后从侧门撤回 | 侧门成功撤离，带回空药箱 | 39.368秒 | 71.587秒 | 5.001秒，授权失败 | 116.161秒 |
| cleared | B：清出安全路再取 | 完成巡路，带回空药箱 | 40.519秒 | 72.672秒 | 5.035秒，授权失败 | 118.389秒 |

两组并行试跑，只是两个样本，不是延迟分位数。不能说已经达到可接受等待体验，也不以此次失败耗时代表完整成功链耗时。

仍使用原 scy-a 绑定：Planning 为 `claude-fable-5 [perplexity]`，Writing 为 `gemini-3.8-flash`，Post-processing 为 `deepseek-v4-flash`。两次小模型失败均为 `The provider rejected the configured credentials.`；宿主将上游401／403映射为 `UPSTREAM_AUTH`，不是JSON校验失败，因此没有进入格式修复循环。

同供应商前两种模型能够完成，不能据此认定整把密钥失效；也无法仅凭统一错误区分模型授权、路由权限或上游密钥问题。没有擅自改供应商、模型目标、接口或密钥；需要用户确认该小模型当前的可用授权／路由后再执行新的付费复验。

四次完成调用均有usage：已知输入18,690、输出3,979，合计22,669 tokens；两次授权失败usage为null。以上不是完整费用结算，未知用量不记零。

实际编译输入已核对：Outline有2条人物／场景Resource，Writing有3条（增加专门对白规范），均为participant/user消息；Format没有直接资料引用，只收到精确的大纲、冻结正文和feedback。Format虽未输出，输入仍与上游原文逐字一致。Updater尚未运行，其真实输入／召回不能沿用模拟证据冒充本轮验证。

## 5. 正文审读：有进展，但未达标

两段正文分别323、291字符（含标签／换行）；均是纯文字，不是JSON。托稳药箱→检查搭扣→致谢的节拍与物资管家特征可见，没有哭腔泛滥、第三人称自称、玩家台词／内心或治疗／奖励结算。递物属于既有物理动作层，不应误判为替玩家作出新决定。

明确问题：

1. 撤离稿写“**确认了你按原样从侧门撤回，没有多生枝节**”。事实只证明成功撤离，不能证明途中没有意外；这是无依据的叙述者确认，应判退，不能交给Format偷偷改写。
2. 撤离稿又说“既然取到了，从侧门回来是对的，免得在路上横生枝节”，把结果扩成路线评判，与大纲“不评判撤离方式”不一致。人物可以关心，但不能从选项标签推断额外执行结果。
3. 完成稿以“路上走得顺当就好”带过结果，没有明确承接“完成巡路”；更像泛化交箱致谢。该句可理解为关切，不能直接当作实证事实，但仍应收紧以免后续摘要把它固化为“巡路顺利”。
4. 两组口吻有“你／您”、对白引号及分段的漂移；检查后致谢仍偏程式化。没有实际后续稿，无法确认记忆是否放大上述偏差。

不把合法的箱体／搭扣候选细节等同硬玩法损坏，也不为了消除事实越界而禁止全部动作与环境描写。应在Writing的事实承接和日常口吻上作有限调整；小模型继续只做保真格式整理、授权摘要，不承担修辞改写。大纲的约束已经写出而正文仍越界，不能仅以“Prompt里已经说了”判合格。

## 6. 状态隔离与未完成项

原生证据和停止后的只读复查均确认：

- 第二轮各3个Run／3次attempt；没有隐藏重试。首轮两实例各0个Run，全部失败记录保留。
- 两组楼层均为terminal incomplete、restorable=false，无最终输出引用；虽然 `stateContinuable=true`，Abyssa仍正确拒绝接纳。
- State Ledger仅有Program准备步骤，没有Updater proposal；展示状态 `lastConfirmed=""`、`memories=[]`。存在准备审计不等于写入叙事记忆。
- 玩家记录仍为requested，accepted／control／controlReceipt均为空；没有读后确认或后续场景，游戏资金与试跑前一致。
- 四个开发对照Session均无楼层，与各自玩家Session分离。
- 再读27份用户资源、6个旧Release、3个绑定及英文标签／图标，均与安装前一致；证据复查未增加调用。

未运行成功链的 committed replay 验证或真实AVG截图脚本，因其前提不成立；未用手工JSON／历史截图替代此次最终输出。上轮模拟浏览器、记忆／恢复验证继续作为历史工程证据，不升级为本轮真实通过。

## 7. 工具、证据与下一步

证据目录：[live-031-20260912](../../dist/reports/airp-4/live-031-20260912)。`before / backup / plan / applied / after`记录安装；`old-release-details`记录冻结旧版；`release-r2`记录当前验收Release；`cases/`为合法游戏夹具；首轮`extracted / cleared`与第二轮`extracted-r2 / cleared-r2`保留journal、native-evidence、native-summary；[closeout-checks.json](../../dist/reports/airp-4/live-031-20260912/closeout-checks.json)记录保护、调用和输入隔离复核。它们是本机验收产物，不是应用运行依赖。

[真实试跑脚本](../../scripts/verify-airp-live.mjs)现须同时传 `--allow-live --max-model-calls 12`，逐步持久化保守预留：generate最多4次，confirm最多2次，每组两场最多12次；恢复不允许提高上限。不是失败后重复启动脚本的许可。浏览器脚本支持显式Chromium路径，并拦截API POST，避免查看冻结档时意外调用模型。

接下来顺序：确认scy-a小模型授权／路由 → 在新包版本中有限修正Writing事实承接 → 隔离回归 → 约定余下调用预算与独立实例复验 → 最终格式／AVG／实际读后摘要／后续召回与文风验收。24次是本轮上限，不自动授权日后无限续跑；已有6次请求计入本轮记录。不得重开失败楼层冒充原请求成功，或在同一已安装0.3.1下替换资源。

第二批仍未满足整体退出条件，**不进入AIRP-5四型／多人扩展**。当前阻塞是可定位的小模型访问问题与正文事实质量，不是rp缺少多阶段执行能力。
