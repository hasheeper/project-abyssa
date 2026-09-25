# 待审文案导出副本

归档：2026-09-19。两份JSON从docs根目录原样移入，字节未变；包含历史编辑，不是当前运行时，也不是新的正式源稿。

| 文件 | 条目 | 与当前源码的关系 |
| --- | ---: | --- |
| [TUTORIAL_COPY_EDITABLE.json](TUTORIAL_COPY_EDITABLE.json) | 266 | 16份来源中14份哈希已变化 |
| [SCENE_COPY_SEPARATED.json](SCENE_COPY_SEPARATED.json) | 978 | 38份来源中23份哈希已变化 |

核对时所有来源文件仍存在，两份newCopy均为空。但TS／TSX行列键随代码移动，旧键的值变化不能直接认定为作者修改；JSON Pointer差异也可能来自后续正式修订。因此本次保留全部未决编辑，不做自动回填、去重或正文裁决。

已确认旧教学提示与当前内容不同，例如“先看看各位队员这次能做什么”现已改为“掷出全队本轮可用的行动骰面”，“保留骰面”现为“固定骰面”。这些只是来源漂移证据，不是把旧稿覆盖回去的理由。

当前手册在[handbook.json](../../../src/content/presentation/tutorial/handbook.json)，剧情在[正式场景目录](../../../src/content/presentation/scenes)。只读导出脚本[export-tutorial-copy.mjs](../../../scripts/export-tutorial-copy.mjs)打印当前盘点，不能覆盖这两份文件。它不授予原稿审核或写回权限。

后续如需彻底删除：按source＋语义位置逐条核对，先把仍需讨论的改稿提取为作者明确认可的待办／定稿，再删除副本；不通过旧行号直接写入现行源码。仓库外Markdown备份及恢复位置见[历史来源索引](../README.md)。
