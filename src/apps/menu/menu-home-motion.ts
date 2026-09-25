import { cubicBezier } from "motion/react";
import { motionTokens } from "../../shared/ui/motion/presets";

const timing = motionTokens.menuSection;
const revealEase = cubicBezier(.18, .72, .24, 1);
export const homeReveal = (time: number, start: number, duration: number) =>
  revealEase(Math.max(0, Math.min(1, (time - start) / duration)));

type Layer = { selector: string; start: number; duration: number; x?: number; y?: number; scale?: number; opacity?: number };
/** The route intro's movable layers, with its initial scene/sidebar wait removed.
 * One reversible clock: exit unwinds the same choreography without CSS restarts. */
export const homeLayers: readonly Layer[] = [
  { selector: ".menu-home-backdrop", start: 100, duration: 780 },
  { selector: ".menu-host__glow", start: 0, duration: 650 },
  { selector: ".menu-host__figure", start: 40, duration: 800, x: -32, y: 10, scale: 1.018 },
  { selector: ".menu-host__fade", start: 40, duration: 800 },
  { selector: ".menu-topbar__funds-track", start: 260, duration: 480, x: 32 },
  { selector: ".menu-dial__rings", start: 240, duration: 650, scale: .9, opacity: .58 },
  { selector: ".menu-dial__jewel, .menu-dial__jewel-line", start: 360, duration: 300 },
  ...["estate", "roster", "shop", "sortie"].flatMap((id, index) => {
    const [x, y] = [[0, 28], [32, 0], [-32, 0], [0, -28]][index];
    return [
      { selector: `.menu-dial__panel-entry[data-command="${id}"]`, start: 420 + index * 80, duration: 500, x, y, scale: .96 },
      // HTML overlays use .875 of the SVG's 800-unit art; the two must coincide.
      { selector: `.menu-dial__content-entry[data-command="${id}"]`, start: 420 + index * 80, duration: 500, x: x * .875, y: y * .875, scale: .96 },
    ];
  }),
  { selector: ".menu-dial__dialogue", start: 840, duration: 320, x: 16 },
  { selector: ".menu-home-controls", start: 960, duration: 220, y: 6 },
];

/** Bind once per home tree, then write only composite properties per frame.
 * Independent translate/scale leave the camera and authored layout transforms intact. */
export function bindMenuHomeMotion(root: HTMLElement) {
  const bindings = homeLayers.flatMap(layer => Array.from(root.querySelectorAll<HTMLElement | SVGElement>(layer.selector), element => ({ layer, element })));
  return (time: number) => {
    for (const { layer, element } of bindings) {
      const value = homeReveal(time, layer.start, layer.duration), rest = 1 - value;
      element.style.opacity = String(value * (layer.opacity ?? 1));
      if (layer.x || layer.y) element.style.translate = `${rest * (layer.x ?? 0)}px ${rest * (layer.y ?? 0)}px`;
      if (layer.scale) element.style.scale = String(1 + rest * (layer.scale - 1));
    }
  };
}

export const homeTitleReveal = (time: number) => homeReveal(time, 0, timing.titleMs);
