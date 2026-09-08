import type { AuthoredLine, AuthoredUserChoiceOption } from "./authored-story";
import { PLAYER_NAME_TOKEN } from "../../shared/domain/player-identity";

type Node = "present-intro" | "history-opening" | "teaching" | "history-complete" | "return-pending";
type Row = ["say",string,string,string?] | ["action",string] | ["narration",string] | ["choice",string,readonly [AuthoredUserChoiceOption,AuthoredUserChoiceOption,AuthoredUserChoiceOption]];
const options=(iron:[string,string,string?],seasoned:[string,string,string?],pragmatic:[string,string,string?])=>([
  {tone:"iron" as const,label:iron[0],action:iron[1],...(iron[2]?{line:iron[2]}:{})},
  {tone:"seasoned" as const,label:seasoned[0],action:seasoned[1],...(seasoned[2]?{line:seasoned[2]}:{})},
  {tone:"pragmatic" as const,label:pragmatic[0],action:pragmatic[1],...(pragmatic[2]?{line:pragmatic[2]}:{})},
] as const);
const lines=(node:Node,rows:readonly Row[]):AuthoredLine[]=>rows.map((row,index)=>{
  const id=`story.marietta.clockwork.${node}.${index+1}`;
  if(row[0]==="say")return{id,characterId:row[1],text:row[2],...(row[3]?{expression:row[3]}:{})};
  if(row[0]==="choice")return{id,kind:"user-choice",prompt:row[1],text:row[1],options:row[2]};
  return{id,kind:row[0]==="action"?"action":undefined,text:row[1]};
});

/** Current Marietta memory. Node lengths stay aligned with the saved D5 cursors. */
export const clockworkMemoryScript:Record<Node,AuthoredLine[]>={
  "present-intro":lines("present-intro",[
    ["narration",`玛丽埃塔收起登记簿，把一碟布丁放到${PLAYER_NAME_TOKEN}面前。壁炉旁的座钟咔哒一响，银匙停在了半空。`],
    ["say","marietta","请放心，勇者大人。这一座钟不会追着您走。","a"],
    ["choice","熟悉的钟声把旧事带了回来。",options(["压住钟摆 ·「让它停。」",`${PLAYER_NAME_TOKEN}起身压住钟摆。`,"让它停。"],["敲一下碟沿 ·「还是这个顺耳。」",`${PLAYER_NAME_TOKEN}用银匙轻敲碟沿。`,"还是这个顺耳。"],["放下银匙 ·「想起庄园了。」",`${PLAYER_NAME_TOKEN}放下银匙。`,"想起庄园了。"])],
    ["say","marietta","您说的是刻仪兽。那次，柯萝萝小姐似乎格外介意钟声。","h"],
    ["narration","记忆里，她嘴上嫌麻烦，眼睛却一直没有离开抬起的摆锤。"],
    ["say","marietta","在那种地方还能惦记午睡，确实很有她的风格。","h"],
    ["say","marietta","后来呢，勇者大人？","a"],
    ["action","银匙碰了碰碟沿。清脆的一声，勾起了另一阵沉得多的钟鸣。"],
  ]),
  "history-opening":lines("history-opening",[
    ["narration","白布垂在长廊两侧，五个人的脚步声夹在滴答声里。前方那座落地钟，忽然挪开了一条腿。"],
    ["say","eustice","停。诺玛，别再往前——那座钟不对劲。","g"],
    ["say","norma","我看见了，大小姐。啧，连钟都长腿，这宅子还讲不讲道理？","k"],
    ["say","elora","大家靠近一点。要是受了伤，请马上告诉我。","g"],
    ["say","kororo","啊——好吵。队长，能让它别敲了吗？脑袋都在跟着响。","k"],
    ["narration","黑木关节贴着地砖折开，撑起沉重的钟身。胸腔里的齿轮咬合，一只黄铜摆锤缓缓抬起。"],
    ["choice","摆锤开始寻找第一名目标。",options(["拔剑挡在前列 ·「散开。」",`${PLAYER_NAME_TOKEN}拔剑挡在前列。`,"散开。"],["敲墙打乱钟声 ·「看它朝哪转。」",`${PLAYER_NAME_TOKEN}用剑柄敲响侧墙。`,"看它朝哪转。"],["退到队伍中央 ·「先看手势。」",`${PLAYER_NAME_TOKEN}退到队伍中央。`,"先看手势。"])],
    ["say","eustice","看清楚再动！谁敢不看我的手势就往前冲，回去自己写检讨。","g"],
    ["narration","摆锤升到最高处。诺玛嘴里的糖块咔嚓一碎，长廊里的滴答声停了。"],
  ]),
  teaching:lines("teaching",[
    ["say","kororo","……每次都要抬这么久。队长，趁它抬起来的时候打，省得陪它敲一晚上。","g"],
    ["say","eustice","先看它朝着谁，再准备接招。谁都别拿身体试它的分量！","g"],
    ["say","elora","真受伤了也不许瞒着。药就是给大家带的。","b"],
    ["say","norma","听见没，BOSS？修钟可比修你便宜。它忙着抬锤，我去找后面的缝。","i"],
    ["choice","队伍等着下一道命令。",options(["剑尖指向钟腿 ·「先断支点。」",`${PLAYER_NAME_TOKEN}以剑尖标出前侧钟腿。`,"先断支点。"],["等摆锤转向 ·「它抬锤再动。」",`${PLAYER_NAME_TOKEN}压低剑身，等摆锤转向。`,"它抬锤再动。"],["向后让出通路 ·「诺玛先走。」",`${PLAYER_NAME_TOKEN}向后让出一条窄路。`,"诺玛先走。"])],
    ["narration","黄铜摆锤在头顶晃了一下。所有人都等到尤斯缇丝的手势落下，才同时动了起来。"],
  ]),
  "history-complete":lines("history-complete",[
    ["narration","齿轮卡住了。摆锤悬在半空，抖了两下，没能敲出最后一声。"],
    ["narration","四条黑木腿先后折下。钟身伏在地上，头顶绷紧的红线松成了弧。"],
    ["say","elora","先别走，让我看看大家。队长，把手给我——只是检查，也不许嫌麻烦。","g"],
    ["say","eustice","听她的。检查完也不准一个人走掉，我可不想在这种地方挨个找人。","g"],
    ["say","norma","知道啦，大小姐。BOSS，你先忙，我看看这东西会不会诈尸。","i"],
    ["say","kororo","队长——我能坐一下吗？耳朵里还在响。五分钟……就五分钟嘛。","m"],
    ["choice","钟廊暂时安静，队伍仍等着决定。",options(["剑横在钟前 ·「原地休整。」",`${PLAYER_NAME_TOKEN}把剑横放在残骸前。`,"原地休整。"],["踢开碎齿轮 ·「坐远一点。」",`${PLAYER_NAME_TOKEN}踢开滚到脚边的碎齿轮。`,"坐远一点。"],["靠墙坐下 ·「我守第一班。」",`${PLAYER_NAME_TOKEN}靠墙坐下，仍握着剑。`,"我守第一班。"])],
    ["narration","柯萝萝挪开半步，拢起袍角坐下。尤斯缇丝没有催她，只换了只手握剑，站到长廊外侧。"],
    ["narration",`那天究竟歇了几分钟，${PLAYER_NAME_TOKEN}已经记不清了。留下来的只有所有人重新起身时，钟廊里重新叠在一起的脚步声。`],
  ]),
  "return-pending":lines("return-pending",[
    ["narration",`壁炉旁又响了一声。${PLAYER_NAME_TOKEN}低头时，布丁已经少了一角；玛丽埃塔正把碰歪的碟子放回桌垫中央。`],
    ["say","marietta","回忆已经结束了。您似乎还有别的事要说。","a"],
    ["choice","下一次庄园维护需要一名熟悉旧宅的人。",options(["推过出征名单 ·「你随队。」",`${PLAYER_NAME_TOKEN}把出征名单推到她面前。`,"你随队。"],["在名单旁留出空位 ·「这次别留守。」",`${PLAYER_NAME_TOKEN}在名单旁留出一个空位。`,"这次别留守。"],["递出同行徽记 ·「一起去。」",`${PLAYER_NAME_TOKEN}递出同行徽记。`,"一起去。"])],
    ["say","marietta","可以。工具和替换绷带，我会提前备好。","a"],
    ["action","同行徽记被她收进登记簿内页，没有归入任何值班表。"],
    ["say","marietta","不过，您究竟是邀请我同行，还是打算监督我休息？","h"],
    ["action",`${PLAYER_NAME_TOKEN}把她那杯已经微凉的茶推近了一些。`],
    ["narration","她没有继续追问。椅子被拉到桌边，两个人的杯碟终于都摆正了。"],
  ]),
};
