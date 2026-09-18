import morningBackground from "../assets/backgrounds/mansion-first-morning.webp";
import nightBackground from "../assets/backgrounds/manor-night-gallery.jpg";
import type { AvgStory } from "../shared/domain/avg/story";

const backgrounds: Record<string, string> = { "mansion.first-morning": morningBackground, "mansion.night": nightBackground };
const presets: Record<string, { className: string; locationLabel: string }> = {
  "mansion-morning": { className: "rp-app first-morning", locationLabel: "MANSION" },
  "mansion-night": { className: "rp-app first-morning", locationLabel: "MANSION" },
};
/** Content uses local registry keys, never arbitrary CSS or asset URLs. */
export function avgPresentation(story: AvgStory) {
  const background = backgrounds[story.presentation.backgroundId], preset = presets[story.presentation.stagePreset];
  if (!background || !preset) throw new Error(`Unregistered AVG stage/background: ${story.id}`);
  return { ...preset, background };
}
