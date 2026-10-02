# 游戏字体

沿用原界面的 **Cinzel** 与 **Noto Serif SC**，由在线 Google Fonts 改为随游戏发布。

- Google Fonts CSS API：Cinzel v26（400–900 可变字重）、Noto Serif SC v35（200–900 可变字重）。
- 来源：`https://fonts.googleapis.com/css2?family=Cinzel:wght@400..900&family=Noto+Serif+SC:wght@200..900&display=swap`（2026-09-09 获取）。
- 103 个官方 WOFF2 子集，共 6,068,436 字节；未改字形与 Unicode 覆盖范围。
- `game-fonts.css` 保留官方字重与 Unicode 分段，仅将 URL 替换为本地路径。
- 两套字体均按 SIL Open Font License 1.1 分发，原许可证与版权信息见同目录 `OFL-*.txt`。
- 启动清单负责下载全部子集，加载阶段负责解析，不在剧情遇到新汉字时请求外网。

## 手写楷体：霞鹜文楷 GB 屏幕版

纸面文书（地图委托书等）用的手写楷体，令牌 `--abyssa-font-hand`；界面文字不用它。

- **LXGW WenKai GB Screen** v1.250（单字重 400），取自 npm 包 `lxgw-wenkai-screen-webfont` 1.7.0 的 `lxgwwenkaigbscreen` 子集（2026-10-02 获取）。
- 97 个 WOFF2 子集共约 4.5 MB，分段与 Google Fonts 同一种 unicode-range 切法，浏览器只取页面用到的分段；未改字形。
- `game-fonts.css` 末尾为其 `@font-face`，文件名改为 `lxgw-wenkai-gb-screen-N.woff2`，N 与原包子集编号一致。
- 按 SIL Open Font License 1.1 分发；原包的 OFL.txt 缺版权行，`OFL-LXGWWenKai.txt` 已按字体 name 表补回版权声明。
