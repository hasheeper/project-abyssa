import { useId } from "react";
import woodGrain from "../../assets/ui/shop/wood-grain-v1.webp";

const contours = {
  body: {
    height: 878,
    outer: "M2 -8 H143 V814 Q143 834 128 842 Q102 853 72.5 876 Q43 853 17 842 Q2 834 2 814 Z",
    inner: "M8 -8 H137 V812 Q137 829 124 836 Q98 847 72.5 867 Q47 847 21 836 Q8 829 8 812 Z",
  },
  banner: {
    height: 222,
    outer: "M9 -8 H136 V165 Q136 182 122 188 Q99 197 72.5 219 Q46 197 23 188 Q9 182 9 165 Z",
    inner: "M15 -8 H130 V164 Q130 177 117 182 Q94 192 72.5 209 Q51 192 28 182 Q15 177 15 164 Z",
  },
} as const;

/** Two hanging pieces share the room's top edge, with a separate raised banner. */
export function NavigationChrome({part}: {part: keyof typeof contours}) {
  const {height, outer, inner} = contours[part];
  const id = useId();
  const grainId = `${id}-grain`;
  return <svg className="new-shop__navigation-art" data-part={part} viewBox={`0 0 145 ${height}`}
    preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <pattern id={grainId} width="600" height="54" patternUnits="userSpaceOnUse" patternTransform={part === "body" ? "rotate(90)" : undefined}>
        <image href={woodGrain} width="600" height="54" preserveAspectRatio="none" />
      </pattern>
    </defs>
    <path d={outer} transform="translate(0 4)" fill="#201509" stroke="#090603" strokeWidth="4" />
    <path d={outer} fill={`url(#${grainId})`} />
    <path d={outer} fill="#100b06" opacity={part === "body" ? .22 : .08} />
    <path d={outer} fill="none" stroke="#0b0704" strokeWidth="5" />
    <path d={outer} fill="none" stroke="#806744" strokeWidth="1.4" />
    <path d={inner} fill="none" stroke="#090603" strokeOpacity=".72" strokeWidth="3" />
    <path d={inner} transform="translate(0 1)" fill="none" stroke="#a17b40" strokeOpacity=".32" strokeWidth=".8" />
    {part === "banner" ? <>
      <path d="M11 164Q11 180 25 186Q49 196 72.5 216Q98 195 121 186Q134 180 134 164" fill="none" stroke="#a07a3e" strokeOpacity=".25" />
      <path d="m72.5 198 2 4-2 4-2-4Zm-6 2 3 2-3 1Zm12 0-3 2 3 1Z" fill="#997947" />
    </> : <path d="m72.5 842 2 5-2 5-2-5Zm-7 2 4 3-4-1Zm14 0-4 3 4-1Z" fill="#806137" opacity=".7" />}
  </svg>;
}

const plateContour = "M1 1H151V17Q151 27 155 33L158 38L155 43Q151 49 151 59V75H1Z";

/** A timber plate with a matte copper rim and a small right-hand point. */
export function NavigationPlate() {
  const id = useId();
  return <svg className="new-shop__mode-plate" viewBox="0 0 159 76" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      <pattern id={`${id}-wood`} width="420" height="38" patternUnits="userSpaceOnUse">
        <image href={woodGrain} width="420" height="38" preserveAspectRatio="none" opacity=".58" />
      </pattern>
    </defs>
    <path d={plateContour} transform="translate(0 2)" fill="#1d1108" stroke="#0a0603" strokeWidth="2" />
    <path d={plateContour} fill="#46311c" />
    <path d={plateContour} fill={`url(#${id}-wood)`} />
    <path d={plateContour} fill="none" stroke="#160d05" strokeWidth="3.5" />
    <path d={plateContour} fill="none" stroke="#9b773e" strokeWidth="1.2" />
    <path d="M3 72V3H148" fill="none" stroke="#bc985b" strokeOpacity=".38" strokeWidth=".7" />
    <path d="M3 73H149V59Q149 49 153 43L156 38" fill="none" stroke="#160e07" strokeOpacity=".8" strokeWidth="1" />
    <g fill="#a78348" opacity=".6"><circle cx="5.5" cy="6.5" r=".65" /><circle cx="5.5" cy="69.5" r=".65" /><circle cx="146.5" cy="6.5" r=".65" /><circle cx="146.5" cy="69.5" r=".65" /></g>
    <path d="m148 34 2.5 4-2.5 4-2.5-4Z" fill="#d1b37d" />
  </svg>;
}
