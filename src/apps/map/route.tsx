import { MapPage } from "./MapPage";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components-core.css";
import "../../shared/ui/styles/items.css";
import "../../shared/stage/stage.css";
import "./map.css";
import "./sortie/sortie.css";
import "./map-supplies.css";
import "./map-motion.css";
import "../../shared/ui/motion/page-board.css";

export default function Page() {
  return (
    <>
      <MapPage />
    </>
  );
}
