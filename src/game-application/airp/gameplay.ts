import * as v from "../../game-core/contracts";
import { airpPhaseIndex, airpPoolLocked, checkAirpPoolCapacity } from "../../game-core/session";
import { airpAtHome, type AirpReplayInput } from "../versions/airp-boundary";
import { reduceAirpCommit } from "../versions/airp-replay";
import { acceptAirpScene, prepareAirpScene } from "./acceptance";
import { AIRP_API, airpHash, parseAirpBinding, parseAirpReceipt, type AirpRpHead } from "./contracts";
import { prepareAirpConfirmationTicket, prepareAirpDiscardTicket } from "./control";
import { parseAirpReleaseTarget, prepareAirpSession } from "./rp-session";
import type { AirpOnlineCommand, AirpOnlineEntry, AirpOnlineIntent, AirpOnlineState } from "./gameplay-contracts";
import type { AirpDirectState } from "../airp-direct-gameplay/contracts";
import { reduceDirectCommit } from "../airp-direct-gameplay/reducer";
import type { DirectorState } from "../airp-director/contracts";
import { reduceDirectorCommit } from "../airp-director/reducer";
export type { AirpOnlineCommand, AirpOnlineEntry, AirpOnlineIntent, AirpOnlineState } from "./gameplay-contracts";
export const emptyAirpOnline = (): AirpOnlineState => ({ version: 1, connection: null, entries: [] });
export const airpOnlineHead = (r: AirpRpHead): AirpRpHead => ({ floorId: r.floorId, checkpointSnapshotId: r.checkpointSnapshotId, checkpointContentHash: r.checkpointContentHash });
const same = (a: unknown, b: unknown) => v.canonicalJson(a) === v.canonicalJson(b);
export const airpOnlineBusy = (s: AirpOnlineState): boolean => s.entries.some(e => !!e.ticket && !e.controlReceipt);
export const airpOnlineHidden = (e: AirpOnlineEntry | undefined): boolean => !!e && (e.source === "undecided" || e.source === "requested");

export function parseAirpOnlineCommand(raw: unknown): AirpOnlineCommand {
  v.assertJson(raw);
  if (v.utf8Size(JSON.stringify(raw)) > 48 * 1024) v.invalid("online.command", "Online command exceeds budget");
  const c = v.record(raw, "online.command"), type = v.choice(c.type, ["airp-online-connect", "airp-online-bound", "airp-online-reset", "airp-online-request", "airp-online-handwritten", "airp-online-result", "airp-online-discard-ready", "airp-online-control-done", "airp-online-followup"], "online.command.type");
  if (type === "airp-online-connect") {
    v.record(c, "command", ["type", "baseUrl", "release"]);
    const baseUrl = v.text(c.baseUrl, "baseUrl", 1000);
    // Pure application grammar: host/optional port and plain path segments, no browser URL dependency.
    const endpoint = /^https?:\/\/(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[a-f0-9:]+\])(?::([0-9]{1,5}))?(?:\/[a-z0-9_~-]+)*\/api\/v1\/?$/i.exec(baseUrl);
    if (!endpoint || (endpoint[1] && (Number(endpoint[1]) < 1 || Number(endpoint[1]) > 65535))) v.invalid("baseUrl", "Use a plain absolute HTTP(S) /api/v1 endpoint without credentials, query or fragment");
    return { type, baseUrl: baseUrl.replace(/\/$/, ""), release: parseAirpReleaseTarget(c.release) };
  }
  if (type === "airp-online-bound") {
    v.record(c, "command", ["type", "connectionKey", "binding"]);
    return { type, connectionKey: v.id(c.connectionKey, "connectionKey"), binding: parseAirpBinding(c.binding) };
  }
  if (type === "airp-online-reset") { v.record(c, "command", ["type"]); return { type }; }
  if (type === "airp-online-followup") { v.record(c, "command", ["type", "instanceId"]); return { type, instanceId: v.id(c.instanceId, "instanceId") }; }
  v.record(c, "command", ["type", "sceneId", ...(type === "airp-online-result" ? ["result"] : type === "airp-online-discard-ready" ? ["receipt"] : type === "airp-online-control-done" ? ["requestId", "receipt"] : [])]);
  const sceneId = v.id(c.sceneId, "sceneId");
  if (type === "airp-online-result") return { type, sceneId, result: structuredClone(c.result) };
  if (type === "airp-online-discard-ready") return { type, sceneId, receipt: parseAirpReceipt(c.receipt) };
  if (type === "airp-online-control-done") return { type, sceneId, requestId: v.id(c.requestId, "requestId"), receipt: parseAirpReceipt(c.receipt) };
  return { type, sceneId };
}
export function parseAirpOnlineIntent(raw: unknown): AirpOnlineIntent {
  const r = v.record(raw, "online.intent", ["version", "command"]);
  return { version: v.choice(r.version, [1], "online.intent.version"), command: parseAirpOnlineCommand(r.command) };
}

/** Same reducer for execution and full save replay. Network and backend State writes are outside this transaction. */
export function reduceAirpApplicationCommit(catalog: v.ValidatedD5Catalog, previous: v.AirpNarrativeState, prior: AirpOnlineState | undefined, input: AirpReplayInput, priorDirect?: AirpDirectState, priorDirector?: DirectorState): { narrative: v.AirpNarrativeState; online?: AirpOnlineState; direct?: AirpDirectState; director?: DirectorState } {
  if (catalog.data.airpDirector) return reduceDirectorCommit(catalog, previous, priorDirector, input);
  if (catalog.data.airpDirect) return reduceDirectCommit(catalog, previous, priorDirect, input);
  if (!catalog.data.airpOnline) return { narrative: reduceAirpCommit(catalog, previous, input) };
  if (previous.version !== 2 || !prior) v.invalid("online", "Online content requires pool state and its replayed outbox");
  const online = structuredClone(prior), current = input.group[0];
  const onlineFact = current.kind === "airp-online" ? current : null;
  const gate = online.entries.find(e => e.sceneId === previous.reading?.sceneId);
  if (!onlineFact && airpOnlineHidden(gate)) v.invalid("online.source", "Select a source or finish generation before reading", "command-not-available");
  const narrative = onlineFact ? structuredClone(previous) : reduceAirpCommit(catalog, previous, input) as v.AirpPoolState;
  const definitionId = catalog.data.airpOnline.definitionId, phase = airpPhaseIndex(input.after.clock.day, input.after.clock.phase);
  const add = (scene: v.AirpPoolScene, task: "return" | "followup") => {
    if (!online.entries.some(e => e.sceneId === scene.id)) online.entries.push({ sceneId: scene.id, instanceId: scene.instanceId, task, source: "undecided", ticket: null, accepted: null, control: null, controlReceipt: null });
  };
  if (onlineFact) {
    if (input.group.length !== 1) v.invalid("online", "Online intent needs its own atomic fact group");
    const command = parseAirpOnlineIntent(onlineFact.payload).command;
    const connection = online.connection;
    if (command.type === "airp-online-connect") {
      if (connection || airpOnlineBusy(online) || !airpAtHome(input.before)) v.invalid("online.connect", "Reset an unused connection explicitly before rebinding", "command-not-available");
      const ticket = prepareAirpSession(command.release, { saveId: input.head.saveId, epoch: input.head.epoch, mode: "play", content: { id: catalog.ref.catalogId, version: catalog.ref.contentVersion, digest: catalog.ref.digest } });
      online.connection = { baseUrl: command.baseUrl, key: `connection:${airpHash([command.baseUrl, ticket.requestId])}`, ticket, binding: null };
    } else if (command.type === "airp-online-reset") {
      if (online.entries.some(e => e.ticket)) v.invalid("online.reset", "A used Session needs an explicit recovery branch, not a silent reset", "command-not-available");
      online.connection = null;
    } else if (command.type === "airp-online-bound") {
      if (!connection || command.connectionKey !== connection.key) v.invalid("online.binding", "Stale connection response", "airp-stale-result");
      if (connection.binding && !same(connection.binding, command.binding)) v.invalid("online.binding", "Session already bound", "conflict");
      const t = connection.ticket.target, b = command.binding;
      if (b.head || b.applicationId !== t.applicationId || b.releaseId !== t.releaseId || b.contractVersionId !== t.contractVersionId || b.writingPipelineVersionId !== t.writingPipelineVersionId) v.invalid("online.binding", "Wrong Release or nonempty Session");
      connection.binding = b;
    } else if (command.type === "airp-online-followup") {
      const instance = narrative.instances.find(i => i.id === command.instanceId), done = online.entries.find(e => e.instanceId === command.instanceId && e.task === "return");
      if (!instance || instance.definition.id !== definitionId || instance.status !== "resolved" || !done?.accepted || !done.controlReceipt || airpOnlineBusy(online) || online.entries.some(e => e.instanceId === instance.id && e.task === "followup") || airpPoolLocked(narrative) || !airpAtHome(input.before) || !input.before.availableCharacterIds.includes("elora")) v.invalid("online.followup", "Followup needs this event's resolved quest and confirmed return memory", "command-not-available");
      const body = structuredClone(catalog.data.airpOnline.followup), id = `scene:${airpHash([instance.id, "online-followup"]).slice(0, 32)}`;
      if (["dusk", "night"].includes(input.after.clock.phase)) { body.presentation.stagePreset = "mansion-night"; body.presentation.backgroundId = "mansion.night"; }
      const scene: v.AirpPoolScene = { id, instanceId: instance.id, role: "followup", templateId: body.id, templateVersion: 1, contentDigest: catalog.ref.digest, sourceHead: { ...input.head }, phase, source: "handwritten", body, bodyHash: airpHash(body) };
      narrative.scenes.push(scene); narrative.reading = { sceneId: id, node: 0, choice: null, completed: false, paused: false }; add(scene, "followup");
    } else {
      const entry = online.entries.find(e => e.sceneId === command.sceneId), scene = narrative.scenes.find(s => s.id === command.sceneId);
      if (!entry || !scene) v.invalid("online.scene", "Unknown online scene");
      const instance = narrative.instances.find(i => i.id === entry.instanceId)!;
      if (command.type === "airp-online-handwritten") {
        if (entry.source !== "undecided" && entry.source !== "requested") v.invalid("online.source", "Displayed content cannot be replaced", "command-not-available");
        entry.source = "handwritten";
      } else if (command.type === "airp-online-request") {
        if (entry.source !== "undecided" || !connection?.binding || airpOnlineBusy(online) || scene.id !== narrative.reading?.sceneId || narrative.reading.node !== 0 || narrative.reading.completed || !airpAtHome(input.before) || !instance.proof || !instance.accepted || !instance.completionFactIds.length) v.invalid("online.request", "Scene is not eligible for a new generation", "command-not-available");
        const proof = instance.proof, ids = [...proof.sourceFactIds];
        const facts = ids.map(id => {
          const fact = input.facts.find(f => f.id === id && !input.retracted.includes(id));
          if (!fact || (fact.kind !== "journey" && fact.kind !== "progression" && !(fact.kind === "airp" && fact.payload.command.type === "airp-accept"))) v.invalid("online.facts", "Missing committed patrol evidence");
          const summary = fact.kind === "airp" ? "玩家已经接受艾洛拉取回空药箱的委托。" : fact.kind === "journey" ? "本次巡路已在约定地点找到空药箱。" : fact.payload.type === "expedition-started" ? "玩家带着这项委托出发巡路。" : proof.outcome === "extracted" ? "本次从侧门成功撤离并带回空药箱。" : "本次完成巡路并带回空药箱。";
          return { id, phase: airpPhaseIndex(fact.worldTime.day, fact.worldTime.phase), knownBy: ["kael", "elora"], summary };
        });
        entry.ticket = prepareAirpScene(connection.binding, { version: AIRP_API.request, requestId: `airp-generate:${airpHash([connection.key, scene.id, input.head])}`, mode: "play",
          source: { head: { ...input.head }, content: connection.ticket.identity.content }, eventId: instance.id, definitionId, task: entry.task, phase, locationId: "mansion.common-room", actorIds: ["elora"], stance: instance.accepted.stance, outcome: proof.outcome, facts, requiredFactIds: ids });
        entry.source = "requested";
      } else if (command.type === "airp-online-result") {
        if (!entry.ticket || (entry.source !== "requested" && entry.source !== "generated")) v.invalid("online.result", "Late result after source selection cannot replace the scene", "airp-stale-result");
        const accepted = acceptAirpScene(entry.ticket, command.result, { head: { ...input.head, revision: input.head.revision - 1 }, contentDigest: catalog.ref.digest, eventId: instance.id, eligible: scene.id === narrative.reading?.sceneId && narrative.reading.node === 0 && !narrative.reading.completed }, entry.accepted);
        if (!entry.accepted) {
          if (!connection?.binding || !same(connection.binding, entry.ticket.binding)) v.invalid("online.binding", "Backend binding changed during generation", "airp-stale-result");
          entry.accepted = accepted; entry.source = "generated";
          const id = accepted.id, sectionId = `${id}.section`;
          scene.body = { ...scene.body, id, sections: [{ id: sectionId, title: scene.body.title }], nodes: accepted.result.text.lines.map((line, cursor) => {
            const nodeId = `${id}.${cursor}`;
            const frame: v.AirpFrame = line.speaker === "narrator" ? { id: nodeId, kind: "narration", text: line.text } : { id: nodeId, kind: "dialogue", actorId: line.speaker, emotion: line.emotion, text: line.text };
            return { id: nodeId, cursor, sectionId, kind: "beat", frames: [frame] };
          }) };
          scene.source = "rp"; scene.sourceHead = { ...input.head }; scene.bodyHash = airpHash(scene.body);
          connection.binding.head = airpOnlineHead(accepted.result.origin);
        }
      } else if (command.type === "airp-online-discard-ready") {
        if (entry.source !== "handwritten" || !entry.ticket || entry.accepted || !connection?.binding) v.invalid("online.discard", "Only an abandoned candidate needs cleanup");
        const control = prepareAirpDiscardTicket(entry.ticket, airpOnlineHead(command.receipt));
        if (entry.control && !same(entry.control, control)) v.invalid("online.discard", "Cleanup already bound to a different checkpoint", "conflict");
        if (!entry.control) { entry.control = control; connection.binding.head = airpOnlineHead(command.receipt); }
      } else if (command.type === "airp-online-control-done") {
        if (!entry.control || entry.control.payload.requestId !== command.requestId || !connection?.binding) v.invalid("online.confirm", "No matching durable control intent");
        if (entry.controlReceipt) {
          if (!same(airpOnlineHead(entry.controlReceipt), airpOnlineHead(command.receipt))) v.invalid("online.confirm", "Conflicting confirmation receipt", "conflict");
        } else {
          if (!same(connection.binding, entry.control.binding)) v.invalid("online.confirm", "Backend branch moved before confirmation", "conflict");
          entry.controlReceipt = command.receipt; connection.binding.head = airpOnlineHead(command.receipt);
        }
      } else v.invalid("online.command", "Unknown online scene action");
    }
  } else {
    const active = narrative.scenes.find(s => s.id === narrative.reading?.sceneId);
    if (active && active.instanceId === narrative.instances.find(i => i.definition.id === definitionId)?.id && ["return-cleared", "return-extracted"].includes(active.role)) add(active, "return");
    const read = current.kind === "airp" && current.payload.command.type === "airp-read" ? current.payload.command : null;
    const entry = read && online.entries.find(e => e.sceneId === read.sceneId);
    if (entry?.accepted && !entry.control && narrative.reading?.sceneId === entry.sceneId && narrative.reading.completed) entry.control = prepareAirpConfirmationTicket(entry.accepted, { completed: true, head: input.head, factIds: [current.id] });
  }
  if (online.entries.length > 2 || v.utf8Size(JSON.stringify(online)) > 512 * 1024) v.invalid("online", "Online sample archive capacity exceeded", "airp-capacity");
  checkAirpPoolCapacity(narrative);
  return { narrative, online };
}
