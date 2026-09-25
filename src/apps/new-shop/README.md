# New Shop 测试入口

正式游戏已经使用新版商店。共用界面、材质、素材与进场动画位于 [game-client/shop](../../game-client/shop/README.md)，正式数据绑定由 [ShopCounter](../shop/ShopCounter.tsx) 完成，旧版保存在 [OldShopCounter](../shop/OldShopCounter.tsx)。

本目录只保留独立测试入口及本地假数据：4,400 G、0 晶石、五种现有补给和两个铜环实例。不会读写正式存档。购买、出售和固定鉴定用于快速检查样式；实际库存、鉴定记录、交易失败与恢复在正式入口验证。

运行 `npm run dev:new-shop`，打开 `http://127.0.0.1:5193/new-shop.html`。构建使用 `npm run build:new-shop`，产物位于 `dist/entries/new-shop/`；也属于 `dev:lab` / `build:lab` 的 `new-shop.html` 入口。

左下角“重播进场”和“短衔接”保留当前数据，仅重播表现；“重置预览”还原测试数据。`?entry=handoff` 预览剧情后的 480ms 衔接。这些按钮仅在测试页出现。

鼠标景深已按用户要求移除。固定构图、进场动画、正面柜台素材、灯笼暖光与羽毛笔上段透明处理保留。进场生命周期测试位于 `App.entrance.test.tsx`。
