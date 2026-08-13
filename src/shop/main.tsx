import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ShopPage } from "./ShopPage";
import "../styles/index.css";
import "../stage/stage.css";
import "./shop.css";

createRoot(document.getElementById("root")!).render(<StrictMode><ShopPage /></StrictMode>);
