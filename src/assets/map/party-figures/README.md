# Map Party Figures

本目录只存放地图 `SortiePartyStage` 使用的 Q 版队伍立绘，不是角色档案与出战名单海报立绘。

## 文件映射

| 原始文件 | 角色 ID | 成品 |
| --- | --- | --- |
| `abs.jpg` | `abyssa` | `abyssa.png` |
| `arvt.jpg` | `alvitr` | `alvitr.png` |
| `ila.jpg` | `elora` | `elora.png` |
| `kane.jpg` | `kael` | `kael.png` |
| `kll.jpg` | `kororo` | `kororo.png` |
| `mlat.jpg` | `marietta` | `marietta.png` |
| `nai.jpg` | `lenore` | `lenore.png` |
| `nm.jpg` | `norma` | `norma.png` |
| `usts.jpg` | `eustice` | `eustice.png` |
| `vva.jpg` | `vivienne` | `vivienne.png` |

## 处理基线

- 使用本地 `/Users/liuhang/Documents/ToonOut/run_toonout.py` 与 `weights/birefnet_finetuned_toonout.pth` 批量去除白底，保留 RGBA 透明通道；
- 半透明边缘做白底去污染；十张成品从 ToonOut 原始透明输出统一重跑 V2 轻暖棕色调，收窄色差并保留角色固有强调色；
- V2 验收口径为 sRGB、`512 × 512` RGBA；以 alpha `>= 16` 统计时，主体高 440–444 px、顶部 y=48–49、底部 y=488–492，以此统一视觉高度、脚底基线和透明安全边；
- PNG 像素层仅对 `eustice` 烘焙水平翻转；`kael` 原图已经向右，其余 PNG 保留 ToonOut 后的原始朝向；
- `alvitr`、`elora`、`kororo` 的向右动作流由共享校准中的 `flipX` 在运行时非破坏性完成，不得再次翻转或覆盖 PNG；
- 清除 `alvitr` 脚下与主体无关的孤立小碎片；
- 不批量删除小连通域：`kororo` 的吊坠与 `lenore` 的手骨、火焰都是合法离散细节。

## 共享目录与校准

- `catalog.ts` 是十张成品 URL 与中文名的唯一 manifest，包含 `kael`、不包含 `tibby`；地图与工具都从这里取图，不再各自维护 import 表；
- `src/content/characters/partyFigureCalibration.ts` 固定十人 ID，并持有默认值、当前参数、范围、校验以及稳定 JSON / TypeScript 导入导出函数；
- `partyFigureCalibrations` 是地图与工作台共同使用的已审定默认基线；工作台的“重置当前 / 重置全部”均回到这组值；
- `x` / `y` 保存百分数本身：`x: 4` 表示向右移动 4%，正 `y` 表示向上；`scale`、`x`、`y`、`flipX` 均以脚底中心 `50% 100%` 为变换原点；
- 地图态与编队态必须消费同一组参数。地图外侧收起态使用 `600 × 210` 舞台，五席保持横向可读并轻微收拢；编队展开态使用 `880 × 350` 舞台，五席站位更紧凑，图片占扣除 24px 名条与 8px 间距后剩余 art 高度的 100%；
- 两种布局可以拥有不同槽位尺寸，但不得另建一份角色校准或改变脚底基线语义。Party Figure Studio 的五人预览必须与编队展开态保持同一槽位几何。

已审定默认参数：

| 角色 ID | `scale` | `x` | `y` | `flipX` |
| --- | ---: | ---: | ---: | :---: |
| `abyssa` | 0.98 | 0 | -2.5 | false |
| `alvitr` | 1.11 | 4 | 0 | true |
| `elora` | 1 | 5.5 | 0 | true |
| `eustice` | 1 | 0 | 0 | false |
| `kael` | 0.97 | 0 | 0 | false |
| `kororo` | 1.03 | 0 | 0 | true |
| `lenore` | 0.96 | 0 | 0 | false |
| `marietta` | 0.96 | 0 | 0 | false |
| `norma` | 0.92 | -2.5 | 0 | false |
| `vivienne` | 1.02 | 0 | 0 | false |

## 工作台回填流程

1. 运行 `npm run dev:party-figure-studio`，在单图与五人编队预览中切换深色、羊皮纸和网格背景，调整 `scale / x / y / flipX`；
2. 工作台会把草稿写入浏览器本地存储；本次审定基线使用 `v3` 存储键，旧 `v1` / `v2` 草稿不会覆盖新默认值；“重置当前 / 重置全部”恢复的是共享当前基线，不会修改 PNG；
3. 使用“导出参数”生成完整十人 JSON 或 TypeScript。导出内容必须保留全部固定 ID，不能只复制本次改动的角色；
4. 审核后将 TypeScript 参数表回填到 `src/content/characters/partyFigureCalibration.ts` 的 `partyFigureCalibrations`，再重新载入工作台确认已不再显示未保存差异；
5. 最后同时检查地图态、编队态与工作台构建。参数调整进入共享校准，只有重新抠图、去白边或调色时才改本目录 PNG。

## 接入边界

- `SortieMember.figureUrl` 与 `SortieLeader.figureUrl` 只供 `SortiePartyStage` 使用；
- `SortieRosterPanel` 海报继续读取角色档案的 `portraitUrl`；
- `SortieRosterPanel` 的“当前队伍”摘要与 `SortieQuestPanel` 的四个成员小槽统一读取 `thumbnailUrl`，并复用同一个 `AvatarFrame` 木金切角框；凯尔第五席仍读取旧 `portraitUrl`，不使用 Q 版图；
- 方形透明画布由舞台的 `data-art="figure"` 高度驱动规则渲染，不要改回纵长海报的 `object-fit: contain`；运行时在这层叠加共享脚底中心校准。

原始 JPG 与 ToonOut 的 mask / 中间输出不进入仓库；如重新处理，应从原始批次生成，不要在这些成品 PNG 上反复压缩。
