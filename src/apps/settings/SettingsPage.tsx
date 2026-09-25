import { useState } from "react";
import { SettingsScene } from "../../game-client/settings/SettingsScene";
import { Stage } from "../../shared/stage";
import { settingsReturnHref } from "../../game-client/settings-navigation";
import { GameUiPreferences } from "../../shared/preferences/GameUiPreferences";
import { navigateTo } from "../../shared/routing/location";

const back = () => navigateTo(settingsReturnHref(), { destination: "返回", channel: "正在返回" });

/** Compatibility/deep-link entry. Title and Menu now open settings in place. */
export function SettingsPage() {
  const [open, setOpen] = useState(true), [texture, setTexture] = useState(true);
  return <GameUiPreferences><Stage background={texture ? "var(--abyssa-system-backdrop)" : "var(--abyssa-system-backdrop-plain)"}>
    <SettingsScene open={open} onClose={() => setOpen(false)} onExited={back} onBackdropTextureChange={setTexture} />
  </Stage></GameUiPreferences>;
}
