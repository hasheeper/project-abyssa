# AIRP-4 本地真实模型验收

历史记录：下文为0.1.x两节点流程，不代表2026-09-10用户指定的三段流。新分工与验收以[0.2.0报告](2026-09-10-airp-three-stage-acceptance.md)为准。

日期：2026-09-09。范围：首条“旧药箱的搭扣”的归来与后续交谈；不代表全卡池、整部DEMO文案或公网服务验收。

## 1. 当前版本与运行方式

rp是通用后端与制作工作台，AIRP是其上的应用定义，Abyssa是游戏客户端。实际运行是：合法游戏事实 → rp大纲 → rp文本 → Abyssa冻结与AVG阅读 → rp必需记忆Updater → 下一场召回。没有静态发布器、外部自主Agent循环或第二套浏览器叙事数据库。

用户指定scy-a，三槽保持如下；复用已有模型Target与系统凭据，没有修改供应商默认值或其他应用。

| 用途 | 模型 | 本地Target |
| --- | --- | --- |
| 文本 | `gemini-3.8-flash` | `model-target-0c8ea5ea-3838-4c03-9db1-1d259f5992ba` |
| 大纲／大推理 | `claude-fable-5 [perplexity]` | `model-target-a4d3ed09-0f27-4e6f-a7fe-3c1a45c5c419` |
| 记忆／小推理 | `deepseek-v4-flash` | `model-target-a9ca170a-e401-419c-8dcc-899023cf1946` |

Application：`a1abd682-8fdc-4ccb-a293-f84163f909dd`。当前安装Package **0.1.3**，Release `c3022cf7-2134-4468-b3ce-003e1686dc0e`，Package hash `68c41540884687fd78a54dc513820e97199732ee14308644c84e1fa74d4dfb81`。旧Release与失败Session保留，新版不改旧结果；客户端逐版本允许兼容，但仍核对精确Release、Package hash和资源版本。

0.1.2已通过两场真实闭环；0.1.3去掉预设将兼容ID称为“凯尔”的残留，正在复验。结果以第3节最终记录为准。

本地入口：[游戏](http://127.0.0.1:5176)、[rp供应商页](http://127.0.0.1:5175/#/providers)。API仅监听`127.0.0.1:8787`。默认新档仍是内容9；需要在标题「记录」显式创建内容10在线档。未自动迁移个人存档、公开端口或部署公网服务。

## 2. 真实接入发现的问题

| 版本 | 证据与处理 |
| --- | --- |
| 0.1.0 | 大纲完成，Gemini拒绝system-only任务输入；相同最小内容用user可以成功。0.1.1改为系统Role＋participant任务turn，编译输入回归覆盖大纲、文本和Updater。 |
| 0.1.1 | 文本可用，但小模型1024输出额度可能全耗在推理上；4096额度可产出摘要。scy-a另在非空`finish_reason`后追加传输状态delta，污染严格JSON。 |
| 0.1.2 | Updater提升至4096，仍开启推理。rp通用Chat Completions适配器按每个choice的终止边界过滤后续delta，保留终止chunk自身正文、usage、错误和未终止choice；不按供应商／HTML删字，不放宽JSON或状态授权。另明确“未知全清”既不等于全清，也不等于未清。 |
| 0.1.3 | 前置创作记录出现“凯尔（你）”；定位到文本预设仍有固定人名。改为使用`context.player.displayName`，明确正文与创作记录均不得将兼容ID翻译成人名；新编译输入断言修复前失败、修复后通过。 |

通用适配器有7项回归，涵盖分片UTF-8、LF／CRLF／CR、多choice、终止chunk内容、后续usage／错误、正常正文标记、取消、超大事件与真实SDK消费。非流式和其他传输协议不受此补丁影响。详见[rp Provider协议边界](../../../rp-style-lab/docs/reference/backend-api.md)。

## 3. 真实运行证据

验收使用独立测试游戏身份`pool / pool-online-epoch`，从完整重放校验通过的实际玩法检查点出发。经过真实请求、逐句阅读、交付与后续命令，不用手写降级冒充通过。调试与玩家Session分离。

### 0.1.2基线

玩家Session `3d652b38-4092-4e81-88bb-a083d71da2a1`，开发Session `9aef1c6e-2d69-4e5d-9298-d119e23f1cea`。共4个committed、restorable楼层，6个completed模型Run，两次Updater均为原生`accepted-change`。

| 场景 | 大纲 | 文本 | 生成端到端 | 记忆模型 | 确认端到端 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 归来 | 21.710秒 | 4.878秒 | 26.866秒 | 97.699秒 | 97.979秒 |
| 后续 | 23.852秒 | 6.898秒 | 31.085秒 | 71.254秒 | 71.534秒 |

原生证据核验：后续大纲与文本的实际编译输入均包含第一次**原生接纳的完整摘要**，选中ID恰为第一次生成请求ID；不是仅检查输出碰巧提到药箱。实际重放原生成与确认请求，返回同一结果／检查点，`replayed:true`，新增楼层、Run、attempt均为0。资金不变，最终存档完整重放通过。

归来7行：托稳药箱、检查松动搭扣、擦灰并表示稍后修理。后续10行：已有小起子与布、继续拧紧／试合、收进柜子；不再初次交箱。两个摘要均保留“打算／等回头”的未来性，不把纱布配齐、药剂领取或治疗写成已经发生。模型没有改变奖励、关系阶段或玩法终态。

0.1.2前置创作记录的人名残留不作为最终质量样本，其余闭环证据仍有效。艺术质量只达到短场景可读基线，不等于正式精修稿；对搭扣／合页的动作描述偏多，整体人物变化仍待更丰富情境检验。

### 0.1.3最终复验

已完成。玩家Session `398e53e3-8401-4edd-9a9f-2fc6e501bf01`，开发Session `4f87f26b-8124-4396-9e37-8b2e3082904c`。4个committed／restorable楼层；实际7个模型Run（6完成，1次记忆JSON失败后原生重试成功）。生成分别26.253／40.690秒，读后确认83.482／30.196秒。两个冻结档浏览器检查通过。此证据仅覆盖旧分工。

## 4. 测试与浏览器

- rp本轮联合运行36项通过：应用7、上下文7、恢复3、流式边界7、Provider适配7、transport5。其中包含分支精确Fork、仅本分支记忆失效、私密／未来条目不送模和writer／Updater中断测试；这些故障由确定性Provider注入，不声称真实供应商遭遇过全部故障。
- Abyssa本轮121项专项通过：契约42、控制19、Session19、HTTP22、在线driver12、UI6、情绪1。旧版本接纳规则不放宽，精确Package hash仍校验。
- 4项原生浏览器测试通过：响应丢失与双窗口、无效正文手写降级、required Updater失败阻断、Session创建响应丢失恢复。测试用已有允许来源`15176`；首次默认`5199`被CORS拒绝属于测试端口不匹配，未为此扩大生产来源配置。
- 0.1.2两个真实冻结档经正常导入UI检查：正文、立绘、阅读提示与展开的前置创作记录可见，1440×900无面板越界、无未捕获错误、无API POST。没有在浏览器重复读完同一档制造另一条确认。
- AIRP与server测试类型检查、Abyssa应用类型检查、所改rp文件lint通过；游戏重新构建为790文件／120.48 MiB。此前全量Abyssa类型检查与模块边界通过；不将本轮专项说成两个脏工作区全部CI通过。
- rp全量架构检查仍被既有7个未接线Logo文件和旧架构报告阻断；本次未改这些文件或刷新无关基线。新Provider测试放在独立子目录，不再触发原测试目录的集中度限制。

## 5. 用量与体验限制

scy-a的Claude／Gemini流未返回usage，记录为`null`，不是0；输入估算不能冒充供应商账单。未配置可验证的单价，不能据此给出完整金额。

0.1.2两次DeepSeek分别报告输入／输出／总量为2425／3141／5566和2699／2074／4773；合计已知10339 tokens，只覆盖这两个记忆调用。诊断、失败版本及后续复验另计。

记忆确认71～98秒明显偏慢。required记忆未提交前必须阻止依赖续写，不能为“快”跳过提交。下一轮应以同样输入比较小模型推理强度、预算和摘要稳定性，再决定调参；不能直接声称关闭推理不影响质量。本轮诊断中的关闭推理曾产出错误记忆ID，未采用。

仍未承诺：多人公网权限／认证、TLS与限流、跨设备Session创建强幂等、在线档新身份复制／自动Fork、完整长期记忆检索、全卡池在线化或正式文学质量。基础记忆目前最多8条、单次最多4条／4096 UTF-8字节；达容量明确停止，不暗中覆盖。

## 6. 可复验材料

原始证据留在本机`dist/reports/airp-4/`，不含Provider密钥；其中存档与完整模型输入仍属于开发数据，不应自动公开发布。

- [0.1.2调用／耗时](../../dist/reports/airp-4/live-scy-a-600c9af3/native-summary.json)、[原生输入与检查点](../../dist/reports/airp-4/live-scy-a-600c9af3/native-evidence.json)、[召回与幂等验证](../../dist/reports/airp-4/live-scy-a-600c9af3/verification.json)。
- [0.1.2归来AVG](../../dist/reports/airp-4/live-scy-a-600c9af3/return-avg.png)、[后续AVG](../../dist/reports/airp-4/live-scy-a-600c9af3/followup-avg.png)、[创作记录](../../dist/reports/airp-4/live-scy-a-600c9af3/followup-creation-record.png)。
- [真实调用脚本](../../scripts/verify-airp-live.mjs)：必须显式`--allow-live`；独占锁与journal记录请求，恢复同目录不另造ID。
- [只读抓取](../../scripts/inspect-airp-live.mjs)、[证据／幂等核验](../../scripts/verify-airp-live-evidence.mjs)：后者仅在完整已通过journal上允许`--replay-committed`，并比较前后Run与attempt。
- [浏览器实屏核验](../../scripts/verify-airp-live-browser.mjs)：正常导入冻结档，不调用新模型。

真实重跑命令需在`rp-style-lab/server`使用本机已有Node23／tsx；`--out`指向已有目录时是恢复，创建新目录会产生新的独立付费验收，不应为了查看结果重复执行。常规测试与构建均不调用真实供应商。

阶段对应关系见[AIRP-4实施记录](../plans/AIRP_4_IMPLEMENTATION.md)与[现行计划](../plans/AIRP_4_APPLICATION_INTEGRATION_PLAN.md)。
