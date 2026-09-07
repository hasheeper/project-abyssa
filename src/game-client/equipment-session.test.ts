import { expect,it,vi } from 'vitest';
import { GameSession,type ClientRuntime } from './session';
import { EQUIPMENT_COMMAND_POLICY } from './use-equipment-session';
import { readVersionedPending,writeVersionedPending } from './versioned-pending-request';
import type { D5GameRecord } from '../game-application';
const head={saveId:'equipment',epoch:'epoch',revision:2};
const record={schemaVersion:4,head,contentRef:{digest:'test'},commits:[],snapshot:{campaign:{activeRunRef:{kind:'expedition',id:'run'},memory:null,stories:[],settlements:[]}}} as unknown as D5GameRecord;
const storage=()=>{const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);},removeItem:(k:string)=>{m.delete(k);}};};
it('does not execute a pending story or enemy continuation while viewing equipment',async()=>{
 const s=storage();writeVersionedPending(s,{protocolVersion:4,saveId:head.saveId,expectedHead:head,clientRequestId:'story',command:{type:'complete-story',sessionId:'story'}});
 const dispatch=vi.fn(),resumeEnemyTurn=vi.fn(),continuation=vi.fn();
 const runtime={application:{open:async()=>({ok:true,record}),dispatch,resumeEnemyTurn},queries:{continuation},close:vi.fn()} as unknown as ClientRuntime;
 const session=new GameSession(runtime,{saveId:head.saveId,epoch:head.epoch},s,()=>{},EQUIPMENT_COMMAND_POLICY);
 await session.refresh();await session.dispatch({type:'leave-memory',runRef:{kind:'memory',id:'other',attempt:1}});
 await session.dispatch({type:'equip-equipment',instanceId:'blade',ownerId:'eustice'});
 expect(session.getSnapshot().error?.code).toBe('pending-other-command');
 expect(dispatch).not.toHaveBeenCalled();expect(resumeEnemyTurn).not.toHaveBeenCalled();expect(continuation).not.toHaveBeenCalled();expect(readVersionedPending(s,record)?.command.type).toBe('complete-story');session.dispose();
});
it('recovers only the lost equipment receipt without advancing a subsequently active run',async()=>{
 const s=storage();const request={protocolVersion:4 as const,saveId:head.saveId,expectedHead:head,clientRequestId:'equip',command:{type:'equip-equipment' as const,instanceId:'blade',ownerId:'eustice'}};writeVersionedPending(s,request);
 const dispatch=vi.fn(async()=>({ok:true,replayed:true,receipt:{version:4,status:'committed',before:head,after:head}})),continuation=vi.fn(),notify=vi.fn();
 const runtime={application:{open:async()=>({ok:true,record}),dispatch,resumeEnemyTurn:vi.fn()},queries:{continuation},close:vi.fn()} as unknown as ClientRuntime;
 const session=new GameSession(runtime,{saveId:head.saveId,epoch:head.epoch},s,notify,EQUIPMENT_COMMAND_POLICY);
 await session.refresh();expect(dispatch).toHaveBeenCalledWith(request);expect(notify).toHaveBeenCalledOnce();expect(continuation).not.toHaveBeenCalled();expect(readVersionedPending(s,record)).toBeNull();session.dispose();
});
