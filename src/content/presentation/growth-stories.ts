type AuthoredLine = { id: string; characterId?: string; name?: string; text: string };
export type GrowthStoryMeta = {
  eventId: string;
  title: string;
  /** Dialogue partner beside Kael; null for the narrator-led gift/milestone framing. */
  partnerId: string | null;
  lines: AuthoredLine[];
  resultText: string;
  chronicleText: string;
};

const line = (eventId: string, index: number, speaker: string | null, name: string, text: string): AuthoredLine => ({
  id: `${eventId}.${String(index + 1).padStart(2, "0")}`,
  ...(speaker ? { characterId: speaker } : {}),
  name,
  text,
});
const dialogue = (eventId: string, rows: [string | null, string, string][]) => rows.map(([speaker, name, text], i) => line(eventId, i, speaker, name, text));

/** D5-A stable authored growth/gift scripts; no gameplay effects live in presentation content. */
export const growthStories: Record<string, GrowthStoryMeta> = Object.fromEntries(([
  {
    eventId: "event.growth.eustice.lv2", title: "把剑暂时放下", partnerId: "eustice",
    resultText: "羁绊Lv.2：第6面苏醒，第5面品质提升为金。",
    chronicleText: "尤斯缇丝把剑暂时放下，与凯尔一起核对归来后的路线记录。",
    rows: [
      ["eustice", "尤斯缇丝", "归队名单核过了。路线还有几处，我想再看一遍。"],
      ["kael", "凯尔", "看可以。剑先放架上，桌边挤。"],
      ["eustice", "尤斯缇丝", "真有事情，放那么远还得去拿。"],
      ["kael", "凯尔", "就在你后面。你坐下，我把纸压平。"],
      ["eustice", "尤斯缇丝", "……别压住这里。下次到这个转角，要让后面的人跟上。"],
      ["kael", "凯尔", "好。你指，我记。"],
    ],
  },
  {
    eventId: "event.growth.eustice.lv3", title: "不必一个人守住", partnerId: "eustice",
    resultText: "羁绊Lv.3：王权领域进入现行，造成2–4伤。",
    chronicleText: "尤斯缇丝与凯尔约定了下一趟的前后分工。",
    rows: [
      ["eustice", "尤斯缇丝", "下一次撤出的顺序，我来安排。前后都要有人看着。"],
      ["kael", "凯尔", "你管前面。后面的交给我，人数也核一遍。"],
      ["eustice", "尤斯缇丝", "发现跟不上就立刻叫我。别什么都说没事。"],
      ["kael", "凯尔", "你也是。换位的时候，叫名字。"],
      ["eustice", "尤斯缇丝", "……凯尔，后列交给你。我会等你报齐。"],
      ["kael", "凯尔", "收到，队长。"],
    ],
  },
  {
    eventId: "event.growth.elora.lv2", title: "先照顾自己", partnerId: "elora",
    resultText: "羁绊Lv.2：第4面苏醒，第3面品质提升为金。",
    chronicleText: "凯尔接过物资记录，让艾洛拉坐着喝完了水。",
    rows: [
      ["elora", "艾洛拉", "物资记完就好了。你们先休息，我再核一遍。"],
      ["kael", "凯尔", "这杯水给你的。记到哪一行了？"],
      ["elora", "艾洛拉", "这里。先说好，真用得上的东西，我可没省。"],
      ["kael", "凯尔", "我知道。我接着念，你听着有没有漏。"],
      ["elora", "艾洛拉", "那你念慢点。……水不用算公用物资吧？"],
      ["kael", "凯尔", "不算。喝你的。"],
    ],
  },
  {
    eventId: "event.growth.elora.lv3", title: "留给自己的那一份", partnerId: "elora",
    resultText: "羁绊Lv.3：现行铭约治疗1–2名伤者各1HP，并净化锁定的最低血存活者当前封锁。",
    chronicleText: "艾洛拉给自己留了一份点心。",
    rows: [
      ["elora", "艾洛拉", "这块比较整齐，留着给别人吧。我拿碎的就行。"],
      ["kael", "凯尔", "每个人都有。整块也有你的。"],
      ["elora", "艾洛拉", "碎的又不是不能吃，放着太浪费了。"],
      ["kael", "凯尔", "我正好拌进碗里。你不用替这块再找主人。"],
      ["elora", "艾洛拉", "……那我的就放这儿。别待会儿又说没人认领。"],
      ["kael", "凯尔", "记住了，艾洛拉的。"],
    ],
  },
  {
    eventId: "event.growth.kororo.lv2", title: "留着的那一份", partnerId: "kororo",
    resultText: "羁绊Lv.2：第3面苏醒，第5面品质提升为金。",
    chronicleText: "柯萝萝坐到桌边，吃掉了给她留着的那一份。",
    rows: [
      ["kororo", "柯萝萝", "这个……还有人要吃吗？"],
      ["kael", "凯尔", "给你留的。先坐过来。"],
      ["kororo", "柯萝萝", "我可以拿去沙发上吗？"],
      ["kael", "凯尔", "带汤的，桌上吃。吃完再躺。"],
      ["kororo", "柯萝萝", "好吧。那你先别收另一把椅子。"],
      ["kael", "凯尔", "不收。我也还没吃完。"],
    ],
  },
  {
    eventId: "event.growth.kororo.lv3", title: "回来再吃", partnerId: "kororo",
    resultText: "羁绊Lv.3：现行铭约对1–2个互异目标各造成3伤。",
    chronicleText: "柯萝萝留下一张点心便笺，约好下一次归来后一起吃。",
    rows: [
      ["kororo", "柯萝萝", "下次回来，想吃这个。写下了，免得你忘。"],
      ["kael", "凯尔", "认得。勺子也画了两把？"],
      ["kororo", "柯萝萝", "另一把你的。你要是先吃完，就不能来分我的。"],
      ["kael", "凯尔", "可以。你也别把出门的东西全留给我拿。"],
      ["kororo", "柯萝萝", "星盘我自己拿。多的就不要加了……回来还要吃呢。"],
      ["kael", "凯尔", "行，回来再吃。"],
    ],
  },
  {
    eventId: "event.growth.norma.lv2", title: "桌上留了位置", partnerId: "norma",
    resultText: "羁绊Lv.2：第3面苏醒，第4面品质提升为金。",
    chronicleText: "诺玛在桌角坐下，那里给她留着位置。",
    rows: [
      ["norma", "诺玛", "桌上这么挤，还专门空一角？"],
      ["kael", "凯尔", "你的。别站门边讲路线。"],
      ["norma", "诺玛", "挺周到。连我习惯看着门都记着呢。"],
      ["kael", "凯尔", "你坐那里，伸手也够得到碗。"],
      ["norma", "诺玛", "那我不客气了。有人叫我让位，你可得作证。"],
      ["kael", "凯尔", "先坐，凉了又赖我。"],
    ],
  },
  {
    eventId: "event.growth.norma.lv3", title: "可以留下的东西", partnerId: "norma",
    resultText: "羁绊Lv.3：现行铭约投出2–3把飞刀，每把1伤。",
    chronicleText: "诺玛把随身的针线放进洋馆抽屉，留待回来使用。",
    rows: [
      ["norma", "诺玛", "这点东西能放抽屉里吗？天天揣着，走哪儿都硌。"],
      ["kael", "凯尔", "左边那格空着。针包好，免得有人摸进去。"],
      ["norma", "诺玛", "不先问问来路？"],
      ["kael", "凯尔", "你缝外衣的时候用过。我看见了。"],
      ["norma", "诺玛", "眼睛还挺尖。那就放这儿，回来找不到我可要翻你的口袋。"],
      ["kael", "凯尔", "抽屉不会长腿。记住是哪格就行。"],
    ],
  },
  {
    eventId: "event.growth.marietta.lv2", title: "今天不是值班", partnerId: "marietta",
    resultText: "羁绊Lv.2：第5面苏醒，第2面品质提升为金。",
    chronicleText: "维护归来后，玛丽埃塔坐着喝茶，把洗杯子的活留给了凯尔。",
    rows: [
      ["marietta", "玛丽埃塔", "庄园后续要处理的地方已经列好。等我把这边也收拾——"],
      ["kael", "凯尔", "清单放这里。桌上这几只杯子我来。"],
      ["marietta", "玛丽埃塔", "您会把杯口朝上留水。"],
      ["kael", "凯尔", "那你坐着指出来。茶都倒好了。"],
      ["marietta", "玛丽埃塔", "……第二只，先沥干。请不要让我从这里再站起来。"],
      ["kael", "凯尔", "看见了。你喝茶。"],
    ],
  },
  {
    eventId: "event.growth.marietta.lv3", title: "不写在规矩里", partnerId: "marietta",
    resultText: "羁绊Lv.3：女仆长的领域进入现行，相邻交换预算由1次增至2次；没有改善时保持原位。",
    chronicleText: "玛丽埃塔约好归来后一起用餐，没有把这件事写成家规。",
    rows: [
      ["kael", "凯尔", "清单写完了？这里怎么多了一行“回来一起用餐”？"],
      ["marietta", "玛丽埃塔", "免得有人把检查工具排在饭前，一直排到忘记时间。"],
      ["kael", "凯尔", "写进家规？"],
      ["marietta", "玛丽埃塔", "不。家规已经够多了。"],
      ["kael", "凯尔", "那我按约好的时间回来。你的椅子也留着。"],
      ["marietta", "玛丽埃塔", "请留靠里那把。门边有风。"],
    ],
  },
  {
    eventId: "event.demo.preparation-gift", title: "把空着的那一手用起来", partnerId: "marietta",
    resultText: "已收下备用短刃与应急药囊，各一件，存入馆内未装备库存。",
    chronicleText: "玛丽埃塔交给大家一把备用短刃和一只应急药囊，供出征前分配。",
    rows: [
      ["marietta", "玛丽埃塔", "备用短刃，应急药囊。出门前，请给需要的人带上。"],
      ["kael", "凯尔", "只有这一套？"],
      ["marietta", "玛丽埃塔", "各一件。足够您先想清楚，由谁在空出手的时候补上一下。"],
      ["kael", "凯尔", "刀补一击，药囊搭把手。明白。"],
      ["marietta", "玛丽埃塔", "只是补手。不要拿它代替该做的准备。"],
      ["kael", "凯尔", "我去和大家分。名字写清楚，回来也好收齐。"],
    ],
  },
] as (Omit<GrowthStoryMeta, "lines"> & { rows: [string | null, string, string][] })[]).map(({ rows, ...meta }) => [meta.eventId, { ...meta, lines: dialogue(meta.eventId, rows) }]));

/** Derived once with the second Lv.3 grant; a read-only recap, never a claim gate. */
export const teamMilestoneStory: GrowthStoryMeta = {
  eventId: "story.kael.team-lv3-guard", title: "这边交给我", partnerId: null,
  resultText: "团队羁绊里程碑：凯尔第4面「护卫」品质提升为金。",
  chronicleText: "凯尔在下一趟的安排上补了一笔：剩下这边，交给他。",
  lines: dialogue("story.kael.team-lv3-guard", [
    [null, "旁白", "凯尔把下一趟的安排摊在桌上。原先挤在一起的几处标记，现在各有了要接手的人。"],
    ["kael", "凯尔", "前面有人带路，后面也有人看着。"],
    [null, "旁白", "他在自己的名字旁补了一笔，把纸推回桌中央。"],
    ["kael", "凯尔", "剩下这边，交给我。"],
  ]),
};
