import type { mariettaMemoryScript } from "./marietta-memory";

type Node = keyof typeof mariettaMemoryScript;
const lines = (node: Node, rows: [string | null, string, string?][]) => rows.map(([characterId, text, expression], i) => ({id: `story.marietta.clockwork.${node}.${i + 1}`, ...(characterId ? {characterId, expression} : {}), text}));
/** Voices: st/setting/user/0-kael.txt and st/setting/char/*.txt. Node lengths and saved line IDs stay stable. */
export const clockworkMemoryScript: typeof mariettaMemoryScript = {
  "present-intro": lines("present-intro", [
    [null,"玛丽埃塔收起登记簿，把一碟布丁放到凯尔面前。壁炉旁的座钟咔哒一响，他手里的银匙跟着停了停。"],
    ["kael","……普通的钟听着顺耳多了。庄园里那种，会追着人敲。"],
    ["marietta","您说的是刻仪兽吧。请放心，勇者大人，这一座不会追着您走。","a"],
    ["kael","我知道。只是想起柯萝萝了……她那天非要我把钟弄哑，说吵得睡不着。"],
    ["marietta","在那种地方还能考虑午睡，倒很有那位小姐的风格。","h"],
    ["kael","她嘴上嫌麻烦，眼睛可一直盯着钟摆。那一下要是落下来，谁也别想睡了。"],
    ["marietta","看来，她还是没能睡成。后来呢，勇者大人？","a"],
    [null,"银匙碰了碰碟沿。清脆的一声，勾起了另一阵沉得多的钟鸣。"],
  ]),
  "history-opening": lines("history-opening", [
    [null,"白布垂在长廊两侧，五个人的脚步声夹在滴答声里。前方那座落地钟，忽然挪开了一条腿。"],
    ["eustice","停。诺玛，别再往前——那座钟不对劲。","g"],
    ["norma","我看见了，大小姐。啧，连钟都长腿，这宅子还讲不讲道理？","k"],
    ["elora","大家靠近一点，好吗？要是受了伤，请马上告诉我。","g"],
    ["kororo","啊——好吵。队长，能让它别敲了吗？脑袋都在跟着响。","k"],
    [null,"黑木关节贴着地砖折开，撑起沉重的钟身。胸腔里的齿轮咬合，一只黄铜摆锤缓缓抬起。"],
    ["kael","能。不过得先离那只锤子远点。"],
    ["eustice","看清楚再动！谁敢不看我的手势就往前冲，回去自己写检讨。","g"],
    [null,"摆锤升到最高处。诺玛嘴里的糖块咔嚓一碎，长廊里的滴答声停了。"],
  ]),
  teaching: lines("teaching", [
    ["kororo","……每次都要抬这么久。队长，趁它抬起来的时候打，省得陪它敲一晚上。","g"],
    ["kael","行。它一转过来，就退到我后面。"],
    ["eustice","先看它朝着谁，再准备接招。凯尔，你也一样，别仗着皮厚就拿身体试！","g"],
    ["elora","嗯。真受伤了也不许瞒着哦，药就是给大家带的。","b"],
    ["norma","听见没，BOSS？修钟可比修你便宜。它忙着抬锤，我就去找找后面的缝。","i"],
    [null,"黄铜摆锤在头顶晃了一下。凯尔握紧剑柄，等着尤斯缇丝的手势。"],
  ]),
  "history-complete": lines("history-complete", [
    [null,"齿轮卡住了。摆锤悬在半空，抖了两下，没能敲出最后一声。"],
    [null,"四条黑木腿先后折下。钟身伏在地上，头顶绷紧的红线松成了弧。"],
    ["elora","先不要走，让我看看大家。凯尔，把手给我——只是检查，也不许嫌麻烦哦。","g"],
    ["eustice","听她的。还有，检查完也不准一个人走掉，我可不想在这种地方挨个找人。","g"],
    ["norma","知道啦，大小姐。BOSS，你先忙，我看看这东西会不会诈尸。","i"],
    ["kororo","队长——我能坐一下吗？耳朵里还在响。五分钟……就五分钟嘛。","m"],
    ["kael","都歇会儿。我守着。柯萝萝，别坐那堆碎齿轮上。"],
    [null,"柯萝萝挪了半步，拢起袍角坐下。尤斯缇丝没有催她，只换了只手握剑，站到长廊外侧。"],
    [null,"那天究竟歇了几分钟，凯尔已经记不清了。他只记得，后来所有人都跟了上来。"],
  ]),
  "return-pending": lines("return-pending", [
    [null,"壁炉旁又响了一声。凯尔低头，布丁少了一角；玛丽埃塔正把他碰歪的碟子放回桌垫中央。"],
    ["kael","下次去庄园，你也一起吧。有你在，我们能少绕不少路。"],
    ["marietta","可以。工具和替换的绷带，我会提前备好。","a"],
    ["kael","好。不过到了该歇的时候，你也得歇。别趁我们坐下，又一个人去收拾走廊。"],
    ["marietta","……勇者大人，您是邀请我同行，还是打算监督我休息？","a"],
    ["kael","都算。眼下先坐，你的茶还没喝呢。"],
    ["marietta","如您所愿。也请您往里面坐一些，别让半条胳膊一直悬在桌外。","a"],
    [null,"她把椅子拉到桌边，端起自己的茶。凯尔依言挪了挪，两个人的杯碟终于都摆正了。"],
  ]),
};
