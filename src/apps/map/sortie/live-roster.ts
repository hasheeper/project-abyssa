import type { CharacterArchiveView } from "../../../game-runtime/character-views";
import { presentDice } from "../../../game-client/character-presentation";
import { archiveIdentities } from "../../../content/characters/identities";
import { partyFigureCatalogById } from "../../../assets/map/party-figures/catalog";
import type { PartyFigureId } from "../../../content/characters/partyFigureCalibration";
import type { SortieMember, SortieLeader } from "./sortie-model";
import { isPlayerActor, playerDisplayName } from "../../../shared/domain/player-identity";

/** Real archive dice drive the roster. Legacy faces keep `live.suitKnown: false`
 *  so the panel can render the shared die frames without advertising suits
 *  the v1 rules never implemented. */
export function liveParty(view: CharacterArchiveView): {
  roster: SortieMember[];
  leader: SortieLeader;
} {
  const members = view.characters.map((ch) => {
    const art = archiveIdentities.find((p) => p.id === ch.id),
      dice = presentDice(ch, view.leaderId);
    return {
      id: ch.id,
      name: isPlayerActor(ch.id) ? playerDisplayName() : art?.name ?? ch.name,
      shortName: isPlayerActor(ch.id) ? playerDisplayName() : art?.selectorLabel ?? ch.name,
      secondaryName: isPlayerActor(ch.id) ? "USER" : art?.secondaryName,
      title: art?.status.title ?? "远征伙伴",
      faction: art?.status.affiliation?.tone ?? "hero-party",
      factionLabel: art?.status.affiliation?.label ?? "勇者小队",
      thumbnailUrl: art?.thumbnailUrl,
      portraitUrl: art?.portraitUrl,
      figureUrl: partyFigureCatalogById[ch.id as PartyFigureId]?.url,
      faces: dice.faces,
      primarySuit: dice.primarySuit,
      secondarySuit: dice.secondarySuit,
      ready: ch.available,
      boardingLine: "",
      placeholderNote: ch.available ? undefined : "当前档案尚不可用",
    } satisfies SortieMember;
  });
  const leader = members.find((m) => m.id === view.leaderId)!;
  return {
    roster: members.filter((m) => m.id !== view.leaderId),
    leader: {
      ...leader,
      id: "kael",
      secondaryName: leader.secondaryName ?? "USER",
      stayLine: "",
    },
  };
}
