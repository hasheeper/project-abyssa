# G3：原UI接入五房带做教程

日期：2026-09-13。范围：[逐步教程计划](../plans/TIDE_CAVE_GUIDED_TUTORIAL_PLAN.md)的G3。**原UI接线、默认入口切换及本批回归已完成。** G4正文、角色战术气泡与G5真人试教不在本批完成声明中。

## 1. 交付与版本边界

- 新建档默认改为内容11／规则4，继承内容9离线卡池；schema／protocol仍为4。原序幕、首晨与正常出门交接保留。
- 内容7～10旧四房按原摘要继续运行。旧档不插E1、不重选种、不升级到11；`continueSave`仍走已验证的内容9路径，不跟随新建档默认版本。
- 显式在线内容10和rp应用没有修改，没有调用LLM、读取密钥或操作真实玩家档。
- G2内容摘要、48个步骤、种子、战斗／事件／奖励规则均不变。修改仅在查询消费、页面、共享控件可选属性、短句资产、测试与文档。

## 2. 原控件与权威步骤

`tutorialOperationAllowed`只比较投影中当前允许的操作；原核心继续核对完整规则。页面统一用这份结果决定固定骰、重掷、结束回合、演员、目标、道具、事件和推进的可用状态，实际处理函数也复核。没有在UI另建推进游标或自动执行下一步。

高亮跟随`guide.step/operation`。拿起角色、打开道具、选择物品、选择参与者只改变局部草稿，既不消耗玩法资源，也不伪造步骤证明。UNDO后直接重新读取当前步骤。系统短句位于`src/content/presentation/tutorial/guided-tide.json`，均不超过20字，标记为G3功能稿；`instructionId`可覆盖特定说明，G4继续精修。

格挡课明确引导指定的敌方意图，不由队友卡自动猜测另一条攻击；其他战斗保留原队友／敌人卡的格挡手势。补全角色／敌人卡Enter与Space操作，内部意图按钮不会因键盘冒泡重复提交。菜单END与底部END使用相同门禁。

关闭提示只修改`hintsEnabled`。原菜单单独提供“退出带做”，走`tutorial-guide`，以后可自由尝试。关闭提示不会解除限制，退出带做也不会被UNDO撤销。战3首轮达到真实两对／诺玛追击后按核心释放；Boss不主动弹旧课程卡，手动帮助仍可自行打开。

## 3. E1与结果

原岩窟三元分发曾覆盖事件页面，现在按节点独立分发事件／结果与整备／重试／领取。复用`ManorJourneyPanel`和原掷骰回执演出，增加可选事件呈现文案，不复制战斗页、不更改原庄园叙事。

- E1没有战斗编号，不显示“遭遇null”。玩家实际选择艾洛拉，再按ROLL；不自动选人，不预览结果。
- 骰面由已提交回执演出，滚动中不揭晓，后台／切页沿原队列取消与恢复。
- 结果显示真实骰面、强成功／失败、判定依据、0费用／0收益，不写获得补给、不执行治疗。
- “确认结果”位于原操作栏，以查询提供的`planId/attempt/stepId/basis`提交`tutorial-observe`。提示关闭或结果刷新后仍有可用确认入口；未确认不能抢先推进。
- 退出带做后可选其他参与者或绕行。绕行不消费eventRng，也不强制补做强成功。

新增锚点均挂在原节点：道具／目标、事件条件／规则、确认、结果观察和领取。共用画布仍负责避让、模态／菜单／账本／转场暂停；食物教学展开道具坞时可继续高亮实际物品与目标。

## 4. 结算

领取面板区分“远征实得／追回报酬／本次总入账”。标准流程实际为36G＋8G＝44G；显示不是重新计算玩法结算。点击领取前仍为dawn、资金未入账；点击后原事务返还余量、只推进一个时段，并回到自由洋馆。没有自动领取或强制进入商店。

## 5. 验证与剩余工作

最终验收：

| 范围 | 结果 |
| --- | --- |
| 核心定向回归 | 21项通过：G2带做17项、旧教程4项；未改核心规则 |
| 页面／模型／共用画布 | 7文件22项通过，含新增4项完整步骤映射、事件和结算检查 |
| 应用与版本兼容 | 3文件28项通过：G2事务7项、显式在线10隔离7项、原成长／维护／复制升级14项；无真实模型调用 |
| 构建后浏览器 | 7项通过，0失败／0跳过／0 flaky；新五房2项、旧四房与新建入口3项、共用教程2项 |
| 工程检查 | 四组typecheck、模块边界、`build:game`、`git diff --check`通过；11份主文档的本地链接检查通过 |

完整带做使用真实控件与键盘，验证UNDO、菜单门禁、关闭／重开提示、E1滚动不泄漏、结果刷新、七故事与S3-4选择、四次胜利及44G一次入账。领取前资金0／dawn，领取后44G／day一次，余量食物3、药水2；刷新不重复领取。自由模式验证主动退出、E1绕行不消费eventRng、UNDO不恢复带做。

1280×720、1600×900、1920×1080均检查战斗与E1高亮：锚点对齐、卡片不遮骰槽／HP／意图／事件条件；关闭提示不重排原战场。人工查看了窗口截图与事件结果。正常动画和降低动效均覆盖；菜单、账本、事件演出及原AVG转场沿用暂停机制。

浏览器证据：[机器报告](../../dist/reports/smoke.json)、[1280战斗高亮](../../dist/reports/browser/tide-guided-G3-real-five-r-b74c9-on-recovery-and-exact-claim-game/guide-1280.png)、[1280事件选人](../../dist/reports/browser/tide-guided-G3-real-five-r-b74c9-on-recovery-and-exact-claim-game/event-participant-1280.png)、[关闭提示后的结果恢复](../../dist/reports/browser/tide-guided-G3-real-five-r-b74c9-on-recovery-and-exact-claim-game/event-result-restored.png)、[领取面板](../../dist/reports/browser/tide-guided-G3-real-five-r-b74c9-on-recovery-and-exact-claim-game/claim.png)。`dist`为可重建的本地验收产物，不进入发布内容。

调试过程保留说明：首次窗口比较取到了缩放动画中间帧，测试已改为等待稳定几何，再比较提示开关前后；一次并行重测中的旧提示测试超过5秒，随后单worker重跑全部22项通过，未扩大该测试的超时掩盖失败。

复验命令（项目Node22）：

```sh
npm run typecheck
npm run boundaries:check
npm run build:game
npm exec playwright -- test tide-guided.spec.ts tide-cave.spec.ts tutorial.spec.ts -c config/playwright.config.ts --project=game --workers=1
npm exec vitest -- run --project application src/game-application/testing/tide-guided-g2.test.ts src/game-application/testing/loop.test.ts src/game-application/testing/airp-online-gameplay.test.ts --maxWorkers=1
```

G4下一步：逐幕S3／S4正文及E1叙事衔接，系统短句与人物战术气泡分工，战3真实追击反馈与Boss一次开场／淡目标；不让人物教按键。G5再做真人试教、节奏与数值判断。浏览器自动通关不是初见玩家理解度证明。
