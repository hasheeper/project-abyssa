import {
  createGameApplication,
  createAiCoordinator,
  type AiScene,
  type AiCueOptions,
  type AiAcceptance,
} from "../game-application";
import { LocalReactionPort } from "../game-infrastructure/ai/local";
import { LEGACY_VALIDATED_CATALOG } from "./legacy-context";
import type { GameStorePort } from "../game-application";
import { createCatalogRegistry } from "./catalogs";
import { createVersionedQueries } from "./versioned-views";
export function createGameRuntime(store: GameStorePort, environment: { newId: () => string; newSeed: () => number; close: () => void }) {
  const application = createGameApplication({
      catalog: LEGACY_VALIDATED_CATALOG,
      store,
    });
  const coordinators = new Set<ReturnType<typeof createAiCoordinator>>();
  return {
    queries: createVersionedQueries(createCatalogRegistry([{ version: 1, catalog: LEGACY_VALIDATED_CATALOG }])),
    application,
    createReactions(currentScene: () => AiScene) {
      const coordinator = createAiCoordinator(
        new LocalReactionPort(),
        {
          now: () => Date.now(),
          schedule(delay, callback) {
            const timer = setTimeout(callback, delay);
            return () => clearTimeout(timer);
          },
        },
        currentScene,
      );
      coordinators.add(coordinator);
      return {
        // Only records read through the application may become AI context; callers cannot supply candidate snapshots.
        start(options: AiCueOptions) {
          let cancelled = false,
            task: ReturnType<typeof coordinator.start> | undefined;
          const result = (async (): Promise<AiAcceptance> => {
            const loaded = await application.open(currentScene().head.saveId);
            if (cancelled) return { status: "skipped", reason: "cancelled" };
            if (!loaded.ok)
              return { status: "skipped", reason: loaded.error.code };
            task = coordinator.start(loaded.record, options);
            return task.result;
          })();
          return {
            result,
            cancel() {
              cancelled = true;
              task?.cancel();
            },
          };
        },
        dispose() {
          coordinator.dispose();
          coordinators.delete(coordinator);
        },
      };
    },
    newId: environment.newId,
    newSeed: environment.newSeed,
    close() {
      for (const coordinator of coordinators) coordinator.dispose();
      coordinators.clear();
      environment.close();
    },
  };
}
