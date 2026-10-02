# 礁蟹：AI 线稿首样

用户指定通过 `/Users/liuhang/Documents/nai5-image-studio` 的 Image 2.5 通道编辑原画，随后要求质量使用 `high`。执行脚本为该项目的 `scripts/codex-lineart-sample.mjs`，复用其模型目录、编辑参数校验与报价合同；密钥仅在进程内读取用于认证，不写入本目录。

| 版本 | 真实参数 | 结果 |
| --- | --- | --- |
| v1 | Sunburst / max / 1536×1024 | 用户更正前已提交；约 87 秒，排线偏多，保留对照 |
| v2 | Sunburst / high / 1536×1024 | 约 39 秒，减少碎纹与排线；当前接入预览 |

两次均按免费图片额度报价，积分报价为 0。该耗时仅为本次实测，不保证后续速度；后续默认固定 `high`，每次执行重新报价。

## 可查看的文件

- `01-reef-crab-original.png`：原始素材，字节不变，唯一编辑输入。
- `02-menu-background-reference.png`：实际界面底景参考，没有发送给生图模型。
- `03-opus-prompt.txt`：Opus 5.5 提示词精修原答。
- `04-execution-prompt-v1.txt`、`04-execution-prompt-v2.txt`：实际发送文本。主 Agent 将透明浅色线稿适配为白底深灰线稿，便于稳定分离；v2 进一步强调姿态和线条疏密。
- `reef-crab-ai-v1.png`、`reef-crab-ai-v2.png`：未经改动的 AI 输出；同名 `.attempt.json` 记录真实模型、质量、费用报价和 hash。
- `reef-crab-ai-v2.transparent.png`：只做白底转透明、统一暖灰线色的全尺寸成品。
- `07-reef-crab-ai-v2-dark.jpg`：透明成品叠在纯暗底上的观察预览。
- `05-before-ui.jpg`、`06-ai-lineart-ui.jpg`：实际菜单截图。

用户已接受礁蟹 v2 的方向（“差不多”），并授权剩余条目批量处理。观察线稿仍有局部造型概括；保留一大一小双螯、低伏身体、甲壳、藤壶与珊瑚等识别要素，不宣称轮廓与原画逐像素一致。

正式预览资产位于 `src/assets/codex/ai-observations`，由 `scripts/prepare-codex-ai-lineart.py` 整理。运行时只加载成品，旧算法素材留在独立目录作对照。
