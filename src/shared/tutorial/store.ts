import type { TutorialStep } from "./types";

export function createTutorialStore() {
  const listeners = new Set<() => void>();
  const anchors = new Map<string, HTMLElement>();
  const requests = new Map<symbol, TutorialStep>();
  const blocks = new Set<symbol>();
  let snapshot = {revision: 0, step: null as TutorialStep | null, blocked: false};
  const publish = () => {
    // Only the newest live owner renders; removing it restores the previous owner.
    snapshot = {revision: snapshot.revision + 1, step: [...requests.values()].at(-1) ?? null, blocked: blocks.size > 0};
    listeners.forEach(listener => listener());
  };
  return {
    subscribe: (listener: () => void) => {listeners.add(listener); return () => {listeners.delete(listener);};},
    getSnapshot: () => snapshot,
    anchor: (id: string) => anchors.get(id),
    register(id: string, node: HTMLElement) {
      if (anchors.get(id) === node) return () => {};
      anchors.set(id, node);
      node.dataset.tutorialAnchor = id;
      publish();
      return () => {
        if (node.dataset.tutorialAnchor === id) delete node.dataset.tutorialAnchor;
        if (anchors.get(id) !== node) return;
        anchors.delete(id); publish();
      };
    },
    request(owner: symbol, step: TutorialStep | null) {
      if (requests.get(owner) === step || !step && !requests.has(owner)) return;
      if (step) requests.set(owner, step); else requests.delete(owner);
      publish();
    },
    block(owner: symbol, blocked: boolean) {
      if (blocks.has(owner) === blocked) return;
      if (blocked) blocks.add(owner); else blocks.delete(owner);
      publish();
    },
  };
}
export type TutorialStore = ReturnType<typeof createTutorialStore>;
