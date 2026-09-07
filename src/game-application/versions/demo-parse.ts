import * as v from "../../game-core/contracts";
import { parseDemoBattleCommand } from "../../game-core/battle";
import { parseDemoItemTarget } from "../../game-core/session";
import { parseHead } from "../parse";
import type { DemoRequest, DemoCommand } from "./demo-contracts";

export function parseDemoRequest(raw: unknown, internal = false, version: 2 | 3 = 2): DemoRequest {
  v.assertJson(raw);
  const r = v.record(raw, "request", [
    "protocolVersion",
    "saveId",
    "expectedHead",
    "clientRequestId",
    "command",
  ]);
  v.choice(r.protocolVersion, [version], "protocolVersion");
  const saveId = v.id(r.saveId, "saveId"),
    expectedHead = parseHead(r.expectedHead),
    clientRequestId = v.id(r.clientRequestId, "clientRequestId");
  if (expectedHead.saveId !== saveId)
    v.invalid("expectedHead", "Save identity differs");
  const c = v.record(r.command, "command"),
    type = v.choice(
      c.type,
      internal
        ? ["resume-run"]
        : ["start-expedition", "battle-command", "undo", "advance-room", "choose-event", "choose-exit", "use-item", "settle-expedition", ...(version === 3 ? ["acknowledge-story" as const] : [])],
      "command.type",
    );
  let command: DemoCommand;
  if (type === "start-expedition") {
    v.record(c, "command", ["type", "runId", "routeId", "partyIds", "seed", ...(c.itemIds !== undefined ? ["itemIds"] : [])]);
    command = {
      type,
      ...(c.itemIds !== undefined ? {itemIds: v.ids(c.itemIds, "itemIds", 4)} : {}),
      runId: v.id(c.runId, "runId"),
      routeId: v.id(c.routeId, "routeId"),
      partyIds: v.ids(c.partyIds, "partyIds", 5),
      seed: v.number(c.seed, "seed", 0, 0xffffffff),
    };
  } else if (type === "acknowledge-story") {
    v.record(c, "story", ["type", "terminalId", "step", "choice"]);
    command = {type, terminalId: v.id(c.terminalId, "terminalId"), step: v.number(c.step, "step", 0, 4), choice: v.choice(c.choice, ["continue", "skip"], "choice")};
  } else {
    const fields = {"battle-command": ["command"], "undo": [], "resume-run": [], "advance-room": ["roomId"], "choose-event": ["roomId", "choiceId", "actorId"], "choose-exit": ["roomId", "choice"], "use-item": ["instanceId", "target"], "settle-expedition": ["terminalRef"]};
    v.record(c, "command", ["type", "runRef", ...fields[type]]);
    const ref = v.record(c.runRef, "runRef", ["kind", "id"]);
    const runRef = {
      kind: v.choice(ref.kind, ["expedition"], "runRef.kind"),
      id: v.id(ref.id, "runRef.id"),
    };
    if (type === "battle-command") {
      const battle = parseDemoBattleCommand(c.command);
      if (battle.type === "resolve-next-enemy" || battle.type === "undo")
        v.invalid("command.type", "Internal battle command");
      command = { type, runRef, command: battle };
    } else if (type === "advance-room") command = {type, runRef, roomId: v.id(c.roomId, "roomId")};
    else if (type === "choose-event") command = {type, runRef, roomId: v.id(c.roomId, "roomId"), choiceId: v.choice(c.choiceId, ["read", "attempt", "skip"], "choiceId"), actorId: c.actorId === null ? null : v.id(c.actorId, "actorId")};
    else if (type === "choose-exit") command = {type, runRef, roomId: v.id(c.roomId, "roomId"), choice: v.choice(c.choice, ["leave", "continue"], "choice")};
    else if (type === "use-item") command = {type, runRef, instanceId: v.id(c.instanceId, "instanceId"), target: parseDemoItemTarget(c.target)};
    else if (type === "settle-expedition") command = {type, runRef, terminalRef: v.id(c.terminalRef, "terminalRef")};
    else command = { type, runRef };
  }
  return { protocolVersion: version, saveId, expectedHead, clientRequestId, command };
}
