import { expect, it } from "vitest";
import { expandRect, intersects, placeTutorialCard, visibleAnchorRect } from "./geometry";

it("keeps a readable card clear of the highlighted target and required controls at several viewport scales",()=>{
  for(const scale of [1,.8,1.25]) {
    const bounds={x:0,y:0,width:1280/scale,height:720/scale};
    const target={x:bounds.width*.45,y:bounds.height-90,width:150,height:48};
    const controls=[{x:bounds.width*.7,y:bounds.height-90,width:150,height:48}];
    const card=placeTutorialCard(bounds,{width:304,height:170},[expandRect(target)],controls)!;
    expect(card).not.toBeNull();
    expect(intersects(card,target)).toBe(false);
    expect(controls.some(c=>intersects(card,c))).toBe(false);
    expect(card.x).toBeGreaterThanOrEqual(14);
    expect(card.y+card.height).toBeLessThanOrEqual(bounds.height-14);
  }
});

it("finds another gap when the preferred side is occupied, and declines instead of overlapping when none fits",()=>{
  const bounds={x:0,y:0,width:1280,height:720},target={x:470,y:230,width:120,height:60};
  const obstacle={x:600,y:0,width:680,height:720};
  const card=placeTutorialCard(bounds,{width:300,height:170},[target],[obstacle],["right"])!;
  expect(card).not.toBeNull();expect(intersects(card,obstacle)).toBe(false);
  expect(placeTutorialCard(bounds,{width:300,height:170},[target],[bounds])).toBeNull();
});

it("rejects clipped, hidden and detached controls instead of drawing a stale target",()=>{
  const parent=document.createElement("div"),node=document.createElement("button");
  parent.style.overflowX="hidden";parent.style.overflowY="hidden";parent.append(node);document.body.append(parent);
  parent.getBoundingClientRect=()=>({left:100,top:100,width:100,height:100} as DOMRect);
  node.getBoundingClientRect=()=>({left:170,top:130,width:80,height:40} as DOMRect);
  const bounds={x:0,y:0,width:1280,height:720};
  expect(visibleAnchorRect(node,bounds)).toBeNull();
  node.getBoundingClientRect=()=>({left:110,top:130,width:80,height:40} as DOMRect);
  expect(visibleAnchorRect(node,bounds)).toEqual({x:110,y:130,width:80,height:40});
  parent.hidden=true;expect(visibleAnchorRect(node,bounds)).toBeNull();
  parent.remove();expect(visibleAnchorRect(node,bounds)).toBeNull();
});
