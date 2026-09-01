# @abyssa/ui

Abyssa 的复古 RPG React 组件库与交互场景仓库。项目从静态视觉原型中提取可复用组件，并用角色状态、战斗、骰局、地图、视觉小说、跑团、商店、洋馆和制作工具等独立入口验证组合效果。

组件使用原生语义元素、TypeScript 类型和命名空间化 CSS 变量；组件包本身不依赖业务后端。仓库内共有 **15 个 Vite 入口**：1 个组件目录、11 个场景／实验入口和 3 个制作工具。

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
  apps/       # 独立运行的概念原型；app 之间禁止直接引用
  tools/      # 洋馆标注器、立绘工作台等内容制作工具
  content/    # 角色、房间等项目实例数据
  shared/     # 公共领域契约、UI、演出、固定舞台与纯工具
  assets/     # 当前共享美术资源
  index.ts    # @abyssa/ui 公共导出
```

依赖方向为 `apps/tools → content/shared/assets`、`content → shared/domain`；`shared` 不反向依赖应用、工具或内容。可运行 `npm run boundaries:check` 检查边界，细则见 [`src/shared/README.md`](src/shared/README.md)。

## 本地运行

```bash
npm install
npm run dev
```

组件目录默认运行在 `http://127.0.0.1:5173/`。它以实际接入为主：左侧按功能分类，支持名称/能力搜索；基础组件和组合范例提供交互预览、常用属性说明和可复制的最小调用代码。战斗、视觉小说和跑团等大型场景由对应应用与 Storybook 展示。

```bash
npm run storybook
```

Storybook 默认运行在 `http://127.0.0.1:6006/`。

### 应用预览

仓库共有 15 个 Vite 入口。除骰局与战斗包含局部规则外，其余场景主要用于验证 UI 状态、交互和动画；这些入口仍相互独立，不代表已经形成完整游戏流程。

| 命令 | 入口 | 当前功能 |
| --- | --- | --- |
| `npm run dev` | 组件目录 | 按结构、操作、展示和组合范例分类；支持搜索、交互预览与复制最小调用代码，默认端口 5173 |
| `npm run dev:battle` | 裂隙远征 | 五人命数骰编队、敌方意图、攻击／防御／治疗、远征账本与木制／勇者／四席／魔王四套 UI 主题 |
| `npm run dev:dice` | 明暗骰 | 五骰牌型、固定注额下注、公开/私有锁骰、重掷、庄家轮换、筹码结算、3D 骰子和本地对手逻辑 |
| `npm run dev:map` | 副本地图 | Three.js + GSAP 纸芝居地图、三处可选地点、镜头视差、入场动画和木质画框 |
| `npm run dev:title` | 标题画面 | 字标徽记做旧并逐部件弹入、四项档案层命令（继续/新开/记录/设定）、缓速自转放射背景场、两侧 CG 交叉淡入轮播，黑金／猩红／青幽三套主题，经共享黑幕接力进入枢纽，固定端口 5182 |
| `npm run dev:menu` | 枢纽主界面 | 四角命令盘（府邸/出征/仓库/商店）、破窗立绘与吐槽、档案侧栏、资源与相位顶栏 |
| `npm run dev:loading` | 场景交接实验室 | 骰子六面体黑幕、区域抵达标题、真实资源等待，以及淡入与实体面板落入的切换演示 |
| `npm run dev:mansion` | 洋馆基地 | 剖面图房间交互、相位切换、角色 ADV、修缮与设施收获原型 |
| `npm run dev:novel` | 视觉小说 | 双人/三人/四人剧本切换、两席位立绘轮换、表情延续、逐字对话，以及点击/空格/回车推进 |
| `npm run dev:rp` | 跑团演出 | NVL 消息流与 ADV 对话框两种版式、幕解锁与历史回看、LOG、AUTO、SKIP、REPLAY、判定条和逐字演出 |
| `npm run dev:shop` | 商店界面 | 购买、出售、鉴定、砍价、分类、分页、库存、里拉/远古晶石双货币和店主反馈 |
| `npm run dev:studio` | 立绘工作台 | 调整逐角色画布、舞台站位、表情、漫符和动作；自动保存到本地并导出 TS、CSS、漫符参数或 JSON 快照，固定端口 5176 |
| `npm run dev:logo-studio` | Logo 工作台 | 逐部件调整位置、缩放、旋转与透明度；自动保存并导入／导出 JSON 或 TypeScript 布局参数，固定端口 5181 |
| `npm run dev:character-status` | 角色状态页 | 角色与服装切换、档案标签、属性/特性/记录展示，以及随阵营变化的界面主题 |
| `npm run dev:mansion-editor` | 洋馆热区标注器 | 在固定原图坐标系中标注矩形与多边形房间，并导出正式页面使用的参数 |

场景应用分别提供 `build:<name>` 与 `preview:<name>`，产物落在 `<name>-dist/`。组件库使用 `npm run build`，静态组件目录使用 `npm run build:preview` / `npm run preview:components`，命名与场景应用略有不同。

### 骰局 Runtime

骰局的牌型、下注、锁骰、重掷和结算都能在浏览器本地运行。外部 LLM Runtime 是可选增强，用于实时对手决策和局后战报润色；服务不可用时界面显示 `LOCAL FALLBACK`，核心骰局仍可游玩。

开发服务器会把 `dev:dice` 的 `/api` 代理到 `127.0.0.1:8787`。需要启用 Runtime 时，先启动仓库外的服务，再运行：

```bash
npm run setup:dice-runtime
npm run dev:dice
```

可通过 `VITE_DICE_RUNTIME_ENABLED=false` 明确关闭 Runtime，或用 `VITE_DICE_RUNTIME_API_BASE_URL`、`VITE_DICE_RUNTIME_APPLICATION_SLUG` 覆盖默认连接参数。

### 共享固定画布

固定舞台型应用通过 `src/shared/stage/` 共享 1600 × 900 外画布、视口安全区和等比缩放逻辑。应用内部按设计尺寸布局，外层根据设备尺寸统一缩放，避免边框、内容和点击区域分别漂移。文档流型的组件目录与立绘工作台不使用这套适配。

共享画框令牌定义了内容可用区、木质压条、黄铜层与描边几何。修改固定舞台应用时，应同时检查桌面、平板和手机横屏，不要在画布内部使用视口单位进行二次缩放。完整约束见 `src/shared/stage/README.md`。

### 跨场景交接

`src/shared/transition/` 负责独立 HTML App 之间的闭幕与接力：旧场景先闭合黑幕，再执行同源导航；目标页等待字体、图片与可选业务 `ready()` 后，先显示区域抵达标题，再以 `fade` 或 `panel-drop` 揭示内容。它只共享呈现协议，不持有具体路由、存档或全局游戏状态。`menu` 是当前发起方，`mansion` 使用全屏淡入，`battle` 与 `shop` 使用实体面板落入；`loading` 是该流程的独立视觉实验页。完整契约见 `src/shared/transition/README.md`。

### 外部资源

- 构建出的 `@abyssa/ui` 组件包不主动请求远程字体、图片或业务接口。
- 地图 Demo 的地面与三个地点图目前从 `files.catbox.moe` 加载。
- 骰局 Demo 的缇比立绘目前从 `files.catbox.moe` 加载；LLM Runtime 默认连接本机 8787 端口。
- 商店 Demo 通过 Google Fonts 加载 Cinzel 与 Noto Serif SC。

需要完全离线部署这些 Demo 时，应先把上述图片和字体转为本地资产，并关闭或替换骰局 Runtime。

### 素材管线

```bash
npm run icons:sync      # 同步 game-icons 图标；--check 版本检测漂移
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

`npm run build` **只构建组件库**。产物位于 `dist/`，包含 ESM、类型声明和独立样式文件；`npm run build-storybook` 的产物位于 `storybook-static/`。

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
npm run build:shop
npm run build:studio
npm run build:character-status
```

仓库目前没有聚合的 `build:all`。每个场景产物位于对应的 `<name>-dist/`；组件目录的无 Vite 依赖静态版本通过 `npm run build:preview` 生成到 `static-preview/`。

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
  apps/           catalog + 11 个相互独立的场景／实验入口
    battle/       裂隙远征规则、表现层与四套 UI 皮肤
    loading/      场景交接视觉实验页
    menu/         守望者之崖枢纽主界面
    title/        标题画面：字标徽记 + 档案层命令 + 双侧 CG 轮播 + 三套主题
    mansion/      洋馆房间、角色 ADV、修缮与设施收益
  tools/          mansion-editor + studio 两个内容制作工具
  content/        角色资料、洋馆默认区域等项目实例数据
  shared/         domain / lib / presentation / stage / transition / ui
  assets/         svg / png / emote / 场景背景素材
  index.ts        @abyssa/ui 唯一公共导出入口
scripts/          素材管线与构建工具(.mjs)
references/
  html/           英文命名的视觉原型 HTML
  images/         英文命名的视觉参考图片
st/setting/       世界观与角色设定文本
*-dist/           各场景的 Vite 构建产物
dist/             @abyssa/ui 组件库构建产物
storybook-static/ Storybook 静态构建产物
static-preview/   无构建工具依赖的组件目录预览
```

视觉原型统一归档在 `references/`，不参与组件库生产构建。根目录的 `index.html`、`battle.html`、`dice.html` 等文件是各应用的 Vite HTML 入口，对应构建设置位于 `vite.*.config.ts`。

## 素材说明

`references/images/` 中的图片带有示例水印，只作为视觉方向参考，不会被打进组件包。正式项目应使用原创 SVG/CSS 或已获得授权的素材。
