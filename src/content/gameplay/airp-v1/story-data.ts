import type { AirpFrame, AirpScriptNode, AirpScript } from "../../../game-core/contracts";

// Working authored draft, not user-approved canon. The reducer binds the actual phase
// at first exposure and persists that stage with the full immutable scene body.
type Line = { actor: "elora"; text: string; emotion?: "neutral" | "smile" | "serious" } | { actor: "narrator"; text: string };
function frame(id: string, line: Line): AirpFrame {
  return line.actor === "narrator" ? { id, kind: "narration", text: line.text }
    : { id, kind: "dialogue", actorId: line.actor, text: line.text, emotion: line.emotion ?? "neutral" };
}
function story(role: string, lines: Line[], decision = false): AirpScript {
  const id = `airp.elora.case.${role}`, sectionId = `${id}.section`;
  const nodes: AirpScriptNode[] = lines.map((line, cursor) => {
    const nodeId = `${id}.${cursor}`;
    return { id: nodeId, cursor, sectionId, kind: "beat", frames: [frame(nodeId, line)] };
  });
  if (decision) {
    const choiceId = `${id}.decision`, branchId = `${id}.response`;
    nodes.push({ id: choiceId, cursor: nodes.length, sectionId, kind: "choice", prompt: "这趟巡守，怎么安排？", options: [
      { id: "A", label: "把药箱列进这趟巡守的目标。" },
      { id: "B", label: "先记下位置，清出安全的路再取。" },
      { id: "C", label: "取到就从侧门撤回，不为箱子多走。" },
    ] });
    nodes.push({ id: branchId, cursor: nodes.length, sectionId, kind: "branch", choiceId, variants: {
      A: [frame(`${branchId}.A`, { actor: "elora", text: "好。我先把清洗的布找出来。" })],
      B: [frame(`${branchId}.B`, { actor: "elora", text: "嗯，别急着伸手。搭扣坏了也没关系，回来再修。" })],
      C: [frame(`${branchId}.C`, { actor: "elora", text: "这样就够了。箱子拿回来，也不会催您再往里走。" })],
    } });
  }
  return { schemaVersion: 1, id, title: "旧药箱的搭扣", locale: "zh-CN",
    presentation: { stagePreset: "mansion-morning", backgroundId: "mansion.first-morning", defaultMode: "adv", allowRp: false, initialSlots: { left: "elora" } },
    player: { actorId: "kael", nameToken: "{{user}}", authoredSpeech: false }, cast: ["kael", "elora"],
    sections: [{ id: sectionId, title: "旧药箱的搭扣" }], nodes,
  };
}

export const FIRST_AIRP_STORIES = {
  offer: story("offer", [
    { actor: "narrator", text: "艾洛拉试着把最后一卷绷带塞进布袋。袋口合不上，她又把它拿了出来。" },
    { actor: "elora", text: "玛丽埃塔说，旧庄园的勤务走廊还留着一只空药箱，搭扣是黄铜的。" },
    { actor: "elora", text: "如果这次巡守能走到那里，可以帮我带回来吗？我想把这些分开放。" },
    { actor: "elora", text: "里面即使剩着药，也别拿来用。我要的只是箱子。", emotion: "serious" },
  ], true),
  "return-extracted": story("return-extracted", [
    { actor: "narrator", text: "巡守记录放在桌上。艾洛拉看到侧门撤离的标记，抬起头。" },
    { actor: "narrator", text: "药箱搁上桌，黄铜搭扣松松垮垮地晃了一下。艾洛拉伸手托住箱底。" },
    { actor: "elora", text: "从侧门回来的？嗯，箱子拿到了，这趟就没有白走。" },
    { actor: "narrator", text: "她拨了一下搭扣。咔哒。没有扣住。" },
    { actor: "elora", text: "……这个声音倒是很有精神。先用布带系着吧。", emotion: "smile" },
    { actor: "elora", text: "谢谢您。洗净晾干以后，绷带终于不用和零碎东西挤在一起了。" },
  ]),
  "return-cleared": story("return-cleared", [
    { actor: "narrator", text: "这趟巡守的记录已经交到艾洛拉手里。她看过巡路完成的标记，把纸放到桌上。" },
    { actor: "narrator", text: "艾洛拉接过药箱，先扶住摇晃的搭扣，再把盖子打开。" },
    { actor: "elora", text: "巡守走到底了，箱子也带回来了。路上还顺利吗？" },
    { actor: "narrator", text: "盖子一松，又慢慢落下来。她拿布卷垫住了它。" },
    { actor: "elora", text: "原来还得给它找个支撑……先洗干净，再看看怎么修。", emotion: "smile" },
    { actor: "elora", text: "能用的地方比我想的多。谢谢您没有把它落下。" },
  ]),
  retry: story("retry", [
    { actor: "elora", text: "箱子的事先放着。您回来就好。" },
    { actor: "narrator", text: "她把桌边的布袋挪开，给你留出一块坐下的地方。" },
    { actor: "elora", text: "下次巡守再看吧。今天不为了它折回去。", emotion: "serious" },
  ]),
  declined: story("declined", [
    { actor: "elora", text: "好，那我先分成两个小包。也不费多少布。" },
    { actor: "narrator", text: "她把塞不下的那卷绷带放到一旁，重新量了量袋口。" },
  ]),
  expired: story("expired", [
    { actor: "narrator", text: "那张写着药箱位置的便条已经收起。桌上仍摆着分开装的小布包。" },
  ]),
};

/** Battle-side narration only: does not require Elora to have joined the expedition. */
export const FIRST_AIRP_PATROL_CUES = {
  departure: { id: "airp.elora.case.departure", sceneId: "old-manor.welcoming-hall", text: "便条上记着勤务走廊的空药箱。黄铜搭扣，就在第三段巡路上。" },
  found: { id: "airp.elora.case.found", sceneId: "old-manor.service-corridor", text: "柜架下露出一只旧药箱。箱内空着，黄铜搭扣还有些松。你把它系在行囊外侧。" },
};

export const FIRST_AIRP_OPTION_STANCES = { A: "iron", B: "seasoned", C: "pragmatic" } as const;

/** Public actor baselines only; no future reveals or inferred numerical affinity. */
export const FIRST_AIRP_PROFILE = {
  id: "profile.airp.elora", version: 1,
  sourcePaths: ["st/setting/char/2-elora.txt", "docs/design/DEMO_DIALOGUE_VOICE_GUIDE.md"],
  text: "艾洛拉是有实战经验的小队神官。日常珍惜物资，遇到伤病舍得花费。说话温和，医疗底线坚定；普通场合自称我。不要句句说教，不把她写成新手，不替玩家发言。",
};
