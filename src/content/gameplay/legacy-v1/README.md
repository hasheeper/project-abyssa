# legacy-v1 游戏内容

`catalog.ts` 是从旧 Battle 冻结出来的数据包；角色、骰面、数值、敌群候选、路线和效果均保持原语义。敌群实例化算法属于 core，数据包不含函数或素材 URL。

`manifest.ts` 固定 `abyssa.legacy / contentVersion 1 / rulesVersion 1` 与规范 JSON 的 SHA-256：

`8e08b82cc9828456581b69af44757693154d3a2a2202d70e3a2707f05077a80f`

runtime 必须调用 `validateCatalog(LEGACY_CATALOG, LEGACY_MANIFEST)`；不能仅改数据后沿用版本或重算摘要掩盖语义变化。新战术骰面、玛丽埃塔等需要独立内容/规则版本与迁移。

本包只能依赖 gameplay 数据和 type-only 的 core 公共 Catalog 契约。展示 roster、私人角色资料与图片留在原展示内容层；不自动注入 AI 上下文。
