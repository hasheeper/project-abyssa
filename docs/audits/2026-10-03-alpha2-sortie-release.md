# v0.1.0-alpha.2 出征地图发布审查

2026-10-03（Asia/Shanghai）从 `main` 的干净源码提交 `c1fa3c93d83269e6a22b4e592878144f85cc4b8b` 构建并发布。附注标签 `v0.1.0-alpha.2` 绑定版本、构建时间和完整产物摘要，源码提交和标签已推送 GitHub。

## 范围

出征地图的编队牌、人物立牌、委托书和资料页改为统一纸木文书语汇；调整内部滚动、骰面与按钮、队伍过渡、黑幕和双语标题。背景改用独立整备室墙面，补钥匙与地图筒的局部质感、地图龛接缝，以及深色羊皮纸天幕。无庄园数据时不再显示“裂隙远征”作为地图目标名。

## 构建与检查

- 固定工具链：Node 22.23.2、npm 10.9.8、Wrangler 4.140.0。
- 地图相关 7 个测试文件共 70 项通过；应用类型检查通过。纸张素材重建检查通过。
- `prepare:pages`、`check:pages -- --release`、`check:output -- game`、`check:pages:publish` 均通过；本机 Pages 浏览器检查通过新档、模型设置、版本显示与复制，模型请求、外部请求、页面异常和 CSP 违规均为 0。
- 包为 `dist/game`，1043 文件、168.02 MiB；已知本机私密标记扫描命中 0。完整包保存在 `dist/releases/v0.1.0-alpha.2/game`。
- 构建时间 `2026-10-03T10:12:49.488Z`；清单 SHA-256 为 `c9fcffe05901c1fbf796a7339abf01763274f6e84a68c11be51e670fef7ef8ab`。

## 线上结果

Cloudflare Pages 项目 `abyssa-airp-alpha` 的 production 部署 ID 为 `c10d4bf7-794b-4728-a037-e82219723407`，Source 为 `c1fa3c9`，独立地址为 <https://c10d4bf7.abyssa-airp-alpha.pages.dev/>。上传 68 个新静态文件，复用 974 个。正式域名 <https://abyssa-airp-alpha.pages.dev/> 和独立地址均返回 `0.1.0-alpha.2` 与完整源码修订号；各核对首页、`release.json`、资源清单、整备室背景及羊皮纸天幕 5 个文件，其 SHA-256 与本机产物一致。两个私有路径均为真正 404；CSP 与 nosniff 响应头生效。发布信息已登记到 `docs/deployment/game-releases.json`。

本轮未运行全量回归、真实模型生成、完整玩家流程或缓存更新与回退演练。旧版本及独立部署地址仍保留，未移动已发布标签。
