import * as v from "../contracts/validation";
import type { BattleCommand } from "./domain/commands";

export function parseBattleCommand(input: unknown): BattleCommand {
  v.assertJson(input);
  const command = v.record(input, "$command");
  const type = v.choice(
    command.type,
    [
      "roll-dice",
      "reroll-dice",
      "toggle-load",
      "attack-enemy",
      "block-intent",
      "heal-member",
      "steal-from",
      "undo",
      "end-turn",
      "begin-enemy-turn",
      "resolve-next-enemy",
      "finish-enemy-turn",
      "next-round",
      "go-deeper",
      "leave-expedition",
    ],
    "$command.type",
  );
  const fields =
    type === "toggle-load"
      ? ["dieIndex"]
      : ["attack-enemy", "block-intent", "steal-from"].includes(type)
        ? ["actorId", "enemyId"]
        : type === "heal-member"
          ? ["actorId", "targetId"]
          : [];
  v.record(command, "$command", ["type", ...fields]);
  for (const field of fields) {
    if (field === "dieIndex")
      v.number(command[field], `$command.${field}`, 0, 4);
    else v.id(command[field], `$command.${field}`);
  }
  return structuredClone(command) as BattleCommand;
}
