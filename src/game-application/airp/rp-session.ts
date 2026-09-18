import * as v from "../../game-core/contracts";
import { airpDigest, airpHash, airpOpaqueId, parseAirpBinding, type AirpRpBinding, type AirpSceneRequest } from "./contracts";

/** Released native resources, not a client-owned prompt/workflow configuration. */
export type AirpReleaseTarget = {
  version: 1;
  applicationId: string;
  releaseId: string;
  releaseHash: string;
  packageHash: string;
  greetingId: string;
  contractVersionId: string;
  writingPipelineVersionId: string;
  outlinePipelineVersionId: string;
  updaterPipelineVersionId: string;
  workflowVersionId: string;
};
export type AirpSessionIdentity = {
  saveId: string;
  epoch: string;
  mode: AirpSceneRequest["mode"];
  content: AirpSceneRequest["source"]["content"];
};
export type AirpSessionTicket = { version: 1; target: AirpReleaseTarget; identity: AirpSessionIdentity; requestId: string };
const resourceKeys = {
  contractVersionId: "contract.airp", writingPipelineVersionId: "pipeline.writing",
  outlinePipelineVersionId: "pipeline.outline", updaterPipelineVersionId: "pipeline.updater", workflowVersionId: "workflow.scene",
} as const;
// Explicitly reviewed packages only. Release and Runtime share this compatibility table.
// The persisted historical field names the final producer, not the prose writer or revision formatter.
const finalPipelineKeys = {
  "0.1.0": "pipeline.writing", "0.1.1": "pipeline.writing", "0.1.2": "pipeline.writing", "0.1.3": "pipeline.writing",
  "0.2.0": "pipeline.formatting", "0.2.1": "pipeline.formatting", "0.3.0": "pipeline.formatting", "0.3.1": "pipeline.formatting", "0.3.2": "pipeline.formatting",
} as const;
function resourceKeysFor(version: unknown, path: string) {
  const reviewed = v.choice(version, Object.keys(finalPipelineKeys) as (keyof typeof finalPipelineKeys)[], path);
  return { ...resourceKeys, writingPipelineVersionId: finalPipelineKeys[reviewed] };
}
function same(a: unknown, b: unknown, path: string) {
  if (v.canonicalJson(a) !== v.canonicalJson(b)) v.invalid(path, "Native Session/Release does not match the frozen binding", "airp-wrong-source");
}
export function parseAirpReleaseTarget(raw: unknown): AirpReleaseTarget {
  const r = v.record(raw, "target", ["version", "applicationId", "releaseId", "releaseHash", "packageHash", "greetingId", ...Object.keys(resourceKeys)]);
  const ids = Object.fromEntries(["applicationId", "releaseId", "greetingId", ...Object.keys(resourceKeys)].map(k => [k, airpOpaqueId(r[k], `target.${k}`)]));
  return { ...ids, version: v.choice(r.version, [1], "target.version"), releaseHash: airpDigest(r.releaseHash, "releaseHash"), packageHash: airpDigest(r.packageHash, "packageHash") } as AirpReleaseTarget;
}
/** User selects the exact Release ID; never silently follows currentReleaseId. */
export function decodeAirpRelease(raw: unknown, releaseId: string): AirpReleaseTarget {
  v.assertJson(raw);
  const r = v.record(raw, "release"), manifest = v.record(r.manifest, "manifest");
  same(r.id, releaseId, "release.id"); same(manifest.schemaVersion, 4, "manifest.version");
  same(manifest.applicationId, r.applicationId, "manifest.application"); same(manifest.version, r.version, "manifest.releaseVersion");
  const lock = v.record(manifest.packageLock, "packageLock");
  same(lock.packageId, "app.abyssa.airp", "package.id");
  const keys = resourceKeysFor(lock.packageVersion, "package.version");
  const resources = v.list(manifest.packageResources, "resources", 128).map(r => v.record(r, "resource"));
  const artifacts = v.list(manifest.artifacts, "artifacts", 128).map(a => v.record(a, "artifact"));
  const ids = Object.fromEntries(Object.entries(keys).map(([field, key]) => {
    const selected = resources.filter(r => r.logicalKey === key);
    if (selected.length !== 1) v.invalid("resources", "Missing or ambiguous AIRP resource");
    const resource = selected[0], matching = artifacts.filter(a => a.artifactId === resource.artifactId && a.artifactVersionId === resource.artifactVersionId && a.contentHash === resource.contentHash);
    if (matching.length !== 1) v.invalid("resources", "Resource is not frozen in this Release");
    same(matching[0].kind, key.startsWith("contract.") ? "interaction-contract" : key.startsWith("workflow.") ? "workflow" : "pipeline", "resource.kind");
    return [field, resource.artifactVersionId];
  }));
  return parseAirpReleaseTarget({ ...ids, version: 1, applicationId: r.applicationId, releaseId: r.id,
    releaseHash: r.contentHash, packageHash: lock.packageContentHash, greetingId: v.record(manifest.application, "application").defaultGreetingId });
}
export function prepareAirpSession(target: AirpReleaseTarget, rawIdentity: AirpSessionIdentity): AirpSessionTicket {
  const r = v.record(rawIdentity, "session.identity", ["saveId", "epoch", "mode", "content"]), c = v.record(r.content, "content", ["id", "version", "digest"]);
  const identity: AirpSessionIdentity = { saveId: v.id(r.saveId, "saveId"), epoch: v.id(r.epoch, "epoch"), mode: v.choice(r.mode, ["play", "development"], "mode"),
    content: { id: v.id(c.id, "content.id"), version: v.number(c.version, "content.version", 1), digest: airpDigest(c.digest, "content.digest") } };
  const frozen = { version: 1 as const, target: parseAirpReleaseTarget(target), identity };
  return { ...frozen, requestId: `airp-session:${airpHash(frozen)}` };
}
export function parseAirpSessionTicket(raw: unknown): AirpSessionTicket {
  v.assertJson(raw);
  const r = v.record(raw, "session.ticket", ["version", "target", "identity", "requestId"]);
  const expected = prepareAirpSession(parseAirpReleaseTarget(r.target), r.identity as AirpSessionIdentity);
  same(raw, expected, "session.ticket");
  return expected;
}
export function airpSessionInput(raw: AirpSessionTicket) {
  const ticket = parseAirpSessionTicket(raw), { identity: i, target: t } = ticket;
  return {
    applicationReleaseId: t.releaseId, greetingId: t.greetingId,
    title: `${i.mode === "play" ? "Abyssa 游玩" : "AIRP 开发"} · ${i.saveId}`,
    participant: {
      id: ticket.requestId, name: "凯尔", description: "Abyssa 玩家角色；叙事模型不得代替玩家发言或结算玩法。",
      metadata: { airpBindingRequestId: ticket.requestId, airpSaveId: i.saveId, airpEpoch: i.epoch, airpMode: i.mode, airpContentDigest: i.content.digest },
    },
  };
}
export function verifyAirpRuntime(raw: unknown, target: AirpReleaseTarget): void {
  const runtime = v.record(raw, "runtime"), application = v.record(runtime.application, "runtime.application");
  same(runtime.version, "application-runtime-v6", "runtime.version");
  same(application.id, target.applicationId, "runtime.applicationId"); same(application.releaseId, target.releaseId, "runtime.releaseId"); same(application.contentHash, target.releaseHash, "runtime.releaseHash");
  const lock = v.record(runtime.packageLock, "runtime.packageLock");
  same(lock.packageId, "app.abyssa.airp", "runtime.package");
  const keys = resourceKeysFor(lock.packageVersion, "runtime.packageVersion");
  same(lock.packageContentHash, target.packageHash, "runtime.packageHash");
  const resources = v.list(runtime.packageResources, "runtime.resources", 128).map(r => v.record(r, "resource"));
  for (const [field, key] of Object.entries(keys)) {
    const matches = resources.filter(r => r.logicalKey === key);
    if (matches.length !== 1) v.invalid("runtime.resources", "Missing frozen resource");
    same(matches[0].artifactVersionId, target[field as keyof typeof resourceKeys], `runtime.${key}`);
  }
  const slots = v.record(runtime.modelSlotBindings, "runtime.modelSlotBindings");
  for (const id of ["model.planning", "model.writing", "model.updater"]) airpOpaqueId(v.record(slots[id], `slot.${id}`).modelTargetId, "modelTargetId");
}

/** Creation and lost-response recovery may adopt only a fresh, exact-identity Session. */
export function decodeAirpFreshSession(raw: unknown, rawTicket: AirpSessionTicket): AirpRpBinding {
  v.assertJson(raw);
  const ticket = parseAirpSessionTicket(rawTicket), r = v.record(raw, "session.detail"), s = v.record(r.session, "session"), context = v.record(r.context, "session.context");
  same(s.status, "active", "session.status"); same(s.kind, "primary", "session.kind");
  same(s.applicationId, ticket.target.applicationId, "session.application"); same(s.applicationReleaseId, ticket.target.releaseId, "session.release");
  same(s.greetingId, ticket.target.greetingId, "session.greeting"); same(s.participant, airpSessionInput(ticket).participant, "session.participant");
  same(s.floorCount, 0, "session.floorCount"); same(s.branchCount, 1, "session.branchCount");
  same(context.sessionId, s.id, "context.sessionId"); verifyAirpRuntime(context.context, ticket.target);
  return parseAirpBinding({ applicationId: ticket.target.applicationId, releaseId: ticket.target.releaseId, sessionId: s.id, threadId: s.id, branchId: s.mainBranchId,
    contractVersionId: ticket.target.contractVersionId, writingPipelineVersionId: ticket.target.writingPipelineVersionId, head: null });
}
export function verifyAirpFreshBranch(raw: unknown, binding: AirpRpBinding): void {
  const r = v.record(raw, "branches"); same(r.threadId, binding.threadId, "branches.threadId");
  const branches = v.list(r.branches, "branches", 1).map(r => v.record(r, "branch"));
  if (branches.length !== 1) v.invalid("branch", "A fresh binding requires one empty native branch");
  const branch = branches[0]; same(branch.id, binding.branchId, "branch.id"); same(branch.threadId, binding.threadId, "branch.threadId");
  same(branch.headFloorId, null, "branch.head"); same(branch.visibleFloorCount, 0, "branch.floors"); same(branch.sourceBranchId, null, "branch.source");
}
export function verifyAirpBranchContext(raw: unknown, binding: AirpRpBinding, target: AirpReleaseTarget): void {
  const context = v.record(raw, "branch.context");
  same(context.threadId, binding.threadId, "context.threadId");
  verifyAirpRuntime(context.context, target);
}
export function findAirpSessionCandidates(raw: unknown, rawTicket: AirpSessionTicket): string[] {
  const ticket = parseAirpSessionTicket(rawTicket), sessions = v.list(v.record(raw, "sessions").sessions, "sessions", 10000).map(s => v.record(s, "session"));
  return sessions.filter(s => {
    const p = v.record(s.participant, "participant"), metadata = v.record(p.metadata, "participant.metadata");
    return p.id === ticket.requestId || metadata.airpBindingRequestId === ticket.requestId;
  }).map(s => airpOpaqueId(s.id, "session.id"));
}
