> 历史档案：2026-09-07文档整理时归档。原路径：`docs/plans/S0_ENGINEERING_BASELINE_PLAN.md`。保留当时的设计、状态和验证证据，不作为当前排期或默认机制；当前入口见[文档索引](../../README.md)。

# S0 工程基线实施计划

日期：2026-09-05。状态：**S0 本地实施与验收完成；GitHub CI 已配置，待首次远端运行**。本文件同时保留实施契约与完成证据，结果见第 11 节。

上位依据：[生产化审计与已修订的游戏／AI 边界](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-production-readiness.md)。本文件是 S0 的执行入口；[S1 内核抽取计划](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S1_CORE_EXTRACTION_PLAN.md)已完成实施，S2 存档与应用层、S3 游戏闭环、S4 AI 接入另行实施。

## 1. 本阶段要交付什么

**交付一个入口明确、构建互不干扰、能独立验证与发布的 Abyssa 工程基线。**

S0 完成后应能明确回答：哪个命令启动哪个页面，哪个构建属于游戏／实验／工具／组件库，产物在哪里，如何从干净环境验证，以及后续规则内核应遵循什么边界。

| 项目 | S0 完成标准 |
| --- | --- |
| 入口管理 | 18 个现有 HTML 全部登记；新增入口有唯一登记位置 |
| 构建管理 | 公共配置与必要差异集中管理；不再复制整份 Vite 配置 |
| 根目录 | 移除重复场景配置；生成物统一归入 `dist`；明确保留项 |
| 发行物 | 游戏、实验、工具、组件库各自可构建与预览；构建不会互相清空 |
| 检查 | 应用与构建工具都有类型检查；导航、动态素材与包内容受到验证 |
| 环境 | Node／npm 版本有明确约束；锁文件可用 `npm ci` 复现 |
| AI 独立性 | 基础游戏构建、启动和检查不需要 rp-style-lab、模型配置或 API 密钥 |

**导航完整不等于玩法闭环。**本阶段修复“标题产物有菜单、菜单目的页却不存在”的发行缺口；不把出击令消费、统一库存、存档或战后结算作为 S0 已完成项。

本阶段保留现有源码所有权：`src/apps`、`src/tools`、`src/content`、`src/shared`、`src/assets`。不搬迁全部页面，不抽取 `game-core`，不引入全局路由或 Store，不新增玩法，不实现 LLM 协议迁移。

## 2. 实施前的事实基线

以下保留写计划时的事实快照；实施后的环境、测试和目录状态以第 11 节为准。

| 事实 | 对 S0 的约束 |
| --- | --- |
| 18 个 HTML、18 个 Vite 配置、1 个 Vitest 配置 | 入口数与构建目标数必须分别建模，不能按文件名一一替换 |
| 根目录 20 个构建／预览产物目录 | `static-preview` 是刻意提交的分享产物，其余构建缓存可在迁移完成后清理 |
| 根包名为 `@abyssa/ui`，`files` 为 `dist` | 在 `dist/game` 出现前必须缩小 UI 包收集范围 |
| UI 默认输出 `dist`，场景输出 `<name>-dist` | 直接增加子目录会造成 UI 构建清空其他产物的风险 |
| 标题目标含 title＋menu；菜单目标含 menu＋character-status | 旧目标含有不同下游页，需要保留或扩展其导航依赖 |
| 洋馆目标含 mansion／shop／dice／battle，另复制十名角色素材 | 公共工厂必须保留动态资源复制能力 |
| 骰局插件将 `dice.html` 复制成 `index.html`，输出路径写死 | 聚合游戏目标不能被该插件覆盖首页；自定义 outDir 必须有效 |
| novel／rp／studio 使用可读输出与 vendor 单独压缩 | 这些是明确的预览差异，不应在归并配置时丢失 |
| map 单独拆分 Three.js／GSAP，设置 520 KiB 警告阈值 | 迁移先保留有依据的例外，不进行打包性能重构 |
| 当前类型检查不覆盖大多数场景配置 | S0 必须检查全部仍有效的配置、公共工厂与目标运行脚本 |
| 配置直接导入 `esbuild`，根包未直接声明它 | 若保留该实现，应将直接依赖写入根包；当前安装版本为 0.28.1 |
| Vite 8.1.4／React 插件要求 Node `^20.19.0 || >=22.12.0` | 不能随意选低于该范围的 Node 22 |
| 当前 `@types/node` 是 26.x，实际审计运行于 Node 23.11.0 | 需对齐目标 Node 与类型版本，并在目标环境重跑基线 |

历史验证：Abyssa 类型检查、模块边界、695 项测试及 UI 包发布检查通过；其中 145 项内核相关测试另在 Node 环境通过。标题构建成功但缺少四个菜单目的页。详细命令与范围见上位审计第 8 节。

## 3. S0 的工程决策

### 3.1 暂时保持单包与现有源码布局

继续使用 npm 与 `package-lock.json`，根包名保留 `@abyssa/ui`。S0 不创建空 workspace 或空 `packages/*`；S1 真正抽取内核时再处理包归属。公开导出键 `.`、`./branding`、`./patterns`、`./primitives`、`./styles.css` 保持不变。

根目录的 18 个 HTML 暂时保留，作为有登记的兼容入口。它们会影响开发 URL、模块路径和相对导航，移动收益小于配置收敛。17 个场景 Vite 配置在公共目标运行器接管后移除；只保留默认 `vite.config.ts` 兼容直接运行 Vite。

### 3.2 分开“入口”和“构建目标”

入口描述一个页面。构建目标描述一组页面、入口首页、资源策略与输出目录。同一个页面可以进入聚合游戏目标和自己的独立预览目标；页面源码仍只有一份。

采用如下登记，分组仅表示 S0 的发行归属，不表示页面已完成正式玩法：

| 入口 ID | 当前 HTML | 分组 | 当前开发端口 |
| --- | --- | --- | --- |
| title | `title.html` | game | 5182 |
| menu | `menu.html` | game | 默认 |
| mansion | `mansion.html` | game | 默认 |
| shop | `shop.html` | game | 默认 |
| dice | `dice.html` | game | 默认 |
| battle | `battle.html` | game | 5173 |
| map | `map.html` | game | 5186 |
| character-status | `character-status.html` | game | 5185 |
| settings | `settings.html` | game | 5188 |
| catalog | `index.html` | lab | 默认 |
| loading | `loading.html` | lab | 默认 |
| novel | `novel.html` | lab | 5174 |
| rp | `rp.html` | lab | 5175 |
| mansion-editor | `mansion-editor.html` | tool | 默认 |
| studio | `studio.html` | tool | 5176 |
| party-figure-studio | `party-figure-studio.html` | tool | 5187 |
| logo-studio | `logo-studio.html` | tool | 5181 |
| dice-studio | `dice-studio.html` | tool | 5184 |

“默认”表示当前配置未显式指定端口，通常使用 Vite 的 5173；多个旧入口本来就可能竞争端口，不把这当作多个服务可同时运行的保证。

聚合目标采用独立端口：game 5190、lab 5191、tools 5192；实施时检查与仓库已登记端口冲突，启动使用 `strictPort`，避免静默换端口。旧命令的已声明端口保留。

`novel`、`rp` 目前承担演出验证，先归 lab；后续接入正式章节或 AI 玩法时再调整发行归属。该分组不改变它们的源码目录和现有功能。

### 3.3 输出目录与包内容隔离

```text
dist/
  ui/                       # 组件包的 JS、CSS、声明及必要素材
  game/                     # 9 个 game 页面，index.html 指向标题
  lab/                      # catalog、loading、novel、rp
  tools/                    # 5 个制作工具及生成的简单索引
  entries/<entry-id>/        # 旧 build:<name> 的独立预览产物
  storybook/                # Storybook 静态产物
  reports/                  # 检查报告、构建清单、浏览器失败证据

static-preview/             # 保留原有分享用途，不作为通用输出目录
```

UI 构建、类型声明、`main`／`module`／`types`／`exports` 全部指向 `dist/ui`；`files` 收紧为 `dist/ui`。同步修改 UI 发布检查中的必要文件、资产路径、动态导入和 CSS 检查，保留原有导出数量及大小预算。

每个目标只能清空自己的目录。普通 UI／game／lab 构建禁止清空整个 `dist`；构建顺序交换后，其他目标的产物应仍存在且内容不变。发布检查必须在其他产物已经存在时执行，证明 `npm pack` 不会混入游戏、工具、地图源数据或检查报告。

`dist/index.js` 等旧物理路径随迁移改变；仓库内直接引用要一并更新。正式兼容面是上述包导出键。README 必须写清路径变化，不能宣称所有旧文件系统路径不变。

### 3.4 原生 ESM 配置与有限类型检查扩展

建议公共登记、工厂和运行器采用 `.mjs`＋JSDoc 类型标注，Node 可直接执行；新模块进入专用 tooling TypeScript 检查，不为执行配置额外增加 tsx。需要共享结构类型时放入 `config/types.ts`，只在 JSDoc 中引用。

应用与构建工具分开检查。新增 `tsconfig.tooling.json`，覆盖公共配置、仍保留的根配置和新构建／检查脚本；应用检查继续覆盖 `src`、Storybook，并将独立预览源码纳入明确配置。类型声明构建保持自己的 include 范围，避免把配置或工具声明装进 UI 包。

历史素材脚本不在本次全部改写；先做语法检查并明确清单。直接参与 S0 的旧脚本，如 UI 发布检查，随修改补齐类型检查。不得用全局关闭 strict 或大范围排除来取得通过结果。

## 4. 入口与构建契约

### 4.1 登记位置

| 文件 | 内容 |
| --- | --- |
| `config/entries.mjs` | 18 个页面的 ID、HTML、用途、开发地址、依赖页面、资源需求 |
| `config/targets.mjs` | ui／game／lab／tools／entry 目标的组合、首页、输出与构建策略 |
| `config/paths.mjs` | 从模块位置推导的项目根路径与输出路径，不依赖调用者 cwd |
| `config/types.ts` | 上述数据结构的静态类型，不包含游戏状态 |
| `config/vite/create-config.mjs` | 由目标生成 Vite 配置；显式区分 serve／build／preview |
| `config/vite/plugins.mjs` | 首页别名、动态素材复制、可读预览等实际需要的插件 |
| `scripts/run-target.mjs` | 解析目标并调用 Vite API；未知目标报错，退出码和关闭行为明确 |

运行器构造配置时显式处理 `configFile`，避免 Vite 再次自动加载根配置造成递归或重复合并。保留的根 `vite.config.ts` 作为薄适配：开发进入 catalog，构建进入 ui。

登记字段包括 `id`、`html`、`kind`、`port`／`open`、`navigationDependencies`、`assetProfiles`。构建差异集中为有限命名策略，例如可读预览与游戏发行；不为每个小差异创建可任意执行的回调配置。

### 4.2 导航与首页

已观察到的链接关系：

```text
title → menu
menu → mansion / shop / battle / character-status
mansion → shop / dice / battle
map → battle
```

目标必须包含入口所需页面的传递闭包。独立 `build:title` 因此不能只输出 title＋menu；至少包含整个已声明下游集合。game 目标显式包含本计划的九个 game 页面，不新增玩法按钮来强行连接目前尚未接入的页面。

首页按目标处理：game 的 `index.html` 使用标题入口；lab 使用 catalog；tools 生成只包含五个工具链接的索引；独立 dice 保留骰局首页行为。骰局的首页插件不得在 game 目标中覆盖标题首页。

导航登记须与源码中的实际本地 HTML 链接核对。检查器使用 Babel parser 解析 TS／TSX AST，提取静态目标；动态目标需有明确登记与浏览器覆盖。TypeScript 7 已不提供旧 JavaScript compiler API，因此没有依赖不存在的编译器接口。不能仅用正则扫描生成的 JS 后宣称所有导航均已验证。

### 4.3 资源与配置差异

| 当前特殊行为 | 迁移要求 |
| --- | --- |
| 洋馆 `character-art/<id>/` | 按包含 mansion 的目标复制；保持现有十名角色集合，并检查目录完整 |
| novel／rp／studio 的计算式素材 URL | 通过 `paper-dolls`／`emotes` 策略复制并注入相对素材根目录；背景使用静态 import；Storybook 提供相同资源目录 |
| 洋馆 `mansion-map/manifest.json` 与动态层图片 | 检查 manifest 每个运行时引用；单纯 Vite build 成功不足以证明完整 |
| 骰局开发根地址跳转与构建首页复制 | 作用于对应独立目标，使用最终 resolved outDir；支持临时输出目录 |
| novel／rp／studio 可读构建 | 在独立预览目标保留；聚合目标使用统一的目标策略，避免资产同名冲突 |
| 地图拆包与大小例外 | 初次迁移保留；若聚合配置必须变化，记录构建差异并复查资源和页面 |
| public 目录 | 先保证运行资源完整，记录每目标大小；S0 不顺带实施整套资产优化 |
| 静态组件预览 | 保留独立生成方式；S0 验证使用临时 outDir，避免检查过程改写已提交快照 |

自定义资源插件读取 Vite 解析后的输出目录，不保留硬编码的 `<name>-dist`。测试覆盖临时目录、带空格路径和不同调用 cwd，防止清理或复制错目标。

### 4.4 AI 功能的默认策略

game 聚合目标默认关闭现有骰局远程调用，使用现有本地对手逻辑；不要求 rp-style-lab 在线。该策略通过构建／启动配置实现，不改战斗规则。

旧骰局的 AI 实验能力保留为显式启用项，说明其当前协议尚未迁移。`setup:dice-runtime` 不进入 `dev`、`build`、`prepack` 或 CI 依赖链。`rp.html` 是现有演出页面，不能仅因名字包含 rp 就被当作外部 AI 服务依赖。

## 5. 命令兼容与新增入口

下列命令契约已实现：

| 命令 | 含义 |
| --- | --- |
| `dev` | 保留组件目录默认开发入口 |
| `dev:game` / `preview:game` | 启动／预览九页游戏发行目标，首页为标题 |
| `dev:lab` / `preview:lab` | 组件目录与演出实验集 |
| `dev:tools` / `preview:tools` | 工具索引与五个制作工具 |
| `dev:<name>` / `build:<name>` / 已有 `preview:<name>` | 兼容原命令名；构建转入 `dist/entries/<name>` |
| `build` / `build:ui` | 均为 UI 库构建，包含声明输出 |
| `build:game` / `build:lab` / `build:tools` | 分别构建聚合目标 |
| `build:all` | 顺序执行 ui、game、lab、tools；不隐式运行外部服务或安装操作 |
| `release:check` / `release:check:ui` | 保留 UI 包发布检查含义 |
| `release:check:game` | 构建游戏并验证产物、导航和基础页面运行；不宣称存档闭环已完成 |
| `check:entries` | 登记、源文件、目标、路径、依赖闭包和配置一致性 |
| `typecheck` | 聚合应用与 tooling 类型检查 |
| `test:build` | 构建基础设施的 Node 测试 |
| `test:smoke` | 对真实静态产物执行 Chromium 冒烟检查 |
| `check:baseline` | 类型、入口、模块边界、现有测试与构建基础设施测试 |

`build-storybook`、`build:preview` 和素材命令继续存在；Storybook 默认输出迁入 `dist/storybook`，`build:preview` 默认仍维护 `static-preview`。旧的 `vite --config vite.<name>.config.ts` 直接调用在删除配置后不再成立，应在迁移说明中给出 npm 命令替代。

`build:all` 不自动再构建十七个独立预览，以免重复消耗；兼容入口由专门的目标矩阵检查覆盖。UI 的 `prepack` 继续只调用 UI 发布门禁，检查器内部 `npm pack --dry-run` 保持 `--ignore-scripts`，避免递归。

## 6. 实施步骤与每步验收

以下建议作为七个可独立审查的变更单元，不要求每单元建立独立分支或任务。依赖顺序为 B1 → B2 → B3 → B4 → B5 → B6 → B7；某一步未验收，不删除其旧实现。

### B1 · 固定环境与记录可比较基线

- [x] 记录实施起点的 HEAD、工作树差异、现有入口配置与构建体积；保留标题 CG、素材和文档的已有修改。
- [x] 选择 Node 22 的一个受依赖支持且通过验证的具体补丁版本，写入 `.nvmrc`；最低为 22.12.0，不在文件中仅写浮动 `22`。
- [x] 在 `package.json` 声明 Node 支持范围并固定 npm 版本；采用已验证的 npm 10.9.8，CI 与本地使用同一版本。
- [x] 将 `@types/node` 对齐 Node 22，处理暴露出的真实类型问题；不升级 Vite、React 或 TypeScript 主版本。
- [x] 将保留的 `esbuild` 直接依赖显式登记，锁定实施时验证的版本。
- [x] 在干净依赖安装环境验证 `npm ci`；运行现有类型、边界、测试及 UI 发布检查。

完成证据：环境版本、命令与结果进入实施记录；依赖变化有明确原因，锁文件不包含无关升级。Node 具体补丁版本是本步骤的输出，不把尚未实测的版本写为已认证。

### B2 · 建立登记表与输出隔离

- [x] 建立 `entries`、`targets`、`paths` 和结构类型，登记全部 18 个入口及已知页面依赖。
- [x] 将 UI Vite 输出与 `tsconfig.build.json` 声明输出一起移入 `dist/ui`。
- [x] 同步更新包 `main`／`module`／`types`／`exports`／`files` 与 UI 发布检查。
- [x] 建立目标目录校验：输出必须位于允许的构建根或显式测试临时目录；不能等于源码、仓库根或其他目标的祖先目录。
- [x] `emptyOutDir` 只作用于当前目标目录；UI 包按 allowlist 收集必要产物。

完成证据：UI 导出与样式检查通过；预先放入 game／tools／reports 的测试产物后，UI 构建不删除它们，`npm pack --dry-run --json --ignore-scripts` 也不包含它们。必要的 npm 元数据文件与构建产物分别核对。

### B3 · 公共工厂与兼容命令迁移

- [x] 实现公共 Vite 工厂与目标运行器；启动和退出正确关闭 server，失败返回非零状态。
- [x] 提取洋馆素材、骰局首页、可读预览等有限插件，全部使用 resolved outDir。
- [x] 逐个将现有 `dev:*`／`build:*`／`preview:*` 指向登记目标，保持明确的入口 URL 与已有端口。
- [x] 保留根 `vite.config.ts` 薄适配，核对直接 `vite`／`vite build` 的行为。
- [x] 将 Storybook 输出移入 `dist/storybook`；静态预览脚本增加可选 outDir，默认仍为 `static-preview`。
- [x] 逐个构建全部旧场景／工具目标；检查导航闭包、特殊资源和原有构建例外。

完成证据：所有现有 npm 命令都有清晰去向；独立骰局根入口和查询参数保留，临时输出不再落回旧目录；从不同 cwd 调用运行器仍找到正确根目录。旧场景配置在 B7 再统一删除。

### B4 · 聚合发行目标

- [x] 增加 game／lab／tools 目标与开发、构建、预览命令。
- [x] game 输出九个页面及标题首页别名，lab 输出四个页面，tools 输出五个工具及索引。
- [x] 按目标应用资源策略，不用拼接独立 `*-dist` 的方式构成发行包。
- [x] game 默认禁用远程骰局调用，验证本地运行路径；不运行旧 setup。
- [x] 生成确定字段的构建清单：目标、包含入口、源码 revision／是否有未提交修改、工具版本、资源清单与大小。文件枚举排序；时间戳不参与内容一致性比较。

完成证据：每个聚合目标可单独构建和静态托管；构建全部目标后 UI 包仍只包含 UI 文件。页面被纳入发行物不等于其玩法已接入，相关未完成状态在文档保留。

### B5 · 类型、入口与产物门禁

- [x] 新增 tooling TypeScript 配置，检查所有公共构建配置、根配置和本阶段涉及的脚本。
- [x] `typecheck` 聚合应用与 tooling；独立预览源码有覆盖，UI 声明构建仍只输出公共组件。
- [x] 新增 `check:entries`：检查唯一 ID、源文件存在、HTML 与入口模块匹配、缺失依赖、目标首页与目录冲突。导航可以存在往返环，闭包计算用已访问集合终止；仅无效的构建目标递归引用应报错。
- [x] 保留现有 `boundaries:check`，对新工程模块增加必要规则：配置与检查脚本不能导入玩法页面来获得构建信息，也不能依赖相邻 rp-style-lab 源码。
- [x] 新增产物检查器，验证预期 HTML、导航目标、HTML/CSS 静态资产以及 manifest 声明的动态素材。
- [x] 增加有针对性的构建测试与 Chromium 静态产物冒烟测试，见第 7 节。

完成证据：缺页、素材遗漏、输出目录冲突和包泄漏都能触发失败；检查实际读取产物，不仅验证登记表中的预期对象。

### B6 · CI 与发布检查

- [x] 新增 `.github/workflows/ci.yml`；当前 origin 为 GitHub 仓库，工作流复用本地命令，不在 YAML 中复制另一套构建逻辑。
- [x] 以 `.nvmrc` 与固定 npm 安装，运行 `npm ci`；缓存依赖下载缓存，不复用旧 `dist` 作为成功前提。
- [x] 执行 `check:baseline`、聚合目标构建、UI 包检查、游戏产物检查与浏览器 smoke。
- [x] 单列兼容目标矩阵以及 Storybook／静态预览验证；允许独立 CI job，但失败结果都进入 S0 验收。
- [x] 浏览器仅安装测试需要的 Chromium；新增测试依赖必须声明在本仓库，不能借用 rp-style-lab 的安装。
- [x] 失败保留构建清单、缺失路径、浏览器日志和必要截图；CI 不改写已提交的 `static-preview`。

完成证据：在目标 Node 与无 AI 服务环境下完整通过；执行任何一类检查都不需要 Provider 凭据。工作流只验证与保存 CI 证据，不添加自动部署、发布 npm 包或合并操作。

### B7 · 清理与交付记录

- [x] 删除已被公共工厂接管的 17 个场景 Vite 配置，更新所有脚本与文档引用。
- [x] 旧 `<name>-dist` 与 `storybook-static` 在新输出验收后按明确清单清理；保留 `static-preview`、创作素材、参考资料和工具源文件。
- [x] 更新 README 的入口、目录、命令与发布说明，以及受路径变化影响的 app／tool 文档。
- [x] 更新 `.gitignore`，保证新构建、测试与报告产物均被忽略；既有分享产物的提交策略保持明确。
- [x] 更新本文件状态与完成记录，附最终命令结果、变更文件范围和仍属于 S1—S4 的事项。

完成证据：根目录只保留有登记用途的配置与 HTML，不再产生新的 `<name>-dist`；仓库内可执行脚本无旧配置路径残留，历史审计记录不作伪造式改写。

## 7. 验证设计

### 7.1 测试分层

| 层级 | 建议位置／工具 | 验证范围 |
| --- | --- | --- |
| 现有应用回归 | `src/**/*.test.*`／Vitest | 保留现有规则、组件与视觉时序行为 |
| 构建基础设施 | `tests/build/*.test.mjs`／Node test runner | 路径、资源插件、输出隔离、产物验证器的失败场景 |
| 浏览器冒烟 | `tests/smoke/*.spec.ts`／Playwright Chromium | 对真实静态产物导航、挂载与加载资源 |

明确各 runner 的 include／exclude，避免 Vitest 误收 Node 测试或 Playwright 用例。浏览器层只增加 S0 必要验证，不建立全套视觉快照基线，也不测试尚未实现的正式存档流程。

### 7.2 必须覆盖的构建失败场景

1. **跨目标清理：**先构建 game，再构建 ui，然后反向执行；其他目标内容保持不变。
2. **UI 包污染：**所有目标都存在时 dry-run pack，game／lab／tools／reports 均不得入包，公开导出保持一致。
3. **输出参数失效：**骰局与洋馆构建到临时目录，其首页与角色素材都出现在该目录，旧默认目录无新增文件。
4. **缺少下游页面：**测试夹具移除菜单目的页或制造未登记本地链接，产物检查应失败并指出来源与目标。
5. **动态资源遗漏：**移除一个洋馆 manifest 引用的层图片，或者缺少角色素材，检查应失败。
6. **源文件与配置漂移：**新增未登记 HTML、重复入口 ID、无效依赖或输出冲突，检查应失败。
7. **非法目录：**拒绝将仓库根或源码目录作为可清空输出；允许经过显式验证的测试临时目录。

测试使用临时目录和最小必要夹具，不修改真实创作素材。重点验证数据丢失与发行损坏风险，不为每个静态配置字段写一条重复实现的断言。

### 7.3 静态发行物冒烟

使用只提供构建产物的静态服务器，禁止访问源码目录；不启用把缺失路径都回退到 index 的 SPA fallback。分别挂载于根路径和子路径，例如 `/abyssa/`。

- game 九个页面分别可直接打开与刷新，根入口显示标题；catalog 不误占游戏首页。
- 从标题进入菜单，再触发当前四个菜单目的地；通过稳定 DOM 条件确认到达，不依赖固定长时间 sleep。
- 洋馆房间相关跳转、地图到战斗按现有可操作入口验证；仅验证页面与资源，不把跳转误判为状态交接完成。
- lab 四页与 tools 五页可以挂载；tools 索引链接有效。
- 已引用脚本、样式、图片与动态 manifest 路径无缺失；对响应类型和页面内容进行核对，不能只凭 HTTP 200 判定成功。
- 监听未处理页面异常和资源失败；WebGL 页面在 CI 的 Chromium 环境验证实际可挂载，不能以关闭页面来绕过失败。
- game 在远程 AI 请求被阻止、8787 服务不存在时仍能启动与执行已有本地操作；构建过程不产生服务调用。

只对新发现且与原型既有行为无关的构建回归做修复；原有玩法缺口另记入 S1—S3，不能通过弱化断言把它们标为完成。

### 7.4 性能与可复现性边界

记录各目标总大小、主要 chunk 和动态素材大小，保留 UI 现有预算。游戏尚无经过测量的发行预算，本阶段先建立基线，不凭空设定体积上限，也不顺带重压缩全部素材。

同一源码与锁文件重复构建，比较入口／资产清单及不含时间字段的内容哈希；不要因绝对临时目录或报告时间不同而误报。清单是构建证据，不替代后续游戏内容版本或存档版本。

## 8. 文件改动清单

以下文件已按实施期验收落地；源码中的资源路径与测试修正另见第 11 节：

| 类型 | 文件／目录 | 变更 |
| --- | --- | --- |
| 修改 | `package.json`、`package-lock.json` | 环境、直接依赖、目标脚本、UI 发布路径 |
| 新增 | `.nvmrc` | 固定已验证 Node 补丁版本 |
| 修改／新增 | `tsconfig.json`、`tsconfig.build.json`、`tsconfig.tooling.json` | 分开应用、声明和构建工具检查 |
| 新增 | `config/entries.mjs`、`targets.mjs`、`paths.mjs`、`types.ts` | 唯一登记与路径来源 |
| 新增 | `config/vite/create-config.mjs`、`plugins.mjs` | 公共工厂和必要插件 |
| 修改 | `vite.config.ts`、`vitest.config.ts`、`.storybook/main.ts` | 默认兼容入口、测试范围与并发、Storybook 动态资源 |
| 删除 | 17 个 `vite.<scene-or-tool>.config.ts` | 公共运行器验收后移除重复配置 |
| 新增 | `scripts/run-target.mjs` | 开发／构建／预览目标运行器 |
| 新增 | `scripts/check-entries.mjs`、`check-build-output.mjs` | 登记与真实产物检查 |
| 修改 | `scripts/check-package-release.mjs` | UI 新目录、打包 allowlist、现有预算 |
| 修改 | `scripts/build-static-preview.mjs` | 支持临时输出验证，保留默认分享行为 |
| 新增 | `tests/build`、`tests/smoke` 及浏览器测试配置 | 本计划限定的工程回归 |
| 新增 | `.github/workflows/ci.yml` | 本地命令的自动验证 |
| 修改 | `.gitignore`、README、相关源码目录 README | 输出、命令与边界说明 |

不属于本计划改动范围：`rp-style-lab` 仓库、角色或关卡规则、标题 CG 内容、现有美术资源、完整存档系统、LLM Prompt 和 Pipeline。少量 HTML 或启动配置若因构建兼容必须调整，应在实施记录说明用途，不夹带页面重设计。

## 9. 兼容、回退与风险处置

| 风险 | 处置与停止条件 |
| --- | --- |
| 工厂归并丢失特例 | 先完成全部旧目标矩阵；任一首页／资源回归未解释前，保留对应旧配置 |
| 输出迁移导致 UI 包夹带游戏 | B2 提前处理 `files`、exports 与 outDir；污染测试失败则不进入聚合构建 |
| 目录清理误伤文件 | 只清理明确登记的生成目录，先完成新产物验收；不用按名称模糊匹配所有目录的删除脚本 |
| UI 库路径变化影响使用方 | 保持包导出键；核对仓库内实际文件引用，README 明确物理路径迁移 |
| 源码已有未提交改动混入 | 按文件审查差异；记录既有改动，避免覆盖或将其归为 S0 成果 |
| TypeScript 工具检查暴露问题 | 在目标文件中修复类型；无法立即处理的历史脚本单独登记，不能降低全局检查强度 |
| 浏览器检查依赖开发服务器兜底 | 只托管真实产物并测试子路径；错误路径返回失败，禁止静默 fallback |
| 工程任务扩展成玩法重构 | 状态丢失、统一库存与远征交接记录到 S2—S3，不在 S0 加入临时全局状态方案 |

各单元保留可审查的差异。若需回退，只回退对应 S0 变更及其生成物，保留实施前已有工作；不对整个工作树使用破坏性重置。

## 10. 最终交付检查表

- [x] 根目录只保留默认 Vite、Vitest 与明确的工程文件；18 个 HTML 均有登记。
- [x] 旧 npm 入口命令可用，路径变化有说明；17 份重复配置已移除。
- [x] ui／game／lab／tools 输出隔离，构建任一目标不破坏其他目标。
- [x] UI 包公开 API 与预算检查通过，包内容不包含游戏或工具产物。
- [x] game 九页及既有导航、动态资源在根路径和子路径通过静态产物检查。
- [x] 所有现行构建配置和新脚本纳入检查，测试 runner 范围清晰。
- [x] 现有应用回归、工程测试、兼容目标矩阵通过；CI 工作流已配置，远端执行状态单列。
- [x] 基础游戏检查在远程 AI 请求被阻止且无需模型凭据时通过。
- [x] 静态分享产物、创作数据和既有工作未被构建检查意外改写。
- [x] README、审计入口和完成记录一致；明确 S0 未实现存档与完整玩法闭环。

S0 验收后进入 S1：在上述稳定构建与回归保护下抽取纯规则内核。是否启用 AI、使用哪种上下文策略或复杂生成管线，均不影响 S0 完成。

## 11. 实施记录

| 单元 | 状态 | 完成证据 |
| --- | --- | --- |
| 计划与审计关联 | 已完成 | 本文件；README 与上位审计入口已指向本计划 |
| B1 环境与基线 | 已完成 | Node 22.23.2／npm 10.9.8；最终锁文件 `npm ci` 成功；完整应用回归通过 |
| B2 登记与输出隔离 | 已完成 | 18 个入口；UI 与 game 双向构建隔离测试；包 allowlist 与导出检查通过 |
| B3 工厂与兼容命令 | 已完成 | 18 个独立目标全部临时构建并验证；不同 cwd、带空格 outDir、首页和查询参数测试通过 |
| B4 聚合发行目标 | 已完成 | ui／game／lab／tools 均全新构建；产物完整性检查通过；构建清单包含入口、版本、revision、文件哈希与大小 |
| B5 类型与产物门禁 | 已完成 | 应用／tooling 类型、AST 导航、模块边界、695 项应用测试及 9 项构建测试通过；35 项浏览器检查通过，范围见下表 |
| B6 CI | 配置与本地命令验收完成 | 两个 GitHub job 复用本地命令；只安装 Chromium、保存报告；远端尚未触发 |
| B7 清理与交付 | 已完成 | 删除 17 份场景配置；归档 18 个旧构建目录及旧 UI 产物；README、审计与设定文档索引已更新 |

### 11.1 最终验证记录

验证对象为当前未提交工作树，起点 HEAD 为 `969ae5ade3c7be1439638e6d4f1f44ecd102a62b`。构建清单明确标记 `dirty: true`，不冒充某个已发布 commit 的结果。

| 检查 | 本轮结果 | 本地证据 |
| --- | --- | --- |
| `npm ci` | 通过，固定 Node 22.23.2／npm 10.9.8 | [安装日志](/Users/liuhang/Documents/project-abyssa/dist/reports/s0-install.log) |
| `npm run check:baseline` | 通过：应用／tooling 类型、入口与边界、80 个文件的 695 项应用测试、9 项工程测试；无跳过 | [完整基线日志](/Users/liuhang/Documents/project-abyssa/dist/reports/s0-baseline.log) |
| `npm run build:all`、UI 包与三类页面产物检查 | 通过；导出值数量保持 103／14／32／57 | [构建与包检查](/Users/liuhang/Documents/project-abyssa/dist/reports/s0-builds.log) |
| `npm run build:entries` | 18／18 通过；临时构建后移除临时目录 | [兼容矩阵日志](/Users/liuhang/Documents/project-abyssa/dist/reports/s0-compatibility.log) |
| `npm run check:auxiliary` | 历史脚本语法、隔离静态预览及原快照未变检查通过 | [辅助检查日志](/Users/liuhang/Documents/project-abyssa/dist/reports/s0-auxiliary.log) |
| `npm run build-storybook` | 通过；既有大 chunk 提示仍保留 | [Storybook 日志](/Users/liuhang/Documents/project-abyssa/dist/reports/s0-storybook.log) |
| `npm run test:smoke` | 35／35 通过，无跳过、无失败、无 flaky（约 4.6 分钟） | [浏览器报告](/Users/liuhang/Documents/project-abyssa/dist/reports/smoke.json)、[日志](/Users/liuhang/Documents/project-abyssa/dist/reports/s0-smoke.log) |
| `npm audit --json` | 0 项漏洞；含开发依赖 | [依赖报告](/Users/liuhang/Documents/project-abyssa/dist/reports/s0-dependency-audit.json) |
| 直接 Vite 配置解析 | serve → catalog／5173，build → UI／dist/ui | [配置验证](/Users/liuhang/Documents/project-abyssa/dist/reports/s0-direct-vite.json) |
| 已有工作保护 | 17 个实施前源码／素材／设计文档／静态快照文件 SHA-256 不变 | [保护记录](/Users/liuhang/Documents/project-abyssa/dist/reports/s0-preservation.json) |
| GitHub CI | 已配置，未在远端运行 | [.github/workflows/ci.yml](/Users/liuhang/Documents/project-abyssa/.github/workflows/ci.yml) |

浏览器本地实际使用 **Chromium 151.0.7922.34** 与 Playwright 1.63.0。Playwright 对应的 Chromium 153 下载超时后，通过 `ABYSSA_BROWSER_EXECUTABLE` 显式使用已有二进制；没有把本地运行记录写成 Chromium 153 或 Linux CI 通过。CI 会安装 Playwright 对应版本，其首轮远端结果仍待验证。版本记录见 [环境报告](/Users/liuhang/Documents/project-abyssa/dist/reports/s0-environment.json)。

浏览器覆盖九个 game 页面在根路径和 `/abyssa/` 的打开与刷新、标题进入菜单、四个菜单目的地、洋馆到商店／骰局、地图编队并点击 WebGL 地标进入战斗、本地骰局过牌／跟注与锁骰推进，以及四个 lab 页面、五个 tools 页面和工具索引。novel／rp／studio 额外检查实际纸娃娃图层，studio 检查动态漫符与静帧。完整浏览器报告保存在 `dist/reports/smoke.json`。报告输出使用项目绝对路径；落点修正后另以一次工具索引用例验证，证据为 `s0-report-path-probe.json`，不重复计入 35 项。测试服务器只读取构建产物，缺失文件返回 404；监听脚本异常、HTTP 错误和传输失败，并阻止 AI 及未登记外部请求。

### 11.2 实施中解决的真实问题

1. **构建与包目录冲突：**组件库和声明统一移到 `dist/ui`，并收紧包收集范围；全量构建后 UI 包仍为 184 个文件，压缩约 6.32 MiB、解包约 6.86 MiB。其他目标和报告不进入包。
2. **动态素材漏包：**静态浏览器测试发现 novel／rp 背景与 novel／studio 纸娃娃仍回指源码。背景改为静态 import；纸娃娃与漫符按登记策略复制，应用构建注入相对素材目录，Storybook 同步提供素材。组件 props 与公开导出不变，没有重压缩或改写原始美术。
3. **依赖旧缓存的测试：**原地图 CSS 层叠测试读取 `map-dist`，目录不存在时会跳过。现在每次在临时目录真实构建地图，并按 HTML 引用顺序读取全部样式表；三条原断言始终执行。
4. **测试时序与并发：**一次完整回归暴露 Battle 演出测试在全核并行下超过原 5 秒限制、地图断言早于 effect 提交。Vitest 固定两 worker，地图测试中的直接选点回调统一包入 `act()`；未放宽超时或移除断言。之后完整 695 项通过。
5. **依赖基线：**显式声明原配置已使用的 esbuild 0.28.1；新增 Babel parser 7.29.7 与 Playwright 1.63.0；Node 类型对齐 22.19.15。安装审计发现的四项间接依赖问题通过 brace-expansion 5.0.9、browserslist 4.28.9、nanoid 3.3.18、postcss 8.5.28 及必要浏览器数据更新修复，审计归零。React、Vite、TypeScript 主版本保持原状。

### 11.3 产物大小与清理记录

下列为未压缩静态文件总量，含本阶段保留的 public 素材；不同发行物中的重复文件分别计数。

| 目标 | 文件数 | 总量 | 主要 JS／CSS |
| --- | --- | --- | --- |
| ui | 182 | 6.84 MiB | CSS 约 210 KiB |
| game | 594 | 68.48 MiB | Three.js 约 497 KiB，battle CSS 约 223 KiB |
| lab | 201 | 54.28 MiB | catalog JS 约 189 KiB |
| tools | 211 | 38.40 MiB | 共享 runtime JS 约 186 KiB，studio CSS 约 77 KiB |

逐文件证据见 `dist/reports/ui.json`、`game.json`、`lab.json`、`tools.json`。S0 记录实际大小，未为游戏资产设未经测量的发布预算，也未顺带迁移 public 素材归属。

根目录的 17 个 `<入口>-dist`、`storybook-static` 与旧 `dist` 顶层 UI 文件已移到临时备份：`/var/folders/2t/qp430h4s28lfj8fwhfj3trdc0000gn/T/abyssa-s0-Gy5gOG/retired-builds/`。同级 `configs/` 保存原配置，`baseline.json` 保存起点与已有文件哈希。临时目录可被系统清理，长期依据是当前可审查的代码差异与本文件。

用户已有标题 CG 源码和六张新 CG 素材保持原字节；`static-preview` 保持原样。已有 `GAME_SYSTEMS_AND_CONTENT_SPEC.md` 仅追加 S0 追记并将已删除配置的索引更新到当前实现，保留原审计内容；README 也按新命令更新，二者属于有意的文档改动。

### 11.4 后续边界

游戏状态、RNG、规则、存档和结算继续归 Abyssa。当前默认关闭骰局远程接口，未导入 rp-style-lab 源码、运行其服务或执行旧 setup；后续 S4 才迁移现行 Model Slot／Pipeline 协议。配置层的 `--ai` 仅保留旧实验适配器的显式开关。

S1 继续抽取纯规则内核，S2 建立存档与应用层，S3 完成跨场景状态和结算闭环。地图到战斗的导航成功不代表战斗已消费出击令。地图图片、部分缇比立绘与 Google Fonts 仍有外链，完全离线素材发行也尚未完成。上述事项不归为本轮已交付能力。

S1 的独立勘探与实施清单已整理为 [S1 计划](/Users/liuhang/Documents/project-abyssa/docs/archive/plans/S1_CORE_EXTRACTION_PLAN.md)及 [S1 审计](/Users/liuhang/Documents/project-abyssa/docs/archive/audits/2026-09-05-s1-core-extraction.md)。S1 现已完成纯规则迁移及本地验收；实施结果见其第 12 节，S0 的历史验收记录保持不变。
