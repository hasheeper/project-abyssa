# 退潮黑礁批次素材清单

交接日期：2026-09-16。范围为教学关补全第一批与黑礁正常副本补全第二批，共 7 张敌人、3 张战斗背景和 1 张地图立牌。玛丽埃塔回忆战批次未开工，待本批画风冻结后启动。全项目命名与提示词约束见[美术资产命名合同](../../../../docs/design/ART_ASSET_NAMING_CONTRACT.md)。

## 敌人资产

| 资产 ID／正式文件 | 图鉴基名 | 教学关／遭遇显示名 | 当前用途 |
| --- | --- | --- | --- |
| [`enemy.slime.mire`](enemy.slime.mire.png) | 浊泥史莱姆 | 浊泥史莱姆 | 教学关，替换灰盒；未来可做酸沫、冻泥、熔浆换色变体 |
| [`enemy.outlaw.blade`](enemy.outlaw.blade.png) | 亡命徒·刀手 | 亡命徒·刀手 | 教学关，替换灰盒；可派生黑礁走私团红头巾变体 |
| [`enemy.outlaw.crossbow`](enemy.outlaw.crossbow.png) | 亡命徒·弩手 | 亡命徒·弩手 | 教学关，替换灰盒；可派生黑礁走私团红头巾变体 |
| [`enemy.outlaw.hauler`](enemy.outlaw.hauler.png) | 亡命徒·扛夫 | 亡命徒·扛夫 | 教学关，替换灰盒；可派生黑礁走私团红头巾变体 |
| [`enemy.outlaw.chief`](enemy.outlaw.chief.png) | 亡命头目 | 匪首「礁钩」 | 教学关 Boss；立绘不烘焙称号，可换称号和微调配色复用 |
| [`enemy.beast.reef-crab`](enemy.beast.reef-crab.png) | 硬壳礁蟹 | 待正常副本内容定案 | 第二批归档，规则方向待定，未接玩法 |
| [`enemy.beast.shell-leech`](enemy.beast.shell-leech.png) | 藏壳海蛭 | 待正常副本内容定案 | 第二批归档，按非恐怖“缩壳讨嫌”方向，未接玩法 |

教学关继续使用既有 `enemy.intro.*` 玩法定义和脚底锚点，只在表现映射中换成上述五张正式 PNG；不因美术换图改动规则、存档或已发布内容摘要。

显示尺寸不按源 PNG 的画布尺寸自动决定，而按抠图后主体块头校准。史莱姆为小型档；弩手因蹲姿略低于普通人形；刀手为普通人形档；头目明显大于普通人形；扛夫因体格、背架和长柄镐为本批最大。美术基准画布高度依次为 145／180／216／266／280 px。

正式敌区以 `enemy-stage-model.ts` 记录的 alpha 主体边界，结合实测意图／姓名宽度排布；不再按人数等分百分比列，也不以 PNG 透明画布作为点击范围。选择框跟随实际主体与身份区宽度。空间不足才统一收紧立绘，保持块头关系；超过四敌使用前后错位，意图和姓名仍独立不重叠。脚底固定，悬浮放大不超过 4%。死亡完成退场后，以 420 ms 水平滑移收拢空位，保留幸存者美术尺寸及前后层次；连续击倒／撤回从当前显示位置接续，不回弹或上下跳，召唤复用尺寸目录空位。

意图线起点位于本敌血量下方，终点位于真实我方卡片上沿前；位置在初次布局、图片／字体完成、舞台缩放后重测，补位期间与单位共用同一动画时钟移动。选中仅是悬浮／键盘预览，点击沿用正式攻击或格挡，不增加锁定步骤。Boss 王冠为独立固定尺寸图标盒，与敌名分开，避免文字基线造成叠压。

## 背景与地图立牌

| 资产 ID／正式文件 | 用途 | 当前接线 |
| --- | --- | --- |
| [`bg.tide-reef.shore`](../../backgrounds/tide-reef/bg.tide-reef.shore.jpg) | 雾滩洞口；含翻覆货车正典物 | 定稿教学关第 1 战；AVG 洞口进场与出洞返程 |
| [`bg.tide-reef.cargo`](../../backgrounds/tide-reef/bg.tide-reef.cargo.jpg) | 上层货台；与三件货剧情绑定 | 教学关第 4 战／Boss；AVG 货台接敌与战后收拾货物；不建议刷本复用 |
| [`bg.tide-reef.boardwalk`](../../backgrounds/tide-reef/bg.tide-reef.boardwalk.jpg) | 人去楼空的走私栈道 | 正常副本归档，未接玩法；只留空桶、破网、缺板等残骸 |
| [`map.tide-reef`](../../map/landmarks/map.tide-reef.png) | 教学关与正常副本共用地图立牌 | 已归档，未替换现有地图节点；只含可切割地貌实体 |

当前场景裁决以 2026-09-17 最新剧情对齐要求为准：定稿版第 1 战使用 `bg1`／`bg.tide-reef.shore`；第二场开战前已越过洞口，因此第 2、3 战及洞内开锁事件均使用 `map/quest-backgrounds/tidecall-grotto.jpg`；第 4 战／Boss 使用 `bg2`／`bg.tide-reef.cargo`；`bg3` 留给正常副本。此项取代此前“第 1、2 战均使用 bg1”的配置。旧版对白未写入洞内，继续按各自文本地点显示，不改已发布剧情和存档。

战斗和 AVG 共用故事地点推导：每场战斗取对应战前 AVG 的最后地点；对白读完后的继续前进、补给、开锁画面维持最后读完的地点，不再按上一场战斗编号回退。内外三层背景和战斗地点标签统一读取 `tideScene`。

AVG 按正文地点单独接线：`S3-1` 与 `S3-2` 开场为雾滩洞口；定稿版 `S3-2.screen.2` 越过洞口后切溶洞；`S3-3` 背风石阶用原溶洞；`S3-4` 与 `S3-5` 整理货物期间用货台。定稿版 `S3-5.screen.3` 下撤石阶时切溶洞，下一句穿出洞口时切雾滩；`S4-*` 用洋馆。旧版对白按各自段落地点映射，不套用定稿版新增的转场句。每段提前加载全部用到的背景，读档按对白游标恢复场景。

## 来源与处理

来源为用户提供的 `/Users/liuhang/Downloads/`。三张正式背景按原字节复制；敌人源图原样保存在 [`sources/`](sources/)，地图立牌源图保存在 [`map/landmarks/sources/map.tide-reef.png`](../../map/landmarks/sources/map.tide-reef.png)。

| 下载文件 | 正式资产 | 尺寸 | 处理 |
| --- | --- | ---: | --- |
| `slime.mire.jpeg` | `enemy.slime.mire.png` | 1376×768 | ToonOut 抠图 |
| `outlaw.blade.jpeg` | `enemy.outlaw.blade.png` | 1376×768 | ToonOut 抠图 |
| `outlaw.crossbow.jpeg` | `enemy.outlaw.crossbow.png` | 1376×768 | ToonOut 抠图，保留弩、箭矢与弩弦 |
| `outlaw.hauler.jpeg` | `enemy.outlaw.hauler.png` | 2752×1536 | ToonOut 抠图，保留背架与镐 |
| `outlaw.chief.jpeg` | `enemy.outlaw.chief.png` | 1376×768 | ToonOut 抠图，保留钩杖、红布与木箱 |
| `beast.reef-crab.jpeg` | `enemy.beast.reef-crab.png` | 1376×768 | ToonOut 抠图，保留海藻、藤壶与接地泥滩 |
| `beast.shell-leech.jpeg` | `enemy.beast.shell-leech.png` | 1376×768 | ToonOut 抠图，保留壳缘附着物与滴水细节 |
| `bg1.jpeg` | `bg.tide-reef.shore.jpg` | 2752×1536 | 原样复制 |
| `bg2.jpeg` | `bg.tide-reef.cargo.jpg` | 2752×1536 | 原样复制 |
| `bg3.jpeg` | `bg.tide-reef.boardwalk.jpg` | 1376×768 | 原样复制 |
| `map.tide-reef.png` | `map.tide-reef.png` | 1376×768 | 源文件 alpha 全不透明；ToonOut 去除外圈白底 |

八张抠图（七敌人与一张地图立牌）使用本机 `/Users/liuhang/Documents/ToonOut/run_toonout.py`、官方 `birefnet_finetuned_toonout.pth` 权重和原始 1024×1024 推理预处理。macOS MPS 对 `torchvision::deform_conv2d` 无原生实现，本批设置 `PYTORCH_ENABLE_MPS_FALLBACK=1`，仅该算子回退 CPU；没有更换模型、重采样正式画布或调用外部图像生成服务。

ToonOut 遮罩、透明原输出与前后对照保存在可再生成的 `dist/reports/tide-reef-art/`，不作为运行依赖。正式 PNG 保留源图尺寸、透明通道和画布锚点；本批不紧裁、不统一身高、不删除小连通区域。
