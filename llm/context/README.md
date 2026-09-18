# O1-W 上下文与审稿契约

此目录只管理文案任务、资料引用和人工审稿流程。`../src/context.mjs` 与 `../src/editorial.mjs` 是无第三方依赖的 Node ESM 模块（Node ≥22.12），不调用模型、不读取代理密钥、不改游戏内容或存档。网络、配置、调用日志及会话保存由独立调用层负责。

## 调用接口

```js
import { assembleContext } from './llm/src/context.mjs';
import { validateEditorial } from './llm/src/editorial.mjs';

const context = await assembleContext({
  manifestPath: 'llm/context/o1-w.json',
  taskPath: 'llm/context/tasks/S3-1.json',
  // sessionPath: '/absolute/path/to/editorial-session.json',
  maxInputChars: 120000,
});
// 把 context.messages 交给调用层选定的模型；不要向模型发送连接配置。
// const text = await yourModelClient(context.messages);
// const result = validateEditorial(text, context.task);
```

两个路径省略时即使用示例值。所有相对路径以 `context.mjs` 所在仓库根目录解析，和 shell 的 cwd 无关；显式任务／会话／清单路径也可为绝对路径。清单中的提示词和资料路径必须为仓库相对路径。

返回 `{messages, manifest, task, session}`。`messages` 是一条 system、零到多组 user/assistant、最后一条当前任务 user。system 包含固定编辑协议和完整引用资料，任务与旧草稿的优先级写在协议中。`session` 是本次裁剪后可继续使用的历史，仅含先前完整往返，不包含未完成的当前请求。

`manifest.sources` 记录本次实际读取的所有清单、提示词、任务、资料、可选会话文件的 `{path, sha256, bytes, kind}`，不含文件正文或配置密钥；manifest 同时给出选择的人物、未选择人物、预算和裁剪数量。哈希对应磁盘原始字节，供回溯同一稿所用的人设版本，不是固定内容摘要。内部文件路径相对仓库，外部任务／会话保留绝对路径；不要把工作日志直接公开发布。

默认读实时原始 `st/setting` 文件，不复制人设、不读取 `ABYSSA_SETTINGS_BUNDLE.txt`。清单列出全部人物的源路径，只加载 `task.contextActors` 所需人物；玩家档案始终加载，其余世界观／现状／前史／声音指南为必需项。游戏接点、规则边界与情绪词表已归入任务，测试直接对照现行代码；不会再把整份工程计划、存档契约、TS源码和教程JSON重复交给文案模型。必需人设不会因预算不足被静默截取；失败码是 `CONTEXT_BUDGET_EXCEEDED`，错误携带 `requiredChars` 与 `maxInputChars`。字符预算是消息正文的 UTF-16 长度，不是 token 估计，具体模型的输入／输出 token 余量由调用层管理。

引用根目录限定为 `st/setting`、`docs/design`、`docs/plans`、`src/content/presentation`、`src/shared/domain`；提示词限定 `llm/prompts`。不执行引用文件，也不追踪文内链接、URL、工具指令；拒绝越界／凭证文件及合并人设包，重复源文件报错。

## 会话管理

调用层可保存此格式，再通过 `sessionPath` 显式传入。没有自动扫描旧会话或全盘读取功能：

```json
{
  "schemaVersion": 1,
  "taskId": "O1-W.S3-1",
  "sceneId": "S3-1",
  "messages": [
    {"role": "user", "content": "上一轮明确的改稿要求"},
    {"role": "assistant", "content": "上一轮完整模型输出"}
  ]
}
```

只接受同任务、同场景的完整 user→assistant 问答组，拒绝半轮、system／tool 记录、额外字段和乱序。超预算从最旧的整组开始剔除，保留最近的连续后缀，不拆句、不残留只有回答的半轮。`manifest.history` 明示总轮数、保留数、剔除数。读取不会改写会话文件；换任务应另建会话，不把旧场景的对白当成本场既定事实。

调用层只有在供应商响应完整且 `validateEditorial(...).ok` 为 true 后，才可把 `context.messages.at(-1)` 与本轮完整回复分别作为 user／assistant 追加到 `context.session.messages`，保存 `next-session.json`。这是用于显式续修的待审历史，不代表文风验收；失败、截断、取消或格式不合格的输出只保留诊断，不追加到下轮。下一次必须由用户显式传入 `--session`，不会自动续写。

后续反馈写到当前任务的可选 `revisionNotes: string[]`，例如 `"revisionNotes": ["诺玛此刻在带路，减少无关调侃", "保留整句语意，不新增分页"]`，再带原 `--task` 与 `--session` 调用。允许空数组，拒绝非字符串或空白条目。只传 `--session` 会带入旧往返并重用当前任务，不会自动猜测本轮想改哪里；编辑任务的 revisionNotes 即可提出新反馈，任务 ID／sceneId 保持不变。提示词要求本轮反馈优先于历史稿，稳定槽位和游戏契约仍然有效。

## 任务与输出

`tasks/S3-1.json` 是默认首个可调用任务，不是整章定稿。`S3-2.json`、`S3-3.json`、`S3-4.json`、`S3-5.json`、`S4-1.json`、`S4-2.json` 分别覆盖其余六场，每个任务都附带七场大纲、S3-4 的 A/B/C 稳定选择、当前在场人物、已知／未知事实、规则约束和人工检查表。S3-1 只允许诺玛的一条既有槽；回馆任务按现有分页分配多位角色，不增造新槽。后续扩展任务时：

1. 按现有 JSON 列齐该场 `slots` 的稳定 ID、actorId、允许 emotion；在 `actors`／`contextActors` 中声明真实人物。主角显示名只能用 `{{user}}`。
2. 明确真实状态和不可写入的事实。伤势未知时，不暗示队员已经受伤；分支回应没有槽时不让模型自行增页。
3. 保留全章接点与分支语义。现行只有七个故事槽、S3-4 一处选择；艾比希斯的回馆反应、更多分页及分支回应是后续制作需求，须先由人分配槽和版本策略。
4. `humanReview.required` 永远为 true。普通场景 `player.authoredSpeech` 为 false；需要玩家关键分支短回应时，在独立任务显式授权相应槽，不能借首晨特许扩展。

输出是 `<planning>简短编辑对照记录</planning>` 后接纯 JSON：

```json
{
  "schemaVersion": 1,
  "sceneId": "S3-1",
  "lines": [
    {"id": "S3-1", "actorId": "norma", "text": "「……行くよ。（……走了。）」", "emotion": "serious"}
  ]
}
```

示例只说明格式，不是认可的 S3-1 文案。编辑记录的确切三段格式见 `../prompts/editorial.md`，逐位发言角色记录坏句、REQUIRE/FORBIDDEN 修订摘要、与正文一致的新句，不索取私有推理过程。

`validateEditorial(text, task)` 返回 `{ok, issues: string[], draft?, review?}`，不抛出模型输出格式异常。检查：任务合法、单一记录和 JSON、场景、行数／ID／顺序／角色绑定、emotion 白名单、无额外字段、玩家占位、日中格式，以及每位发言角色的编辑记录。`validateEditorialTask(task)` 可单独返回任务问题列表；`ACTORS`／`EMOTIONS` 是当前本地允许词表，不是生成结果可扩展的列表。

**`ok: true` 仅代表结构通过，绝不代表文风、日文、翻译或剧情事实自动通过。** 字段白名单能阻止模型新增 facts／choices／state 等结构，不能证明自然语言没有偷偷编造事实。必须人工对照人设与 `mustConvey`／knownFacts 审看、配音试读，再由正式制作流程接入；输出永远不自动写回冻结的游戏 JSON，也不直接当作 AVG 引擎包。

## 验证

在仓库根目录运行：

```sh
node --test llm/tests/editorial.test.mjs
```

测试只读真实人设／现行故事以查对应关系，临时任务和会话写入系统临时目录；不会改并行 AIRP 或游戏文件。
