import { D5_CATALOG_DATA } from "../content/gameplay/demo-v2/foundation";
import { validateD5Catalog } from "../game-core/contracts";

/** Explicit foundation context only. The player registry/default new game remains D4/v3. */
export const D5_FOUNDATION_CATALOG = validateD5Catalog(D5_CATALOG_DATA);
export { D5_RUN_READERS } from "../game-core/session";
export { createD5BattleEngine, createD5MemoryEngine } from "../game-core/battle";
