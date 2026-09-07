import type { DemoBattleCommand } from "../../game-core/battle";
import type { DemoItemTarget } from "../../game-core/session";

export type DemoCommand =
  | {type: "acknowledge-story"; terminalId: string; step: number; choice: "continue" | "skip"}
  | {
      type: "start-expedition";
      runId: string;
      routeId: string;
      partyIds: string[];
      seed: number;
      itemIds?: string[];
    }
  | {
      type: "battle-command";
      runRef: { kind: "expedition"; id: string };
      command: DemoBattleCommand;
    }
  | { type: "undo"; runRef: { kind: "expedition"; id: string } }
  | { type: "resume-run"; runRef: { kind: "expedition"; id: string } }
  | { type: "advance-room"; runRef: { kind: "expedition"; id: string }; roomId: string }
  | { type: "choose-event"; runRef: { kind: "expedition"; id: string }; roomId: string; choiceId: "read" | "attempt" | "skip"; actorId: string | null }
  | { type: "choose-exit"; runRef: { kind: "expedition"; id: string }; roomId: string; choice: "leave" | "continue" }
  | { type: "use-item"; runRef: { kind: "expedition"; id: string }; instanceId: string; target: DemoItemTarget }
  | { type: "settle-expedition"; runRef: { kind: "expedition"; id: string }; terminalRef: string };
