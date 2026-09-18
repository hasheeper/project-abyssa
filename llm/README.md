# ABYSSA · 独立 LLM 调用与 O1-W 文案工作区

这里负责模型调用、上下文组装、候选稿与审稿记录。运行在 Node 后端，和游戏的 Vite、浏览器资源、存档与规则层分离。无需安装新的运行依赖，使用 Node ≥22.12；`npm --prefix llm ...` 可以从仓库根目录运行。

当前默认任务是 O1-W，模型预设名为 `gemini`。**代理地址、模型名和 key 已留空，等待填写。** 没有发起真实外部模型请求，也没有自动替换游戏里的占位对白。

## 与AIRP应用接入的边界

AIRP已改为Abyssa直接调用rp-style-lab通用应用后端；制作调试和实际运行使用同一应用定义与执行链，Session隔离。详见[AIRP-4应用接口计划](../docs/plans/AIRP_4_APPLICATION_INTEGRATION_PLAN.md)。不再建设内容发布器、导出／导入链或浏览器内核，也不在本目录重造模型编排后端。

通用模型、Workflow、State／Updater、分支与审计由rp提供；应用配置任务预设、人物、骨架与记忆政策，不另建Memory服务。0.3.2已安装，保留4来源／11摘录，按用户改用deepseek-flash并收紧Writing事实承接；隔离回归通过，两情境四场真实闭环和记忆召回通过，文稿行为推断／无来源价格待修订，见[本轮记录](../docs/audits/2026-09-12-airp-032-acceptance.md)。[记忆方案](../docs/plans/AIRP_4_APPLICATION_INTEGRATION_PLAN.md#5-变量与记忆)区分事实、认知、计划及未接纳候选；下一步见[Abyssa推进计划](../docs/plans/ABYSSA_DEMO_NEXT_STEPS.md)，不经本目录中转。

本目录继续保留O1-W七场任务、双语格式、预设、候选及人工审稿流程，可用于预设提取／离线试验。AIRP使用独立任务资源，不默默继承O1-W约束。本地`review.json`只适用于O1-W，不是AIRP的原生叙事状态或运行确认记录。

普通game构建与CI不调用真实模型；新的在线AIRP任务需要连接rp，不通过本目录本地HTTP服务中转。浏览器不持有Provider密钥；正式资源、执行与记忆来源在rp，Abyssa保留合法玩法事实和已冻结场景。

## 先填这两个文件

- `config/providers.local.json`：代理 API 根地址、模型名、协议类型、生成上限、超时等普通配置。
- `secrets/keys.local.json`：只放 API key 与可选的本地服务令牌。

这两个文件已初始化，均被 Git 忽略；可提交的格式模板分别是 `providers.example.json` 和 `keys.example.json`。如需重新初始化：

```sh
npm --prefix llm run init
```

已有文件不会覆盖。初始化的本地文件权限为 `0600`。密钥也可以通过配置里的 `apiKeyEnv` 指向的环境变量提供；环境变量优先于密钥文件。这里不使用 `VITE_*`、浏览器 localStorage 或前端 `.env`。

每个 profile 可以独立配置同一个或不同代理。**`format` 由代理接受的协议决定，不由模型品牌决定**：Gemini 通过 OpenAI 兼容代理时，将该 profile 的 `format` 设为 `oai`、`auth` 设为 `bearer` 即可。

| `format` | 原生接口 | `baseUrl` 示例 | 默认鉴权 |
| --- | --- | --- | --- |
| `oai` | Chat Completions | `https://你的代理/v1` | `Authorization: Bearer ...` |
| `oai-res` | Responses | `https://你的代理/v1` | `Authorization: Bearer ...` |
| `anthropic` | Messages（A社） | `https://你的代理/v1` | `x-api-key` + `anthropic-version` |
| `google` | Gemini generateContent | `https://你的代理/v1beta` | `x-goog-api-key` |

`baseUrl` 要保留代理前缀及版本号，但不要重复写 `/chat/completions`、`/responses`、`/messages` 或 `:generateContent`。不允许把 key 塞进 URL。模型名原样取配置，Google 同时接受 `models/` 前缀。代理若要求不同鉴权，可显式选择 `bearer`、`x-api-key`、`x-goog-api-key` 或本地无鉴权代理用的 `none`。不会自动猜协议、换模型或在失败后切换供应商。

OAI 默认用 `max_completion_tokens`；旧兼容代理可将 `outputTokenField` 设为 `max_tokens`。未设置温度或 topP 时不会强加参数。模型支持哪些采样参数仍由该模型决定，错误不会被吞掉重试成另一种调用。

## O1-W 使用顺序

1. 审看 `context/tasks/` 的七个场景大纲与槽位，确认当前要写哪一场。
2. `context/o1-w.json` 从仓库 `st/setting` 实时组装世界观、前史与当场人物档案；`prompts/editorial.md` 保存独立编辑提示词。
3. 调用 Gemini，生成 `<planning>` 编辑对照记录与日文原文＋中文译文的结构化候选。
4. 检查角色、槽位、情绪词、语言格式与玩家 `{{user}}`；候选始终进入待审状态。
5. 人工核对人设、自然对白、翻译、阅读节奏、事实和玩家主控权，填写候选目录的 `review.json`。

预览上下文不需要 key，也不会请求网络：

```sh
npm --prefix llm run context
node llm/src/cli.mjs context --task llm/context/tasks/S4-1.json
```

填入配置后先检查，再单场生成：

```sh
npm --prefix llm run check -- --profile gemini
node llm/src/cli.mjs generate --profile gemini --task llm/context/tasks/S3-1.json
```

`check` 只检查本地配置及密钥是否齐全，不代表已测通代理。`generate` 才会产生真实外部调用。想通过其他协议调用同一任务，选相应 profile。

默认配置/提示词/任务按模块位置定位；CLI 显式传入的文件路径按当前 shell 目录解析。因此在根目录使用相对路径最直观。Node 库直接调用 `assembleContext` 的相对路径按仓库根目录解析，详见 [上下文接口](context/README.md)。

七个任务与真实故事槽对应：S3-1 抵达、S3-2 洞口哨位、S3-3 整备、S3-4 货台选择、S3-5 撤回、S4-1 物归原主、S4-2 下份委托。现有玩家分支与分页保持稳定；增页、分支专属回应、教程高亮文案等后续 O1-W 项目须先分配编辑槽。不会假称七场短稿已经涵盖全部后续制作需求。

### 上下文与续修

必需人设完整保留，并记录每份实际资料的路径、大小和 SHA-256。只按需加载当前人物，不再追加合并人设包。大纲中的规则约束避免重复发送整套工程文档。预算以字符数明确计量，不冒充精确 token 计数。

超出预算时优先移除最旧的完整 user/assistant 往返；必需资料本身超限则报错，由编辑调整清单或提高限额。不会从人物档案中间截断。`maxInputChars` 和 `maxOutputTokens` 分开设置。

完成且结构通过的候选会附带 `next-session.json`。要继续修改，在任务副本中添加 `revisionNotes: ["本轮具体修改意见"]`，然后显式指定历史：

```sh
node llm/src/cli.mjs generate --profile gemini \
  --task llm/.local/S3-1-revision.json \
  --session llm/.local/runs/上次目录/next-session.json
```

副本保持原 taskId / sceneId。模型失败、取消、输出截断或结构不合格时不生成下一轮历史。旧稿只作为修订参考，不成为剧情事实。

### 候选与审稿

每次调用的本地目录 `llm/.local/runs/<时间-随机ID>/` 保存：

| 文件 | 内容 |
| --- | --- |
| `request.json` | 归一后的文本请求与 profile 名，无 key/连接头 |
| `context.json`、`task.json` | 资料来源摘要、本次大纲与场景契约 |
| `response.json` | 可见文本、结束原因、完成状态与用量；不保存模型隐藏思考块 |
| `validation.json` | 格式与槽位检查结果 |
| `review.json` | `pending` 状态、正文摘要、人工检查项及审稿备注 |
| `next-session.json` | 仅完整且结构通过时生成的显式续修历史 |

人工审稿后将 `review.json` 的六项检查填为 true、写具体备注，并把 `status` 改成 `approved`，随后运行：

```sh
node llm/src/cli.mjs review --run llm/.local/runs/候选目录
```

它复核正文摘要、结构及人工审稿记录；正文变动后原记录失效。**程序无法证明轻小说文风优秀，结构通过不能代替视觉小说标准的人工验收。** 这里不提供自动写回游戏按钮，正式接入仍走内容审定与版本发布。

## 通用调用与本地服务

不使用 O1-W 模板时，CLI 接受统一文本请求 JSON：

```json
{"messages":[{"role":"system","content":"你的工作要求"},{"role":"user","content":"本次请求"}],"maxOutputTokens":2048}
```

```sh
node llm/src/cli.mjs generate --profile oai-res --input llm/.local/request.json
```

后端代码可直接使用 `src/index.mjs` 的 `generate`、`assembleContext`、配置加载器及验证函数；同目录提供 TypeScript 声明。统一结果包含 `text`、`complete`、`finishReason`、`usage`、`attempts`、`durationMs`。缺失用量为 null，长度截断的正文标记 `complete:false`，不会当成完整稿。

要为将来的前端或工具提供 HTTP 接口，在密钥文件中单独填写至少24字符的 `serverToken`，或使用 `ABYSSA_LLM_SERVER_TOKEN`，然后：

```sh
npm --prefix llm run serve
```

默认监听 `127.0.0.1:8788`；`GET /health` 返回健康状态。`POST /v1/generate` 需要本地服务令牌：

```text
Authorization: Bearer <本地服务令牌，不能用上游key代替>
Content-Type: application/json
```

```json
{"profile":"gemini","request":{"messages":[{"role":"user","content":"本次请求"}]}}
```

客户端只能选择已配置 profile，不能上传目标地址、密钥或文件路径。返回 `{schemaVersion:1,result:...}`；CORS 默认不开放，需要浏览器访问时在 `server.allowedOrigins` 中写精确来源（如 `http://127.0.0.1:5176`）。该接口是O1-W开发用本地后端，当前游戏没有挂接它。AIRP在线接入走rp原生应用接口，不以此服务替代；远程运行须另验认证、实例隔离和预算。不能把本目录、候选原始资料或上游key放入前端产物。

## 调用边界与验证

- 单次总超时涵盖重试和响应读取；支持 AbortSignal/CLI Ctrl-C 取消。
- 仅429、502、503、504按有限次数重试，遵循有限的 Retry-After；401/403、普通4xx、超时和不确定网络失败不自动重发。
- 禁止跟随重定向传递凭证；错误只保留状态和统一信息，不输出上游响应正文、连接头或密钥。
- 有请求/响应体积上限，本地服务最多两次并行调用。当前提供非流式文本模式；SSE、多模态、模型工具调用和自动游戏写入不在本次范围。

```sh
npm --prefix llm test
npm --prefix llm run typecheck
```

自动验证覆盖四协议的本地 HTTP 模拟、历史组装/裁剪、七场任务与真实槽位对应、异常/取消/重试/截断、独立密钥、本地服务鉴权、候选和审稿状态，以及 CLI 到本地 Google 模拟服务的完整调用。**尚未使用真实代理和 key 做远端验收。** 官方文档抓取在本次环境受到访问限制，不据此声称某个代理或型号的扩展参数已实测兼容。

格式参考入口：[Chat Completions](https://platform.openai.com/docs/api-reference/chat/create)、[Responses](https://platform.openai.com/docs/api-reference/responses/create)、[Anthropic Messages](https://docs.anthropic.com/en/api/messages)、[Google generateContent](https://ai.google.dev/api/generate-content)。
