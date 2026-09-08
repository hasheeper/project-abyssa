# 游戏启动与资源准备

流程：**单入口 index.html → 现有六面骰加载黑幕 → 全局资源与字体准备 → 懒加载当前页面 → 揭幕**。同一文档只执行一次 `prepareGame`。之后切换路由只导入目标模块、卸载旧页、等待新页数据与当前图片；不重复全量准备。首次加载和切页都渲染同一个 `SceneTransition`，不再保留另一套启动壳。

## 所有权

- `config/vite/game-startup.mjs`：构建结束后依据真实输出生成 `game-assets.json` 和 `game-cache.js`。清单包含页面、所有代码块、CSS、运行图片、差分／漫符、字体与 JSON；源图、编辑器和 source map 不进入清单。字体许可证随产物提供。
- `startup.ts`：全局资源与本地字体解析的一次性 Promise；失败可重试。`src/game-shell` 持有路由与一层加载黑幕；每页的 `route.tsx` 默认导出组件，可另导出首屏 `prepare()`。模块可缓存，组件和 WebGL 不跨路由保活。
- `resources.ts`／`cache-worker.js`：六路并发下载，SHA-256 验证内容，按内容存储，同资源共享进行中的请求。失败保留已有资源；重新进入先核对缓存，版本变更只请求缺少的内容。缓存限定当前部署目录与清单文件，不接管存档/API。
- `images.ts`：AVG、标题轮播、CG与场景交接共用的图片解码服务；规范化 URL、共享 Promise、失败可重试。最多48个缓存项、约3200万像素（RGBA约128MB），标题11张CG在Logo开始前准备完；序幕仍保留当前／下一张的工作集。

## 网络与内存是两层

启动准备全部文件字节，避免剧情触发后才开始下载。无需将全部120MB发行物展开成像素、挂载隐藏场景或创建额外WebGL上下文。当前／后续画面在现有转场前预解码；活跃组件继续拥有并释放自己的GPU资源。离页时卸载组件并释放其 WebGL、RAF、监听器及存档读写会话。页面 CSS 在构建与开发中自动加零权重路由条件，离页规则不再生效；共享组件样式继续共享。

## 静态部署

1. `npm run build:game`，将 **整个** `dist/game` 放到同一 HTTPS 目录（本机 localhost 也支持 Service Worker）。可部署在 `/abyssa/` 等子目录，全部启动与缓存路径由当前文档目录解析。路由采用 `#/map?save=…&epoch=…`，无需服务器 rewrite，子目录刷新与浏览器前进后退均可用。生成的旧 `map.html` 等小型跳转页只兼容已有书签。
2. `game-assets.json`、`game-cache.js`、HTML须允许更新检查；建议 `Cache-Control: no-cache`。带内容哈希的 `assets/*` 可用长期immutable缓存。当前资源缓存自身也校验文件内容，无法通过校验的200错误页面不会被当成加载成功。
3. 必须保留生成的清单与Worker；更新采用整包原子发布，避免新旧文件混用。首页HTML在线优先，断网时使用已完成准备的缓存；前一版的哈希资源为仍打开的旧页面保留。
4. 浏览器禁止Service Worker／持久缓存时，回退到同样有进度与失败阻断的HTTP预读。此模式的跨文档与离线缓存能力由宿主浏览器决定；不声称拥有持久离线保障。
5. 开发模式读取生产导入与运行素材目录生成清单，使用HTTP缓存，不注册Worker缓存开发脚本，避免HMR后看到旧代码。新增动态素材应加入资源profile或可识别的静态import/glob。

Cinzel与Noto Serif SC沿用原字体，103个官方WOFF2子集全部本地化。旧骰局的失效图床立绘改接现有商店缇比立绘；不改变其布局。

## 验证

- `src/shared/loading/*.test.ts`：并发去重、读完响应体才就绪、下载上限、失败重试、缓存跨页面/版本复用、HTML错误响应、根目录离线导航、图片缓存预算、单次启动与失败重试。
- `src/game-shell/GameShell.test.tsx`：数据等待、单层黑幕、离页清理、存档重定向、模块失败重试与快速返回竞态；`tests/build/route-styles.test.mjs` 验证页面样式隔离。
- `tests/build/startup.test.mjs`：清单覆盖CG glob／差分／字体与内容版本；`check:output`核对产物及清单哈希。
- 实际静态服务器以 `/abyssa/` 运行，浏览器验证启动到标题、字体完整与图片就绪；暖启动不再向服务器请求图像、字体或游戏脚本。
