# 洋馆地点 AVG 背景

覆盖地图的 31 个地点：大厅采用 `hall-v5.png`；缇比商店复用现有
`../shop-bg3.jpg`；其余 29 处来自本批独立生成的 PNG。原图保存在美术工作室，
游戏仓库只收录 WebP、缩略图和不含凭证的来源清单。

## 图片处理

- 场景图：保持完整取景，Lanczos 等比缩至 2048 像素宽，不放大。
  本批原图为 2752×1536，转换后为 2048×1143；不强制裁成精确 16:9。
- WebP：质量 94、method 6、sharp YUV；仅保留存在的 ICC，去除 EXIF/XMP。
- 房间详情：独立 `previews/`，宽 640、质量 88；不会为了小卡片解码完整背景。
  商店也有轻量预览，但正式场景继续使用已有 JPG。
- `manifest.json` 记录来源相对路径、原图哈希、尺寸、编码配置、输出哈希和体积。
  `integration-candidate` 表示已接入候选，不代表逐张获得了作者美术定稿认可。

使用 Pillow 和 `cwebp`，从仓库根目录执行：

```sh
/usr/bin/python3 scripts/prepare-mansion-avg-art.py --source /Users/liuhang/Documents/nai5-image-studio/outputs/abyssa-mansion-avg
/usr/bin/python3 scripts/prepare-mansion-avg-art.py --source /Users/liuhang/Documents/nai5-image-studio/outputs/abyssa-mansion-avg --check
```

脚本先校验完整批次、生成状态、来源哈希、尺寸、透明度及重复图，再写资源。
重复运行复用匹配的产物，单文件以原子替换写入，原始 PNG 不改动。
`--check` 只核对来源与产物，不写文件、不调用图像生成接口。

## 接入范围

- 共享入口：`src/game-client/mansion-backgrounds.ts`，地点 ID 与可复用美术 ID 分离。
- 洋馆 GM 的生成等待、交付、阅读、选项及阶段反馈沿用本场冻结的地点。
- 历史回看使用每场自己的地点；AVG／NVL／LOG 使用同一张场景图。
- 洋馆房间详情使用缩略图；总地图继续使用原地图素材。
- 资源 glob 只解析 URL，解码继续由现有场景准备机制按需完成。
  后台整包字节缓存沿用现有机制，不把整批图片作为首屏解码依赖。

这是一个基础光照批次，没有夜景差分。已知地点在各时段使用同一基础图；
无可信地点的旧场景仍用旧晨图／夜廊兼容，不猜测房间，也不修改旧故事或存档。
固定首晨及旧 `backgroundId` 注册保持原图；本批接入的是洋馆地点事件。
