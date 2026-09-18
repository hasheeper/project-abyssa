import { airpSessionInput, decodeAirpRelease, prepareAirpSession } from "../airp/rp-session";
import { airpOnlineFixture } from "./airp-online-fixture";

export function airpSessionFixture(packageVersion = "0.1.0") {
  const f = airpOnlineFixture();
  const resources = ["contract.airp", "pipeline.writing", "pipeline.outline", "pipeline.updater", "workflow.scene", ...(["0.2.0", "0.2.1", "0.3.0", "0.3.1", "0.3.2"].includes(packageVersion) ? ["pipeline.formatting"] : [])].map(logicalKey => ({
    logicalKey, artifactId: `artifact-${logicalKey}`, artifactVersionId: `version-${logicalKey}`, contentHash: "e".repeat(64),
  }));
  const packageLock = { packageId: "app.abyssa.airp", packageVersion, packageContentHash: "f".repeat(64) };
  const release = { id: f.binding.releaseId, applicationId: f.binding.applicationId, version: "0.1.0", contentHash: "d".repeat(64),
    manifest: { schemaVersion: 4, applicationId: f.binding.applicationId, version: "0.1.0", packageLock, packageResources: resources,
      application: { defaultGreetingId: "greeting-airp" }, artifacts: resources.map(r => ({ ...r, kind: r.logicalKey.startsWith("contract.") ? "interaction-contract" : r.logicalKey.startsWith("workflow.") ? "workflow" : "pipeline" })) } };
  const target = decodeAirpRelease(release, release.id);
  const identity = { saveId: f.request.source.head.saveId, epoch: f.request.source.head.epoch, mode: "play" as const, content: f.request.source.content };
  const ticket = prepareAirpSession(target, identity);
  const runtime = { version: "application-runtime-v6", application: { id: target.applicationId, releaseId: target.releaseId, contentHash: target.releaseHash },
    packageLock, packageResources: resources,
    modelSlotBindings: Object.fromEntries(["model.planning", "model.writing", "model.updater"].map(key => [key, { modelTargetId: "fake-model" }])) };
  const detail = { session: { id: f.binding.sessionId, mainBranchId: f.binding.branchId, status: "active", kind: "primary", applicationId: target.applicationId,
    applicationReleaseId: target.releaseId, greetingId: target.greetingId, participant: airpSessionInput(ticket).participant, floorCount: 0, branchCount: 1 },
    context: { sessionId: f.binding.sessionId, context: runtime } };
  const branches = { threadId: f.binding.threadId, activeBranchId: "not-used", branches: [{ id: f.binding.branchId, threadId: f.binding.threadId, headFloorId: null as string | null, sourceBranchId: null, visibleFloorCount: 0 }] };
  const context = { threadId: f.binding.threadId, context: runtime };
  return { ...f, release, target, identity, ticket, runtime, detail, branches, context };
}
