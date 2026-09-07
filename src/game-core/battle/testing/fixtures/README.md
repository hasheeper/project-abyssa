# S1 迁移前样本

`s1-extraction.json` 在生产模块仍位于 `src/apps/battle` 时生成，并先用旧实现跑过断言。随后只移动文件，没有重生成预期。

- `s1-provenance.json` 保存原 HEAD 及 50 个生产文件的原始 SHA-256。
- 5 个旧策略远征共 956 步：SHA-256 覆盖完整 JSON 状态，包括 RNG、eventSequence、日志和嵌套撤回状态；不是原 golden 的简化摘要。
- 命令轨迹对完整 transition（状态、事件、错误）取指纹，并检查输入未被修改及失败引用行为。
- 敌回合中断点、随机偷取前状态与 schema 1/2/3 输入以完整 JSON 保留；恢复、撤回再做与迁移结果另有完整指纹。
- 同时冻结 124 个运行时导出、版本和 raw/seed 初始化差异。

`extraction-baseline.test.ts` 重新执行同一观察器进行比较；不提供自动更新开关。已有语义 golden 仍独立保留。后续规则或存档版本变化时，保留这些历史输入，显式审阅兼容预期。
