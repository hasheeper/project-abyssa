import type { ExpressionId } from "./expressions";
import type { EmotePlacement } from "./emotes";
import type { SpriteCalibration } from "./spriteCalibration";
import type { CharacterEmotionProfile } from "../../domain/presentation/emotion";
import { deriveStageSlots } from "../../domain/presentation/stage-slots";

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
  /** Injected by content adapters. Shared UI never imports a game's character roster. */
  emotionProfile?: CharacterEmotionProfile;
  /** Optional authored/tool calibration; never supplied per LLM line. */
  spriteCalibration?: SpriteCalibration;
  emotePlacements?: Readonly<Record<string, Partial<EmotePlacement>>>;
}

export type RpMessage =
  | { id: string; kind: "say"; actorId: string; text: string; emotion?: string; expression?: ExpressionId; offstage?: boolean }
  /** Authored silent blocking. Updates the cast/face, never the dialogue or RP log. */
  | { id: string; kind: "stage"; actorId: string; text: ""; emotion?: string; expression?: ExpressionId }
  | { id: string; kind: "narration"; text: string }
  /** A committed player decision: a reading-history anchor, not dialogue or an interactive option. */
  | { id: string; kind: "choice"; text: string; sequence?: number }
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
export function deriveRpStage(messages: readonly RpMessage[], initialSlots?: Partial<Record<RpSeat, string>>): RpStageState {
  return deriveStageSlots(messages, initialSlots);
}
