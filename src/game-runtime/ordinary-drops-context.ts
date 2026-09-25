import { validateD5Catalog } from "../game-core/contracts";
import { ORDINARY_DROPS_CATALOG_DATA } from "../content/gameplay/demo-v21/content";

export const ORDINARY_DROPS_CATALOG = validateD5Catalog(ORDINARY_DROPS_CATALOG_DATA);
