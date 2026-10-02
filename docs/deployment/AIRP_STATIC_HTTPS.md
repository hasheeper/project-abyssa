# AIRP：Cloudflare Pages 静态发布

当前发布阶段：**Alpha**。正式试玩站为[abyssa-airp-alpha.pages.dev](https://abyssa-airp-alpha.pages.dev/)，源码仓库为[hasheeper/project-abyssa](https://github.com/hasheeper/project-abyssa)。ABOUT 标识 `ABYSSA · ALPHA`。10-03 在现有 Pages 项目发布首个编号版本 **v0.1.0-alpha.1**。

更新：2026-10-03。当前运行源码 `5eb82446e4f1f442acdc43a3cb2036a90854bbb2` 和附注标签 `v0.1.0-alpha.1` 已推送 GitHub main；从独立、干净的发布工作树使用 Node 22.23.2／npm 10.9.8 重建，来源、产物、隐私及 `check:pages:publish` 门禁均通过。仅上传 `dist/game`，Wrangler 4.140.0 确认 production 部署成功，source 为 `5eb8244`。后续登记和文档提交仅记录发布结果，不改变已发布源码身份。

本轮同时收口版本管理、地图委托书与木框／纸面素材、霞鹜文楷 GB 屏幕版本地字体，以及模型 ID 的查询、搜索、选择和手填。标题版本信息移到右下角，移除旧副标题；旧 inline-config 开发服务缺少注入时只在开发态读取统一候选编号，不伪造提交或构建时间。140 项本轮前端／模型接口定向测试、137 项 Node 构建测试、4 项地图行囊／减弱动效浏览器检查通过；167 个线上变化／入口文件摘要与完整包一致，3 个私有／缺失路径真正 404，响应头生效。独立部署地址验证正常新档、地图文书字体、版本复制和模拟模型列表选择，真实模型 POST／外部网络请求／页面异常／CSP 违规均为 0。全量基线存在旧战斗断言、超时及冷刷新动效采样失败，没有宣称全量回归或完整玩家验收通过，详见[本轮发布审查](../audits/2026-10-03-alpha-numbered-release.md)。完整包为 `dist/releases/v0.1.0-alpha.1/game`，证据为 `dist/reports/release-2026-10-03/`。

10-02 的补发修正主观察区的未收录问号：字号由 80px 增至 160px，脱离线稿外扩裁切层，以轮盘中心独立定位并补偿字体视觉重心。原观察草图与扩散／旋转／聚焦动效保留。面板与动效 10 项回归、前端类型检查通过；正式域名 41 个变化／入口文件字节一致，3 个私有／缺失路径返回 404，CSP 与 nosniff 生效。独立部署地址通过正常 UI 创建自由行动新档、打开正式图鉴，确认问号大小与位置，控制台错误为 0。本机包与证据为 `dist/releases/codex-5f93902/game` 和 `dist/reports/codex-question-fix-2026-10-02/`。干净副本的通用凭据门禁通过，另以本机配置扫描完整产物与两份改动源码，已知私密标记命中为 0。

10-02 上线正式图鉴：AI 观察线稿、同页目录与资料、轮盘扩散／旋转／聚焦动效，以及未遇见 → 已遇见 → 已击败的存档收录。首次遇见开放基础观察，首次击败补全已配置资料；重复遭遇不重播更新，撤销唯一击败可回退。跳过教程与菜单回想不伪造解锁，各存档独立。规则、素材来源和接线维护见[图鉴方案](../design/CODEX_PANEL_UI.md)。

10-01 的 `7fcfce1` 补齐洋馆房间「概况／运作／工程」抽屉，以及仓库、日志和整备的统一面板、分区、图标、数量控制与底部操作栏；设施操作仍接正式应用命令，教程未结束时不提前显示 AIRP 今日安排。详见[洋馆 UI 发布审查](../audits/2026-10-01-mansion-ui-pages-release.md)。

10-01 前一次 `d393ac5` 修复结算模态层重叠、读完仍锁页、取消后保底冲突与连接设置输入，详见[结算恢复审查](../audits/2026-10-01-airp-settlement-recovery.md)。本次同包保留这些修复，结算与记忆浏览器回归共 3 项通过。

10-01 的 `c61132c` 发布上线记忆手记、事件／幕／切片结构、分幕回想、商店参与者头像，以及正常开局／跳过教程后的统一正式 AIRP。正式六人包含艾比希斯和玛丽埃塔；已有场景和未完成请求保留原输入。该次审查见[记忆流程发布审查](../audits/2026-10-01-airp-memory-release.md)。

| 发布证据 | 当前结果 |
| --- | --- |
| Pages 项目／分支 | `abyssa-airp-alpha`／`main`，Direct Upload |
| 游戏版本／标签 | `0.1.0-alpha.1`／`v0.1.0-alpha.1` |
| 构建时间（UTC） | `2026-10-02T17:05:01.796Z`，北京时间 10-03 |
| Production 部署 ID | `83b8a751-ae61-4ae8-82bf-43a0de3cace0` |
| 当前部署地址 | [83b8a751.abyssa-airp-alpha.pages.dev](https://83b8a751.abyssa-airp-alpha.pages.dev/) |
| 发布目录 | `dist/game`，1018 文件／166.71 MiB，最大 7.81 MiB |
| 上传结果 | 1017 静态文件（154 个新上传、863 个复用）＋由 Pages 解析的 `_headers` |
| 清单 SHA-256 | `746fdc83e77590c5b16aabc6dc09bdc797742e0807c88c9c681d64c106933bf1` |
| 编号登记 | `docs/deployment/game-releases.json`，源码／时间／摘要与附注标签一致 |

上一版 production 保留为回退候选：`3d61c3b4-33ae-48d1-bf28-5e09bc0a27d4`，源码 `5f9390283d2ddb9f4bdaf610ef3ffbe739575c15`，部署地址 [3d61c3b4.abyssa-airp-alpha.pages.dev](https://3d61c3b4.abyssa-airp-alpha.pages.dev/)，清单 SHA-256 为 `cc750720b9d355df4bc10bccddea119318eef26c04bf066dea19bc395c20d1a3`。历史包没有发行编号，不补造版本号。

10-02 图鉴首版 production 同样保留：`f74d1d3c-f3e3-42a5-a01b-ab4bf43cff4c`，源码 `3bffd28988b5df6b98599e248ba54273b51c79cd`，部署地址 [f74d1d3c.abyssa-airp-alpha.pages.dev](https://f74d1d3c.abyssa-airp-alpha.pages.dev/)，清单 SHA-256 为 `8bb3c359cdfec052fc30558e254e6d9826182d38a58a93495eef21660273ebc3`。

10-02 图鉴首版 `3bffd28` 的线上 HTTP 核对：正式域名 89 个变化／入口文件的字节摘要与发布包一致；CSP 与 nosniff 响应头生效，3 个私有／缺失路径返回 404。在独立部署地址通过正常 UI 创建自由行动新档，核对正式图鉴入口、13 项全锁、返回主菜单与重新进入，控制台错误为 0；没有操作正式域名的玩家存档或配置模型。干净发布副本的图鉴／Menu 40 项回归、应用与前端类型检查、模块边界、动效令牌及发布门禁均通过；接线阶段的应用战斗／事务回归另有 12 项通过。该结果不等于完整远端 CI、全流程战斗或回退演练通过。

图鉴首版源码和完整发布包均扫描已知本地 Key／端点标记，命中为 0；只上传运行产物。首版完整包与证据保留在本机 `dist/releases/codex-3bffd28/game` 和 `dist/reports/codex-release-2026-10-02/`。首次 Git 大包上传遇到连接重置，改用 HTTP/1.1 重试后成功；没有强制推送或改写历史。

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

## 游戏版本管理（首次编号已发布）

本轮已接入发行配置、构建来源快照、客户端／公开元数据／报告一致性检查、标题／Menu／About 展示、复制和浏览器诊断导出身份，以及编号／标签／产物绑定和发布后登记工具。首个编号 `0.1.0-alpha.1` 已按冻结源码 `5eb8244` 创建附注标签、推送、上传并登记真实 production 部署；工作树构建仍明确标为开发版。历史部署继续以原提交和部署 ID 标识，不补造发行号。自动更新提示、多标签缓存切换及回退演练未实施／验收。

### 当前编号的实际用途

| 编号 | 当前来源／用途 |
| --- | --- |
| 游戏发行号 | `config/game-release.json` 是唯一手填位置，阶段由后缀推导；标题、Menu 和 About 显示编译进当前客户端的身份 |
| `@abyssa/ui` 的 `0.1.0` | package.json 中的组件库版本，不能直接当游戏版本 |
| Git revision／dirty／文件 SHA-256 | 构建前后来源核对、报告与发布门禁；提交和构建时间可在 About 查看／复制 |
| Pages deployment ID | Cloudflare 上传后分配，`record:pages` 登记到 `game-releases.json`，与 Git 提交不同 |
| game-assets.version | 整份运行资源清单的 SHA-256，用于缓存握手；不是可读发行号 |
| 协议／规则4、内容28、Catalog摘要 | 正常新档的读取与执行身份；旧档按原登记包恢复，调试新档使用内容27 |
| r8、各导出DTO的 version | 提示词基线或数据格式版本，各自维护合同 |

附注标签 `v0.1.0-alpha.1` 已创建并推送，绑定冻结源码、构建时间和完整产物摘要。CI 与普通 `--release` 检查来源、工具链及元数据；真正上传前另运行 `check:pages:publish`。本轮最终 137 项 Node 构建测试、140 项前端／模型接口定向测试及 4 项地图浏览器检查通过；正式包的隐私、来源与工具链门禁、真实 CSP 本机预检和线上身份／文件核对通过。证据保存在 `dist/reports/release-2026-10-03/`，历史失败与验收边界见本轮审查；不代表完整远端 CI、全量回归或更新回退演练通过。仍待完成的范围为：

- 后续发布递增编号，继续核对源码／附注标签／完整产物与实际 production 回执。Git推送与Pages上传仍是两个动作。
- 正式 HTTPS 的界面身份与公开元数据已核对；真实调用日志及诊断导出的完整玩家路径仍需验收。历史调用未记录客户端版本时保留未知，不能用 `exportedBy` 冒充调用当时的版本。
- worker 安装后立即 skipWaiting／clients.claim。虽有内容哈希校验和旧哈希资源保留，旧页面与固定URL素材的逐客户端版本绑定仍需验证；多标签更新、离线及回退尚未做完整发布演练。不能把现有单元测试通过扩大为这些场景已通过。

### 发行编号规则

首个已发布编号为 `0.1.0-alpha.1`，UI显示 `v0.1.0-alpha.1`；开发态或未提交构建另显示“开发版”。这是新的发行编号起点，不给历史构建补造编号，也不由内容28或组件库0.1.0推导。

- 同一测试目标下，每次对外发布递增阶段序号：`0.1.0-alpha.1` → `0.1.0-alpha.2`，修复同样产生新编号。
- 进入下一项完整功能目标时递增次版本，如 `0.2.0-alpha.1`；进入Beta时使用对应目标的 `beta.1`。
- 对外正式发布使用 `1.0.0`。稳定版本按修复／功能／重大升级递增 patch／minor／major；发行号本身不判断存档兼容性。
- Git附注标签使用完整UI编号，如 `v0.1.0-alpha.1`，指向构建源码提交。标签消息是含 `version`、`manifestSha256`、`builtAt` 的 JSON，由准备报告取值，绑定包括 Pages 控制文件的最终包；轻量标签、错误源码、错误产物或已占用编号均不能通过上传前检查。已发布标签不得移动；同包重传使用原完整包，回退恢复原身份。
- 构建另带自动生成的 Git短提交；完整SHA和产物摘要用于精确追溯。开发、未提交或来源未知的构建明确标为开发版，不能通过正式发布门禁。

### 单一来源与显示位置

独立的 `config/game-release.json` 是游戏发行号唯一手填位置，接受正式版或 `alpha.N`／`beta.N`，阶段从后缀推导。构建开始时读取配置与 Git 来源，用 tracked diff 和非忽略 untracked 文件字节形成来源指纹，结束时复核；即使前后均为 dirty，文件变化也会拒绝生成构建报告。同一份元数据注入客户端、公开 `release.json` 和本机构建报告。公开字段仅为 `version`、`stage`、`revision`、`builtAt`、`development`，不含本机路径、端点、Key 或部署凭据。产物摘要在外部报告中计算，避免自引用。

`release.json` 属于完整产物快照与 Pages 隐私扫描，但不进入 `game-assets.json` 的哈希缓存清单；未来更新检测不能把它作为当前客户端身份。普通构建使用真实构建时间，需要复现同包时可用 `SOURCE_DATE_EPOCH` 固定该时间；重新构建不默认等于原包重传，已编号产物仍须通过标签摘要检查。

上传完成后，`record:pages` 读取独立部署地址的公开身份，核对本地包并保存完整产物到 `dist/releases/v<版本>/game`，再登记到 `docs/deployment/game-releases.json`。登记不上传、不提交、不创建标签；独立地址身份通过也不证明 Cloudflare 环境为 production、完整文件字节一致或玩家验收通过，仍需核对 Wrangler 回执及在线检查。

客户端显示编译进当前代码的发行身份。远端元数据只用于发现可用更新，不能覆盖当前已加载版本的显示。旧的 inline-config 开发服务没有重启时可能尚未注入元数据；仅在开发态用同一发行配置提供候选编号，提交和构建时间仍保留未知，并明确标为开发版。生产环境缺少注入时不得用此后备伪造发行身份。

- 标题页：底部右下角轻量显示本机存档和游戏版本，提示信息仍在中间，不再显示旧的“裂隙远征”副标题。
- Menu首页：底部边缘显示同一短版本，不占主内容栏；打开设置可查看详情。
- 设置About：游戏版本为主信息，提交和构建时间为次信息，提供“复制版本信息”；当前存档的协议／内容身份放在展开详情中，仅在确有存档上下文时显示。
- 浏览器调用日志、阶段核对、脱敏诊断与存档诊断导出：在客户端导出边界添加 `exportedBy`，含当前客户端身份；不改写应用层原记录或可恢复存档包。历史调用当时的客户端版本未记录时保留未知，不能用导出版本冒充历史版本。存档导入兼容继续由现有协议／Catalog／摘要校验决定。

### 实施顺序与验收

1. **版本来源和构建合同。** 接入配置、构建注入、开发标记及公开元数据；补充构建前后Git核对，扩展发布文件白名单及快照检查。正式包的UI身份、release.json和构建报告必须一致。
2. **设置、界面与问题反馈。** 接入标题／Menu／About共用版本展示及复制操作，更新过时说明；诊断日志携带导出客户端身份。验证正常设置、菜单内嵌设置、独立调试入口及无存档状态。
3. **发布登记与更新验证。** 发布检查编号格式、标签指向、既有编号占用及产物对应关系，发布后登记部署ID并核对线上身份。稳定域名可检查可用更新；固定部署链接继续标识原发布。更新提示由用户在安全状态下确认刷新，并核对未保存设置、未读正文和正在生成的请求。验证多标签、固定路径素材、断网、离线重开及旧版回退；必要时修正缓存切换策略。

本轮覆盖第1～2步，以及第3步的发布身份校验、真实登记和线上身份／文件验收，首个编号已正式发布。自动更新提示、完整玩家路径及缓存切换／回退演练仍单独验收。全程保留游戏发行、源码构建、部署、存档和资源缓存各自的身份，不通过改发行号迁移存档或重跑已冻结任务。

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
- 上述来源门禁还检查构建所用的 Node／npm 与 `.nvmrc`／`packageManager` 一致。CI 的来源门禁不要求每次 push 都创建发行标签；真正上传前必须再运行 `npm run check:pages:publish`，检查附注标签及发行登记中的编号占用。这条命令只检查，不会上传。
- `check:pages:browser`以本机临时HTTP服务应用真实CSP，检查首页、旧HTML书签、当前正常起点创建、模型设置和刷新；不导入真实配置或调用API。它不是Cloudflare模拟器，不证明公网HTTPS、Pages清理URL、缓存更新或API CORS通过。
- 检查报告是本机`dist/reports/airp-p3/pages-release.local.json`，不放进发布目录，也不随站点上传。记录`published: false`和未完成项，不能把预检通过当作发布完成。

本机已有`config/airp-test.local.json`时，用其中Key及端点的原值／序列化值／URL编码值扫描**全部文件字节**，不输出这些值。没有该文件时，报告会标记没有执行已知私密值扫描，不能声称实际Key已核验。白名单拒绝配置、私有报告、源码地图、归档压缩包、隐藏文件、符号链接、`functions`和`_worker.js`。

发布脚本现包含独立于本地配置的通用凭据形态扫描，`release:check:game`会先重新构建并执行Pages准备与复查；CI也在构建后执行同一准备与复查。本地配置缺失时仍会标记没有进行已知Key比对，通用扫描不能覆盖任意自定义格式。单独运行`build:game`只是构建，不能据此宣称隐私门禁通过；CI不需要上传开发者真实配置。

## 发布行为

本次使用固定 Wrangler 4.140.0，浏览器 OAuth 授权后把凭据保存在系统钥匙串；未把 Token 写进仓库或 AIRP 配置。账号权限限于用户／账号读取与 Pages 写入。静态客户端会向访问者提供完整设定、角色卡、预设与美术；`noindex`不限制访问。

首次创建时，Wrangler 在代理环境会把新 Pages 项目转交给 Workers 流程。该尝试未成功部署；核对 CLI 实现后，使用创建命令的 `--force` 退出自动转交，成功新建真正的 Pages 项目。此处 `--force` 仅作用于首次创建路径，不覆盖已有项目；后续发布不需要它。

后续更新步骤：

1. 审阅并冻结源码与 `config/game-release.json` 中的编号，从干净提交执行 `npm run prepare:pages`、`npm run check:pages -- --release` 和 `npm run check:output -- game`，保留清单摘要。为该源码提交创建／推送不可移动的附注标签，其 JSON 消息从 `dist/reports/airp-p3/pages-release.local.json` 取 `gameRelease.version`、`gameRelease.builtAt`、`manifestSha256`；随后运行 `npm run check:pages:publish`。10-03 已按用户明确的提交／推送／更新 Pages 授权完成首次编号发布。
2. 核查项目根没有 `functions`、产物没有 `_worker.js`；不创建 Workers 后端、不启用分析脚本、不改域名 DNS。
3. 用 Node 22.23.2 和 Wrangler 4.140.0 上传，显式指定已有项目及 production branch：

   ```sh
   wrangler pages deploy dist/game --project-name abyssa-airp-alpha --branch main
   ```

   Wrangler 从干净工作树读取当前提交。09-29 发布显式附上 `--commit-hash c7735a949f26fd640928fe87328ca2b82974ecf8`；后续应使用各自冻结的源码提交，不得照抄旧值。
4. 只上传 `dist/game` 内容，核对返回的 production 部署 ID 与 source revision，再执行 `npm run record:pages -- --deployment-id <完整ID> --deployment-url <独立部署HTTPS地址>`。工具核对公开身份、保留完整包并更新编号登记；登记后的文档变动不属于已发布源码提交。另核对稳定域名、响应头与在线文件摘要。不得上传整个工作区、整个 `dist`、`dist/reports`，也不上传源码地图。

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

当前成功的production部署与上一版候选ID、清单摘要见顶部台账。仍需受控的更新与回退演练：验证旧标签页、新标签页、清单／worker／固定URL资源及存档，不重复生成已付费对白，不清空站点数据。本次成功上传和新浏览器检查不代表回退演练完成。

## 官方依据

- [Direct Upload与两种上传限制](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Pages Free计划限制](https://developers.cloudflare.com/pages/platform/limits/)
- [路由、404、缓存与默认响应头](https://developers.cloudflare.com/pages/configuration/serving-pages/)
- [自定义响应头](https://developers.cloudflare.com/pages/configuration/headers/)
- [Production回退](https://developers.cloudflare.com/pages/configuration/rollbacks/)

## 待完成的远端验收

- 从当前正常起点完整试玩，覆盖教程完成／跳过、商店例外、委托实物、三种终局、刷新继续和记忆回想。
- 在正式HTTPS Origin验证真实模型POST与错误恢复，保留调用日志；所测端点OPTIONS通过不能替代模型调用或其他服务商的跨域测试。
- 受控更新／回退检查旧标签页、新标签页、worker、清单与固定URL资源，确认原存档和已付费正文保持。
- 实测目标网络访问体验和内容质量；本地构建、线上HTTP核对与完整玩家验收分别记录。

09-23第三阶段施工计划已归档，未完成范围集中于本节；优先级见[当前状态](../DESIGN_DECISIONS_AND_CURRENT_STATUS.md)。
