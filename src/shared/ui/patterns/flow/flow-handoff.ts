/** One room expansion, followed by the shared reader's quiet component entrance. */
export const FLOW_HANDOFF = {
  delayMs:40, expandMs:720, reducedMs:80,
  expandEase:[.4,0,.1,1] as const,
  // The full AVG illustration ends above its existing 52px reading controls.
  from:{left:80,top:45,width:1440,height:810},
  to:{left:0,top:0,width:1600,height:848},
  aperture:4,
} as const;
