import type { MansionWeather } from "./mansion-weather";

export function MansionWeatherGlyph({weather,className}:{weather:MansionWeather;className?:string}) {
  return <svg className={className} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {weather==="clear" ? <>
      <circle cx="16" cy="16" r="5"/>
      <path d="M16 3v4m0 18v4M3 16h4m18 0h4M6.8 6.8l2.9 2.9m12.6 12.6l2.9 2.9M6.8 25.2l2.9-2.9M22.3 9.7l2.9-2.9"/>
    </> : <>
      {weather==="cloudy" && <g opacity=".72"><path d="M9 6V3M3 12H1m3-8 2 2m11-2-2 2"/><path d="M5 15a5 5 0 1 1 8-6"/></g>}
      {weather==="overcast" && <path d="M10 10a5 5 0 0 1 9-4 4 4 0 0 1 8 3" opacity=".5"/>}
      <path d="M8 22a5 5 0 0 1-1-9 7 7 0 0 1 13-2 5.5 5.5 0 1 1 4 11Z"/>
      {weather==="rain" && <path d="m10 26-1 3m8-3-1 3m8-3-1 3"/>}
    </>}
  </svg>;
}
