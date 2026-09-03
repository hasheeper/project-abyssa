# Abyssa 概念原型期：项目关系与 Shared 基线规划

> 状态：已实施（Phase A–D）
> 适用阶段：概念原型 / 垂直切片验证期
> 对应代码基线：`b232f01 chore: consolidate current project baseline`
> 实施日期：2026-08-30
>
> 本文是历史实施记录，保留当时的 11 个入口、63MB 素材与“不整理资产管线”等基线陈述，不代表 2026-09-03 的仓库现状。当前入口、代码量、素材目录和维护结论以根 [`README.md`](../../README.md) 与 [`CODE_MAINTENANCE_AUDIT.md`](../CODE_MAINTENANCE_AUDIT.md) 为准；本文第 12 节起仅记录后续落地结果。

## 0. 结论

当前不应该把这些原型强行串成“一套完整游戏流程”。现阶段只做两件事：

1. 给每类代码确定唯一归属，禁止一个场景借用另一个场景的内部实现；
2. 建立最小的 `shared` 与 `content`，只收纳已经被多个原型实际复用、语义相对稳定的能力。

各场景继续保持独立入口、独立状态和独立验证目标。`shared` 是底层能力层，不是未来总游戏的雏形，更不能成为“暂时不知道放哪”的杂物间。

---

## 1. 当前阶段的边界

### 1.1 本轮要解决

- 明确组件目录、场景原型、编辑工具、内容数据、公共能力之间的关系；
- 建立单向依赖规则；
- 为 `shared` 定义准入标准和最小目录；
- 关闭当前已经存在的场景间直接引用；
- 给后续逐步迁移提供顺序、验收条件和停止点；
- 保持所有现有页面的视觉、交互、URL 和构建结果不变。

### 1.2 本轮明确不做

- 不设计主菜单到战斗、地图、商店、洋馆之间的完整产品流程；
- 不引入全局路由、全局 Store、统一事件总线或统一游戏状态；
- 不设计正式存档、账号、后端、联网协议或资源热更新；
- 不把所有原型改造成一个 Vite 应用；
- 不为了“看起来整齐”一次性搬迁全部源码；
- 不拆分洋馆和战斗的大型页面文件；
- 不整理 63MB 美术素材的最终资产管线；
- 不进行 monorepo、workspace 或多包发布改造；
- 不统一所有页面的设计语言。

这些事项只有在核心循环和页面职责稳定后才有足够信息做正确决策。

---

## 2. 迁移前项目的真实形态

迁移前，仓库不是一个完整游戏，也不只是一个 UI 组件包，而是四类内容平铺在同一个 `src/` 中：

| 类型 | 迁移前目录 | 实际职责 |
| --- | --- | --- |
| 公共 UI 与基础能力 | `components`、`styles`、`hooks`、`utils`、`stage` | 被多个页面使用的组件、设计令牌、固定画布和小工具 |
| 可运行概念原型 | `demo`、`battle`、`dice`、`map`、`mansion`、`novel`、`rp`、`shop`、`character-status` | 独立验证某个场景的视觉和交互 |
| 内容制作工具 | `mansion-editor`、`studio` | 生产或校准区域、立绘等参数，不属于玩家流程 |
| 内容与美术 | `demo/data.ts`、各场景内的数据文件、`assets`、`public/mansion-map` | 角色资料、房间数据、剧本、图片和导出结果 |

仓库共有 11 个 Vite 入口：1 个组件目录、8 个面向玩法或场景的原型（包含洋馆），以及 2 个制作工具。它们可以共享能力，但不应假定它们已经属于同一运行时。

### 2.1 迁移前已经存在但没有被命名的 Shared

下列迁移前目录本质上已经是共享层：

- `src/components`：公共 UI 组件和一部分组合型演出组件；
- `src/styles`：设计令牌及公共组件样式；
- `src/stage`：1600 × 900 固定舞台与缩放契约；
- `src/hooks`：受控 / 非受控状态工具；
- `src/utils`：无业务语义的小工具；
- `src/assets`：多个原型共同使用的美术素材。

问题并不是“完全没有 shared”，而是它们还没有统一边界，并且部分真正的共享代码仍寄居在具体场景内部。

### 2.2 迁移前需要关闭的反向依赖

| 当前引用 | 问题 | 正确归属方向 |
| --- | --- | --- |
| `mansion → mansion-editor/types` | 玩家页面依赖制作工具 | 区域契约进入 `shared/domain/mansion` |
| `mansion → mansion-editor/defaultRegions` | 运行时数据由编辑器持有 | 默认区域进入 `content/mansion` |
| `mansion → rp/AdvStage` | 洋馆借用跑团页面内部组件 | ADV 演出能力进入 `shared/presentation/adv` |
| `battle → dice/components/ActionDock` | 战斗借用骰局内部 UI | 已复用的行动栏进入 `shared/ui/patterns` |
| `battle → dice/components/DiceActionButton` | 同上，命名还绑定骰局 | 先原名迁移，稳定后再判断是否改通用名 |
| `battle → dice/game.randomRollDuration` | 战斗只为一个动画参数依赖整套骰局规则 | 骰子动效时序进入 `shared/presentation/roll` |
| `map → shop/ShopMetalCorner` | 地图借用商店装饰组件 | 金属包角进入 `shared/ui/decorations` |
| `character-status → demo/data` | 正式页面依赖组件目录的示例数据 | 角色资料进入 `content/characters` |
| `components` 的测试 / Storybook → `demo` | 共享组件验证反向依赖应用 | 改用独立测试夹具或最小 Story 数据 |

这些引用迁移前能够运行，但它们让目录名称失去可信度：移动或删除一个原型时，会意外破坏另一个原型。

---

## 3. 最基础的项目关系

概念原型期只需要四类一等模块：

| 模块 | 定义 | 可以包含 | 不可以包含 |
| --- | --- | --- | --- |
| `apps` | 面向玩家或评审者的可运行原型 | 页面状态、场景交互、局部规则、入口文件 | 被其他 app 直接引用的组件 |
| `tools` | 内容生产与参数校准工具 | 编辑器状态、导入导出、校准界面 | 玩家运行时必须依赖的契约或默认内容 |
| `content` | 项目创作出来的数据 | 角色资料、房间参数、剧本、物品定义 | React 组件、浏览器状态、页面流程 |
| `shared` | 与具体入口无关的公共能力 | UI、舞台、演出协议、稳定领域类型、纯工具 | 任一 app/tool 的页面、Store 或业务流程 |

`assets` 是特殊资源层：它不负责业务关系，当前继续保留在 `src/assets` 和 `public`，本阶段不做大规模搬迁。

### 3.1 依赖方向

```text
                   ┌──────────────┐
                   │    assets    │
                   └──────▲───────┘
                          │ 可引用素材

┌──────────────┐    ┌─────┴────────┐
│     apps     │───▶│   content    │───▶ shared/domain
└──────┬───────┘    └──────────────┘
       │
       ├──────────────────────────────▶ shared/*
       │
┌──────┴───────┐
│    tools     │──────────────────────▶ shared/*
└──────┬───────┘
       └──────────────────────────────▶ content
```

必须遵守：

1. `app A` 不得引用 `app B`；
2. `app` 不得引用 `tool`，`tool` 也不得成为运行时契约的所有者；
3. `shared` 不得反向引用 `apps`、`tools` 或 `content`；
4. `content` 只可依赖 `shared/domain` 中的类型和纯函数，不依赖 UI；
5. `apps` 和 `tools` 可以组合 `shared` 与 `content`，但彼此保持独立；
6. 原型专属规则留在原型内部，即使它写得很成熟，也不因此自动进入 `shared`。

### 3.2 为什么先解耦、再物理搬迁所有 App

把十一个入口立刻搬进 `src/apps` / `src/tools` 只会制造大量 import、Vite 入口和资源路径变更，却不会直接消除耦合。第一阶段先让依赖方向正确；当 app 之间已经零引用时，目录移动才会成为低风险的机械操作。

因此实施时先建立 `apps` 与 `tools` 的**逻辑归属**：

- 迁移前的 `src/battle` 等目录逻辑上属于 `apps`；
- 迁移前的 `src/mansion-editor`、`src/studio` 逻辑上属于 `tools`；
- Phase B、C 验证稳定后，再执行低风险的物理归组。

---

## 4. Shared 的最小结构

目标结构如下。第一轮只创建实际需要的叶子目录，不创建空目录占位。

```text
src/
  shared/
    domain/
      mansion/              # 区域文件、矩形、多边形等稳定契约
      characters/           # 稳定角色标识与基础资料类型；不放具体角色资料
    ui/
      primitives/           # 按钮、框体、标签、进度等无场景语义组件
      patterns/             # 行动栏、对话框等跨场景组合组件
      decorations/          # 金属包角、菱形底纹等纯视觉构件
    stage/                   # 固定画布、缩放、安全区、舞台契约
    presentation/
      adv/                   # ADV 消息、席位推导、立绘和对话演出
      roll/                  # 多个场景共享的骰子视觉与动效时序
    lib/                     # cx、受控状态等无 UI、无领域语义工具
    testing/                 # 公共组件测试夹具；不进入生产构建

  content/
    characters/             # Abyssa 具体角色资料与美术映射
    mansion/                # 洋馆区域、房间说明与初始参数

  assets/                   # 本阶段保持原位
```

### 4.1 各层职责

#### `shared/domain`

只放稳定的数据语言和纯变换，例如：

- `MansionRegionFile`、`MansionRectangle`、`NormalizedPoint`；
- 区域文件版本校验、归一化和克隆函数；
- 稳定的 `CharacterId` 或角色基础资料接口。

不放“魔王寝室位于哪里”或“今天谁在厨房”之类具体内容，也不放 React。

#### `shared/ui`

只负责显示与局部交互。组件应能在不知道战斗、商店、洋馆全局流程的情况下使用。

- `primitives`：最小视觉语法；
- `patterns`：已被至少两个场景使用的组合控件；
- `decorations`：无状态的视觉零件。

组件 CSS 与组件放在同一所有权目录中；全局令牌仍由唯一入口加载，避免同一组件的结构和样式分属两个业务目录。

#### `shared/presentation`

承载“如何演”的共享协议，而不是“演什么内容”。ADV 的消息类型、席位推导、立绘进退场和对话框属于这一层；具体剧本、洋馆对白和 RP 章节不属于这一层。

#### `shared/stage`

保留现有固定舞台的职责。它只解决设计画布、视口缩放和安全区，不承担页面导航或全局外壳。

#### `shared/lib`

仅放无 React、无内容、无场景语义的纯工具。不能因为一个函数很短，就把所有业务 helper 都塞进这里。

#### `content`

内容数据拥有自己的一级目录，是为了避免两种常见错误：

- 把具体角色、房间和剧本塞进 `shared`，让共享层反向绑定世界观；
- 把公共内容寄存在某个 demo 中，导致正式页面依赖 demo。

---

## 5. Shared 准入规则

一个模块进入 `shared` 前，应同时满足以下条件：

1. 已有至少两个真实消费者，或它本身就是明确的基础契约（如固定舞台、区域文件格式）；
2. 两个消费者复用的是同一个语义，而不只是“看起来很像”；
3. API 名称不需要带某个来源 app 的上下文才能解释；
4. 不读取来源 app 的 Store、常量、路由或页面 DOM；
5. 能用 props、稳定类型或纯函数描述边界；
6. 有最小测试，视觉组件至少有现有页面或 Storybook 用例可验证；
7. 移入后不会迫使其他 app 接受其业务规则。

以下内容应继续留在场景内部：

- 只被一个场景使用的大页面；
- 尚在快速试错的交互；
- 战斗引擎、骰局规则等当前只有一个真实所有者的领域逻辑；
- 带有页面级状态机、路由、存档或请求副作用的代码；
- 仅仅颜色相近、但用途不同的 CSS；
- 为未来“也许会用”而提前抽象的接口。

判断口诀：**先有复用事实，再有 Shared；先共享协议，不共享流程。**

---

## 6. 第一批归位清单

第一批只处理已经发生的跨场景引用，不扩张范围。

| 优先级 | 当前内容 | 建议目标 | 处理方式 |
| --- | --- | --- | --- |
| P0 | `mansion-editor/types.ts` | `shared/domain/mansion/regions.ts` | 原类型迁移，编辑器与洋馆共同依赖 |
| P0 | `mansion-editor/defaultRegions.ts` | `content/mansion/defaultRegions.ts` | 数据与工具分离；测试跟随内容移动 |
| P0 | `demo/data.ts` 中的具体角色资料 | `content/characters/profiles.ts` | demo 与角色页共同消费；组件测试改用精简夹具 |
| P0 | `shop/ShopMetalCorner.tsx` | `shared/ui/decorations/MetalCorner.tsx` | 组件去掉来源场景命名，商店和地图共同引用 |
| P0 | `dice/components/ActionDock*` | `shared/ui/patterns/action-dock/` | 第一轮保留视觉与 API，不顺手重设计 |
| P0 | `dice/game.randomRollDuration` | `shared/presentation/roll/timing.ts` | 与骰局规则文件断开，只共享动效时序 |
| P1 | `rp/AdvStage.tsx` 及所需舞台推导 | `shared/presentation/adv/` | 先拆出消息 / 席位协议，再迁移视图；RP 与洋馆共用 |
| P1 | `stage/*` | `shared/stage/` | 现有职责已稳定，纯路径归位 |
| P2 | `components`、`styles`、`hooks`、`utils` | 对应 `shared/ui`、`shared/lib` | 分批迁移；保持 `src/index.ts` 对外 API 不变 |

### 6.1 不应趁机处理的内容

- 不在迁移 `AdvStage` 时重写 RP 的整套消息流；
- 不在迁移行动栏时统一战斗和骰局的全部按钮；
- 不在迁移角色资料时设计最终角色数据库；
- 不在迁移 `stage` 时制作全局游戏壳；
- 不在迁移组件时批量重命名 CSS class；
- 不在这批工作中移动图片目录或修改资源格式。

---

## 7. 分阶段执行方案

### Phase A：建立边界，不改变页面（已完成）

目标：先让架构规则可见、可检查。

1. 新增 `src/shared/README.md`，写入依赖规则和准入标准；
2. 新增 `src/content/README.md`，说明内容层不得包含 React 和页面状态；
3. 增加轻量边界检查，至少阻止 `app → app`、`app → tool`、`shared → app/tool/content`；
4. 暂不引入 ESLint 或新架构框架，优先复用 Vitest / Node 脚本；
5. 不引入路径别名，继续使用相对路径，直到 Vite 配置被统一管理。

停止点：规则文件存在、检查能在当前测试体系运行，但页面代码尚未迁移。

### Phase B：关闭现有跨场景引用（已完成）

目标：把第 6 节的 P0 项逐组迁移。

建议一个依赖家族一个提交：

1. 洋馆区域契约与默认内容；
2. 角色资料与测试夹具；
3. 金属包角；
4. 行动栏与骰子动效时序；
5. ADV 演出协议与视图。

每组迁移只允许发生三类修改：移动文件、更新 import、补充或移动测试。视觉和交互改动应另开工作。

停止点：仓库内不存在一个场景直接引用另一个场景的生产代码。

### Phase C：归并已经成熟的公共目录（已完成）

目标：把现在事实上的共享层放进同一个物理边界。

迁移顺序：

1. `stage → shared/stage`；
2. `hooks`、`utils → shared/lib`；
3. UI primitives 与其样式；
4. UI patterns 与 presentation；
5. 最后整理 `src/index.ts` 的内部来源，保持 `@abyssa/ui` 导出名称不变。

停止点：`shared` 已形成可识别边界，现有 app 仍保留原目录与独立入口。

### Phase D：目录归组（已完成）

Phase B、C 稳定并通过测试后，已执行物理移动：

```text
src/apps/<name>
src/tools/<name>
```

这一步只改变所有权和路径，不改变产品能力。11 个 HTML 入口、相对 import、CSS 素材路径、Storybook 与静态预览已同步更新。

---

## 8. 导出与引用策略

### 8.1 公共包导出

`src/index.ts` 继续是 `@abyssa/ui` 的唯一公共出口。只有确实准备给仓库外消费者使用的稳定 UI 才从这里导出。

- app 页面不导出；
- content 不从 UI 包导出；
- 原型内部组件即使位于 `shared`，也可以先保持仓库内使用；
- 文件迁移不应造成现有公共组件改名。

### 8.2 仓库内部引用

第一阶段使用明确的相对路径，不立刻增加 `@shared/*` 别名。原因是当前有多份 Vite 配置，过早加别名会把一次结构清理扩张成配置整合。

当 Vite 配置有了统一工厂后，再考虑：

```text
@shared/*
@content/*
```

禁止建立 `@battle/*` 给其他 app 使用；别名不能成为跨场景依赖的后门。

### 8.3 Barrel 文件

允许每个稳定叶子模块有自己的 `index.ts`，例如 `shared/stage/index.ts`。不建立一个导出全部内容的 `shared/index.ts`，以免隐藏所有权并诱发循环依赖。

---

## 9. 验证标准

每一批迁移完成后至少满足：

- TypeScript 类型检查通过；
- 现有 Vitest 测试全部通过；
- 受影响入口能够单独构建；
- 受影响页面在浏览器中完成一次交互冒烟检查；
- `src/index.ts` 的公共导出未意外变化；
- 没有新增 app 之间或 app 到 tool 的直接 import；
- `shared` 中没有来源 app 的页面状态、路由和内容数据；
- CSS、字体和图片 URL 在开发与构建预览中均可解析；
- 迁移提交不混入视觉微调或业务功能改动。

Phase B 的完成定义：

```text
app → app                 0
app → tool                0
shared → app/tool/content 0
content → React/UI        0
```

---

## 10. 风险与控制

| 风险 | 可能表现 | 控制方式 |
| --- | --- | --- |
| 大规模路径修改掩盖功能回归 | 页面能编译但素材、CSS 或动态路径失效 | 一次迁移一个依赖家族，并做浏览器冒烟检查 |
| Shared 变成杂物间 | 文件都被搬进去，场景边界反而更模糊 | 执行第 5 节准入规则；没有第二消费者就默认留本地 |
| 抽象过早 | 为统一两个相似页面产生复杂 props 和条件分支 | 第一轮允许“原样移动”，不要求立即设计完美通用 API |
| 内容与领域契约混在一起 | shared 绑定具体角色或房间 | 类型 / 纯规则进 `shared/domain`，实例数据进 `content` |
| CSS 迁移导致全局覆盖顺序变化 | 视觉细节莫名改变 | 样式跟随所有者，保留现有加载顺序，迁移后截图核对 |
| Vite 配置同步成本扩大 | 一个 alias 要改十余份配置 | 第一阶段不使用 alias，不合并应用 |
| 公共包导出意外膨胀 | 原型内部 API 被外部依赖 | `src/index.ts` 继续人工审核，不自动导出整个 shared |

---

## 11. 后续触发条件

只有出现以下证据，才开始讨论“完整游戏结构”：

- 至少一条核心循环已经确定，例如洋馆 → 远征 → 结算 → 洋馆；
- 页面之间需要共享的最小运行时状态已经明确；
- 存档边界和内容版本策略有真实需求；
- 两个以上原型需要在同一会话中连续运行，而不是独立演示；
- 当前 shared 边界已稳定，跨场景直接引用保持为零。

在此之前，独立原型不是技术债，而是降低错误统一成本的正确形态。

---

## 12. 实施结果与停止点

Phase A–D 已落地为以下一级关系：

```text
src/
  apps/       # catalog + 8 个独立场景原型
  tools/      # mansion-editor + studio
  content/    # 角色资料、洋馆默认区域
  shared/     # domain / lib / presentation / stage / testing / ui
  assets/     # 继续保留原位
  index.ts    # @abyssa/ui 唯一公共出口
```

当前验收结果：

- `app → app`、`app → tool`、`shared → app/tool/content`、`content → React/UI` 均为 0；
- TypeScript、314 项 Vitest 测试、公共包、静态组件目录与 Storybook 构建通过；
- 8 个场景原型和 2 个制作工具均可独立构建，11 个 HTML 入口完成浏览器挂载冒烟；
- 洋馆房间聚焦/取消聚焦与角色 ADV 完成交互冒烟；
- 未引入全局路由、Store、存档、统一流程、路径别名或 monorepo。

本轮到此停止。下一步应继续在各自 app 内验证核心交互；只有第 11 节的触发条件出现后，才讨论统一运行时。

---

## 13. 后续表现层增量（2026-08-30 清理基线）

第 12 节记录的是 Phase A–D 完成时的停止点。本节只追加其后的原型增量，不回写当时的审计数字或扩大原规划范围。

### 13.1 入口与目录现状

仓库当前共有 13 个独立 Vite 入口：1 个组件目录、10 个场景／实验入口和 2 个制作工具。`src/apps` 在原有八个场景之外新增：

- `menu`：守望者之崖枢纽主界面，持有目的地 URL 与交接文案；
- `loading`：场景交接的视觉实验壳，不是正式游戏目的地。

`menu` 前往洋馆、商店和战斗时仍采用普通同源 URL 导航，不导入目标 app。新增入口因此没有改变 `app → app = 0` 的边界，也不表示这些页面已经被合并为统一运行时。

### 13.2 新增 Shared 能力

本批增量只共享已经形成稳定呈现协议的部分：

| 目录 | 当前职责 | 边界 |
| --- | --- | --- |
| `shared/transition` | 独立 HTML App 间的闭幕、真实资源等待、区域抵达标题，以及 `fade` / `panel-drop` 揭幕 | 不登记路由，不持有存档、业务状态或全局流程 |
| `shared/ui/items` | 物品稀有度名称、排序与归一化 | 不拥有价格、掉落或库存规则 |
| `shared/ui/primitives` | `ItemSlot`、`RpgFacetDiamond`、`RpgModal` 等无场景流程控件 | 不读取任一 app Store |
| `shared/ui/patterns` | `InventoryGrid`、`InventoryDialog` 等调用方数据驱动的组合 UI | 不持有领地库存 canonical state |

`transition` 的当前真实消费者为 `menu`、`mansion`、`battle` 与 `shop`；`loading` 只用于独立重放和人工检查该协议。共享库存 UI 当前由洋馆等页面组合，具体物品与数量仍归调用方所有。

### 13.3 场景表现现状

- `menu` 已形成资源／相位顶栏、四角命令盘、角色立绘、ADV 对话和侧栏组成的枢纽原型；
- `mansion` 已补充房间聚焦、角色 ADV、修缮／收获、领地库存和相位呈现；
- `battle` 已建立木制、勇者、四席与魔王四套纯表现皮肤，外层背景与内部框体消费同一 `uiSkin`；
- `shop` 与 `battle` 使用各自背景和 `panel-drop`，`mansion` 使用全屏 `fade`；
- `loading` 使用六个真实 DOM 平面呈现骰子，作为交接黑幕的视觉验证页。

这些能力仍属于概念原型期的表现层基线。战斗皮肤不进入 canonical battle state，场景交接不承担运行时状态同步，库存组件也不构成统一物品系统。

### 13.4 当前停止点

本批仍不引入全局 Router、全局 Store、统一存档、跨页面事件总线或聚合式游戏壳。可以继续通过独立入口验证视觉与交互；只有第 11 节的产品触发条件成立后，才评估共享会话状态和正式流程编排。
