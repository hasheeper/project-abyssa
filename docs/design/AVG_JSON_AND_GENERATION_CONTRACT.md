# AVG JSON 主控与生成接口 v1

更新：2026-09-09。当前接入范围是洋馆首晨 S1／S2；不改原舞台、用户校准、正式剧情或游戏规则。

## 唯一剧情源

[first-morning.json](../../src/content/presentation/scenes/first-morning.json) 控制台词、阅读分页、静默演出、分支、角色表、舞台预设、背景键、默认模式及初始席位。旧的两份 TypeScript 剧本已经移除；[first-morning.ts](../../src/content/presentation/first-morning.ts) 只保留兼容导出，没有第二份台词。

制作链路：JSON → `parseAvgStory` 校验 → `compileAvgStory` → 原 `FirstMorningPlayer` → `AdvStage`／`RpScene`。不通过运行字符串、HTML或CSS执行演出。

| 数据 | 含义 |
| --- | --- |
| `schemaVersion` | JSON 格式版本，当前为1；与游戏内容6、规则4分开 |
| `id / sections` | 场景身份、分段身份和标题 |
| `presentation` | 本地舞台／背景注册键、`adv`或`nvl`默认模式、RP开关和初始左右席位 |
| `presentation.arrival` | 可选开场题签：`eyebrow/title`；复用本场背景与共享左上角标题组件，只在从头进入时展示 |
| `player` | 内部角色ID、`{{user}}`姓名占位符、本场是否允许稿内固定主角台词 |
| `cast` | 本场演员ID；姓名、头像、立绘和人格映射仍用本地角色库 |
| `nodes[].cursor` | 持久进度位置；必须与数组下标一致 |
| `beat.frames` | 同一进度节点内的分镜；文本帧点击推进，静默帧按时长推进 |
| `choice` | 提示及有序 A／B／可选C；选择由原应用命令保存 |
| `branch` | 引用前面的 `choiceId`，每个合法选项必须有对应分镜 |

分镜有四种：`dialogue`（`actorId/text/emotion`）、`narration`（`text`）、`direction`（`waitMs`）、`chapter`（章节文字）。可附 `stage`、本地 `effect`、`sound` 和物品展示键 `itemId`。

```json
{
  "id": "scene.example.0",
  "cursor": 0,
  "sectionId": "scene.example.section.1",
  "kind": "beat",
  "frames": [
    {
      "id": "scene.example.0",
      "kind": "direction",
      "waitMs": 850,
      "stage": [{ "actorId": "norma", "emotion": "serious", "still": true }]
    },
    {
      "id": "scene.example.0.page.1",
      "kind": "dialogue",
      "actorId": "norma",
      "emotion": "serious",
      "text": "……水。"
    }
  ]
}
```

第一分镜ID等于节点ID，后续为 `.page.1` 等；分支首帧为 `节点ID.A`，后续接 `.page.1`。动作不是旁白，不写入RP历史。`stage.still: true`与显式`motion`互斥。正文用`emotion`时仍由各角色本地配置决定表情、气泡、动作；少数重点演出才由作者指定`stage.motion`。

### 动作与物品展示

角色进入／换位只用原席位的划入效果，剧本不再指定第二层`slide`。显式反应复用`motions.ts`的`nod / waver / jump / shakeLight / shakeHeavy`；优先使用角色情绪映射，冷场和不需要动作处用`still`。确实无法用现有库表达的重点，才另行扩展。首晨显式动作由36处收减到7处，均用原点头／轻抖；新入场角色的反应等原划入完成后再开始。回看、切版式、后台恢复不补播。

物品帧设置`"itemId": "story.broken-axle-pin"`，由[本地物品注册表](../../src/game-client/story-items.ts)解析名称与PNG／SVG。共享`StoryItemDisplay`复用原`RpgFrame`，在舞台中展示224×224的小方框，内含图片与短名称，仅做透明度淡入淡出。翻页关闭、LOG隐藏，AVG／RP切换保持同一物品；没有道具飞入、独立确认按钮或库存奖励。未知键报错，JSON不接收图片URL、HTML或坐标；未来物品先登记本地资产。

编辑器格式提示：[avg-story.schema.json](../../schemas/avg-story.schema.json)。加载时还检查角色引用、节点／分镜唯一性、游标、分支完整性、前向引用及页ID。错误带具体JSON路径，不静默吞掉拼错的字段。当前受支持的情绪为14个英文标准词；既有组件的旧别名和专属表情兼容没有删除，但不作为v1生成协议输出。

## 不破坏旧档

现行节点共120个：S1为0～66，S2为67～119；选择位置6、24、42、58、96，最后仅A／B。此次未提升内容版本，也没有改游标、分支ID或正文。

首次JSON迁移时，完整剧情导出的规范化SHA-256一致（历史基线：`604a83006fea44f2bc2768ba6b0002e49808f3305101d695b26d40fc488f212d`）。本轮按用户要求精简动作并改物品展示，演出数据已变；正文、身份、分页与选项投影仍与迁移前一致，当前回归基线为`1b5b525610de2095bf69e22225784f5d090c86c93515c0116f25b289956256f6`。回归测试覆盖162种组合。后续纯分页可以增加同节点`frames`；如要插入持久节点、改变选择位置或已有选项身份，必须另做内容版本／存档迁移，不能仅改数组。

刷新仍从所在持久节点的首分镜恢复；局部分页未新增保存字段。改稿后只有经确认的内容变更才能更新基线测试，不能用更新哈希来掩盖意外变化。

## LLM 接口

[avg-generation.ts](../../src/game-client/avg-generation.ts) 提供请求构造、同源HTTP适配和转为现有舞台消息的入口；[generation.ts](../../src/shared/presentation/avg/generation.ts) 提供Provider接口、动态响应Schema、严格校验与请求生命周期。

- 请求包含场景／节点／请求ID、`contextKey`、本次允许发言的`actorIds`、角色人格提示、14种情绪、最多24条已读上下文及32条已提交可见事实。未选择分支和未来对白不要放进上下文。
- `contextKey`由调用方用存档ID、epoch、revision、节点及局部分页组合；换档、翻页或返回时取消请求，并在接收时重新核对。迟到的结果不能进入新场景。
- 当前回复最多4句，每句最多500字；只允许`actorId/text/emotion`。返回角色必须在本次允许列表内，主角不能加入该列表。额外动作、气泡、差分文件、坐标、命令、奖励等字段直接拒绝。
- 默认15秒超时，支持主动取消和新请求替换旧请求。服务商忽略取消信号时，本地也能结束等待。模型出错、输出非法、超时或场景过期均不修改游戏状态。
- 表情、气泡和动作依旧由`character-emotions.ts`及原校准表解析；结构校验不等于文案质量或事实语义审稿。

回复示例（身份字段必须原样回传）：

```json
{
  "version": 1,
  "requestId": "reply-01",
  "sceneId": "opening.first-morning",
  "nodeId": "morning.1.2",
  "contextKey": "save-id:epoch:revision:2:0",
  "lines": [{ "actorId": "abyssa", "text": "……早。", "emotion": "closed" }]
}
```

静态协议说明：[avg-generation-reply.schema.json](../../schemas/avg-generation-reply.schema.json)。实际每次请求的Schema还会锁定身份和角色白名单。

```ts
const request = createAvgGenerationRequest(story, {
  requestId: crypto.randomUUID(), nodeId, contextKey,
  actorIds: ["abyssa"], instruction: "回应玩家刚才的招呼。",
  context: readContext, facts: visibleFacts,
});
const generator = createAvgGenerator(createAvgHttpProvider("/api/avg/generate"));
const result = await generator.generate(request, key => key === currentContextKey());
if (result.status === "accepted") {
  const messages = generatedAvgMessages(result.frames);
  // 交给原AdvStage／RpScene；离场时调用generator.cancel()。
}
```

HTTP请求体为`{request,responseSchema}`；服务端返回上面的JSON对象。Provider也可直接适配现有模型后端。当前仓库**未配置或调用真实模型服务**，`/api/avg/generate`是可注入后端契约，尚无该路由实现；作者定稿场景不会自动调用模型。将来接入正式生成剧情时，需另外保存验收后的生成文本、来源身份和阅读位置，不能刷新后重新生成或写进现有固定剧情游标。

完整新剧本也可由制作流程产出`AvgStory` JSON，再按完整Schema及本地校验审阅入库；运行中的短回复接口不拥有新建分支、覆盖原稿或保存进度的权限。

## 存档整理

标题“记录”内增加“整理已续接旧档”和“已归档／恢复”。只有读取校验成功的升级后代，其来源head与原档的`saveId/epoch/revision`完全一致时，才可归档原档；最近使用档、独立档、读取失败档和又有新增进度的原档不纳入。

归档仅在同源`localStorage`的`abyssa:archived-saves:v1`中记显示状态，IndexedDB原档及回执完整保留。源head或后代身份失配时重新显示；恢复不需要重建档案。清理浏览器显示缓存也不会删除存档。

本次在`http://127.0.0.1:5190`实际归档1份`87ba9d9a…`旧首晨档，保留`morning-s2:19166f…`续接档；已验证恢复后再次归档。未清除其他地址的浏览器数据、工作台校准或用户设置。

## 新场景制作与检查

1. 在`src/content/presentation/scenes/`添加完整JSON，使用Schema补全；角色、舞台及背景先登记到本地库。
2. 使用`parseAvgStory`和`compileAvgStory`接原舞台；动作先复用原情绪映射／动作库，不在已有划入上叠加另一套入场；道具以本地`itemId`调用统一小方框。
3. 新持久剧情另接合法进度命令；JSON本身不会授予奖励或解锁。
4. 运行下面的针对性测试，并用隔离预览检查AVG／RP。不要拿真实进度试分支。

```sh
npm test -- src/content/presentation/first-morning-json.test.ts src/game-client/FirstMorningStory.test.tsx src/game-client/avg-generation.test.ts src/game-client/save-archive.test.ts src/game-application/testing/first-morning.test.ts --maxWorkers=1
npm run typecheck:app
npm run boundaries:check
```

首次JSON迁移验证：49项针对性测试通过，覆盖当时的正文／演出完整哈希、162种分支、旧档续接、生成接口拒绝／取消／过期、归档恢复；前端／核心／应用类型、模块边界、游戏构建及产物检查通过。完整120步回放用例单独给予15秒预算，以免本机并行负载触发旧5秒上限，断言与实际流程未缩减。

动作复用与物品展示修订：43项针对性测试通过，覆盖原动作关键帧、一次性播放、后台／LOG取消、物品切版与翻页关闭、正文身份基线及生成接口。使用隔离预览验证，不写入真实进度。
