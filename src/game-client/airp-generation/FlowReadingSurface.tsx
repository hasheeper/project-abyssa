import {useLayoutEffect,useRef,type ReactNode} from "react";
import {modalFocusables} from "../../shared/ui/primitives/useModalPresentation";

/** Keep input in the reader without making its shared Stage/portal ancestor inert. */
export function FlowReadingSurface({blocked,locked,dissolve,children}: {blocked:boolean;locked:boolean;dissolve:boolean;children:ReactNode}) {
  const root=useRef<HTMLDivElement>(null), active=locked&&!blocked;
  useLayoutEffect(()=>{
    const panel=root.current;
    if(!active||!panel)return;
    const nestedModal=()=>[...document.querySelectorAll("[data-ui-modal-present]")].some(modal=>!modal.closest("[inert]"));
    const focus=()=>{
      const stage=panel.querySelector<HTMLElement>(".rp-app__stage");
      (stage&&!stage.closest("[inert]")?stage:panel).focus({preventScroll:true});
    };
    const guard=(event:Event)=>{
      if(nestedModal()||event.target instanceof Node&&panel.contains(event.target))return;
      event.preventDefault();event.stopImmediatePropagation();focus();
    };
    const events=["focusin","keydown","keyup","pointerdown","click"];
    for(const name of events)window.addEventListener(name,guard,true);
    if(!nestedModal()&&!panel.contains(document.activeElement))focus();
    return()=>{for(const name of events)window.removeEventListener(name,guard,true);};
  },[active]);
  return <div ref={root} className="flow-reader" tabIndex={-1} data-blocked={blocked||undefined}
    data-reader-locked={locked||undefined}
    data-entrance={dissolve?"dissolve":undefined} inert={blocked||undefined} aria-hidden={blocked||undefined}
    onKeyDown={event=>{
      if(!active)return;
      event.stopPropagation();
      if(event.key!=="Tab")return;
      const nodes=modalFocusables(event.currentTarget),first=nodes[0],last=nodes.at(-1);
      if(!first){event.preventDefault();event.currentTarget.focus();}
      else if(event.shiftKey&&(document.activeElement===first||document.activeElement===event.currentTarget)){event.preventDefault();last!.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }} onKeyUp={event=>{if(active)event.stopPropagation();}}>{children}</div>;
}
