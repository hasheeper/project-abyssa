> 历史档案：2026-09-07文档整理时归档。原路径：`docs/audits/2026-09-06-demo-d2-exploration.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# D2 正式角色页面：勘探与审计

日期：2026-09-06。范围：D1 交接查询、character-status 三页、地图名单、浏览器会话与导航、记事和角色素材。用户本轮要求勘探与规划；未实施 D2 功能。

执行计划：[D2 正式角色页面计划](../plans/DEMO_D2_CHARACTER_PAGE_PLAN.md)。上游依据：[D1 实施报告](2026-09-06-demo-d1-implementation.md)、[总实施计划](../plans/DEMO_CHARACTERS_AND_OLD_MANOR_IMPLEMENTATION_PLAN.md)。

## 1. 结论

D2 可以开始实施。现有三页视觉和 D1 规则能力可复用，但中间仍缺版本化浏览器读取、真实角色投影和正确的展示契约，不能只把样稿数组换成六个人。

当前最大的误读风险是：页面上的“状态”未必是存档状态，D1 的查询也并非可直接交给组件的完整页面数据。生产 `abyssa.demo` 尚未注册，D2 不能用测试包绕过这个边界。建议先交付真实 legacy 角色页，同时通过隔离测试验证规则 2；生产开放随 D3/D5 的内容闭合推进。

## 2. 已核实的上游能力

| 已有能力 | 证据 | D2 可复用部分／限制 |
| --- | --- | --- |
| 显式 Catalog 注册与严格 reader | [catalogs.ts](../../../src/game-runtime/catalogs.ts)、[versioned-runtime.ts](../../../src/game-runtime/versioned-runtime.ts) | 按 schema/contentRef 分流，不依赖全局当前包；已有 open/list/查询，尚缺配套 browser/session 装配 |
| 六人 36 面、成长与装备解析 | [demo 内容](../../../src/content/gameplay/demo-v1/content.ts)、[configuration.ts](../../../src/game-core/battle/rules/v2/configuration.ts) | 可计算 Lv.1–3、凯尔团队里程碑和全部原生空面改写；实际获得命令未提供 |
| 当前／冻结角色配置 | [session/demo.ts](../../../src/game-core/session/demo.ts) | 活动成员取冻结 config，临时锈分开；非成员解析 Campaign；尚未返回完整 HP／装备展示状态 |
| 版本化角色、队伍、战斗、历史查询 | [versioned-views.ts](../../../src/game-runtime/versioned-views.ts) | 语义基础可复用；v1 character 仅定义，v2 equipmentSlots 仅布尔值，history 只查一趟 |
| 可执行规则 2 夹具 | [demo-fixtures.ts](../../../src/game-runtime/testing/demo-fixtures.ts) | `abyssa.fixture.demo-d1`，全部六人可用，默认无装备，玛 covenant=null；只能做测试 |

D1 报告中的全套测试属于上一阶段证据。本轮新增核验单独记录在第 6 节，没有把它们重复计成 D2 已实现验收。

## 3. 源码发现

### F01：生产角色入口仍是静态样稿

证据：[main.tsx](../../../src/apps/character-status/main.tsx)、[App.tsx](../../../src/apps/character-status/App.tsx)、[App.test.tsx](../../../src/apps/character-status/App.test.tsx)。

App 无 GameProvider／GameGate，直接读 profiles、diceLoadouts、chronicles，默认选蕾诺尔。测试明确要求 `62/100`、轻伤两天、静态 Lv.3／私约 II，以及诺玛“未编入远征”。这些与正式六人范围、同档案展示不符。

处理：把旧 App 的样稿能力保留到显式预览；正式入口必须先校验档案。换测试归属时保留现有三页切换、装饰条件、无六维评级等展示约束。

### F02：统一会话当前有写入副作用，不能直接当只读 reader

证据：[session.ts](../../../src/game-client/session.ts)、[react.tsx](../../../src/game-client/react.tsx)、[browser.ts](../../../src/game-runtime/browser.ts)。

GameSession 的类型和 browser factory 都指向 v1；refresh 成功后读取 pending，没有 expedition 定位的页面也可重放匹配请求，有匹配运行还会自动续行。直接给角色 App 包一层现有 Provider，不足以保证只读。

现有会话已具备订阅、过期读取丢弃、跨标签通知和恢复能力，可抽取共用读取部分。读取失败时 Gate 允许保留已加载 record 并提示错误；换身份时必须额外确保旧数据清除。v1 恢复循环最多六步，v2 每次 resume 只推进一条敌队列，二者不可直接套用。

处理：角色页显式只读能力；不重放、不恢复、不清 pending。D3 才负责 v2 执行协调，D2 不复制整套 coordinator。

### F03：D1 的查询还不是完整角色页数据

证据：[versioned-views.ts](../../../src/game-runtime/versioned-views.ts)、[demo.ts](../../../src/game-core/session/demo.ts)、[旧有效面规则](../../../src/game-core/battle/rules/dice.ts)。

- v1 character 只有 Catalog definition；缺实际开放、运行成员与退化后的有效面。
- v2 `equipmentSlots.general` 只代表是否有原生空面；exclusive/accessory 固定 false，不能解释为仓库所有权或三个空槽。
- `nextLevel` 只是数字，尚无逐面成长差异、取得条件或奖励记录。
- DemoCampaign 无篇章账本、好感分数、休养天数；available IDs 目前来自 profile。
- D1 校验要求 Campaign progress 等于 profile，并与活动 run progress 一致。D2 不能靠修改存档字段模拟已经获得成长。

处理：补 record 绑定的读模型及缺项状态；成长比较调用现有 resolver。将“本 DEMO 未开放”“此档不支持”“空槽”“不适用”和“未取得”分开。

### F04：展示模型会丢失正式骰面语义

证据：[face.ts](../../../src/shared/domain/dice/face.ts)、[DiceLoadoutPanel.tsx](../../../src/shared/ui/patterns/DiceLoadoutPanel.tsx)、[正式面定义](../../../src/game-core/contracts/demo.ts)。

旧 DieFace 没有品质、锈来源、稳定 faceId 或复杂 actionId；pip 必填数字，wildPip 是另一个可选项。注释将 asleep 与 quality none 近似等同；主副色描述固定四比二。展示 `holy` 与 core `light` 还需明确映射。

DiceLoadoutPanel 在合骰与平面把 seal 统一推成 awake→plain、asleep→none，检视栏写死“素铭”；沉眠检视直接返回风味，掩盖真实可行动作。万能点虽可画宝石，文字仍展示数字；wild 动作名为“命数”，会误导三向动作万能。

处理：live 展示契约独立表达各轴、穷尽映射；底层骰面渲染已有所需品质能力，不必重造骰子。具体用例包括玛沉眠攻击 4、凯尔万能命点和诺玛固定点 1。

### F05：已复现切人后的骰面检视残留

证据：[DiceLoadoutPanel.tsx](../../../src/shared/ui/patterns/DiceLoadoutPanel.tsx) 的 Inspection 存 face/charm 对象；App 未按角色 key 面板，组件未在角色变更时清理。

浏览器复现：默认蕾诺尔 → 骰装 → 第 1 面 → 尤斯缇丝。此时第 1 面按钮已读“攻击 1，命数 1，圣辉”，检视栏仍是前一角色的“FACE · 沉眠 / STILL ASLEEP”。无需存档即可稳定复现，页面无 JS 异常。

处理：检视状态保存身份，按当前模型解引用；明确换角色、换档、revision 更新规则。此项纳入 D2 功能回归，不仅做截图对齐。

### F06：概要组件的默认行为会继续生成假进度

证据：[StatusPanel.tsx](../../../src/shared/ui/patterns/StatusPanel.tsx)、[archive.ts](../../../src/shared/domain/characters/archive.ts)。

BondBand 默认 progress=0、progressMax=100、slots=5；只删除样稿的 progress 字段仍会生成 0/100。状态 chips 放在 BondBand 内，凯尔不传个人羁绊可能连运行状态也隐藏。PactPanel 固定 I 初始／II 现行／III 重签，不吻合本 DEMO 两阶。

作者 profiles 的 status 混合身份、美术、羁绊和能力文案，部分能力与 D1 冲突，例如尤的旧全队格挡效果。不能把所有静态 traits 当作纯人格文本无条件复用。

处理：离散等级、参数化阶段、独立状态区和作者字段白名单；玩家可见缺项用准确文案，不用 0 填满。

### F07：记事需要新投影，不能直接调用现有 history

证据：[versioned-views.ts](../../../src/game-runtime/versioned-views.ts)、[history.ts](../../../src/game-application/history.ts)、[facts.ts](../../../src/game-application/facts.ts)、[demo-service.ts](../../../src/game-application/versions/demo-service.ts)。

两版现有 history 都针对活动或指定的一趟运行。v2 正确过滤 party、adventure 和撤回；fixture 事实因此不显示。现有接口没有跨远征的个人归属、合并高光和分页／分批显示语义。

v1 的 visibility.actorIds 表示目击者；伤害 payload 有 targetId 却无攻击者，治疗有明确 actorId；出征事实包含 partyIds。v2 有 actorId，但出征事实仅存 runId，不能从全局事实补造历史队伍参与关系。

处理：新增个人生涯投影，保留旧单趟和 AI 投影接口。无法证明归属的内容不写成角色事迹；成长 ID 不能生成领取时间；撤回过滤先于聚合，导入保留来源顺序。D4/D5 再扩实际篇章／获得事件。

### F08：地图与导航仍有 legacy 专用接线

证据：[live-roster.ts](../../../src/apps/map/sortie/live-roster.ts)、[MapPage.tsx](../../../src/apps/map/MapPage.tsx)、[navigation.ts](../../../src/game-client/navigation.ts)、[entries.mjs](../../../config/entries.mjs)。

地图 liveRoster 从全局 legacy gameContent 取摘要；liveLeader 为模块常量。出征命令仍是 v1 start-expedition 和旧路线。导航只携带 save/epoch，可选 expedition 仅传给 battle；没有角色、页签、返回来源。角色入口的 navigationDependencies 为空，虽然菜单已能带存档链接进入角色页。

处理：D2 改读摘要和角色检视往返，v1 发令保持同版本。不要为了“统一”让旧战斗展示新面；v2 出征命令和交互留 D3。返回用白名单，补 ID 编码／校验兼容和入口依赖。

### F09：凯尔缺登记，不缺基础美术

证据：[队伍名单](../../../src/apps/map/sortie/sortie-roster.ts)、[profiles.ts](../../../src/content/characters/profiles.ts)、[队伍标定](../../../src/content/characters/partyFigureCalibration.ts)、[凯尔设定](../../../st/setting/user/0-kael.txt)。

`portraits/kael.png`、`map/party-figures/kael.png` 与 scale=0.97 标定已存在；无独立 avatars/kael.png，也未列入九人的 characterProfiles。队伍文件仍注释“玩家位没有可供检视档案”。profiles 被其他场景复用，直接全局添人可能改变菜单等消费方。

处理：纯身份映射与头像裁切即可，名单由场景显式选择；不新画素材，不编人物年龄等信息。CharacterStatusScreen 已有无图占位，还需验证实际 img 加载失败回退。

## 4. 保留的视觉与工程能力

三页框架、人物阵营主题、立绘区、命骰十字网、手动合骰、精细 RpgFrame 和 ItemSlot 都可继续用。共享骰面原语已经有 rust/plain/gild、wildPip 和成牌标记；新规则主要缺展示契约和适配。

本轮没有发现必须重构整个 battle 或重新整理根目录的理由。D2 保持 Abyssa 独立游戏真值，不依赖 rp-style-lab／模型服务。真实缺项应在 API／展示边界说明，不能用“稍后接 LLM”掩盖未实现状态。

## 5. 浏览器观察

使用 D1 已有 `dist/game` 产物，未重新构建；临时静态服务监听系统分配的 54660 端口，浏览器结束后服务已关闭。没有访问或重启用户 5190 服务。Chromium 151，1600×900。

| 探针 | 观察 |
| --- | --- |
| 无 query 打开 character-status | 直接显示蕾诺尔 Lv.3、62/100、轻伤休养两天；没有选档 Gate |
| 三页与检视 | 现有布局可复用；切人后骰面按钮和检视信息不一致，复现 F05 |
| 页面异常 | 本次路径捕获 pageerror 为 0；不代表无数据语义缺陷 |

可复现步骤见 F05。临时证据：[探针 JSON](../../../dist/reports/demo-d2/exploration/browser-probe.json)、[当前概要截图](../../../dist/reports/demo-d2/exploration/current-summary.png)、[检视残留截图](../../../dist/reports/demo-d2/exploration/stale-inspector.png)。这些文件位于忽略目录，可重新生成；本报告正文保留结论，不依赖截图永久存在。

本次未做性能基准、真实双标签档案操作或新 UI 视觉验收；相应要求已列入实施计划，不能以现有截图宣称通过。

## 6. 本轮基线验证

工具链：`/tmp/abyssa-s0-toolchain/node-v22.23.2-darwin-arm64/bin`，Node 22.23.2；当前已有依赖。均未新增测试或修改代码。

| 命令／范围 | 实际结果 | 日志 |
| --- | --- | --- |
| `npm run typecheck:app` | 通过 | [typecheck-app.log](../../../dist/reports/demo-d2/exploration/typecheck-app.log) |
| `npm run boundaries:check` | 489 个源文件、73 个 core 生产文件，无新增违规 | [boundaries.log](../../../dist/reports/demo-d2/exploration/boundaries.log) |
| 定向 app 测试 | 8 文件、115 项通过 | [targeted-tests.log](../../../dist/reports/demo-d2/exploration/targeted-tests.log) |

定向测试为：character-status/App、DiceLoadoutPanel、CharacterChroniclePanel、profiles、diceLoadouts、game-client/session、map/MapPage、sortie-roster。使用 `node node_modules/vitest/vitest.mjs run --project app` 加这些现有测试文件路径。

测试通过说明当前代码基线可运行，**不说明 D2 已完成**。部分旧测试恰恰在保护样稿数据；F05 也未被现有断言覆盖。实施需新增针对真实状态的用例，而非只复跑这 115 项。

## 7. 本轮交付与后续入口

本轮新增本审计与[D2 详细实施计划](../plans/DEMO_D2_CHARACTER_PAGE_PLAN.md)，更新 README 和总实施计划的入口／阶段状态。未改功能代码、素材、依赖或存档；未推进正式角色成长、装备和篇章。

下一次实施按 D2-A 的只读会话与版本接线开始，随后补角色查询；不要先将生产角色页替换成直接 import `DEMO_CONTENT` 的静态展示。
