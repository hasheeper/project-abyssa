# 克雷格旧庄园素材清单

归档日期：2026-09-05。设计依据：[美术定调后的庄园设计稿](../../../../docs/design/OLD_MANOR_DESIGN.md)。查看：[本批素材总览](../../../../docs/design/old-manor/asset-overview.jpg)。

本批共 **11 张素材：7 张敌人／Boss、3 张背景、1 张地图图标**，已按用途归入仓库。当前内容3已接入三种杂兵、管家、初战千金、维护／回忆刻仪兽、三张舞台与地图图标；关键救离姿态仍待补。

2026-09-07现行用途：a5刻仪兽用于维护战和回忆战最终Boss，a6千金只在初战。a7保留为本尊美术及旧内容2存档资产，不据此另增本尊篇章。本轮整理仅更新清单，图像与透明通道不变。机制见[三类战斗总览](../../../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md#6-庄园三种战斗与事件)。

## 来源与正式文件

来源目录为用户提供的 `/Users/liuhang/Downloads/`；下表保留原编号用于核对，正式文件采用英文语义名与 kebab-case。原文件保持不变。

| 原文件 | 身份与用途 | 仓库文件 | 尺寸 | 处理 |
| --- | --- | --- | --- | --- |
| `a1.jpg` | 候席客；普通怪 | [waiting-guest.png](waiting-guest.png) | 1376×768 | ToonOut 抠图，保留吊线 |
| `a2.jpg` | 执盘侍者；蓄力普通怪 | [platter-bearer.png](platter-bearer.png) | 1376×768 | ToonOut 抠图，保留吊线 |
| `a3.jpg` | 缝补女佣；支援普通怪 | [mending-maid.png](mending-maid.png) | 1376×768 | ToonOut 抠图，保留细线与缝针 |
| `a4.jpg` | 落幕管家；第 3 层守门人 | [curtain-butler.png](curtain-butler.png) | 1376×768 | ToonOut 抠图，保留吊线与屏风 |
| `a5.jpg` | 刻仪兽；已接维护／回忆最终Boss | [clockwork-beast.png](clockwork-beast.png) | 1408×768 | ToonOut 抠图，保留吊线与钟体 |
| `a6.png` | 末席的提线千金；初战最终Boss | [last-seat-puppet-heiress.png](last-seat-puppet-heiress.png) | 1216×832 | 已有 RGBA，原样复制 |
| `a7.png` | 玛丽埃塔本尊；旧本尊战资产，保留归档 | [marietta-memory-boss.png](marietta-memory-boss.png) | 1856×1280 | 已有 RGBA，原样复制 |
| `b1.jpg` | 迎客门厅；第 1 层 | [welcoming-hall.jpg](../../backgrounds/old-manor/welcoming-hall.jpg) | 1376×768 | 原样复制 |
| `b2.jpg` | 服务走廊；第 2–3 层 | [service-corridor.jpg](../../backgrounds/old-manor/service-corridor.jpg) | 1376×768 | 原样复制 |
| `b3.jpg` | 宴会厅；第 4–5 层 | [banquet-hall.jpg](../../backgrounds/old-manor/banquet-hall.jpg) | 1376×768 | 原样复制 |
| `c1.jpg` | 克雷格旧庄园；地图地标 | [old-manor.png](../../map/landmarks/old-manor.png) | 1408×768 | ToonOut 抠图 |

**a1–a3 是三只普通怪，a4 是守门人，a5 是刻仪兽。** a7不是千金的第二阶段，当前回忆Boss改用a5；沿用规范名称“刻仪兽”和现有英文文件名，不因口述“钟仪兽”复制另一份素材。

## 原始图归档

六张需要去白底的 JPG 已随成品归档，便于复核、重新抠图或后续拆层：

- [候席客源图](sources/waiting-guest.jpg)
- [执盘侍者源图](sources/platter-bearer.jpg)
- [缝补女佣源图](sources/mending-maid.jpg)
- [落幕管家源图](sources/curtain-butler.jpg)
- [刻仪兽源图](sources/clockwork-beast.jpg)
- [地图地标源图](../../map/landmarks/sources/old-manor.jpg)

两张原透明 Boss 图与三张背景直接作为正式文件保存，未重新编码，故不再复制一份相同的 `sources/` 文件。上述五张正式文件与六份源图归档均与下载目录原文件字节一致。

## 透明处理与保留原则

使用本机 [ToonOut](/Users/liuhang/Documents/ToonOut) 的 `run_toonout.py`，模型为 `birefnet_finetuned_toonout.pth`，对 a1–a5、c1 共六张图执行去白底。处理使用本地已有权重，以 `--device auto` 运行；未调用图像生成服务。

ToonOut 原始遮罩对执盘侍者和缝补女佣的部分细红线有遗漏。五张敌人图在模型遮罩基础上，按原图的红色差值恢复红线透明度，并对恢复的半透明红色边缘去除白底污染。恢复仅使用原图像素，不重画线、不改变线的走向。地图地标沿用 ToonOut 输出，不套用红线修复。

- 成品均保持源图画布尺寸；不紧裁、不拉伸、不统一角色身高。
- 保留画面内的头顶吊线、手指辐射线、缝针、餐刀及其他离散细节；不批量删除小连通区域。
- 保留原图已有接地阴影与器物细节；不在归档时决定战斗中的落脚点和显示比例。
- a6、a7 使用原透明通道；未再次抠图或重采样。
- 三张背景保留完整取景；1376×768 接近但不是严格 16:9，后续接入时再验证等比取景。

已对六张抠图做原图、深色底与灰底比对，重点检查白布、黑木轮廓与细红线。素材总览仅用于身份和完整性核对，各格按原画布等比缩放，**不代表敌人在游戏中的相对体型**。

本轮处理日志、模型原始遮罩、抠图前后对照、来源哈希和验收记录位于工作区 `dist/reports/old-manor-art/`，属于可再生成的本地处理产物，不作为正式素材依赖。正式源图、成品、设计稿和总览均已归入仓库目录。

## 后续缺项

| 缺项 | 当前处理 |
| --- | --- |
| 千金的联动与终杀演出 | 当前为整张透明立绘，尚无餐刀逐排碎裂、吊线切断、化灰、脱落与沉睡的独立图层或姿态 |
| 战斗状态图 | 本批未提供管家门扉闭合、侍者举盘等专用动作帧；后续按演出方案决定拆层或补图 |
| 刻仪兽表现 | 维护／回忆已接入；当前仍复用蓄力行为，专属机制与表现质量待验收 |

旧衣橱守门人与纯家具长桌 Boss 的形态已作废。庄园通过独立内容包接入，`legacy.rift` 原内容仍按原档运行。


## 当前剧情接线与缺图

五层首通与维护使用仓库内三张舞台，地图沿用已归位的庄园图标。当前刻仪兽已接入，旧内容2按旧本尊素材继续恢复；旧D4阶段的接线记录见[历史验收](../../../../docs/archive/audits/2026-09-06-demo-d4-implementation.md)。

用户已确定：**先完成游戏接线，缺图明确保留待补**。以下不计为已经完成的视觉效果：

- 千金无线／无刀的修复底图，以及可独立消隐的刀排、吊线层。
- 千金脱离桌裙后的沉睡姿态。
- 玛丽埃塔抱起少女的画面。

当前结局由完整AVG与既有差分承接，战斗／AVG有完整进退场；终击禁用少女的通用斩杀／碎裂表现。现有带桌整图不能充当沉睡／抱起新姿态；新素材继续入仓库，演出补齐不重复触发首通入账。
