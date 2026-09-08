# 序幕 CG

来源：作者于 2026-09-08 提供的 `gt1.png`—`gt15.png`。15 张均为 **1216×832 的合成画面**，不是运镜规格假定的 4K 分层图。

运行文件为 **2432×1664 WebP，quality 96，总计约17.13 MiB**。从原PNG做2倍Lanczos重采样，再以半径1.2、强度55%、阈值3仅锐化亮度通道，不调整色相／饱和度。目的是减少实时放大的软化及原质量92文件的再次损失；这不是AI超分，不代表新增真实细节。

重建：`python3 scripts/prepare-prologue-cg.py`（依赖Pillow）。脚本从`sources/`开始且先核对原图SHA-256，不从已锐化的派生文件重复处理。`manifest.json`区分原始／运行尺寸，记录原图与成品SHA-256、处理版本与成品大小。原图不会由运行入口导入。

运行图保持原比例，16:9取景由`src/apps/prologue/script.ts`逐镜确定。第一幕四幅全宽定镜，仍舍去原画约17.8%的高度；第二至四幕恢复各自运镜，预留不超过8%的安全放大。完全保留原画需要后续左右扩绘，当前没有伪造模糊边或拉伸。

`finish/record-grain.webp`为512×512的程序生成中性细纸纹（固定随机种子8192、约217KiB），处理脚本可重建。以低强度柔光叠加在CG与转场上，字幕和Logo在其上层，黑场幕间隐藏；不随帧抖动，不引入实时滤镜计算。此纹理不属于15张剧情CG，也不参与CG预载列表。

| 来源 | 运行文件 | 镜头 |
| --- | --- | --- |
| gt1 | `01-cathedral.webp` | A1-01 大教堂 |
| gt2 | `02-hero-of-light.webp` | A1-02 光之勇者 |
| gt3 | `03-stained-glass-tyrant.webp` | A1-03 异形魔王 |
| gt4 | `04-sword-and-shattered-glass.webp` | A1-04 斩首与破裂 |
| gt5 | `05-muddy-trenches.webp` | A2-01 泥泞战壕 |
| gt6 | `06-rainy-campfire.webp` | A2-02 雨夜营火 |
| gt7 | `07-discarded-pawns.webp` | A2-03 盘上弃子 |
| gt8 | `08-against-the-tide.webp` | A2-04 逆行 |
| gt9 | `09-abyss-bound-child.webp` | A3-01 深渊之底 |
| gt10 | `10-fallen-sword.webp` | A3-02 落剑 |
| gt11 | `11-embrace.webp` | A3-03 拥抱 |
| gt12 | `12-sleeping-black-sea.webp` | A3-04 黑海 |
| gt13 | `13-morning-kitchen.webp` | A4-01 厨房 |
| gt14 | `14-sausage-and-tentacle.webp` | A4-02 香肠与触手 |
| gt15 | `15-watchers-cliff-morning.webp` | A4-03 晨景及标题 |

视听实现与未齐素材见[实施记录](../../../../docs/design/PROLOGUE_CG_IMPLEMENTATION.md)。不使用外部图床，不为原图虚构图层或动作帧。
