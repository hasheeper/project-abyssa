import { useLayoutEffect, useRef } from "react";
import type { MansionArtwork } from "./mansion-assets";

/** Attach the exact image that completed decoding offscreen, plus its optional
 * prepared sky-only decoration. No visible canvas, CSS grade, or partial world
 * drawing is involved; buildings remain in the same opaque image. */
export function MansionMapArt({artwork}: {artwork: MansionArtwork | null}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!artwork) return;
    ref.current!.append(artwork.image);
    if(artwork.sky)ref.current!.append(artwork.sky.element);
    const unmountSky=artwork.sky?.mount();
    return () => {unmountSky?.();artwork.sky?.element.remove();artwork.image.remove();};
  }, [artwork]);
  return <div ref={ref} className="mansion-map-surface" aria-hidden="true" />;
}
