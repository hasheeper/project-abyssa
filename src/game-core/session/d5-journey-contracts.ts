import type { DemoBattleCommand } from "../battle/domain/demo-state";
import type { DemoItemTarget } from "./demo-items-events";
import type { TutorialOperation } from "./tutorial-types";

export type D5Departure = { runId: string; routeId: string; partyIds: string[]; itemIds: string[]; seed: number };
export type D5JourneyOperation =
  | TutorialOperation
  | { type: "resume" }
  | { type: "battle"; command: DemoBattleCommand }
  | { type: "advance"; roomId: string }
  | { type: "event"; roomId: string; choice: "read" | "attempt" | "skip"; actorId: string | null }
  | { type: "exit"; roomId: string; choice: "leave" | "continue" }
  | { type: "item"; instanceId: string; target: DemoItemTarget };
