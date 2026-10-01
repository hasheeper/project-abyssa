import { expect, it } from "vitest";
import { settingsReturnHref } from "./settings-navigation";

it("returns to the exact menu save, not the most recently opened one", () => {
  expect(settingsReturnHref("?from=menu&save=named%2Fsave&epoch=epoch-a")).toBe("#/menu?save=named%2Fsave&epoch=epoch-a");
});
it("returns standalone, title, malformed and untrusted links to the title", () => {
  for (const search of ["", "?from=title", "?from=menu", "?from=https://example.com", "?from=menu&save=a&epoch=!"])
    expect(settingsReturnHref(search)).toBe("#/title");
});
