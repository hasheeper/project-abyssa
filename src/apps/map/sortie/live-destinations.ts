import type { DemoJourneyView } from "../../../game-runtime/demo-journey-view";
import type { MapLocationId } from "../types";

export function departureDestination(view: DemoJourneyView | null, nodeId: MapLocationId) {
  return view?.destinations.find(d => d.nodeId === nodeId && d.available);
}
export function departureNodes(view: DemoJourneyView | null, legacy = false): MapLocationId[] {
  if (legacy) return ["tower"];
  return (["tower", "cave", "church"] as const).filter(id => !!departureDestination(view, id));
}
