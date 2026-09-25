import * as v from "./validation";

export const PLAYER_NAME_MAX_LENGTH = 12;
/** Display-only identity: never a character, save, asset or command identifier. */
export function playerNameProblem(value: string): "empty" | "length" | "characters" | null {
  if (!value) return "empty";
  if ([...value].length > PLAYER_NAME_MAX_LENGTH) return "length";
  if (!/^[\p{L}\p{M}\p{N} ·・.'’-]+$/u.test(value)) return "characters";
  return null;
}
export function parsePlayerName(raw: unknown): string {
  const name = v.text(raw, "playerName", 128);
  if (name !== name.trim().normalize("NFC") || playerNameProblem(name))
    v.invalid("playerName", "Use 1–12 letters, numbers, spaces or name separators");
  return name;
}
