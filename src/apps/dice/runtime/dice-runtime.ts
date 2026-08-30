import type { BetAction, MoodKey } from "../game";

const PIPELINES = {
  reaction: "pipelines/realtime/tibby-reaction.json",
  outline: "pipelines/postgame/battle-outline.json",
  polish: [
    "pipelines/postgame/battle-polish.json",
    "pipelines/postgame/battle-polish-b.json",
    "pipelines/postgame/battle-polish-c.json",
  ],
  review: "pipelines/postgame/battle-review.json",
  proposal: "pipelines/postgame/state-memory-proposal.json",
} as const;

const REQUIRED_PIPELINES = [
  PIPELINES.reaction,
  PIPELINES.outline,
  ...PIPELINES.polish,
  PIPELINES.review,
  PIPELINES.proposal,
] as const;

export interface RealtimeDecisionInput {
  gameState: string;
  allowedActions: BetAction[];
  recentEvents: string[];
}

export interface RealtimeDecision {
  action: BetAction;
  mood: MoodKey;
  line: string;
}

export type BattleReportStage = "outline" | "polish" | "review" | "proposal";

export interface BattleReportResult {
  outline: string;
  candidates: string[];
  finalReport: string;
  stateMemoryProposal: string;
}

export type DiceRuntimeReadiness =
  | {
      state: "ready";
      applicationId: string;
      releaseId: string;
      releaseVersion: string;
    }
  | { state: "unavailable"; message: string };

export interface DiceRuntimePort {
  checkReadiness(): Promise<DiceRuntimeReadiness>;
  decideRealtime(
    input: RealtimeDecisionInput,
  ): Promise<RealtimeDecision | null>;
  generateBattleReport(
    battleRecord: string,
    targetLength: number,
    onStage?: (stage: BattleReportStage) => void,
  ): Promise<BattleReportResult>;
  dispose(): void;
}

type ApplicationSummary = {
  id: string;
  slug: string;
  currentReleaseId: string | null;
};

type Release = {
  id: string;
  version: string;
  manifest: {
    artifacts: Array<{
      artifactId: string;
      mountPath: string;
      artifactVersionId: string;
    }>;
    pipelines: Array<{
      artifactId: string;
      artifactVersionId: string;
      modelRoles: Array<{ artifactId: string }>;
    }>;
  };
};

type ModelBinding = {
  pipelineArtifactId: string;
  modelRoleId: string;
  modelTargetId: string;
};

type RuntimeSelection = {
  applicationReleaseId: string;
  pipelineArtifactVersionId: string;
};

type RuntimeDefinition = {
  applicationId: string;
  release: Release;
  selections: Map<string, RuntimeSelection>;
};

type StreamEvent = {
  type: string;
  data: Record<string, unknown>;
};

export function createDiceRuntimePort(): DiceRuntimePort | null {
  if (
    import.meta.env.MODE === "test" ||
    import.meta.env.VITE_DICE_RUNTIME_ENABLED === "false"
  ) {
    return null;
  }
  return createHttpDiceRuntimePort({
    baseUrl: import.meta.env.VITE_DICE_RUNTIME_API_BASE_URL ?? "/api/v1",
    applicationSlug:
      import.meta.env.VITE_DICE_RUNTIME_APPLICATION_SLUG ?? "lumen-dice",
  });
}

export function createHttpDiceRuntimePort({
  baseUrl,
  applicationSlug = "lumen-dice",
  request = globalThis.fetch.bind(globalThis),
  createId = createRequestId,
}: {
  baseUrl: string;
  applicationSlug?: string;
  request?: typeof fetch;
  createId?: () => string;
}): DiceRuntimePort {
  return new HttpDiceRuntimePort(
    baseUrl.replace(/\/$/u, ""),
    applicationSlug,
    request,
    createId,
  );
}

class HttpDiceRuntimePort implements DiceRuntimePort {
  private definitionPromise: Promise<RuntimeDefinition> | null = null;
  private readonly activeRequests = new Set<AbortController>();

  constructor(
    private readonly baseUrl: string,
    private readonly applicationSlug: string,
    private readonly request: typeof fetch,
    private readonly createId: () => string,
  ) {}

  async checkReadiness(): Promise<DiceRuntimeReadiness> {
    try {
      const definition = await this.resolveDefinition();
      return {
        state: "ready",
        applicationId: definition.applicationId,
        releaseId: definition.release.id,
        releaseVersion: definition.release.version,
      };
    } catch (error) {
      return {
        state: "unavailable",
        message:
          error instanceof Error
            ? error.message
            : "Dice Runtime is unavailable.",
      };
    }
  }

  async decideRealtime(
    input: RealtimeDecisionInput,
  ): Promise<RealtimeDecision | null> {
    try {
      const output = await this.invoke(
        PIPELINES.reaction,
        {
          gameState: input.gameState,
          allowedActions: input.allowedActions.join(","),
          recentEvents: input.recentEvents.slice(-12).join("\n") || "(none)",
        },
        4000,
        this.createId(),
      );
      return parseRealtimeDecision(output, input.allowedActions);
    } catch {
      return null;
    }
  }

  async generateBattleReport(
    battleRecord: string,
    targetLength: number,
    onStage?: (stage: BattleReportStage) => void,
  ): Promise<BattleReportResult> {
    const workflowId = this.createId();
    onStage?.("outline");
    const outline = await this.invoke(
      PIPELINES.outline,
      {
        battleRecord,
        targetLength,
        reportIntent: "完整复盘这一局光影骰局，突出信息博弈与角色反应。",
      },
      45_000,
      `${workflowId}.outline`,
    );

    onStage?.("polish");
    const styleBriefs = [
      "强调节奏、动作和赌桌张力，语言利落。",
      "强调缇比与勇者的性格互动，保留轻微戏谑感。",
      "强调规则信息、公开骰与暗骰造成的推理转折。",
    ];
    const candidates = await Promise.all(
      styleBriefs.map((styleBrief, index) =>
        this.invoke(
          PIPELINES.polish[index]!,
          { outline, battleRecord, styleBrief },
          60_000,
          `${workflowId}.polish-${index + 1}`,
        ),
      ),
    );

    onStage?.("review");
    const finalReport = await this.invoke(
      PIPELINES.review,
      {
        outline,
        battleRecord,
        candidates: JSON.stringify(candidates),
        targetLength,
      },
      75_000,
      `${workflowId}.review`,
    );

    onStage?.("proposal");
    const stateMemoryProposal = await this.invoke(
      PIPELINES.proposal,
      { finalReport, battleRecord },
      45_000,
      `${workflowId}.proposal`,
    );
    return { outline, candidates, finalReport, stateMemoryProposal };
  }

  dispose(): void {
    for (const controller of this.activeRequests) controller.abort();
    this.activeRequests.clear();
  }

  private async invoke(
    pipelinePath: string,
    inputs: Record<string, string | number | boolean>,
    timeoutMs: number,
    clientRequestId: string,
  ): Promise<string> {
    const definition = await this.resolveDefinition();
    const selection = definition.selections.get(pipelinePath);
    if (!selection)
      throw new Error(`Released Dice Pipeline is missing: ${pipelinePath}`);
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    this.activeRequests.add(controller);
    try {
      const response = await this.request(
        `${this.baseUrl}/runtime/invocations/stream`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...selection,
            inputs,
            clientRequestId,
          }),
          signal: controller.signal,
        },
      );
      if (!response.ok) throw await responseError(response);
      if (!response.body) throw new Error("Runtime stream is unavailable.");
      let output = "";
      for await (const event of readEventStream(response.body)) {
        if (
          event.type === "output" &&
          typeof event.data.outputText === "string"
        ) {
          output = event.data.outputText;
        }
        if (event.type === "done") {
          const result = event.data.result as
            { outputText?: unknown } | undefined;
          if (typeof result?.outputText === "string")
            output = result.outputText;
          return output;
        }
        if (event.type === "error") {
          throw new Error(
            typeof event.data.message === "string"
              ? event.data.message
              : "Runtime invocation failed.",
          );
        }
      }
      throw new Error("Runtime stream ended before completion.");
    } finally {
      globalThis.clearTimeout(timeout);
      this.activeRequests.delete(controller);
    }
  }

  private async resolveDefinition(): Promise<RuntimeDefinition> {
    this.definitionPromise ??= this.loadDefinition().catch((error) => {
      this.definitionPromise = null;
      throw error;
    });
    return this.definitionPromise;
  }

  private async loadDefinition(): Promise<RuntimeDefinition> {
    const catalog = await this.get<{ applications: ApplicationSummary[] }>(
      "/applications",
    );
    const application = catalog.applications.find(
      (item) => item.slug === this.applicationSlug,
    );
    if (!application?.currentReleaseId) {
      throw new Error("The Lumen Dice Application has no active Release.");
    }
    const [release, bindingData] = await Promise.all([
      this.get<Release>(
        `/releases/${encodeURIComponent(application.currentReleaseId)}`,
      ),
      this.get<{ bindings: ModelBinding[] }>(
        `/applications/${encodeURIComponent(application.id)}/model-bindings`,
      ),
    ]);
    const selections = new Map<string, RuntimeSelection>();
    const missingBindings: string[] = [];
    for (const path of REQUIRED_PIPELINES) {
      const resolved = releasedPipeline(release, path);
      selections.set(path, resolved.selection);
      const binding = bindingData.bindings.find(
        (item) =>
          item.pipelineArtifactId === resolved.pipelineArtifactId &&
          item.modelRoleId === resolved.modelRoleId,
      );
      if (!binding?.modelTargetId) missingBindings.push(path);
    }
    if (missingBindings.length) {
      throw new Error(
        `Dice Runtime has unbound Pipelines: ${missingBindings.join(", ")}`,
      );
    }
    return { applicationId: application.id, release, selections };
  }

  private async get<Value>(path: string): Promise<Value> {
    const response = await this.request(`${this.baseUrl}${path}`);
    if (!response.ok) throw await responseError(response);
    const payload = (await response.json()) as { data?: Value };
    if (!("data" in payload))
      throw new Error("Runtime API returned invalid JSON.");
    return payload.data as Value;
  }
}

function releasedPipeline(
  release: Release,
  path: string,
): {
  pipelineArtifactId: string;
  modelRoleId: string;
  selection: RuntimeSelection;
} {
  const artifact = release.manifest.artifacts.find(
    (item) => item.mountPath === path,
  );
  if (!artifact) throw new Error(`Released Dice Pipeline is missing: ${path}`);
  const pipeline = release.manifest.pipelines.find(
    (item) =>
      item.artifactId === artifact.artifactId &&
      item.artifactVersionId === artifact.artifactVersionId,
  );
  const modelRoleId = pipeline?.modelRoles[0]?.artifactId;
  if (!pipeline || !modelRoleId) {
    throw new Error(`Released Dice Pipeline has no Model Role: ${path}`);
  }
  return {
    pipelineArtifactId: artifact.artifactId,
    modelRoleId,
    selection: {
      applicationReleaseId: release.id,
      pipelineArtifactVersionId: artifact.artifactVersionId,
    },
  };
}

function parseRealtimeDecision(
  output: string,
  allowedActions: BetAction[],
): RealtimeDecision | null {
  const fields = new Map(
    output
      .split(/\r?\n/u)
      .map((line) => line.match(/^([A-Z]+)=(.*)$/u))
      .filter((match): match is RegExpMatchArray => Boolean(match))
      .map((match) => [match[1]!, match[2]!.trim()]),
  );
  const action = fields.get("ACTION")?.toLowerCase() as BetAction | undefined;
  const mood = fields.get("MOOD")?.toLowerCase() as MoodKey | undefined;
  const line = fields.get("LINE") ?? "";
  if (!action || !allowedActions.includes(action) || !isMood(mood) || !line) {
    return null;
  }
  return { action, mood, line: line.slice(0, 240) };
}

function isMood(value: string | undefined): value is MoodKey {
  return Boolean(
    value &&
    ["calm", "thinking", "amused", "curious", "surprised", "serious"].includes(
      value,
    ),
  );
}

async function* readEventStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder
        .decode(value, { stream: !done })
        .replaceAll("\r\n", "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const type = frame
          .split("\n")
          .find((line) => line.startsWith("event:"))
          ?.slice(6)
          .trim();
        const data = frame
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n");
        if (type && data)
          yield { type, data: JSON.parse(data) as Record<string, unknown> };
        boundary = buffer.indexOf("\n\n");
      }
      if (done) return;
    }
  } finally {
    reader.releaseLock();
  }
}

async function responseError(response: Response): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return new Error(
    payload?.error?.message ?? `Runtime request failed (${response.status}).`,
  );
}

function createRequestId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
