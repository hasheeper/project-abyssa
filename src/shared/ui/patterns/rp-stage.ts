import type { ExpressionId } from "./expressions";

export type RpSeat = "left" | "right";

export interface RpActor {
  id: string;
  /** Short name used in dialogue bubbles. */
  name: string;
  /** Primary seat name; falls back to name. */
  fullName?: string;
  secondaryName?: string;
  avatar?: string;
  portrait?: string;
  spriteBaseUrl?: string;
  accent?: string;
  expression?: ExpressionId;
}

export type RpMessage =
  | { id: string; kind: "say"; actorId: string; text: string; expression?: ExpressionId }
  | { id: string; kind: "narration"; text: string }
  | { id: string; kind: "chapter"; text: string }
  | { id: string; kind: "system"; text: string }
  | {
      id: string;
      kind: "roll";
      label: string;
      formula: string;
      detail: string;
      total: number;
      outcome: "success" | "fail";
    };

export interface RpStageState {
  slots: Record<RpSeat, string | null>;
  sideByMessage: Map<string, RpSeat>;
}

/**
 * Replays the append-only transcript into two actor seats. Existing actors
 * keep their seat; a third actor replaces the least-recently-speaking seat.
 */
export function deriveRpStage(messages: readonly RpMessage[]): RpStageState {
  const slots: Record<RpSeat, string | null> = { left: null, right: null };
  const lastSpoke: Record<RpSeat, number> = { left: -1, right: -1 };
  const sideByMessage = new Map<string, RpSeat>();
  let tick = 0;

  for (const message of messages) {
    if (message.kind !== "say") continue;
    let side: RpSeat;
    if (slots.left === message.actorId) side = "left";
    else if (slots.right === message.actorId) side = "right";
    else if (slots.left === null) side = "left";
    else if (slots.right === null) side = "right";
    else side = lastSpoke.left <= lastSpoke.right ? "left" : "right";

    slots[side] = message.actorId;
    lastSpoke[side] = tick++;
    sideByMessage.set(message.id, side);
  }

  return { slots, sideByMessage };
}
