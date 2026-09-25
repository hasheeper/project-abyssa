import { ShopPage } from "./ShopPage";
import { prepareImages } from "../../shared/loading/images";
import { SceneTransitionProvider } from "../../shared/transition";
import { newShopAssets } from "../../game-client/shop/entrance-assets";
import { shopIntroductionAssets } from "./ShopIntroduction";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components-core.css";
import "../../shared/ui/styles/items.css";
import "../../shared/ui/styles/paper-doll.css";
import "../../shared/ui/styles/scene-feedback.css";
import "../../shared/stage/stage.css";
import "./shop-scene.css";

export const prepare = () => prepareImages([...new Set([...newShopAssets, ...shopIntroductionAssets])]);

export default function Page() {
  return (
    <>
      <SceneTransitionProvider>
        <ShopPage />
      </SceneTransitionProvider>
    </>
  );
}
