import { MenuPage } from "./MenuPage";
import { lazy, Suspense } from "react";
import { routeSearch } from "../../shared/routing/location";
import manorNightGallery from "../../assets/backgrounds/manor-night-gallery.jpg";
import { prepareImages } from "../../shared/loading/images";
import "../../shared/ui/styles/tokens.css";
import "../../shared/ui/styles/components-core.css";
import "../../shared/stage/stage.css";
import "./menu.css";

// CSS backgrounds are not document.images: keep the first scene ready on a cold visit.
export const prepare = () => prepareImages([manorNightGallery]);

const MemoryPreview = import.meta.env.DEV ? lazy(() => import("./dev/MemoryMenuPreview")) : null;

export default function Page() {
  const sample = import.meta.env.DEV ? new URLSearchParams(routeSearch()).get("memory-preview") : null;
  if (sample && MemoryPreview) return <Suspense fallback={null}><MemoryPreview sample={sample}/></Suspense>;
  return (
    <>
      <MenuPage />
    </>
  );
}
