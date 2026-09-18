import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { tutorialEntryFixture } from "./testing/new-game";
import { growthJournalEntries } from "./GrowthEvents";
import { airpJournalEntries } from "./AirpJournalEntries";
import type { AirpPoolView } from "../game-runtime/airp-pool-view";
afterEach(cleanup);

it("keeps locked growth non-spoiling and only dispatches the selected available conversation", async () => {
  const f = await tutorialEntryFixture(), user = userEvent.setup();
  try {
    const before = f.session.getSnapshot().record!;
    const view = f.runtime.queries.progression(before)!;
    const dispatch = vi.spyOn(f.session,"dispatch").mockResolvedValue(null);
    const locked = growthJournalEntries(view,f.session,false,"/equipment");
    expect(locked.every(e => e.group === "locked")).toBe(true);
    render(<>{locked[0].content}</>);
    expect(screen.queryByText(/第6面苏醒/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull(); cleanup();
    // Presentation projection only; no save or eligibility evidence is fabricated.
    const available = {...view, canMove:true, canBegin:true, events:[{...view.events[0],basisId:"settlement-basis"}]};
    const [entry] = growthJournalEntries(available,f.session,false,"/equipment");
    expect(entry).toMatchObject({group:"current",actionable:true});
    expect(dispatch).not.toHaveBeenCalled();
    render(<>{entry.content}</>);
    await user.click(screen.getByRole("button",{name:"谈起 · 把剑暂时放下"}));
    expect(dispatch).toHaveBeenCalledWith({type:"begin-story",eventId:view.events[0].eventId,basisId:"settlement-basis"});
    expect(f.session.getSnapshot().record).toBe(before); cleanup();
    render(<>{growthJournalEntries({...available,canMove:false},f.session,false,"/equipment")[0].content}</>);
    expect(screen.getByRole("button")).toBeDisabled();
  } finally {f.session.dispose();}
});

it("completed growth exposes recap, not another grant", async () => {
  const f = await tutorialEntryFixture(), review = vi.fn(), user = userEvent.setup();
  try {
    const view = f.runtime.queries.progression(f.session.getSnapshot().record!)!;
    const completed = {...view, events:[{...view.events[0],completed:true}]};
    const [entry] = growthJournalEntries(completed,f.session,false,"/equipment",review);
    expect(entry.group).toBe("archive"); render(<>{entry.content}</>);
    await user.click(screen.getByRole("button",{name:"回顾把剑暂时放下"}));
    expect(review).toHaveBeenCalledWith(view.events[0].eventId);
    expect(screen.queryByRole("button",{name:/谈起/})).toBeNull();
  } finally {f.session.dispose();}
});

// These are query projections for rendering, not archives passed to the runtime.
function poolEntry(overrides: Partial<AirpPoolView["entries"][number]> = {}): AirpPoolView["entries"][number] {
  return {card:{id:"card"},instance:{id:"instance",status:"accepted",reason:null},title:"两张整备表",giver:"艾洛拉",
    objective:"把便条带给尤斯缇丝。",target:"eustice",targetName:"尤斯缇丝",visitLocation:"mansion.common-room",
    history:[],canOpen:false,canFollowup:false,...overrides} as AirpPoolView["entries"][number];
}
function pool(entries: AirpPoolView["entries"]): AirpPoolView {return {version:2,entries} as AirpPoolView;}

it("omits reserved notes and preserves the real liaison command and location guard", async () => {
  const f = await tutorialEntryFixture(), user = userEvent.setup();
  try {
    const dispatch = vi.spyOn(f.session,"dispatch").mockResolvedValue(null);
    const live = poolEntry(), reserved = poolEntry({instance:{...live.instance,id:"unseen",status:"closed",reason:"reserved"}});
    const entries = airpJournalEntries(pool([reserved,live]),f.session,false);
    expect(entries.map(e=>e.id)).toEqual(["instance"]); expect(dispatch).not.toHaveBeenCalled();
    render(<>{entries[0].content}</>);
    await user.click(screen.getByRole("button",{name:"找尤斯缇丝传话"}));
    expect(dispatch).toHaveBeenCalledWith({type:"airp-visit",instanceId:"instance",actorId:"eustice",locationId:"mansion.common-room"}); cleanup();
    render(<>{airpJournalEntries(pool([poolEntry({visitLocation:null})]),f.session,false)[0].content}</>);
    expect(screen.getByRole("button",{name:"尤斯缇丝此刻不在约定地点"})).toBeDisabled();
  } finally {f.session.dispose();}
});

it("retains opening, aftermath and online followup actions with their own instance", async () => {
  const f = await tutorialEntryFixture(), user = userEvent.setup();
  try {
    const dispatch = vi.spyOn(f.session,"dispatch").mockResolvedValue(null), base = poolEntry();
    const entries = airpJournalEntries(pool([poolEntry({instance:{...base.instance,status:"closed",reason:"missed"},canOpen:true,canFollowup:true})]),f.session,false);
    render(<>{entries[0].content}</>);
    await user.click(screen.getByRole("button",{name:"看看「两张整备表」的后续"}));
    await user.click(screen.getByRole("button",{name:"再和艾洛拉聊聊药箱"}));
    expect(dispatch.mock.calls.map(([command])=>command)).toEqual([{type:"airp-open",instanceId:"instance"},{type:"airp-online-followup",instanceId:"instance"}]);
  } finally {f.session.dispose();}
});
