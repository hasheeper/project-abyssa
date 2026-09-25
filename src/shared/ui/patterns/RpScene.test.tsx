import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RpScene } from "./RpScene";
import type { RpActor, RpMessage } from "./RpScene";

const actors: RpActor[] = [
  { id: "abyssa", name: "Abyssa", fullName: "Abyssa", accent: "#f0c" },
  { id: "alvitr", name: "Alvitr", fullName: "Alvitr" },
  { id: "elora", name: "Elora", fullName: "Elora" }
];

const say = (id: string, actorId: string, text = id): RpMessage => ({
  id,
  kind: "say",
  actorId,
  text
});

const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
let finishAnimations: Array<() => void> = [];
let animateMock: ReturnType<typeof vi.fn>;
let scrollToMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  finishAnimations = [];
  animateMock = vi.fn(() => {
    let finish = () => {};
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    finishAnimations.push(finish);
    return { finished } as unknown as Animation;
  });
  scrollToMock = vi.fn();

  Object.defineProperty(Element.prototype, "animate", {
    configurable: true,
    value: animateMock
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: scrollToMock
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalAnimate) Object.defineProperty(Element.prototype, "animate", originalAnimate);
  else Reflect.deleteProperty(Element.prototype, "animate");
  if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
});

describe("RpScene", () => {
  it("does not highlight a silent actor merely because a still pose is present", () => {
    const messages = [say("speaking", "abyssa")];
    const draw = (withCue: boolean) => <RpScene actors={actors} messages={messages} initialSlots={{left:"abyssa",right:"elora"}}
      performances={withCue ? {elora:{key:"hold",still:true}} : undefined} hydrate/>;
    const view = render(draw(true));
    const silent = view.container.querySelector('.abyssa-rp__actor[data-character="elora"]');
    expect(silent).toHaveAttribute("data-active", "false");
    view.rerender(draw(false));
    expect(silent).toHaveAttribute("data-active", "false");
    expect(view.container.querySelector('.abyssa-rp__actor[data-character="abyssa"]')).toHaveAttribute("data-active", "true");
  });

  it("keeps committed choices as non-interactive ledger entries across RP and LOG", () => {
    const messages: RpMessage[] = [say("a-1", "abyssa"), {id:"decision",kind:"choice",text:"故意找茬",sequence:2}];
    const view = render(<RpScene actors={actors} messages={messages} hydrate/>);
    const record = screen.getByRole("note", {name:"选择记录：故意找茬"});
    expect(record).toHaveTextContent("已选择02故意找茬");
    expect(record.querySelector("button")).toBeNull();
    expect(record.querySelector(".abyssa-rp__type-char")).toBeNull();
    expect(view.container.querySelector('[data-kind="choice"]')).toHaveAttribute("data-settled", "true");
    expect(view.container.querySelector('[data-kind="say"]')).toHaveStyle({"--abyssa-rp-accent":"#f0c"});
    view.rerender(<RpScene actors={actors} messages={messages} hydrate mode="log"/>);
    expect(screen.getByRole("note", {name:"选择记录：故意找茬"})).toBe(record);
  });

  it("places actions after a stable reading viewport and anchors jump-to-latest inside that viewport", () => {
    const messages = [say("a-1", "abyssa")];
    const view = render(<RpScene actors={actors} messages={messages} hydrate actions={<button>选择行动</button>}/>);
    const viewport = view.container.querySelector<HTMLElement>(".abyssa-rp__reading")!;
    const log = view.container.querySelector<HTMLElement>(".abyssa-rp__log")!;
    const row = view.container.querySelector(".abyssa-rp__row");
    expect(viewport).toContainElement(log);
    expect(viewport).toContainElement(screen.getByRole("button", {name: /回到最新/}));
    expect(viewport.nextElementSibling).toContainElement(screen.getByRole("button", {name: "选择行动"}));
    view.rerender(<RpScene actors={actors} messages={messages} hydrate mode="log"/>);
    expect(view.container.querySelector(".abyssa-rp__log")).toBe(log);
    expect(view.container.querySelector(".abyssa-rp__row")).toBe(row);
    expect(view.container.querySelector(".abyssa-rp__actions")).toBeEmptyDOMElement();
  });

  it("keeps play/log focus semantics and marks hydrated messages as settled", () => {
    const messages: RpMessage[] = [
      say("a-1", "abyssa", "First"),
      { id: "n-1", kind: "narration", text: "Near" },
      say("b-1", "alvitr", "Latest")
    ];
    const { container, rerender } = render(
      <RpScene actors={actors} messages={messages} hydrate header={<span>Chapter I</span>} />
    );

    expect(screen.getByText("Chapter I")).toBeInTheDocument();
    expect(container.querySelectorAll('.abyssa-rp__message[data-settled="true"]')).toHaveLength(3);
    expect(container.querySelector('.abyssa-rp__message[data-current="true"]')).toHaveTextContent("Latest");
    expect(container.querySelector('.abyssa-rp__actor[data-character="alvitr"]')).toHaveAttribute(
      "data-active",
      "true"
    );

    rerender(<RpScene actors={actors} messages={messages} hydrate mode="log" />);

    expect(container.querySelector(".abyssa-rp")).toHaveAttribute("data-mode", "log");
    expect(container.querySelector(".abyssa-rp__message[data-current]")).not.toBeInTheDocument();
    expect(container.querySelector(".abyssa-rp__message[data-recent]")).not.toBeInTheDocument();
    expect(container.querySelector('.abyssa-rp__actor[data-character="alvitr"]')).toHaveAttribute(
      "data-active",
      "true"
    );
  });

  it("keeps a replaced actor mounted until its leave animation finishes", async () => {
    const initial = [say("a-1", "abyssa"), say("b-1", "alvitr")];
    const { container, rerender } = render(<RpScene actors={actors} messages={initial} />);

    rerender(<RpScene actors={actors} messages={[...initial, say("c-1", "elora")]} />);

    const leftSeat = container.querySelector('.abyssa-rp__seat[data-seat="left"]');
    expect(leftSeat?.querySelector('[data-character="abyssa"][data-phase="leave"]')).toBeInTheDocument();
    expect(leftSeat?.querySelector('[data-character="elora"][data-phase="enter"]')).toBeInTheDocument();
    expect(animateMock).toHaveBeenCalled();

    await act(async () => {
      for (const finish of finishAnimations) finish();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(leftSeat?.querySelector('[data-character="abyssa"]')).not.toBeInTheDocument();
    });
  });

  it("pauses automatic scrolling while the reader is away from the latest message", () => {
    const initial = [say("a-1", "abyssa")];
    const { container, rerender } = render(<RpScene actors={actors} messages={initial} />);
    const log = container.querySelector<HTMLElement>(".abyssa-rp__log")!;

    Object.defineProperties(log, {
      scrollHeight: { configurable: true, value: 1000 },
      scrollTop: { configurable: true, value: 100, writable: true },
      clientHeight: { configurable: true, value: 200 }
    });
    fireEvent.scroll(log);
    expect(screen.getByRole("button", { name: /回到最新/ })).toHaveAttribute("data-show", "true");

    scrollToMock.mockClear();
    rerender(<RpScene actors={actors} messages={[...initial, say("a-2", "abyssa")]} />);
    expect(scrollToMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /回到最新/ }));
    expect(scrollToMock).toHaveBeenCalledWith({ top: 1000, behavior: "smooth" });
  });
});
