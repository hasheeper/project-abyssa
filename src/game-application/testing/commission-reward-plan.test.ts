import {expect, it} from "vitest";
import {clcPacket, clcProposal} from "./airp-expedition-gm-fixture";
import {freezeExpeditionFrame} from "../airp-expedition-gm/context";
import {validateExpeditionPlan} from "../../game-core/session/airp-expedition-plan";

it("requires one executable object per accepted commission and rejects orphaned, duplicated and relocated rewards", () => {
  const packet = clcPacket(true), input = packet.context.rules;
  input.commissionRewardVersion = 1;
  input.commissions[0].itemTemplateId = "test-template";
  input.itemTemplates[0].fields = [
    {key: "label", label: "物品原名", maxLength: 80, values: ["空药箱"]},
    {key: "description", label: "外观", maxLength: 400, values: null},
    {key: "awardWhen", label: "领取条件", maxLength: 40, values: ["room-cleared", "layer-banked"]},
  ];
  const frame = freezeExpeditionFrame(packet.context, packet.documents, packet.departure), p = clcProposal(packet);
  const check = (proposal = p) => validateExpeditionPlan(input, proposal, frame.inputHash);
  expect(check().itemDefinitions).toHaveLength(1);
  expect(frame.instruction).toContain("可执行的奖励配置");
  const omitted = structuredClone(p); omitted.nodes[0].itemKeys = []; omitted.itemDefinitions = [];
  expect(() => check(omitted)).toThrow(/Every commission/);
  const duplicated = structuredClone(p); duplicated.nodes.push({...duplicated.nodes[0], id: "duplicate"});
  expect(() => check(duplicated)).toThrow(/attach once/);
  const moved = structuredClone(p); moved.nodes[0].slotId = "slot:2";
  expect(() => check(moved)).toThrow(/author's objective/);
  const renamed = structuredClone(p); renamed.itemDefinitions[0].fields.label = "大量金币";
  expect(() => check(renamed)).toThrow(/Asset fields/);
  const feedback = structuredClone(p); feedback.nodes[0].link = {eventId: input.commissions[0].eventId, stepId: input.commissions[0].stepId, kind: "commission", role: "feedback"} as typeof feedback.nodes[0]["link"];
  expect(() => check(feedback)).toThrow();
  // Existing frozen inputs have no mandatory new rewards and keep their exact instruction.
  const old = clcPacket(true), oldFrame = freezeExpeditionFrame(old.context, old.documents, old.departure);
  expect(validateExpeditionPlan(old.context.rules, clcProposal(old), oldFrame.inputHash).itemDefinitions).toEqual([]);
});
