import room from "../../assets/backgrounds/shop-bg3.jpg";
import interior from "../../assets/backgrounds/shop-bg2.png";
import wood from "../../assets/ui/shop/wood-grain-v1.webp";
import foreground from "./assets/counter-foreground-front.png";
import quillMask from "./assets/counter-quill-mask.svg";
import lantern from "./assets/icons/lantern.svg";
import purse from "./assets/icons/purse.svg";
import coins from "./assets/icons/coins.svg";
import magnifier from "./assets/icons/magnifier.svg";
import { prepareImages } from "../../shared/loading/images";
import { getExpressionParts } from "../../shared/ui/patterns/expressions";
import { resolveEmotionCue } from "../../shared/ui/patterns/emotion-cues";
import { shopDialogue } from "../../content/presentation/shop-dialogue";
import { supplyArt } from "../../content/presentation/supply-icons";
import { shopLootPresentation } from "../../content/presentation/shop-loot";
import { shopActor, shopSpriteBase } from "./merchant-art";

const lines = [...Object.values(shopDialogue), ...Object.values(shopLootPresentation)
  .flatMap(item => [item.teaser, ...item.appraisal, item.sold, item.kept])];
const parts = new Set(["base"]);
for (const line of lines) {
  const expression = getExpressionParts(shopActor.id, resolveEmotionCue(shopActor, line.emotion).expression);
  if (!expression) continue;
  parts.add(`eyes_${expression.eyes}`); parts.add(`mouth_${expression.mouth}`);
  if (expression.face !== undefined) parts.add(`face_${expression.face}`);
}
export const newShopAssets = [room, interior, wood, foreground, quillMask, lantern, purse, coins, magnifier,
  ...Object.values(supplyArt).map(item => item.icon), ...Object.values(shopLootPresentation).map(item => item.iconUrl),
  ...[...parts].map(part => `${shopSpriteBase}${shopActor.id}/${part}.png`)];

let preparing: Promise<void> | undefined;
/** Shared decode cache handles StrictMode and retries; a failed preparation is never ready. */
export function prepareNewShopAssets() {
  return preparing ??= Promise.all([prepareImages(newShopAssets), document.fonts?.ready])
    .then(() => undefined).catch(error => {preparing = undefined; throw error;});
}
