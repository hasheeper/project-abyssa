import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CampaignMenuScope, useCampaignMenuCommands, useCampaignMenuScene } from "./CampaignMenuScope";

afterEach(cleanup);
it("menu registration does not render its publisher again; labels, locks and callbacks remain current", () => {
  const rendered = vi.fn(), selected = vi.fn();
  function Battle({busy, value}: {busy:boolean; value:number}) {
    rendered();
    useCampaignMenuCommands([{id:"act",label:"行动",disabled:busy,onSelect:()=>selected(value)}],busy);
    return null;
  }
  function Menu() {
    const {commands,busy} = useCampaignMenuScene();
    return <section aria-label="commands" aria-busy={busy}>{commands.map(c=><button key={c.id} disabled={c.disabled} onClick={c.onSelect}>{c.label}</button>)}</section>;
  }
  const subject = (busy:boolean,value:number,show=true) => <CampaignMenuScope>{show && <Battle busy={busy} value={value}/>}<Menu/></CampaignMenuScope>;
  const mounted = render(subject(true,1));
  expect(rendered).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button",{name:"行动"})).toBeDisabled();
  mounted.rerender(subject(false,2));
  expect(rendered).toHaveBeenCalledTimes(2);
  expect(screen.getByRole("region",{name:"commands"})).toHaveAttribute("aria-busy","false");
  fireEvent.click(screen.getByRole("button",{name:"行动"}));
  expect(selected).toHaveBeenLastCalledWith(2);
  // Same visible signature, but the registered callback must still be fresh.
  mounted.rerender(subject(false,3));
  expect(rendered).toHaveBeenCalledTimes(3);
  fireEvent.click(screen.getByRole("button",{name:"行动"}));
  expect(selected).toHaveBeenLastCalledWith(3);
  mounted.rerender(subject(false,3,false));
  expect(screen.queryByRole("button",{name:"行动"})).toBeNull();
});
