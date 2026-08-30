# Shared 边界

`src/shared` 只存放与具体应用入口无关、已经被多个原型实际复用的稳定能力。

允许的内容：

- 稳定领域契约与纯函数；
- 无场景流程的 UI primitive、pattern 与装饰构件；
- 固定舞台、ADV 等跨场景呈现能力；
- 无业务语义的基础工具和测试夹具。

依赖规则：

- `shared` 不得引用 `apps`、`tools` 或 `content`；
- `shared/domain` 不依赖 React 与 UI；
- 具体角色、房间、剧本和页面状态不进入 `shared`；
- 没有第二个真实消费者的代码默认留在原型内部；
- 不建立导出全部内容的根级 barrel，按稳定叶子模块显式引用。

## 当前稳定模块

| 目录 | 共享职责 | 明确不负责 |
| --- | --- | --- |
| `domain/` | 洋馆区域、角色标识等稳定数据契约与纯函数 | 具体角色、房间实例和页面状态 |
| `presentation/` | ADV、骰子动效等跨场景“如何演”的协议 | 剧本、战斗规则和场景流程 |
| `stage/` | 1600 × 900 固定舞台、缩放、安全区与画框几何 | 路由和全局页面外壳 |
| `transition/` | 独立 HTML App 间的闭幕、真实资源等待、抵达标题与揭幕模式 | 具体目的地、业务加载状态、存档和全局导航表 |
| `ui/items/` | 物品稀有度的名称、排序与归一化 | 商店价格、洋馆库存或战斗掉落规则 |
| `ui/primitives/`、`ui/patterns/` | 无场景流程的控件、库存槽与组合面板 | 任何 app 的 Store、命令或页面生命周期 |

`transition` 可以接收目标 URL 和短文案，但这些值必须由调用方提供；它不能反向登记或导入 `menu`、`battle`、`shop`、`mansion`。同理，库存 UI 只展示调用方传入的数据，不拥有领地库存的 canonical state。

完整规划见 [`docs/architecture/CONCEPT_PROTOTYPE_STRUCTURE_AND_SHARED_PLAN.md`](../../docs/architecture/CONCEPT_PROTOTYPE_STRUCTURE_AND_SHARED_PLAN.md)。
