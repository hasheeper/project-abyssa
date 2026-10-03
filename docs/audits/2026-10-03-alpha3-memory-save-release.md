# v0.1.0-alpha.3 记忆页与手动存档发布审查

2026-10-03（Asia/Shanghai）从 `main` 的源码提交 `775653eee0fab8deca6dadeec0335a09fad71280` 在独立干净工作树构建并发布。附注标签 `v0.1.0-alpha.3` 绑定版本、构建时间和完整产物摘要；源码与标签已推送 GitHub。

## 范围

记忆页调整正文布局、上下留白、操作按钮与装饰线的位置，并简化阅读标记。SAVE／LOAD 改为每页两排四列、四页共 32 槽；旧 30 槽目录保留绑定并补足两个空位。正式 AIRP 开放手动快照复制，默认选择可写槽位，保留来源证据、冻结原稿、已读游标及待结算状态，支持重复保存后读取续玩；当前旅程仍受覆盖保护，存读档不自动重发模型调用。

本次不更改游戏协议或 Catalog 编号，不修改玩家现有连接配置。工作区另有未提交的图鉴调整，未纳入本次发布，也未丢弃。

## 构建与检查

- 固定工具链：Node 22.23.2、npm 10.9.8、Wrangler 4.140.0。
- 记忆页、手动存档、槽位事务、动效及版本展示共 14 个测试文件、74 项通过；Pages 与版本构建合同另有 15 项通过。
- 四层类型检查、模块边界、动效令牌同步及 `git diff --check` 通过。
- `prepare:pages`、`check:pages -- --release`、`check:output -- game` 和 `check:pages:publish` 通过；本机真实 CSP 浏览器检查通过新档、旧书签、模型设置、版本显示与复制，外部请求、模型请求、页面异常和 CSP 违规均为 0。
- 发布包为 `dist/game`，1043 文件、168.03 MiB，最大文件 7.81 MiB；已知本机私密标记扫描命中 0。完整包保存在 `dist/releases/v0.1.0-alpha.3/game`。
- 构建时间为 `2026-10-03T14:37:55.901Z`；清单 SHA-256 为 `c97278fe35d984d126097464479914a81d748eb9587bb8a0670f811dc8eec5e6`。

## 线上结果

Cloudflare Pages 既有项目 `abyssa-airp-alpha` 的 production 部署 ID 为 `ac9c2c45-99cb-4c6d-8224-0299e7f0525a`，branch 为 `main`、Source 为 `775653e`；独立地址为 <https://ac9c2c45.abyssa-airp-alpha.pages.dev/>。上传 43 个新静态文件，复用 999 个，并单独上传 `_headers`。

正式域名 <https://abyssa-airp-alpha.pages.dev/> 和独立地址均核对到 `0.1.0-alpha.3` 与完整源码修订号。各核对首页、`release.json`、地图资源清单、游戏 CSS 及主脚本 5 个文件，其 SHA-256 与本机产物一致；CSP 与 nosniff 生效，两个私有路径均为真正 404。Pages 将 `index.html` 以 308 规范化到 `/`，首页摘要在规范地址核对。发布信息已登记到 `docs/deployment/game-releases.json`。

本轮未运行全量回归、真实模型生成、完整玩家流程或缓存更新与回退演练。此前已发现的旧内容版本断言未作无关修正。旧版本、独立部署地址及已发布标签均保留。
