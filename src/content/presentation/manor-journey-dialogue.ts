import type { AuthoredLine } from "./marietta-memory";

type Line = Omit<AuthoredLine, "id">;
type Voice = "kael" | "eustice" | "elora" | "kororo" | "norma" | "marietta";
type Voices = Record<Voice, [text: string, expression: string]>;
export type ManorScene = "register-intro" | "seats-intro" | "relic-intro" | "register-read" | "seats-read" | "relic-kept" | "relic-lost" | "exit";
const say = (characterId: string, text: string, expression = "a"): Line => ({characterId,text,expression});

/** A missing companion selects another authored voice, never the same line under another name. */
export function manorJourneyDialogue(scene: ManorScene, partyIds: string[], actorId: string | null, canContinue: boolean): Line[] {
  const voice = (preferred: string, variants: Voices): Line => {
    const id = (partyIds.includes(preferred) && preferred in variants ? preferred : partyIds.find(id => id !== "kael" && id in variants) ?? "kael") as Voice;
    return say(id,...variants[id]);
  };
  if (scene === "register-intro") return [
    {text:"接待台上摊着一本厚厚的登记簿。纸页泛黄，宾客栏的墨迹却还湿着。"},
    voice("kororo",{
      kororo:["还要看书啊……队长帮我翻页。沾墨的地方别碰，感觉不太好。","k"],
      eustice:["先别乱翻。这种宅邸的迎宾簿通常不只是摆设，尤其是墨还没干的时候。","g"],
      elora:["凯尔，你看……这里刚添过名字呢。可是，我们一路都没遇到活人呀。","m"],
      norma:["BOSS，这可新鲜了。人都没了，账还在记。要不看看谁欠了饭钱？","i"],
      marietta:["勇者大人，请从这一页看起。纸边已经脆了，我替您翻。","a"],
      kael:["墨还没干。先看看写了什么，别把自己的名字添上去。","a"],
    }),
    say("kael","只看，不签。我们不是来赴宴的。"),
  ];
  if (scene === "seats-intro") return [
    {text:"一张席位表压在银烛台下。座次排得密密麻麻，最上方的主人席却空着一格。"},
    voice("eustice",{
      eustice:["连座次都排好了，主人的名字却不写？……先看清楚，谁也不准随便坐下。","g"],
      elora:["椅子摆得这么整齐……真的还在等人来吗？","d"],
      kororo:["明明摆了这么多椅子，却一张都不能坐。真小气……队长，看看它到底在等谁嘛。","k"],
      norma:["一屋子空盘子，还得按座次坐。BOSS，这顿饭咱们可吃不起。","i"],
      marietta:["座次表还在原处。勇者大人，请站着看，暂时不要碰这些椅子。","g"],
      kael:["主人席还空着。别坐下，先看看这些名字。","a"],
    }),
    say("kael","嗯，椅子留给它们。我们看看就走。"),
  ];
  if (scene === "relic-intro") return [
    {text:"一只旧匣子歪在桌脚边，露出半截褪色的缎带。几根红线穿过匣扣，随着脚步声轻轻绷紧。"},
    voice("elora",{
      elora:["等等，里面的东西还没坏呢。小心一点的话……应该能拿出来吧？","m"],
      eustice:["别直接拽。匣扣上还有线，弄断了，里面的东西也未必保得住。","g"],
      kororo:["好麻烦的结……队长，先别碰。扯错一根，后面就全白忙了。","k"],
      norma:["先说好，BOSS，拿了会咬人的东西可不算赚。让我看看扣子底下。","g"],
      marietta:["是旧宅留下的物件。请稍等，不能连着缎带一起剪断。","g"],
      kael:["还能取出来。不过不能硬扯，得把线慢慢松开。","a"],
    }),
    say("kael","想试就试，别勉强。东西坏了，总比手伤了好。"),
  ];
  if (scene === "register-read") return [
    {text:"凯尔把登记簿翻到执行者那一页。「玛丽埃塔·克雷格」——这个名字写得端端正正。至于谁能宣布散席，簿子上没有。"},
    voice("kororo",{
      kororo:["准备、迎接、补座……全是要她干的事。让她停下来的那一句，倒是没写。真会使唤人。","k"],
      eustice:["只写了她必须做什么，却没给她停止的权利。……这算哪门子的任命书。","k"],
      elora:["连说一句『可以休息了』的人，都没有了吗……","d"],
      norma:["这活可够黑的。要你一直干，散伙还得等老板点头。BOSS，你可别学。","k"],
      marietta:["是的。命我备好家宴的人，已经不在了。可这本簿子不认讣告，只认主人的吩咐。","g"],
      kael:["让她准备家宴的人已经不在了，却把这个命令留了下来。","a"],
    }),
    say("kael","人都不在了，哪还有人来散席。走吧，把吊着那些东西的线拆掉。"),
  ];
  if (scene === "seats-read") return [
    {text:"席位表上，「举杯」和宾客的名字被细线连在一起。桌边少一个宾客，对应的那根线就暗一分。"},
    voice("kororo",{
      kororo:["唔，难怪坐得越满，动静越大。队长，先把旁边的椅子清掉，省力。","g"],
      eustice:["原来如此。先清理她身边的宾客，别让整张桌子的力量都压过来。","g"],
      elora:["这些线都往她那边连……旁边空下来，她举杯的时候就不会那么厉害了吧？","m"],
      norma:["BOSS，我有个便宜办法。先把陪酒的请出去，省得她越喝越来劲。","i"],
      marietta:["宾客的线都接在主位上。先让他们离席，举杯时传来的力量就会弱下去。","g"],
      kael:["先让她身边空下来。那一杯就没那么重了。","a"],
    }),
    say("kael","就这么办。她自己也被线吊着……看清楚，别把她当成操纵这一切的人。"),
  ];
  if (scene === "relic-kept" || scene === "relic-lost") {
    const failed = scene === "relic-lost";
    const reply = voice(actorId ?? "elora",failed ? {
      kael:["……晚了一点。别靠过来，边上还有碎片。","a"],
      eustice:["可恶……最后那个结还是收紧了。别伸手，碎片让我来收。","k"],
      elora:["对不起……我明明已经很小心了。","d"],
      kororo:["……好烦。就差一点。队长，先别碰，线还没松干净。","k"],
      norma:["啧，白忙活。BOSS，搭进去的那点钱就当买个教训吧。","k"],
      marietta:["……没能保住。请退后些，我把碎片处理好。","g"],
    } : {
      kael:["出来了。拿块干净的布，别让这些边角磨着。","a"],
      eustice:["好了。解这种结当然要有耐心——拿稳，别又摔了。","l"],
      elora:["取出来了……！凯尔，你看，里面一点也没坏呢。","c"],
      kororo:["好啦。队长拿着，手举这么久，好酸……","a"],
      norma:["到手。BOSS，这手艺值不值一份额外的点心？","l"],
      marietta:["还好，缎带也保住了。请拿稳，我用软布裹一下。","a"],
    });
    return [
      {text:failed ? "匣扣忽然咬紧，里面传来一声细碎的裂响。等红线松开，已经迟了。" : "最后一个线结松开，匣盖轻轻弹起。里面的东西被一件件取出，放在干净的布上。"},
      reply,
      reply.characterId === "kael" ? {text:"队伍在一旁等着，直到凯尔收好东西，才重新往前走。"} : say("kael",failed ? "手没伤着就好。别捡了，剩下的我来。" : "拿稳了。先歇口气，东西也不会跑。"),
    ];
  }
  return [
    {text:"两扇屏风门缓缓分开。来时的走廊露了出来，地上的红线不再追着脚踝收紧。"},
    voice("eustice",{
      eustice:["退路打通了。先把气喘匀，再决定往哪走。没人会因为回去休整就丢了脸面。","g"],
      elora:["终于能回去了……凯尔，先看看大家还能不能走，好吗？","g"],
      kororo:["队长，看见没有？回去的路——再往里走之前，至少让柯萝萝坐一会儿嘛。","m"],
      norma:["BOSS，现在收工，袋子里的东西可都是咱们的。往前走就得再赌一把了。","i"],
      marietta:["门已经打开了。勇者大人，请先确认各位的状态，再决定是否继续。","a"],
      kael:["退路通了。先歇一下，我看看大家的情况。","a"],
    }),
    say("kael",canContinue ? "嗯。再往里就得走到底了，有谁撑不住，现在就说。" : "到这里就够了。收好东西，我们回去。"),
  ];
}
