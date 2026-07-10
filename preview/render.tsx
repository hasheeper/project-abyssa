import { renderToStaticMarkup } from "react-dom/server";
import { App } from "./main";

export function renderCatalog() {
  return renderToStaticMarkup(<App />);
}
