import type { AvgFrame, AvgStory } from "../shared/domain/avg/story";
import { avgFrameLine } from "../shared/domain/avg/playback";
import { EMOTION_LABELS, type EmotionId } from "../shared/domain/presentation/emotion";
import { CHARACTER_EMOTION_PROFILES } from "../content/presentation/character-emotions";
import type { AvgGenerationProvider, AvgGenerationRequest } from "../shared/presentation/avg/generation";
import { storyActors, storyMessages } from "./story-actors";

export { createAvgGenerator } from "../shared/presentation/avg/generation";

/** Caller supplies only already-read context and visible, committed facts. Player speech is never generated. */
export function createAvgGenerationRequest(story: AvgStory, input: {
  requestId: string; nodeId: string; contextKey: string; instruction: string; actorIds: string[];
  context: AvgGenerationRequest["context"]; facts: AvgGenerationRequest["facts"];
}): AvgGenerationRequest {
  if (!/^[\w:-]{1,128}$/.test(input.requestId) || !story.nodes.some(n => n.id === input.nodeId) || !input.contextKey || input.contextKey.length > 1000) throw new Error("Invalid AVG request scope");
  if (!input.instruction.trim() || input.instruction.length > 2000) throw new Error("Invalid AVG instruction");
  if (input.context.length > 24 || input.facts.length > 32 || [...input.context, ...input.facts].some(c => !c.text.trim() || c.text.length > 2000)) throw new Error("AVG context exceeds budget");
  if (input.context.some(c => c.actorId && !story.cast.includes(c.actorId))) throw new Error("Unknown context actor");
  if (!input.actorIds.length || input.actorIds.length > 16 || new Set(input.actorIds).size !== input.actorIds.length || input.actorIds.some(id => id === story.player.actorId || !story.cast.includes(id))) throw new Error("Invalid AVG speakers");
  const actors = storyActors(input.actorIds.map(characterId => ({ id: characterId, characterId, text: "" })));
  if (actors.length !== input.actorIds.length) throw new Error("Missing AVG actor registration");
  const { actorIds: _, ...scope } = input;
  return structuredClone({
    version: 1, ...scope,
    instruction: `${input.instruction}\n只续写指定角色的对白；主角由玩家控制。不生成主角的台词、心理或行动，不改写既定剧情与事实。仅输出 actorId、text、emotion；情绪只用给定触发词，不输出动作、表情贴图或气泡参数。`,
    sceneId: story.id, maxLines: 4,
    actors: actors.map(a => ({ id: a.id, name: a.name, direction: CHARACTER_EMOTION_PROFILES[a.id]?.direction ?? "" })),
    emotions: Object.keys(EMOTION_LABELS) as EmotionId[],
  });
}

/** Feeds AdvStage and RpScene unchanged; their local profiles resolve all three visual axes. */
export function generatedAvgMessages(frames: AvgFrame[]) {
  return storyMessages(frames.map(avgFrameLine));
}

/** Optional same-origin backend adapter. Provider credentials belong on the server. Nothing calls it by default. */
export function createAvgHttpProvider(endpoint = "/api/avg/generate", transport: typeof fetch = fetch): AvgGenerationProvider {
  if (!/^\/(?!\/)[\w/-]+$/.test(endpoint)) throw new Error("Use a same-origin AVG backend path");
  return {
    async generate(request, { signal, responseSchema }) {
      const response = await transport(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", signal, body: JSON.stringify({ request, responseSchema }) });
      if (!response.ok) throw new Error(`AVG backend HTTP ${response.status}`);
      const text = await response.text();
      if (text.length > 32768) throw new Error("AVG response exceeds budget");
      return JSON.parse(text) as unknown;
    },
  };
}
