import { afterEach, expect, it, vi } from "vitest";
import { FIRST_MORNING_STORY } from "../content/presentation/first-morning";
import { createAvgGenerationRequest, createAvgGenerator, createAvgHttpProvider, generatedAvgMessages } from "./avg-generation";
import { parseAvgReply, type AvgGenerationRequest } from "../shared/presentation/avg/generation";
import { resolveEmotionCue } from "../shared/ui/patterns/emotion-cues";
import { storyActors } from "./story-actors";

afterEach(() => vi.useRealTimers());
const request = () => createAvgGenerationRequest(FIRST_MORNING_STORY, { requestId: "test-1", nodeId: "morning.1.2", contextKey: "save:epoch:4:2:0", instruction: "回应刚刚的招呼", actorIds: ["abyssa", "marietta"], context: [{ actorId: "kael", text: "早。" }], facts: [] });
const reply = (r: AvgGenerationRequest) => ({ version: 1, requestId: r.requestId, sceneId: r.sceneId, nodeId: r.nodeId, contextKey: r.contextKey, lines: [{ actorId: "abyssa", text: "……早。", emotion: "closed" }] });
it("sends persona/emotion context and accepts one trigger through the existing AVG/RP mapping", async () => {
  const r = request();
  expect(r.actors.some(a => a.id === "kael")).toBe(false);
  expect(r.actors.every(a => a.direction.length > 0)).toBe(true);
  const provider = { generate: vi.fn(async () => reply(r)) };
  const result = await createAvgGenerator(provider).generate(r, key => key === r.contextKey);
  expect(result.status).toBe("accepted");
  if (result.status !== "accepted") throw new Error("not accepted");
  expect(generatedAvgMessages(result.frames)[0]).toMatchObject({ kind: "say", actorId: "abyssa", emotion: "closed", text: "……早。" });
  const actor = storyActors([{ id: "a", characterId: "abyssa", text: "" }])[0];
  expect(resolveEmotionCue(actor, "closed").expression).toBe("h");
  expect(provider.generate).toHaveBeenCalledOnce();
});
it("rejects invented actors, player speech, motions, commands, extra fields and stale identities", () => {
  const r = request();
  for (const line of [
    { actorId: "kael", text: "我同意", emotion: "neutral" },
    { actorId: "stranger", text: "嗯", emotion: "neutral" },
    { actorId: "abyssa", text: "嗯", emotion: "unknown" },
    { actorId: "abyssa", text: "嗯", emotion: "closed", motion: "jump" },
  ]) expect(() => parseAvgReply({ ...reply(r), lines: [line] }, r)).toThrow();
  expect(() => parseAvgReply({ ...reply(r), command: "advance-opening" }, r)).toThrow(/unknown field/);
  expect(() => parseAvgReply({ ...reply(r), contextKey: "another-save" }, r)).toThrow(/identity/);
  expect(() => parseAvgReply({ ...reply(r), lines: [] }, r)).toThrow();
});
it("discards late output after a page or save change", async () => {
  const r = request(); let current = true;
  const generator = createAvgGenerator({ generate: async () => { current = false; return reply(r); } });
  expect(await generator.generate(r, () => current)).toEqual({ status: "stale" });
});
it("cancels a provider that ignores abort, supersedes older requests, and bounds the timeout", async () => {
  vi.useFakeTimers();
  const generator = createAvgGenerator({ generate: () => new Promise(() => {}) }, 100);
  const first = generator.generate(request(), () => true);
  const second = generator.generate({ ...request(), requestId: "test-2" }, () => true);
  expect(await first).toEqual({ status: "cancelled" });
  await vi.advanceTimersByTimeAsync(101);
  expect(await second).toEqual({ status: "timeout" });
  const third = generator.generate(request(), () => true); generator.cancel();
  expect(await third).toEqual({ status: "cancelled" });
});
it("fails closed on malformed output and posts a schema through the injectable backend", async () => {
  const r = request(), generator = createAvgGenerator({ generate: async () => "not json" });
  expect((await generator.generate(r, () => true)).status).toBe("failed");
  const transport = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(reply(r))));
  const result = await createAvgGenerator(createAvgHttpProvider("/api/avg/generate", transport)).generate(r, () => true);
  expect(result.status).toBe("accepted");
  const body = JSON.parse(transport.mock.calls[0][1]!.body as string);
  expect(body.responseSchema.properties.lines.items.properties.actorId.enum).not.toContain("kael");
});
