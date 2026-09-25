import { JournalRecordHeading } from "./JournalBrowser";
import { JournalActionLink, JournalLedger, JournalLedgerRow } from "./JournalPrimitives";
import type { JournalAppraisalItem } from "./journal-appraisal";

export function JournalAppraisal({items, href}: {items: readonly JournalAppraisalItem[]; href: string}) {
  const total = items.reduce((count, item) => count + item.quantity, 0);
  return <>
    <JournalRecordHeading title="待鉴定的收获" meta="带回物品"/>
    <p className="journal-record__lead">请缇比看看，再决定出售或留下。</p>
    <div className="journal-record__actions">
      <JournalActionLink href={href} emphasis="primary">前往鉴定</JournalActionLink>
      <span className="journal-record__action-note">缇比的杂货铺</span>
    </div>
    <JournalLedger label="尚未鉴定" summary={`${total.toLocaleString("en-US")} 件`}>
      {items.map(item => <JournalLedgerRow key={item.id} icon={item.icon} name={item.name} quantity={item.quantity} note={item.appearance}/>)}
    </JournalLedger>
  </>;
}
