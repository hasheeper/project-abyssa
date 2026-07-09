# @abyssa/ui

从 Abyssa 静态视觉原型提取的复古 RPG React 组件库。组件使用原生语义元素、TypeScript 类型和命名空间化 CSS 变量，可独立调用，也可组合成角色状态页面。

## 当前组件

- `AbyssaProvider`：主题、强调色与密度容器
- `RpgFrame`：三层边框与角部装饰容器
- `RibbonButton`：深色、亮色、青色燕尾按钮
- `RpgPanel`：六种角色选择面板
- `IconButton`、`ArrowButton`：圆形、方形、胶囊形图标按钮
- `Toggle`、`Progress`：开关和进度条
- `SectionHeader`、`Nameplate`：标题横幅和角色姓名牌
- `CharacterSelector`：受控或非受控角色选择器
- `StatusPanel`：数据驱动的身份、属性、特性和记录面板
- `CharacterStatusScreen`：完整角色状态组合页面

## 本地运行

```bash
npm install
npm run dev
```

组件实验室默认运行在 `http://127.0.0.1:5173/`。

```bash
npm run storybook
```

Storybook 默认运行在 `http://127.0.0.1:6006/`。

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
  RibbonButton,
  RpgPanel
} from "@abyssa/ui";
import "@abyssa/ui/styles.css";

export function Menu() {
  return (
    <AbyssaProvider>
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

所有交互组件都基于原生 `button`，可以直接使用 `onClick`、`disabled`、`aria-*`、`className` 和 `style`。

## 角色页面

```tsx
import { CharacterStatusScreen } from "@abyssa/ui";
import type { CharacterProfile } from "@abyssa/ui";

const characters: CharacterProfile[] = [
  {
    id: "abyssa",
    number: "06",
    name: "艾比希斯",
    secondaryName: "ABYSSA · BEELZERAN",
    status: {
      title: "艾比希斯",
      state: "稳定性 83%",
      fields: [
        { label: "种族", value: "根源存在" },
        { label: "职能", value: "混沌容器" }
      ],
      stats: [
        { label: "力量", value: "EX", accent: true },
        { label: "幸运", value: "D" }
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
  demo/           可运行的组件组合实验室
  hooks/          受控/非受控状态工具
  styles/         设计令牌和组件样式
  index.ts        公共导出入口
```

仓库根目录原有的三个 HTML 文件继续作为视觉原型保留，不参与组件库生产构建。

## 素材说明

`参考图/` 中的图片带有示例水印，只作为视觉方向参考，不会被打进组件包。正式项目应使用原创 SVG/CSS 或已获得授权的素材。
