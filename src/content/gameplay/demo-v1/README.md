# 正式角色与庄园基础定义

`characters.ts` 是六人36面的基础规则表；`content.ts` 提供勇者铭约、十项成长、两件空面装备与初始队伍。`manor.ts`／`manor-full.ts` 组装早期三层／五层庄园包。图片、页面字符串映射和组件不进入玩法数据。

这些基础定义已被正式版本复用，但本目录整体不是当前默认Catalog；当前新档由 [demo-v3](../demo-v3/README.md) 装配为内容3／规则4。基础定义中玛的 `covenant.marietta` 延后引用由D5完整装配补齐；独立校验未完成的基础片段时必须显式声明，不能安装空处理器掩盖缺失。

[demo-fixtures.ts](../../../game-runtime/testing/demo-fixtures.ts) 中的 `abyssa.fixture.demo-d1` 是单独测试包：移除玛绑定，附加测试敌人、路线和成长profile，不注册为玩家默认包，其赏金不是庄园正式配平。

两件装备采用 `all-native-blanks`，改写拥有者全部原生空面的动作，保留面ID、点数、花色、品质与沉眠。当前v4已实现成长领取、赠物、装卸和转交，不能再按D1阶段理解为仅测试profile可用。实际条件见[当前总览](../../../../docs/GAME_SYSTEMS_AND_CONTENT_SPEC.md)。

历史依据：[D1验收](../../../../docs/archive/audits/2026-09-06-demo-d1-implementation.md)、[规则讨论](../../../../docs/archive/design/DEMO_CHARACTER_RULES_REVIEW.md)。
