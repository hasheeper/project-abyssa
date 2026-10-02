import { expect, it } from "vitest";
import { GAME_RELEASE, releaseInformation, releaseLabel, resolveGameRelease, withReleaseIdentity, type GameRelease } from "./game-release";
import developmentConfiguration from "../../../config/game-release.json";

const release: GameRelease = {version: "0.1.0-alpha.1", stage: "alpha", revision: "a".repeat(40), builtAt: "2026-10-02T12:00:00.000Z", development: false};

it("keeps release numbers distinct from development status and source identity", () => {
  expect(releaseLabel(release)).toBe("v0.1.0-alpha.1");
  expect(releaseLabel({...release, development: true})).toBe("v0.1.0-alpha.1 · 开发版");
  expect(releaseLabel({...release, version: null, development: true})).toBe("版本未知 · 开发版");
  expect(releaseInformation(release)).toContain(release.revision);
  expect(releaseInformation(release)).toContain(release.builtAt);
  expect(Object.isFrozen(GAME_RELEASE)).toBe(true);
  expect(resolveGameRelease(undefined, true)).toMatchObject({version: developmentConfiguration.version, development: true, revision: null, builtAt: null});
  expect(resolveGameRelease(undefined, false)).toMatchObject({version: null, stage: "development", development: true});
  expect(resolveGameRelease(release, true)).toEqual(release);
});

it("annotates the export client without rewriting historical calls or save identities", () => {
  const value = {diagnosticVersion: 1, rawRecord: {schemaVersion: 4, contentRef: {contentVersion: 27}}, calls: [{id: "old-call", output: "已付费正文"}]};
  const exported = JSON.parse(withReleaseIdentity(JSON.stringify(value)));
  expect(exported.exportedBy).toEqual(GAME_RELEASE);
  expect(exported.rawRecord).toEqual(value.rawRecord);
  expect(exported.calls).toEqual(value.calls);
  expect(exported.calls[0]).not.toHaveProperty("clientVersion");
  expect(value).not.toHaveProperty("exportedBy");
  expect(() => withReleaseIdentity("[]")).toThrow();
  expect(() => withReleaseIdentity("null")).toThrow();
});
