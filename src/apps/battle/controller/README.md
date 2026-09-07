# Battle controller

Controller 连接玩家会话与 React 演出。权威规则与存档由 game-client → application → core/Storage 处理；Controller 仅持有可丢弃的视觉副本。

当前庄园／回忆使用 `useManorBattlePresentation`；下面的 `useExpeditionBattleController` 描述旧裂隙兼容接线。两者遵守提交后演出的同一原则，但不共用规则格式；当前入口见[Battle README](../README.md)。v4的结束回合先保存队列，再由应用续行各步骤，不能用旧版“一条end-turn含全部敌方批次”概括所有版本。

`useExpeditionBattleController` 的 submit(command) 等待应用持久提交和必要收尾，返回已提交批次；show(state) 只安装视觉投影；finish() 回到最新已验证存档。heldActor 是本地目标选择。挂载不创建远征，不生成规则随机数，也不从 UI 派生奖励。

`usePresentationQueue` 管理单一 busy/runId 和所有等待定时器。cancel/unmount 会清理定时器并 resolve(false)，不会留下挂起的 Promise。旧 head、读取代次变化或不再可呈现的回执会取消旧演出。

```text
点击 → session.dispatch → application CAS 提交 → 重新 open
    → 核对 receipt.before/after 和最新 head → 按 events 播放
    → impact 更新视觉 HP/盾牌 → finish 安装持久视图
```

敌方一次 end-turn 已包含完整批次，enemyPresentationGroups 按 enemy-intent-resolved 顺序逐只展示。刷新不会重算已播放或未播放的攻击。next-round、旧 enemy cursor 和最后击杀后清层收尾由会话恢复，不能依赖动画结束的 ack。

`presentation-events.ts` 提取攻击/治疗/格挡 cue；`committed-events.ts` 只应用事件携带的 hpAfter/shieldAfter 等绝对展示值。该层不计算伤害、不更新 RNG、不创建第二份敌方规则队列。

依赖仅经 Battle 的 view.ts、game-client 和 runtime 公共视图。engine.ts/legacy-battle 的写 API 只在显式测试夹具中使用，正式 HTML 的传递依赖门禁会拒绝它们。

扩展主动道具或能力时，先定义 Catalog 和应用命令，再消费提交回执添加 cue。不要把尚未存在的玩法伪装成目标选择状态；不要从 CSS/DOM 或生成文本推导游戏结果。

测试覆盖当前存档先于视觉进度、动态 2/3/5 人、取消/刷新、StrictMode、敌方逐只与完整回执，见本目录测试、ExpeditionBattleScreen.test.tsx 和浏览器 game.spec.ts。
