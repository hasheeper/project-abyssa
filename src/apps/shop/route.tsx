import { ShopPage } from "./ShopPage";
import { SceneTransitionProvider } from "../../shared/transition";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components-core.css";
import "../../shared/ui/styles/items.css";
import "../../shared/stage/stage.css";
import "./shop.css";
import "./shop-counter.css";

export default function Page() {
  return (
    <>
      <SceneTransitionProvider>
        <ShopPage />
      </SceneTransitionProvider>
    </>
  );
}
