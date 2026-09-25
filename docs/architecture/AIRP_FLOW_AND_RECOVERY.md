# AIRP 生成反馈、阅读与恢复

更新：2026-09-25。本文合并生成弹窗、后台提示、阅读过渡、日志排版和通知修复的阶段记录，只描述当前主应用行为。

## 1. 同一任务的三种呈现

- **居中面板：** 在现有洋馆背景上显示任务、短状态和必要操作；准备／失败／阶段反馈可以“收起”，留在当前场景。
- **侧上通知：** 已收起任务与获得道具提示按列叠放，多个任务可以并存；任务身份来自存档与job，不保留离场组件的回调。点击同页任务原地恢复面板，真正跨页才导航。
- **正式阅读：** 点击开始后，中间的房间背景平滑展开为完整AVG背景，面板淡出，再淡入人物和阅读组件。玻璃模糊用于过渡，不让最终正文一直模糊。

位置来自冻结的场景地点。31处洋馆背景及预览映射在[mansion-backgrounds](../../src/game-client/mansion-backgrounds.ts)，素材来源见[资产说明](../../src/assets/backgrounds/mansion/README.md)。不追加主题大框或第二套演出皮肤。

## 2. 阅读与日志

正式洋馆／副本AVG不提供中途CLOSE／LATER。第一次进入即保存阅读入口，刷新恢复当前句，不重播主动展开动画；选择、交付和阶段结束仍按业务命令进行。

`ReadingControls`统一AVG／NVL的底栏：翻幕、推进提示、版式、REPLAY、LOG、AUTO、SKIP以及合法业务操作。阅读层负责焦点约束，真实错误／设置弹窗可接管输入；不能给含阅读portal的祖先整体加inert。

阶段说明缩成目标与出发／达成／交付短指引，内容来自真实任务投影。单个“收起”操作不重复生成第二个按钮。

洋馆日志的“今日安排”和“待鉴定收获”继续使用原有双栏和材质，统一标题、状态、分隔、条目间距及操作基线。鉴定条目显示真实数量与外观说明，未鉴定身份不提前泄露；已读对白回看不推进任务。

## 3. 状态清理与错误边界

| 情况 | 当前处理 |
| --- | --- |
| 出征后残留“正在安排” | 以已保存计划／run状态清理；离场最后一帧不能把已开始计划重新登记为活动任务 |
| 任意后台驱动正忙 | 只保护它所属通道及job；无关结算不能阻止过期通知清理 |
| 页面先看到新任务，后台快照稍旧 | 暂留刚登记的新任务，后台快照追上后再判断，避免误删正常进度 |
| 点击尚未退场的旧通知 | 点击时重新读取session，而非只用React最后一帧；无效身份／过期任务不导航 |
| 正在远征／锁定阅读 | 非battle目的地入口禁用；锁定AVG期间暂停侧栏并阻止入口点击 |
| 正常保存中存在pendingResult | 显示“正在保存”；停止保存后仍有未提交输出才显示恢复状态 |
| 上一幕延迟失败 | 错误绑定任务和阶段，不能覆盖已推进或其他场景的成功状态 |
| 页面刷新重叠 | 等待最新读取／正在提交的命令，不在loading状态提前继续业务 |

真正的模型协议失败、存档失败和待保存结果仍可查看日志并显式恢复。前端状态清理不等于修改供应商响应，不把重试变成后台无限重发。

恢复按钮按实际保留结果区分：未取得可用正文时为「重新请求正文」，说明将再次调用模型；已有原稿时为「继续后处理」，不重发正文；生成结果尚未落盘时为「重试保存」，只提交保留结果。空正文、工具调用、非文本、异常结束、响应格式错误分别提示，原有错误代码与调用次数语义不变。Low允许保留的非空截断原稿继续送后处理，不能因提示细分而丢弃已有内容。

## 4. 维护入口与验证

- [GenerationFlow](../../src/game-client/airp-generation/GenerationFlow.tsx)：生成／反馈／阅读状态与交接。
- [GenerationFeedbackScope](../../src/game-client/airp-generation/GenerationFeedbackScope.tsx)、[background-tasks](../../src/game-client/airp-generation/background-tasks.ts)：统一侧栏、任务生命周期与点击约束。
- [FlowReadingSurface](../../src/game-client/airp-generation/FlowReadingSurface.tsx)、[ReadingControls](../../src/shared/presentation/adv/ReadingControls.tsx)：锁定阅读和通用底栏。
- [JournalAppraisal](../../src/game-client/JournalAppraisal.tsx)、[DirectorDayLauncher](../../src/game-client/airp-director/DirectorDayLauncher.tsx)：日志内容。

09-25通知问题在修复前已通过测试复现；后台、侧栏、生成、出征门控在本轮再次通过，并验证保存原稿的后处理、保存失败仅重试提交、AVG入口与阅读位置恢复、正式及旧版建档和继续。完整检查范围见[项目状态](../DESIGN_DECISIONS_AND_CURRENT_STATUS.md)，不累加旧批次次数。没有读取用户浏览器存档、实际付费调用或重新进行视觉验收。

相关设计使用Opus咨询，本文描述的是工程最终行为；[日志完整设计原稿](../audits/2026-09-25-journal-layout-opus-v3.md)保留供对照，原答不等于用户已认可最终视觉。
