import * as v from "../../game-core/contracts";
import type { HeadRef } from "../contracts";
import type { MemoryChange, MemoryContext, MemoryCorrection, MemoryTarget, MemoryView } from "./contracts";

export const memoryHash = (x: unknown) => v.sha256(v.canonicalJson(x));
export const summaryId = (id: string, index: number) => `${id}:${index}`;
export function memoryTargets(memories: Pick<v.SettlementMemory, "id" | "phase" | "scope" | "points">[], threads: v.SettlementThread[]): MemoryTarget[] {
  return [...memories.flatMap(m => m.points.map((value, i): MemoryTarget => ({id: summaryId(m.id, i), kind: "summary", phase: m.phase, scope: m.scope, hash: memoryHash(value), value}))),
    ...threads.map((value): MemoryTarget => ({id: value.id, kind: "thread", phase: memories.find(m => m.scope.boundaryId === value.scope.boundaryId)?.phase ?? 0, scope: value.scope, hash: memoryHash(value), value}))];
}
export function correctionEnvelope(raw: unknown, enabled: boolean): unknown {
  if (!enabled || !raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const { memoryCorrections: _corrections, ...result } = raw as Record<string, unknown>; return result;
}
export function correctionJson(raw: string): unknown { return v.parseJson(raw.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, "$1")); }

/** Parse each dependency group independently. Bad optional metadata never rejects the main GM result. */
export function admitMemoryCorrections(raw: unknown, context: MemoryContext, owner: Pick<MemoryCorrection, "jobId" | "attemptId" | "recordedHead">): MemoryCorrection[] {
  const supplied = raw && typeof raw === "object" ? (raw as Record<string, unknown>).memoryCorrections : undefined;
  if (supplied === undefined) return [];
  const groups = Array.isArray(supplied) && supplied.length <= 16 ? supplied : [null];
  return groups.map((rawGroup, index) => {
    const result: MemoryCorrection = {...owner, id: `gm-memory:${memoryHash([owner.jobId, owner.attemptId, index]).slice(0, 32)}`, sourceHead: context.sourceHead,
      reason: "", basisIds: [], changes: [], before: [], claims: [], waitForSceneId: null, error: null};
    try {
      const group = v.record(rawGroup, "memoryCorrection", ["reason", "basisIds", "changes"]);
      result.reason = v.text(group.reason, "reason", 2000); result.basisIds = v.ids(group.basisIds, "basisIds");
      if (!result.basisIds.length) throw Error("更正缺少依据");
      const evidence = result.basisIds.map(id => context.evidence.find(e => e.id === id));
      if (evidence.some(e => !e)) throw Error("更正依据不在当前已读／程序证据目录");
      result.claims = evidence.flatMap(e => e?.speakerId ? [{sourceId: e.id, speakerId: e.speakerId}] : []);
      const pending = [...new Set(evidence.flatMap(e => e?.pendingSceneId ? [e.pendingSceneId] : []))];
      if (pending.length > 1) throw Error("更正不能跨多个未读场景");
      result.waitForSceneId = pending[0] ?? null;
      const targets = new Map(context.targets.map(t => [t.id, t]));
      const ref = (id: unknown, hash: unknown) => {
        const t = targets.get(v.id(id, "targetId"));
        if (!t || hash !== t.hash) throw Error("目标不存在或版本已变");
        return t;
      };
      const changes = v.list(group.changes, "changes", 16);
      if (!changes.length) throw Error("空更正组");
      result.changes = changes.map(rawChange => {
        const c = v.record(rawChange, "change", ["kind", "targetId", "expectedHash"], ["text", "duplicateOf"]);
        const kind = v.choice(c.kind, ["replace-summary", "merge-summary", "close-thread"], "change.kind");
        const target = ref(c.targetId, c.expectedHash);
        if ((kind === "close-thread") !== (target.kind === "thread")) throw Error("该操作不允许修改此类记录");
        // GM omniscience must not promote secret evidence to a broader audience.
        if (evidence.some(e => target.value.knownBy.some(id => !e!.knownBy.includes(id)))) throw Error("更正依据的知情范围不足");
        result.before.push(structuredClone(target));
        const change: MemoryChange = {kind, targetId: target.id, expectedHash: target.hash};
        if (kind === "replace-summary") {
          change.text = v.text(c.text, "change.text", 4000);
          if (c.duplicateOf !== undefined) throw Error("替换不能同时合并");
        } else if (c.text !== undefined) throw Error("关闭／合并不接受新正文");
        if (kind === "merge-summary") {
          const d = v.record(c.duplicateOf, "duplicateOf", ["targetId", "expectedHash"]), kept = ref(d.targetId, d.expectedHash);
          const attribution = (t: MemoryTarget) => ({kind: t.value.kind, speakerId: t.value.speakerId, knownBy: [...t.value.knownBy].sort(), claims: t.value.kind === "record" ? [...new Set(t.value.claims.map(c => c.speakerId))].sort() : []});
          const sameOwner = target.scope.eventId ? target.scope.eventId === kept.scope.eventId : target.scope.runId ? target.scope.runId === kept.scope.runId : target.scope.boundaryId === kept.scope.boundaryId;
          if (kept.id === target.id || kept.kind !== "summary" || memoryHash(attribution(kept)) !== memoryHash(attribution(target)) || !sameOwner) throw Error("合并目标归属、知情范围或事项不一致");
          change.duplicateOf = {targetId: kept.id, expectedHash: kept.hash}; result.before.push(structuredClone(kept));
        } else if (c.duplicateOf !== undefined) throw Error("非合并操作不能指定保留目标");
        return change;
      });
      const ids = result.changes.map(c => c.targetId);
      const removed = new Set(result.changes.filter(c => c.kind !== "replace-summary").map(c => c.targetId));
      if (new Set(ids).size !== ids.length || result.changes.some(c => c.duplicateOf && removed.has(c.duplicateOf.targetId))) throw Error("同组目标重复或合并依赖成环");
    } catch (e) { result.error = e instanceof Error ? e.message : "无效更正"; result.changes = []; result.before = []; }
    return result;
  });
}

/** Append-only originals + an effective overlay. Activation order, not request order, wins. */
export function effectiveMemory(targets: MemoryTarget[], records: MemoryCorrection[], readHeads: Record<string, HeadRef> = {}): MemoryView {
  const view: MemoryView = {version: 1, targets: structuredClone(targets), closed: [], diagnostics: []};
  const active = new Map(view.targets.map(t => [t.id, t]));
  const activation = (r: MemoryCorrection) => r.waitForSceneId ? readHeads[r.waitForSceneId] : r.recordedHead;
  for (const r of [...records].sort((a, b) => (activation(a)?.revision ?? Infinity) - (activation(b)?.revision ?? Infinity) || a.recordedHead.revision - b.recordedHead.revision || a.id.localeCompare(b.id))) {
    const head = activation(r);
    let error = r.error;
    if (!error && head) for (const before of r.before) if (active.get(before.id)?.hash !== before.hash) { error = "目标版本已改变，本组未生效"; break; }
    const status = error ? "rejected" : head ? "applied" : "pending";
    view.diagnostics.push({id: r.id, status, reason: error ?? r.reason, effectiveHead: status === "applied" ? head : null});
    if (status !== "applied") continue;
    for (const c of r.changes) {
      const old = active.get(c.targetId)!;
      if (c.kind === "replace-summary") {
        const inherited = old.value.kind === "record" ? old.value.claims : [];
        const claims = [...inherited, ...r.claims.filter(c => !inherited.some(i => i.sourceId === c.sourceId))];
        const base = {...old.value, text: c.text!, basisIds: [...new Set([...old.value.basisIds, ...r.basisIds])]};
        const value: v.SettlementMemoryPoint = old.value.kind !== "claim" && claims.length ? {...base, kind: "record", speakerId: null, claims} : base;
        active.set(old.id, {...old, value, hash: memoryHash(value)});
      } else {
        if (c.kind === "merge-summary") {
          const kept = active.get(c.duplicateOf!.targetId)!;
          const value = {...kept.value, basisIds: [...new Set([...kept.value.basisIds, ...old.value.basisIds])]};
          if (value.kind === "record" && old.value.kind === "record") value.claims = [...value.claims, ...old.value.claims.filter(c => !value.claims.some(k => k.sourceId === c.sourceId))];
          active.set(kept.id, {...kept, value, hash: memoryHash(value)});
        }
        active.delete(old.id);
        if (c.kind === "close-thread") view.closed.push({target: structuredClone(old), correctionId: r.id, reason: r.reason, effectiveHead: head});
      }
    }
  }
  view.targets = [...active.values()]; return view;
}
export function effectiveSettlementMemories<T extends Pick<v.SettlementMemory, "id" | "points" | "opened" | "closed">>(memories: T[], view: MemoryView): T[] {
  const byId = new Map(view.targets.map(t => [t.id, t]));
  return memories.map(m => ({...m, points: m.points.flatMap((_, i) => { const t = byId.get(summaryId(m.id, i)); return t ? [t.value as v.SettlementMemoryPoint] : []; }),
    // Historical opened/closed lists are receipts, not current unresolved state.
    opened: m.opened.filter(t => byId.has(t.id)), closed: m.closed}));
}
export const effectiveThreads = (view: MemoryView) => view.targets.filter(t => t.kind === "thread").map(t => structuredClone(t.value) as v.SettlementThread);
