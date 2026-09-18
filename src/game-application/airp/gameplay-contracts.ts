import type { AirpAcceptedScene, AirpSceneTicket } from "./acceptance";
import type { AirpInteractionReceipt, AirpRpBinding } from "./contracts";
import type { AirpControlTicket } from "./control";
import type { AirpReleaseTarget, AirpSessionTicket } from "./rp-session";

/** Durable AIRP player state; independent of the gameplay reducer and D5 fact graph. */
export type AirpOnlineEntry = {
  sceneId: string; instanceId: string; task: "return" | "followup";
  source: "undecided" | "requested" | "handwritten" | "generated";
  ticket: AirpSceneTicket | null; accepted: AirpAcceptedScene | null;
  control: AirpControlTicket | null; controlReceipt: AirpInteractionReceipt | null;
};
export type AirpOnlineState = {
  version: 1;
  connection: null | { key: string; baseUrl: string; ticket: AirpSessionTicket; binding: AirpRpBinding | null };
  entries: AirpOnlineEntry[];
};
export type AirpOnlineCommand =
  | { type: "airp-online-connect"; baseUrl: string; release: AirpReleaseTarget }
  | { type: "airp-online-bound"; connectionKey: string; binding: AirpRpBinding }
  | { type: "airp-online-reset" }
  | { type: "airp-online-request" | "airp-online-handwritten"; sceneId: string }
  | { type: "airp-online-result"; sceneId: string; result: unknown }
  | { type: "airp-online-discard-ready"; sceneId: string; receipt: AirpInteractionReceipt }
  | { type: "airp-online-control-done"; sceneId: string; requestId: string; receipt: AirpInteractionReceipt }
  | { type: "airp-online-followup"; instanceId: string };
export type AirpOnlineIntent = { version: 1; command: AirpOnlineCommand };
