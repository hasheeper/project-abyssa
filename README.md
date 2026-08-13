# @abyssa/ui

从 Abyssa 静态视觉原型提取的复古 RPG React 组件库。组件使用原生语义元素、TypeScript 类型和命名空间化 CSS 变量，可独立调用，也可组合成角色状态页面。

## 当前组件

- `AbyssaProvider`：主题、强调色与密度容器
- `RpgFrame`：三层边框与角部装饰容器
- `RibbonButton`：深色、亮色、青色燕尾按钮
- `RpgHexButton`：精确复刻 `Retro-RPG-Hex-Button` 的对称六边形主按钮
- `RpgShapeButton`、`RpgCircleButton`：圆形、切角方形、切角横条与胶囊按钮
- `RpgTab`：四套主题、可受控选中、底边开放的内容标签
- `RpgBackButton`：190 × 190 三角返回按钮
- `IconButton`：菱形或圆形图标按钮；标准版 86px，紧凑版 76px
- `RpgRadio`、`RpgCheckbox`：保留参考稿外观的原生表单选择控件
- `RpgNotchButton`、`RpgNotchedPillButton`：内部 V 形翻折的方形与胶囊按钮
- `RpgDiamondNode`、`RpgDiamondNodeTrack`：可独立或数据驱动组合的菱形节点
- `RpgPanel`：六种角色选择面板
- `RpgSquarePanel`：独立的 116 × 116 简约小方块，包含六种配色
- `ArrowButton`：基于 `IconButton` 的方向图标按钮
- `Toggle`、`Progress`：开关和进度条
- `VerticalIndicator`：40 × 170 的纵向装饰指示条
- `RpgStatusNode`：86 × 54 的紧凑状态节点
- `RpgHeader`：精确复刻 `Retro-RPG-Header` 原型的曲线燕尾标题，包含三套主题
- `RpgDialogue`：支持姓名、正文和空壳状态的响应式对话面板
- `Nameplate`：角色姓名牌
- `CharacterSelector`：受控或非受控角色选择器
- `StatusPanel`：数据驱动的身份、属性、特性和记录面板
- `CharacterStatusScreen`：完整角色状态组合页面
- `BattleScreen`：支持回合顺序、四姿态角色图集、目标选择、队伍状态与四向指令的战斗 UI 组合
- `RpgDirectionPad`：四向指令方向盘
- `PaperDoll`：分层立绘，按角色画布校准表拼合表情部件
- `RpScene`：跑团分屏场景，含席位立绘、进退场、说话者气泡与判定条
- `Emote`：头顶漫符气泡，15 个统一规格 APNG，支持逐角色位置微调
- `motions`：立绘动作关键帧生成器（`playMotion` + `nod`/`waver`/`jump`/`shakeLight`/`shakeHeavy`）

## 本地运行

```bash
npm install
npm run dev
```

组件目录默认运行在 `http://127.0.0.1:5173/`。它以实际接入为主：左侧按功能分类，支持名称/能力搜索；每个组件都有独立交互预览、常用属性说明和可复制的最小调用代码。完整角色页只作为最后的组合范例。

```bash
npm run storybook
```

Storybook 默认运行在 `http://127.0.0.1:6006/`。

### 应用预览

组件库之外，仓库还带 9 套独立的 Vite 应用，各自验证一类组合场景。它们只负责 UI 状态与回调，不含规则引擎：

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 组件目录（默认，5173） |
| `npm run dev:battle` | 战斗界面，四人队与混沌领域素材 |
| `npm run dev:dice` | 骰局。依赖外部 LLM 服务，见下 |
| `npm run dev:map` | three.js + GSAP 副本地图 |
| `npm run dev:novel` | 视觉小说 |
| `npm run dev:rp` | 跑团分屏场景 |
| `npm run dev:shop` | 商店界面 |
| `npm run dev:studio` | 立绘参数工作台（5176），调校准与站位并导出参数表 |
| `npm run dev:character-status` | 角色状态页 |

每个应用都有对应的 `build:*` 与 `preview:*`，产物落在 `<app>-dist/`。

`dev:dice` 的 `/api` 会代理到 `127.0.0.1:8787`，那是一个不在本仓库内的 LLM 服务；先跑 `npm run setup:dice-runtime` 配置管线。

### 素材管线

```bash
npm run icons:sync      # 同步 game-icons 图标；--check 版本检测漂移
npm run emotes:build    # 把混合来源的 GIF/APNG 收敛成 30 帧 / 67ms / 192px
npm run emotes:check
npm run pack:setting    # 打包 st/setting/ 世界观设定
```

`emotes:build` 需要 `ffmpeg`，源目录默认 `~/Downloads/emo`，可用 `--source=` 覆盖。

## 构建与验证

```bash
npm run typecheck
npm test
npm run build
npm run build-storybook
```

生产产物位于 `dist/`，包含 ESM、类型声明和独立样式文件。

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
  components/     组件、Storybook 用例与交互测试
  hooks/          受控/非受控状态工具
  utils/          类名拼接等小工具
  styles/         设计令牌和组件样式
  assets/         svg / png / emote 素材
  index.ts        公共导出入口
  demo/           可搜索、可预览、可复制调用的组件目录
  battle/ dice/ map/ novel/ rp/ shop/ studio/ character-status/
                  各应用入口与专属数据,共用上面的组件库
scripts/          素材管线与构建工具(.mjs)
references/
  html/           英文命名的视觉原型 HTML
  images/         英文命名的视觉参考图片
st/setting/       世界观与角色设定文本
```

视觉原型统一归档在 `references/`，不参与组件库生产构建。根目录只保留各应用的 Vite HTML 入口（`index.html` 及 `battle.html`、`dice.html` 等）与对应的 `vite.*.config.ts`。

## 素材说明

`references/images/` 中的图片带有示例水印，只作为视觉方向参考，不会被打进组件包。正式项目应使用原创 SVG/CSS 或已获得授权的素材。
