/** Pure, shared seat allocation for live presentation and frozen narrative snapshots. */
export function deriveStageSlots(messages: readonly { id: string; kind: string; actorId?: string; offstage?: boolean }[], initialSlots?: { left?: string; right?: string }) {
  type Seat = "left" | "right";
  const slots: Record<Seat, string | null> = { left: initialSlots?.left ?? null, right: initialSlots?.right ?? null };
  const lastSpoke: Record<Seat, number> = { left: -1, right: -1 }, sideByMessage = new Map<string, Seat>();
  let tick = 0;
  for (const message of messages) {
    if (!message.actorId || message.kind !== "stage" && (message.kind !== "say" || message.offstage)) continue;
    const side: Seat = slots.left === message.actorId ? "left" : slots.right === message.actorId ? "right"
      : slots.left === null ? "left" : slots.right === null ? "right" : lastSpoke.left <= lastSpoke.right ? "left" : "right";
    slots[side] = message.actorId; lastSpoke[side] = tick++; sideByMessage.set(message.id, side);
  }
  return { slots, sideByMessage };
}
