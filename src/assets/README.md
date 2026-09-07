# 素材目录

素材按用途归类，不再按 PNG、SVG 等文件格式分目录。

- `characters/`：角色头像、整身立绘与纸娃娃分层
- `backgrounds/`：通用场景与战斗背景
- `battle/`：战斗角色和敌人素材
- `map/`：地图专用立绘与副本背景
- `ui/`：界面边框、装饰与品牌图形
- `icons/`：技能、操作和物品图标；大量物品图标统一放在 `icons/items/`
- `emote/`：漫符动画
- `cg/`：剧情 CG

地图角色立绘的原图映射和处理说明见 [`map/party-figures/README.md`](map/party-figures/README.md)。

角色页背景直接复用主菜单的 [`backgrounds/manor-night-gallery.jpg`](backgrounds/manor-night-gallery.jpg)（月下长廊）及其明暗处理。使用场景原图，不包含菜单截图、菜单 DOM 或运行时模糊。

克雷格旧庄园的 7 张敌人／Boss、3 张场景和 1 张地图地标，统一索引见[庄园素材清单](battle/old-manor/README.md)。图片分别归入 `battle/old-manor/`、`backgrounds/old-manor/` 和 `map/landmarks/`；迎客门厅已用于战斗主题配色预览，其余仍待接入。[设计稿](../../docs/design/OLD_MANOR_DESIGN.md)记录身份、机制状态与缺项，主题专用的红线 SVG 装饰见 [`ui/old-manor`](ui/old-manor/README.md)。

项目字标 SVG 位于 [`ui/abyssa-wordmark.svg`](ui/abyssa-wordmark.svg)。它只是完整徽记中的西文字标部件；标题、问号、印章、分隔线和装饰由 [`AbyssaLogo.tsx`](../shared/ui/branding/AbyssaLogo.tsx) 组合绘制，因此仓库里没有另一张“完整 Logo”独立 SVG。

物品图标的来源、作者与许可证见 [`icons/items/ATTRIBUTION.md`](icons/items/ATTRIBUTION.md)，新增或替换此目录中的图标时必须同步维护归属信息。


### 缇比商店立绘

`characters/portraits/tibby-shop.png`由仓库内缇比纸娃娃的`base`、`eyes_1`、`mouth_1`按原画布叠合，704×1472。供原商店肖像框裁切展示，替代原外部图床URL；没有引入新的生成美术。
