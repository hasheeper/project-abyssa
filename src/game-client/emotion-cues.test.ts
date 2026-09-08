import { existsSync } from "node:fs";
import { expect, it } from "vitest";
import { CHARACTER_EMOTION_PROFILES as profiles } from "../content/presentation/character-emotions";
import { EMOTION_LABELS, EXPRESSION_EMOTIONS } from "../shared/domain/presentation/emotion";
import { deriveActorEmotions, resolveEmotionCue } from "../shared/ui/patterns/emotion-cues";
import { getExpressionParts, CHARACTER_EXPRESSIONS } from "../shared/ui/patterns/expressions";
import { hasEmote } from "../shared/ui/patterns/emotes";
import type { RpActor, RpMessage } from "../shared/ui/patterns/rp-stage";

const actor = (id: string): RpActor => ({id,name:id,emotionProfile:profiles[id]});
it("covers the existing roster and resolves every recipe to shipped local assets", () => {
  expect(Object.keys(profiles).sort()).toEqual(Object.keys(CHARACTER_EXPRESSIONS).sort());
  for (const [id, profile] of Object.entries(profiles)) {
    expect(Object.keys(profile.cues).sort()).toEqual(Object.keys(EMOTION_LABELS).sort());
    for (const cue of [...Object.values(profile.cues), ...Object.values(profile.specials ?? {})]) {
      const parts = getExpressionParts(id,cue.expression);
      expect(parts,`${id}/${cue.expression}`).toBeDefined();
      for (const part of ["base",`eyes_${parts!.eyes}`,`mouth_${parts!.mouth}`,...(parts!.face === undefined ? [] : [`face_${parts!.face}`])])
        expect(existsSync(`src/assets/characters/paper-dolls/${id}/${part}.png`)).toBe(true);
      if (cue.emote) {
        expect(hasEmote(cue.emote)).toBe(true);
        for (const suffix of ["","-still"]) expect(existsSync(`src/assets/emote/${cue.emote}${suffix}.png`)).toBe(true);
      }
    }
  }
});
it("keeps legacy letter triggers, semantic names and explicit Chinese labels equivalent", () => {
  for (const id of Object.keys(profiles)) for (const [letter, semantic] of Object.entries(EXPRESSION_EMOTIONS)) {
    const cue = resolveEmotionCue(actor(id),semantic);
    expect(resolveEmotionCue(actor(id),letter)).toEqual(cue);
    expect(resolveEmotionCue(actor(id),EMOTION_LABELS[semantic])).toEqual(cue);
  }
});
it("keeps personality differences and treats stillness as a deliberate reaction", () => {
  expect(resolveEmotionCue(actor("marietta"),"displeased")).toMatchObject({emote:"ellipsis",motion:null});
  expect(resolveEmotionCue(actor("eustice"),"displeased")).toMatchObject({emote:"anger",motion:{id:"nod"}});
  expect(resolveEmotionCue(actor("kororo"),"closed").emote).toBe("sleepy");
  expect(resolveEmotionCue(actor("alvitr"),"closed").emote).toBeNull();
  expect(resolveEmotionCue(actor("norma"),"joy").motion?.id).toBe("jump");
});
it("has a safe fallback without inventing player gestures or unsupported specials", () => {
  expect(resolveEmotionCue(actor("marietta"),"wink").expression).toBe("a");
  expect(resolveEmotionCue(actor("kororo"),"wink").expression).toBe("wink");
  expect(resolveEmotionCue(actor("marietta"),"__proto__").expression).toBe("a");
  expect(resolveEmotionCue({id:"elora"},"joy")).toMatchObject({expression:"c",emote:null,motion:null});
  for (const a of [{...actor("kael"),emotionProfile:profiles.norma},{...actor("norma"),portrait:"static.png"}])
    expect(resolveEmotionCue(a,"joy")).toMatchObject({emote:null,motion:null});
});
it("keeps authored gestures readable at the original stage scale while preserving stillness",()=> {
  expect(resolveEmotionCue(actor("elora"),"joy").motion?.amplitude).toBe(64);
  expect(resolveEmotionCue(actor("norma"),"joy").motion?.amplitude).toBe(76);
  expect(resolveEmotionCue(actor("eustice"),"angry").motion?.amplitude).toBe(22);
  expect(resolveEmotionCue(actor("abyssa"),"joy").motion?.amplitude).toBe(10);
  expect(resolveEmotionCue(actor("marietta"),"serious").motion).toBeNull();
});
it("retains emotion across untagged lines and does not replay repeated aliases", () => {
  const messages: RpMessage[] = [
    {id:"1",kind:"say",actorId:"norma",emotion:"joy",text:"…"},
    {id:"2",kind:"say",actorId:"norma",expression:"c",text:"…"},
    {id:"3",kind:"say",actorId:"norma",text:"…"},
  ];
  expect(deriveActorEmotions([actor("norma")],messages).get("norma")?.key).toBe("1");
  messages.push({id:"4",kind:"say",actorId:"norma",emotion:"serious",expression:"c",text:"…"});
  expect(deriveActorEmotions([actor("norma")],messages).get("norma")).toMatchObject({key:"4",expression:"g"});
});
