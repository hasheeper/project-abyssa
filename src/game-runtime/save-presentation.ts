import type { AnyGameRecord } from "../game-application";

/** Read-only directory metadata. No wall-clock values or screenshots are invented. */
export type SavePresentation = {
  playerName?: string;
  scene: "prologue" | "morning" | "tutorial" | "memory" | "expedition" | "manor";
};

export function savePresentation(record: AnyGameRecord): SavePresentation {
  if (record.schemaVersion === 4) {
    const campaign = record.snapshot.campaign;
    const identity = campaign.playerName ? { playerName: campaign.playerName } : {};
    if (campaign.prologue?.status === "playing") return { ...identity, scene: "prologue" };
    if (campaign.opening?.status === "playing") return { ...identity, scene: "morning" };
    if (campaign.activeRunRef?.kind === "memory" || campaign.memory && !["left", "completed"].includes(campaign.memory.node))
      return { ...identity, scene: "memory" };
    if (campaign.tutorial?.status === "pending" || campaign.tutorial?.status === "active")
      return { ...identity, scene: "tutorial" };
    return { ...identity, scene: campaign.activeRunRef ? "expedition" : "manor" };
  }
  const active = record.schemaVersion === 1 ? record.snapshot.campaign.activeExpeditionId : record.snapshot.campaign.activeRunRef;
  return { scene: active ? "expedition" : "manor" };
}
