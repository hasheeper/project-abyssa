import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AbyssaProvider } from "../primitives/AbyssaProvider";
import { RpgNotchedPillButton } from "../primitives/RpgNotchedPillButton";
import { useUiMotion } from "./UiMotionProvider";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function systemPreference(initial = false) {
  let matches = initial;
  const events = new EventTarget();
  vi.stubGlobal("matchMedia", () => ({
    get matches() { return matches; },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    addListener: (fn: EventListener) => events.addEventListener("change", fn),
  }));
  return (value: boolean) => act(() => { matches = value; events.dispatchEvent(new Event("change")); });
}
function Probe({ id }: { id: string }) {
  const { reduced, preference } = useUiMotion();
  return <output data-testid={id}>{preference}:{String(reduced)}</output>;
}

it("defaults to the system without a Provider and follows live changes", () => {
  const change = systemPreference();
  render(<><Probe id="value"/><RpgNotchedPillButton label="确认"/></>);
  expect(screen.getByTestId("value")).toHaveTextContent("system:false");
  change(true);
  expect(screen.getByTestId("value")).toHaveTextContent("system:true");
  expect(screen.getByRole("button")).toHaveAttribute("data-ui-motion", "reduced");
  change(false);
  expect(screen.getByRole("button")).toHaveAttribute("data-ui-motion", "full");
});

it("inherits nested themes, allows system preference, and cannot override OS reduction", () => {
  const change = systemPreference();
  render(<AbyssaProvider motionPreference="reduced">
    <AbyssaProvider><Probe id="inherited"/></AbyssaProvider>
    <AbyssaProvider motionPreference="system"><Probe id="system"/></AbyssaProvider>
  </AbyssaProvider>);
  expect(screen.getByTestId("inherited")).toHaveTextContent("reduced:true");
  expect(screen.getByTestId("system")).toHaveTextContent("system:false");
  change(true);
  expect(screen.getByTestId("system")).toHaveTextContent("system:true");
});
