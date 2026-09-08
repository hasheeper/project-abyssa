# @abyssa/ui

Abyssa 的复古 RPG React 组件库与交互场景仓库。项目从静态视觉原型中提取可复用组件，并用角色状态、战斗、骰局、地图、视觉小说、跑团、商店、洋馆、设置页和制作工具等独立入口验证组合效果。

组件使用原生语义元素、TypeScript 类型和命名空间化 CSS 变量；组件包本身不依赖业务后端。仓库内共有 **19 个 Vite 入口**：1 个组件目录、13 个场景／实验入口和 5 个制作工具。

当前游戏已经接通同档案的角色、地图出征、庄园初战／维护／回忆、成长装备、基础商店与结算恢复；默认使用规则4／内容6。新档先播放四幕15图CG，再进入「洋馆的第一个清晨」，早餐至出门合为一幕，默认AVG、可切RP；首晨由JSON主控，120个节点与五组选项可保存和恢复。章节交接后暂回现有洋馆，岩窟教学、回馆兑现和正式音频待补。庄园难度与既有剧作仍需返工。

- [文档统一入口](docs/README.md)
- [当前机制与完整游戏闭环](docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)
- [定稿、完成度与下一步](docs/DESIGN_DECISIONS_AND_CURRENT_STATUS.md)
- [初章与引导计划](docs/plans/DEMO_PROLOGUE_AND_ONBOARDING_PLAN.md)
- [序幕CG实施与素材缺口](docs/design/PROLOGUE_CG_IMPLEMENTATION.md)
- [首晨AVG／RP实施与交接](docs/design/FIRST_MORNING_IMPLEMENTATION.md)
- [本轮序幕与首晨基线收口](docs/archive/audits/2026-09-09-opening-avg-closeout.md)
- [运行／构建与工程配置](config/README.md)
- [历史计划与验收档案](docs/archive/README.md)

Abyssa独立拥有游戏规则与存档，复杂LLM上下文／管线按需交给rp-style-lab。原始人设、已定稿美术和既有界面继续保留；工程接线通过不代表内容质量已验收。

## 当前组件

### 基础结构

- `AbyssaProvider`：主题、强调色与密度容器
- `RpgFrame`：三层边框与角部装饰容器
- `RpgHeader`、`SectionHeader`：章节标题与区段标题
- `RpgDialogue`：支持主副姓名、逐字播放、可变高度、隐藏姓名牌和完成回调的对话面板
- `Nameplate`：角色姓名牌
- `DiamondWatermark`：可直接覆盖容器或嵌入 SVG pattern 的双层菱形底纹
- `AbyssaLogo`：由八个可独立变换部件组成的项目标题 Logo，支持布局参数 JSON / TypeScript 序列化；默认自带近黑底板，叠加到场景上时须设 `background="none"`，`crop="tight"` 可收紧留白；`intro` 开启按阅读顺序逐部件弹入的入场动画（约 1.4s，尊重降低动效）

### 操作控件

- `RibbonButton`、`RpgHexButton`：燕尾按钮与对称六边形主按钮
- `RpgShapeButton`、`RpgCircleButton`：圆形、切角方形、切角横条与胶囊按钮
- `RpgBackButton`、`IconButton`、`ArrowButton`：返回、图标与方向按钮
- `RpgTab`：四套主题、可受控选中、底边开放的内容标签
- `RpgRadio`、`RpgCheckbox`：保留参考稿外观的原生表单控件
- `RpgNotchButton`、`RpgNotchedPillButton`：带内部 V 形翻折的方形与胶囊按钮
- `RpgDiamondNode`、`RpgDiamondNodeTrack`：可独立或数据驱动组合的菱形节点
- `RpgFacetDiamond`、`RpgModal`：分面菱形状态节点与通用 RPG 弹窗容器
- `RpgDirectionPad`：四向指令方向盘
- `Toggle`：支持受控和非受控状态的开关

### 数据与角色展示

- `Progress`、`VerticalIndicator`、`RpgStatusNode`：进度、纵向装饰指示和紧凑状态节点
- `RpgPanel`、`RpgSquarePanel`：角色选择面板与简约小方块
- `CurrencyAmount`：里拉和远古晶石的货币显示
- `CharacterSelector`、`CharacterPortraitSelector`：列表式与头像轮播式角色选择器
- `ItemSlot`、`InventoryGrid`、`InventoryDialog`：统一稀有度语言的物品槽、库存网格与领地库存弹窗
- `StatusPanel`：数据驱动的身份、属性、特性和记录面板
- `CharacterStatusScreen`：角色、服装、档案标签和阵营主题组成的完整状态页面

### 场景组合与立绘系统

- `BattleScreen`：回合顺序、四姿态角色图集、目标选择、队伍状态、单体攻击与群体技能演出
- `VisualNovelScene`：保留最近两名角色站位、表情延续和逐字对话的 AVG 场景
- `RpScene`：追加式跑团消息流，含两席位立绘、进退场、历史气泡、旁白、系统消息和判定条
- `PaperDoll`：按角色画布校准表拼合底图、眼睛、嘴部与附加表情的分层立绘
- `Emote`：15 个统一规格的 APNG 头顶漫符，支持全局基准与逐角色微调
- `expressions`、`spriteCalibration`：表情部件映射与角色画布校准数据
- `motions`：立绘动作关键帧生成器（`playMotion` + `nod`/`waver`/`jump`/`shakeLight`/`shakeHeavy`）
- `shared/transition`：独立 HTML 场景间的闭幕、真实资源等待、抵达标题与淡入／面板落入交接

公共组件和类型统一从 `src/index.ts` 导出。为兼容早期接入，部分组件同时保留 `RetroRpg*` 别名。

## 源码结构

```text
src/
  game-core/  # 纯规则、Catalog 契约、三层状态；独立 Node 验证
  game-application/  # 命令、回执、Fact、存储/AI Port
  game-infrastructure/  # Memory / IndexedDB / 本地短反应
  game-runtime/  # 具体内容和适配器装配，旧页面兼容入口
  apps/       # 独立运行的概念原型；app 之间禁止直接引用
  tools/      # 洋馆标注器、立绘工作台等内容制作工具
  content/    # 角色、房间等项目实例数据
  shared/     # 公共领域契约、UI、演出、固定舞台与纯工具
  assets/     # 当前共享美术资源
  index.ts    # @abyssa/ui 公共导出
```

游戏链路为 `apps → runtime → application → core/Port`，runtime 装配 `content/gameplay` 和 infrastructure；工具继续使用展示 content/shared/assets。应用服务说明见 [game-application](/Users/liuhang/Documents/project-abyssa/src/game-application/README.md)。`shared` 不反向依赖游戏内核、应用、工具或内容。`game-core` 仅依赖内部纯 TypeScript；它不进入 UI 包导出。运行 `npm run check:core` 检查独立类型、依赖、Node 测试与导入，`npm run check:baseline` 覆盖整个工程。共享边界见 [`src/shared/README.md`](src/shared/README.md)。

## 本地运行

```bash
# 使用 .nvmrc 指定的 Node 22.23.2 与 npm 10.9.8
npm ci
npm run dev
```

组件目录默认运行在 `http://127.0.0.1:5173/`。它以实际接入为主：左侧按功能分类，支持名称/能力搜索；基础组件和组合范例提供交互预览、常用属性说明和可复制的最小调用代码。战斗、视觉小说和跑团等大型场景由对应应用与 Storybook 展示。

聚合开发入口：`npm run dev:game`（5190，标题首页）、`npm run dev:lab`（5191，组件目录与演出实验）、`npm run dev:tools`（5192，制作工具索引）。端口占用时明确报错；旧 `dev:<name>` 命令继续使用已登记的端口和页面。

```bash
npm run storybook
```

Storybook 默认运行在 `http://127.0.0.1:6006/`。

### 应用预览

仓库共有19个Vite入口。Title、Prologue、Menu、Map、Battle、Mansion、Shop通过save/epoch定位同一IndexedDB档案；新建先看序幕，未完成时继续恢复当前镜头。裸场景链接会引导选择档案。骰局、演出实验和制作工具保持独立用途。

| 命令 | 入口 | 当前功能 |
| --- | --- | --- |
| `npm run dev` | 组件目录 | 按结构、操作、展示和组合范例分类；支持搜索、交互预览与复制最小调用代码，默认端口 5173 |
| `npm run dev:battle` | 裂隙远征 | 2–5 人真实编队、持久战斗、敌方意图与顺序演出、一次结算；木制／勇者／四席／魔王四套 UI 主题 |
| `npm run dev:dice` | 明暗骰 | 五骰牌型、固定注额下注、公开/私有锁骰、重掷、庄家轮换、筹码结算、3D 骰子和本地对手逻辑 |
| `npm run dev:map` | 副本地图 | Three.js + GSAP 地图、选点镜头聚焦、凯尔加 1–4 名伙伴、真实库存领用；裂隙远征提交成功后进入 Battle，托管暂未开放 |
| `npm run dev:title` | 标题画面 | 新建/继续、多档列表、导入/导出与坏档诊断；字标、CG 轮播、三套主题及黑幕转场保留，固定端口 5182 |
| `node scripts/run-target.mjs dev entry:prologue` | CG序幕 | 四幕15图，逐镜存档；从标题新建进入，独立端口5189 |
| `npm run dev:menu` | 枢纽主界面 | 四角命令盘（府邸/出征/仓库/商店）、破窗立绘与吐槽、档案侧栏、资源与相位顶栏 |
| `npm run dev:loading` | 场景交接实验室 | 骰子六面体黑幕、区域抵达标题、真实资源等待，以及淡入与实体面板落入的切换演示 |
| `npm run dev:mansion` | 洋馆基地 | 剖面图房间交互、角色 ADV、真实资金/库存/远征经历与本地反应；建设、生产和相位推进暂未开放 |
| `npm run dev:novel` | 视觉小说 | 双人/三人/四人剧本切换、两席位立绘轮换、表情延续、逐字对话，以及点击/空格/回车推进 |
| `npm run dev:rp` | 跑团演出 | NVL 消息流与 ADV 对话框两种版式、幕解锁与历史回看、LOG、AUTO、SKIP、REPLAY、判定条和逐字演出 |
| `npm run dev:settings` | 设置页 | 对齐现有 RP 默认参数的演出节奏、视觉显示与预览控件；状态当前只在本页生效，AI 服务栏仍是禁用占位，固定端口 5188 |
| `npm run dev:shop` | 商店界面 | 真实余额与游戏导航，交易和鉴定暂未开放；旧商品操作保留在显式 ShopPreview 原型中 |
| `npm run dev:studio` | 立绘工作台 | 调整逐角色画布、舞台站位、表情、漫符和动作；自动保存到本地并导出 TS、CSS、漫符参数或 JSON 快照，固定端口 5176 |
| `npm run dev:party-figure-studio` | 地图立绘工作台 | 校准十名地图 Q 版立绘的缩放、偏移与朝向，并以单图和五人编队两种视图导出共享参数，固定端口 5187 |
| `npm run dev:logo-studio` | Logo 工作台 | 逐部件调整位置、缩放、旋转与透明度；自动保存并导入／导出 JSON 或 TypeScript 布局参数，固定端口 5181 |
| `npm run dev:dice-studio` | 骰面工作台 | 独立检查共享远征骰面、六面配置与旋转交互，固定端口 5184 |
| `npm run dev:character-status` | 角色状态页 | 读取当前档案的概要／骰装／记事；无档案时选档，地图和战斗均可检视并返回 |
| `npm run dev:mansion-editor` | 洋馆热区标注器 | 在固定原图坐标系中标注矩形与多边形房间，并导出正式页面使用的参数 |

除组件目录外，各入口均提供 `build:<name>`；多数入口另有 `preview:<name>`，准确命令以 `package.json` 为准。独立产物位于 `dist/entries/<name>/`，并包含已登记的下游导航页面。组件库使用 `npm run build`，静态组件目录使用 `npm run build:preview` / `npm run preview:components`。

### 骰局 Runtime

骰局的牌型、下注、锁骰、重掷和结算都能在浏览器本地运行。外部 LLM Runtime 是可选增强，用于实时对手决策和局后战报润色；服务不可用时界面显示 `LOCAL FALLBACK`，核心骰局仍可游玩。

所有目标默认关闭远程调用，不要求 AI 服务在线。旧实验接口可由 `npm run dev:dice -- --ai` 或显式环境变量 `VITE_DICE_RUNTIME_ENABLED=true` 启用，开发代理此时才转发 `/api` 到 `127.0.0.1:8787`。

旧骰局适配器和 `setup:dice-runtime` 尚未迁移到 rp-style-lab 当前的 Model Slot／Pipeline 协议，不作为现行服务的安装指引，也不进入构建、启动或 CI 依赖链。接入工作留到 S4；S0 的页面与本地规则不依赖该接口。

### 共享固定画布

固定舞台型应用通过 `src/shared/stage/` 共享 1600 × 900 外画布、视口安全区和等比缩放逻辑。应用内部按设计尺寸布局，外层根据设备尺寸统一缩放，避免边框、内容和点击区域分别漂移。文档流型的组件目录与立绘工作台不使用这套适配。

共享画框令牌定义了内容可用区、木质压条、黄铜层与描边几何。修改固定舞台应用时，应同时检查桌面、平板和手机横屏，不要在画布内部使用视口单位进行二次缩放。完整约束见 `src/shared/stage/README.md`。

### 跨场景交接

`src/shared/transition/` 负责独立 HTML App 之间的闭幕与接力：旧场景先闭合黑幕，再执行同源导航；目标页等待字体、图片与可选业务 `ready()` 后，先显示区域抵达标题，再以 `fade` 或 `panel-drop` 揭示内容。它只共享呈现协议，不持有具体路由、存档或全局游戏状态。`menu` 是当前发起方，`mansion` 使用全屏淡入，`battle` 与 `shop` 使用实体面板落入；`loading` 是该流程的独立视觉实验页。完整契约见 `src/shared/transition/README.md`。

### 外部资源

- 构建出的 `@abyssa/ui` 组件包不主动请求远程字体、图片或业务接口。
- 地图底图、三个节点、委托背景与 Q 版队伍立绘均已归入 `src/assets/map/`，通过静态 import 随构建打包；目录和文件名见[地图素材说明](/Users/liuhang/Documents/project-abyssa/src/assets/map/README.md)。地图图片不再依赖外部图床。
- 骰局和商店入口的缇比立绘仍从 `files.catbox.moe` 加载；骰局的可选 LLM Runtime 只有显式启用后才连接本机 8787 端口。
- `loading`、`mansion`、`menu`、`shop` 与 `title` 的 HTML 入口通过 Google Fonts 加载 Cinzel 与 Noto Serif SC。

需要完全离线部署这些 Demo 时，应先把上述图片和字体转为本地资产，并关闭或替换骰局 Runtime。

### 素材管线

```bash
npm run icons:sync      # 同步 game-icons 图标
npm run icons:check     # 校验 317 个本地图标、清单与哈希
npm run emotes:build    # 把混合来源的 GIF/APNG 收敛成 30 帧 / 67ms / 192px
npm run emotes:check
npm run pack:setting    # 打包 st/setting/ 世界观设定
```

`emotes:build` 需要 `ffmpeg`，源目录默认 `~/Downloads/emo`，可用 `--source=` 覆盖。

## 构建与验证

组件库的检查与构建：

```bash
npm run typecheck
npm run boundaries:check
npm test
npm run build
npm run build-storybook
```

`npm run build` **只构建组件库**。产物位于 `dist/ui/`，包含 ESM、类型声明和独立样式文件；包导出键保持不变。`npm run build-storybook` 的产物位于 `dist/storybook/`。

```bash
npm run check:baseline   # 应用与工具类型、入口、模块边界、应用及构建测试
npm run build:all        # ui / game / lab / tools，输出互相隔离
npm run preview:game
npm run release:check:ui
npm run release:check:game
npm run build:entries    # 19 个兼容入口的临时构建与产物验证
npm run check:auxiliary  # 脚本语法及静态分享预览的隔离验证
```

浏览器检查先运行 `npx playwright install --only-shell chromium`，再运行 `npm run test:smoke`。它只服务真实 `dist`，检查根路径、子路径和无 AI 服务时的页面操作；保留既有外链素材，不宣称完全离线部署。`.github/workflows/ci.yml` 复用这些命令。

场景应用需要分别构建：

```bash
npm run build:battle
npm run build:dice
npm run build:map
npm run build:mansion
npm run build:menu
npm run build:loading
npm run build:mansion-editor
npm run build:novel
npm run build:rp
npm run build:settings
npm run build:shop
npm run build:studio
npm run build:character-status
npm run build:title
npm run build:party-figure-studio
npm run build:logo-studio
npm run build:dice-studio
```

聚合游戏、实验和工具分别输出到 `dist/game`、`dist/lab`、`dist/tools`；独立构建输出到 `dist/entries/<name>`。组件目录的无 Vite 依赖静态版本仍通过 `npm run build:preview` 生成到刻意提交的 `static-preview/`；自动检查使用临时目录，不刷新该分享快照。

## 前端接入

```tsx
import {
  AbyssaProvider,
  RpgHeader,
  RibbonButton,
  RpgPanel
} from "@abyssa/ui";
import "@abyssa/ui/styles.css";

export function Menu() {
  return (
    <AbyssaProvider>
      <RpgHeader label="STATUS" variant="dark" />

      <RibbonButton variant="teal" onClick={() => startGame()}>
        Start Game
      </RibbonButton>

      <RpgPanel
        variant="dark"
        number="01"
        aria-label="选择角色 01"
      />
    </AbyssaProvider>
  );
}
```

按钮组件基于原生 `button`，`RpgRadio` 与 `RpgCheckbox` 使用真实的原生 `input`。它们可以直接接入键盘操作、表单、`disabled`、`aria-*`、`className` 和 `style`；选择控件同时支持受控与非受控状态。

## 角色页面

```tsx
import { CharacterStatusScreen } from "@abyssa/ui";
import type { CharacterProfile } from "@abyssa/ui";

const characters: CharacterProfile[] = [
  {
    id: "abyssa",
    number: "06",
    name: "艾比希斯·贝尔泽兰",
    secondaryName: "ABYSSA BEELZERAN",
    status: {
      title: "当代魔王",
      subtitle: "THE VESSEL OF CHAOS",
      state: "状态：安定",
      fields: [
        { label: "种族", value: "根源存在" },
        { label: "职能", value: "混沌容器" }
      ],
      stats: [
        { label: "生命", secondaryLabel: "LIFE", value: "EX", accent: true },
        { label: "敏捷", secondaryLabel: "AGILITY", value: "D" }
      ]
    }
  }
];

export function StatusPage() {
  return <CharacterStatusScreen characters={characters} />;
}
```

`selectedId`、`activeMenuId` 等属性支持受控模式；也可以使用 `defaultSelectedId` 和 `defaultActiveMenuId` 让组件自己维护状态。

## 主题定制

组件颜色都来自 `--abyssa-*` CSS 变量。建议在业务主题容器上覆盖：

```css
.my-game-theme {
  --abyssa-teal: #6cc4c9;
  --abyssa-teal-soft: #a5e0e3;
  --abyssa-panel-black: #171c1c;
  --abyssa-font-display: "Cinzel", serif;
  --abyssa-font-body: "Noto Serif SC", serif;
}
```

```tsx
<AbyssaProvider className="my-game-theme" density="compact">
  <App />
</AbyssaProvider>
```

库本身不请求远程字体或图片。业务可以自行加载字体，并通过 `portraitUrl` 提供合法授权的角色图片。

## 目录结构

```text
src/
  apps/           catalog + 13 个场景／实验入口
    battle/       裂隙远征规则、表现层与四套 UI 皮肤
    loading/      场景交接视觉实验页
    menu/         守望者之崖枢纽主界面
    title/        标题画面：字标徽记 + 档案层命令 + 双侧 CG 轮播 + 三套主题
    prologue/     四幕CG序幕：运镜、字幕、阅读、特效与逐镜恢复
    mansion/      洋馆房间、角色 ADV、修缮与设施收益
  tools/          5 个内容制作、标注与参数校准工具
  content/        角色资料、洋馆默认区域等项目实例数据
  shared/         domain / lib / presentation / stage / transition / ui
  assets/         characters / backgrounds / battle / map / ui / icons / emote / cg
  index.ts        @abyssa/ui 唯一公共导出入口
config/           入口登记、目标、公共 Vite 工厂与浏览器检查配置
scripts/          目标运行、产物检查与素材工具(.mjs)
tests/            构建基础设施及静态发行物冒烟检查
references/
  html/           英文命名的视觉原型 HTML
  images/         英文命名的视觉参考图片
st/setting/       世界观与角色设定文本
dist/             ui / game / lab / tools / entries / storybook / reports
static-preview/   无构建工具依赖的组件目录预览
```

视觉原型统一归档在 `references/`，不参与组件库生产构建。根目录的19个HTML在 `config/entries.mjs` 登记，由公共工厂构建。旧 `vite --config vite.<name>.config.ts` 调用改用对应npm命令；默认 `vite.config.ts` 仍兼容直接运行Vite。

## 素材说明

`references/images/` 中的图片带有示例水印，只作为视觉方向参考，不会被打进组件包。正式项目应使用原创 SVG/CSS 或已获得授权的素材。

共享素材按用途归类，目录和新增素材放置规则见 [`src/assets/README.md`](src/assets/README.md)。
