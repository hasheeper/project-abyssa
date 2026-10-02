# 图鉴：设计参考与生图来源

## 当前方案

以[观察图与资料页方案](../CODEX_PANEL_UI.md)为实施依据。14 项 AI 线稿美术预览与正式收录查询均已接入；新档正式目录为 13 项，按未遇见／已遇见／已击败开放资料，随当前存档恢复。`#/menu?codex-preview=slime` 为全量美术预览；`backend-empty`、`backend-seen`、`backend` 为隔离存档的真实玩法状态预览。

接线后的页面截图：[未收录](ui-backend-unknown.png)、[已遇见](ui-backend-seen.png)、[已击败](ui-backend-defeated.png)。

用户生成的两张参考原件保存在本目录：[第一张：轮廓处理](reference-01-contour.png)、[第二张：整体布局](reference-02-layout.png)。采用第二张的组织关系，将第一张右下轮廓画的语言发展为主图的观察草图。图中文字和示例掉落不作为正式游戏内容。

参考来源与原件校验记录见[来源](sources.json)，模型未经改写的意见见[Opus 原答](opus-design.md)。

## 此前生图参考包

本次只使用浊泥史莱姆一个对象。以整体美观、视觉平衡和清楚的层次为主；素材大小、位置、图文占比与布局都可自由调整。草图提供灵感，不作为尺寸或排版规范。

## 上传顺序

1. [真实史莱姆构图](real-assets/layout-slime.png)：索引、插图和记录的关系。
2. [当前 Menu 主页](menu-reference.png)：共同外壳与质感依据。
3. [史莱姆原始透明 PNG](../../../src/assets/battle/tide-reef/enemy.slime.mire.png)：主体形态、墨线、原色与细节量依据。

复制 [提示词](image-prompt.txt)。参考图的文字和短线为概念占位，主体来自实际原画。

## 来源

真实素材取自正式文件 `src/assets/battle/tide-reef/enemy.slime.mire.png`，原文件与交付 PNG 字节一致。构图预览只裁去透明边距、等比排布；记录见 [来源清单](real-assets/sources.json)。当前 Menu 的截图来源及 Opus 框架记录见 [原稿](opus-design.md)和 [来源](sources.json)。

当前提示词为 Opus 5.5 精修 v3 原答，按用户要求收简、只使用一个素材，允许自由调整大小与布局，以整体美观为主。咨询：`c-ecacd4f7-eff2-4963-8e69-460295f8d1f0`；Turn：`t-35c09d2a-07e2-4eb4-9e7e-584de7a2270c`；Parent：`t-9143ca8d-b363-4c68-873c-255a7d47e462`。

重新渲染：`node docs/design/codex-concept-2026-10-02/real-assets/render.mjs`。仅生成生图参考。
