/** Dev-only visual harness: imports the production surface/styles, never a game route.
 * Clicks report dispatches, not fabricated combat damage. Party UI is the real component. */
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Stage } from "../../src/shared/stage";
import { AbyssaProvider } from "../../src/shared/ui/primitives/AbyssaProvider";
import { UiMotionProvider } from "../../src/shared/ui/motion/UiMotionProvider";
import { ExpeditionBattleSurface } from "../../src/apps/battle/presentation/ExpeditionBattleSurface";
import { BattleRoomLoading } from "../../src/apps/battle/presentation/BattleRoomLoading";
import { JOURNEY_MOTION_MS } from "../../src/apps/battle/presentation/journey-motion";
import type { BattleSurfaceEnemy } from "../../src/apps/battle/presentation/battle-surface-model";
import type { BattleUiSkin } from "../../src/apps/battle/battleUiSkins";
import { ENEMY_ART_BOUNDS } from "../../src/apps/battle/presentation/enemy-stage-model";
import { tideEnemyArt, tideBossBackground } from "../../src/content/presentation/tide-cave";
import "../../src/shared/ui/styles/tokens.css";
import "../../src/shared/ui/styles/components-core.css";
import "../../src/shared/stage/stage.css";
import "../../src/apps/battle/app.css";
import "../../src/apps/battle/expedition.css";

const ids=["kael","eustice","elora","kororo","norma"];
const party=ids.map(id=>({id,hp:5,maxHp:5,returnHp:5,downed:false,shield:0,ready:true,healable:false,incoming:{raw:2,final:2}}));
const arts=["tide-slime","crossbowman","hauler","reef-hook-chief","lookout","crossbowman","hauler","tide-slime"];
const names=["浊泥史莱姆","亡命徒·弩手","亡命徒·扛夫","匪首「礁钩」","亡命徒·刀手","亡命徒·弩手","亡命徒·扛夫","浊泥史莱姆"];
const health=[8,11,27,99,10,37,40,41];
const all:BattleSurfaceEnemy[]=arts.map((short,i)=>{
  const art=`enemy.intro.${short}`, asset=tideEnemyArt[art];
  return {id:`qa-${i}`,name:names[i],art,artUrl:asset.url,artStyle:{height:asset.height},artBounds:ENEMY_ART_BOUNDS[art],
    boss:i===3,hp:health[i],maxHp:health[i],attack:2,blocked:0,defeated:false,frenzyActive:false,frenzyWarning:null,
    intent:{type:i===1?"charge":"attack",title:i===1?"装填":"攻击",value:i===3?12:2,targetId:i===1?undefined:ids[(i+2)%5],description:`${names[i]}的${i===1?"装填":"攻击"}意图`},
    threat:i===3?"lethal":"normal",targetable:true,intentBlockable:true};
});
const noop=()=>{};
function Harness(){
  const [skin,setSkin]=useState<BattleUiSkin>("hero-party"),[enemies,setEnemies]=useState(all),[action,setAction]=useState("尚未点击"),[held,setHeld]=useState<string|null>(null);
  const [motionReport,setMotionReport]=useState("尚未检查补位");
  const [blocked,setBlocked]=useState(false),[busy,setBusy]=useState(false),[reduced,setReduced]=useState(false);
  const [formation,setFormation]=useState("qa-eight");
  const [roomLoad,setRoomLoad]=useState<"loading"|"error"|"revealing"|null>(null);
  useEffect(()=>{
    if(roomLoad!=="revealing")return;
    const timer=window.setTimeout(()=>setRoomLoad(null),JOURNEY_MOTION_MS.revealing);
    return ()=>window.clearTimeout(timer);
  },[roomLoad]);
  const sampleFrame=useRef(0);
  useEffect(()=>()=>cancelAnimationFrame(sampleFrame.current),[]);
  const removeChief=()=>{
    cancelAnimationFrame(sampleFrame.current);
    const read=()=>[...document.querySelectorAll<HTMLElement>(".abyssa-expedition-enemy")].map(node=>{
      const id=node.dataset.enemyId!,center=parseFloat(node.style.left)+(parseFloat(node.style.translate)||0)+parseFloat(node.style.width)/2;
      const img=node.querySelector<HTMLImageElement>(":scope > img")!;
      const path=document.querySelector(`.abyssa-expedition-enemies__intent-lines g[data-enemy-id="${id}"] path`);
      return {id,center,height:img.style.height,top:img.style.top,lineError:path?Math.abs(Number(path.getAttribute("d")!.split(" ")[1])-center):0};
    });
    const trace=[read()],started=performance.now();
    setMotionReport("采样中…");
    setEnemies(current=>current.filter(enemy=>enemy.id!=="qa-3"));
    const sample=()=>{
      trace.push(read());
      if(performance.now()-started<550){sampleFrame.current=requestAnimationFrame(sample);return;}
      const last=trace.at(-1)!;
      let intermediate=0,sizeChanges=0,reversals=0,maxLineError=0;
      for(const end of last) {
        const first=trace[0].find(node=>node.id===end.id)!;
        let previous=first.center;
        for(const frame of trace.slice(1)) {
          const node=frame.find(node=>node.id===end.id)!;
          if(Math.abs(node.center-first.center)>.1&&Math.abs(node.center-end.center)>.1)intermediate++;
          if(node.height!==first.height||node.top!==first.top)sizeChanges++;
          if((node.center-previous)*(end.center-first.center)<-.01)reversals++;
          maxLineError=Math.max(maxLineError,node.lineError);previous=node.center;
        }
      }
      setMotionReport(`采样 ${trace.length} 帧；中间位置 ${intermediate}；尺寸/高度变化 ${sizeChanges}；反向跳动 ${reversals}；连线误差 ${maxLineError.toFixed(3)} px`);
    };
    sampleFrame.current=requestAnimationFrame(sample);
  };
  return <UiMotionProvider preference={reduced?"reduced":"system"}><Stage canvasClassName={`abyssa-battle-stage abyssa-battle-stage--${skin}`}><AbyssaProvider className="abyssa-expedition-theme" data-battle-ui-skin={skin}>
    <ExpeditionBattleSurface label="正式组件八敌压力验证" title="八敌 · 正式组件验证" location="测试夹具，不写入存档" formationKey={formation}
      uiSkin={skin} onUiSkinChange={setSkin} onSettle={noop} party={party} presentedEnemies={enemies}
      sceneStyle={{backgroundImage:`url("${tideBossBackground}")`}} phase="act" layerClearPending={false} isRolling={busy} inert={blocked} interactive
      heldActor={held} attackFx={null} supportFx={null} enemyTurnFx={null} isPresentationBusy={()=>false}
      journeyMotion={roomLoad==="revealing"?"loaded":roomLoad?"loading":null}
      roomLoading={roomLoad?<BattleRoomLoading state={roomLoad} location="服务走廊" onRetry={()=>setRoomLoad("loading")}/>:undefined}
      handleMemberCardClick={setHeld} handleEnemyClick={id=>setAction(`敌人点击：${id}`)} handleIntentClick={id=>setAction(`意图点击：${id}`)}
      dicePanel={null} overlays={null} sidebar={<aside className="abyssa-expedition-region" style={{padding:20,color:"#e7ce96"}}>
        <h2>八敌验证</h2><p>复用正式敌区、我方卡片和连线。</p><p>点击只记录回调，不模拟伤害。</p><output aria-live="polite">{action}</output><p>
        <button onClick={removeChief}>模拟移除首领</button></p><button onClick={()=>{setFormation("qa-eight");setEnemies(all);}}>恢复八敌</button>
        <p><output aria-label="补位动画检查">{motionReport}</output></p>
      </aside>}/>
  </AbyssaProvider></Stage>
    <nav aria-label="仅测试动效开关" style={{position:"fixed",top:4,right:4,zIndex:10000,display:"flex",gap:4}}>
      <button onClick={()=>setBlocked(value=>!value)}>{blocked?"恢复战场":"模拟手册遮挡"}</button>
      <button onClick={()=>setBusy(value=>!value)}>{busy?"恢复空闲":"模拟前景忙碌"}</button>
      <button onClick={()=>setReduced(value=>!value)}>{reduced?"恢复完整动态":"减弱动态"}</button>
      <button onClick={()=>{setFormation("qa-three");setEnemies(all.slice(0,3));}}>三敌布局</button>
      <button onClick={()=>setRoomLoad(value=>value?null:"loading")}>{roomLoad?"关闭载入预览":"慢载入预览"}</button>
      <button onClick={()=>setRoomLoad("error")}>载入失败预览</button>
      <button onClick={()=>setRoomLoad("revealing")} disabled={!roomLoad}>载入完成预览</button>
    </nav>
  </UiMotionProvider>;
}
const root=createRoot(document.getElementById("root")!);
root.render(<Harness/>);
if(import.meta.hot)import.meta.hot.dispose(()=>root.unmount());
