import { validateManorCatalog } from "../game-core/contracts";
import { FULL_MANOR_CATALOG_DATA } from "../content/gameplay/demo-v1/manor-full";
export const FULL_MANOR_CATALOG = validateManorCatalog(FULL_MANOR_CATALOG_DATA);
