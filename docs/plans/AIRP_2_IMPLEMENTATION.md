# AIRP-2：首条手写委托的玩家闭环

后续说明：本页保留 AIRP-2 交付时的内容8范围；当前默认内容9与四型扩展见 [AIRP-3](AIRP_3_IMPLEMENTATION.md)，不会改写本页所述旧档契约。

日期：2026-09-09。状态：首条手写玩家闭环已交付，真实浏览器全链通过。承接 [AIRP-1 契约](AIRP_1_CONTRACTS_AND_FIRST_ERRAND.md) 与 [DEMO 总计划](AIRP_NARRATIVE_DEMO_PLAN.md)。本阶段实现“旧药箱的搭扣”，不启用模型、不改 rp-style-lab、不引入应用后端。

## 1. 版本决定：内容 8 + AIRP 契约 1

实施时最新基础内容已是内容 7（岩窟教学）。本阶段新增独立的 `abyssa.demo / contentVersion: 8 / rulesVersion: 4`，记录／请求协议继续使用 4；AIRP 自身固定 `version: 1`。

这是对 AIRP-1“整体升至新记录／规则协议”暂定方案的明确修订：战斗规则与事务封套没有变化，不为此复制一套规则 5。隔离由不可变 Catalog 身份和严格 reader 实现，不是在旧存档里放一个任意可选 JSON：

- 内容 8 必须带可重放的 `narrative`；内容 2–7 禁止该字段。
- 内容 8 才接受 AIRP 命令／事实／回执；旧服务仍拒绝。
- 内容 7 保持原定义与摘要；新建默认内容 8，旧档不静默升级。
- `epoch` 是字符串身份，不是整数计数。
- 旧档通过显式“复制并续接新内容”进入内容 8。内容 7 的实际序幕、首晨、教学进度保留；更早的既有冒险档按现有规则得到教学豁免，不伪造教学胜利。

## 2. 真实执行管线

```text
玩家点击／待处理命令恢复
  → 内容绑定的命令白名单与 expectedHead
  → 严格读取当前档案、校验历史与来源档
  → 普通旅程规则 + AIRP 确定性 reducer
  → 追加原子事实组，重放验证目标证据与叙事投影
  → 同一事务 CAS 保存记录 + 请求回执
  → 只读 narrative 查询
  → 洋馆 ADV／巡守旁白／账本目标／终态历史
```

前端不直接改任务状态、不提交“我已完成”的布尔值。第三层目标来自现有旅程重放确认的 `room-completed`，归来来自真实 `expedition-settled`。正文、选择、游标、任务绑定、证据、记忆与冷却都存在同一记录中。

关键实现：

- 内容与严格脚本子集：`src/content/gameplay/demo-v8/content.ts`、`src/game-core/contracts/airp-live*.ts`。
- 领域投影：`src/game-application/versions/airp-replay.ts`。
- 事务与重放：`d5-service.ts`、`d5-validate.ts`；既有 IndexedDB 原子保存无需另建存储。
- 只读查询：`src/game-runtime/airp-view.ts`。
- 玩家演出：`AirpStory.tsx`、`AirpPanel.tsx`、`ManorBattleBinding.tsx`。

## 3. 首条委托的执行规则

| 边界 | 行为 |
| --- | --- |
| 可提供 | 已接管旧庄园、已完成或跳过家宴归来；教学完成／豁免；无活动远征、回忆或正典对话；艾洛拉可用 |
| 待命 → 已见 | 公共休息室“问问艾洛拉”；第一次曝光才冻结正文与实际昼夜舞台 |
| 接受 | A／B／C 均为明确的接受行动，保存 iron／seasoned／pragmatic；不自动替玩家说台词 |
| 稍后 | `airp-defer` 保存暂停状态与游标，不接受、不关闭委托；刷新后可继续谈 |
| 婉拒／过期 | 婉拒保留已见历史；提供期 8 个游戏时段；未见过期标为 reserved，但本阶段不重新提供备用卡 |
| 出发 | 只绑定接受后的下一趟 `old-manor.maintenance`，冻结真实 run、接受／出发事实与第三层第一个房间实例 |
| 取箱 | 对应房间实际完成才产生携带状态；在巡守中播放固定旁白，账本可查看 |
| 带回 | `extracted` 或 `cleared` 才可交付，两种归来脚本不同；旧趟、回忆与撤回事实无效 |
| 失败 | 力竭归来不算带回；接受仍有效，清空本趟绑定，读过重整对白后重新出发 |
| 交付 | 阅读归来片段后“交付空药箱”；仅写一条共同记忆和 256 时段冷却，无额外货币／道具／数值好感 |
| 终态 | resolved／closed 留在历史，查询、刷新与其他回馆不会重复补卡；AIRP-3 再扩充调度 |

第三层是 `layer: 3, roomIndex: 0`，房间定义 `room.old-manor.maintenance.layer-3`。目标是**空药箱**，不是可用药品。C 的“取到就撤回”是玩家意向，仍可自行选择深入，不强制退出。

首版明确将艾洛拉设为公共休息室四相位可达；这不是完整 NPC 日程系统。日间复用现有首晨室内背景，暮／夜使用登记的夜景资源；已经曝光的场景保留其历史舞台，不随后来相位替换。巡守旁白使用当前真实房间背景。

## 4. 正文、知情与恢复

手写正文属于不可变内容包，但首次使用时把完整脚本及 `bodyHash / templateId / templateVersion / contentDigest / sourceHead / phase` 冻结进存档。后续加载必须与历史重放结果完全相符；只重算文本 hash 不能通过验证。

归来开头明确写出“巡守记录交给艾洛拉”，再谈侧门撤离或全清，避免 NPC 无来源地知道战斗结果。交付后的记忆显式授予玩家和艾洛拉共同知情。历史查询按已验证的阅读／选择事实只展示实际曝光片段，不展开未选分支。

事务有两种不同的身份：

- 相同请求 ID + 相同输入：返回原请求回执；相同 ID 换输入拒绝。
- 不同请求 ID 重复交付：可有新的无效果命令提交，但领域 `receiptId`、记忆和冷却不变。不是声称两个不同事务有相同 revision。

原身份备份恢复与复制新档分开：

- 档案页选择 **AIRP 备份恢复（原身份）**。恢复完整正文、选择、游标、run 绑定、证据与领域回执；只写入缺失的原身份档案。
- 本机已有完全相同记录时视为重试；有不同／更新记录时拒绝，不覆盖或回滚本机进度。
- 备份不包含整个存储回执表。AIRP 请求回执可由存档中的已验证意图事实重建，恢复后重试旧 AIRP 请求仍幂等；这不扩展为旧战斗命令回执的通用恢复功能。
- 活动委托、活动阅读、远征或正典对话期间禁止把内容 8 复制为新身份。安全边界的新档保留只读 origin 来源，不把来源档的领奖证据转成新档活动证据。

## 5. 如何试玩

1. 新档按序完成序幕、首晨、岩窟教学、庄园首通与家宴归来；或把已有合法首通旧档显式续接至内容 8。
2. 洋馆右下归来面板找到“旧药箱的搭扣”，点击“问问艾洛拉”。
3. 读完提议并选 A／B／C；进入地图编队，开始维护巡守。
4. 打过第三层勤务走廊，看到取箱旁白；可从第三层出口“带宝离场”，也可继续全清。
5. 返回洋馆，点击“把药箱交给艾洛拉”，读完后交付。历史保留共同记忆，刷新不重复领取。

测试没有给玩家增加“跳到第三层／直接完成”入口。浏览器前置档由真实命令完成旧庄园首通并升级，接取及后续巡守通过玩家 UI 操作。

## 6. 验证与容量

已完成的检查：

- `npm run typecheck`：core／application／app／tooling 全通过。
- `npm run test:core -- --maxWorkers=1`：26 文件、340 测试通过。首次并发运行有一项教学测试超出原 5 秒限制，单 worker 复跑全部通过，未改教学规则。
- AIRP-1 回归：36 个核心、5 个手写稿、1 个协议隔离测试通过。
- AIRP-2：21 个专项场景分批通过。初次从零执行首通、接取及侧门归来生成证据；后续读取同一命令生成的检查点，并经严格 reader 重新验证，覆盖全清、团灭重试、暂停／拒绝、七阶段原身份恢复、恢复后原 AIRP 请求回执重建、篡改、双窗口、undo、旧内容隔离、提交前／后中断和配额故障。
- 两项大档恢复在并发负载下超过 30 秒测试时限；将该专项时限设为 60 秒后单独复验通过。未放宽历史验证或改写存档结果。
- 额外 31 项 D5 foundation、教学升级、pending request、恢复与档案列表测试通过。
- 34 项洋馆、地图、战斗绑定和加载界面回归通过。
- 模块边界、纯 core/application 导入检查、静态 game 构建及输出检查通过。
- 浏览器完整 UI 路线通过（1 场，约 3.2 分钟自动化操作）：原身份导入真实首通前置档 → 接取 → 稍后／刷新 → C 选择 → 地图编队 → 实际战斗及补给 → 第三层取箱／刷新 → 侧门撤离 → 归来对白／刷新 → 交付／刷新。确认一条共同记忆，交付前后资金不变，未产生被监测到的页面／资源错误。

浏览器截图：[接取](../../dist/reports/airp-2/browser/airp-AIRP-accept-real-patr-b8590-d-exactly-one-shared-memory-game/offer.png)、[地图目标](../../dist/reports/airp-2/browser/airp-AIRP-accept-real-patr-b8590-d-exactly-one-shared-memory-game/map-5-members.png)、[第三层取箱与账本](../../dist/reports/airp-2/browser/airp-AIRP-accept-real-patr-b8590-d-exactly-one-shared-memory-game/found-case.png)、[暮／夜归来](../../dist/reports/airp-2/browser/airp-AIRP-accept-real-patr-b8590-d-exactly-one-shared-memory-game/return.png)、[交付完成](../../dist/reports/airp-2/browser/airp-AIRP-accept-real-patr-b8590-d-exactly-one-shared-memory-game/resolved.png)。自动化耗时不是玩家体验时长。

本轮没有宣称全量 application／app 测试套件全部通过。AIRP 专项命令：

```sh
npm test -- src/game-application/testing/airp-live.test.ts
# 已有命令生成的检查点时可显式复验，仍执行严格历史校验：
ABYSSA_AIRP_FIXTURE=dist/reports/airp-2/checkpoints.json npm test -- src/game-application/testing/airp-live.test.ts
ABYSSA_SMOKE_PORT=5257 npm run test:smoke -- --project=game --output=dist/reports/airp-2/browser airp.spec.ts
```

浏览器用独立端口与报告目录，避免和并行教学验收共享输出。只固定出发 seed 为 19；掷骰、伤害、房间完成和结算均走正常规则，没有补 HP、伪造胜利或开发跳关。

真实侧门路线（包含完整来源首通档）测得：

| 检查点 | 本档 revision | 完整导出 bytes | narrative bytes |
| --- | ---: | ---: | ---: |
| 待提供 | 0 | 276,398 | 455 |
| 出发 | 8 | 297,958 | 5,716 |
| 找到药箱 | 108 | 405,105 | 6,946 |
| 交付完成 | 120 | 422,652 | 11,171 |

保留全包 8 MiB、叙事 4 MiB、单场景 16 KiB、128 场景等既有上限。再次出发前预留本趟出发／发现／重整／归来场景数量，避免到交付时才撞上场景数上限。这些单条样本不代表长期多卡／多祖先容量已验收；AIRP-3／5 仍须做长周期数据策略。

## 7. 后续边界

本阶段没有自由生成、网络请求、生成任务队列、公共网关、服务器权威资产或生产模型上下文调用；`rp-style-lab` 未修改。已有三轴纯函数与显式来源规则可供 AIRP-4 继续装配，不能称为已部署的完整 Prompt 管线。

其余三型、备用库重新提供、后果型失效、配额与 64 日模拟属于 AIRP-3；中文对白仍是待剧作确认的手写稿，约 40 分钟整体体验属于 AIRP-6。
