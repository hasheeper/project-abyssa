import type { CharacterChronicle } from "../../shared/domain/characters/chronicle";
import bandageRollIcon from "../../assets/icons/items/bandage-roll.svg";
import heartKeyIcon from "../../assets/icons/items/heart-key.svg";
import ribbonMedalIcon from "../../assets/icons/items/ribbon-medal.svg";
import tiedScrollIcon from "../../assets/icons/items/tied-scroll.svg";

/* 角色记事的**样稿**内容。
   ------------------------------------------------------------------
   ============ 这是排版样稿，不是最终数据 ============
   记忆如何入库、什么算一条记事、天数从哪来 —— 业务尚未对齐。
   这里的条目是为了把版式的各种形态都撑出来：
     章节分隔 / 四种节点形 / 三档色调 / 筛选分类 / 徽标 / 引语 / 长短正文
   业务定了之后整体替换，届时**类型与组件不需要动**（见 chronicle.ts 文件头）。

   ============ 与档案页保持不矛盾 ============
   条目里出现的 "Lv.N" 徽标不超过该角色 profiles.ts 里的 bond.level，
   私约阶段不超过 pact.currentStage。这是**内容层的自觉**，
   不是类型约束、也不做跨文件断言 —— 机制一变那种断言就是迁移债。
     lenore  Lv.3 / 私约 II
     abyssa  Lv.5 / 私约 III（唯一到重签的人）
     eustice Lv.4 / 私约 II

   引擎的 facts: string[] 是无结构散文，无 characterId、无天数，
   且 character-status 禁止 import apps/battle。所以这些是授权内容，
   不是从战斗账本接来的数据。 */

const AUTHORED: CharacterChronicle[] = [
  {
    characterId: "lenore",
    blocks: [
      { kind: "chapter", id: "l-c1", title: "书库的规矩", stamp: "卷一" },
      {
        kind: "entry",
        id: "l-01",
        stamp: "DAY 02",
        title: "登记为书库的准入者",
        body: "她把借阅簿推过来，指了指最后一栏，说规矩写在那里，不是写给她自己看的。",
        categories: ["daily"],
        marker: "node"
      },
      {
        kind: "entry",
        id: "l-02",
        stamp: "DAY 06",
        title: "归还了逾期的北境卷宗",
        badge: "羁绊 Lv.1",
        body: "逾期一天。她没有收罚金，只是在簿子上重新画了一道线。",
        voice: "「……下次日落前。我说的是日落，不是天黑。」",
        categories: ["bond"],
        marker: "milestone",
        tone: "accent",
        iconUrl: heartKeyIcon
      },
      {
        kind: "entry",
        id: "l-03",
        stamp: "DAY 11",
        title: "在闭馆后被允许留下",
        badge: "羁绊 Lv.2",
        body: "灯只留了一盏。她说这不是特例，是因为把灯全熄了她自己也看不见。",
        categories: ["bond"],
        marker: "milestone",
        tone: "accent",
        iconUrl: heartKeyIcon
      },
      { kind: "chapter", id: "l-c2", title: "不会遗忘的人", stamp: "卷二" },
      {
        kind: "entry",
        id: "l-04",
        stamp: "DAY 15",
        title: "私约由初始转为现行",
        badge: "私约 II",
        body: "权柄重签：捆住一枚敌方意图延迟一回合，目标由你指定。",
        categories: ["pact"],
        marker: "hollow",
        tone: "accent",
        iconUrl: tiedScrollIcon
      },
      {
        kind: "entry",
        id: "l-05",
        stamp: "DAY 18",
        title: "远征中替队伍记下了退路",
        body: "她把三层的岔口默背了一遍。回程时那段路塌了，只有她知道另一条。",
        categories: ["battle"],
        marker: "node"
      },
      {
        kind: "entry",
        id: "l-06",
        stamp: "DAY 21",
        title: "带伤缺勤",
        badge: "休养 3 天",
        body: "骨翼的旧伤裂开。她坚持说亡灵不需要休息，然后在书桌前睡了整个下午。",
        categories: ["battle"],
        marker: "alert",
        tone: "alert",
        iconUrl: bandageRollIcon
      },
      {
        kind: "entry",
        id: "l-07",
        stamp: "DAY 26",
        title: "承认自己留了一册私藏",
        badge: "羁绊 Lv.3",
        body: "那是她母国的地方志，唯一一本。她说规矩对所有人生效，包括她，所以这册也登记了。",
        voice: "「……登记在我的名下。这样它就还在册子里，没有消失。」",
        categories: ["bond"],
        marker: "milestone",
        tone: "accent",
        iconUrl: ribbonMedalIcon
      }
    ]
  },
  {
    characterId: "abyssa",
    blocks: [
      { kind: "chapter", id: "a-c1", title: "醒着的时候", stamp: "卷一" },
      {
        kind: "entry",
        id: "a-01",
        stamp: "DAY 01",
        title: "在长桌下面被发现",
        body: "她说那里晒得到太阳。实际上那里晒不到，但没有人纠正她。",
        categories: ["daily"],
        marker: "node"
      },
      {
        kind: "entry",
        id: "a-02",
        stamp: "DAY 04",
        title: "第一次主动要了布丁",
        badge: "羁绊 Lv.1",
        voice: "「……布丁。」",
        categories: ["bond"],
        marker: "milestone",
        tone: "accent",
        iconUrl: heartKeyIcon
      },
      {
        kind: "entry",
        id: "a-03",
        stamp: "DAY 09",
        title: "把沙发的一半让了出来",
        badge: "羁绊 Lv.2",
        body: "柯萝萝争了三天。第四天她自己挪到了边上，谁也没提这件事。",
        categories: ["bond"],
        marker: "milestone",
        tone: "accent",
        iconUrl: heartKeyIcon
      },
      { kind: "chapter", id: "a-c2", title: "还俗", stamp: "卷二" },
      {
        kind: "entry",
        id: "a-04",
        stamp: "DAY 13",
        title: "私约由初始转为现行",
        badge: "私约 II",
        body: "权柄重签：三面沉眠同时朝上时，本回合免疫一次失手。",
        categories: ["pact"],
        marker: "hollow",
        tone: "accent",
        iconUrl: tiedScrollIcon
      },
      {
        kind: "entry",
        id: "a-05",
        stamp: "DAY 17",
        title: "带伤缺勤",
        badge: "休养 2 天",
        body: "根源之力回流时躯壳撑不住。她说不疼，但那两天没有下楼。",
        categories: ["battle"],
        marker: "alert",
        tone: "alert",
        iconUrl: bandageRollIcon
      },
      {
        kind: "entry",
        id: "a-06",
        stamp: "DAY 22",
        title: "记住了所有人的名字",
        badge: "羁绊 Lv.3",
        body: "包括缇比。她念的顺序和入住登记簿完全一致。",
        categories: ["bond"],
        marker: "milestone",
        tone: "accent",
        iconUrl: heartKeyIcon
      },
      {
        kind: "entry",
        id: "a-07",
        stamp: "DAY 29",
        title: "在深层替全队挡下了崩坏",
        badge: "羁绊 Lv.4",
        body: "第七层。她站在最前面，回来时外袍只剩半边。",
        categories: ["bond", "battle"],
        marker: "milestone",
        tone: "accent",
        iconUrl: ribbonMedalIcon
      },
      {
        kind: "entry",
        id: "a-08",
        stamp: "DAY 34",
        title: "私约重签",
        badge: "私约 III",
        body: "权柄重签：新约由她自己念出条款。这是第一次，不是大天平替她定的。",
        voice: "「……这次，是我说的。」",
        categories: ["pact"],
        marker: "hollow",
        tone: "accent",
        iconUrl: tiedScrollIcon
      },
      {
        kind: "entry",
        id: "a-09",
        stamp: "DAY 38",
        title: "把洋馆称作家",
        badge: "羁绊 Lv.5",
        body: "没有人问她。她在饭桌上顺口说的，然后继续吃布丁。",
        categories: ["bond"],
        marker: "milestone",
        tone: "accent",
        iconUrl: ribbonMedalIcon
      }
    ]
  },
  {
    characterId: "eustice",
    blocks: [
      { kind: "chapter", id: "e-c1", title: "规矩订下来是给人看的", stamp: "卷一" },
      {
        kind: "entry",
        id: "e-01",
        stamp: "DAY 02",
        title: "递交了第一份战术表",
        body: "三页，附带补给清算。她说这是最简的版本。",
        categories: ["daily"],
        marker: "node"
      },
      {
        kind: "entry",
        id: "e-02",
        stamp: "DAY 05",
        title: "在废墟里替人挡下一记",
        badge: "羁绊 Lv.1",
        body: "她的说法是「位置刚好」。当时她跑了十二步。",
        voice: "「哼，别误会。本小姐只是站得比较靠前。」",
        categories: ["bond", "battle"],
        marker: "milestone",
        tone: "accent",
        iconUrl: heartKeyIcon
      },
      {
        kind: "entry",
        id: "e-03",
        stamp: "DAY 08",
        title: "把骑士领旧勋章别上了骰面",
        badge: "羁绊 Lv.2",
        body: "格里芬家的旧物。她说空着的那一面看着不体面。",
        categories: ["bond"],
        marker: "milestone",
        tone: "accent",
        iconUrl: ribbonMedalIcon
      },
      { kind: "chapter", id: "e-c2", title: "所有人活着回来", stamp: "卷二" },
      {
        kind: "entry",
        id: "e-04",
        stamp: "DAY 12",
        title: "私约由初始转为现行",
        badge: "私约 II",
        body: "权柄重签：同花成型时，全队本回合格挡值 +1。",
        categories: ["pact"],
        marker: "hollow",
        tone: "accent",
        iconUrl: tiedScrollIcon
      },
      {
        kind: "entry",
        id: "e-05",
        stamp: "DAY 16",
        title: "带伤缺勤",
        badge: "休养 3 天",
        body: "左肩。她照常出现在前庭，被艾洛拉按着送回房间两次。",
        categories: ["battle"],
        marker: "alert",
        tone: "alert",
        iconUrl: bandageRollIcon
      },
      {
        kind: "entry",
        id: "e-06",
        stamp: "DAY 20",
        title: "承认那份订单是自己压下来的",
        badge: "羁绊 Lv.3",
        body: "薇薇安的陈酿。她把两千的差额从自己的份额里划走了。",
        categories: ["bond"],
        marker: "milestone",
        tone: "accent",
        iconUrl: heartKeyIcon
      },
      {
        kind: "entry",
        id: "e-07",
        stamp: "DAY 25",
        title: "第一次把指挥权交了出去",
        body: "第五层，她判断诺玛的绕后更稳。全队按诺玛的走法回来了。",
        categories: ["battle"],
        marker: "node"
      },
      {
        kind: "entry",
        id: "e-08",
        stamp: "DAY 31",
        title: "在餐桌上说出了那条底线",
        badge: "羁绊 Lv.4",
        body: "不是训话。她说完之后自己也愣了一下，然后低头吃饭。",
        voice: "「……所有人活着回来。这一条，不接受讨论。」",
        categories: ["bond"],
        marker: "milestone",
        tone: "accent",
        iconUrl: ribbonMedalIcon
      }
    ]
  }
];

/* 尚未录入记事的角色。占位说明各写各的，不用同一句套话。 */
const PLACEHOLDERS: CharacterChronicle[] = [
  { characterId: "elora", blocks: [], placeholderNote: "补给簿翻到一半，还没有人替她记" },
  { characterId: "kororo", blocks: [], placeholderNote: "她说记这些很麻烦" },
  { characterId: "norma", blocks: [], placeholderNote: "她习惯不留痕迹" },
  { characterId: "marietta", blocks: [], placeholderNote: "旧庄园的册子还没搬过来" },
  { characterId: "alvitr", blocks: [], placeholderNote: "神域的记录已被抹除，新的还没开始" },
  { characterId: "vivienne", blocks: [], placeholderNote: "她的账目另有一套，不外借" }
];

export const characterChronicles: CharacterChronicle[] = [
  ...AUTHORED,
  ...PLACEHOLDERS
];

export function findChronicle(
  characterId: string
): CharacterChronicle | undefined {
  return characterChronicles.find(
    (chronicle) => chronicle.characterId === characterId
  );
}
