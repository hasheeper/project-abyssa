/** SVG <use> instances cannot match our route-scoped ancestor selectors.
 * Keep paint on the shapes themselves; currentColor is inherited from each
 * visible <use>, so selected and idle panels can share the same engraving. */
export function MenuDialFiligree({ diamondId, sideId }: { diamondId: string; sideId: string }) {
  return (
    <defs>
      <g id={diamondId} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* An open corner crest, not a framed tile. The matching surface masks
            the inset line where the engraving takes over the panel's tip. */}
        <path d="M0-31C12-27 26-29 32-17L32-4 0 32-32-4-32-17C-26-29-12-27 0-31Z" fill="var(--menu-cmd-fill)" stroke="none" />
        <path d="M-29-3C-23 4-14 15 0 30C14 15 23 4 29-3" strokeWidth="1.7" opacity=".78" />
        {["scale(1 1)", "scale(-1 1)"].map((transform) => (
          <g key={transform} transform={transform}>
            <path d="M0 13C9 9 10-2 22-5C33-8 31-22 22-23C14-24 10-16 15-12C19-9 24-12 22-16C21-18 18-18 18-15" />
            <path d="M25-2C24 5 18 9 11 8C14 2 18-2 25-2Z" fill="currentColor" fillOpacity=".28" strokeWidth="1.35" />
            <path d="M9-10C4-16 6-23 10-28C15-22 15-16 9-10Z" fill="currentColor" fillOpacity=".22" strokeWidth="1.35" />
            <path d="M4 16 8 13M14 4 21 1" strokeWidth="1.35" />
          </g>
        ))}
        <path d="M0-27C8-18 7-9 0-3C-7-9-8-18 0-27Z" fill="currentColor" fillOpacity=".34" strokeWidth="1.5" />
        <path d="M0-21V-9M0 8V27" strokeWidth="1.45" />
        <path d="M0-3 5 2 0 8-5 2Z" fill="var(--menu-cmd-fill)" strokeWidth="1.6" />
        <circle cy="2" r="1.3" fill="currentColor" stroke="none" />
      </g>
      <g id={sideId} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {/* Paired leaf brackets sit on the side bevel; they do not enclose text. */}
        {["scale(1 1)", "scale(1 -1)"].map((transform) => (
          <g key={transform} transform={transform}>
            <path d="M-21 0C-12-2-14-15-3-16C7-17 11-8 5-5C1-3-3-7 0-9C2-11 5-8 3-7" />
            <path d="M-2-17C3-17 8-22 12-21C12-16 9-12 5-12Z" fill="currentColor" fillOpacity=".3" strokeWidth="1.3" />
          </g>
        ))}
        <path d="M-19 0-7-3-2 0-7 3Z" fill="currentColor" fillOpacity=".32" strokeWidth="1.3" />
        <circle cx="3" r="1.35" fill="currentColor" stroke="none" />
      </g>
    </defs>
  );
}
