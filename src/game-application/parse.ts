import * as v from "../game-core/contracts";
import { parseBattleCommand, type BattleCommand } from "../game-core/battle";
import type { ExpeditionStart } from "../game-core/session";
import type { HeadRef } from "./contracts";
export function parseHead(raw: unknown, path = "head"): HeadRef {
  const h = v.record(raw, path, ["saveId", "epoch", "revision"]);
  return {
    saveId: v.id(h.saveId, `${path}.saveId`),
    epoch: v.id(h.epoch, `${path}.epoch`),
    revision: v.number(h.revision, `${path}.revision`),
  };
}
export type GameCommand =
  | ({ type: "start-expedition" } & ExpeditionStart)
  | { type: "battle-command"; expeditionId: string; command: BattleCommand }
  | { type: "undo"; expeditionId: string }
  | { type: "resume-enemy-turn"; expeditionId: string }
  | { type: "settle-expedition"; expeditionId: string; terminalRef: HeadRef };
export type CommandRequest = {
  protocolVersion: 1;
  saveId: string;
  clientRequestId: string;
  expectedHead: HeadRef;
  command: GameCommand;
};
export function parseCommandRequest(
  raw: unknown,
  internal = false,
): CommandRequest {
  v.assertJson(raw);
  const r = v.record(raw, "request", [
    "protocolVersion",
    "saveId",
    "clientRequestId",
    "expectedHead",
    "command",
  ]);
  v.choice(r.protocolVersion, [1], "protocolVersion");
  const saveId = v.id(r.saveId, "saveId"),
    clientRequestId = v.id(r.clientRequestId, "clientRequestId"),
    expectedHead = parseHead(r.expectedHead, "expectedHead");
  if (expectedHead.saveId !== saveId)
    v.invalid("expectedHead.saveId", "Save identity mismatch");
  const c = v.record(r.command, "command");
  const type = v.choice(
    c.type,
    internal
      ? ["resume-enemy-turn"]
      : ["start-expedition", "battle-command", "undo", "settle-expedition"],
    "command.type",
  );
  let command: GameCommand;
  const expeditionId = v.id(c.expeditionId, "command.expeditionId");
  if (type === "start-expedition") {
    v.record(c, "command", [
      "type",
      "expeditionId",
      "routeId",
      "partyIds",
      "itemIds",
      "equipmentIds",
      "seed",
    ]);
    command = {
      type,
      expeditionId,
      routeId: v.id(c.routeId, "routeId"),
      partyIds: v.ids(c.partyIds, "partyIds", 256),
      itemIds: v.ids(c.itemIds, "itemIds", 256),
      equipmentIds: v.ids(c.equipmentIds, "equipmentIds", 256),
      seed: v.number(c.seed, "seed", 0, 0xffffffff),
    };
  } else if (type === "battle-command") {
    v.record(c, "command", ["type", "expeditionId", "command"]);
    const battle = parseBattleCommand(c.command);
    if (
      [
        "undo",
        "begin-enemy-turn",
        "resolve-next-enemy",
        "finish-enemy-turn",
      ].includes(battle.type)
    )
      v.invalid("command.command.type", "Internal command is not public");
    command = { type, expeditionId, command: battle };
  } else if (type === "settle-expedition") {
    v.record(c, "command", ["type", "expeditionId", "terminalRef"]);
    command = {
      type,
      expeditionId,
      terminalRef: parseHead(c.terminalRef, "terminalRef"),
    };
  } else {
    v.record(c, "command", ["type", "expeditionId"]);
    command = { type: type as "undo" | "resume-enemy-turn", expeditionId };
  }
  return { protocolVersion: 1, saveId, clientRequestId, expectedHead, command };
}
