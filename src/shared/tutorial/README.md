# 共用教程画布

O3-U，2026-09-09；G3补充，2026-09-13。宿主、锚点、定位／避让和暂停已实施；普通战斗可从左侧菜单「操作指引」手动开启。内容11起的四战＋事件教程消费权威步骤；当前25／26继承四层五房结构；旧7～10保留O3-T帮助，不能用手动帮助观看状态代替正式教学证明。

## 使用

`GameShell`提供一个`TutorialProvider`。画布通过body Portal覆盖当前页面，位于页面缩放／裁剪容器外；嵌套Provider复用同一个宿主，其暂停状态仍生效。

```tsx
const anchor = useTutorialAnchors();
return <button ref={anchor("battle.roll")} onClick={roll}>ROLL</button>;
```

目标注册在原节点上，不包裹布局、不复制按钮。命令执行、骰子动画、行动合法性仍由原组件负责。

```tsx
const step = useMemo(() => active ? {
  id: "battle.basics.roll",
  targets: ["battle.roll"],
  contextTargets: ["battle.enemies"],
  protect: ["battle.end-turn"],
  title: copy.steps.roll.title,
  text: copy.steps.roll.text,
  onDismiss: close,
} : null, [active, close]);
useTutorialStep(step);
useTutorialSuspension(panelOpen || busy);
```

步骤对象和回调应保持稳定；同一宿主同时只展示一个步骤。`action`用于确认读过说明，不提交游戏操作；所有完成条件应从正式查询／事件中读取。

`targets`是当前主焦点，使用实线／角标并绑定提示描述；`contextTargets`是需要同时看见的敌情或机会，单独开洞并用虚线标示，不赋予操作语义。两者都参与卡片避让。`protect`仅防遮挡，不会照亮节点，不能代替上下文焦点；可选上下文缺失时仍显示有效主焦点。

## 当前锚点

| 锚点 | 真实目标 |
| --- | --- |
| `battle.roll`／`battle.reroll`／`battle.end-turn` | 原骰池操作按钮 |
| `battle.die:<actorId>` | 角色骰槽 |
| `battle.member:<actorId>` | 角色战斗卡 |
| `battle.health:<actorId>` | 队员HP |
| `battle.enemy:<enemyId>` | 敌人卡体 |
| `battle.intent:<enemyId>` | 当前敌方意图按钮，使用敌人实例ID |
| `battle.enemy-health:<enemyId>` | 敌人HP |
| `battle.enemies`／`battle.dice-tray` | 整片敌阵／全队骰盘，供局势观察使用 |
| `battle.hand`／`battle.multiplier` | 原牌型栏／收益倍率读数 |
| `battle.item:<instanceId>`／`battle.item-target:<instanceId>` | 食物课的原道具槽／唯一指定目标 |
| `battle.event-conditions`／`battle.event-rules` | 原事件条件与判定说明，参与避让 |
| `battle.event-scene`／`battle.event-participant` | 事件叙述区域／所选队员的成功面数 |
| `battle.event-confirm`／`battle.event-result`／`battle.event-observe` | 原ROLL、已提交结果与持久观察确认 |
| `battle.claim` | 原领取并返回洋馆按钮 |

提示卡避开目标、全队骰槽、双方HP、敌方意图、回合按钮、账本和行囊入口；其余区域按空位放置。不能容纳完整提示、目标被裁剪或消失时暂停高亮，仅保留关闭入口，不缩小／移动游戏界面。

## 生命周期与性能

- 宿主读取`getBoundingClientRect`的CSS像素，统一处理安全边缘与裁剪，不再乘舞台缩放或DPR。
- 仅在有活动提示时开启尺寸观察、滚动／窗口／动画结束监听和窄属性DOM观察；更新合并到一次RAF，不持续逐帧测量。
- 全局加载／路由转场由Provider暂停；战斗忙碌、AVG及进退场、菜单、账本和道具坞分别注册暂停令牌。可见`aria-modal`层及`data-tutorial-blocking="true"`也优先。
- G3食物步骤展开道具坞时继续定位原物品／目标，其余步骤打开道具坞仍暂停提示；不在坞外复制使用按钮。
- 装饰遮罩不截获点击。说明卡只处理自身按钮，支持键盘聚焦／Escape关闭，不抢游戏焦点；高亮时暂时移除目标原生title，结束后恢复。
- 锚点、监听器、请求与暂停令牌随组件卸载清理。几何数据、本地收起状态及普通观察阅读标记不进入存档，也不改变RNG、奖励或教学完成状态；正式`hintsEnabled`偏好仍沿用原保存机制。

## 文字与规则边界

短文位于`src/content/presentation/tutorial/battle-basics.json`，标记`copyStatus: placeholder`和`copyTask: O1-W`。后续可只替换文字，保留步骤ID与锚点。

`BattleOperationGuide`是当前手动操作帮助，跟随`DemoJourneyView`的实际骰面、合法行动和回合。`afterFixOptions`由runtime调用正式行动查询生成只读预览，避免提示玩家固定满血治疗面或没有目标的提线面；不另写教程战斗规则。UNDO后重新读取当前状态，不靠累计点击数推进。

点击固定骰子成功后，演出层自动选中该骰主；带做指引由固定直接转到目标，不再要求多点一次角色卡。取消选中或读档后仍保留「选择行动队员」作为恢复提示。再次点击未用固定骰解除固定并清除它的选中；固定另一枚只切换选中者，其他固定状态不变。自动选中不等于出手，不写入新的教程步骤或存档字段。

岩窟自动帮助由 `TideTutorialGuide` 接入同一宿主。`battle.items`／`battle.advance`／`battle.ledger`分别定位原道具开关、战间推进与账本。内容11的 guided 步骤设置 `collapseOnDismiss`：×／Escape 仅收起当前说明，保留目标轮廓及「继续教学」入口，不提交 `tutorial-hints`、不清空选择或解除步骤限制。步骤 ID 改变后自动展开；菜单「操作指引」通过 `expandKey` 重开当前步骤。旧档已关闭的 `hintsEnabled` 仍可通过该菜单恢复。旧版非强制帮助保留原关闭语义。

G3新版通过`guided-tide-model`读取runtime投影，UI草稿只调整当前锚点；系统提示位于`guided-tide.json`，G4角色战术对白单独维护。G4感知修订通过`guidedTideObservation`在入场／关键局势变化时先聚焦敌阵、事件或牌型，确认只记标签页阅读位置。普通操作仍自动推进；唯一持久观察确认是E1结果，按钮在原操作栏而非教程卡内。收起说明与菜单「退出带做」是两个独立操作，只有后者切换为自由操作。Boss只给一次入场观察，无新增操作锁，也不自动弹旧课程卡。

## 验证

- `TutorialProvider.test.tsx`：单宿主／嵌套暂停、原控件点击、模态暂停、旧版关闭、guided 收起／恢复／跨步骤自动展开及观察器清理；操作与上下文独立开洞／避让、可选上下文缺失、观察卡收起不等于确认。
- `geometry.test.ts`：缩放坐标、遮挡避让、无空间与裁剪／隐藏目标。
- `battle-tutorial-model.test.ts`：正式规则下的ROLL、固定、行动、格挡目标、UNDO和只读预览。
- `tests/smoke/tutorial.spec.ts`：从标题档案导入真实规则存档，经原战斗控件操作；检查布局不变、提示不盖骰子／HP／意图、菜单／账本／道具暂停、关闭与刷新。覆盖1280×720、1920×1080及`/`、`/abyssa/`部署。

```sh
npm run build:game
npm exec playwright -- test tutorial.spec.ts -c config/playwright.config.ts --project=game --workers=1
```

截图输出在忽略目录`dist/reports/browser/tutorial-*`。这是共用画布的验证，不代替新档CG→首晨→四场岩窟→回馆的完整验收。

完整岩窟链路复验：`npm exec playwright -- test tide-cave.spec.ts -c config/playwright.config.ts --project=game --workers=1`。

新版五房复验：`npm exec playwright -- test tide-guided.spec.ts -c config/playwright.config.ts --project=game --workers=1`；旧`tide-cave.spec.ts`显式保留内容9四房回归，并另验当前新建档默认入口。范围与证据见[第一章与教学：当前内容说明](../../../docs/design/CHAPTER_ONE_AND_TUTORIAL.md)。
