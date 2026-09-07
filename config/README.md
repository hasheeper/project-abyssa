# 工程基线

环境固定为 Node 22.23.2、npm 10.9.8。先使用 `.nvmrc` 指定的 Node，再执行 `npm ci`。本目录只管理入口、构建与检查，不持有游戏规则或存档，也不导入相邻 rp-style-lab 仓库。

## 启动与产物

| 命令 | 页面／用途 | 输出 |
| --- | --- | --- |
| `npm run dev` | 组件目录，5173 | — |
| `npm run dev:game` | 九个游戏页面，5190，标题首页 | `npm run build:game` → `dist/game` |
| `npm run dev:lab` | catalog／loading／novel／rp，5191 | `npm run build:lab` → `dist/lab` |
| `npm run dev:tools` | 五个制作工具，5192 | `npm run build:tools` → `dist/tools` |
| `npm run build` | UI 包及类型声明 | `dist/ui` |
| 旧 `dev:<name>`／`build:<name>`／`preview:<name>` | 对应独立页面，保留已登记端口 | `dist/entries/<name>` |

`build:all` 构建 ui、game、lab、tools。目标只能清空自己的目录，UI 包 `files` 只包含 `dist/ui`；包导出键保持不变，旧 `dist/index.js` 物理路径已迁移。

所有目标默认关闭远程骰局接口。`--ai` 仅显式开启仍待迁移的旧实验适配器，不是当前 rp-style-lab 的正式接入方案。启动与构建不会自动执行 setup 或创建外部应用。

## 新增与修改入口

1. 在 `entries.mjs` 登记 ID、HTML、用途、开发端口、下游页面和动态资源需求。
2. 页面源码继续位于 `src/apps/<id>` 或 `src/tools/<id>`；根 HTML 的 module script 指向相应 `main.tsx`。
3. 只有新增一种实际构建策略时才修改 `targets.mjs`／Vite 工厂，不复制整份配置。普通入口可通过运行器直接访问，无需增加配置文件。
4. 执行 `npm run check:entries`、对应目标构建与 `check:output`，补充有必要的浏览器操作检查。

```bash
node scripts/run-target.mjs dev entry:battle --port 5200 --no-open
node scripts/run-target.mjs build entry:title
node scripts/check-build-output.mjs entry:title
```

入口的导航闭包自动纳入独立构建；往返链接合法，未知页面失败。group 归属表示发行用途，不意味着页面已经拥有完整玩法。Battle 纯规则已在 S1 迁出，统一存档与场景结算继续按 S2/S3 推进。

## 输出与资源

`paths.mjs` 限制清理范围，运行器不依赖当前 shell 工作目录。`--outDir` 允许目标自己的目录或显式外部临时目录；不允许覆盖其他目标、仓库根或源码。资源插件读取最终 outDir，骰局首页不会覆盖 game 标题首页。

洋馆动态层图片、十名角色纸娃娃和 studio 漫符参与完整性检查。`paper-dolls`／`emotes` 资源策略按入口复制素材；应用构建向共享组件注入相对素材根路径，组件 props 与 UI 包原有默认值保持兼容。novel／rp 背景通过静态 import 打包；Storybook 也提供相同的素材目录。Vite manifest 用于核对 chunk、CSS 与导入资产。现有外链地图、立绘和 Google Fonts 仍按 README 说明加载；S0 不包含完整离线素材迁移。

每次目标构建生成 `dist/reports/<target>.json`，包含排序后的文件、字节数、SHA-256、Node、包管理器和 Git 来源。源码压缩包缺少 Git 时来源标为 null，仍允许构建。

## 验证

```bash
npm run check:baseline
npm run build:all
node scripts/check-package-release.mjs
npm run check:output -- game
npm run check:output -- lab
npm run check:output -- tools
npx playwright install --only-shell chromium
npm run test:smoke
npm run build:entries
npm run check:auxiliary
npm run build-storybook
```

测试位于 `src`：`config/vitest/core.config.ts` 运行无 DOM 的 Node 内核项目，`app.config.ts` 运行 jsdom 应用项目，根配置统一发现并限制并发。`npm test` 运行两者；`npm run test:core` 仅运行内核。构建/边界测试位于 `tests/build`，浏览器检查位于 `tests/smoke`。浏览器服务器没有源码兜底或 SPA fallback，缺失页面／脚本返回 404；端口默认 5199，可用 `ABYSSA_SMOKE_PORT` 调整。已有浏览器二进制可通过 `ABYSSA_BROWSER_EXECUTABLE` 显式指定；CI 默认使用 Playwright 安装的版本。

`npm run check:core` 覆盖无 DOM 类型、AST 依赖边界、Node 测试和独立 ESM 导入；这些检查同时纳入 `check:baseline`。S1 报告写入 `dist/reports/s1`，不会进入 UI 包。使用两种测试环境不代表存在两份规则实现。

`check:auxiliary` 只在临时目录验证静态预览，并核对原分享文件未被改写。主动执行 `build:preview` 仍会更新 `static-preview`。CI 与本地命令相同，不自动部署或发布。

TypeScript 7 不再提供旧的 JavaScript compiler API，静态导航检查使用独立 Babel parser 解析 TS／TSX；Babel 仅属于构建工具依赖，不进入游戏运行包。
