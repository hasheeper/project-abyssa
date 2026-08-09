import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { ShopPage } from "./ShopPage";

describe("ShopPage", () => {
  afterEach(cleanup);

  it("uses the component-library shop controls to complete a purchase", async () => {
    const user = userEvent.setup();

    render(<ShopPage />);

    await user.click(screen.getByRole("option", { name: /防腐蚀抹布/ }));
    await user.click(screen.getByRole("button", { name: "增加数量" }));
    await user.click(screen.getByRole("button", { name: "购 买" }));

    expect(screen.getByText("1,087")).toBeInTheDocument();
    expect(await screen.findByText(/家务加油/)).toBeInTheDocument();
  });

  it("switches into appraisal and charges the matching fee", async () => {
    const user = userEvent.setup();

    render(<ShopPage />);

    await user.click(screen.getByRole("tab", { name: "鉴定" }));
    await user.click(screen.getByRole("button", { name: "鉴 定" }));

    expect(screen.getByText("1,147")).toBeInTheDocument();
    expect(await screen.findByText(/鉴定结果：深海共鸣石/)).toBeInTheDocument();
  });

  it("uses ancient crystals for black-market relics without spending team lira", async () => {
    const user = userEvent.setup();

    render(<ShopPage />);

    await user.click(screen.getByRole("button", { name: "下一页商品" }));
    await user.click(screen.getByRole("option", { name: /古龙安眠灯/ }));

    expect(screen.getByRole("button", { name: "砍 价" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "购 买" }));

    expect(screen.getByLabelText("小队里拉余额 1247")).toBeInTheDocument();
    expect(screen.getByLabelText("远古晶石余额 3")).toBeInTheDocument();
  });

  it("filters the combined shop into broad departments", async () => {
    const user = userEvent.setup();

    render(<ShopPage />);

    await user.click(screen.getByRole("button", { name: /补给/ }));

    expect(screen.getByRole("option", { name: /陈旧的治疗药水/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /深渊玄武岩餐具套装/ })).not.toBeInTheDocument();
  });
});
