import { MenuPage } from "./MenuPage";
import manorNightGallery from "../../assets/backgrounds/manor-night-gallery.jpg";
import { prepareImages } from "../../shared/loading/images";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components-core.css";
import "../../shared/stage/stage.css";
import "./menu.css";

// CSS backgrounds are not document.images: keep the first scene ready on a cold visit.
export const prepare = () => prepareImages([manorNightGallery]);

export default function Page() {
  return (
    <>
      <MenuPage />
    </>
  );
}
