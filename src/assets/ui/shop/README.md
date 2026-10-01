# 商店木质样板 v1

仅用于真实商店的 TAB、货架与详情外框，不扩展到立绘框或其他页面。

- `wood-grain-v1.webp` 来自项目已有的 `src/assets/backgrounds/shop.png`，不是外部下载或 AI 生成素材。原图不修改。
- 裁取单块木板内部，转为水平纹理；保留原像素细节，只扣除大范围受光，再映射为低对比暖深木色。已移除首版的缩小、平滑再放大流程。
- 输出为 655 × 58 无损 WebP；边缘连续，按原尺寸平铺，不拉伸。所有处理离线完成，页面不使用实时滤镜或 canvas。
- TAB 与货架的纹理尺度、坐标原点一致。底纹替换货架的重复菱形，不叠加第二套装饰。
- 货架外圈保留木面；内部商品床通过上/左侧遮蔽、下沿受光表现内凹。持有量、价格为更深的两条纵向槽，表头、槽底、商品行共用列宽定义。
- 原有六层物品图案保留，只在商店列表局部把图标外缘改成嵌入式受光。装饰槽底不接收点击，不生成额外商品或占位行。

## 当前接线

素材由 [商店共用展示层](../../../game-client/shop/README.md) 使用，样式位于 `src/game-client/shop/stock-list.css`、`stock-categories.css` 和 `trade-detail.css`。货架名称下方保留单行用途，翻页位于列表底部；购买、出售、鉴定均接真实交易。

常规进场1120ms，剧情后的短衔接480ms；资源解码、外层切场和 SceneSequence 释放后起播。材质、版式与时序的现行约束集中在共用展示层 README，旧商店木板原型已经移除。

使用带 Pillow、numpy 的 Python 运行：

```sh
python3 scripts/prepare-shop-wood.py
python3 scripts/prepare-shop-wood.py --check
```

`--check` 不写入文件，会验证材质像素、尺寸、平铺接缝及对比范围。
材质接入限定在商店组件，不修改共享 RpgFrame 皮肤。
