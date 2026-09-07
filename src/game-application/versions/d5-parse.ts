import * as v from "../../game-core/contracts";
import { parseD5RunRef } from "../../game-core/session";
import { parseDemoBattleCommand } from "../../game-core/battle";
import { parseDemoItemTarget } from "../../game-core/session";
import { parseHead } from "../parse";
import { parseDemoRequest } from "./demo-parse";
import type { D5Command, D5Request } from "./d5-contracts";

export function parseD5Request(raw: unknown, internal = false): D5Request {
  v.assertJson(raw);
  const r = v.record(raw, "request", ["protocolVersion", "saveId", "expectedHead", "clientRequestId", "command"]);
  v.choice(r.protocolVersion, [4], "protocolVersion");
  const saveId = v.id(r.saveId, "saveId"), expectedHead = parseHead(r.expectedHead), clientRequestId = v.id(r.clientRequestId, "clientRequestId");
  if (expectedHead.saveId !== saveId) v.invalid("expectedHead", "Save identity differs");
  const c = v.record(r.command, "command"), type = v.id(c.type, "command.type");
  if (internal && type !== "resume-run" || !internal && type === "resume-run") v.invalid("command.type", "Internal continuation boundary");
  let command: D5Command;
  if (["battle-command", "undo", "resume-run", "retry-memory", "leave-memory", "advance-memory", "read-memory", "use-item"].includes(type)) {
    v.record(c, "command", ["type", "runRef", ...(type === "battle-command" ? ["command"] : type === "use-item" ? ["instanceId", "target"] : type === "advance-memory" ? ["node", "choice"] : type === "read-memory" ? ["node", "step"] : [])]);
    const runRef = parseD5RunRef(c.runRef);
    if (type === "battle-command") {
      const battle = parseDemoBattleCommand(c.command);
      if (["resolve-next-enemy", "undo"].includes(battle.type)) v.invalid("command.type", "Internal battle operation");
      command = { type, runRef, command: battle };
    } else if (type === "use-item") {
      command = { type, runRef, instanceId: v.id(c.instanceId, "instanceId"), target: parseDemoItemTarget(c.target) };
    } else if (type === "read-memory") {
      if (runRef.kind !== "memory") v.invalid("runRef", "Expected memory attempt");
      command = { type, runRef, node: v.choice(c.node, ["present-intro", "history-opening", "teaching", "history-complete"], "node"), step: v.number(c.step, "step", 0, 100) };
    } else if (type === "advance-memory") {
      if (runRef.kind !== "memory") v.invalid("runRef", "Expected memory attempt");
      command = { type, runRef, node: v.choice(c.node, ["history-opening", "teaching", "battle", "return-pending"], "node"), choice: v.choice(c.choice, ["continue", "skip"], "choice") };
    } else if (type === "retry-memory" || type === "leave-memory") {
      if (runRef.kind !== "memory") v.invalid("runRef", "Expected memory attempt");
      command = { type, runRef };
    } else command = { type: type as "undo" | "resume-run", runRef };
  } else if (type === "purchase-supply") {
    v.record(c, "command", ["type", "shopId", "definitionId", "quantity", "quoteVersion"]);
    command = {type, shopId: v.id(c.shopId, "shopId"), definitionId: v.id(c.definitionId, "definitionId"), quantity: v.number(c.quantity, "quantity", 1, 4), quoteVersion: v.number(c.quoteVersion, "quoteVersion", 1)};
  } else if ((type === "begin-memory" || type === "inherit-memory")) {
    v.record(c, "command", ["type", "chapterId"]);
    command = { type, chapterId: v.id(c.chapterId, "chapterId") };
  } else if (type === "begin-story") {
    v.record(c, "command", ["type", "eventId", "basisId"]);
    command = { type, eventId: v.id(c.eventId, "eventId"), basisId: v.id(c.basisId, "basisId") };
  } else if (type === "advance-story" || type === "complete-story") {
    v.record(c, "command", ["type", "sessionId", ...(type === "advance-story" ? ["step", "choice"] : [])]);
    const sessionId = v.id(c.sessionId, "sessionId");
    command = type === "complete-story" ? { type, sessionId } : { type, sessionId, step: v.number(c.step, "step", 0, 100), choice: v.choice(c.choice, ["continue", "skip", "later"], "choice") };
  } else if (type === "equip-equipment" || type === "unequip-equipment") {
    v.record(c, "command", ["type", "instanceId", "ownerId"]);
    command = { type, instanceId: v.id(c.instanceId, "instanceId"), ownerId: v.id(c.ownerId, "ownerId") };
  } else if (type === "transfer-equipment") {
    v.record(c, "command", ["type", "instanceId", "fromOwnerId", "toOwnerId"]);
    command = { type, instanceId: v.id(c.instanceId, "instanceId"), fromOwnerId: v.id(c.fromOwnerId, "fromOwnerId"), toOwnerId: v.id(c.toOwnerId, "toOwnerId") };
  } else {
    // Only reuses the unchanged command grammar, not a v3 service or v3 save.
    command = parseDemoRequest({ ...r, protocolVersion: 3 }, false, 3).command;
  }
  return { protocolVersion: 4, saveId, expectedHead, clientRequestId, command };
}
