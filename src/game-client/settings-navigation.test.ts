import { expect, it } from "vitest";
import { settingsHref, settingsReturnHref } from "./settings-navigation";

it("returns to the exact menu save, not the most recently opened one", () => {
  const href = settingsHref("menu", { saveId: "named/save", epoch: "epoch-a" });
  expect(href).toBe("#/settings?from=menu&save=named%2Fsave&epoch=epoch-a");
  expect(settingsReturnHref(href.slice(href.indexOf("?")))).toBe("#/menu?save=named%2Fsave&epoch=epoch-a");
});
it("returns standalone, title, malformed and untrusted links to the title", () => {
  expect(settingsHref("title")).toBe("#/settings?from=title");
  for (const search of ["", "?from=title", "?from=menu", "?from=https://example.com", "?from=menu&save=a&epoch=!"])
    expect(settingsReturnHref(search)).toBe("#/title");
});
