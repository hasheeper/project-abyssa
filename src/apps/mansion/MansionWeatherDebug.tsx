import { useEffect, useId, useRef, useState } from "react";
import { RpgFrame } from "../../shared/ui/primitives/RpgFrame";
import { RpgNotchedPillButton } from "../../shared/ui/primitives/RpgNotchedPillButton";
import { MansionWeatherGlyph } from "./MansionWeatherGlyph";
import { MANSION_WEATHERS, weatherLabel, type MansionWeather } from "./mansion-weather";

/** Temporary art-direction control; intentionally local, not a game command. */
export function MansionWeatherDebug({value,disabled,onChange}:{value:MansionWeather;disabled?:boolean;onChange:(weather:MansionWeather)=>void}) {
  const [open,setOpen]=useState(false),id=useId();
  const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{if(disabled)setOpen(false);},[disabled]);
  useEffect(()=>{
    if(!open)return;
    root.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
    const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
    document.addEventListener("pointerdown",outside);
    return ()=>document.removeEventListener("pointerdown",outside);
  },[open]);
  return <div ref={root} className="mansion-weather-debug" data-no-pan onKeyDown={event=>{
    event.stopPropagation();
    if(event.key==="Escape" && open){setOpen(false);trigger.current?.focus();}
  }}>
    <RpgNotchedPillButton ref={trigger} label={`天气调试 · ${weatherLabel(value)}`} watermark={false}
      disabled={disabled} aria-expanded={open} aria-controls={id} onClick={()=>setOpen(!open)}/>
    {open && <RpgFrame id={id} className="mansion-weather-debug__picker" padding="sm" watermark={false}>
      <div className="mansion-weather-debug__options" role="group" aria-label="天气预览">
        {MANSION_WEATHERS.map(weather=><button key={weather.id} type="button" aria-pressed={value===weather.id}
          onClick={()=>{setOpen(false);trigger.current?.focus();onChange(weather.id);}}>
          <MansionWeatherGlyph weather={weather.id}/><span>{weather.label}</span>
        </button>)}
      </div>
      <p>仅预览天气 · 不推进时间</p>
    </RpgFrame>}
  </div>;
}
