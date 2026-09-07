/** Five committed checkpoints remain unchanged. Sub-lines only stage the existing ending. */
export const manorConclusionDialogue: import("./marietta-memory").AuthoredLine[][] = [
  [
    {id:"manor.end.0.0",text:"一路拆下的红线再也没有接回来。桌边的白布垂落不动，只有末席的少女还悬在半空。"},
    {id:"manor.end.0.1",characterId:"eustice",expression:"g",text:"凯尔，去吧。门口我守着……别再让她吊在那里了。"},
    {id:"manor.end.0.2",characterId:"kael",text:"好。玛丽埃塔，过来接她。我来断线。"},
  ],
  [
    {id:"manor.end.1.0",text:"红线一根根断开。裙边的银餐刀碎成细灰，少女被扯开的双臂终于垂了下来。"},
    {id:"manor.end.1.1",characterId:"elora",expression:"d",text:"……已经没事了。不会再有人逼你坐回去了。"},
  ],
  [
    {id:"manor.end.2.0",text:"玛丽埃塔上前，接住从桌裙上滑落的少女。她替少女合上双眼，将散乱的长发拢到耳后。"},
    {id:"manor.end.2.1",characterId:"marietta",expression:"h",text:"家宴结束了，小姐。您可以离席了。"},
  ],
  [
    {id:"manor.end.3.0",text:"安置好少女后，玛丽埃塔把主位的椅子推回桌下。她俯身，合上那本摊了三百年的登记簿。"},
    {id:"manor.end.3.1",characterId:"marietta",expression:"g",text:"今天没有客人。"},
    {id:"manor.end.3.2",text:"书脊合拢，闷闷一响。她的手在封皮上停了片刻，随后取下门旁的钥匙，收入自己的裙袋。"},
  ],
  [
    {id:"manor.end.4.0",text:"回到洋馆，玛丽埃塔先洗净双手，又把布丁和茶端上了桌。轮到她自己时，椅子却还推在桌下。"},
    {id:"manor.end.4.1",characterId:"kael",text:"你的茶呢？坐下，我去拿。"},
    {id:"manor.end.4.2",characterId:"marietta",expression:"a",text:"已经备好了。勇者大人，请替我拉一下椅子。"},
  ],
];

/** Marietta arrives in the authored ending; expedition companions must actually have come along. */
export function manorConclusionForParty(partyIds: readonly string[]) {
  return manorConclusionDialogue.map(lines => lines.map(line => {
    if (line.characterId === "eustice" && !partyIds.includes("eustice")) return {id:line.id,text:"凯尔回头看了一眼。来时的门没有再合上，他这才走向桌边。"};
    if (line.characterId === "elora" && !partyIds.includes("elora")) return {id:line.id,text:"少女垂着头，长发遮住了脸。凯尔放低剑尖，没有再碰她。"};
    return line;
  }));
}
