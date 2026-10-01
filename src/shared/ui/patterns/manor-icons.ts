import { resolveItemIcon } from "../../../assets/icons/items/catalog";

/* 洋馆工具窗(库存、日志、整备)的图标一律按检索词从素材库取,
   不直接引用 svg 文件;换素材或补词表时,各窗口自动跟随。 */
const urls = new Map<string, string>();
/** 按检索词取素材库图标的地址;同一词只解析一次。 */
export function manorIcon(term: string) {
  let url = urls.get(term);
  if (!url) urls.set(term, url = resolveItemIcon(term).assetUrl);
  return url;
}

/** 三个工具窗共用的区块图标词:同一种东西在不同窗口里用同一枚图标。 */
export const MANOR_SECTION_ICONS = {
  loadout: "行囊",
  provisions: "材料袋",
  storage: "箱子",
} as const;
