import { MapPage } from "./MapPage";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components-core.css";
import "../../shared/ui/styles/items.css";
import "../../shared/stage/stage.css";
import "./map.css";
import "./map-materials.css";
import "./map-document.css";
import "./sortie/sortie.css";
import "./sortie/sortie-dossier.css";
import "./sortie/sortie-roster.css";
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
