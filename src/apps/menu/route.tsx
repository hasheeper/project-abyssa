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

const MenuPreview = import.meta.env.DEV ? lazy(() => import("./dev/MenuPreview")) : null;

export default function Page() {
  const sample = import.meta.env.DEV ? new URLSearchParams(routeSearch()).get("memory-preview") : null;
  const codex = import.meta.env.DEV ? new URLSearchParams(routeSearch()).get("codex-preview") : null;
  if (codex && MenuPreview) return <Suspense fallback={null}><MenuPreview key={`codex:${codex}`} sample={codex} section="codex"/></Suspense>;
  if (sample && MenuPreview) return <Suspense fallback={null}><MenuPreview key={`memory:${sample}`} sample={sample}/></Suspense>;
  return (
    <>
      <MenuPage />
    </>
  );
}
