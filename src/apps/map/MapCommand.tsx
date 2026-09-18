import { forwardRef, type ButtonHTMLAttributes } from "react";
import { RibbonFrameArt } from "../../shared/ui/primitives/RibbonButton";
import { useUiMotion } from "../../shared/ui/motion/UiMotionProvider";

/** Only the middle ribbon stretches. End diamonds retain their square viewBox. */
export const MapCommand = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(function MapCommand(
  { className = "", children, ...props }, ref
) {
  const { reduced } = useUiMotion();
  return <button {...props} ref={ref} type="button" className={`abyssa-ribbon-button abyssa-control-motion map-command ${className}`}
    data-ui-motion={reduced ? "reduced" : "full"}>
    <RibbonFrameArt className="abyssa-control-motion__art" preserveAspectRatio="none" sideDiamonds={false}/>
    {(["left", "right"] as const).map(edge => <svg key={edge} className="map-command__gem abyssa-control-motion__art"
      data-edge={edge} viewBox="0 0 28 28" aria-hidden="true">
      <path d="M14 1 27 14 14 27 1 14Z" fill="var(--abyssa-frame-dark)" stroke="var(--abyssa-frame-light)" strokeWidth="1"/>
      <path d="M14 6 22 14 14 22 6 14Z" fill="var(--abyssa-frame-light)"/>
      <path d="M14 10 18 14 14 18 10 14Z" fill="var(--abyssa-frame-dark)"/>
    </svg>)}
    <span className="abyssa-ribbon-button__label abyssa-control-motion__art">{children}</span>
  </button>;
});
