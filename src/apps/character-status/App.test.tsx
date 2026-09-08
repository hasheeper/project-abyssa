import {
  cleanup,
  render,
  screen,
  within,
  fireEvent,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, it, expect } from "vitest";
import { App, CharacterPage } from "./App";
import {
  ReadGameGate,
  ReadSessionScope,
  ReadGameProvider,
} from "../../game-client/read-react";
import { ReadGameSession } from "../../game-client/read-session";
import { archiveFixture } from "../../game-runtime/testing/archive-fixture";
import { presentCharacterArchive } from "../../game-client/character-presentation";
import { DiceLoadoutPanel } from "../../shared/ui/patterns/DiceLoadoutPanel";
import { LEGACY_VALIDATED_CATALOG } from "../../game-runtime/legacy-context";
afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});
async function mount(options: Parameters<typeof archiveFixture>[0] = {}) {
  const f = await archiveFixture(options);
  const session = new ReadGameSession(f.reader, {
    saveId: "demo",
    epoch: "demo-epoch",
  });
  await session.refresh();
  const rendered = render(
    <ReadSessionScope session={session}>
      <ReadGameGate>
        <CharacterPage />
      </ReadGameGate>
    </ReadSessionScope>,
  );
  return { ...f, session, ...rendered };
}
describe("live character archive", () => {
  it("keeps Marietta's memory entrance above the chronicle without a transition provider", async()=>{
    window.history.replaceState(null,"","/?character=marietta&tab=archive");
    await mount();
    const entry=screen.getByRole("region",{name:"玛丽埃塔回忆战"});
    expect(entry).toBeVisible();
    expect(within(entry).getByRole("button")).toBeDisabled();
  });

  it("keeps the original relationship panels when legacy or dossier progress is unrecorded", async () => {
    const f = await archiveFixture();
    const created = await f.runtime.create({
      contentRef: LEGACY_VALIDATED_CATALOG.ref,
      request: {
        protocolVersion: 1,
        saveId: "legacy",
        epoch: "legacy-epoch",
        clientRequestId: "create",
      },
    });
    expect(created.ok).toBe(true);
    const session = new ReadGameSession(f.reader, {
      saveId: "legacy",
      epoch: "legacy-epoch",
    });
    await session.refresh();
    const { container } = render(
      <ReadSessionScope session={session}>
        <ReadGameGate>
          <CharacterPage />
        </ReadGameGate>
      </ReadSessionScope>,
    );
    for (const name of [/尤斯缇丝/, /蕾诺尔/]) {
      await userEvent.click(screen.getByRole("button", { name }));
      expect(screen.getByText("BOND 羁绊")).toBeInTheDocument();
      expect(screen.getByText("未记录", { exact: true })).toBeInTheDocument();
      expect(
        container.querySelectorAll(".abyssa-status-panel__bond-node"),
      ).toHaveLength(5);
      expect(
        container.querySelectorAll(".abyssa-status-panel__pact-stage-inset"),
      ).toHaveLength(3);
      expect(
        container.querySelector(
          '.abyssa-status-panel__pact-glyph[data-pact-icon="skill"]',
        ),
      ).not.toBeNull();
      expect(screen.queryByText(/0\/100|62\/100|Lv\.0/)).toBeNull();
    }
  });
  it("requires a save instead of silently opening the sample", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: "选择档案" })).toBeInTheDocument();
    expect(screen.queryByText("62/100")).toBeNull();
  });
  it("shows Kael and three live tabs without invented progress; locked Marietta remains inspectable", async () => {
    const { container } = await mount({ locked: true });
    const user = userEvent.setup();
    expect(screen.getByText("静谧之楔")).toBeInTheDocument();
    expect(
      container.querySelector(".abyssa-status-panel__bond-main"),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: /尤斯缇丝/ }));
    expect(screen.getByText("BOND 羁绊 · Lv.1")).toBeInTheDocument();
    expect(screen.queryByText(/0\/100|62\/100|2天/)).toBeNull();
    expect(
      container.querySelectorAll(".abyssa-status-panel__pact-stage-inset"),
    ).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: /玛丽埃塔/ }));
    expect(screen.getByText("亲征未开放")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "骰装" }));
    expect(container.querySelectorAll(".abyssa-dice__column")).toHaveLength(6);
    await user.click(
      container.querySelector('.abyssa-dice__column[data-face="6"]')!,
    );
    const inspector = within(
      container.querySelector(".abyssa-dice__inspector") as HTMLElement,
    );
    expect(inspector.getByText("绞杀红线")).toBeInTheDocument();
    expect(inspector.getByText("4")).toBeInTheDocument();
    expect(inspector.getByText("沉眠 · 不参与成牌")).toBeInTheDocument();
  });
  it("distinguishes wild points, permanent rust, equipment and resets inspection on character switch", async () => {
    const { container, session, open } = await mount({ equipment: true });
    const user = userEvent.setup(),
      before = await open();
    await user.click(screen.getByRole("tab", { name: "骰装" }));
    await user.click(
      container.querySelector('.abyssa-dice__column[data-face="6"]')!,
    );
    expect(screen.getByText("万能 · 无原生点数")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /柯萝萝/ }));
    expect(screen.queryByText("万能 · 无原生点数")).toBeNull();
    await user.click(
      container.querySelector('.abyssa-dice__column[data-face="1"]')!,
    );
    expect(screen.getByText(/备用短刃：空面→攻击 1/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /玛丽埃塔/ }));
    await user.click(
      container.querySelector('.abyssa-dice__column[data-face="1"]')!,
    );
    expect(screen.getByText("永久锈 · 不能清理")).toBeInTheDocument();
    await act(() => session.refresh());
    expect(await open()).toEqual(before);
  });
  it("uses the latest face object after a same-character configuration update", async () => {
    const a = await archiveFixture(),
      b = await archiveFixture({ level: 2 });
    const first = presentCharacterArchive(
      a.runtime.queries.archive(await a.open()),
    ).find((x) => x.profile.id === "eustice")!;
    const next = presentCharacterArchive(
      b.runtime.queries.archive(await b.open()),
    ).find((x) => x.profile.id === "eustice")!;
    const { container, rerender } = render(
      <DiceLoadoutPanel loadout={first.dice} />,
    );
    fireEvent.click(
      container.querySelector('.abyssa-dice__column[data-face="6"]')!,
    );
    expect(screen.getByText("沉眠 · 不参与成牌")).toBeInTheDocument();
    rerender(<DiceLoadoutPanel loadout={next.dice} />);
    expect(screen.queryByText("沉眠 · 不参与成牌")).toBeNull();
    expect(screen.getByText("可参与成牌")).toBeInTheDocument();
  });
  it("falls back on a broken portrait and does not leak it to the next character", async () => {
    const { container } = await mount();
    const image = container.querySelector(
      ".abyssa-character-screen__portrait img",
    )!;
    fireEvent.error(image);
    expect(
      screen.getByRole("img", { name: "你暂无立绘" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /诺玛/ }));
    expect(
      container.querySelector(".abyssa-character-screen__portrait img"),
    ).not.toBeNull();
  });
  it("replaces the reader on an epoch switch and never shows the prior record", async () => {
    const f = await archiveFixture();
    window.history.replaceState(null, "", "/?save=demo&epoch=demo-epoch");
    const factory = () => f.reader;
    render(
      <ReadGameProvider factory={factory}>
        <ReadGameGate>
          <CharacterPage />
        </ReadGameGate>
      </ReadGameProvider>,
    );
    await screen.findByText("静谧之楔");
    await act(async () => {
      window.history.replaceState(null, "", "/?save=demo&epoch=other");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(screen.queryByText("静谧之楔")).toBeNull();
    expect(
      await screen.findByRole("link", { name: "选择档案" }),
    ).toBeInTheDocument();
  });
});
