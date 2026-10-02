import { codexArt } from "../../content/presentation/codex-art";
import { shopLootPresentation } from "../../content/presentation/shop-loot";
import type { CodexEntryData } from "../../game-runtime/codex-types";
import type { CodexEntry } from "./CodexPanel";

/** The runtime has already filtered every field for this save's unlock stage. */
export function codexEntries(data: readonly CodexEntryData[]): readonly CodexEntry[] {
  return data.map(entry => {
    const art = entry.stage !== "unknown" ? codexArt.get(entry.id) : undefined;
    return { ...entry,
      image: art?.image ?? "", thumbnail: art?.thumbnail ?? "",
      drawing: art?.drawing ?? { width: 550, height: 400, centerX: .5, displayScale: 1, offsetY: 0 },
      drops: entry.dropIds.flatMap(id => {
        const item = shopLootPresentation[id];
        return item ? [{ id, name: item.name, icon: item.iconUrl, description: item.appearance }] : [];
      }),
    };
  });
}
