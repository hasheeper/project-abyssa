import type { AirpScript } from "../../../game-core/contracts";

/** Explicit fallback, never counted as a successfully generated scene. */
export const DIRECT_FOLLOWUP: AirpScript = {
  schemaVersion: 1, id: "airp.direct.case.followup", title: "药箱归位之后", locale: "zh-CN",
  player: {actorId: "kael", nameToken: "{{user}}", authoredSpeech: false},
  presentation: {stagePreset: "mansion-morning", backgroundId: "mansion.first-morning", defaultMode: "adv", allowRp: false, initialSlots: {left: "elora"}},
  cast: ["kael", "elora"], sections: [{id: "airp.direct.case.followup.section", title: "药箱归位之后"}],
  nodes: [{id: "airp.direct.case.followup.0", cursor: 0, sectionId: "airp.direct.case.followup.section", kind: "beat",
    frames: [{id: "airp.direct.case.followup.0", kind: "dialogue", actorId: "elora", emotion: "neutral", text: "药箱的事情已经记下了。接下来要先做什么，您可以慢慢想。"}]}],
};
