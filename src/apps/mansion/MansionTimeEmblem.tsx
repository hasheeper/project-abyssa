import type { MansionPhaseId } from "./data";

const bezel = "M57 9 H123 L171 57 V123 L123 171 H57 L9 123 V57 Z";

function TimeSymbol({ phase }: { phase: MansionPhaseId }) {
  return <g className="mansion-time-loading__symbol" data-symbol={phase}>
    {phase === "night" ? <>
      <path d="M102 62a29 29 0 1 0 20 41 28 28 0 0 1-20-41Z" className="mansion-time-loading__relief" />
      <path d="m113 66 2.5 7.5 7.5 2.5-7.5 2.5-2.5 7.5-2.5-7.5-7.5-2.5 7.5-2.5Z" className="mansion-time-loading__star" />
    </> : phase === "day" ? <>
      <circle cx="90" cy="90" r="18" className="mansion-time-loading__relief" />
      <g>{Array.from({ length: 8 }, (_, i) => <path key={i} d="M90 56v8" transform={`rotate(${i * 45} 90 90)`} />)}</g>
    </> : <>
      <path d="M68 98a22 22 0 0 1 44 0Z" className="mansion-time-loading__relief" />
      <path d="M90 65v-6M61 71l5 5M119 71l-5 5M56 101h68M68 110h44" />
      <path d={phase === "dawn" ? "m85 121 5-5 5 5" : "m85 117 5 5 5-5"} />
    </>}
  </g>;
}

/** Only the symbols roll upward; the light outline and ticks stay in place. */
export function MansionTimeEmblem({ phase, fromPhase }: { phase: MansionPhaseId; fromPhase: MansionPhaseId }) {
  const changing = fromPhase !== phase;
  return <svg className="mansion-time-loading__clock" viewBox="0 0 180 180" aria-hidden="true">
    <path d={bezel} className="mansion-time-loading__bezel" />
    <circle cx="90" cy="90" r="63" className="mansion-time-loading__dial" />
    <g className="mansion-time-loading__ticks">
      {Array.from({ length: 24 }, (_, i) => <path key={i} d={i % 6 ? "M90 32v3" : "M90 31v6"} transform={`rotate(${i * 15} 90 90)`} />)}
    </g>
    <g className="mansion-time-loading__hand"><path d="m90 22 3 5-3 5-3-5Z" /></g>
    {/* A small native SVG viewport clips the roll; no mask/filter touches the scene.
        Keep both glyphs mounted throughout the passage, including status updates. */}
    <svg className="mansion-time-loading__symbol-window" x="46" y="46" width="88" height="88"
      viewBox="46 46 88 88" overflow="hidden" data-direction={changing ? "up" : undefined}>
      {changing ? <g className="mansion-time-loading__symbol-roll" key={`${fromPhase}-${phase}`}>
        <TimeSymbol phase={fromPhase}/>
        <g transform="translate(0 88)"><TimeSymbol phase={phase}/></g>
      </g> : <TimeSymbol phase={phase}/>}
    </svg>
  </svg>;
}
