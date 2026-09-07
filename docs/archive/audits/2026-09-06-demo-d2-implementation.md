> 历史档案：2026-09-07文档整理时归档。原路径：`docs/audits/2026-09-06-demo-d2-implementation.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# D2 正式角色页面：实施与验收

> 日期：2026-09-06；状态：D2 完成本地实施与验收。承接 [D2 计划](../plans/DEMO_D2_CHARACTER_PAGE_PLAN.md)与[开工审计](2026-09-06-demo-d2-exploration.md)。
>
> 范围：真实档案的只读角色页、地图摘要及跨页检视。生产玩家路径沿用 legacy；规则 2 展示使用隔离 Catalog 和真实 IndexedDB 验证。完整庄园、成长获取和回忆解锁仍按 D3–D5 实施。

## 1. 交付结果

| 工作包 | 已实施内容 |
| --- | --- |
| A 只读接线 | 版本化 browser reader、ReadGameSession、Gate、同档跨标签通知；打开、切页、刷新不发命令、不续行、不清理 pending |
| B 语义查询 | 同一 head 的角色集合；legacy 有效面；规则 2 冻结配置、临时锈、HP、装备实例及下一成长 |
| C 概要 | 凯尔身份与既有素材、首发六人顺序、其余人物资料；真实等级和开放状态、原有羁绊及私约面板 |
| D 骰装 | 六人 36 面；动作与命数独立、自然点／万能点、品质与锈来源、三槽适用性、装备改写及成长预览 |
| E 记事 | 跨远征个人事实投影；归属、可见性、撤回、来源过滤及结果去重；没有经历时显示真实空态 |
| F 往返 | 菜单进入；地图名单检视指定成员；战斗姓名牌进入并返回原运行；save/epoch/run 全程保留 |
| G 集成 | 样稿隔离、实际浏览器往返与双标签验证、缺图／错误恢复、构建和回归检查、后续接口说明 |

### 已确认的视觉约束

用户在实施中指出：数据接线不得删除好感度界面或改变已确认样式。最终恢复并保留**五枚羁绊晶石、连线、进度槽、右侧状态栏，以及三格私约阶段和人物简介的原有排布**；没有重画边框、改配色或改动 Battle 动画／红线／雾气。

- legacy 和资料人物没有关系进度时，保留完整区域，显示“未记录”；不填样例 62/100、假伤情或假效果。
- 规则 2 的实际成长仍封顶 Lv.3。第四、第五晶石和第三私约格保留原有视觉位置并维持未开放状态，不代表实现 Lv.4／5 或第三阶能力。
- 当前没有逐点好感进度，晶石内的百分比位置显示“—”；保留既有晶石造型。原样稿的百分比展示仍可在预览中使用。
- 凯尔是玩家位，单列团队里程碑，不生成对自己的个人好感度。
- 既有私约名称和图标被提取为纯美术资料；当前效果和阶段只能来自存档对应规则。没有能力数据时保留卡片与缺项说明。

## 2. 数据与工程边界

### 唯一存档与最小权限

[browser-reader.ts](../../../src/game-runtime/browser-reader.ts) 使用原 `abyssa-game-v1` 数据库和版本化 runtime，只暴露 open、queries、diagnostic、close。生产注册仅含已发布的 legacy Catalog；没有把测试包注册到玩家入口，也没有新建角色存档。

[read-session.ts](../../../src/game-client/read-session.ts) 不依赖 pending-request、战斗 coordinator、dispatch 或 resume。它校验 save/epoch，丢弃迟到的异步响应；同档临时读取失败标记过期并禁用返回运行入口，身份／内容校验失败清除旧页面数据。成功验证同一 head 后复用对象，避免焦点刷新重建全部角色模型。

[observe-commits.ts](../../../src/game-client/observe-commits.ts) 共用既有 `abyssa:commits:v1` 通知协议，并监听 pageshow／visibilitychange。通知只使页面重新验证读取；旧 GameSession 的提交、CAS、幂等和恢复职责不变。

### 角色与地图使用同一读模型

[character-views.ts](../../../src/game-runtime/character-views.ts) 按记录选择 Catalog，一次查询投影全部角色。规则 2 本趟成员使用 run 中的冻结配置和临时覆盖；非本趟角色使用 Campaign 配置。旧档读取旧引擎的有效面，不套新规则。

[character-presentation.ts](../../../src/game-client/character-presentation.ts) 把版本化 DTO 转为展示契约。花色 `light → holy`、命数醒眠、品质、万能点和动作分开映射；万能点供几何绘制使用的占位值不会进入玩家文字或无障碍标签。地图名单通过同一适配获取真实动作摘要；v1 出征发令未变。

共享骰装组件保存面／槽 ID，再从当前数据解引用。切人、换档、换 epoch 重置检视；同一角色更新时显示最新面对象。合骰仍由玩家拖动或键盘旋转，D2 没有新增常驻动画循环。

### 事实只表达已发生的内容

[character-history.ts](../../../src/game-application/character-history.ts) 不改变 Battle 原有单趟历史接口。个人记事保留来源 fact IDs、run/encounter 和游戏世界时间，先过滤再归属、合并；finish 与 settled 不形成两条相同结果。UI 每次显示最近 30 条，可继续加载更早记录。

v1 依靠出征事实的 partyIds 确认参与者；visibility.actorIds 仅表示可见范围，不当作击杀者。v2 使用明确 actorId，不把缺少历史队伍快照的全局事件复制给所有人物。无法证明的成长、物品取得、篇章完成和首通日期不会被推造。

本轮同时修正旧档导入的一处来源处理：原本所有 fact 都被改为 imported；现在 simulation 保留 simulation，其余导入事实仍有 imported 来源和 originRef。真实导入历史可显示，模拟记录不会因导入而进入个人记事。

### 生产与样稿分开

原页面保留为 [CharacterPreview](../../../src/apps/character-status/CharacterPreview.tsx) 和 Storybook 的 `Scenes/Character archive sample`，原七项样稿测试随之保留。正式入口无档案时进入选档，不存在 URL 开关切换满级角色。

纯身份在 [identities.ts](../../../src/content/characters/identities.ts)，私约美术在 [relationshipArt.ts](../../../src/content/characters/relationshipArt.ts)。菜单只需人物与立绘，改用同一身份表；原九名主持人的顺序和内容未变，凯尔没有被加进主持人轮播。

对角色页、地图、菜单的生产依赖图检查覆盖 166 个模块，未发现 `testing/`、CharacterPreview、样例 profiles／diceLoadouts／chronicles 引用。报告见 [production-closure.json](../../../dist/reports/demo-d2/implementation/production-closure.json)。

## 3. 验收证据

工具链：Node 22.23.2、仓库锁定依赖、Chromium 151。全部使用独立临时服务；用户 5190 服务未停止、重启或改配置。日志在忽略目录 `dist/reports/demo-d2/implementation/`，下表正文保留结论。

| 检查 | 结果 | 日志 |
| --- | --- | --- |
| 四个 TypeScript 项目 | 通过 | [types.log](../../../dist/reports/demo-d2/implementation/types.log) |
| 全量 Vitest | 98 文件、848 项通过 | [all-tests.log](../../../dist/reports/demo-d2/implementation/all-tests.log) |
| 菜单身份表改接后的定向回归 | 8 项通过 | [menu-regression.log](../../../dist/reports/demo-d2/implementation/menu-regression.log) |
| 入口闭包 | 18 页通过 | [entries.log](../../../dist/reports/demo-d2/implementation/entries.log) |
| 分层依赖门禁 | 508 个源文件、73 个 core 生产文件，无新增违规 | [boundaries.log](../../../dist/reports/demo-d2/implementation/boundaries.log) |
| 构建脚本回归 | 66 项通过 | [build-tests.log](../../../dist/reports/demo-d2/implementation/build-tests.log) |
| 纯 core/application 导入及旧兼容面 | 124 个兼容导出；5 趟 headless 远征结算通过 | [core-import.log](../../../dist/reports/demo-d2/implementation/core-import.log) |
| game 构建及输出校验 | 601 个文件；输出校验通过 | [build.log](../../../dist/reports/demo-d2/implementation/build.log)、[output.log](../../../dist/reports/demo-d2/implementation/output.log) |
| UI 包发布检查 | 构建、打包和导出检查通过 | [ui-release.log](../../../dist/reports/demo-d2/implementation/ui-release.log) |
| Storybook | 构建通过 | [storybook.log](../../../dist/reports/demo-d2/implementation/storybook.log) |
| 最终 game + storage 浏览器矩阵 | 46 项通过（game 38、storage 8） | [release-browser.log](../../../dist/reports/demo-d2/implementation/release-browser.log) |

新增语义测试覆盖：旧引擎六面一致性；规则 2 六人 Lv.1–3 解析；实际敌方命令造成的临时锈；只读会话不推进敌方回合；身份切换和迟到读取；人物切换与同人更新的检视；实际失败图片；跨运行历史归属、导入与 simulation 过滤；原有羁绊／私约布局保留。

### 浏览器实际检查范围

`tests/smoke/character.spec.ts` 的七项用例覆盖：

1. 真实创建旧档，经菜单、地图名单、战斗姓名牌进入指定角色并返回。比较完整 record，检视／刷新无额外提交；模拟待确认请求后，角色页仍保留 pending。第二标签执行真实 ROLL 后，角色页读到同一个新 head。
2. 隔离 IndexedDB 下的 Lv.1、Lv.2、Lv.3：每档六人×六面逐项检查，三槽可查，玛沉眠动作仍显示，金／锈与命点语义不丢失，simulation 记事为空。
3. 实际规则命令造成的临时锈、图片请求失败与角色切换、同档过期运行链接。
4. 不存在的档案、错误 epoch、未知 Catalog 和错误 digest：仅显示恢复界面，无样稿回退。
5. 1600×900 与 1280×720 截图检查概要、骰装、记事；键盘检视和 reduced-motion 路径。
6. 无 reduced-motion 的空闲、六次角色切换／面检视、30 步指针拖动；记录 long task 和 Playwright trace，并核对 record 不变。

最终采样：1600×900，空闲约 2.03 秒、连续切人及拖动约 2.43 秒，均为 0 个超过 50ms 的 long task。开工审计没有历史性能采样，因此不作前后提速或 60FPS 的结论；本次证据只说明所测交互未出现长任务。数据见 [performance.json](../../../dist/reports/demo-d2/implementation/performance.json)，交互 trace 见 [performance-trace.zip](../../../dist/reports/demo-d2/implementation/performance-trace.zip)。

已检查的截图：[恢复的羁绊／私约](../../../dist/reports/demo-d2/implementation/screenshots/relationship-restored.png)、[Lv.3 概要](../../../dist/reports/demo-d2/implementation/screenshots/level-3-summary.png)、[1280×720 骰装](../../../dist/reports/demo-d2/implementation/screenshots/marietta-dice-720.png)、[真实记事](../../../dist/reports/demo-d2/implementation/screenshots/legacy-history.png)、[1280×720 空记事](../../../dist/reports/demo-d2/implementation/screenshots/chronicle-720.png)。

复现命令：先运行 `npm run build:game` 与 `npm run check:output -- game`，再运行 `ABYSSA_SMOKE_PORT=5207 npm run test:smoke -- --project=game --project=storage`；本地若未使用 Playwright 默认浏览器，设置 `ABYSSA_BROWSER_EXECUTABLE`。这里只运行本地验收，未代称远程 CI 通过。

### 测试装配不等于生产开放

[archive-browser.ts](../../../src/game-runtime/testing/archive-browser.ts) 与[浏览器 harness](../../../src/apps/character-status/testing/browser-harness.tsx) 仅由 Playwright 构建并注入测试页面，使用 `abyssa-d2-browser-test` 数据库。生产 HTML 和 browser reader 都没有注册该 Catalog。规则 2 的真实持久读取和 React 展示已经验收，正式可开档内容仍需后续阶段完成。

## 4. 后续交接

| 阶段 | 可直接复用 | 尚需实施 |
| --- | --- | --- |
| D3 | 版本化只读会话、角色集合查询、地图摘要、角色检视及返回定位 | 正式庄园 Catalog、规则 2 的地图发令和 Battle 交互、按实际 continuation 逐步恢复、前三层流程与层经济 |
| D4 | 个人事实投影、首通／篇章缺项展示、可见性和去重规则 | 千金及后两层、首通与接管事实、长期完成账本 |
| D5 | 两件空面装备的实例展示、下一成长预览、原有五晶石／三格卡片容器 | 成长／装备获得及装卸命令、玛完整铭约与阵位重排、memory 隔离、亲征解锁 |
| S4 | 已验证 head 和可见事实查询边界 | rp-style-lab 的 LLM 调用及上下文管线 |

D5 不能仅为更新界面而绕开当前 profile／progress 校验；需要先增加正式获得账本及其验证规则。D2 未迁移用户存档、未增删素材、未调整战斗数值、未接外部模型或网络服务。

本轮基于开工哈希区分 D2 与既有未提交改动，没有 reset、clean 或批量暂存。最终差异清单见 [changed-files.json](../../../dist/reports/demo-d2/implementation/changed-files.json)。
