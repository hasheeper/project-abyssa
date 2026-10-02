# 图鉴 AI 线稿批次

当前 14/14 项成品已接入：潮礁 7 项、洋馆 7 项。礁蟹沿用用户接受的 v2；其余 13 项已生成，随后按用户“太小、线太细太杂”的反馈修订全部 11 项类人形／洋馆素材。裂隙爪兽、畸变魔物、术式陷阱已移除。

每次使用真实原画及礁蟹 v2 的笔触参考，保持姿态、辨识特征和相连道具。固定 Image 2.5 / high / PNG，逐张报价、串行生成，费用上限 0。Sunburst 为主；刻仪兽、女佣、头目收到上游 HTTP 400 后使用同系列 Flare 成功。响应仅为“Sub-proxy rejected image editing”，没有明确的安全拒绝原因。刻仪兽、女佣重试已成功，未触发用户授权的 Nano Banana 2 后备。

## 当前选中版本

| 素材 | 版本 | 模型 |
| --- | --- | --- |
| 礁蟹 | v2（首样目录） | Sunburst |
| 史莱姆、海蛭 | v1 | Sunburst |
| 刀手、弩手、扛夫 | v2 | Sunburst |
| 亡命头目 | v3 | Flare |
| 刻仪兽 | v5 | Flare |
| 候席客、执盘侍者、落幕管家、提线千金、玛丽埃塔 | v2 | Sunburst |
| 缝补女佣 | v3 | Flare |

`prompt.txt` 是初批实际提示词；`prompt-humanoid-revision.txt` 是修订实际提示词，两者均为 Opus 5.5 原答。咨询编号 `c-4c371542-a245-4725-a538-0b2c6f21ebd1`，轮次分别为 `t-90056415-366b-4ce0-8ec3-77e8543398a5`、`t-40955445-4010-4037-96e5-c00b584ed488`。各 `.prompt-vN.txt` 保存实际请求文本，不覆盖失败版本。

`jobs.json` 为当前请求来源，`jobs.initial.json` 保留初批任务。`references/` 是编辑输入；原始 AI 输出与同名 `.attempt.json` 保存真实模型、参数、报价、耗时与 hash。透明暖灰成品位于 `src/assets/codex/ai-observations`，完整来源与选中版本见该目录的 `sources.json`。

主图按可见线稿收紧画布，等比放大；千金、玛丽埃塔及海蛭独立调整。四角与外围渐淡，主体中部保持清楚，不切成明显圆形。用户在三版同尺寸对照中明确选择 **B**。亡命徒固定 B：保留 AI 原宽，以 40% 混合轻调细线对比，使黑色细线稍轻、偏灰细线稍清楚。已保存 `line-B-confirmed-reference.webp` 与 `line-B-confirmed.json`，记录真实参考、处理参数和四张当前产物 hash。

执行脚本为本机 `nai5-image-studio/scripts/codex-lineart-batch.mjs`，成功且 hash 一致的版本直接复用，不重复生成。`scripts/check-codex-ai-lineart.py` 检查 14 项覆盖、来源／输出 hash、high 参数、透明边缘与单一 RGB，并输出 `review-01.jpg` 至 `review-03.jpg`。工程检查与主 Agent 核对不等于用户认可全部视觉稿。
