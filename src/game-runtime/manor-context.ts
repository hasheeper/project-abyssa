import { validateDemoCatalog } from "../game-core/contracts";
import { MANOR_CATALOG_DATA } from "../content/gameplay/demo-v1/manor";

/** Experimental D3 rules registration; player UI integration remains closed. */
export const MANOR_CATALOG = validateDemoCatalog(MANOR_CATALOG_DATA);
