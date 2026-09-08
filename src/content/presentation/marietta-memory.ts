import type { AuthoredLine, AuthoredUserChoiceOption } from "./authored-story";
import { PLAYER_NAME_TOKEN } from "../../shared/domain/player-identity";
export type { AuthoredLine } from "./authored-story";

type Node = "present-intro" | "history-opening" | "teaching" | "history-complete" | "return-pending";
type Row = ["say",string,string,string?] | ["action",string] | ["narration",string] | ["choice",string,readonly [AuthoredUserChoiceOption,AuthoredUserChoiceOption,AuthoredUserChoiceOption]];
const options=(iron:[string,string,string?],seasoned:[string,string,string?],pragmatic:[string,string,string?])=>([
  {tone:"iron" as const,label:iron[0],action:iron[1],...(iron[2]?{line:iron[2]}:{})},
  {tone:"seasoned" as const,label:seasoned[0],action:seasoned[1],...(seasoned[2]?{line:seasoned[2]}:{})},
  {tone:"pragmatic" as const,label:pragmatic[0],action:pragmatic[1],...(pragmatic[2]?{line:pragmatic[2]}:{})},
] as const);
const lines=(node:Node,rows:readonly Row[]):AuthoredLine[]=>rows.map((row,index)=>{
  const id=`story.marietta.memory.${node}.${String(index+1).padStart(2,"0")}`;
  if(row[0]==="say")return{id,characterId:row[1],text:row[2],...(row[3]?{expression:row[3]}:{})};
  if(row[0]==="choice")return{id,kind:"user-choice",prompt:row[1],text:row[1],options:row[2]};
  return{id,kind:row[0]==="action"?"action":undefined,text:row[1]};
});

/** Legacy memory variant retained for compatible saves; its player agency follows the same authored contract. */
export const mariettaMemoryScript:Record<Node,AuthoredLine[]>={
  "present-intro":lines("present-intro",[
    ["narration","玛丽埃塔把庄园登记簿放进抽屉。指尖离开封皮时，没有带起一根线。"],
    ["say","marietta","登记簿已经合上了。勇者大人，您似乎还有事要说。","a"],
    ["choice","下一次维护的同行名单仍缺一席。",options(["推过名单 ·「你随队。」",`${PLAYER_NAME_TOKEN}把名单推到她面前。`,"你随队。"],["敲敲空白席位 ·「位置留着。」",`${PLAYER_NAME_TOKEN}敲了敲名单上的空白席位。`,"位置留着。"],["递出同行徽记 ·「一起去。」",`${PLAYER_NAME_TOKEN}递出同行徽记。`,"一起去。"])],
    ["say","marietta","如果您的意思是一起出门，请直接这么说。","h"],
    ["action","同行徽记落在合拢的登记簿上，没有被红线拖回原位。"],
    ["say","marietta","从前，您带着四位不肯擦靴子的客人，试图穿过我的回廊。","a"],
    ["say","marietta","至少现在，您还记得该在哪里停下。","a"],
    ["narration","她抬手整理袖口。记忆里的红线从同一个动作中展开。"],
  ]),
  "history-opening":lines("history-opening",[
    ["narration","回廊尽头的门紧闭着。白布垂在黑木陈设上，连褶皱都朝着同一个方向。"],
    ["say","eustice","保持距离。后列看住来路。","g"],
    ["say","norma","门缝里也有线。别指望我从旁边绕过去。","k"],
    ["say","elora","药和护符都在。需要的时候直接叫我。","g"],
    ["say","kororo","……她连人偶之间的空隙都量过。","k"],
    ["narration","娇小的女仆立在前方。黑铁鸟笼裙撑纹丝不动，笼中细小的人影无声悬浮。她是整条回廊里唯一没有沾上灰尘的人。"],
    ["say","marietta","到这里为止。请勿越过红线。","a"],
    ["choice","门在她身后，红线已经收紧。",options(["拔剑向前 ·「让路。」",`${PLAYER_NAME_TOKEN}拔剑向前。`,"让路。"],["停在线外 ·「我们去门后。」",`${PLAYER_NAME_TOKEN}停在红线之外。`,"我们去门后。"],["收剑示意同伴 ·「先听条件。」",`${PLAYER_NAME_TOKEN}压低剑尖，示意队伍停下。`,"先听条件。"])],
    ["say","marietta","那么，请各位证明自己能走到那里。","g"],
  ]),
  teaching:lines("teaching",[
    ["say","norma","看她的手。不是上面有什么东西在吊着她。","g"],
    ["say","kororo","靠着她的侍偶在替她挡力。它挪到哪里，护住的位置也跟着变。","g"],
    ["say","eustice","别追着线跑。看清她下一次把侍偶调到哪里！","g"],
    ["say","elora","大家别散得太开。红线绕过来的时候，我不一定够得到。","m"],
    ["choice","线阵开始重新排列。",options(["剑尖锁定侍偶 ·「先拆护卫。」",`${PLAYER_NAME_TOKEN}以剑尖锁定最近的侍偶。`,"先拆护卫。"],["退半步等她收线 ·「看下一阵。」",`${PLAYER_NAME_TOKEN}退开半步，等红线完成重排。`,"看下一阵。"],["让出中央 ·「两侧夹击。」",`${PLAYER_NAME_TOKEN}让出回廊中央。`,"两侧夹击。"])],
    ["narration","红线从她十指之间向外辐射。队伍没有追线，只盯住被移动的护卫与重新露出的空隙。"],
  ]),
  "history-complete":lines("history-complete",[
    ["narration","最后一具侍偶跪倒。红线没有断，只是失去了借力的支点。"],
    ["narration","通往门后的路终于露了出来。玛丽埃塔仍站得笔直，裙笼里的微缩人影却一只只闭上眼睛。"],
    ["say","eustice","道路已经打开。任何人都不准擅自追击。","g"],
    ["say","elora","她没有继续出手……先确认伤势，好吗？","m"],
    ["say","norma","BOSS，她还看着这边。可那眼神不像在等第二轮。","a"],
    ["say","kororo","好累。能不能先坐一分钟……半分钟也行。","m"],
    ["choice","红线垂落，队伍等着最后的处置。",options(["收剑 ·「到此为止。」",`${PLAYER_NAME_TOKEN}收剑入鞘。`,"到此为止。"],["切断门前余线 ·「路归我们。」",`${PLAYER_NAME_TOKEN}切断门前最后几根余线。`,"路归我们。"],["退回线外 ·「不追。」",`${PLAYER_NAME_TOKEN}退回原先的红线之外。`,"不追。"])],
    ["say","marietta","……请继续前行。门后的路，不再由我阻拦。","a"],
    ["narration",`队伍越过她时，没有人回头补上第二剑。那道被让出的路，后来一直留在${PLAYER_NAME_TOKEN}的记忆里。`],
  ]),
  "return-pending":lines("return-pending",[
    ["narration","回忆退回壁炉边。玛丽埃塔把碰歪的茶碟推回桌垫中央。"],
    ["say","marietta","如今的庄园已经不同。维护路线仍可以缩短。","a"],
    ["choice","同行名单就在桌边。",options(["把名单递给她 ·「你来带路。」",`${PLAYER_NAME_TOKEN}把名单递给她。`,"你来带路。"],["将工具袋放到她脚边 ·「别再留守。」",`${PLAYER_NAME_TOKEN}把工具袋放到她脚边。`,"别再留守。"],["拉开身边座位 ·「先坐，再商量。」",`${PLAYER_NAME_TOKEN}拉开身边的座位。`,"先坐，再商量。"])],
    ["say","marietta","可以。工具与替换绷带，我会提前备好。","a"],
    ["action","她在名单上写下自己的名字，又刻意绕开了家规册。"],
    ["say","marietta","这一次，我会作为同行者出发。不是庄园的执行人。","h"],
    ["action",`${PLAYER_NAME_TOKEN}把她的茶推近，给墨迹留下晾干的时间。`],
    ["narration","她端起茶杯。名单没有被收走，新的席位也没有被任何红线吊住。"],
  ]),
};
