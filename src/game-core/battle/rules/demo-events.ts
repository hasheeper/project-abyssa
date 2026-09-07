import { invalid } from "../../contracts/validation";
import type { DemoEvent } from "../domain/demo-state";
import type { JsonValue } from "../domain/state";

export function emit(ctx: { state: { run: { id: string; sequence: number } }; events: DemoEvent[] }, type: string, actorId: string | null, payload: JsonValue) {
  if (ctx.events.length >= 256) invalid("effects", "Event budget exceeded", "event-budget-exceeded");
  ctx.events.push({ id: `${ctx.state.run.id}:event:${++ctx.state.run.sequence}`, type, actorId, payload });
}
