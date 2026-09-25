import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";

type Entrance = {blocked:boolean; register:()=>()=>void; prepared:()=>void};
const Context=createContext<Entrance|null>(null);

/** Reader assets and the outgoing scene share one presentation handoff, never a game command. */
export function FlowReaderEntrance({blocked,onPrepared,children}: {blocked:boolean;onPrepared:()=>void;children:ReactNode}) {
  const registered=useRef(0), callback=useRef(onPrepared);
  callback.current=onPrepared;
  const register=useCallback(()=>{registered.current++;return()=>{registered.current--;};},[]);
  const prepared=useCallback(()=>callback.current(),[]);
  const value=useMemo(()=>({blocked,register,prepared}),[blocked,register,prepared]);
  // Plain readers have no asynchronous preparation. AIRP registers in layout.
  useEffect(()=>{if(!registered.current)prepared();},[prepared]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useFlowReaderEntrance() {
  const entrance=useContext(Context);
  useLayoutEffect(()=>entrance?.register(),[entrance?.register]);
  return entrance;
}
