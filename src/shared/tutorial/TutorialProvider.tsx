import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { createTutorialStore, type TutorialStore } from "./store";
import { expandRect, intersectRect, placeTutorialCard, visibleAnchorRect } from "./geometry";
import type { TutorialRect, TutorialStep } from "./types";
import "./tutorial.css";

const Context=createContext<TutorialStore | null>(null);

/** A single body portal, outside all transformed/cropped game stages. */
export function TutorialProvider({children,suspended=false}:{children:ReactNode;suspended?:boolean}) {
  const parent=useContext(Context);
  const [store]=useState(createTutorialStore);
  // Nested standalone scene hosts reuse the application's host.
  if(parent) return <TutorialScope suspended={suspended}>{children}</TutorialScope>;
  return <Context.Provider value={store}>{children}<TutorialHost store={store} suspended={suspended}/></Context.Provider>;
}

function TutorialScope({children, suspended}:{children:ReactNode;suspended:boolean}) {
  useTutorialSuspension(suspended);
  return <>{children}</>;
}

/** Stable callback refs; no wrappers and no rerender of the game when geometry changes. */
export function useTutorialAnchors() {
  const store=useContext(Context);
  return useMemo(()=>{
    const refs=new Map<string,(node:HTMLElement | null)=>void>();
    return (id:string) => {
      if(!refs.has(id)) {
        let current: HTMLElement | null=null, release: (()=>void) | undefined;
        refs.set(id,node=>{
          if(node===current) return;
          release?.(); current=node;
          release=node?store?.register(id,node):undefined;
        });
      }
      return refs.get(id)!;
    };
  },[store]);
}

export function useTutorialStep(step: TutorialStep | null) {
  const store=useContext(Context), [owner]=useState(()=>Symbol("tutorial-owner"));
  useLayoutEffect(()=>{store?.request(owner,step);},[store,owner,step]);
  useLayoutEffect(()=>()=>store?.request(owner,null),[store,owner]);
}

export function useTutorialSuspension(blocked:boolean) {
  const store=useContext(Context), [owner]=useState(()=>Symbol("tutorial-block"));
  useLayoutEffect(()=>{store?.block(owner,blocked);},[store,owner,blocked]);
  useLayoutEffect(()=>()=>store?.block(owner,false),[store,owner]);
}

type Layout={key:string;bounds:TutorialRect;targets:TutorialRect[];contexts:{id:string;rect:TutorialRect}[];card:TutorialRect | null};
function TutorialHost({store,suspended}:{store:TutorialStore;suspended:boolean}) {
  const {step,blocked,revision}=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getSnapshot);
  const root=useRef<HTMLDivElement>(null),card=useRef<HTMLElement>(null);
  const [layout,setLayout]=useState<Layout | null>(null);
  const [obstructed,setObstructed]=useState(false);
  const [collapsedStep,setCollapsedStep]=useState<string | null>(null);
  const collapsed=!!step?.collapseOnDismiss && collapsedStep===step.id;
  useLayoutEffect(()=>{setCollapsedStep(null);},[step?.id,step?.expandKey]);
  const dismiss=()=>{if(step?.collapseOnDismiss) setCollapsedStep(step.id); else step?.onDismiss();};
  const uid=useId().replace(/:/g,"");
  const available=!!step && !suspended && !blocked;
  const measure=useCallback(()=>{
    if(!available || !step || !root.current || !card.current) {setLayout(null);return;}
    const hidden=document.hidden || [...document.querySelectorAll<HTMLElement>('[aria-modal="true"],[data-tutorial-blocking="true"]')]
      .some(node=>!root.current!.contains(node) && !node.closest('[hidden],[inert],[aria-hidden="true"]')
        && node.getBoundingClientRect().width>0 && getComputedStyle(node).visibility!=="hidden");
    setObstructed(hidden);
    if(hidden) {setLayout(null);return;}
    const raw=root.current.getBoundingClientRect();
    const bounds={x:raw.left,y:raw.top,width:raw.width,height:raw.height};
    const nodes=step.targets.map(id=>store.anchor(id));
    const targets=nodes.map(node=>node?visibleAnchorRect(node,bounds):null);
    if(!targets.length || targets.some(t=>!t)) {setLayout(null);return;}
    const expanded=targets.map(t=>intersectRect(expandRect(t!),bounds)!);
    const contexts=(step.contextTargets??[]).flatMap(id=>{
      const node=store.anchor(id),r=node?visibleAnchorRect(node,bounds):null;
      return r?[{id,rect:intersectRect(expandRect(r),bounds)!}]:[];
    });
    const protectedRects=(step.protect??[]).flatMap(id=>{
      const node=store.anchor(id),r=node?visibleAnchorRect(node,bounds):null;
      return r?[r]:[];
    });
    const size=card.current.getBoundingClientRect();
    const next={key:step.id,bounds,targets:expanded,contexts,card:placeTutorialCard(bounds,{width:size.width,height:size.height},expanded,[...protectedRects,...contexts.map(c=>c.rect)],step.sides)};
    setLayout(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);
  },[available,step,store,collapsed]);

  useLayoutEffect(()=>{
    if(!available || !step) {setLayout(null);return;}
    let raf=0;
    const schedule=()=>{if(!raf) raf=requestAnimationFrame(()=>{raf=0;measure();});};
    measure();
    const observer=typeof ResizeObserver!=="undefined"?new ResizeObserver(schedule):null;
    const observed=new Set<HTMLElement>();
    [root.current,card.current,...[...step.targets,...step.contextTargets??[],...step.protect??[]].map(id=>store.anchor(id))].forEach(node=>{
      // Ancestors can resize/reflow without changing the control's own size.
      for(let n=node;n;n=n.parentElement) if(!observed.has(n)) {observed.add(n);observer?.observe(n);}
    });
    const mutations=new MutationObserver(records=>{
      if(records.some(r=>!root.current?.contains(r.target))) schedule();
    });
    mutations.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["hidden","inert","aria-hidden","aria-modal","data-tutorial-blocking"]});
    window.addEventListener("resize",schedule);
    window.addEventListener("scroll",schedule,true);
    window.visualViewport?.addEventListener("resize",schedule);
    window.visualViewport?.addEventListener("scroll",schedule);
    document.addEventListener("visibilitychange",schedule);
    document.addEventListener("transitionend",schedule,true);
    document.addEventListener("animationend",schedule,true);
    return ()=>{
      cancelAnimationFrame(raf);observer?.disconnect();mutations.disconnect();
      window.removeEventListener("resize",schedule);window.removeEventListener("scroll",schedule,true);
      window.visualViewport?.removeEventListener("resize",schedule);window.visualViewport?.removeEventListener("scroll",schedule);
      document.removeEventListener("visibilitychange",schedule);document.removeEventListener("transitionend",schedule,true);document.removeEventListener("animationend",schedule,true);
    };
  },[available,step,store,revision,measure]);

  const visible=available && !obstructed && layout?.key===step?.id && !!layout.card;
  useLayoutEffect(()=>{
    if(!visible || !step) return;
    const restored: (()=>void)[]=[];
    step.targets.forEach(id=>{
      const node=store.anchor(id);
      if(!node) return;
      const described=node.getAttribute("aria-describedby");
      node.setAttribute("aria-describedby",[described,`tutorial-copy-${uid}`].filter(Boolean).join(" "));
      restored.push(()=>{
        const remaining=(node.getAttribute("aria-describedby")??"").split(" ").filter(id=>id && id!==`tutorial-copy-${uid}`).join(" ");
        if(remaining) node.setAttribute("aria-describedby",remaining);else node.removeAttribute("aria-describedby");
      });
      [node,...node.querySelectorAll<HTMLElement>("[title]")].forEach(n=>{
        const title=n.getAttribute("title");
        if(title!==null) {n.removeAttribute("title");restored.push(()=>{if(!n.hasAttribute("title")) n.setAttribute("title",title);});}
      });
    });
    return ()=>restored.forEach(restore=>restore());
  },[visible,step,store,uid]);

  if(!step || typeof document==="undefined") return null;
  const local=(r:TutorialRect)=>({x:r.x-(layout?.bounds.x??0),y:r.y-(layout?.bounds.y??0),width:r.width,height:r.height});
  return createPortal(<div ref={root} className="abyssa-tutorial" data-step={step.id} data-visible={visible || undefined} data-collapsed={collapsed || undefined} data-observation={!!step.action || undefined}>
    {visible && layout && <svg className="abyssa-tutorial__canvas" aria-hidden="true" width="100%" height="100%">
      <defs><mask id={`tutorial-mask-${uid}`} maskUnits="userSpaceOnUse" x="0" y="0" width={layout.bounds.width} height={layout.bounds.height}>
        <rect width="100%" height="100%" fill="white"/>
        {layout.contexts.map(({id,rect})=><rect key={id} {...local(rect)} rx="5" fill="black"/>)}
        {layout.targets.map((r,i)=><rect key={i} {...local(r)} rx="5" fill="black"/>)}
      </mask></defs>
      {!collapsed && <rect width="100%" height="100%" fill="rgb(7 12 13 / 52%)" mask={`url(#tutorial-mask-${uid})`}/>}
      {layout.contexts.map(({id,rect})=><rect key={id} {...local(rect)} rx="5" className="abyssa-tutorial__context" data-context-target={id}/>)}
      {layout.targets.map((r,i)=><g key={i} className="abyssa-tutorial__focus">
        <rect {...local(r)} rx="5" className="abyssa-tutorial__outline"/>
        <path d={`M${local(r).x} ${local(r).y+13}v-13h13 M${local(r).x+r.width-13} ${local(r).y}h13v13 M${local(r).x+r.width} ${local(r).y+r.height-13}v13h-13 M${local(r).x+13} ${local(r).y+r.height}h-13v-13`}/>
      </g>)}
    </svg>}
    <section ref={card} key={step.id} className="abyssa-tutorial__card" data-collapsed={collapsed || undefined} role="region" aria-label="操作指引" aria-hidden={!visible}
      inert={!visible || undefined} style={{left:visible?local(layout!.card!).x:0,top:visible?local(layout!.card!).y:0,visibility:visible?"visible":"hidden"}}
      onClick={event=>event.stopPropagation()} onKeyDown={event=>{if(event.key==="Escape") {event.preventDefault();event.stopPropagation();dismiss();}}}>
      {collapsed ? <button type="button" className="abyssa-tutorial__restore" aria-label="展开操作指引" onClick={()=>setCollapsedStep(null)}>
        <span aria-hidden="true">↗</span><span>继续教学<small>{step.title}</small></span>
      </button> : <div className="abyssa-tutorial__heading"><span aria-hidden="true">◇</span><h2>{step.title}</h2><button type="button" className="abyssa-tutorial__close" aria-label={step.collapseOnDismiss ? "收起操作指引" : "关闭操作指引"} onClick={dismiss}>×</button></div>}
      <p id={`tutorial-copy-${uid}`} hidden={collapsed} role={collapsed ? undefined : "status"} aria-live={collapsed ? "off" : "polite"}>{step.text}</p>
      {!collapsed && step.action && <button type="button" className="abyssa-tutorial__next" onClick={step.action.onSelect}>{step.action.label}<span aria-hidden="true"> ›</span></button>}
    </section>
    {available && !obstructed && !visible && <button className="abyssa-tutorial__deferred" type="button" onClick={collapsed ? ()=>setCollapsedStep(null) : dismiss}>{collapsed ? "展开操作指引" : step.collapseOnDismiss ? "收起操作指引" : "关闭操作指引"}</button>}
  </div>,document.body);
}
