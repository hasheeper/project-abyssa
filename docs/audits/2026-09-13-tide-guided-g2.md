# G2：五房教学与权威流程验收

日期：2026-09-13。范围：[逐步教程计划](../plans/TIDE_CAVE_GUIDED_TUTORIAL_PLAN.md)的G2。核心与应用接线及本批验收已完成，最终测试结果见§6。**不是G3前端接线，也不是整套教程已面向玩家上线。**

## 1. 发布边界

| 项目 | 本批定稿 |
| --- | --- |
| 新内容 | `abyssa.demo / contentVersion 11 / rulesVersion 4` |
| 内容摘要 | `ca185efbd0a0645e51d7e2735cab4d69382697f330b06584169d376a7a104f09` |
| 来源 | 继承内容9离线卡池；不是内容10在线分支 |
| guide合同 | `version:1 / id:tide.guide.v1`；48个权威步骤 |
| 存档／请求 | schema4／protocol4；新操作仅新版教程可执行 |
| 默认入口 | 仍为内容9；11只支持显式新建及原身份恢复 |
| 旧档 | 7～10原四房、随机后段和摘要不变；不提供upgrade／cycle到11 |
| 本批未做 | UI高亮／禁用／事件分发、AVG正文、双层短句、真人试教、在线11 |

没有改rp仓库、真实玩家档、供应商配置或调用模型。所有测试和归档恢复使用临时内存数据库。显式11虽已注册，不应在G3前让现有玩家页面切过去：原控件还未消费新门禁。

同版非活动档的copy继续沿用原AIRP政策；本批没有开放跨版迁移，也没有放宽活动远征的复制限制。这里的“新建及恢复”指进入、验证新版教程的交付路径，不是另造一套归档系统。

## 2. 五房与教学权威

正式顺序：

```text
S3-1 → 战1 → S3-2 → 战2 → S3-3 → 一份食物整备
→ E1潮坑落货 → 结果观察 → 战3 → S3-4选择A/B/C（同Boss）
→ 战4 → S3-5 → S4-1 → S4-2 → claimable → 手动领取
```

房间索引为0～4，战斗编号仍1～4，E1的battle编号为null。原八个AVG展示节点（七故事槽＋choice）未改；S3-4选择仍在业务step0。插入E1不再用`room+1`当作战斗序号，也不将事件误映射成S3-4。

`tutorial.guide`内容仅声明步骤、语义化演员／目标、instructionId与证据谓词。执行仍调用原战斗、道具、事件和旅程引擎；没有另一套伤害计算、直接塞骰面、锁血、补刷敌人或自动替玩家行动。

运行guide保存连续证明前缀：`stepId / roomId / encounterId / attempt / eventIds`。ROLL、固定、行动、指定格挡、食物、事件、两对／铭约都必须有真实回执。读档先做结构与一致性校验，正式应用再重放完整journey事实；eventId字符串本身不是历史真实性证明。

核心查询`tutorialGuideOperation`只返回当前允许的玩家命令，不执行。错误演员、错误目标、越步、提前END、事件前抢advance均拒绝。原规则继续负责骰子／目标／行动次数合法性。`resume`不受教学门禁阻挡，避免等待敌方真实伤害时自锁。

新增操作只有：

- `tutorial-guide`：携带planId、attempt、mode=free，明确退出带做。关闭提示仍使用`tutorial-hints`，不退出带做。
- `tutorial-observe`：只用于E1结果观察，携带planId、attempt、stepId、当前basis；过期确认或随意stepId不能越步。不是每次动作都加确认框。

T1受击、T2弩箭0伤是自动证据步骤，不是额外点击。战3首轮的两对、诺铭约和真实1点飞刀伤害齐备后进入free/completed；Boss没有教学门禁。随时显式退出的free/exited档可以失败／绕行事件并合法通关，无需补做课程。

## 3. 固定轨迹与E1

战1仍seed8267；进入战2时一次切到K=11395852，此后战2→E1→战3→Boss保持连续combat流。event seed为1019416702。没有每房重新播种。

本轮测试身份是`g2-run`，不是玩家真实档。标准路径共111条正式操作，完成48步证明；第57条操作完成战3首轮教学。自由段使用既有tactical测试策略，不是G1三个Boss策略之一的逐命令复制，因此不沿用G1的112条摘要。

完整操作摘要：`66633183503a6e29d50bb884f316c62329dd4d27f920706b8b941da03607d410`。

| 关键事件 | 新版证据／结果 |
| --- | --- |
| 尤指定挡弩 | `event:42`，仅弩手blocked2；刀手仍blocked0 |
| 弩箭真实落下 | `event:52`，打尤applied0，不是假格挡或提前清弩 |
| 进入E1 | `event:67`，节点`room.tide-cave.event.intro`，combat cursor22 |
| 艾独立首抽 | `event:68/69`，`face.elora.03`强成功／房间完成；event cursor0→1 |
| 观察结果 | `event:70`；不抽骰、不改资源 |
| 战3首掷 | `event:73`；`[2,2,4,5,5]`，combat cursor29 |
| 战3轮末 | `event:87/88/89`；两对／诺铭约／打手受1伤，combat29→31 |
| Boss开场 | combat cursor39；五人各3HP，食物3／药水2 |

以上ID均带`g2-run:`前缀，只是验收例子，生产步骤不写死这些序号。事件不消费combat流、不消耗战斗骰、不执行圣光治疗；cost0／reward0，不会给补给或散金。自由模式选玩家会真实失败，skip不抽面，二者仍完成房间。reader额外核对唯一首抽，改成另一张同为strong的艾洛拉面也会被拒绝。

领取前钱包0、day1 dawn；七槽与选择全部完成后才可手动领取。标准轨迹终局36G＋报酬8G＝44G，返还原实例食物3／药水2，登记三件货事实，推进到day1 day一次。货不是新增库存；没有成长、装备、庄园接管或玛亲征授予。新版领取额外要求五房／四战及唯一E1结果；不要求guide完成，退出带做不剥夺奖励资格。

## 4. UNDO、重试和恢复

- 固定／行动的UNDO同时回退战斗、旧lesson和guide证明；显式退出偏好不被UNDO撤销。事件后不能用battle UNDO重抽。
- 只有真实团灭进入failed。T1阅读后更新开场检查点，防止重试回到没有故事却仍等待S3-1的状态。
- E1期间保留最近战斗开场检查点；进入战3才保存包含E1结果的新检查点。战3重试恢复配给、HP及combat游标，但保留event cursor1与原结果。
- 战3课程完成后再团灭，本场重试回到战3带做开头；曾显式退出者仍保持free/exited。
- Boss本场重试保留E1和S3-4选择；整章重试才重置事件、首战骰流和入口配给。选择保留、attempt递增、eventId仍单调，不删除失败历史。
- 正式应用在事件前／后、Boss后、claimable四点导出并在空库`restoreSave`原身份恢复，继续同一条链。活动AIRP档的普通import复制仍被拒；旧备份不能覆盖已前进的档。
- 事件／领取注入存储失败后零副作用，原请求可重试；重复请求不重抽／不多付，第二标签持有旧head被拒。导出归档不携带一般事务receipt表，恢复后旧玩法请求可能得到conflict；已保存结果不会因此再次执行。

## 5. 交接入口

- [内容与节点](../../src/content/gameplay/demo-v11/content.ts)、[48步定义](../../src/content/gameplay/demo-v11/guide.ts)。
- [guide契约](../../src/game-core/contracts/tutorial-guide.ts)、[查询／门禁](../../src/game-core/session/tutorial-guide.ts)、[流程包装](../../src/game-core/session/tutorial-engine.ts)。
- [状态校验](../../src/game-core/session/tutorial-guide-validation.ts)、[应用事实重放](../../src/game-application/versions/d5-journey-evidence.ts)、[领取校验](../../src/game-core/session/d5-progress.ts)。
- [runtime投影](../../src/game-runtime/tutorial-view.ts)：node、独立battle编号、当前step／operation、canExit／canUndo；E1条件可读，不伪造占卜道具事实。
- [核心测试](../../src/game-core/session/tide-guided-g2.test.ts)、[应用测试](../../src/game-application/testing/tide-guided-g2.test.ts)、[离线报告入口](../../scripts/verify-tide-guided-g2.mjs)。

用项目Node22运行：

```sh
node scripts/verify-tide-guided-g2.mjs
node node_modules/vitest/vitest.mjs run src/game-core/session/tide-guided-g2.test.ts src/game-application/testing/tide-guided-g2.test.ts --maxWorkers=1
npm run typecheck
npm run boundaries:check
```

机器报告位于忽略目录`dist/reports/tide-guided-g2/evidence.json`，含完整内容／操作摘要、所有前后状态摘要、事件、48步证明和逐次RNG。可独立重建，不依赖手改存档。

## 6. 验证与下一步

已通过：

- 全量核心29文件377项，含G2核心17项；后续冻结摘要和E1越步断言另做定向复跑。
- 新版应用专项7项：完整事务／四处恢复／一次领取、反篡改、UNDO、退出带做后绕行通关、runtime投影与显式建档、真实战3团灭重试、旧档迁移边界。最终整文件复跑通过，无未处理错误。
- 原教程应用3项、谱系3项、G1应用1项及两组原UI教学model共4项通过。
- 完整`npm run typecheck`、模块边界、`git diff --check`、新增文件尾部空白和203个本地文档链接检查通过。
- `npm run build:game`通过；离线报告入口独立跑完并生成111条操作证据。新增测试24项；不把同一测试多次运行重复计数。

初次专项中修正了一个并未改变原值的伪造测试样本；内存长链添加周期性事件循环让步，并为需要完整档案重放的测试设置明确时限，最终复跑通过。没有为通过测试放宽玩法、存档或事件规则。

下一批G3消费这些权威查询，保持原布局／主题／控件，接好事件与观察卡、显式退出、关闭提示、键盘／菜单和转场暂停；之后再切默认入口。G4添加系统≤20字／人物只说战术的双层文字，instructionId和气泡仅是展示，不推进玩法。G5再做分辨率、恢复、真人试教和实际阅读节奏验收。本轮没有浏览器视觉或真人试教，不以测试绿色替代。
