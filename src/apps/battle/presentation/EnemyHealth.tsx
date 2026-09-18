import { ENEMY_HEALTH_POINTS_PER_LAYER, enemyHealthLayers } from "./enemy-stage-model";
export function EnemyHealth({hp,maxHp}:{hp:number;maxHp:number}) {
  const health=enemyHealthLayers(hp,maxHp);
  return <>{[0,1].map(group=>{
    const groupSize=ENEMY_HEALTH_POINTS_PER_LAYER/2;
    const pearls=health.pearls.slice(group*groupSize,(group+1)*groupSize);
    return pearls.length ? <span className="abyssa-enemy-health-group" key={group}>{pearls.map((pearl,index)=><i
      key={index} aria-hidden="true" data-layer={pearl.layer} data-empty={!pearl.layer||undefined}
      data-buried={pearl.buried||undefined} data-layer-end={pearl.boundary||undefined}/>)}</span> : null;
  })}</>;
}
