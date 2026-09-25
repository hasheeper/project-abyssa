import { expect, it } from "vitest";
import { parsePlayerName, playerNameProblem } from "./player-name";

it.each(["林恩", "艾尔·林恩", "Renée", "Jean-Luc", "𠮷野", "A B", "一二三四五六七八九十一二"])("accepts display name %s without altering its identity", name => {
  expect(parsePlayerName(name)).toBe(name);
});
it.each(["", "   ", " 林恩", "林恩 ", "一二三四五六七八九十一二三", "{{user}}", "<img>", "a\nb", "a\u202Eb", "Rene\u0301e", null])("rejects noncanonical or unsafe name %s", name => {
  expect(() => parsePlayerName(name)).toThrow();
});
it("counts Unicode code points rather than UTF-16 units", () => {
  expect(playerNameProblem("𠮷".repeat(12))).toBeNull();
  expect(playerNameProblem("𠮷".repeat(13))).toBe("length");
});
