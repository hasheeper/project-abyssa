import { describe, expect, it } from "vitest";
import { airpSessionFixture } from "../testing/airp-session-fixture";
import { airpSessionInput, decodeAirpFreshSession, decodeAirpRelease, findAirpSessionCandidates, parseAirpSessionTicket, prepareAirpSession, verifyAirpBranchContext, verifyAirpFreshBranch, verifyAirpRuntime } from "./rp-session";

describe("AIRP native Release and Session binding", () => {
  it.each(["0.2.0", "0.2.1", "0.3.0", "0.3.1", "0.3.2"])("%s binds the final formatter, never the raw literary writer", version => {
    const f = airpSessionFixture(version);
    expect(f.target.writingPipelineVersionId).toBe("version-pipeline.formatting");
    expect(() => decodeAirpFreshSession(f.detail, f.ticket)).not.toThrow();
    expect(() => verifyAirpRuntime(f.runtime, { ...f.target, writingPipelineVersionId: "version-pipeline.writing" })).toThrow();
    f.release.manifest.packageResources = f.release.manifest.packageResources.filter(r => r.logicalKey !== "pipeline.formatting");
    expect(() => decodeAirpRelease(f.release, f.target.releaseId)).toThrow();
  });
  it.each(["0.1.0", "0.1.1", "0.1.2", "0.1.3", "0.2.0", "0.2.1", "0.3.0", "0.3.1", "0.3.2"])("accepts reviewed version %s while retaining exact package hash checks", version => {
    const f = airpSessionFixture(version);
    expect(decodeAirpRelease(f.release, f.target.releaseId)).toEqual(f.target);
    if (version.startsWith("0.1.")) expect(f.target.writingPipelineVersionId).toBe("version-pipeline.writing");
    expect(() => decodeAirpFreshSession(f.detail, f.ticket)).not.toThrow();
    f.runtime.packageLock.packageContentHash = "0".repeat(64);
    expect(() => decodeAirpFreshSession(f.detail, f.ticket)).toThrow();
  });
  it.each(["0.1.4", "0.2.2", "0.3.3", "0.4.0", "1.0.0", "0.3.2-preview", "unreviewed", "__proto__", null, 3])("rejects unreviewed version %s in both Release and Runtime", version => {
    const f = airpSessionFixture();
    Object.assign(f.release.manifest.packageLock, { packageVersion: version });
    expect(() => decodeAirpRelease(f.release, f.target.releaseId)).toThrow();
    expect(() => verifyAirpRuntime(f.runtime, f.target)).toThrow();
  });
  it.each(["0.3.0", "0.3.1", "0.3.2"])("does not accept the %s reformatter as the frozen generation output", version => {
    const f = airpSessionFixture(version);
    const formatter = f.runtime.packageResources.find(r => r.logicalKey === "pipeline.formatting")!;
    formatter.logicalKey = "pipeline.reformatting";
    expect(() => decodeAirpRelease(f.release, f.target.releaseId)).toThrow();
    expect(() => verifyAirpRuntime(f.runtime, f.target)).toThrow();
  });
  it("resolves logical resource keys from the explicitly selected frozen Release", () => {
    const f = airpSessionFixture();
    expect(decodeAirpRelease(f.release, f.target.releaseId)).toEqual(f.target);
    const binding = decodeAirpFreshSession(f.detail, f.ticket);
    expect(binding).toMatchObject({ sessionId: f.detail.session.id, threadId: f.detail.session.id, branchId: f.detail.session.mainBranchId, head: null });
    expect(() => verifyAirpFreshBranch(f.branches, binding)).not.toThrow();
    expect(() => verifyAirpBranchContext(f.context, binding, f.target)).not.toThrow();
  });
  it.each([
    (f: ReturnType<typeof airpSessionFixture>) => { f.release.id = "other-release"; },
    f => { f.release.manifest.packageLock.packageId = "other-package"; },
    f => { f.release.manifest.packageLock.packageVersion = "unreviewed"; },
    f => { f.release.manifest.schemaVersion = 3; },
    f => { f.release.manifest.artifacts[0].artifactVersionId = "unbound"; },
    f => { f.release.manifest.packageResources.push(f.release.manifest.packageResources[0]); },
  ])("rejects a wrong or ambiguous Release %#", mutate => {
    const f = airpSessionFixture(); mutate(f);
    expect(() => decodeAirpRelease(f.release, f.target.releaseId)).toThrow();
  });
  it("separates play/development, copies and content versions in durable identities", () => {
    const f = airpSessionFixture();
    const ids = [f.ticket.requestId, prepareAirpSession(f.target, { ...f.identity, mode: "development" }).requestId,
      prepareAirpSession(f.target, { ...f.identity, epoch: "epoch.copy" }).requestId,
      prepareAirpSession(f.target, { ...f.identity, content: { ...f.identity.content, version: 11 } }).requestId];
    expect(new Set(ids).size).toBe(4);
    expect(parseAirpSessionTicket(JSON.parse(JSON.stringify(f.ticket)))).toEqual(f.ticket);
    expect(airpSessionInput(f.ticket)).not.toHaveProperty("clientRequestId"); // not a supported native capability
  });
  it.each([
    (f: ReturnType<typeof airpSessionFixture>) => { f.detail.session.status = "archived"; },
    f => { f.detail.session.floorCount = 1; },
    f => { f.detail.session.branchCount = 2; },
    f => { f.detail.session.participant.metadata.airpMode = "development"; },
    f => { f.runtime.packageLock.packageContentHash = "0".repeat(64); },
    f => { delete f.runtime.modelSlotBindings["model.updater"]; },
    f => { f.runtime.packageResources[0].artifactVersionId = "changed-contract"; },
  ])("does not adopt an already-used or mismatched Session %#", mutate => {
    const f = airpSessionFixture(); mutate(f);
    expect(() => decodeAirpFreshSession(f.detail, f.ticket)).toThrow();
  });
  it("finds exact creation metadata and never selects by title or the active branch", () => {
    const f = airpSessionFixture();
    const other = structuredClone(f.detail.session);
    other.id = "other"; other.participant.id = "different"; other.participant.metadata.airpBindingRequestId = "different";
    expect(findAirpSessionCandidates({ sessions: [other, f.detail.session] }, f.ticket)).toEqual([f.detail.session.id]);
    const binding = decodeAirpFreshSession(f.detail, f.ticket);
    f.branches.branches[0].headFloorId = "new-head";
    expect(() => verifyAirpFreshBranch(f.branches, binding)).toThrow();
  });
});
