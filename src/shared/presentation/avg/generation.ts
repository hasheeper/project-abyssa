import { EMOTION_LABELS, type EmotionId } from "../../domain/presentation/emotion";
import { avgEnum, avgInvalid, avgObject, avgText, type AvgFrame } from "../../domain/avg/story";

export type AvgGenerationRequest = {
  version: 1; requestId: string; sceneId: string; nodeId: string;
  /** Includes save/epoch/revision and local page. Never accept output for a different reading position. */
  contextKey: string;
  instruction: string;
  actors: { id: string; name: string; direction: string }[];
  emotions: EmotionId[];
  context: { actorId?: string; text: string }[];
  facts: { id: string; text: string }[];
  maxLines: number;
};
export type AvgGenerationReply = {
  version: 1; requestId: string; sceneId: string; nodeId: string; contextKey: string;
  lines: { actorId: string; text: string; emotion: EmotionId }[];
};
export function avgReplySchema(request: AvgGenerationRequest) {
  return {
    type: "object", additionalProperties: false,
    required: ["version", "requestId", "sceneId", "nodeId", "contextKey", "lines"],
    properties: {
      version: { const: 1 }, requestId: { const: request.requestId }, sceneId: { const: request.sceneId },
      nodeId: { const: request.nodeId }, contextKey: { const: request.contextKey },
      lines: { type: "array", minItems: 1, maxItems: request.maxLines, items: {
        type: "object", additionalProperties: false, required: ["actorId", "text", "emotion"],
        properties: { actorId: { enum: request.actors.map(a => a.id) }, text: { type: "string", minLength: 1, maxLength: 500 }, emotion: { enum: request.emotions } },
      } },
    },
  };
}

export function parseAvgReply(raw: unknown, request: AvgGenerationRequest): AvgFrame[] {
  if (typeof raw === "string") {
    if (raw.length > 32768) avgInvalid("reply", "response too large");
    raw = JSON.parse(raw);
  }
  const reply = avgObject(raw, "reply", ["version", "requestId", "sceneId", "nodeId", "contextKey", "lines"]);
  for (const field of ["version", "requestId", "sceneId", "nodeId", "contextKey"] as const)
    if (reply[field] !== request[field]) avgInvalid(`reply.${field}`, "request identity mismatch");
  if (!Array.isArray(reply.lines) || !reply.lines.length || reply.lines.length > request.maxLines) avgInvalid("reply.lines", "invalid line count");
  return reply.lines.map((raw, index): AvgFrame => {
    const p = `reply.lines[${index}]`, line = avgObject(raw, p, ["actorId", "text", "emotion"]);
    avgEnum(line.actorId, `${p}.actorId`, request.actors.map(a => a.id));
    avgEnum(line.emotion, `${p}.emotion`, request.emotions);
    avgText(line.text, `${p}.text`, 500);
    return { id: `generated.${request.requestId}.${index}`, kind: "dialogue", actorId: line.actorId as string, text: line.text, emotion: line.emotion as EmotionId };
  });
}

export type AvgGenerationProvider = {
  generate(request: AvgGenerationRequest, options: { signal: AbortSignal; responseSchema: ReturnType<typeof avgReplySchema> }): Promise<unknown>;
};
export type AvgGenerationResult = { status: "accepted"; frames: AvgFrame[] } | { status: "cancelled" | "stale" | "timeout" } | { status: "failed"; message: string };

/** Latest request wins. Cancelling resolves even if the provider ignores AbortSignal. */
export function createAvgGenerator(provider: AvgGenerationProvider, timeoutMs = 15000) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw new Error("Invalid AVG generation timeout");
  let active: AbortController | undefined;
  return {
    cancel() { active?.abort(); },
    async generate(input: AvgGenerationRequest, isCurrent: (contextKey: string) => boolean): Promise<AvgGenerationResult> {
      active?.abort();
      const controller = new AbortController(); active = controller;
      const request = structuredClone(input);
      if (!isCurrent(request.contextKey)) { active = undefined; return { status: "stale" }; }
      let timer: ReturnType<typeof setTimeout> | undefined, timedOut = false;
      try {
        if (!request.actors.length || request.actors.length > 16 || !Number.isInteger(request.maxLines) || request.maxLines < 1 || request.maxLines > 8) avgInvalid("request", "invalid actors/line budget");
        if (!request.emotions.length || request.emotions.some(e => !Object.hasOwn(EMOTION_LABELS, e))) avgInvalid("request.emotions", "unsupported emotion");
        const interrupted = new Promise<never>((_, reject) => controller.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
        timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
        const result = await Promise.race([Promise.resolve().then(() => {
          if (controller.signal.aborted) throw new Error("aborted");
          return provider.generate(structuredClone(request), { signal: controller.signal, responseSchema: avgReplySchema(request) });
        }), interrupted]);
        if (controller.signal.aborted) return { status: timedOut ? "timeout" : "cancelled" };
        if (!isCurrent(request.contextKey)) return { status: "stale" };
        return { status: "accepted", frames: parseAvgReply(result, request) };
      } catch (error) {
        if (controller.signal.aborted) return { status: timedOut ? "timeout" : "cancelled" };
        return { status: "failed", message: error instanceof Error ? error.message : "AVG generation failed" };
      } finally {
        clearTimeout(timer);
        if (active === controller) active = undefined;
      }
    },
  };
}
