import { describe, expect, it, vi } from "vitest";
import { createHttpDiceRuntimePort } from "./dice-runtime";

const pipelinePaths = [
  "pipelines/realtime/tibby-reaction.json",
  "pipelines/postgame/battle-outline.json",
  "pipelines/postgame/battle-polish.json",
  "pipelines/postgame/battle-polish-b.json",
  "pipelines/postgame/battle-polish-c.json",
  "pipelines/postgame/battle-review.json",
  "pipelines/postgame/state-memory-proposal.json",
] as const;

const released = pipelinePaths.map((path, index) => ({
  path,
  artifactId: `pipeline-${index}`,
  artifactVersionId: `pipeline-version-${index}`,
  modelRoleId: `role-${index}`,
}));

describe("Dice Runtime adapter", () => {
  it("reports missing Pipeline-scoped bindings before an invocation", async () => {
    const request = createRuntimeFetch({ missingBindingIndex: 4 });
    const port = createHttpDiceRuntimePort({
      baseUrl: "http://runtime.test/api/v1/",
      request,
    });

    await expect(port.checkReadiness()).resolves.toEqual({
      state: "unavailable",
      message:
        "Dice Runtime has unbound Pipelines: pipelines/postgame/battle-polish-c.json",
    });
    expect(
      request.mock.calls.some(([url]) =>
        String(url).endsWith("/runtime/invocations/stream"),
      ),
    ).toBe(false);
  });

  it("uses three released polish Pipelines and stable workflow request IDs", async () => {
    const request = createRuntimeFetch();
    const stages: string[] = [];
    const port = createHttpDiceRuntimePort({
      baseUrl: "http://runtime.test/api/v1",
      request,
      createId: () => "workflow-1",
    });

    await expect(port.checkReadiness()).resolves.toMatchObject({
      state: "ready",
      applicationId: "app-dice",
      releaseId: "release-dice",
    });
    await expect(
      port.generateBattleReport("frozen-record", 1200, (stage) =>
        stages.push(stage),
      ),
    ).resolves.toEqual({
      outline: "outline",
      candidates: ["candidate-a", "candidate-b", "candidate-c"],
      finalReport: "final-report",
      stateMemoryProposal: "proposal",
    });
    expect(stages).toEqual(["outline", "polish", "review", "proposal"]);

    const invocations = request.mock.calls
      .filter(([url]) => String(url).endsWith("/runtime/invocations/stream"))
      .map(([, init]) => JSON.parse(String(init?.body)) as InvocationBody);
    expect(invocations.map((item) => item.pipelineArtifactVersionId)).toEqual([
      "pipeline-version-1",
      "pipeline-version-2",
      "pipeline-version-3",
      "pipeline-version-4",
      "pipeline-version-5",
      "pipeline-version-6",
    ]);
    expect(invocations.map((item) => item.clientRequestId)).toEqual([
      "workflow-1.outline",
      "workflow-1.polish-1",
      "workflow-1.polish-2",
      "workflow-1.polish-3",
      "workflow-1.review",
      "workflow-1.proposal",
    ]);
    expect(invocations[4]?.inputs).toMatchObject({
      candidates: JSON.stringify(["candidate-a", "candidate-b", "candidate-c"]),
      battleRecord: "frozen-record",
      targetLength: 1200,
    });
  });

  it("accepts only allowed realtime actions and bounds recent evidence", async () => {
    const request = createRuntimeFetch();
    const port = createHttpDiceRuntimePort({
      baseUrl: "http://runtime.test/api/v1",
      request,
      createId: () => "reaction-1",
    });
    const recentEvents = Array.from(
      { length: 20 },
      (_, index) => `event-${index}`,
    );

    await expect(
      port.decideRealtime({
        gameState: '{"ownDice":[1,2,3,4,5]}',
        allowedActions: ["check", "fold"],
        recentEvents,
      }),
    ).resolves.toEqual({
      action: "check",
      mood: "amused",
      line: "我先看看。",
    });
    const invocation = request.mock.calls
      .filter(([url]) => String(url).endsWith("/runtime/invocations/stream"))
      .map(([, init]) => JSON.parse(String(init?.body)) as InvocationBody)[0];
    expect(invocation?.clientRequestId).toBe("reaction-1");
    expect(String(invocation?.inputs.recentEvents).split("\n")).toEqual(
      recentEvents.slice(-12),
    );
  });
});

type InvocationBody = {
  pipelineArtifactVersionId: string;
  clientRequestId: string;
  inputs: Record<string, unknown>;
};

function createRuntimeFetch({
  missingBindingIndex,
}: { missingBindingIndex?: number } = {}) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    if (path === "/api/v1/applications") {
      return Response.json({
        data: {
          applications: [
            {
              id: "app-dice",
              slug: "lumen-dice",
              currentReleaseId: "release-dice",
            },
          ],
        },
      });
    }
    if (path === "/api/v1/releases/release-dice") {
      return Response.json({ data: releaseFixture() });
    }
    if (path === "/api/v1/applications/app-dice/model-bindings") {
      return Response.json({
        data: {
          bindings: released
            .filter((_, index) => index !== missingBindingIndex)
            .map((item) => ({
              pipelineArtifactId: item.artifactId,
              modelRoleId: item.modelRoleId,
              modelTargetId: `target-${item.artifactId}`,
            })),
        },
      });
    }
    if (path === "/api/v1/runtime/invocations/stream") {
      const body = JSON.parse(String(init?.body)) as InvocationBody;
      const output = outputFor(body.pipelineArtifactVersionId);
      return new Response(
        `event: output\ndata: ${JSON.stringify({ outputText: output })}\n\n` +
          `event: done\ndata: ${JSON.stringify({ result: { outputText: output } })}\n\n`,
        { headers: { "content-type": "text/event-stream" } },
      );
    }
    return Response.json(
      { error: { message: `Unexpected request: ${path}` } },
      { status: 404 },
    );
  });
}

function releaseFixture() {
  return {
    id: "release-dice",
    version: "0.2.0",
    manifest: {
      artifacts: released.map((item) => ({
        artifactId: item.artifactId,
        artifactVersionId: item.artifactVersionId,
        mountPath: item.path,
      })),
      pipelines: released.map((item) => ({
        artifactId: item.artifactId,
        artifactVersionId: item.artifactVersionId,
        modelRoles: [{ artifactId: item.modelRoleId }],
      })),
    },
  };
}

function outputFor(artifactVersionId: string): string {
  const index = Number(artifactVersionId.replace("pipeline-version-", ""));
  return [
    "ACTION=check\nMOOD=amused\nLINE=我先看看。",
    "outline",
    "candidate-a",
    "candidate-b",
    "candidate-c",
    "final-report",
    "proposal",
  ][index]!;
}
