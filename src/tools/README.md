# Tools 边界

`src/tools` 存放内容生产、标注与参数校准工具，不属于玩家运行时。

- tool 可以消费 `shared`、`content` 与 `assets`；
- tool 不得成为 app 所需契约或默认内容的所有者；
- app 不得依赖 tool，tool 也不得直接引用 app；
- 可复用契约进入 `shared/domain`，项目实例数据进入 `content`。

当前包含洋馆热区标注器、通用视觉工作台以及地图队伍立绘参数工作台。

## Party Figure Studio

地图 Q 版队伍立绘的独立校准入口：

- HTML 入口：`party-figure-studio.html`
- 应用入口：`src/tools/party-figure-studio/main.tsx`
- 开发：`npm run dev:party-figure-studio`
- 构建：`npm run build:party-figure-studio`
- 预览：先构建，再运行 `npm run preview:party-figure-studio`
- 默认开发地址：`http://127.0.0.1:5187/party-figure-studio.html`
- 构建目录：`party-figure-studio-dist`

工作台提供：

- 十人素材名册，以及单图和五人叠排两种预览；
- `880 × 350` 五人预览复刻地图 team 展开态的紧凑槽位几何、24px 名条与 8px 间距，图片占剩余 art 高度的 100%；
- 深色、羊皮纸、网格背景与脚底基线辅助线；
- 以脚底中心为原点实时调整 `scale`、百分数 `x / y` 与非破坏性 `flipX`；正 `x` 向右，正 `y` 向上；
- 当前角色 / 全部角色重置、修改状态提示与浏览器本地草稿保存；
- 完整十人 JSON / TypeScript 的粘贴、文件导入、复制和下载导出。

## 数据所有权

`party-figure-studio` 只负责编辑体验，不拥有运行时数据：

- 固定 ID、默认 / 当前校准、取值范围、校验与序列化来自 `src/content/characters/partyFigureCalibration.ts`；
- PNG URL 与中文名 manifest 来自 `src/assets/map/party-figures/catalog.ts`；
- 工具允许按 `tool -> content/assets` 方向消费这两处；`content`、`assets` 与任何 app 都不得反向 import `src/tools/party-figure-studio`；
- 导出的审核结果应回填 content 中的 `partyFigureCalibrations`。不要把 localStorage 当作内容源，也不要在 tool 内复制一份默认表；
- 地图运行时与工作台因此读取同一参数。工具 UI 可以变化，但共享契约与素材目录不能依赖它。
