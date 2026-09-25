/** Short chains continue above the scene and fasten onto the sign's upper face. */
export function ShopSignHangers() {
  return <svg className="new-shop__sign-hangers" viewBox="0 -80 560 114" aria-hidden="true">
    {[88, 472].map(x => <g key={x} transform={`translate(${x} 0)`}>
      {[-72, -61, -50, -39, -28, -17, -6, 5].map(y => <g key={y}>
        <ellipse cx="0" cy={y} rx="2.6" ry="5.8" fill="none" stroke="#0b0704" strokeWidth="3" />
        <ellipse cx="0" cy={y} rx="2.6" ry="5.8" fill="none" stroke="#806744" strokeWidth="1.2" />
        <path d={`M0 ${y + 4}v3`} stroke="#ae8c50" strokeOpacity=".55" strokeWidth="1" />
      </g>)}
      <path d="M-5 10H5V20L2 23H-2L-5 20Z" transform="translate(1 1)" fill="#0d0905" />
      <path d="M-5 9H5V19L2 22H-2L-5 19Z" fill="#342515" stroke="#806744" strokeWidth=".8" />
      <path d="M-3.5 18V10.5H3.5" fill="none" stroke="#b09766" strokeOpacity=".35" strokeWidth=".6" />
      <circle cy="16" r="2" fill="#927443" stroke="#171007" strokeWidth=".9" />
      <path d="M-1 16H1" stroke="#322315" strokeWidth=".7" />
    </g>)}
  </svg>;
}
