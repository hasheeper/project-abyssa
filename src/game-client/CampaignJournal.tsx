import type { ReactNode, RefObject } from "react";
import { RpgModal } from "../shared/ui/primitives/RpgModal";
import { JournalActionLink } from "./JournalPrimitives";
import "../shared/ui/styles/manor-utility.css";
import "./campaign-journal.css";

export type CampaignReportView = "journal" | "preparation";
export interface CampaignReportControls {
  view: CampaignReportView | null;
  onViewChange: (view: CampaignReportView | null) => void;
  onPresentChange?: (view: CampaignReportView, present: boolean) => void;
  returnFocusRefs?: Partial<Record<CampaignReportView, RefObject<HTMLButtonElement | null>>>;
  renderEntries?: (actionable: number) => ReactNode;
}

export function JournalLink({href,label,emphasis}: {href:string;label:string;emphasis?:"normal"|"primary"}) {
  return <JournalActionLink href={href} className="campaign-journal__link" emphasis={emphasis}>{label}</JournalActionLink>;
}

/** Independent windows share the original library chrome, never a tab switcher. */
export function CampaignJournal({open, onClose, title, children, returnFocusRef, browser = false, onPresentChange}: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
  browser?: boolean;
  onPresentChange?: (present: boolean) => void;
}) {
  return <RpgModal open={open} onClose={onClose} onPresentChange={onPresentChange} title={title} signboard={title} signboardVariant="slim" motionPreset="manor"
    className={`campaign-journal manor-utility${browser ? " campaign-journal--reading" : ""}`} panelClassName="campaign-journal__panel manor-utility__window" returnFocusRef={returnFocusRef} header={null}>
    <div className={`campaign-journal__page${browser ? " campaign-journal__page--browser" : ""}`} tabIndex={browser ? undefined : 0}>{children}</div>
  </RpgModal>;
}
