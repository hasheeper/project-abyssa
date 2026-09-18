import { validateD5Catalog } from "../game-core/contracts/d5-validation";
import { CHAPTER_ONE_CATALOG_DATA } from "../content/gameplay/demo-v12/content";

export const CHAPTER_ONE_CATALOG = validateD5Catalog(CHAPTER_ONE_CATALOG_DATA);
