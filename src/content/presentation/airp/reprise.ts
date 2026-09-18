import type { AuthoredAction, AuthoredDialogueLine } from "../authored-story";
import { PLAYER_NAME_TOKEN } from "../../../shared/domain/player-identity";

/** AIRP-3 authored working draft, not approved canon or a generated/frozen Ripple scene. */
export function manorRepriseDialogue(outcome: "wipe" | "extracted", partyIds: readonly string[], previousPartyIds: readonly string[]): (Omit<AuthoredAction, "id"> | Omit<AuthoredDialogueLine, "id">)[] {
  const returning: Record<string, string> = outcome === "wipe" ? {
    eustice: "上次没能站稳，这次先看清红线往哪收。别急着往里冲，我会守住侧面。",
    elora: "上次没能走完……这次让我先看看大家的绷带。药还在手边，不要硬撑，好吗？",
    kororo: "队长，这次别被它们催着走。那些线一绷紧，就先停下来。",
    norma: "BOSS，上次吃过的亏可不能白吃。这回先留好退路，再看里面有什么。",
  } : {
    eustice: "上次撤回来不算结束。宴会厅还在里面，这回也先守住队形，再往深处走。",
    elora: "上次我们从退路回来了，可里面还没有安静下来。这次也先照顾好自己，好吗？",
    kororo: "队长，回去的路还得记着。可别因为来过，就觉得里面全看明白了。",
    norma: "BOSS，上次带回来的已经落袋，里面没办完的事可还在。今天重新算账。",
  };
  const briefed: Record<string, string> = {
    eustice: "上次的事我听明白了。今天我守侧面，你指路；没看清的地方，不要抢着走。",
    elora: "上次的经过我听你说了。今天我带着药，有哪里不舒服，要马上告诉我。",
    kororo: "你说的那些红线，我记住了。今天我也会看着……别催我就好。",
    norma: "情况说清楚了，BOSS。今天我跟着，退路和补给咱们都重新数一遍。",
  };
  const speaker = ["eustice", "elora", "kororo", "norma"].find(id => partyIds.includes(id));
  const shared = !!speaker && previousPartyIds.includes(speaker);
  return [
    { kind: "action", text: outcome === "wipe" ? "队伍再次停在迎客门厅外。上次败退后的休整已经结束，门内的红线却仍绷着，家宴尚未散场。" : "迎客门厅的门再次推开。上次撤离保住了退路，却没有让深处的家宴散场；红线仍沿墙角收向里面。" },
    ...(!shared && speaker ? [{ kind: "action" as const, text: `${PLAYER_NAME_TOKEN}在门外向今天同行的伙伴说明上次经过，逐一核对退路与补给。` }] : []),
    speaker ? { characterId: speaker, expression: "g", text: shared ? returning[speaker] : briefed[speaker] }
      : { kind: "action", text: `${PLAYER_NAME_TOKEN}对照上次记录，重新检查携带的补给与门外退路。` },
    { kind: "action", text: "队伍重新整好行装，走进尚未散席的家宴。" },
  ];
}
