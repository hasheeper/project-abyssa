# 地图素材

地图底图、地标、委托背景和队伍立绘均由本地文件提供。按用途分目录；消费方使用静态 import，让 Vite 生成带内容哈希的资源路径，并随游戏与独立地图入口打包。

| 目录 | 用途 |
| --- | --- |
| `terrain/` | 地图地面纹理 |
| `landmarks/` | 地图上可点击的建筑、洞穴等节点原图 |
| `quest-backgrounds/` | 打开节点后，委托面板中的场景背景 |
| `party-figures/` | 地图队伍的 Q 版立绘；见[处理与校准说明](party-figures/README.md) |

## 底图与节点文件

| 用途 | 仓库文件 | 原始来源（仅供溯源） |
| --- | --- | --- |
| 守望者之崖底图 | [terrain/watchers-cliff-ground.png](terrain/watchers-cliff-ground.png) | [n68e83.png](https://files.catbox.moe/n68e83.png) |
| 风化圣堂 | [landmarks/weathered-sanctum.png](landmarks/weathered-sanctum.png) | [orgrb3.png](https://files.catbox.moe/orgrb3.png) |
| 废弃哨塔 | [landmarks/abandoned-watchtower.png](landmarks/abandoned-watchtower.png) | [im16jb.png](https://files.catbox.moe/im16jb.png) |
| 潮声溶洞 | [landmarks/tidecall-grotto.png](landmarks/tidecall-grotto.png) | [vn7j2p.png](https://files.catbox.moe/vn7j2p.png) |

2026-09-05 将这四张外链 PNG 原样纳入仓库，均为 1408×768；已与 S3 浏览器验收保存的原始响应核对，字节一致。以上来源链接不参与开发、构建或运行时加载。

节点名称使用地标语义，与 `quest-backgrounds/` 中同名 JPG 对应。哨塔位置当前承载“裂隙远征”玩法入口，素材仍名为 `abandoned-watchtower.png`；玩法名称变化不要求重命名美术文件。

## 消费与维护

新增的 [landmarks/old-manor.png](landmarks/old-manor.png) 是克雷格旧庄园的待接入图标，来源为本轮 `c1.jpg`，经 ToonOut 去白底。原图保存在 `landmarks/sources/old-manor.jpg`；详情见[庄园素材清单](../battle/old-manor/README.md)。它尚未加入地图配置，不替换现有三处地标。

- [地图配置](../../apps/map/types.ts)集中导入底图和三个节点。`church / tower / cave` 是现有交互 ID，保持稳定。
- [场景构建](../../apps/map/createMapScene.ts)通过 TextureLoader 加载构建后的本地 URL；[纹理处理](../../apps/map/map-textures.ts)在运行时生成纸边、阴影与名牌。
- 原 PNG 保留透明通道和分辨率。替换美术时在同用途目录更新原图；运行时生成的纸片纹理无需另存一份。
- 构建后的四张图片进入 Vite manifest，现有 `check:output` 会检查对应文件是否存在。部署时携带完整产物目录，不再依赖原图床。
