# AIRP：Cloudflare Pages 静态发布

当前发布阶段：**Alpha**。新站为[abyssa-airp-alpha.pages.dev](https://abyssa-airp-alpha.pages.dev/)，源码仓库为[hasheeper/project-abyssa](https://github.com/hasheeper/project-abyssa)。ABOUT 已增加同一仓库链接，并标识 `ABYSSA · ALPHA`。本次新建 Pages 项目，未修改已有站点。

更新：2026-09-25。源码基线 `14bf2504f18052840971d81f0915958080d8e458` 已推送到 GitHub main；从该干净提交使用 Node 22.23.2／npm 10.9.8 重建，普通与严格 `check:pages -- --release` 均通过。随后仅上传 `dist/game`，Cloudflare 已确认 production 部署成功。文档后续提交用于记录发布结果，线上运行包仍对应此基线。

| 发布证据 | 本次结果 |
| --- | --- |
| Pages 项目／分支 | `abyssa-airp-alpha`／`main`，Direct Upload |
| Production 部署 ID | `9f866128-a59c-4c1f-a844-aecd56df7a63` |
| 本次部署地址 | [9f866128.abyssa-airp-alpha.pages.dev](https://9f866128.abyssa-airp-alpha.pages.dev/) |
| 发布目录 | `dist/game`，881 文件／159.71 MiB，最大 7.81 MiB |
| 上传结果 | 880 静态文件＋由 Pages 解析的 `_headers` |
| 清单 SHA-256 | `ad83a798e571bef394bcc65ee5c0be663cf1d191a94356fbc81ec0a05a66dba1` |

最新[发布与密钥审计](../audits/2026-09-25-release-security.md)记录源码／产物扫描与初轮 Git 历史证据，受检范围内没有发现已知 Key 外泄；重连误填、开发服务私档、CI 报告上传和发布门禁已修复。上传范围不含配置、源码地图、私人报告、实验页或工具页。部署成功与完整玩家流程、模型生成、更新回退验收分别记录。

## 本次线上检查

2026-09-25 23:47（Asia/Shanghai）完成非视觉 HTTP 检查：

- 稳定域名 HTTPS 首页 200，内容与本地 `index.html` 一致。
- 880 个可请求静态文件全部通过 HEAD 可达性与可用 Content-Length 比对；另对 10 个入口 JS／CSS、资源清单、缓存脚本与 ABOUT 所在 chunk 做 GET 字节比对，全部一致。
- CSP、Cache-Control、nosniff、Referrer-Policy、X-Frame-Options 与 X-Robots-Tag 均与 `_headers` 一致；未注入额外分析脚本。
- `/shop.html` 和 `/mansion.html` 正确规范化为无后缀路径，页面中的跳转仍解析到根 `index.html` 的对应 hash 路由。
- 私有配置、私有报告、`.env`、`.git/config`、源码、缺失资源与缺失页面共 7 个探针均返回真正 404，没有返回应用首页。
- 以最终 Alpha Origin 对本机配置中 planning／writing／updater 共用的端点做无凭据 OPTIONS 预检，允许 POST、Authorization 与 Content-Type。未发送 Key 或模型 POST；此结果不覆盖其他服务商，也不代表生成质量通过。

本机证据保存在 `dist/reports/airp-p3/alpha-online.local.json` 与 `alpha-cors.local.json`，不随站点或 Git 上传。原 `pages-release.local.json` 仍是本地打包门禁报告，其 `published: false` 不作为线上部署状态。

源码基线的 [GitHub Actions](https://github.com/hasheeper/project-abyssa/actions/runs/36155097102) 截至上述时间：`compatibility` 成功，`baseline` 仍运行在 `npm run check:baseline`，尚无最终结论。不能将本地定向回归或已上线写成完整远端 CI 通过；最新结果以该运行页为准。未做录屏、截图或视觉验收，普通／AIRP 完整玩家路径、实际模型生成、缓存更新与回退仍未验收。

## 为什么可以直接用

Cloudflare Pages可以托管本机构建好的静态文件，提供`https://<项目名>.pages.dev`，不要求购买域名或自建服务器。现有AIRP的模型调用仍由玩家浏览器直连自己的API，Pages不承担模型推理，也不替API解决跨域。

以下为2026-09-23核对的官方限制与当日818文件的产物记录，不是当前构建统计。每次发布必须重新运行清单检查：

| 项目 | 官方限制 | 09-23本地发布包 |
| --- | --- | --- |
| 网页拖拽文件数 | 1,000 | 818 |
| Wrangler／Free站点文件数 | 20,000 | 818 |
| 单个文件 | 25 MiB | 最大约7.81 MiB |
| 总产物 | 不能把单文件25 MiB误作整个站点上限 | 约143.77 MiB |

当日包满足这些限制；当前包以新检查报告为准，可采用免费计划的静态托管能力；账号实际状态、服务条款、最终域名可用性和访问质量仍要创建时核对。模型API按玩家的服务商计费，不因Pages免费而免费。中国大陆访问体验须实测，不承诺所有网络畅通。

选择Direct Upload后，同一Pages项目不能直接改成Git integration，需要另建项目；但该项目可以在网页拖拽与Wrangler上传之间切换。本 Alpha 的源码已推送 GitHub，Pages 使用独立的 Direct Upload；Git 推送不会自动发布站点，不上传整个工作区。

## 本地准备与检查

使用仓库`.nvmrc`约定的Node 22.23.2和npm 10.9.8。在项目根执行：

```sh
npm run prepare:pages
npm run check:pages
npm run check:pages:browser
```

- `prepare:pages`重新构建game，仅在`dist/game`添加发布专用`404.html`和`_headers`，保留全部原运行资源；不登录、不上传、不调用模型。
- `check:pages`重新核对原game构建快照、全文件清单、平台限制、发布控制文件和隐私扫描；目录多了文件、缺文件或字节改变均拒绝通过。每次重新`build:game`后须重新prepare。
- 最终打包前运行`npm run check:pages -- --release`。它额外比对构建报告、当前Git HEAD和当前工作树，要求同一个干净提交；工作树未冻结或构建后又改变时直接拒绝。正式游戏检查命令`npm run release:check:game`会串入这一步。
- `check:pages:browser`以本机临时HTTP服务应用真实CSP，检查首页、旧HTML书签、内容18创建、模型设置和刷新；不导入真实配置或调用API。它不是Cloudflare模拟器，不证明公网HTTPS、Pages清理URL、缓存更新或API CORS通过。
- 检查报告是本机`dist/reports/airp-p3/pages-release.local.json`，不放进发布目录，也不随站点上传。记录`published: false`和未完成项，不能把预检通过当作发布完成。

本机已有`config/airp-test.local.json`时，用其中Key及端点的原值／序列化值／URL编码值扫描**全部文件字节**，不输出这些值。没有该文件时，报告会标记没有执行已知私密值扫描，不能声称实际Key已核验。白名单拒绝配置、私有报告、源码地图、归档压缩包、隐藏文件、符号链接、`functions`和`_worker.js`。

发布脚本现包含独立于本地配置的通用凭据形态扫描，`release:check:game`会先重新构建并执行Pages准备与复查；CI也在构建后执行同一准备与复查。本地配置缺失时仍会标记没有进行已知Key比对，通用扫描不能覆盖任意自定义格式。单独运行`build:game`只是构建，不能据此宣称隐私门禁通过；CI不需要上传开发者真实配置。

## 发布行为

本次使用固定 Wrangler 4.140.0，浏览器 OAuth 授权后把凭据保存在系统钥匙串；未把 Token 写进仓库或 AIRP 配置。账号权限限于用户／账号读取与 Pages 写入。静态客户端会向访问者提供完整设定、角色卡、预设与美术；`noindex`不限制访问。

首次创建时，Wrangler 在代理环境会把新 Pages 项目转交给 Workers 流程。该尝试未成功部署；核对 CLI 实现后，使用创建命令的 `--force` 退出自动转交，成功新建真正的 Pages 项目。此处 `--force` 仅作用于首次创建路径，不覆盖已有项目；后续发布不需要它。

后续更新步骤：

1. 审阅并冻结源码，从干净提交执行 `npm run prepare:pages`、`npm run check:pages -- --release` 和 `npm run check:output -- game`，保留清单摘要。
2. 核查项目根没有 `functions`、产物没有 `_worker.js`；不创建 Workers 后端、不启用分析脚本、不改域名 DNS。
3. 用 Node 22.23.2 和 Wrangler 4.140.0 上传，显式指定已有项目及 production branch：

   ```sh
   wrangler pages deploy dist/game --project-name abyssa-airp-alpha --branch main
   ```

   Wrangler 从干净工作树读取当前提交。本次首发还显式附上 `--commit-hash 14bf2504f18052840971d81f0915958080d8e458`；后续不得照抄旧提交值。
4. 只上传 `dist/game` 内容，核对返回的部署 ID 与 source revision；记录新的产物摘要和在线检查。不得上传整个工作区、整个 `dist`、`dist/reports`，也不上传源码地图。

网页拖拽可作备用方式；超过 1,000 文件时继续使用 Wrangler，不删除角色卡或资源凑数。

不要上传`config/airp-test.local.json`、本机档案、测试报告、原项目或用于打包发布目录之外的压缩包。玩家在「设置 → Model」本地导入配置，点击「保存」即可下次自动恢复，无需口令；浏览器管理加密密钥，连接及密钥均不进入发布包。源配置文件仍是明文，见[存储边界](../architecture/AIRP_CONNECTION_SETTINGS.md)。

## 当前响应头与缓存策略

- `404.html`关闭Pages默认的缺失路径→首页SPA fallback。主应用本来就用hash路由，不需要这种兜底。缺失资源和私有配置路径必须真正404。
- `_headers`由Pages解析，不作为普通静态文件提供；远端验收检查**响应头是否生效**，不要求GET `/_headers`能下载。
- 全站采用`public, max-age=0, must-revalidate, no-transform`，先保留重新验证语义，不配置额外“Cache Everything”规则。现有Service Worker仍做内容哈希缓存；本次本机测试不是完整缓存验收。
- CSP只允许同源脚本，旧HTML书签的内联跳转按精确SHA-256授权，不用脚本`unsafe-inline`或`unsafe-eval`。样式因当前组件内联样式允许`unsafe-inline`；图片／字体等仅开放实际需要的同源／data／blob来源。
- `connect-src 'self' https:`允许玩家自选HTTPS API，它不是服务商域名白名单。没有添加任何代理或给API伪造CORS许可；HTTP API在公网HTTPS页下不受支持。
- 防嵌入、`nosniff`、`no-referrer`与`noindex, nofollow`已加入；后者只是搜索引擎提示，不是访问控制。不要注入Cloudflare Web Analytics等额外脚本，新增来源必须单独复核。

Pages会将`.html`地址规范化成无后缀路径；正式站必须额外检查旧书签跳转和相对资源，不能以本机成功代替。域名改变也会改变IndexedDB所属Origin，旧localhost档案需本地导出／导入，不会自动迁移。

## 更新与回退

只上传完整、经过检查的产物。Cloudflare官方回退仅能选择成功的**production部署**，preview不能作为回退目标。发布前保留上一份完整产物和部署ID；在控制台Deployments中选择目标production部署的“Rollback to this deployment”。

首次上线尚无历史production版本，因此P3-F仍需两份受控、存档合同相同的发布演练。验证旧标签页、新标签页、清单／worker／固定URL资源及存档，不重复生成已付费对白，不清空站点数据。回退演练尚未完成。

## 官方依据

- [Direct Upload与两种上传限制](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Pages Free计划限制](https://developers.cloudflare.com/pages/platform/limits/)
- [路由、404、缓存与默认响应头](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [自定义响应头](https://developers.cloudflare.com/pages/configuration/headers/)
- [Production回退](https://developers.cloudflare.com/pages/configuration/rollbacks/)

完整验收范围见[P3规划](../plans/2026-09-23-airp-static-phase-three.md)，项目发布状态见[当前状态](../DESIGN_DECISIONS_AND_CURRENT_STATUS.md)。
