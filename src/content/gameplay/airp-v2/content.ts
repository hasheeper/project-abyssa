import type { AirpCard, AirpFrame, AirpPoolContent, AirpPoolRole, AirpScript, AirpScriptNode, AirpSortieDefinition } from "../../../game-core/contracts";
import { AIRP_CATALOG_DATA } from "../demo-v8/content";
import { FIRST_AIRP_ERRAND } from "../airp-v1/first-errand";

// Authoring drafts, not new canon. Public role baselines: st/setting/char/2-*.txt
// and docs/design/DEMO_DIALOGUE_VOICE_GUIDE.md. No player dialogue or asset rewards.
const scripts: Record<string, AirpScript> = {};
type Line = string | [actor: string, text: string];
function script(card: AirpCard, role: string, lines: Line[], choices?: [string, string, string]) {
  const id = `airp.pool.${card.id}.${role}`, sectionId = `${id}.section`;
  const frame = (id: string, line: Line): AirpFrame => typeof line === "string" ? { id, kind: "narration", text: line } : { id, kind: "dialogue", actorId: line[0], emotion: "neutral", text: line[1] };
  const nodes: AirpScriptNode[] = lines.map((line, cursor) => ({ id: `${id}.${cursor}`, cursor, sectionId, kind: "beat", frames: [frame(`${id}.${cursor}`, line)] }));
  if (choices) nodes.push({ id: `${id}.decision`, cursor: nodes.length, sectionId, kind: "choice", prompt: "你打算怎么做？", options: choices.map((label, i) => ({ id: (["A", "B", "C"] as const)[i], label })) });
  scripts[id] = { schemaVersion: 1, id, title: card.title, locale: "zh-CN", player: { actorId: "kael", nameToken: "{{user}}", authoredSpeech: false },
    presentation: { stagePreset: "mansion-morning", backgroundId: "mansion.first-morning", defaultMode: "adv", allowRp: false, initialSlots: { left: card.giverId } },
    cast: ["kael", ...card.actorIds], sections: [{ id: sectionId, title: card.title }], nodes };
  card.scenes[role as keyof AirpCard["scenes"]] = id;
}
const cards: AirpCard[] = [];
function card(id: string, title: string, actors: string[], objective: AirpCard["objective"], themeKey: string, summary: string, aftermath: string | null = null): AirpCard {
  const d: AirpCard = { id, title, version: 1, tier: "ripple", themeKey, tags: [themeKey], actorIds: actors, giverId: actors[0], objective,
    offerPhases: aftermath ? 4 : 8, volatility: aftermath ? "consequential" : "inert", cooldownPhases: 256, repeat: objective.form === "sortie" ? "once" : "after-cooldown", scenes: {}, summary, aftermath };
  cards.push(d); return d;
}
function common(d: AirpCard, offer: Line[], choices?: [string, string, string]) {
  script(d, "offer", offer, choices);
  script(d, "offer-reserve", ["这件尚未托付出去的小事，又被写进了手边的便条。", ...offer], choices);
  script(d, "declined", [[d.giverId, "那就先放着吧。你去忙你的。"]]);
  script(d, "expired", ["桌上的便条已经收起。这一次没有再提。"]);
  if (d.aftermath) script(d, "aftermath", ["公共休息室的告示角添了一张近况便条。", d.aftermath]);
}

// The original handwritten chain retains its authored text in the new pool.
const first = card(FIRST_AIRP_ERRAND.id, FIRST_AIRP_ERRAND.title, ["elora"], { form: "sortie", spec: structuredClone(FIRST_AIRP_ERRAND), itemLabel: "空药箱" }, FIRST_AIRP_ERRAND.themeKey, "玩家把旧庄园的空药箱交给了艾洛拉。");
if (AIRP_CATALOG_DATA.airp?.version !== 1) throw Error("Expected frozen content 8");
for (const [role, id] of Object.entries(FIRST_AIRP_ERRAND.scenes)) {
  scripts[id] = structuredClone(AIRP_CATALOG_DATA.airp.scripts[id]); first.scenes[role as AirpPoolRole] = id;
}
const caseOptions: [string, string, string] = ["把药箱列进这趟巡守的目标。", "先清出安全的路，再取药箱。", "取到药箱，优先从侧门撤回。"];
script(first, "offer-reserve", [["elora", "箱子还没有托人去取。您下次路过勤务走廊，能帮我看看吗？我要的只是空箱子。"]], caseOptions);
script(first, "offer-setback", [["elora", "上次巡路不顺，先别赶。空药箱还在勤务走廊，等准备好了再说。"]], caseOptions);

function sortie(id: string, title: string, actor: string, layer: number, item: string, offer: Line[], found: string, returned: Line[]) {
  const spec: AirpSortieDefinition = { ...structuredClone(FIRST_AIRP_ERRAND), id, title, actorIds: [actor], themeKey: `patrol.${id}`, tags: [`patrol.${id}`], reward: { kind: "memory-only", memoryKey: `memory.${id}` },
    objective: { ...FIRST_AIRP_ERRAND.objective, layer, roomDefinitionId: `room.old-manor.maintenance.layer-${layer}`, evidenceId: `evidence.${id}` } };
  const d = card(id, title, [actor], { form: "sortie", spec, itemLabel: item }, spec.themeKey, `玩家成功归来，把${item}交给了${actor === "eustice" ? "尤斯缇丝" : "诺玛"}。`);
  const options: [string, string, string] = ["把这件事列入巡路安排。", "先确认路况，再去找。", "取到以后，优先从侧门返回。"];
  common(d, offer, options);
  script(d, "offer-setback", ["上一趟巡守的失利还记在归来簿上。便条被推到整备表旁，没有催人立刻出发。", ...offer], options);
  script(d, "departure", [`便条夹进巡路簿：第${layer}层，留意${item}。`]);
  script(d, "found", [found]);
  script(d, "retry", [[actor, "这次先到这里。东西没带回来，下回准备好了再找。"]]);
  script(d, "return-extracted", ["侧门归来的巡路记录和带回的物件，一起放到了委托人面前。", ...returned]);
  script(d, "return-cleared", ["完整巡路的记录和带回的物件，一起放到了委托人面前。", ...returned]);
  spec.scenes = Object.fromEntries(Object.keys(FIRST_AIRP_ERRAND.scenes).map(role => [role, d.scenes[role as AirpPoolRole]!])) as AirpSortieDefinition["scenes"];
}
sortie("ripple.eustice.route-board", "没擦干净的巡路板", "eustice", 2, "旧巡路板",
  [["eustice", "旧庄园第二段巡路上挂着一块小木板。字看不清了，板子倒还结实。"], ["eustice", "带回来吧。每次把整备表压在茶杯下面，像什么样子。"]],
  "门后的小木板上还留着粉笔灰。你解下挂绳，把板子收进包里。",
  ["尤斯缇丝擦过木板，角落的旧字迹仍留了一点。", ["eustice", "行，边上还能写日期。杯子终于能拿来喝水了。"]]);
sortie("ripple.norma.canvas-sample", "窗边的旧帆布", "norma", 3, "旧帆布边角",
  [["norma", "BOSS，勤务走廊窗边那块旧帆布，替我捎个松下来的边角？"], ["norma", "我想看看它怎么织的。只拿落下来的，别为了块布去拆窗。"]],
  "窗下有一片脱落的帆布边角。经纬还完整，你抖掉浮灰，将它折好收起。",
  [["norma", "还真挺密。难怪我拿普通布试，总漏风。"], "她把边角摊在自己的碎布旁，拿指甲逐根拨开线头。", ["norma", "这块留着作样子。谢啦，BOSS。"]]);

const bell = card("ripple.elora.watch-note", "两张不同的整备表", ["elora", "eustice"], { form: "liaison", targetActorId: "eustice" }, "house.watch-arrangement", "玩家把艾洛拉的整备便条带给尤斯缇丝，双方核对了记录。", "艾洛拉已经自己找尤斯缇丝核对整备表。两人在告示上划掉了旧的一行，没有再等人传话。");
common(bell, [["elora", "这两张整备表，抄的好像不是同一版。能帮我把这一张交给尤斯缇丝吗？"], ["elora", "请她在原纸上核一下就好，我怕再抄一次，又抄错。"]], ["接过便条，去找尤斯缇丝核对。", "把两处不同圈出来，再送过去。", "保留原纸，直接请她确认。"]);
script(bell, "target", ["你把艾洛拉的便条交到尤斯缇丝手上。", ["eustice", "果然。这个圈是我改过的，墨水太浅了。"], "她把那一行重新描清，折好纸交还给你。"]);
script(bell, "complete", ["描清的便条放回艾洛拉桌上。", ["elora", "现在看清了。谢谢您来回跑一趟。"]]);
const pencil = card("ripple.kororo.pencil-note", "被夹在书里的铅笔", ["kororo", "norma"], { form: "liaison", targetActorId: "norma" }, "house.return-pencil", "玩家替柯萝萝把找到铅笔的便条交给诺玛，并带回她的答复。");
common(pencil, [["kororo", "队长——告诉诺玛，铅笔在我这。夹在书里，没被我拿去画阵。"], ["kororo", "写好了，便条带走就行。我不下楼。"]], ["带上便条去找诺玛。", "先确认书名，再去传话。", "直接把写好的便条送过去。"]);
script(pencil, "target", ["诺玛看过便条，拍了拍空着的笔袋。", ["norma", "我说怎么少一支。行，等会儿我自己找她拿。"]]);
script(pencil, "complete", ["你把诺玛的答复带了回来。", ["kororo", "那我放桌边。……队长别顺手收进抽屉，我会忘。"]]);
const cloth = card("ripple.elora.fold-cloths", "总是散开的布卷", ["elora"], { form: "household", actionLabel: "帮艾洛拉分好布卷" }, "house.fold-clean-cloths", "玩家与艾洛拉一起分好了洗净的布卷。");
common(cloth, ["洗净的布卷刚摞起来，最底下一卷又滚了出来。", ["elora", "可以帮我按住这一边吗？我把带子从下面穿过去。"]], ["按住布卷，让她穿好带子。", "先按大小分开，再一起绑好。", "留出常用的两卷，把其余绑好。"]);
script(cloth, "complete", ["两人的手先后松开，布卷这次没有散。", ["elora", "好了。一个人总少一只手。"]]);
const cord = card("ripple.norma.drying-cord", "晾布绳上的死结", ["norma"], { form: "household", actionLabel: "帮诺玛解开绳结" }, "house.untie-drying-cord", "玩家替诺玛扶住绳头，两人解开了晾布绳上的死结。", "诺玛后来请尤斯缇丝帮忙，解开了晾布绳。告示角贴着一小截拆下的旧绳，旁边写着「下次别拉这么紧」。");
common(cord, [["norma", "这个结越拉越紧。BOSS，帮我撑住绳头？我得腾出手挑它。"]], ["撑住绳头，让她挑开结。", "先松开另一头，再一起解。", "固定绳头，从最外一圈慢慢挑。"]);
script(cord, "complete", ["绳结突然松开，诺玛差一点收不住手。", ["norma", "呼。省下一段好绳子，不用拿刀了。"]]);
const quiet = card("ripple.kororo.quiet-cup", "杯沿的一点热气", ["kororo"], { form: "vignette", actionLabel: "坐一会儿，然后离开" }, "house.quiet-warm-cup", "玩家在柯萝萝身边安静地坐了一会儿，看杯口的热气散去。");
common(quiet, ["柯萝萝把热杯子往掌心里拢了拢，给你腾出半张椅子。", ["kororo", "没事要帮忙。坐就行。"], "屋里静了一会儿。杯沿的热气散开，她也没有再找话说。"]);

/** Shared AIRP appointment rule, deliberately limited to the four unlocked companions.
 * All four companions accept these small appointments in the common room at every phase.
 * This is not the decorative estate's full room/production simulation. */
export const AIRP_POOL_CONTENT: AirpPoolContent = {
  version: 2, cards, scripts, locations: { "mansion.common-room": "洋馆 · 公共休息室" },
  availability: {
    elora: { dawn: "mansion.common-room", day: "mansion.common-room", dusk: "mansion.common-room", night: "mansion.common-room" },
    eustice: { dawn: "mansion.common-room", day: "mansion.common-room", dusk: "mansion.common-room", night: "mansion.common-room" },
    norma: { dawn: "mansion.common-room", day: "mansion.common-room", dusk: "mansion.common-room", night: "mansion.common-room" },
    kororo: { dawn: "mansion.common-room", day: "mansion.common-room", dusk: "mansion.common-room", night: "mansion.common-room" },
  },
  scheduler: { dailyOffers: 4, maxOpen: 4, maxPerForm: 1, formOrder: ["sortie", "liaison", "household", "vignette"] },
};
