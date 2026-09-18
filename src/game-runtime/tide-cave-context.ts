import { validateD5Catalog } from "../game-core/contracts";
import { TIDE_CAVE_CATALOG_DATA } from "../content/gameplay/demo-v7/content";

export const TIDE_CAVE_CATALOG = validateD5Catalog(TIDE_CAVE_CATALOG_DATA);
