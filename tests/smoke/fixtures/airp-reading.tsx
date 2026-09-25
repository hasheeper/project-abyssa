import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DirectorScene } from "../../../src/game-client/airp-director/DirectorScene";
import { PlayerIdentityProvider } from "../../../src/shared/domain/PlayerIdentity";
import "../../../src/shared/ui/styles/tokens.css";
import "../../../src/shared/ui/styles/components-core.css";
import "../../../src/apps/mansion/mansion.css";

// Browser-only synthetic state. The runner replaces useDirector before loading
// this module; no real session, configuration, save or model request is used.
const lines = [
  { speaker: "narrator", text: "艾洛拉从窗边转过身。" },
  { speaker: "elora", emotion: "serious", text: "怎么现在才来？" },
  { speaker: "kael", emotion: "neutral", text: "刚才在门口。" },
];
export const commands: { type: string; cursor?: number }[] = [];
export const director = {
  session: {}, game: { status: "ready", error: null },
  view: {
    context: { world: { phase: 0 } },
    state: {
      reading: { jobId: "browser-job", eventId: "browser-event", cursor: 0, paused: false },
      jobs: [{ id: "browser-job", text: { lines }, scene: { choices: [] } }],
      events: [{ id: "browser-event", role: "offer", status: "offered", card: { title: "隔离阅读测试" } }],
      cursors: { "browser-job": 0 },
    },
  },
  async send(command: { type: string; cursor?: number }) {
    commands.push(command);
    if (command.type === "airp-director-read") renderAt(director.view.state.reading.cursor + 1);
    if (command.type === "airp-director-pause") { director.view.state.reading.paused = true; render(); }
  },
};
const root = createRoot(document.getElementById("root")!);
function render() {
  root.render(<StrictMode><PlayerIdentityProvider name="林恩"><DirectorScene/></PlayerIdentityProvider></StrictMode>);
}
export function renderAt(cursor: number) { director.view.state.reading.cursor = cursor; render(); }
export function start() { renderAt(0); }
