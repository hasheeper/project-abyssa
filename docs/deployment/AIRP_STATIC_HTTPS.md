# AIRP：Cloudflare Pages 静态发布

当前发布阶段：**Alpha**。用户已确认新建 `abyssa-airp-alpha`，源码仓库为[hasheeper/project-abyssa](https://github.com/hasheeper/project-abyssa)。ABOUT 已增加同一仓库链接，并标识 `ABYSSA · ALPHA`。这次授权包含源码基线推送与新站部署；不再以旧建议名 `abyssa-airp-demo` 创建项目。

更新：2026-09-25。两人调度、公款和实例奇物对齐后，使用Node 22.23.2／npm 10.9.8重新构建并准备了881文件、159.71 MiB的本地候选包；普通`check:pages`已通过。严格发布检查要求干净的Git来源，当前工作树尚未冻结，会被按预期拒绝。已有历史CSP浏览器预检，本轮未做浏览器／视觉验收，**没有创建Pages项目或上传文件**。用户已选择新建Pages，不修改已有站点；项目名和作者资料公开范围仍需上传前确认。

最新[发布与密钥审计](../audits/2026-09-25-release-security.md)记录本轮源码／产物扫描与初轮Git历史证据，均未发现已知Key进入相应受检范围；重连误填、开发服务私档、CI报告上传及发布门禁已本地修复并验证。game运行文件879个，增加404与响应头后为881个，最大文件7.81 MiB；这些统计与本地检查不代表公网发布通过。

当前候选目录为`dist/game`；清单SHA-256为`d00dfdb1e8fd8c7cd2414d571a9a6e4ab24b06993cfd141cf6a2dedbd939587f`。摘要只对应这次本地准备，重建后以重新生成的报告为准，不能跳过严格来源检查。

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

选择Direct Upload后，同一Pages项目不能直接改成Git integration，需要另建项目；但该项目可以在网页拖拽与Wrangler上传之间切换。此Demo先不连Git，不上传整个工作区。

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

1. 本次已确认新项目名`abyssa-airp-alpha`；登录后核对目标账号与项目名可用性。静态客户端会向访问者提供完整设定、角色卡、预设与美术；`noindex`不限制访问。
2. 在[Cloudflare Workers & Pages控制台](https://dash.cloudflare.com/?to=/:account/workers-and-pages)登录。账号密码／Token不用发在聊天中，不写进AIRP模型配置。
3. 选择创建Pages应用的**Direct Upload／拖拽文件**流程，不创建Workers后端、不选服务器渲染、不启用分析脚本。不购买套餐、不改已有域名DNS。
4. 审阅并冻结源码后重新构建，在上传前运行`npm run check:pages -- --release`并保存产物摘要。**只拖入`dist/game`目录内容**，确保`index.html`位于站点根；不是项目根、整个`dist`、`dist/reports`或父目录套一层`game`。
5. 核对平台接受的文件和错误，再发布。得到稳定`<项目名>.pages.dev`后，记录项目／部署ID与产物清单，使用最终地址继续P3-C～F验收。

网页拖拽当前有余量；以后超过1,000文件时改用Wrangler，不删除角色卡或资源凑数。若改用Wrangler，固定版本、显式指定已确认项目和production branch，并核查工作目录无`functions`及产物无`_worker.js`，防止工具自动附带后端。未得到项目确认和登录授权前不运行部署命令。

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
