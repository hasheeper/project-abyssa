import { expect, it } from "vitest";
import { isGameTarget, readRoute, routeSearch } from "../shared/routing/location";
import { gameHref, parseCharacterLocation, parseLocator } from "./navigation";
it("preserves save, memory, archive and source parameters in static-host hash routes", () => {
  const href = gameHref("character-status",{saveId:"save",epoch:"epoch",memory:{id:"memory",attempt:2}},{characterId:"marietta",tab:"archive",from:"battle"});
  history.replaceState(null,"","/abyssa/"+href);
  expect(readRoute()?.page).toBe("character-status");
  expect(parseLocator(routeSearch())).toEqual({saveId:"save",epoch:"epoch",memory:{id:"memory",attempt:2}});
  expect(parseCharacterLocation(routeSearch())).toEqual({characterId:"marietta",tab:"archive",from:"battle"});
});
it("recognizes legacy game links but does not hijack tools, other installations, downloads or SVG fragments", () => {
  history.replaceState(null,"","/abyssa/#/title");
  expect(isGameTarget(new URL("map.html?save=a&epoch=b",location.href))).toBe(true);
  for (const path of ["tools.html#/title","assets/a.png","#ornament","../other/#/title","https://example.com/#/title"]) expect(isGameTarget(new URL(path,location.href))).toBe(false);
});
