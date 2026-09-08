import type { AuthoredLine, AuthoredUserChoiceOption } from "./authored-story";
import { PLAYER_NAME_TOKEN } from "../../shared/domain/player-identity";

export type GrowthStoryMeta = {
  eventId: string;
  title: string;
  partnerId: string | null;
  lines: AuthoredLine[];
  resultText: string;
  chronicleText: string;
};

type Row =
  | ["say", string, string, string?]
  | ["action", string]
  | ["choice", string, readonly [AuthoredUserChoiceOption, AuthoredUserChoiceOption, AuthoredUserChoiceOption]];

const options = (iron: [string,string,string?], seasoned: [string,string,string?], pragmatic: [string,string,string?]) => ([
  {tone:"iron" as const,label:iron[0],action:iron[1],...(iron[2] ? {line:iron[2]} : {})},
  {tone:"seasoned" as const,label:seasoned[0],action:seasoned[1],...(seasoned[2] ? {line:seasoned[2]} : {})},
  {tone:"pragmatic" as const,label:pragmatic[0],action:pragmatic[1],...(pragmatic[2] ? {line:pragmatic[2]} : {})},
] as const);

function authored(eventId:string, rows:readonly Row[]):AuthoredLine[] {
  return rows.map((row,index)=>{
    const id=`${eventId}.${String(index+1).padStart(2,"0")}`;
    if(row[0]==="say") return {id,characterId:row[1],text:row[2],...(row[3] ? {expression:row[3]} : {})};
    if(row[0]==="action") return {id,kind:"action",text:row[1]};
    return {id,kind:"user-choice",prompt:row[1],text:row[1],options:row[2]};
  });
}

const definitions:(Omit<GrowthStoryMeta,"lines"> & {rows:readonly Row[]})[] = [
  {
    eventId:"event.growth.eustice.lv2",title:"把剑暂时放下",partnerId:"eustice",
    resultText:"羁绊Lv.2：第6面苏醒，第5面品质提升为金。",
    chronicleText:`尤斯缇丝暂时放下剑，与${PLAYER_NAME_TOKEN}核对了归来后的路线记录。`,
    rows:[
      ["say","eustice","归队名单核过了。路线还有几处，我想再看一遍。","g"],
      ["action",`${PLAYER_NAME_TOKEN}把桌边的剑收入架中，展开被杯底压住的路线图。`],
      ["say","eustice","……真有事情，放那么远还得去拿。"],
      ["choice","她仍按着剑鞘。",options(["把剑推回架上 ·「坐下。」",`${PLAYER_NAME_TOKEN}把剑推回架上。`,"坐下。"],["敲敲身后剑架 ·「够得着。」",`${PLAYER_NAME_TOKEN}敲了敲她身后的剑架。`,"够得着。"],["压平路线图 ·「你指，我记。」",`${PLAYER_NAME_TOKEN}压平路线图。`,"你指，我记。"])],
      ["say","eustice","……下次到这个转角，后列必须跟紧。别漏。","a"],
      ["action",`她终于松开剑鞘。${PLAYER_NAME_TOKEN}沿着她指出的路线逐一落笔。`],
    ],
  },
  {
    eventId:"event.growth.eustice.lv3",title:"不必一个人守住",partnerId:"eustice",
    resultText:"羁绊Lv.3：王权领域进入现行，造成2–4伤。",
    chronicleText:`尤斯缇丝与${PLAYER_NAME_TOKEN}重新分好了下一趟的前后列。`,
    rows:[
      ["say","eustice","下一次撤出的顺序，我来安排。前后都要有人看着。","g"],
      ["action","她在队首和队尾各放下一枚棋子，手却一直停在队首那枚上。"],
      ["say","eustice","前面交给我。后面……我会随时回头确认。"],
      ["choice","她试图把两端都揽下。",options(["按住队尾棋子 ·「后列归我。」",`${PLAYER_NAME_TOKEN}按住队尾的棋子。`,"后列归我。"],["把名册放到她手边 ·「先报齐人数。」",`${PLAYER_NAME_TOKEN}把名册放到她手边。`,"先报齐人数。"],["将两枚棋子分开 ·「一人一边。」",`${PLAYER_NAME_TOKEN}把两枚棋子分到桌子两端。`,"一人一边。"])],
      ["say","eustice","发现跟不上就立刻叫我。你也不准拿『没事』敷衍过去。","g"],
      ["action",`她把队尾那一栏划给${PLAYER_NAME_TOKEN}，这才在队首签下自己的名字。`],
    ],
  },
  {
    eventId:"event.growth.elora.lv2",title:"先照顾自己",partnerId:"elora",
    resultText:"羁绊Lv.2：第4面苏醒，第3面品质提升为金。",
    chronicleText:`${PLAYER_NAME_TOKEN}接过物资记录，艾洛拉终于坐着喝完了水。`,
    rows:[
      ["say","elora","物资记完就好了。你们先休息，我再核一遍。","g"],
      ["action",`${PLAYER_NAME_TOKEN}把水杯放到清单正中央，压住她正要翻起的下一页。`],
      ["say","elora","我不渴。真的只剩最后几行了。"],
      ["choice","她绕开杯子，又去够清单。",options(["抽走清单 ·「先喝。」",`${PLAYER_NAME_TOKEN}抽走清单。`,"先喝。"],["念出下一行 ·「你只管听。」",`${PLAYER_NAME_TOKEN}拿起清单。`,"你只管听。"],["把笔换成水杯 ·「我来核。」",`${PLAYER_NAME_TOKEN}拿走她的笔，把水杯塞进她手里。`,"我来核。"])],
      ["say","elora","……那你念慢一点。我听得出来哪里漏了。","a"],
      ["action","纸页继续向后翻。杯里的水也终于一点点见了底。"],
    ],
  },
  {
    eventId:"event.growth.elora.lv3",title:"留给自己的那一份",partnerId:"elora",
    resultText:"羁绊Lv.3：现行铭约治疗1–2名伤者各1HP，并净化锁定的最低血存活者当前封锁。",
    chronicleText:"艾洛拉给自己留了一份完整的点心。",
    rows:[
      ["say","elora","这块比较整齐，留给别人吧。我拿碎的就行。","a"],
      ["action",`${PLAYER_NAME_TOKEN}把完整的那块放回她面前，又将碎屑倒进自己的碗里。`],
      ["say","elora","碎的又不是不能吃。专门留给我，反而浪费了。"],
      ["choice","她还想把盘子推走。",options(["按住盘沿 ·「这是你的。」",`${PLAYER_NAME_TOKEN}按住盘沿。`,"这是你的。"],["端走碎屑 ·「这份有人要了。」",`${PLAYER_NAME_TOKEN}端走装着碎屑的碗。`,"这份有人要了。"],["把叉子放上去 ·「一起吃。」",`${PLAYER_NAME_TOKEN}把叉子放到她的盘边。`,"一起吃。"])],
      ["say","elora","……那就不许待会儿又说这盘没人认领。","c"],
      ["action","她把盘子往自己这边挪了一寸，在清单末尾认真写下了自己的那一份。"],
    ],
  },
  {
    eventId:"event.growth.kororo.lv2",title:"留着的那一份",partnerId:"kororo",
    resultText:"羁绊Lv.2：第3面苏醒，第5面品质提升为金。",
    chronicleText:"柯萝萝坐到桌边，吃掉了给她留着的那一份。",
    rows:[
      ["say","kororo","这个……还有人要吃吗？","a"],
      ["action",`${PLAYER_NAME_TOKEN}揭开小锅的盖子，把仍温着的那份盛进碗里。`],
      ["say","kororo","我可以拿去沙发上吗？端得很稳的。"],
      ["choice","她抱着碗，已经朝沙发挪了半步。",options(["拉开桌边椅子 ·「坐下。」",`${PLAYER_NAME_TOKEN}拉开桌边的椅子。`,"坐下。"],["抬起汤勺 ·「洒了就没了。」",`${PLAYER_NAME_TOKEN}抬起汤勺，指了指满碗的汤。`,"洒了就没了。"],["在桌边放好靠垫 ·「吃完再躺。」",`${PLAYER_NAME_TOKEN}把靠垫垫到椅背。`,"吃完再躺。"])],
      ["say","kororo","好吧……另一把椅子先别收。我吃得很慢。","m"],
      ["action","另一套餐具被留在原处。柯萝萝缩进靠垫里，小口喝起了汤。"],
    ],
  },
  {
    eventId:"event.growth.kororo.lv3",title:"回来再吃",partnerId:"kororo",
    resultText:"羁绊Lv.3：现行铭约对1–2个互异目标各造成3伤。",
    chronicleText:"柯萝萝留下点心便笺，约好下一次归来后再一起吃。",
    rows:[
      ["say","kororo","下次回来，想吃这个。写下了，免得你忘。","a"],
      ["action","便笺上画着歪斜的点心盘，旁边还挤着两把勺子。"],
      ["say","kororo","另一把不是备用。你要是先吃完，就不能来分我的。"],
      ["choice","她等着便笺得到回应。",options(["把便笺钉上清单 ·「回来再吃。」",`${PLAYER_NAME_TOKEN}把便笺钉到出征清单上。`,"回来再吃。"],["圈住两把勺子 ·「少一个都不开饭。」",`${PLAYER_NAME_TOKEN}在两把勺子外画了个圈。`,"少一个都不开饭。"],["收起便笺 ·「我记着。」",`${PLAYER_NAME_TOKEN}把便笺收进口袋。`,"我记着。"])],
      ["say","kororo","那星盘我自己拿。多余的东西也不要加……回来还要留力气吃。","g"],
      ["action","她把星盘抱进怀里。那张便笺留在最显眼的位置，没有被任何清单盖住。"],
    ],
  },
  {
    eventId:"event.growth.norma.lv2",title:"桌上留了位置",partnerId:"norma",
    resultText:"羁绊Lv.2：第3面苏醒，第4面品质提升为金。",
    chronicleText:"诺玛在能看见门口的桌角坐下，那里一直给她留着位置。",
    rows:[
      ["say","norma","桌上这么挤，还专门空一角？","i"],
      ["action",`${PLAYER_NAME_TOKEN}把那把斜着的椅子扶正，门口仍完整落在它的视野里。`],
      ["say","norma","挺周到。连我坐哪儿才不背门都记着呢。"],
      ["choice","她搭着椅背，没有立刻坐下。",options(["敲一下椅背 ·「入座。」",`${PLAYER_NAME_TOKEN}敲了一下椅背。`,"入座。"],["把热碗推过去 ·「再等就凉了。」",`${PLAYER_NAME_TOKEN}把热碗推到空位前。`,"再等就凉了。"],["挪开桌角杂物 ·「位置是你的。」",`${PLAYER_NAME_TOKEN}清开桌角最后一点杂物。`,"位置是你的。"])],
      ["say","norma","行。待会儿有人赶我，你可得站我这边。","l"],
      ["action","她坐下后仍能看见门，也终于不用端着碗站在过道里。"],
    ],
  },
  {
    eventId:"event.growth.norma.lv3",title:"可以留下的东西",partnerId:"norma",
    resultText:"羁绊Lv.3：现行铭约投出2–3把飞刀，每把1伤。",
    chronicleText:"诺玛把随身针线放进洋馆抽屉，留待回来使用。",
    rows:[
      ["say","norma","这点东西能放抽屉里吗？天天揣着，走哪儿都硌。","a"],
      ["action",`${PLAYER_NAME_TOKEN}拉开左侧空抽屉，把里面的旧纸和断绳清了出去。`],
      ["say","norma","不先问问来路？里面可不一定只有针。"],
      ["choice","她捏着针包，仍给自己留着退路。",options(["接过针包 ·「包好再放。」",`${PLAYER_NAME_TOKEN}接过针包，合紧外层布扣。`,"包好再放。"],["把钥匙压在桌上 ·「回来自己开。」",`${PLAYER_NAME_TOKEN}把抽屉钥匙压在桌上。`,"回来自己开。"],["将抽屉推到她面前 ·「空着也是空着。」",`${PLAYER_NAME_TOKEN}把空抽屉推到她面前。`,"空着也是空着。"])],
      ["say","norma","那就说定了。回来找不到，我可要从你的口袋开始翻。","l"],
      ["action","针包落进抽屉。诺玛亲手推上它，记住了木纹缺口的位置。"],
    ],
  },
  {
    eventId:"event.growth.marietta.lv2",title:"今天不是值班",partnerId:"marietta",
    resultText:"羁绊Lv.2：第5面苏醒，第2面品质提升为金。",
    chronicleText:`维护归来后，玛丽埃塔坐着喝完了茶，杯子由${PLAYER_NAME_TOKEN}收拾。`,
    rows:[
      ["say","marietta","庄园后续要处理的地方已经列好。等我把这边也收拾——","a"],
      ["action",`${PLAYER_NAME_TOKEN}从她手里抽走湿布，把刚倒好的茶放到原处。`],
      ["say","marietta","您会把杯口朝上留水。这样的交接并不合格。"],
      ["choice","她又要起身。",options(["按回椅背 ·「坐着。」",`${PLAYER_NAME_TOKEN}把椅背推回桌边。`,"坐着。"],["把第二只杯子倒扣 ·「你负责验收。」",`${PLAYER_NAME_TOKEN}把第二只杯子倒扣在软布上。`,"你负责验收。"],["将茶杯递给她 ·「今天不值班。」",`${PLAYER_NAME_TOKEN}把茶杯递进她手里。`,"今天不值班。"])],
      ["say","marietta","……第二只，先沥干。既然由我验收，请不要返工。","h"],
      ["action","她没有再站起来。杯子逐只归位，茶也没有凉。"],
    ],
  },
  {
    eventId:"event.growth.marietta.lv3",title:"不写在规矩里",partnerId:"marietta",
    resultText:"羁绊Lv.3：女仆长的领域进入现行，相邻交换预算由1次增至2次；没有改善时保持原位。",
    chronicleText:"玛丽埃塔约好归来后一起用餐，没有把这件事写成家规。",
    rows:[
      ["action",`${PLAYER_NAME_TOKEN}翻到清单末尾。工整的事项之后，多了一行「回来一起用餐」。`],
      ["say","marietta","只是时间提醒。免得有人把检查工具排在饭前，一直排到忘记用餐。","a"],
      ["action","她的笔尖停在「家规」一栏上方，却没有落下。"],
      ["choice","这项约定该放在哪里。",options(["合上家规册 ·「不用写。」",`${PLAYER_NAME_TOKEN}合上家规册。`,"不用写。"],["圈起用餐时间 ·「迟到的洗碗。」",`${PLAYER_NAME_TOKEN}圈起清单上的用餐时间。`,"迟到的洗碗。"],["把清单推回去 ·「按约定回来。」",`${PLAYER_NAME_TOKEN}把清单推回她面前。`,"按约定回来。"])],
      ["say","marietta","那么，请留靠里那把椅子。门边有风。","h"],
      ["action","那一行留在清单上，没有编号，也没有盖章。"],
    ],
  },
  {
    eventId:"event.demo.preparation-gift",title:"把空着的那一手用起来",partnerId:"marietta",
    resultText:"已收下备用短刃与应急药囊，各一件，存入馆内未装备库存。",
    chronicleText:"玛丽埃塔交给队伍一把备用短刃和一只应急药囊，供出征前分配。",
    rows:[
      ["say","marietta","备用短刃，应急药囊。出门前，请给需要的人带上。","a"],
      ["action",`${PLAYER_NAME_TOKEN}检查刀鞘与药囊封口。两件都只够一人携带。`],
      ["say","marietta","它们只负责补上空着的那一手，不能代替正式整备。"],
      ["choice","先决定这两件东西的用途。",options(["短刃置前 ·「先补伤害。」",`${PLAYER_NAME_TOKEN}把短刃放在分配盘前侧。`,"先补伤害。"],["药囊置前 ·「先留退路。」",`${PLAYER_NAME_TOKEN}把药囊放在分配盘前侧。`,"先留退路。"],["两件并排 ·「看空面分。」",`${PLAYER_NAME_TOKEN}把两件装备并排放好。`,"看空面分。"])],
      ["say","marietta","可以。名字请写清楚，归来后也要逐件收齐。","a"],
      ["action","短刃与药囊登记入库，等待出征前装配。"],
    ],
  },
];

export const growthStories:Record<string,GrowthStoryMeta>=Object.fromEntries(definitions.map(({rows,...meta})=>[meta.eventId,{...meta,lines:authored(meta.eventId,rows)}]));

export const teamMilestoneStory:GrowthStoryMeta={
  eventId:"story.kael.team-lv3-guard",title:"这边交给我",partnerId:null,
  resultText:"团队羁绊里程碑：勇者第4面「护卫」品质提升为金。",
  chronicleText:"下一趟的前后列各有照应，最后一处空缺也有人接手。",
  lines:authored("story.kael.team-lv3-guard",[
    ["action",`${PLAYER_NAME_TOKEN}把下一趟的安排摊在桌上。原先挤在一起的标记已经各有归属。`],
    ["say","eustice","前列我带。后列的人数，每次转向都要重报。","g"],
    ["action",`${PLAYER_NAME_TOKEN}在最后一处空缺旁放下自己的棋子。`],
    ["action","安排表被推回桌中央。没有人再需要同时守住两端。"],
  ]),
};
