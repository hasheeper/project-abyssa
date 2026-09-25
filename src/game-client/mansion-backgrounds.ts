import morning from "../assets/backgrounds/mansion-first-morning.webp";
import night from "../assets/backgrounds/manor-night-gallery.jpg";
import shop from "../assets/backgrounds/shop-bg3.jpg";

// Vite resolves these to URLs at build time; the browser decodes only the image
// selected for the current scene or room card. Saved location IDs stay separate
// from reusable art IDs, as required by the project's asset naming contract.
const artwork = import.meta.glob<string>("../assets/backgrounds/mansion/*.webp", {
  eager: true,
  query: "?url",
  import: "default"
});
const previews = import.meta.glob<string>("../assets/backgrounds/mansion/previews/*.webp", {
  eager: true,
  query: "?url",
  import: "default"
});

const artIdByLocation: Record<string, string> = {
  hall: "bg.interior.fireplace-lounge.base",
  kitchen: "bg.interior.working-kitchen.base",
  dining: "bg.interior.small-dining-room.base",
  salon: "bg.interior.parlor.base",
  foyer: "bg.interior.piano-foyer.base",
  bath: "bg.interior.clawfoot-bathroom.base",
  lounge: "bg.interior.table-game-room.base",
  abyssa: "bg.interior.red-canopy-bedroom.base",
  terrace: "bg.exterior.stone-terrace.base",
  attic: "bg.interior.observatory-attic.base",
  towerTop: "bg.exterior.tower-lookout.base",
  towerHall: "bg.interior.spiral-watch-hall.base",
  armory: "bg.interior.weapon-room.base",
  workshop: "bg.interior.forge-workshop.base",
  storage: "bg.interior.supply-storeroom.base",
  laundry: "bg.interior.wash-room.base",
  maid: "bg.interior.sewing-workroom.base",
  cellar: "bg.interior.stone-wine-cellar.base",
  library: "bg.interior.blueflame-library.base",
  array: "bg.interior.crimson-crystal-room.base",
  seal: "bg.interior.chained-stone-door.base",
  eustice: "bg.interior.armor-bedroom.base",
  norma: "bg.interior.hammock-bedroom.base",
  elora: "bg.interior.herb-bedroom.base",
  kororo: "bg.interior.pillow-bedroom.base",
  kaelHut: "bg.interior.clifftop-wood-hut.base",
  greenhouse: "bg.interior.glass-herb-house.base",
  plaza: "bg.exterior.village-campfire-square.base",
  tibby: "bg.interior.shop-counter.base",
  dock: "bg.exterior.wooden-sea-dock.base",
  gate: "bg.exterior.stone-gatehouse.base"
};

export function mansionBackgroundForLocation(locationId: string | null | undefined): string | undefined {
  if (!locationId) return undefined;
  if (locationId === "tibby") return shop;
  const artId = artIdByLocation[locationId];
  return artId ? artwork[`../assets/backgrounds/mansion/${artId}.webp`] : undefined;
}

/** Room cards use a separate small image, without decoding the scene master. */
export function mansionPreviewForLocation(locationId: string): string | undefined {
  const artId = artIdByLocation[locationId];
  return artId ? previews[`../assets/backgrounds/mansion/previews/${artId}.webp`] : undefined;
}

/** Unknown legacy locations retain the old common backdrop. Room art is a
 * single base-lighting pass; phase-specific paintings are a separate batch. */
export function mansionSceneBackground(locationId: string | null | undefined, phase: number): string {
  return mansionBackgroundForLocation(locationId) ?? (phase % 4 >= 2 ? night : morning);
}
