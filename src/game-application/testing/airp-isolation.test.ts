import { expect, it } from "vitest";
import { parseD5Request } from "../versions/d5-parse";

it("keeps AIRP commands out of D5 unless the selected content explicitly enables them", () => {
  const request = { protocolVersion: 4, saveId: "save.1", expectedHead: { saveId: "save.1", epoch: "epoch", revision: 0 }, clientRequestId: "request.1", command: { type: "airp-turn-in", instanceId: "ripple.1" } };
  expect(() => parseD5Request(request)).toThrow();
  expect(parseD5Request(request, false, true)).toEqual(request);
});
