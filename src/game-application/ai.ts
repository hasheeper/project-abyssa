import * as v from "../game-core/contracts";
import type { GameRecord, HeadRef } from "./contracts";
import { projectFacts, type ProjectedFact } from "./facts";
import { parseHead } from "./parse";
import { sameHead } from "./transaction";
export type AiScene = {
  head: HeadRef;
  expeditionId: string | null;
  sceneId: string;
};
export type AiRequest = {
  version: 1;
  task: "react-to-commit";
  cueId: string;
  source: HeadRef;
  expeditionId: string | null;
  sceneId: string;
  actorIds: string[];
  facts: ProjectedFact[];
  emoteIds: string[];
  actionIds: string[];
  language: "zh-CN";
  budget: { maxLines: number; maxCharacters: number };
  deadlineMs: number;
};
export type AiLine = {
  speakerId: string;
  text: string;
  emoteId: string | null;
  actionId: string | null;
  factIds: string[];
};
export type AiResponse = {
  version: 1;
  task: "react-to-commit";
  cueId: string;
  source: HeadRef;
  expeditionId: string | null;
  sceneId: string;
  lines: AiLine[];
};
export type AiPortResult =
  { status: "success"; output: unknown } | { status: "failed" | "cancelled" };
export type AiTaskHandle = { result: Promise<AiPortResult>; cancel(): void };
export interface AiApplicationPort {
  start(request: AiRequest): AiTaskHandle;
}
export interface AiClockPort {
  now(): number;
  schedule(delayMs: number, callback: () => void): () => void;
}
export type AiAcceptance =
  | { status: "accepted"; output: AiResponse }
  | { status: "skipped"; reason: string };
export type AiCueOptions = {
  cueId: string;
  sceneId: string;
  actorIds: string[];
  emoteIds: string[];
  actionIds: string[];
  timeoutMs: number;
  maxLines: number;
  maxCharacters: number;
};
export function validateAiResponse(
  raw: unknown,
  request: AiRequest,
): AiResponse {
  v.assertJson(raw);
  const r = v.record(raw, "ai", [
    "version",
    "task",
    "cueId",
    "source",
    "expeditionId",
    "sceneId",
    "lines",
  ]);
  v.choice(r.version, [1], "ai.version");
  v.choice(r.task, ["react-to-commit"], "ai.task");
  if (
    r.cueId !== request.cueId ||
    r.expeditionId !== request.expeditionId ||
    r.sceneId !== request.sceneId ||
    !sameHead(parseHead(r.source), request.source)
  )
    v.invalid("ai.source", "AI source mismatch");
  let characters = 0;
  v.list(r.lines, "ai.lines", request.budget.maxLines).forEach((raw) => {
    const line = v.record(raw, "ai.line", [
      "speakerId",
      "text",
      "emoteId",
      "actionId",
      "factIds",
    ]);
    if (!request.actorIds.includes(v.id(line.speakerId, "speakerId")))
      v.invalid("speakerId", "Unauthorized speaker");
    const text = v.text(line.text, "text", request.budget.maxCharacters);
    if (!text.trim() || /[\u0000-\u001f]/.test(text))
      v.invalid("text", "Invalid speech text");
    characters += text.length;
    for (const [key, allowed] of [
      ["emoteId", request.emoteIds],
      ["actionId", request.actionIds],
    ] as const)
      if (line[key] !== null && !allowed.includes(v.id(line[key], key)))
        v.invalid(key, "Unauthorized asset");
    const facts = v.ids(line.factIds, "factIds", 16);
    if (
      !facts.length ||
      facts.some((id) => !request.facts.some((f) => f.id === id))
    )
      v.invalid("factIds", "Unauthorized fact");
  });
  if (characters > request.budget.maxCharacters)
    v.invalid("ai.lines", "Character budget exceeded");
  return structuredClone(raw) as AiResponse;
}
/** Ephemeral presentation coordinator: no store or game-command capability. */
export function createAiCoordinator(
  port: AiApplicationPort,
  clock: AiClockPort,
  currentScene: () => AiScene,
) {
  let disposed = false;
  const seen = new Set<string>();
  const pending = new Set<() => void>();
  return {
    dispose() {
      disposed = true;
      for (const cancel of pending) cancel();
    },
    start(
      record: GameRecord,
      options: AiCueOptions,
    ): { result: Promise<AiAcceptance>; cancel(): void } {
      const skipped = (reason: string) => ({
        result: Promise.resolve({ status: "skipped" as const, reason }),
        cancel() {},
      });
      if (disposed) return skipped("disposed");
      try {
        v.assertJson(options);
        v.record(options, "cue", [
          "cueId",
          "sceneId",
          "actorIds",
          "emoteIds",
          "actionIds",
          "timeoutMs",
          "maxLines",
          "maxCharacters",
        ]);
        v.id(options.cueId, "cueId");
        v.id(options.sceneId, "sceneId");
        v.ids(options.actorIds, "actorIds", 5);
        v.ids(options.emoteIds, "emoteIds", 64);
        v.ids(options.actionIds, "actionIds", 64);
        v.number(options.timeoutMs, "timeoutMs", 1, 60000);
        v.number(options.maxLines, "maxLines", 1, 3);
        v.number(options.maxCharacters, "maxCharacters", 1, 240);
        const visibleFacts = projectFacts(record, options.actorIds);
        // After settlement, the active run is gone. Only this commit's settled
        // fact, cross-checked against the ledger, can authorize its witnesses.
        const settledFact = visibleFacts.find(f => f.kind === "expedition-settled");
        const settledId = (settledFact?.payload as { settlementId?: string } | undefined)?.settlementId;
        const settled = !record.snapshot.expedition && settledId
          ? record.snapshot.campaign.appliedSettlements.find(entry => entry.id === settledId)
          : undefined;
        if (!options.actorIds.length || (!settled && options.actorIds.some(
          id => !record.snapshot.expedition?.party.some(p => p.id === id),
        ))) return skipped("unauthorized-participant");
        if (seen.has(options.cueId)) return skipped("duplicate-cue");
        if (seen.size >= 4096) return skipped("cue-capacity");
        seen.add(options.cueId);
        const request: AiRequest = {
          version: 1,
          task: "react-to-commit",
          cueId: options.cueId,
          source: { ...record.head },
          expeditionId: record.snapshot.expedition?.id ?? settled?.expeditionId ?? null,
          sceneId: options.sceneId,
          actorIds: [...options.actorIds],
          facts: visibleFacts.slice(0, 16),
          emoteIds: [...options.emoteIds],
          actionIds: [...options.actionIds],
          language: "zh-CN",
          budget: {
            maxLines: options.maxLines,
            maxCharacters: options.maxCharacters,
          },
          deadlineMs: clock.now() + options.timeoutMs,
        };
        const validScene = () => {
          const scene = currentScene();
          return (
            sameHead(scene.head, request.source) &&
            scene.expeditionId === request.expeditionId &&
            scene.sceneId === request.sceneId
          );
        };
        if (!validScene()) return skipped("stale-source");
        if (!request.facts.length) return skipped("no-visible-facts");
        let done = false,
          handle: AiTaskHandle | undefined,
          clear = () => {};
        let resolve!: (value: AiAcceptance) => void;
        const result = new Promise<AiAcceptance>((r) => {
          resolve = r;
        });
        const finish = (value: AiAcceptance) => {
          if (done) return;
          done = true;
          clear();
          pending.delete(cancel);
          resolve(value);
        };
        const stop = () => {
          try {
            handle?.cancel();
          } catch {
            /* Cancellation must not affect committed mechanics. */
          }
        };
        const cancel = () => {
          finish({ status: "skipped", reason: "cancelled" });
          stop();
        };
        pending.add(cancel);
        clear = clock.schedule(options.timeoutMs, () => {
          finish({ status: "skipped", reason: "timeout" });
          stop();
        });
        try {
          handle = port.start(structuredClone(request));
          void handle.result.then(
            (value) => {
              if (done) return;
              if (clock.now() >= request.deadlineMs) {
                finish({ status: "skipped", reason: "timeout" });
                return;
              }
              if (!validScene()) {
                finish({ status: "skipped", reason: "stale-source" });
                return;
              }
              if (value.status !== "success") {
                finish({ status: "skipped", reason: value.status });
                return;
              }
              try {
                const output = validateAiResponse(value.output, request);
                finish(
                  output.lines.length
                    ? { status: "accepted", output }
                    : { status: "skipped", reason: "empty" },
                );
              } catch {
                finish({ status: "skipped", reason: "invalid-output" });
              }
            },
            () => finish({ status: "skipped", reason: "failed" }),
          );
        } catch {
          finish({ status: "skipped", reason: "failed" });
        }
        return { result, cancel };
      } catch {
        return skipped("invalid-request");
      }
    },
  };
}
