import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/* Three.js 与黑幕导航都被替身接管：这组测试盯的是配队面板的行为，
   不是 WebGL 渲染（那由 createMapScene.test.ts 负责）。 */
const mocks = vi.hoisted(() => ({
  setSelected: vi.fn(),
  setInteractive: vi.fn(),
  destroy: vi.fn(),
  navigate: vi.fn(),
  select: null as null | ((location: { id: string }) => void)
}));

vi.mock("./createMapScene", () => ({
  createMapScene: (
    _container: HTMLElement,
    options: { onReady?: () => void; onLocationSelect?: (location: { id: string }) => void }
  ) => {
    mocks.select = options.onLocationSelect ?? null;
    options.onReady?.();
    return {
      replay: vi.fn(),
      updateLocation: vi.fn(),
      setSelected: mocks.setSelected,
      setInteractive: mocks.setInteractive,
      destroy: mocks.destroy
    };
  }
}));

vi.mock("../../shared/transition", () => ({
  SceneTransitionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useSceneTransition: () => ({ navigate: mocks.navigate })
}));

import { MapPage } from "./MapPage";
import { SORTIE_ORDER_STORAGE_KEY } from "./sortie/sortie-model";

beforeEach(() => {
  mocks.setSelected.mockClear();
  mocks.setInteractive.mockClear();
  mocks.navigate.mockClear();
  sessionStorage.clear();
});

/* 先卸载再清 select：mocks.select 指向上一个实例的回调，
   若留到下一个用例，触发的是已卸载组件的 setState（React 会静默吞掉），
   表现为 setSelected 没被调用的偶发失败。 */
afterEach(() => {
  cleanup();
  mocks.select = null;
});

function viewport(container: HTMLElement) {
  return container.querySelector(".abyssa-map-viewport") as HTMLElement;
}

function partyStage(container: HTMLElement) {
  return container.querySelector(".abyssa-sortie-stage") as HTMLElement;
}

/** 打开配队抽屉。地图态整支队伍是一个大按钮。 */
async function openTeam(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "查看出战队伍并编队" }));
}

describe("map sortie", () => {
  it("starts on the bare map with no drawer and no quest panel", () => {
    const { container } = render(<MapPage />);

    expect(viewport(container).dataset.mode).toBe("map");
    expect(screen.queryByRole("region", { name: "出战名单" })).toBeNull();
    expect(mocks.setInteractive).toHaveBeenLastCalledWith(true);
  });

  it("opens the roster drawer and can reopen it after all four slots are filled", async () => {
    const user = userEvent.setup();
    const { container } = render(<MapPage />);

    await openTeam(user);

    expect(viewport(container).dataset.mode).toBe("team");
    expect(screen.getByRole("region", { name: "出战名单" })).toBeInTheDocument();
    /* 浮层展开时地图不再响应点击，否则点面板会穿透到地图上换节点。 */
    expect(mocks.setInteractive).toHaveBeenLastCalledWith(false);

    for (const name of ["尤斯缇丝·格里芬", "艾比希斯·贝尔泽兰", "艾洛拉·亚金特", "柯萝萝·拉普拉斯"]) {
      await user.click(screen.getByRole("button", { name }));
    }
    await user.click(screen.getByRole("button", { name: "完成编队" }));
    expect(viewport(container).dataset.mode).toBe("map");

    /* 真实命中由 CSS 的 map-mode pointer-events 契约保护；
       这里再保护满编后的状态链能重新进入配队。 */
    await openTeam(user);
    expect(viewport(container).dataset.mode).toBe("team");
  });

  /* 九人都可编入以预览 Q 版立绘；资料不完整时只禁用最后出发。 */
  it("lets injured and dieless members switch into the preview party", async () => {
    const user = userEvent.setup();
    render(<MapPage />);
    await openTeam(user);

    const injured = screen.getByRole("button", { name: "蕾诺尔·伏尼契" });
    const dieless = screen.getByRole("button", { name: "艾洛拉·亚金特" });
    expect(injured).toBeEnabled();
    expect(dieless).toBeEnabled();

    await user.click(injured);
    await user.click(dieless);
    expect(screen.getByText("已选 2 / 4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "完成编队" }));
    mocks.select?.({ id: "cave" });
    const quest = await screen.findByRole("complementary", { name: "潮声溶洞 委托" });
    expect(within(quest).getByRole("button", { name: "出发" })).toBeDisabled();
    expect(within(quest).getByText(/现在出不了门/)).toBeInTheDocument();
  });

  /* 出征的人排最前：那是这一屏的答案（「我这趟带了谁」），
     不该混在候选中间等玩家横着扫一遍去找。 */
  it("moves enlisted members to the head of the roster", async () => {
    const user = userEvent.setup();
    const { container } = render(<MapPage />);
    await openTeam(user);

    const names = () =>
      [...container.querySelectorAll(".abyssa-sortie-poster__nm")].map(
        (node) => node.textContent
      );

    /* 艾比希斯初始排在尤斯缇丝之后。 */
    expect(names().indexOf("艾比希斯")).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "艾比希斯·贝尔泽兰" }));
    expect(names()[0]).toBe("艾比希斯");
  });

  it("enlists an available member and numbers the slot", async () => {
    const user = userEvent.setup();
    render(<MapPage />);
    await openTeam(user);

    await user.click(screen.getByRole("button", { name: "尤斯缇丝·格里芬" }));

    expect(screen.getByText("已选 1 / 4")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "尤斯缇丝·格里芬" })).toHaveAttribute("aria-pressed", "true");
  });

  it("highlights the picked landmark in the scene instead of in the DOM", async () => {
    render(<MapPage />);

    /* 地标是 WebGL 纸片，HTML 遮罩盖不住 canvas 内部 ——
       所以选中态必须下发到 Three 侧，不能只靠 CSS。 */
    mocks.select?.({ id: "tower" });
    expect(await screen.findByRole("complementary", { name: "废弃哨塔 委托" })).toBeInTheDocument();
    expect(mocks.setSelected).toHaveBeenLastCalledWith("tower", "right");
  });

  it("keeps the same party figures mounted opposite quest panels on either side", async () => {
    const user = userEvent.setup();
    const { container } = render(<MapPage />);
    const stage = partyStage(container);
    const leader = stage.querySelector(
      '.abyssa-sortie-figure[data-leader="true"]'
    ) as HTMLButtonElement;
    const leaderImage = leader.querySelector("img") as HTMLImageElement;

    expect(stage).toHaveAttribute("data-mode", "map");
    expect(stage).not.toHaveAttribute("data-quest-side");

    act(() => mocks.select?.({ id: "cave" }));
    const cave = await screen.findByRole("complementary", { name: "潮声溶洞 委托" });
    const caveStage = partyStage(container);
    expect(cave).toHaveAttribute("data-side", "left");
    expect(caveStage).toBe(stage);
    expect(caveStage).toHaveAttribute("data-mode", "pop");
    expect(caveStage).toHaveAttribute("data-quest-side", "left");
    expect(caveStage.querySelector('.abyssa-sortie-figure[data-leader="true"]')).toBe(leader);
    expect(leader.querySelector("img")).toBe(leaderImage);

    await user.click(within(cave).getByRole("button", { name: "关闭委托" }));
    expect(viewport(container)).toHaveAttribute("data-mode", "map");
    expect(partyStage(container)).toBe(stage);

    act(() => mocks.select?.({ id: "tower" }));
    const tower = await screen.findByRole("complementary", { name: "废弃哨塔 委托" });
    const towerStage = partyStage(container);
    expect(tower).toHaveAttribute("data-side", "right");
    expect(towerStage).toBe(stage);
    expect(towerStage).toHaveAttribute("data-mode", "pop");
    expect(towerStage).toHaveAttribute("data-quest-side", "right");
    expect(towerStage.querySelector('.abyssa-sortie-figure[data-leader="true"]')).toBe(leader);
    expect(leader.querySelector("img")).toBe(leaderImage);
  });

  it("opens team setup from a quest party figure and returns to that quest when done", async () => {
    const user = userEvent.setup();
    const { container } = render(<MapPage />);

    act(() => mocks.select?.({ id: "cave" }));
    const quest = await screen.findByRole("complementary", { name: "潮声溶洞 委托" });
    const stage = partyStage(container);

    await user.click(
      within(stage).getByRole("button", { name: "凯尔，点击调整队伍" })
    );
    expect(viewport(container)).toHaveAttribute("data-mode", "team");
    expect(screen.getByRole("region", { name: "出战名单" })).toBeInTheDocument();
    expect(quest).not.toBeInTheDocument();
    expect(partyStage(container)).toBe(stage);

    await user.click(screen.getByRole("button", { name: "完成编队" }));
    const reopened = await screen.findByRole("complementary", { name: "潮声溶洞 委托" });
    expect(reopened).toHaveAttribute("data-side", "left");
    expect(viewport(container)).toHaveAttribute("data-mode", "pop");
    expect(partyStage(container)).toBe(stage);
    expect(stage).toHaveAttribute("data-quest-side", "left");
  });

  it("blocks departure until someone is aboard, then writes the order and leaves", async () => {
    const user = userEvent.setup();
    render(<MapPage />);

    mocks.select?.({ id: "cave" });
    const quest = await screen.findByRole("complementary", { name: "潮声溶洞 委托" });
    const depart = within(quest).getByRole("button", { name: "出发" });
    expect(depart).toBeDisabled();
    expect(within(quest).getByText("至少要带一个人。")).toBeInTheDocument();

    const editParty = within(quest).getByRole("button", { name: "调整队伍" });
    expect(editParty).toHaveClass("abyssa-sortie-quest__edit-party");
    expect(editParty.querySelector("svg")).not.toBeNull();
    expect(editParty).toHaveTextContent("");
    await user.click(editParty);
    await user.click(screen.getByRole("button", { name: "尤斯缇丝·格里芬" }));
    /* 从委托进的配队，编完要回到那份委托，而不是掉回裸地图。 */
    await user.click(screen.getByRole("button", { name: "完成编队" }));

    const reopened = await screen.findByRole("complementary", { name: "潮声溶洞 委托" });
    await user.click(within(reopened).getByRole("button", { name: "出发" }));

    const order = JSON.parse(sessionStorage.getItem(SORTIE_ORDER_STORAGE_KEY)!);
    expect(order).toMatchObject({
      version: 1,
      nodeId: "cave",
      memberIds: ["eustice"],
      command: "personal",
      diceCount: 2
    });
    expect(mocks.navigate).toHaveBeenCalledWith(
      "./battle.html",
      expect.objectContaining({ destination: "潮声溶洞" })
    );
  });

  it("toggles the fifth die by putting the leader on or off the roster", async () => {
    const user = userEvent.setup();
    render(<MapPage />);
    await openTeam(user);

    const leader = screen.getByRole("button", { name: /凯尔亲征/ });
    expect(leader).toHaveAttribute("aria-pressed", "true");

    await user.click(leader);
    expect(screen.getByRole("button", { name: /凯尔留守/ })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  /* 骨架稿用 ⚔🛡⚕💰○ 当图标。图标必须是 mask 过的 SVG，
     否则字体缺字时会退化成豆腐块，也无法被令牌色着色。 */
  it("draws tallies with masked svg icons, never with text glyphs", async () => {
    const user = userEvent.setup();
    const { container } = render(<MapPage />);
    await openTeam(user);

    const icons = container.querySelectorAll(".abyssa-sortie__tally-icon");
    expect(icons.length).toBeGreaterThan(0);
    icons.forEach((icon) => {
      expect((icon as HTMLElement).style.maskImage || (icon as HTMLElement).style.webkitMaskImage).toContain("url(");
    });

    const drawer = screen.getByRole("region", { name: "出战名单" });
    expect(drawer.textContent ?? "").not.toMatch(/[⚔🛡⚕💰○☀▣▲☾✕]/u);
  });

  /* 浮层外框必须来自 RpgFrame，不许自己画一圈 border ——
     抽屉与侧板是浮在地图上的实体面板，边框语汇要与商店 / 档案同源。 */
  it("frames both overlays with RpgFrame rather than a bare border", async () => {
    const user = userEvent.setup();
    render(<MapPage />);

    await openTeam(user);
    const drawer = screen.getByRole("region", { name: "出战名单" });
    expect(drawer).toHaveClass("abyssa-frame");
    expect(drawer.querySelector(":scope > .abyssa-frame__content")).not.toBeNull();
    expect(drawer.querySelector(":scope > .abyssa-frame__ornaments")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "关闭当前面板" }));
    mocks.select?.({ id: "cave" });
    const quest = await screen.findByRole("complementary", { name: "潮声溶洞 委托" });
    expect(quest).toHaveClass("abyssa-frame");
    expect(quest.querySelector(":scope > .abyssa-frame__content")).not.toBeNull();
  });

  /* 点进副本至少要有简报。三块全是空虚线框等于没做。
     但简报里不许出现难度星级 / 推荐等级 / 胜率 / 金币数额 ——
     「编队即难度」，用数字替玩家把牌读完就废了这条设计护栏。 */
  it("briefs the quest without handing out difficulty or payout numbers", async () => {
    render(<MapPage />);
    mocks.select?.({ id: "cave" });
    const quest = await screen.findByRole("complementary", { name: "潮声溶洞 委托" });

    expect(within(quest).getByRole("heading", { name: "威胁" })).toBeInTheDocument();
    expect(within(quest).getByRole("heading", { name: "收益" })).toBeInTheDocument();
    /* 威胁写的是敌人做什么，不是属性克制。 */
    expect(within(quest).getAllByRole("listitem").length).toBeGreaterThan(3);

    const text = quest.textContent ?? "";
    expect(text).not.toMatch(/难度|推荐等级|胜率|星级/);
    /* 出发前不存在确定数额：结算是「金币 x 累计倍率」。 */
    expect(text).not.toMatch(/\d+\s*(金币|里拉|晶石)/);
    expect(text).not.toMatch(/[★☆]/);
  });

  /* 金币与晶石必须用全仓库统一的货币形制（.abyssa-currency-amount），
     不能另找一个 game-icons 图标 —— 同一种货币在商店、枢纽顶栏与这里
     长相不一致，玩家会当成两种东西。素材没有货币形制，走 mask 图标。 */
  it("draws currency yields with the shared currency glyph", async () => {
    render(<MapPage />);
    mocks.select?.({ id: "cave" });
    const quest = await screen.findByRole("complementary", { name: "潮声溶洞 委托" });

    const coin = quest.querySelector('[data-spoil="coin"] .abyssa-currency-amount');
    const crystal = quest.querySelector('[data-spoil="crystal"] .abyssa-currency-amount');
    expect(coin).toHaveAttribute("data-currency", "lira");
    expect(crystal).toHaveAttribute("data-currency", "crystal");
    /* 样式挂在 `.abyssa-currency-amount i` 上，这层包裹不能省。 */
    expect(coin!.querySelector("i")).not.toBeNull();

    const material = quest.querySelector('[data-spoil="material"] .abyssa-sortie-quest__spoil');
    expect((material as HTMLElement).style.maskImage).toContain("url(");
  });

  /* 只给读屏器的文本必须真的收起来。绝对定位要有定位祖先，
     否则会脱到外层去，在别处占位并显示出来 —— 委托侧板曾渲染出
     「收益薄」这样的重复文字。 */
  it("does not leak screen-reader text into the visible copy", async () => {
    const user = userEvent.setup();
    render(<MapPage />);
    mocks.select?.({ id: "cave" });
    const quest = await screen.findByRole("complementary", { name: "潮声溶洞 委托" });
    expect(quest.textContent ?? "").not.toMatch(/收益[薄中厚]/);

    await user.click(within(quest).getByRole("button", { name: "调整队伍" }));
    const drawer = screen.getByRole("region", { name: "出战名单" });
    /* 构成表的 sr 文本同理，不能重复出现在可见文案里。 */
    expect(drawer.textContent ?? "").not.toMatch(/(攻击|格挡|治疗).*\1/);
  });

  /* 当前队伍摘要与点位副本名册统一使用共享头像框和同一张 avatar。
     塞 704x1472 的全身立绘要放大两倍再裁掉 99.5% 的像素，
     既费解码又不如裁好的脸清楚。凯尔缺 avatar，是唯一例外。 */
  it("uses the same framed avatar art in the party summary and quest slots", async () => {
    const user = userEvent.setup();
    const { container } = render(<MapPage />);
    await openTeam(user);
    await user.click(screen.getByRole("button", { name: "尤斯缇丝·格里芬" }));

    /* userEvent 会先 hover 海报；移出后才回到截图中的“当前队伍”摘要。 */
    fireEvent.mouseLeave(container.querySelector(".abyssa-sortie-roster__row")!);
    const drawer = screen.getByRole("region", { name: "出战名单" });
    const done = within(drawer).getByRole("button", { name: "完成编队" });
    expect(done).toHaveClass("abyssa-sortie-roster__done");
    expect(done.querySelector("svg")).not.toBeNull();
    expect(done).toHaveTextContent("");

    const summarySlots = drawer.querySelectorAll(".abyssa-sortie-info__minis > .abyssa-sortie-slot");
    expect(summarySlots).toHaveLength(5);
    expect(drawer.querySelectorAll('.abyssa-sortie-info__minis > [data-empty="true"]')).toHaveLength(3);
    const summaryLeader = drawer.querySelector(
      '.abyssa-sortie-info__minis > [data-leader="true"] .abyssa-sortie-slot__art'
    );
    expect(summaryLeader).toHaveClass("abyssa-avatar");
    expect(summaryLeader!.querySelector("img")).not.toBeNull();
    const summaryAvatar = drawer.querySelector(
      ".abyssa-sortie-info__minis [data-faction] .abyssa-sortie-slot__art"
    );
    expect(summaryAvatar).toHaveClass("abyssa-avatar");
    expect(summaryAvatar!.querySelector(".abyssa-avatar__art")).not.toBeNull();
    const summarySrc = summaryAvatar!.querySelector("img")!.getAttribute("src");
    expect(summarySrc).toMatch(/avatar/);
    expect(drawer.querySelector(".abyssa-sortie-info__mini")).toBeNull();

    await user.click(done);

    mocks.select?.({ id: "cave" });
    const quest = await screen.findByRole("complementary", { name: "潮声溶洞 委托" });

    /* 头像框是共享件（切角六边形），不是自己画的圆或圆角矩形。 */
    const filled = quest.querySelector('[data-faction] .abyssa-sortie-slot__art');
    expect(filled).toHaveClass("abyssa-avatar");
    expect(filled!.querySelector(".abyssa-avatar__art")).not.toBeNull();
    /* 素材走 avatar（1:1 裁好的脸），不是 png 下的全身立绘。 */
    expect(filled!.querySelector("img")!.getAttribute("src")).toBe(summarySrc);

    /* 四个槽位恒定画出，空位也要占地。 */
    expect(quest.querySelectorAll(".abyssa-sortie-slot").length).toBe(5);
    expect(quest.querySelectorAll('[data-empty="true"]').length).toBe(3);
  });

  it("closes the drawer from the backdrop", async () => {
    const user = userEvent.setup();
    const { container } = render(<MapPage />);
    await openTeam(user);

    await user.click(screen.getByRole("button", { name: "关闭当前面板" }));
    expect(viewport(container).dataset.mode).toBe("map");
    expect(mocks.setInteractive).toHaveBeenLastCalledWith(true);
  });
});
