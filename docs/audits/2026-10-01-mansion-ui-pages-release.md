# 洋馆 UI 更新发布

日期：2026-10-01（Asia/Shanghai）。运行源码：`7fcfce150244887ba9b274f126c7bc7f364ee609`。

## 范围

上一轮 `d393ac5` 仅发布结算恢复，原工作区的洋馆 UI 未纳入。本次补齐该批改动：

- 房间抽屉统一为概况／运作／工程三页，设施生产、领取与工程仍调用正式应用命令；抽屉覆盖右侧工具栏时隐藏工具栏并处理焦点。
- 仓库、日志与整备使用共用面板、分区、图标、数量控制与底部操作栏；日志按当前／归档／尚未开放组织，重开保留所选条目。
- 整备的装入与移出仍是会话偏好，实际出征确认才扣库存。
- 回归发现教程未结束时日志会提前出现「今日安排」，补上教程进度判断，使正式 AIRP 入口与开局流程一致。

本次提交包含 49 个 Git 变更条目（更名前后共 50 个路径）。本地记忆设计稿及参考图未纳入发布。

## 验证

| 检查 | 结果 |
| --- | --- |
| 设施、洋馆、库存、日志、整备与归来账单定向测试 | 8 文件／54 个唯一测试通过；教程日志失败修复后，该文件 2 项复跑通过 |
| 类型、模块边界、动效令牌、差异检查 | 通过；新增 smoke 后 app／tooling 类型复查通过 |
| 本地洋馆浏览器 | 房间三页签、仓库键盘选择、日志分组与重开、整备、两种视口通过；存档内容不变，模型 POST／页面异常为 0 |
| 结算与记忆回归 | 跨页停止／保底、刷新中断恢复、记忆原文与分幕回想共 3 项通过；使用合成档案与拦截假请求 |
| 干净提交重建与发布门禁 | `prepare:pages`、`check:pages -- --release`、`check:output -- game` 通过 |
| 私密值扫描与 CSP 预检 | 已知 Key／端点命中为 0；外部请求、模型请求、页面异常与 CSP 违规为 0 |
| 正式域名 HTTP | 54 个变化／根目录文件字节与发布包一致；CSP、nosniff 生效，3 个私有／缺失路径返回 404 |
| 正式域名洋馆浏览器 | 同一套 UI 流程通过；存档不变、模型 POST／页面异常为 0 |

验证使用独立浏览器上下文，未操作玩家真实存档、未调用真实模型。该结果覆盖本批 UI 及相邻恢复流程，不代表旧版全量 smoke、完整模型生成或更新回退演练通过。

## 发布

- GitHub main 已推送运行源码 `7fcfce1`，后续文档提交仅记录结果。
- Pages 项目：`abyssa-airp-alpha`，Production／main／Direct Upload。
- 部署：`adaef2b6-48ff-4c23-88da-451a4c87c95e`，source `7fcfce1`。
- 正式站：[abyssa-airp-alpha.pages.dev](https://abyssa-airp-alpha.pages.dev/)。部署：[adaef2b6.abyssa-airp-alpha.pages.dev](https://adaef2b6.abyssa-airp-alpha.pages.dev/)。
- Node `22.23.2`、npm `10.9.8`、Wrangler `4.140.0`。
- 886 文件／160.80 MiB，最大 7.81 MiB；885 静态文件中 43 个新上传、842 个复用，另由 Pages 解析 `_headers`。
- 清单 SHA-256：`94b9c7aebc63d8998c1c60fc4d09fa8f6e9272d8ed53f8d5c35e670201710afa`。
- 上一 production 保留为回退候选：`fb89e017-8800-4167-a508-c6dc750a501c`，source `d393ac5`。

完整包位于本机 `dist/releases/mansion-ui-7fcfce1/game`，日志、截图、清单与线上核对位于 `dist/reports/mansion-ui-release-2026-10-01/`，均不随 Git 或 Pages 上传。只上传 `dist/game`。
