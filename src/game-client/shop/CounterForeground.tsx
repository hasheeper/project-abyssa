import { useEffect, useState, type CSSProperties } from "react";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";
import counterArt from "./assets/counter-foreground-front.png";

/** Light coordinates belong to the 1024px artwork, so they travel with the desk. */
export function CounterForeground({ready}: {ready: boolean}) {
  const {reduced} = useUiMotion();
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return <div className="new-shop__foreground" aria-hidden="true"
    style={{"--counter-silhouette": `url("${counterArt}")`} as CSSProperties}>
    <img className="new-shop__counter-art" src={counterArt} alt="" draggable={false} />
    <div className="new-shop__lantern-light" data-flicker={ready && visible && !reduced || undefined}>
      <span className="new-shop__lantern-halo" />
      <span className="new-shop__lantern-cast" />
      <span className="new-shop__lantern-core" />
    </div>
  </div>;
}
