import * as v from "../../game-core/contracts";
import { parseDirectMaterial } from "../airp-direct-gameplay/parse";
import { parseDirectorJobCommand } from "./jobs";
import { DIRECTOR_RUNTIME_LIMITS, type DirectorCommand, type DirectorIntent } from "./contracts";
import { parseResidentCast } from "./residents";
import { parseModel } from "../airp-generation/contracts";

export function parseDirectorCommand(raw: unknown): DirectorCommand {
  v.assertJson(raw);
  if (v.utf8Size(JSON.stringify(raw)) > DIRECTOR_RUNTIME_LIMITS.commandBytes) v.invalid("director", "Command capacity exceeded", "airp-capacity");
  const c = v.record(raw, "director.command"), type = v.id(c.type, "type");
  if (type === "airp-director-respond") { v.record(c, "command", ["type", "jobId", "index"]); return {type, jobId: v.id(c.jobId, "jobId"), index: v.number(c.index, "index", 0, 2)}; }
  if (type === "airp-director-revalidate-low") { v.record(c, "command", ["type", "jobId", "readerVersion"]); return { type, jobId: v.id(c.jobId, "jobId"), readerVersion: v.choice(c.readerVersion, [2, 3, 4, 5] as const, "readerVersion") }; }
  if (type === "airp-director-reconnect") { v.record(c, "command", ["type", "jobId", "config"]); return { type, jobId: v.id(c.jobId, "jobId"), config: parseModel(c.config) }; }
  if (["airp-director-begin", "airp-director-result", "airp-director-fail", "airp-director-use-format"].includes(type)) return parseDirectorJobCommand(c);
  if (type === "airp-director-configure") {
    v.record(c, "command", ["type", "material"], ["lowMaterial", "lowReadVersion", "lowContextVersion", "residentCast"]);
    if (c.lowMaterial !== undefined) v.record(c.lowMaterial, "lowMaterial", ["version", "preset", "sources", "common", "specials"]);
    return {type, ...(c.residentCast === undefined ? {} : {residentCast: parseResidentCast(c.residentCast)}), material: parseDirectMaterial(c.material), ...(c.lowMaterial === undefined ? {} : { lowMaterial: structuredClone(c.lowMaterial) as import("../airp-low/contracts").LowMaterial }), ...(c.lowReadVersion === undefined ? {} : { lowReadVersion: v.choice(c.lowReadVersion, [2, 3, 4, 5, 6] as const, "lowReadVersion") }), ...(c.lowContextVersion === undefined ? {} : { lowContextVersion: v.choice(c.lowContextVersion, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] as const, "lowContextVersion") })};
  }
  if (type === "airp-director-prepare-day" || type === "airp-director-prepare-replan" || type === "airp-director-pause" || type === "airp-director-enable-commissions") {v.record(c, "command", ["type"]); return {type};}
  if (type === "airp-director-accept-day" || type === "airp-director-show" || type === "airp-director-prepare-memory") {v.record(c, "command", ["type", "jobId"]); return {type, jobId: v.id(c.jobId, "jobId")};}
  if (type === "airp-director-read") {v.record(c, "command", ["type", "jobId", "cursor"]); return {type, jobId: v.id(c.jobId, "jobId"), cursor: v.number(c.cursor, "cursor", 0, 255)};}
  if (["airp-director-open", "airp-director-choose", "airp-director-defer", "airp-director-decline", "airp-director-deliver"].includes(type)) {
    v.record(c, "command", ["type", "eventId", ...(type === "airp-director-choose" ? ["choiceId"] : [])]);
    const eventId = v.id(c.eventId, "eventId");
    if (type === "airp-director-choose") return {type, eventId, choiceId: v.id(c.choiceId, "choiceId")};
    return {type: type as "airp-director-open" | "airp-director-defer" | "airp-director-decline" | "airp-director-deliver", eventId};
  }
  return v.invalid("director.command", "Unknown command");
}
export function parseDirectorIntent(raw: unknown): DirectorIntent {
  const r = v.record(raw, "director.intent", ["version", "command"], ["gmShare"]);
  const intent: DirectorIntent = {version: v.choice(r.version, [1], "version"), command: parseDirectorCommand(r.command)};
  if (r.gmShare !== undefined) {
    if (intent.command.type !== "airp-director-configure" || (intent.command.lowContextVersion ?? 0) < 17) v.invalid("director.intent.gmShare", "Only an explicit new-context configuration carries an internal baseline");
    v.assertJson(r.gmShare);
    const share = v.record(r.gmShare, "gmShare", ["version", "sourceHead", "plans", "reads", "pendingSettlements"]);
    v.choice(share.version, [1], "gmShare.version");
    const head = v.record(share.sourceHead, "gmShare.sourceHead", ["saveId", "epoch", "revision"]);
    v.id(head.saveId, "sourceHead.saveId"); v.id(head.epoch, "sourceHead.epoch"); v.number(head.revision, "sourceHead.revision");
    for (const key of ["plans", "reads", "pendingSettlements"]) v.list(share[key], `gmShare.${key}`);
    // Full source/body validation belongs to the owning AIRP reader. The public
    // command parser above never accepts this program-generated field.
    intent.gmShare = structuredClone(r.gmShare) as NonNullable<DirectorIntent["gmShare"]>;
  }
  return intent;
}
