import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CampaignReturnRecord } from "./CampaignReturnRecord";

afterEach(cleanup);
const settlement = {deepestLayer:1,totalGold:36,lostLooseGold:0,lostBankedGold:0};

it("separates the return narrative from the itemized 36 + 8 gold receipt", () => {
  render(<CampaignReturnRecord title="岩窟货物已追回" settlement={settlement} credits={[{id:"quest",label:"委托酬金",gold:8}]}>
    <p>草药、古籍与旧毛毯都已物归原主。</p>
  </CampaignReturnRecord>);
  const receipt = screen.getByRole("complementary",{name:"本次入账"});
  expect(within(receipt).getByTestId("journal-expedition-gold")).toHaveTextContent("36 G");
  expect(within(receipt).getByTestId("journal-credit-quest")).toHaveTextContent("8 G");
  expect(within(receipt).getByTestId("journal-total-gold")).toHaveTextContent("44 G");
  expect(receipt).not.toContainElement(screen.getByText("草药、古籍与旧毛毯都已物归原主。"));
  const heading = screen.getByRole("heading",{name:"岩窟货物已追回"}).closest("header")!;
  expect(heading).toContainElement(screen.getByText("第 1 层"));
  expect(within(heading).getByText("最近归来")).toBeInTheDocument();
  expect(screen.getAllByText("已结算")).toHaveLength(1);
  expect(receipt).toContainElement(screen.getByText("已结算"));
  for (const id of ["journal-expedition-gold","journal-credit-quest","journal-total-gold"]) {
    const amount = screen.getByTestId(id);
    expect(amount).toHaveClass("campaign-journal__amount");
    expect(amount.firstElementChild?.tagName).toBe("SPAN");
    expect(amount.lastElementChild).toHaveTextContent("G");
  }
  expect(screen.queryByText("归馆记述")).toBeNull();
  expect(receipt.lastElementChild).toContainElement(screen.getByTestId("journal-total-gold"));
  expect(screen.queryByText(/途中损失/)).toBeNull();
});

it("shows already-applied losses without subtracting them a second time or inventing a reward", () => {
  render(<CampaignReturnRecord title="从撤离点返回" settlement={{...settlement,totalGold:25,lostLooseGold:4}} credits={[]}>
    <p>余下的配给已收好。</p>
  </CampaignReturnRecord>);
  expect(screen.getByTestId("journal-total-gold")).toHaveTextContent("25 G");
  expect(screen.queryByTestId("journal-credit-quest")).toBeNull();
  expect(screen.getByText(/途中损失/)).toHaveTextContent("散金 4 G / 入袋 0 G");
});

it("keeps the shared value/unit columns for zero and multiple large credits", () => {
  render(<CampaignReturnRecord title="远征顺利完成" settlement={{...settlement,totalGold:0}} credits={[
    {id:"quest",label:"委托酬金",gold:8}, {id:"takeover",label:"接管奖励",gold:1234}
  ]}><p>本次远征已结束。</p></CampaignReturnRecord>);
  expect(screen.getByTestId("journal-expedition-gold")).toHaveTextContent("0 G");
  expect(screen.getByTestId("journal-credit-takeover")).toHaveTextContent("1234 G");
  expect(screen.getByTestId("journal-total-gold")).toHaveTextContent("1242 G");
  expect(screen.getAllByText("G")).toHaveLength(4);
});
