import { assertJson, utf8Size } from "../../game-core/contracts";
import { settlementTaskIdentity } from "../../game-core/session";
import { check, emptyUsage, type Usage } from "../airp-generation/contracts";
import { parseDirectUsage } from "../airp-direct-gameplay/parse";
import { sameHead } from "../transaction";
import { cloneLow, lowHash, validateLowFrame } from "../airp-low/native";
import { acceptLowText, compileLowRequest, acceptLowDraft } from "../airp-low/output";
import { parseCallDiagnostics, redactCallText, type CallDiagnostics } from "../airp-generation/diagnostics";
import type { LowAttempt, LowFormatVersion } from "../airp-low/contracts";
import { NODE_CAPACITY, type NodeHostPort, type NodeJob, type NodeLedger, type NodeSnapshot } from "./contracts";
import { assertStartedNodePlan, compileNodeFrame, nodeBoundaryReady, nodeGate, nodeJobId, nodeWriting } from "./context";
import { nodeSettlement } from "./settlement";
import { sameNodeSettlementSources } from "./settlement-compat";

export const emptyNodeLedger = (): NodeLedger => ({ version: 1, jobs: [] });
const readerVersion = (j: NodeJob) => j.postprocessVersion ?? j.writingRevalidation?.readerVersion ?? j.frame?.readerVersion;
const withPlanNodes = (s: NodeSnapshot) => {
  const next = cloneLow(s.ledger);
  for (const node of s.plan.prepared!.proposal.nodes) if (!next.jobs.some(j => j.node.id === node.id)) next.jobs.push({ id: nodeJobId(s.plan.id, node.id), planId: s.plan.id, proposalHash: s.plan.prepared!.proposalHash, node, status: "waiting", frame: null, frozenWorld: null, triggerSources: [], attempts: [], text: null, writingWarnings: [], reads: [], selected: null, settlementId: null, skipReason: null });
  return next;
};
export function nodeStage(j: NodeJob): "writing" | "formatting" | null {
  if (j.status !== "open" || !j.frame || j.text || j.attempts.some(a => a.status === "running")) return null;
  return nodeWriting(j) ? "formatting" : "writing";
}
export function validateNodeSnapshot(s: NodeSnapshot) {
  assertJson(s); assertStartedNodePlan(s);
  check(s.ledger.version === 1 && s.ledger.jobs.length <= NODE_CAPACITY.jobs && utf8Size(JSON.stringify(s)) <= NODE_CAPACITY.bytes, "Node ledger capacity/version invalid");
  check(s.head.saveId === s.worldHead.saveId && s.head.epoch === s.worldHead.epoch && s.worldHead.revision <= s.head.revision && sameHead(s.worldHead, s.settlement.state.head), "Node world identity differs");
  check([...s.program.sources, ...s.program.actions].every(e => e.runId === s.program.runId && e.head.saveId === s.head.saveId && e.head.epoch === s.head.epoch && e.head.revision <= s.worldHead.revision && e.phase <= s.program.phase), "Foreign/future program source");
  check(new Set(s.ledger.jobs.map(j => j.id)).size === s.ledger.jobs.length && s.ledger.jobs.filter(j => j.status === "open").length <= 1, "Duplicate or overlapping scene jobs");
  for (const j of s.ledger.jobs) {
    check(j.postprocessVersion === undefined || j.postprocessVersion === 5, "Unsupported postprocessor");
    check(j.formatVersion === undefined || [1, 2].includes(j.formatVersion), "Unsupported field protocol");
    check(j.planId === s.plan.id && j.proposalHash === s.plan.prepared!.proposalHash && j.id === nodeJobId(j.planId, j.node.id) && s.plan.prepared!.proposal.nodes.some(n => lowHash(n) === lowHash(j.node)), "Changed node/plan identity");
    check(["waiting", "open", "skipped", "completed"].includes(j.status) && j.attempts.length <= NODE_CAPACITY.attempts && new Set(j.attempts.map(a => a.id)).size === j.attempts.length, "Invalid node lifecycle");
    if (j.frame) { validateLowFrame(j.frame); check(j.frame.scene.id === j.id && j.frozenWorld && j.frozenWorld.saveId === s.head.saveId && j.frozenWorld.epoch === s.head.epoch && j.frozenWorld.revision <= s.worldHead.revision, "Foreign scene frame"); }
    check(!j.attempts.length || j.frame, "Attempts lack frozen frame");
    check(j.attempts.filter(a => a.status === "running").length <= 1, "Multiple running model stages");
    check((j.connectionChanges?.length ?? 0) <= NODE_CAPACITY.attempts && (j.connectionChanges ?? []).every(c => /^[a-f0-9]{64}$/.test(c.connectionHash) && j.attempts.some(a => a.id === c.afterAttemptId && a.stage === c.stage && ["failed", "interrupted"].includes(a.status))), "Invalid explicit connection change");
    for (const a of j.attempts) {
      check(["writing", "formatting"].includes(a.stage) && ["running", "succeeded", "failed", "interrupted"].includes(a.status) && Number.isSafeInteger(a.at) && a.at >= 0 && ((a.status === "running") === (a.endedAt === null)) && (a.endedAt === null || a.endedAt >= a.at), "Invalid attempt markers");
      parseDirectUsage(a.usage);
      if (a.diagnostics) parseCallDiagnostics(a.diagnostics);
      if (a.status === "succeeded") { check(a.output, "Missing raw successful result"); if (a.stage === "writing") acceptLowDraft(a.output, j.frame!, readerVersion(j)); else acceptLowText(a.output, nodeWriting(j), j.frame!, readerVersion(j), j.formatVersion); }
    }
    if (j.writingRevalidation) {
      const a = j.attempts.find(a => a.id === j.writingRevalidation!.attemptId);
      check([3, 5].includes(j.writingRevalidation.readerVersion) && a?.stage === "writing" && a.status === "failed" && a.output, "Invalid offline writing revalidation");
      acceptLowDraft(a.output, j.frame!, j.writingRevalidation.readerVersion);
    }
    if (j.formattingRevalidation) {
      const a = j.attempts.find(a => a.id === j.formattingRevalidation!.attemptId);
      check(j.formatVersion !== undefined && j.formattingRevalidation.formatVersion === j.formatVersion && a?.stage === "formatting" && a.status === "failed" && a.diagnostics?.code === "invalid-output" && a.output && j.text, "Invalid offline formatting revalidation");
    }
    if (j.text) { const raw = j.attempts.find(a => a.stage === "formatting" && (a.status === "succeeded" || a.id === j.formattingRevalidation?.attemptId))?.output; check(raw && lowHash(acceptLowText(raw, nodeWriting(j), j.frame!, readerVersion(j), j.formatVersion)) === lowHash(j.text), "AVG differs from raw formatter"); }
    check(lowHash(j.writingWarnings) === lowHash(nodeWriting(j) ? acceptLowDraft(nodeWriting(j), j.frame!, readerVersion(j)).warnings : []), "Writing protocol warnings were concealed");
    check(!j.reads.length || j.text && j.reads.length <= j.text.lines.length, "Read cursor exceeds saved text");
    check(j.shown === undefined || j.shown === true && !!j.text && ["open", "completed"].includes(j.status), "Reader entry lacks a readable scene");
    check(j.reads.every((h, i) => h.saveId === s.head.saveId && h.epoch === s.head.epoch && h.revision <= s.worldHead.revision && (!i || h.revision > j.reads[i - 1].revision)), "Unproved read cursor");
    if (j.selected) check(j.text && j.reads.length === j.text.lines.length && j.text.choices[j.selected.index] === j.selected.text && j.selected.head.saveId === s.head.saveId && j.selected.head.epoch === s.head.epoch && j.selected.head.revision > j.reads.at(-1)!.revision && j.selected.head.revision <= s.worldHead.revision, "Unproved player selection");
    if (j.status === "completed") {
      const task = s.settlement.jobs.find(task => task.id === j.settlementId), input = task?.frames.at(-1)?.input;
      check(j.selected && task?.status === "applied" && input?.scope.boundaryId === j.id && s.settlement.receipts.some(r => r.taskId === task.id), "Node completed without matching settlement receipt");
      check(j.reads.every((head, i) => input.evidence.some(e => e.id === `read:${j.id}:${i}` && sameHead(e.head, head))), "Completed node omitted read evidence");
    }
    if (j.status === "skipped") check(j.skipReason && !j.reads.length && !j.selected, "Read scene cannot become unseen");
  }
}

/** Used by the owning gameplay transaction before running a real command. */
export function assertNodeProgramMayAdvance(s: NodeSnapshot) {
  validateNodeSnapshot(s);
  check(!s.settlement.jobs.some(j => j.status !== "applied"), "Pending settlement blocks gameplay continuation", "command-not-available");
  // A caller cannot bypass the current scene by forgetting to persist sync first.
  const current = { ...s, ledger: withPlanNodes(s) };
  for (const j of current.ledger.jobs) {
    check(nodeGate(current, j) !== "ready", "Current node must be opened or explicitly skipped before advancing", "command-not-available");
    if (j.status === "open") check(j.text && j.reads.length === j.text.lines.length && j.selected && !nodeBoundaryReady(s, j), "Read/resolve current node before gameplay advances", "command-not-available");
  }
}

export function createNodeService(port: NodeHostPort) {
  const read = async () => { const s = await port.read(); validateNodeSnapshot(s); return s; };
  const jobIn = (s: NodeSnapshot, id: string) => { const j = s.ledger.jobs.find(j => j.id === id); check(j, "Unknown node"); return j; };
  const persist = (s: NodeSnapshot, next: NodeLedger, kind: "metadata" | "observation" = "metadata") => port.commit({ expectedHead: s.head, expectedWorldHead: s.worldHead, next, kind });
  return {
    read,
    async sync() {
      const s = await read(), next = withPlanNodes(s);
      for (const j of next.jobs) { const gate = nodeGate({ ...s, ledger: next }, j); if (gate === "passed" || gate === "terminal") { j.status = "skipped"; j.skipReason = gate; } }
      return lowHash(next) === lowHash(s.ledger) ? s : persist(s, next);
    },
    async open(id: string) {
      const s = await read(), j = jobIn(s, id); if (j.status === "open") return s;
      const frame = compileNodeFrame(s, j), next = cloneLow(s.ledger), target = next.jobs.find(j => j.id === id)!;
      target.status = "open"; target.frame = frame; target.frozenWorld = s.worldHead; target.triggerSources = cloneLow(s.program.sources);
      return persist(s, next);
    },
    async skip(id: string) {
      const s = await read(), j = jobIn(s, id); if (j.status === "skipped") return s;
      check(j.status !== "completed" && !j.shown && !j.reads.length && !j.attempts.some(a => a.status === "running"), "Cannot skip a read/running scene");
      const next = cloneLow(s.ledger), t = next.jobs.find(j => j.id === id)!; t.status = "skipped"; t.skipReason = "player"; return persist(s, next, "observation");
    },
    async begin(id: string, request: Pick<LowAttempt, "id" | "stage" | "model" | "connectionHash" | "at">) {
      const s = await read(), j = jobIn(s, id);
      check(nodeStage(j) === request.stage && sameHead(j.frozenWorld!, s.worldHead) && lowHash(s.material) === j.frame!.materialHash, "Stage/world/material changed; not eligible to generate");
      check(j.attempts.length < NODE_CAPACITY.attempts && !j.attempts.some(a => a.id === request.id) && /^[a-f0-9]{64}$/.test(request.connectionHash) && request.model && Number.isSafeInteger(request.at), "Invalid or exhausted model attempt");
      const prior = j.attempts.filter(a => a.stage === request.stage).at(-1), approved = j.connectionChanges?.filter(c => c.stage === request.stage && c.afterAttemptId === prior?.id).at(-1);
      check(!prior || (approved?.connectionHash ?? prior.connectionHash) === request.connectionHash, "Cannot silently switch model connection on retry");
      const input = compileLowRequest(j.frame!, request.stage === "formatting" ? nodeWriting(j) : undefined, readerVersion(j), j.formatVersion), next = cloneLow(s.ledger);
      next.jobs.find(j => j.id === id)!.attempts.push({ ...request, requestHash: input.requestHash, endedAt: null, status: "running", output: null, usage: emptyUsage(), outcomeUnknown: false });
      await persist(s, next); return input;
    },
    async changeConnection(id: string, stage: "writing" | "formatting", connectionHash: string) {
      const s = await read(), j = jobIn(s, id), prior = j.attempts.filter(a => a.stage === stage).at(-1);
      check(nodeStage(j) === stage && prior && ["failed", "interrupted"].includes(prior.status) && /^[a-f0-9]{64}$/.test(connectionHash), "Only a failed/interrupted stage can explicitly change connection");
      const last = j.connectionChanges?.at(-1);
      if (last?.afterAttemptId === prior.id && last.connectionHash === connectionHash) return s;
      check((j.connectionChanges?.length ?? 0) < NODE_CAPACITY.attempts, "Connection change capacity exhausted");
      const next = cloneLow(s.ledger), target = next.jobs.find(j => j.id === id)!;
      (target.connectionChanges ??= []).push({ stage, afterAttemptId: prior.id, connectionHash });
      return persist(s, next);
    },
    async result(id: string, attemptId: string, output: string, usage: Usage, at: number, diagnostics?: CallDiagnostics) {
      const s = await read(), j = jobIn(s, id), original = j.attempts.find(a => a.id === attemptId); check(original, "Unknown sent attempt");
      if (original.output !== null) { check(original.output === output && lowHash(original.usage) === lowHash(usage) && original.endedAt === at, "Saved output changed"); return s; }
      check(utf8Size(output) <= 2 * 1024 * 1024 && Number.isSafeInteger(at) && at >= original.at, "Response exceeds capacity/time"); parseDirectUsage(usage);
      const next = cloneLow(s.ledger), t = next.jobs.find(j => j.id === id)!, a = t.attempts.find(a => a.id === attemptId)!;
      a.output = output; a.usage = usage; a.endedAt = at; a.status = "failed";
      if (diagnostics) a.diagnostics = parseCallDiagnostics(diagnostics);
      if (original.status === "running" && j.status === "open" && sameHead(j.frozenWorld!, s.worldHead) && lowHash(s.material) === j.frame!.materialHash) {
        try {
          const input = compileLowRequest(j.frame!, a.stage === "formatting" ? nodeWriting(j) : undefined, readerVersion(j), j.formatVersion); check(input.requestHash === a.requestHash, "Request changed");
          if (a.stage === "writing") t.writingWarnings = acceptLowDraft(output, j.frame!, readerVersion(j)).warnings; else t.text = acceptLowText(output, nodeWriting(j), j.frame!, readerVersion(j), j.formatVersion);
          a.status = "succeeded";
        } catch (error) { a.diagnostics = { ...a.diagnostics, version: 1, code: "invalid-output", message: redactCallText(error instanceof Error ? error.message : String(error)).slice(0, 20000) }; }
      } else {
        a.diagnostics = { ...a.diagnostics, version: 1, code: "stale-result", message: "响应已保存，但原节点、世界状态或请求状态已改变。" };
      }
      return persist(s, next);
    },
    async interrupt(id: string, attemptId: string, at: number, usage = emptyUsage(), diagnostics?: CallDiagnostics) {
      const s = await read(), j = jobIn(s, id), next = cloneLow(s.ledger), a = next.jobs.find(j => j.id === id)!.attempts.find(a => a.id === attemptId);
      check(a && a.status === "running" && at >= a.at && j.status === "open", "No running request"); a.status = "interrupted"; a.endedAt = at; a.usage = usage; a.outcomeUnknown = true;
      if (diagnostics) a.diagnostics = parseCallDiagnostics(diagnostics);
      return persist(s, next);
    },
    async usePostprocessing(id: string) {
      const s = await read(), j = jobIn(s, id);
      if (j.text || j.postprocessVersion === 5 || j.frame?.readerVersion === 5) return s;
      check(j.status === "open" && j.frame && !j.attempts.some(a => a.status === "running"), "Wait for the current request before adopting postprocessing");
      const next = cloneLow(s.ledger), t = next.jobs.find(j => j.id === id)!, a = t.attempts.filter(a => a.stage === "writing").at(-1);
      t.postprocessVersion = 5;
      if (a?.status === "failed" && a.output?.trim()) t.writingRevalidation = { attemptId: a.id, readerVersion: 5 };
      if (nodeWriting(t)) t.writingWarnings = acceptLowDraft(nodeWriting(t), t.frame!, 5).warnings;
      return persist(s, next);
    },
    async useFormatProtocol(id: string, version: LowFormatVersion = 2) {
      const s = await read(), j = jobIn(s, id);
      if (j.text || j.formatVersion === version || (readerVersion(j) ?? 1) < 5) return s;
      check((j.formatVersion ?? 0) < version, "Cannot downgrade an adopted field protocol");
      check(nodeStage(j) === "formatting" && sameHead(j.frozenWorld!, s.worldHead) && lowHash(s.material) === j.frame!.materialHash, "Wait for an unchanged idle formatting stage");
      const next = cloneLow(s.ledger), t = next.jobs.find(j => j.id === id)!;
      t.formatVersion = version;
      const a = t.attempts.filter(a => a.stage === "formatting").at(-1);
      if (a?.status === "failed" && a.diagnostics?.code === "invalid-output" && a.output) {
        try {
          t.text = acceptLowText(a.output, nodeWriting(t), t.frame!, readerVersion(t), version);
          t.formattingRevalidation = { attemptId: a.id, formatVersion: version };
        } catch { /* Keep other invalid results for explicit retry, without rewriting their records. */ }
      }
      return persist(s, next);
    },
    async revalidateWriting(id: string) {
      const s = await read(), j = jobIn(s, id); if (j.writingRevalidation) return s;
      const a = j.attempts.filter(a => a.stage === "writing").at(-1);
      check(nodeStage(j) === "writing" && a?.status === "failed" && a.output && sameHead(j.frozenWorld!, s.worldHead) && lowHash(s.material) === j.frame!.materialHash, "No unchanged failed writing to revalidate");
      const result = acceptLowDraft(a.output, j.frame!, 5), next = cloneLow(s.ledger), target = next.jobs.find(j => j.id === id)!;
      target.writingRevalidation = { attemptId: a.id, readerVersion: 5 }; target.writingWarnings = result.warnings;
      return persist(s, next);
    },
    async show(id: string) {
      const s = await read(), j = jobIn(s, id);
      check(j.status === "open" && j.text && !j.selected, "No current dialogue to enter");
      if (j.shown) return s;
      const next = cloneLow(s.ledger); next.jobs.find(j => j.id === id)!.shown = true;
      return persist(s, next);
    },
    async readLine(id: string, cursor: number) {
      const s = await read(), j = jobIn(s, id); check(j.status === "open" && j.text && cursor >= 0 && Number.isSafeInteger(cursor), "Not readable");
      if (cursor < j.reads.length) return s;
      check(cursor === j.reads.length && cursor < j.text.lines.length, "Cannot skip unread paragraphs");
      const next = cloneLow(s.ledger); next.jobs.find(j => j.id === id)!.reads.push({ ...s.head, revision: s.head.revision + 1 }); return persist(s, next, "observation");
    },
    async choose(id: string, index: number) {
      const s = await read(), j = jobIn(s, id); check(j.status === "open" && j.text && j.reads.length === j.text.lines.length && Number.isSafeInteger(index) && index >= 0 && index < 3, "Response requires the fully read scene");
      if (j.selected) { check(j.selected.index === index, "Already selected another attitude"); return s; }
      const next = cloneLow(s.ledger); next.jobs.find(j => j.id === id)!.selected = { index, text: j.text.choices[index], head: { ...s.head, revision: s.head.revision + 1 } }; return persist(s, next, "observation");
    },
    async settlementInput(id: string) { const s = await read(); return nodeSettlement(s, jobIn(s, id)); },
    async complete(id: string) {
      const s = await read(), j = jobIn(s, id); if (j.status === "completed") return s;
      const packet = nodeSettlement(s, j), taskId = settlementTaskIdentity(packet.input).taskId;
      const receipt = s.settlement.receipts.find(r => r.taskId === taskId); check(receipt, "Wait for CL-B settlement receipt before completing node");
      const settled = s.settlement.jobs.find(job => job.id === taskId), frame = settled?.frames.at(-1);
      // Summaries may legitimately cite none of the dialogue. Coverage belongs to
      // the frozen input, not the model's selection of memorable facts.
      check(settled?.status === "applied" && frame && settlementTaskIdentity(frame.input).inputHash === receipt.inputHash && sameNodeSettlementSources(frame, packet), "Settlement omitted or changed this node's frozen sources");
      const next = cloneLow(s.ledger), t = next.jobs.find(j => j.id === id)!; t.status = "completed"; t.settlementId = taskId; return persist(s, next);
    },
  };
}
