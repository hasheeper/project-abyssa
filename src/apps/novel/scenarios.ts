import type { NovelActor, NovelLine } from "../../shared/ui/patterns/VisualNovelScene";

export type ScenarioId = "two" | "three" | "four";

export interface Scenario {
  label: string;
  actors: NovelActor[];
  script: NovelLine[];
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  two: {
    label: "双人",
    actors: [
      { characterId: "eustice", name: "尤斯缇丝" },
      { characterId: "elora", name: "艾洛拉" }
    ],
    script: [
      { characterId: "eustice", expression: "g", text: "艾洛拉,过来。今天的巡逻路线,我要再确认一遍。" },
      { characterId: "elora", expression: "b", text: "是是——尤斯缇丝队长,从早上开始就这么严肃。" },
      { characterId: "eustice", expression: "k", text: "……你刚才是不是又在我的地图上画满了涂鸦?" },
      { characterId: "elora", expression: "i", text: "那、那个是……战术标记!对,战术标记!" },
      { characterId: "eustice", expression: "e", text: "狡辩也没用。今晚的报告加倍,没得商量。" },
      { characterId: "elora", expression: "d", text: "呜……早知道就不手痒了……" },
      { characterId: "eustice", expression: "h", text: "唉。……算了,先吃饭。吃完再罚。" },
      { characterId: "elora", expression: "c", text: "真的吗?!尤斯缇丝最好了!" }
    ]
  },
  three: {
    label: "三人",
    actors: [
      { characterId: "eustice", name: "尤斯缇丝" },
      { characterId: "elora", name: "艾洛拉" },
      { characterId: "kororo", name: "可洛洛" }
    ],
    script: [
      { characterId: "eustice", expression: "a", text: "集合完毕。今天的任务是护送商队穿过东门大道。" },
      { characterId: "elora", expression: "f", text: "哎?就我们两个吗?听说那边最近有魔物出没……" },
      { characterId: "eustice", expression: "l", text: "怕了?跟紧我就行。我的剑还没钝。" },
      { characterId: "kororo", expression: "c", text: "等等——!也算我一个!护送任务有报酬吧,有报酬吧?" },
      { characterId: "elora", expression: "j", text: "可洛洛?!你什么时候跟过来的……" },
      { characterId: "kororo", expression: "wink", text: "嘿嘿,从你们说『东门大道』的时候就在啦。赚了钱我请客!" },
      { characterId: "eustice", expression: "k", text: "……随便你。但是不许冲在最前面,听指挥。" },
      { characterId: "kororo", expression: "e", text: "什么嘛!我的实力你还不放心吗?" },
      { characterId: "elora", expression: "i", text: "(小声)就是因为不放心才……" },
      { characterId: "eustice", expression: "h", text: "好了,出发。都给我活着回来,这是命令。" }
    ]
  },
  four: {
    label: "四人",
    actors: [
      { characterId: "eustice", name: "尤斯缇丝" },
      { characterId: "elora", name: "艾洛拉" },
      { characterId: "kororo", name: "可洛洛" },
      { characterId: "vivienne", name: "薇薇安" }
    ],
    script: [
      { characterId: "eustice", expression: "g", text: "紧急会议。刚才接到报告,北边的结界出现了裂缝。" },
      { characterId: "elora", expression: "n", text: "裂、裂缝?!怎么会,上个月才加固过……" },
      { characterId: "kororo", expression: "f", text: "哇,听起来很严重。要打架了吗?" },
      { characterId: "vivienne", expression: "b", text: "哎呀,一大早就这么热闹。……让我看看那份报告?" },
      { characterId: "eustice", expression: "a", text: "薇薇安,你来得正好。结界的事,你最清楚。" },
      { characterId: "vivienne", expression: "g", text: "嗯……这不是自然老化。是有人从外部,一点一点腐蚀的。" },
      { characterId: "elora", expression: "e", text: "人为的?!谁会做这种事……" },
      { characterId: "kororo", expression: "k", text: "哼,不管是谁,被我逮到就完了。" },
      { characterId: "vivienne", expression: "l", text: "冷静点。对方很谨慎,我们得先修复结界,再设下反向追踪。" },
      { characterId: "eustice", expression: "l", text: "好。艾洛拉准备修复材料,可洛洛跟我去现场,薇薇安坐镇中枢。" },
      { characterId: "elora", expression: "a", text: "明白!" },
      { characterId: "kororo", expression: "c", text: "收到!这次一定要抓到犯人!" },
      { characterId: "vivienne", expression: "h", text: "呵呵……那么就,祝各位武运昌隆。" }
    ]
  }
};
