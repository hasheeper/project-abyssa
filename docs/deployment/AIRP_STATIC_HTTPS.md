# AIRP：Cloudflare Pages 静态发布

当前发布阶段：**Alpha**。正式试玩站为[abyssa-airp-alpha.pages.dev](https://abyssa-airp-alpha.pages.dev/)，源码仓库为[hasheeper/project-abyssa](https://github.com/hasheeper/project-abyssa)。ABOUT 标识 `ABYSSA · ALPHA`。10-01 在现有 Pages 项目更新 production 部署。

更新：2026-10-01。当前运行源码 `d393ac53f0f48934e21d7992284321d92a0a9b0c` 已推送 GitHub main；从独立、干净的发布工作树使用 Node 22.23.2／npm 10.9.8 重建，严格 `check:pages -- --release` 与 `check:output -- game` 均通过。仅上传 `dist/game`，Cloudflare 确认 production 部署成功，source 为 `d393ac5`。后续文档提交仅记录发布结果。

本次修复洋馆经历结算的模态输入层重叠、完成阅读后仍锁页、取消后保底结算输入冲突，以及连接设置继承禁用鼠标的状态。已完成的正文释放交谈锁，结算期间仍禁止未结算出征。收起不写暂停事实；同一个后台请求可以跨页查看，刷新后明确标记中断再手动处理。详见[结算恢复审查](../audits/2026-10-01-airp-settlement-recovery.md)。

10-01 前一次 `c61132c` 发布上线记忆手记、事件／幕／切片结构、分幕回想、商店参与者头像，以及正常开局／跳过教程后的统一正式 AIRP。正式六人包含艾比希斯和玛丽埃塔；已有场景和未完成请求保留原输入。该次审查见[记忆流程发布审查](../audits/2026-10-01-airp-memory-release.md)。

| 发布证据 | 当前结果 |
| --- | --- |
| Pages 项目／分支 | `abyssa-airp-alpha`／`main`，Direct Upload |
| Production 部署 ID | `fb89e017-8800-4167-a508-c6dc750a501c` |
| 当前部署地址 | [fb89e017.abyssa-airp-alpha.pages.dev](https://fb89e017.abyssa-airp-alpha.pages.dev/) |
| 发布目录 | `dist/game`，883 文件／160.72 MiB，最大 7.81 MiB |
| 上传结果 | 882 静态文件（40 个新上传、842 个复用）＋由 Pages 解析的 `_headers` |
| 清单 SHA-256 | `f4d31b2c3d1baa1a581facbf3dae885b948571ee35ac551763501b7fcab4f156` |

上一版 production 保留为回退候选：`88578ce7-26c1-4967-8460-033715b0d1d9`，源码 `c61132ce93def5661d84a0c6989ad07976a070a4`，部署地址 [88578ce7.abyssa-airp-alpha.pages.dev](https://88578ce7.abyssa-airp-alpha.pages.dev/)，清单 SHA-256 为 `9b58c06a6f5e9f35f8e5632d91d41e1244fc0021801ccdef0148b3c3acba6ae0`。

本次线上 HTTP 核对：51 个变化文件和根目录运行文件的字节摘要与发布包一致；CSP 与 nosniff 响应头生效，3 个私有／缺失路径返回 404。正式域名的两条恢复流程也通过：独立上下文导入合成行动档，跨页收起、停止和保底结算仅发出一次被拦截的假请求；刷新后中断恢复不发出模型请求，页面异常为 0。本地 CSP 预检与记忆浏览器回归通过。未操作玩家真实存档或调用真实模型；只上传运行产物，已知本地 Key／端点标记命中为 0。

最新[发布与密钥审计](../audits/2026-09-25-release-security.md)记录源码／产物扫描与初轮 Git 历史证据，受检范围内没有发现已知 Key 外泄；重连误填、开发服务私档、CI 报告上传和发布门禁已修复。上传范围不含配置、源码地图、私人报告、实验页或工具页。部署成功与完整玩家流程、模型生成、更新回退验收分别记录。

## 09-29 战斗结算发布检查

2026-09-29（Asia/Shanghai）发布后完成 HTTP 核对：稳定域名已返回新首页；全部变化文件及根目录运行文件共 42 个 GET 内容 SHA-256 与本地产物一致。响应头与 `_headers` 一致，7 个私有／缺失路径均为真正 404，SHOP／洋馆旧书签规范化和跳转通过。

线上 Chromium 使用四组隔离上下文导入内容27真实规则检查点，通关、撤离、团灭、教程领取全部通过：普通终局由实际最后一击／撤离命令触发，演出模式正确；恢复和刷新不播放开盒，存档进度保持；终局刷新直接显示账页，确认后返回洋馆。四组均无页面异常，并保存结算截图。测试未调用模型，未操作用户浏览器档案；完整玩家路径、AIRP 实际生成、旧标签页缓存更新和回退演练仍未验收。

本次本机证据位于 `dist/reports/pages-2026-09-29/`：`deployments.local.json` 记录 production 源码与部署 ID，`online-http.local.json` 记录字节／响应检查，`online-browser.local.json` 与 `online-*.png` 记录四组线上流程。打包门禁报告仍位于 `dist/reports/airp-p3/pages-release.local.json`。这些报告均不随站点或 Git 上传；本地门禁报告的 `published: false` 不表示实际部署失败。

### 09-25 首次发布检查（历史）

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

09-29 更新发布测试入口：浏览器与 Node 检查夹具统一按 Vite 的 `?raw` 语义读取作者资料；CSP 预检改用当前「AIRP 游玩」、GM／正文／辅助模型字段和未保存配置刷新清除规则。扩展旧版 smoke 的首次运行仍暴露旧数据库版本、旧界面与旧动画预期，未将该运行计为完整通过；本次战斗结算发布另用内容27真实检查点，在正式产物上核验通关／撤离／团灭／教程领取、刷新与确认返回。全量旧回归仍需独立迁移。

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

   Wrangler 从干净工作树读取当前提交。09-29 发布显式附上 `--commit-hash c7735a949f26fd640928fe87328ca2b82974ecf8`；后续应使用各自冻结的源码提交，不得照抄旧值。
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

09-29 更新后已有两份成功的 production 部署，上一版 ID 与清单摘要见上表。P3-F 仍需受控的更新与回退演练：验证旧标签页、新标签页、清单／worker／固定URL资源及存档，不重复生成已付费对白，不清空站点数据。本次成功上传和新浏览器检查不代表回退演练完成。

## 官方依据

- [Direct Upload与两种上传限制](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Pages Free计划限制](https://developers.cloudflare.com/pages/platform/limits/)
- [路由、404、缓存与默认响应头](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [自定义响应头](https://developers.cloudflare.com/pages/configuration/headers/)
- [Production回退](https://developers.cloudflare.com/pages/configuration/rollbacks/)

完整验收范围见[P3规划](../plans/2026-09-23-airp-static-phase-three.md)，项目发布状态见[当前状态](../DESIGN_DECISIONS_AND_CURRENT_STATUS.md)。
