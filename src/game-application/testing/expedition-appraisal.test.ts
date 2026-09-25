import {expect, it} from "vitest";
import {expeditionAppraisalSlots} from "../../game-core/session/expedition-appraisal";
import {earnedLoot} from "../../game-core/contracts/loot";
import {createD5ExpeditionEngine, initialD5Projection} from "../../game-core/session";
import {applyGameStart} from "../../game-core/session/game-start";
import {SHOP_AIRP_CATALOG as catalog} from "../../game-runtime/shop-wave-context";
import {clcPacket, clcProposal} from "./airp-expedition-gm-fixture";
import {freezeExpeditionFrame} from "../airp-expedition-gm/context";
import {validateExpeditionPlan} from "../../game-core/session/airp-expedition-plan";
import {tibbyAppraisalReference} from "../../content/presentation/airp/appraisal-reference";
import {parseAppraisalItems} from "../../game-core/contracts/expedition-appraisal";

it.each(["tide-reef.ordinary", "old-manor.maintenance"])("forecasts %s at every room prefix using the actual engine loot seed without changing its RNG", routeId => {
  const campaign = initialD5Projection(catalog); applyGameStart(catalog, campaign, "airp-director", "start");
  for (let seed = 0; seed < 24; seed++) {
    const departure = {runId: `forecast:${seed}`, routeId, partyIds: catalog.data.initialParty, itemIds: [], seed};
    const state = createD5ExpeditionEngine(catalog).create(campaign, departure), rng = structuredClone(state.run.rng);
    const slots = expeditionAppraisalSlots(catalog, departure), rooms = state.run.roomIds.flat();
    expect(expeditionAppraisalSlots(catalog, departure)).toEqual(slots);
    for (let i = 0; i <= rooms.length; i++) {
      const completed = rooms.slice(0, i);
      const actual = earnedLoot(catalog.data.loot!, catalog.data.routes, departure.runId, routeId, completed, state.run.rng.loot.seed).filter(d => d.grantId.endsWith(":curio"));
      expect(actual.map(d => [d.instanceId, d.definitionId, d.grantId, d.roomId])).toEqual(slots.filter(s => completed.includes(s.roomId)).map(s => [s.instanceId, s.baseDefinitionId, s.grantId, s.roomId]));
    }
    expect(state.run.rng).toEqual(rng);
    for (const s of slots) expect(s).toMatchObject({appraisalFee: 300, salePrice: catalog.data.loot!.definitions[s.baseDefinitionId].salePrice, scrapPrice: 2});
  }
});

it("requires Chinese item copy and Tibby's full reference without adding her to dungeon actors or changing the old contract", () => {
  const packet = clcPacket(), i = packet.context.rules;
  i.appraisalPlanVersion = 1;
  i.appraisalSlots = [{key: "curio:1", instanceId: "loot:1", grantId: "drop:1:curio", baseDefinitionId: "loot.curio.clock-reed", roomDefinitionId: "room:1", roomId: "run:1:room:1:1", rarity: "silver", appraisalFee: 300, salePrice: 1200, scrapPrice: 2}];
  expect(() => freezeExpeditionFrame(packet.context, packet.documents, packet.departure)).toThrow(/缇比完整角色卡/);
  packet.documents.push({...tibbyAppraisalReference, triggerIds: [packet.departure.routeId]});
  const frame = freezeExpeditionFrame(packet.context, packet.documents, packet.departure), proposal = clcProposal(packet);
  const check = (p = proposal) => validateExpeditionPlan(i, p, frame.inputHash);
  expect(frame.instruction).toContain("商店小对话框，不进入 AVG");
  expect(frame.documents.find(d => d.id === "tibby")!.text).toBe(tibbyAppraisalReference.text);
  expect(frame.context.requiredActorIds).not.toContain("tibby");
  expect(check().proposal.appraisalItems).toHaveLength(1);
  expect(() => check({...proposal, appraisalItems: []})).toThrow(/Every appraisal slot/);
  const extra = structuredClone(proposal); extra.appraisalItems!.push({...extra.appraisalItems![0], slotKey: "forged"});
  expect(() => check(extra)).toThrow(/Every appraisal slot/);
  for (const bad of [{...proposal.appraisalItems![0], rarity: "gold"}, {...proposal.appraisalItems![0], name: "こんにちは"}, {...proposal.appraisalItems![0], sold: {text: "收下啦。", emotion: "unsupported"}}]) expect(() => parseAppraisalItems([bad])).toThrow();
  const old = clcPacket(), oldFrame = freezeExpeditionFrame(old.context, old.documents, old.departure);
  expect(validateExpeditionPlan(old.context.rules, clcProposal(old), oldFrame.inputHash).proposal).not.toHaveProperty("appraisalItems");
});
