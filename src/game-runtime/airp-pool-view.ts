import type { D5GameRecord } from "../game-application";
import type { AirpFrame, AirpPoolContent, AirpPoolState } from "../game-core/contracts";
import { airpActorLocation, airpPoolActive, airpPoolLocked, airpPoolReadingInstance } from "../game-core/session";
import { airpAtHome } from "../game-application/versions/airp-replay";
import { airpOnlineBusy, airpOnlineHidden } from "../game-application/airp/gameplay";

export const AIRP_ACTOR_NAMES: Record<string, string> = { elora: "艾洛拉", eustice: "尤斯缇丝", norma: "诺玛", kororo: "柯萝萝" };
export function airpPoolView(content: AirpPoolContent, state: AirpPoolState, record: D5GameRecord) {
  const c = record.snapshot.campaign, atHome = airpAtHome(c);
  const historicalFacts = [...record.facts];
  let ancestor = record.originRef?.source;
  for (let depth = 0; ancestor?.schemaVersion === 4 && depth < 8; depth++, ancestor = ancestor.originRef?.source) historicalFacts.push(...ancestor.facts);
  const locationFor = (actor: string) => airpActorLocation(content, actor, c.clock.phase, c.availableCharacterIds, atHome);
  const entries = state.instances.map(instance => {
    const card = content.cards.find(d => d.id === instance.definition.id)!, form = card.objective.form;
    const target = card.objective.form === "liaison" ? card.objective.targetActorId : null;
    const item = card.objective.form === "sortie" ? card.objective.itemLabel : null;
    const objective = instance.status === "pending" || instance.status === "offered" ? `${AIRP_ACTOR_NAMES[card.giverId]}有一件小事想和你说。`
      : instance.status === "closed" ? instance.reason === "missed" ? "这件事已有后续，可以看看告示角的近况。" : instance.reason === "reserved" ? "未曾呈现的便条已收进备用库。" : "这一次已经结束。"
      : instance.status === "resolved" ? "事情已收尾，记忆已经留下。"
      : instance.status === "ready" ? `回公共休息室找${AIRP_ACTOR_NAMES[card.giverId]}收尾。`
      : form === "sortie" && card.objective.form === "sortie" ? instance.carryFactId ? `${item}已收好，请成功归来。` : `下次庄园巡守：第${card.objective.spec.objective.layer}层，寻找${item}。`
      : target ? `把便条带给${AIRP_ACTOR_NAMES[target]}，读完这次专属对话。` : "完成手边的小事。";
    const history = state.scenes.filter(s => s.instanceId === instance.id && !["departure", "found"].includes(s.role) && !airpOnlineHidden(record.airpOnline?.entries.find(e => e.sceneId === s.id)) && !record.airpDirect?.tasks.some(t => t.sceneId === s.id && (t.source === "undecided" || t.source === "requested"))).map(scene => {
      const commands = historicalFacts.flatMap(f => f.kind === "airp" && f.source.saveId === scene.sourceHead.saveId && f.source.epoch === scene.sourceHead.epoch && "sceneId" in f.payload.command && f.payload.command.sceneId === scene.id ? [f.payload.command] : []);
      const lastRead = Math.max(-1, ...commands.map(c => scene.body.nodes.findIndex(n => n.id === c.nodeId)));
      const choice = commands.find(c => c.type === "airp-accept"); const selected = choice?.type === "airp-accept" ? choice.optionId : null;
      const transcript = scene.body.nodes.slice(0, lastRead + (scene.source === "browser-direct" ? 1 : 2)).flatMap<AirpFrame>(n => n.kind === "beat" ? n.frames : n.kind === "branch" ? selected ? n.variants[selected] : [] : selected ? [{ id: n.id, kind: "narration", text: `已选行动：${n.options.find(o => o.id === selected)!.label}` }] : []);
      return { id: scene.id, role: scene.role, phase: scene.phase, transcript };
    });
    return { card, instance, objective, title: card.title, giver: AIRP_ACTOR_NAMES[card.giverId], target, targetName: target ? AIRP_ACTOR_NAMES[target] : null,
      visitLocation: target ? locationFor(target) : null, history,
      canFollowup: !!record.airpOnline && instance.status === "resolved" && !!locationFor(card.giverId) && !airpPoolLocked(state) && !airpOnlineBusy(record.airpOnline) && record.airpOnline.entries.some(e => e.instanceId === instance.id && e.task === "return" && e.accepted && e.controlReceipt) && !record.airpOnline.entries.some(e => e.instanceId === instance.id && e.task === "followup"),
      canDirectFollowup: !!record.airpDirect && instance.status === "resolved" && !!locationFor(card.giverId) && !airpPoolLocked(state)
        && record.airpDirect.tasks.some(t => t.instanceId === instance.id && t.task === "return" && t.memoryId) && !record.airpDirect.tasks.some(t => t.instanceId === instance.id && t.task === "followup"),
      canOpen: !!locationFor(card.giverId) && (instance.status === "pending" || instance.status === "offered" || instance.status === "ready" || instance.status === "closed" && (instance.reason === "missed" || instance.reason === "expired-seen")),
    };
  });
  const patrol = entries.find(e => e.card.objective.form === "sortie" && ["accepted", "ready"].includes(e.instance.status));
  const current = airpPoolLocked(state) ? airpPoolReadingInstance(state) : null;
  const entry = entries.find(e => e.instance.id === current?.id) ?? patrol ?? entries.find(e => airpPoolActive(e.instance)) ?? entries[0] ?? null;
  const binding = patrol?.instance.binding ?? null, carrying = !!patrol?.instance.carryFactId;
  const cue = binding ? state.scenes.filter(s => s.instanceId === patrol!.instance.id && s.role === (carrying ? "found" : "departure") && s.sourceHead.revision >= binding.departureHead.revision).at(-1) : null;
  return { version: 2 as const, title: entry?.title ?? "洋馆涟漪", location: "洋馆 · 公共休息室", phase: c.clock,
    instance: entry?.instance ?? null, objective: entry?.objective ?? null, binding, carrying, locked: airpPoolLocked(state), canOpen: entry?.canOpen ?? false,
    scene: state.scenes.find(s => s.id === state.reading?.sceneId) ?? null, reading: state.reading,
    online: record.airpOnline ?? null, onlineEntry: record.airpOnline?.entries.find(e => e.sceneId === state.reading?.sceneId) ?? null,
    direct: record.airpDirect ?? null,
    cue: cue?.body.nodes.flatMap(n => n.kind === "beat" ? n.frames.map(f => f.text) : []).join("\n") ?? null,
    entries, current: entry, patrol, memories: state.memories, cooldowns: state.cooldowns, reserveCount: state.reserve.length, capacityStopped: state.capacityStopped };
}
export type AirpPoolView = ReturnType<typeof airpPoolView>;
