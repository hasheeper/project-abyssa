# context21：角色规则与续轮篇幅修补

> 文档整理说明（2026-09-25）：下文按原实施日期理解；已删除的阶段引用改为文字，不改写当时的结果。原引用文件保存在文档索引列出的仓库外备份。

日期：2026-09-25。用户在勘探报告（历史稿已清理）后授权实施调整、修补与改良。

## 已完成的变化

### 1. 保留反刻板约束，明确人物可以如何表现

新增运行时 `proseVersion: 1`，只由 context21 的新洋馆帧启用。
[角色规则适配](../../src/game-application/airp-low/prose-v1.ts)成组替换六处相关条款：

- 性格、偏好与关系结合处境、所知、目标和心情，影响理解、措辞与选择；同一特质可以不同表现，也可不显露。
- 日常行为不必处处体现性格，不为证明标签反复安排口癖、招牌动作、夸张反应或固定拌嘴。
- 有关的偏好、立场和情绪可以明确呈现；保留人物连贯性，不要求不同情境始终同一种反应。
- 不为展示萌点强造冲突或改变事实，不为推进情节省略人物应有的反应；普通交流不必追求高潮。
- 同时去掉“每句话必须含有情绪”的倾向，保留生活化对白。

不在旧规则后堆叠相反要求，而是在运行时替换对应原句。仅 `SETTING`、`ROLEPLAY GUIDE` 两个模块的内容哈希变化；
34项原顺序、完整角色卡／世界资料、三段 ICOT、双语封装、对白比例、采样和材料原件不变。
新规则依据反刻板精修原稿（历史稿已清理）整合。

### 2. 首轮被保护为“继续”时，下一轮计划不再丢失

[新版 GM 提示](../../src/game-application/airp-director/scene-gm-v21.ts)明确首次 offer 必须保留玩家回应机会，
因此直接返回 `complete=false`、未尽事项和完整 `next`。

[结果处理](../../src/game-application/airp-director/scene-gm.ts)也补上程序保护：

- 如果首轮仍返回 `complete=true`，覆盖为 false 时同步补上等待实际选择的未尽事项。
- 若模型随 true 返回了有效计划，保留该计划，包括 develop 和原建议字数。
- 若没有计划，生成明确标注“程序首轮保护”的 brief 计划，100字仅供简单回应参考；实际追问或必要人物回应仍可展开。
- 不伪造玩家选择或程序操作；不跳过首次态度机会，不改写原模型响应记录。
- 普通 `complete=false` 缺少有效 next 仍校验失败，不用兜底掩盖任意无效响应。

100字不是所有续轮或所有新阶段的默认值。兜底只处理“GM认为说明已充分，但程序仍须保留一次玩家回应”的特定情况。

### 3. 无建议时也不会重新套600字／20段

[原生编译](../../src/game-application/airp-low/native.ts)在新模式下统一替换旧篇幅要求：

| 输入情况 | 新行为 |
| --- | --- |
| 有 next | 使用 GM 数字作软参考；回应充分即可停，实际选择带来新问题可展开 |
| 新阶段没有 next | 按必要新增内容决定篇幅，不设固定字数／自然段数 |
| 从旧版本继承 false + next=null | 保留历史评估，新正文采用无定额规则，不再带600字锚点 |

[正文交接](../../src/game-application/airp-director/event-brief-v21.ts)与此保持一致。
brief 用于承接态度、简短补充和收尾；develop 用于确有未答问题、新进展或需要进一步交流的人物立场。
三段结构保留，各段可短，共同完成当前交流，不为每段另外造话题。

## 版本与上线边界

[配置类型](../../src/game-application/airp-director/contracts.ts)及[命令解析](../../src/game-application/airp-director/parse.ts)支持 context21。
[日程入口](../../src/game-client/airp-director/useDirector.ts)与[洋馆／日志／阅读分发](../../src/game-client/airp-director/dispatch.ts)
为后续新帧启用 context21，继续使用 reader6。

既有请求、已经写好的对白和旧失败重试保持原版本；context20 及更早的保护分支仍按旧规则重放。
玩家进入后续新一轮时使用新规则；不会自动重写存档里已生成的文字。
没有新增写前 GM、选择后 GM、重写模型、硬字数截断、任务动作或存档迁移。

## 验证

- 6份定向测试共34项通过，退出码0，无 worker 超时。
- 新增8项测试覆盖角色／篇幅模块边界、完整资料和旧模式保持、简短／展开计划、首轮空计划修补、旧 null 计划承接、真实选择后的继承、跨阶段清空及存档导出重放。
- 既有 context20、原生 r8 和真实 React hook／分发测试通过；接单对白的条件覆盖和每轮正文→封装→一次GM保持。
- application 与 app 类型检查、模块边界检查通过。
- r8 完整性检查20份原件通过；原生基线14项测试通过。
- 游戏构建通过，876文件、159.31 MiB；有大于520 kB的 chunk 提示，未因本次任务扩展做拆包优化。
- 游戏构建产物及启动清单哈希检查通过。
- 两份新增报告的13处本地链接存在，当前状态与文档入口已加入本次结果。

主要命令：

```sh
npx vitest run --pool=threads --maxWorkers=1 --minWorkers=1 --no-file-parallelism src/game-application/airp-low/prose-v1.test.ts src/game-application/airp-low/low.test.ts src/game-application/airp-director/scene-gm-v21.test.ts src/game-application/airp-director/scene-gm-v20.test.ts src/game-client/airp-director/dispatch.test.ts src/game-client/airp-director/useDirector.test.tsx
npm run typecheck:application
npm run typecheck:app
npm run boundaries:check
node scripts/check-airp-style-baseline.mjs
node --test tests/build/airp-native-baseline.test.mjs
npm run build:game
node scripts/check-build-output.mjs game
```

之前调查时默认测试池报过 worker 通信超时；本次使用单 worker 的 threads 池跑完上述定向回归，未修改测试运行器配置，也未把旧失败追记为通过。

## 内容判断与调用记录

本次落实提示词与代码交接，不宣称实际对白已通过文学验收。软字数仍非硬上限，三段结构仍保留；
实际人物表现、重复信息及自然收束效果需在后续真实对白中继续判断。

游戏模型新增调用0次，不消耗已有游戏验收调用额度；只做1次 Fable 局部规则精修，2853个上游报告 token，
完整初稿、原答和来源（历史稿已清理）保留。未发布、未清档、未改写冻结基线。
