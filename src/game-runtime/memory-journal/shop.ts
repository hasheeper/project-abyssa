import { firstVisitLines, SHOP_FIRST_VISIT, shopVisitDecision } from "../../content/presentation/shop-first-visit";
import { shopIntroduction, copperShopIntroduction } from "../../content/presentation/shop-introduction";
import { shopLootPresentation } from "../../content/presentation/shop-loot";
import { shopNarrative, type AvgFrame } from "../../content/presentation/narrative-layout";
import { lootQuantity } from "../../game-core/contracts/loot";
import { SHOP_VISIT_LENGTHS } from "../../game-core/contracts/shop-visit";
import { actorName, type JournalFact, type JournalBuilder } from "./common";
import type { JournalFragment } from "./common";

const frames = new Map(SHOP_FIRST_VISIT.nodes.flatMap(n => n.kind === "beat" ? n.frames : n.kind === "branch" ? Object.values(n.variants).flat() : []).map(f => [f.id, f]));
const background = { kind: "asset" as const, url: shopIntroduction.background };

/** Full first-visit record uses only reading facts and committed trade receipts.
 * An ordinary appraisal fee is not evidence that its local dialogue was read. */
export function shopJournal(facts: readonly JournalFact[], out: JournalBuilder) {
  let choice: "A" | "B" | null = null, activeShop: string | null = null;
  for (const item of facts) {
    if (item.fact.kind !== "progression") continue;
    const event = item.fact.payload;
    if (event.type === "shop-introduction-advanced" && event.choice === "continue") {
      const script = item.catalog.ref.contentVersion >= 17 ? copperShopIntroduction : shopIntroduction, line = script.lines[event.step];
      if (!line) { out.issue("商店初访"); continue; }
      out.add(item, { kind: "authored", occurrence: `shop:${event.shopId}`, episode: true, sceneId: script.id, lineId: line.id, title: script.title, location: script.location,
        narrative: { eventDefinitionId: script.id, actId: "greeting", actTitle: script.title, sliceId: "greeting", surface: "adv" },
        blocks: [{ text: line.text, speaker: actorName(line.characterId, item), stage: { background: { kind: "asset", url: script.background }, actorId: line.characterId } }] });
      continue;
    }
    if (event.type === "shop-visit-operated" && event.command.type === "begin-shop-visit") { activeShop = event.command.shopId; choice = null; continue; }
    const base = (shopId: string, lineId: string): Omit<JournalFragment, "blocks"> => ({ kind: "authored", occurrence: `shop-visit:${shopId}`, episode: true,
      sceneId: "shop-first-visit", lineId, title: "初访杂货铺", location: "守望者杂货铺", iconKeywords: ["行囊", "商店"],
    });
    if (event.type === "shop-visit-operated") {
      const command = event.command;
      if (command.type === "advance-shop-visit") {
        if (["arrival", "valuation", "reply", "purchase", "departure"].includes(command.phase)) {
          if (command.phase === "reply" && !choice) { out.issue("商店初访"); continue; }
          const line = firstVisitLines({ phase: command.phase, choice })[command.step];
          if (!line) { out.issue("商店初访"); continue; }
          const frame: AvgFrame | undefined = frames.get(line.id);
          const narrative = shopNarrative(command.phase, command.step);
          narrative.complete = command.phase === "arrival" && command.step === 30 || command.phase === "valuation" && command.step === 16
            || command.phase === "purchase" && command.step === 0 || command.phase === "departure" && [0, 7].includes(command.step);
          const summary = command.phase === "departure" && command.step >= 4
            ? "缇比鉴别并收购了行囊中的旧物，给出下次出行的补给建议，还托你转告秘银线交货推迟的消息。"
            : ["purchase", "departure"].includes(command.phase)
              ? "缇比鉴别了行囊中的旧物。小队决定结界钉的去留，结清回收款，开始准备下次出行的补给。"
              : command.phase === "valuation" || command.phase === "reply" ? "缇比正在鉴别行囊中的旧物，并商议它们的去留。"
                : "从退潮道带回的行囊被放上杂货铺柜台，缇比开始检查里面的旧物。";
          out.add(item, { ...base(command.shopId, line.id), summary, narrative,
            blocks: [{ text: line.text, speaker: actorName(line.characterId, item), frame,
              stage: { background, actorId: line.characterId, offstageActorId: SHOP_FIRST_VISIT.player.actorId,
                initialSlots: SHOP_FIRST_VISIT.presentation.initialSlots, emotion: "emotion" in line ? line.emotion : undefined,
                actors: "actors" in line ? line.actors?.map(a => ({ characterId: a.characterId, emotion: a.emotion })) : undefined } }] });
          if (command.phase === "departure" && command.step === SHOP_VISIT_LENGTHS.departure - 1) activeShop = null;
        }
        if (command.choice !== "continue" && shopVisitDecision.kind === "choice") {
          choice = command.choice;
          const selected = shopVisitDecision.options.find(o => o.id === choice);
          if (selected) out.add(item, { ...base(command.shopId, shopVisitDecision.id), narrative: shopNarrative("reply"),
            blocks: [{ text: selected.label, kind: "choice", choice: { choiceId: shopVisitDecision.id, optionId: choice }, stage: { background } }] });
        }
      } else if (command.type === "appraise-shop-visit" || command.type === "sell-shop-visit") {
        const trades = item.record.snapshot.campaign.lootTrades?.filter(t => t.id === item.fact.id || t.id.startsWith(`${item.fact.id}:`)) ?? [];
        if (!trades.length) continue;
        out.add(item, { ...base(command.shopId, `trade:${item.fact.id}`), narrative: shopNarrative(command.type === "appraise-shop-visit" ? "appraise" : "sell"), blocks: [],
          receipts: trades.map(trade => ({ operation: trade.kind, moneyDelta: trade.gold === 0 ? 0 : trade.kind === "sell" ? trade.gold : -trade.gold,
            items: [{ instanceId: trade.item.instanceId, name: shopLootPresentation[trade.item.definitionId]?.name ?? trade.item.definitionId,
              quantity: lootQuantity(item.catalog.data.loot!.definitions[trade.item.definitionId], trade.item) }] })) });
      }
    } else if (activeShop && (event.type === "product-purchased" || event.type === "supply-purchased") && event.shopId === activeShop) {
      const product = event.type === "product-purchased" ? item.catalog.data.shop?.products[event.productId] : undefined;
      const definitionId = product?.definitionId ?? (event.type === "supply-purchased" ? event.definitionId : "");
      const price = product?.price ?? item.catalog.data.economy?.prices[definitionId];
      if (price === undefined) { out.issue("商店交易"); continue; }
      out.add(item, { ...base(activeShop, `purchase:${item.fact.id}`), narrative: shopNarrative("buy"), blocks: [], receipts: [{ operation: "purchase",
        outcome: `${product?.name ?? definitionId} ×${event.quantity}`, moneyDelta: -price * event.quantity }] });
    }
  }
}
