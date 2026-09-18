import type { D5GameRecord } from "../game-application";
import { airpAtHome, airpLocked } from "../game-application/versions/airp-replay";
import type { AirpFrame, ValidatedD5Catalog } from "../game-core/contracts";
import { airpPoolView } from "./airp-pool-view";

/** Receives a registry-validated record. Never issues commands or scans unverified facts. */
export function airpView(catalog: ValidatedD5Catalog, record: D5GameRecord) {
  const state = record.narrative, content = catalog.data.airp;
  if (!state || !content) return null;
  if (state.version === 2 && content.version === 2) return airpPoolView(content, state, record);
  if (state.version !== 1 || content.version !== 1) return null;
  const instance = state.instance, atHome = airpAtHome(record.snapshot.campaign);
  const binding = instance && (instance.status === "accepted" || instance.status === "ready") ? instance.binding : null;
  const currentScene = state.scenes.find(s => s.id === state.reading?.sceneId) ?? null;
  const objective = !instance ? null : instance.status === "accepted"
    ? state.carryFactId ? "空药箱已系在行囊外侧，请成功归来。" : binding ? "本趟目标：第三层勤务走廊的空药箱。" : "下次庄园巡守：前往第三层勤务走廊。"
    : instance.status === "ready" ? "已带回空药箱，回洋馆找艾洛拉交付。"
    : instance.status === "resolved" ? "空药箱已交付，共同记忆已留下。"
    : instance.status === "closed" ? instance.reason === "declined" ? "已婉拒这次委托。" : "便条已收起，本次委托已结束。" : "艾洛拉有一件想拜托你的事。";
  const role = state.carryFactId ? "found" : "departure";
  const cue = binding ? state.scenes.filter(s => s.role === role && s.sourceHead.revision >= binding.departureHead.revision).at(-1) : null;
  // Reconstruct only exposed lines/selected branches from validated durable acknowledgements.
  const history = instance?.exposedPhase !== null && (instance?.status === "resolved" || instance?.status === "closed") ? state.scenes.map(scene => {
    const commands = record.facts.flatMap(f => f.kind === "airp" && "sceneId" in f.payload.command && f.payload.command.sceneId === scene.id ? [f.payload.command] : []);
    const lastRead = Math.max(-1, ...commands.map(c => scene.body.nodes.findIndex(n => n.id === c.nodeId)));
    const choice = commands.find(c => c.type === "airp-accept");
    const selected = choice?.type === "airp-accept" ? choice.optionId : null;
    const transcript = scene.body.nodes.slice(0, lastRead + 2).flatMap<AirpFrame>(n => n.kind === "beat" ? n.frames : n.kind === "branch" ? selected ? n.variants[selected] : [] : selected ? [{ id: n.id, kind: "narration", text: `已选行动：${n.options.find(o => o.id === selected)!.label}` }] : []);
    return { id: scene.id, role: scene.role, phase: scene.phase, transcript };
  }) : [];
  return {
    version: 1 as const,
    title: content.definition.title, location: "洋馆 · 公共休息室", phase: record.snapshot.campaign.clock,
    instance, objective, binding, carrying: !!state.carryFactId, locked: airpLocked(state),
    canOpen: atHome && record.snapshot.campaign.availableCharacterIds.includes("elora") && !!instance && ["pending", "offered", "ready"].includes(instance.status),
    scene: currentScene, reading: state.reading,
    cue: cue?.body.nodes.flatMap(n => n.kind === "beat" ? n.frames.map(f => f.text) : []).join("\n") ?? null,
    history,
    memories: state.memories, cooldowns: state.cooldowns,
  };
}
