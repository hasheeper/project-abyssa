# 主菜单图标

## 命令盘

供 `src/apps/menu/MenuCommandDial.tsx` 使用。下表标注 Game-icons.net 的素材适用 [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/)；[许可全文](../items/LICENSE-CC-BY-3.0.txt)。用户提供的 ROSTER 剪影单独记录来源，不归入此许可。

| 入口 | 使用文件 | 原作与作者 | 修改 |
| --- | --- | --- | --- |
| 府邸 | [medieval-village-01.svg](medieval-village-01.svg) | [Medieval village 01](https://game-icons.net/1x1/caro-asercion/medieval-village-01.html) — Caro Asercion | 保留高低屋顶、烟囱与原图形，仅移除下载背景并补齐无障碍属性。 |
| 角色 ROSTER | [roster-scylla.svg](roster-scylla.svg) | 用户提供的 `Scylla-1-v3.jpeg`（2026-09-19）；原作者和许可尚未提供 | 自动描摹为纯色矢量路径，白色改透明；收紧方形画布并留出边距。按用户要求将发丝镂空边界外扩约 3 个源图像素、衣领及肩部边界内收约 4 像素，增加小尺寸下的间隙；保留侧脸与外侧发型，不重绘造型。 |
| 商店 | [../items/two-coins.svg](../items/two-coins.svg) | [Two coins](https://game-icons.net/1x1/delapouite/two-coins.html) — Delapouite | 直接复用游戏原有双硬币，不修改形状，不使用钱袋或自绘货币符号。 |
| 出征 | [map-sword.svg](map-sword.svg) | [Treasure map](https://game-icons.net/1x1/lorc/treasure-map.html) + [Broadsword](https://game-icons.net/1x1/lorc/broadsword.html) — Lorc | 地图保留原轮廓与山峰、去除小虚线路径与寻宝标记，以仿射变换呈现低平透视；原版阔剑旋转为剑尖朝下，地图前缘遮住末端，形成插入关系。无新增手绘路径。 |

府邸保留原图形；地图及剑的未修改源图保留在相邻的 [items](../items/ATTRIBUTION.md) 图库中。ROSTER 经用户确认用于本机界面试用；公开分发前需确认原图使用授权，不因转成 SVG 而获得新许可。旧仓库 [open-chest.svg](open-chest.svg)（[Open chest](https://game-icons.net/1x1/skoll/open-chest.html)，Skoll，CC BY 3.0）保留为历史候选，已不用于四键。本目录独立于原始图库的 317 项自动同步清单，避免派生素材被同步脚本覆盖。

图标通过现有 CSS mask 着色，视觉缩放在 `menu-dial.css` 中按入口单独设置，不改变文字或点击区域。地图配剑属于组合改编；发布时须保留上述署名、来源、许可和改动说明，不表示原作者认可本项目。

## 侧栏设置

`src/apps/menu/MenuSidebar.tsx` 的设置入口使用 [gear-fill.svg](gear-fill.svg)，来自 [Bootstrap Icons 的 Gear fill](https://icons.getbootstrap.com/icons/gear-fill/)，版本 1.13.1，作者 The Bootstrap Authors，采用 [MIT 许可](LICENSE-bootstrap-icons.txt)。[原始 SVG](https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/icons/gear-fill.svg)。

保留原版齿轮路径，仅去掉固定尺寸与样式类、将填充设为白色供 CSS mask 着色，并添加标题与无障碍属性。发布时须保留 MIT 版权与许可声明。

## 侧栏存读档

Menu 槽位的文件操作使用 Bootstrap Icons 原版 [Box arrow in down](https://icons.getbootstrap.com/icons/box-arrow-in-down/)（导入，[box-arrow-in-down.svg](box-arrow-in-down.svg)）和 [Box arrow up](https://icons.getbootstrap.com/icons/box-arrow-up/)（导出，[box-arrow-up.svg](box-arrow-up.svg)）。原始 SVG 来自 [twbs/icons](https://github.com/twbs/icons/tree/main/icons)，2026-09-19 获取；保留原始路径、不自绘。作者 The Bootstrap Authors，采用上文的 [MIT 许可](LICENSE-bootstrap-icons.txt)，通过 CSS mask 着色。

主菜单与共用游戏侧栏的存档、读档统一使用 Delapouite 的成对图标，适用 CC BY 3.0（完整许可见上方链接）。2026-09-21 从下列原作页面下载白色透明底 SVG：

| 入口 | 文件 | 原作 |
| --- | --- | --- |
| 存档 | [save.svg](save.svg) | [Save](https://game-icons.net/1x1/delapouite/save.html) — Delapouite；箭头向上写入软盘 |
| 读档 | [load.svg](load.svg) | [Load](https://game-icons.net/1x1/delapouite/load.html) — Delapouite；箭头向下读取软盘 |

保留两者原始路径和画布，只补齐无障碍属性，以相同尺寸和 CSS mask 着色；同一软盘轮廓通过箭头方向区分存读。主菜单侧栏保留原六行尺寸，现为图鉴／成就／记忆／存档／读档／设置；角色移至四键、回顾不展示。成就仅占位，复用 [Trophy cup](https://game-icons.net/1x1/delapouite/trophy-cup.html)（Delapouite，CC BY 3.0）的 [原图](../items/trophy-cup.svg)。
