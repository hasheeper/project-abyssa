import { expect, it } from "vitest";
import { storyActors, storyMessages } from "./story-actors";
import { deriveActorEmotions } from "../shared/ui/patterns/emotion-cues";
import { EMOTION_LABELS } from "../shared/domain/presentation/emotion";
import { AIRP_TEXT_EMOTIONS } from "../game-application/airp/contracts";
import { acceptGeneratedText } from "../game-application/airp-generation/scene";
import type { AuthoredLine } from "../content/presentation/authored-story";

it("v6 expressions reach actual AVG face cues; narration retains the previous actor face", () => {
  expect([...AIRP_TEXT_EMOTIONS].sort()).toEqual(Object.keys(EMOTION_LABELS).sort());
  const draft = '艾洛拉[confused]：「これ？（这个？）」\n旁白：她翻过纸页。\n艾洛拉[smile]：「わかった。（知道了。）」\n旁白：纸页合上。';
  const raw = JSON.stringify({creationRecord: "演出测试", lines: [
    {speaker: "elora", emotion: "confused", text: "「这个？」"}, {speaker: "narrator", emotion: "neutral", text: "她翻过纸页。"},
    {speaker: "elora", emotion: "smile", text: "「知道了。」"}, {speaker: "narrator", emotion: "neutral", text: "纸页合上。"},
  ]});
  const scene = acceptGeneratedText(raw, draft, 6);
  const lines: AuthoredLine[] = scene.lines.map((l, i) => l.speaker === "narrator" ? {id: `line:${i}`, kind: "action", text: l.text} : {id: `line:${i}`, characterId: l.speaker, emotion: l.emotion, text: l.text});
  const actors = storyActors(lines, "林恩");
  const states = lines.map((_, i) => deriveActorEmotions(actors, storyMessages(lines.slice(0, i + 1))).get("elora")!);
  expect(states.map(s => s.trigger)).toEqual(["confused", "confused", "smile", "smile"]);
  expect(states.map(s => s.expression)).toEqual(["m", "m", "b", "b"]);
  expect(states[1].key).toBe(states[0].key); expect(states[3].key).toBe(states[2].key);
  expect(JSON.stringify(storyMessages(lines))).not.toMatch(/\[confused\]|\[smile\]|[\u3040-\u30ff]/u);
});
