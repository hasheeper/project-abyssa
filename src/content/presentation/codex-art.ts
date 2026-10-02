import generated from "../../assets/codex/ai-observations/sources.json";

const drawings = import.meta.glob<string>("../../assets/codex/ai-observations/*.webp",
  { eager: true, query: "?url&no-inline", import: "default" });

export const codexArt = new Map(generated.assets.map(asset => {
  const [width, height] = asset.outputs[0].size;
  const [image, thumbnail] = asset.outputs.map(output => {
    const url = drawings["../../assets/codex/ai-observations/" + output.file];
    return `${url}${url.includes("?") ? "&" : "?"}rev=${output.sha256.slice(0, 12)}`;
  });
  const id = asset.assetId;
  const displayScale = id === "enemy.beast.shell-leech" ? 1.18 : id === "old-manor.puppet-heiress" ? 1.32
    : id === "memory.marietta" ? 1.28 : id.startsWith("enemy.outlaw.") || id.startsWith("old-manor.") ? 1.18 : 1.04;
  return [id, { image, thumbnail, drawing: { width, height, centerX: asset.visualCenter[0], displayScale, offsetY: id === "old-manor.puppet-heiress" ? 20 : 0 } }] as const;
}));
