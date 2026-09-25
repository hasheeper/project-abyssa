import { useMemo, useState } from "react";
import { Stage } from "../../shared/stage";
import { ReadingPlayer, type ReadingPage } from "../../shared/presentation/adv/ReadingPlayer";
import { SCENES } from "./transcript";
import background from "../../assets/backgrounds/shop.png";

/** The preview uses the same reading controls as the game; only its local scenario cursor differs. */
export function App() {
  const [sceneIndex, setSceneIndex] = useState(0), [cursor, setCursor] = useState(0);
  const scene = SCENES[sceneIndex], last = cursor === scene.messages.length - 1;
  const frames = (index: number, limit: number): ReadingPage[] => SCENES[index].messages.slice(0,limit).map((message,i)=>({
    id:message.id, actors:SCENES[index].actors, background, messages:SCENES[index].messages.slice(0,i+1),
  }));
  const pages = useMemo(()=>frames(sceneIndex,cursor+1),[sceneIndex,cursor]);
  const history = useMemo(()=>SCENES.slice(0,sceneIndex).map((s,i)=>({id:s.id,title:s.title,pages:frames(i,s.messages.length)})),[sceneIndex]);
  const next = () => {
    if (!last) setCursor(cursor+1);
    else if (sceneIndex<SCENES.length-1) {setSceneIndex(sceneIndex+1);setCursor(0);}
  };
  return <Stage background="var(--abyssa-rp-backdrop)"><ReadingPlayer initialLayout="nvl" sceneId={scene.id} title={scene.title} location={scene.title}
    pages={pages} history={history} canAdvance={!last} onNext={next} finalLabel={sceneIndex<SCENES.length-1?"进入下一幕":"演出终了"}/></Stage>;
}
