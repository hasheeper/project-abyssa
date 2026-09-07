# 旧D5内容包（内容2／规则4）

`foundation.ts` 组装 `abyssa.demo@2 / rulesVersion:4`，已经在玩家runtime注册，供既有D5存档恢复。**当前新档默认是 [demo-v3](../demo-v3/README.md) 的内容3，而非本包。**

本包保存十项成长事件、固定勇者历史队伍、两件赠物、篇章与当下收束，及原玛本尊／侍偶回忆遭遇。旧包的历史不能因当前回忆改为刻仪兽而原地覆写；新包独立继承和替换相应定义。

v4实际服务已实现普通／历史战、成长与装备事务、导入重定位、有限复制升级和二周目；这些不再是“等待F／H接入”。具体准入以[当前总览](../../../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)和应用服务为准。

`ValidatedD5Catalog.shared` 仅供复用庄园定义与终局结构校验，不可直接拿来执行v4战斗。持久引用必须保留D5完整摘要；不能只改旧存档版本号。

历史规格见[D5-A](../../../../docs/archive/design/DEMO_D5_A_RULES_AND_STORY_SPEC.md)，现行人物与模式决策见[当前状态](../../../../docs/DESIGN_DECISIONS_AND_CURRENT_STATUS.md)。
