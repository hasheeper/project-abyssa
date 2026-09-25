import type { PlayerSaveListEntry } from "../game-runtime/player-runtime";
import type { SavePresentation } from "../game-runtime/save-presentation";
import prologue from "../assets/cg/prologue/01-cathedral.webp";
import morning from "../assets/backgrounds/mansion-first-morning.webp";
import tutorial from "../assets/map/quest-backgrounds/tidecall-grotto.jpg";
import memory from "../assets/backgrounds/old-manor/banquet-hall.jpg";
import expedition from "../assets/backgrounds/battle-domains-of-chaos-illustrated.png";
import manor from "../assets/backgrounds/manor-night-gallery.jpg";

const scenes: Record<SavePresentation["scene"], { image: string; title: string }> = {
  prologue: { image: prologue, title: "序章" }, morning: { image: morning, title: "洋馆的清晨" },
  tutorial: { image: tutorial, title: "退潮岩窟" }, memory: { image: memory, title: "旧日回忆" },
  expedition: { image: expedition, title: "远征途中" }, manor: { image: manor, title: "守望者之崖" },
};
export const savePhases = { dawn: "清晨", day: "白昼", dusk: "黄昏", night: "夜晚" };
export function saveScene(save: Extract<PlayerSaveListEntry, { status: "ready" }>) {
  return scenes[save.presentation?.scene ?? (save.summary.activeExpeditionId ? "expedition" : "manor")];
}
export function savedDate(value: string | null) {
  if (!value) return "时间未记录";
  const date = new Date(value), pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())}  ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
