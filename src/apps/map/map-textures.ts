import {
  CanvasTexture,
  ClampToEdgeWrapping,
  RepeatWrapping,
  sRGBEncoding
} from "three";
import type { MapLocationConfig } from "./types";

export function requireCanvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持 2D Canvas");
  return context;
}

export function createParchmentSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 640;
  const context = requireCanvasContext(canvas);
  const background = context.createLinearGradient(0, 0, 0, canvas.height);
  background.addColorStop(0, "#182426");
  background.addColorStop(0.42, "#3d3025");
  background.addColorStop(0.68, "#4a3728");
  background.addColorStop(1, "#211710");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  let seed = 0x51a7c3;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const grain = Math.round((random() - 0.5) * 18);
    pixels.data[index] = Math.max(0, Math.min(255, pixels.data[index] + grain));
    pixels.data[index + 1] = Math.max(0, Math.min(255, pixels.data[index + 1] + grain));
    pixels.data[index + 2] = Math.max(0, Math.min(255, pixels.data[index + 2] + grain * 0.82));
  }
  context.putImageData(pixels, 0, 0);

  for (let index = 0; index < 34; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const radius = 42 + random() * 150;
    const stain = context.createRadialGradient(x, y, 0, x, y, radius);
    stain.addColorStop(0, `rgba(${random() > 0.48 ? "112, 78, 48" : "8, 20, 22"}, ${0.025 + random() * 0.045})`);
    stain.addColorStop(0.56, `rgba(45, 28, 17, ${0.018 + random() * 0.032})`);
    stain.addColorStop(1, "rgba(22, 13, 8, 0)");
    context.fillStyle = stain;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  context.lineCap = "round";
  for (let index = 0; index < 260; index += 1) {
    const y = random() * canvas.height;
    const x = random() * canvas.width;
    const length = 35 + random() * 190;
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(
      x + length * 0.28,
      y + (random() - 0.5) * 10,
      x + length * 0.72,
      y + (random() - 0.5) * 12,
      x + length,
      y + (random() - 0.5) * 7
    );
    context.strokeStyle = random() > 0.42
      ? `rgba(224, 187, 137, ${0.012 + random() * 0.025})`
      : `rgba(15, 12, 10, ${0.018 + random() * 0.032})`;
    context.lineWidth = 0.45 + random() * 1.15;
    context.stroke();
  }

  for (let index = 0; index < 1300; index += 1) {
    const radius = random() > 0.94 ? 1.2 : 0.45;
    context.beginPath();
    context.arc(random() * canvas.width, random() * canvas.height, radius, 0, Math.PI * 2);
    context.fillStyle = random() > 0.5 ? "rgba(238, 204, 153, 0.055)" : "rgba(13, 9, 7, 0.07)";
    context.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.encoding = sRGBEncoding;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.repeat.set(1.35, 1);
  return texture;
}

export function createPaperCutoutTexture(
  image: CanvasImageSource & { width: number; height: number },
  anisotropy: number,
  outlineWidth = 9
) {
  const imageWidth = image.width;
  const imageHeight = image.height;
  const originalPadding = outlineWidth * 2;
  const shadowOffsetX = Math.max(22, imageWidth * 0.06);
  const shadowOffsetY = Math.max(24, imageHeight * 0.07);
  const shadowBlur = Math.max(9, Math.min(18, Math.min(imageWidth, imageHeight) * 0.018));
  const padding = Math.ceil(Math.max(
    outlineWidth * 5 + 10,
    shadowOffsetX + shadowBlur * 2 + outlineWidth,
    shadowOffsetY + shadowBlur * 2 + outlineWidth
  ));
  const canvas = document.createElement("canvas");
  canvas.width = imageWidth + padding * 2;
  canvas.height = imageHeight + padding * 2;
  const context = requireCanvasContext(canvas);

  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = imageWidth;
  maskCanvas.height = imageHeight;
  const maskContext = requireCanvasContext(maskCanvas);
  maskContext.drawImage(image, 0, 0);
  maskContext.globalCompositeOperation = "source-in";
  maskContext.fillStyle = "#f5ebd7";
  maskContext.fillRect(0, 0, imageWidth, imageHeight);

  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = imageWidth;
  shadowCanvas.height = imageHeight;
  const shadowContext = requireCanvasContext(shadowCanvas);
  shadowContext.drawImage(image, 0, 0);
  shadowContext.globalCompositeOperation = "source-in";
  shadowContext.fillStyle = "#26170f";
  shadowContext.fillRect(0, 0, imageWidth, imageHeight);

  context.save();
  context.globalAlpha = 0.3;
  context.filter = `blur(${shadowBlur}px)`;
  context.drawImage(shadowCanvas, padding + shadowOffsetX + 4, padding + shadowOffsetY + 5);
  context.restore();

  context.save();
  context.globalAlpha = 0.24;
  context.drawImage(shadowCanvas, padding + shadowOffsetX, padding + shadowOffsetY);
  context.restore();

  for (let index = 0; index < 12; index += 1) {
    const angle = (index / 12) * Math.PI * 2;
    context.save();
    context.globalAlpha = 0.025;
    context.drawImage(
      shadowCanvas,
      padding + shadowOffsetX + Math.cos(angle) * 5.5,
      padding + shadowOffsetY + Math.sin(angle) * 5.5
    );
    context.restore();
  }

  for (let index = 0; index < 24; index += 1) {
    const angle = (index / 24) * Math.PI * 2;
    context.drawImage(
      maskCanvas,
      Math.cos(angle) * outlineWidth + padding,
      Math.sin(angle) * outlineWidth + padding
    );
  }
  context.drawImage(image, padding, padding);

  const texture = new CanvasTexture(canvas);
  texture.encoding = sRGBEncoding;
  texture.anisotropy = anisotropy;
  const baselineHeight = imageHeight + originalPadding * 2;
  return {
    texture,
    aspect: canvas.width / canvas.height,
    heightScale: canvas.height / baselineHeight,
    verticalShiftScale: -(padding - originalPadding) / baselineHeight
  };
}

export function createNameplateTexture(location: MapLocationConfig, anisotropy: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 840;
  canvas.height = 126;
  const context = requireCanvasContext(canvas);

  function nameplatePath(x: number, y: number, width: number, height: number, chamfer: number) {
    context.beginPath();
    context.moveTo(x + chamfer, y);
    context.lineTo(x + width - chamfer, y);
    context.lineTo(x + width, y + height / 2);
    context.lineTo(x + width - chamfer, y + height);
    context.lineTo(x + chamfer, y + height);
    context.lineTo(x, y + height / 2);
    context.closePath();
  }

  function fillLayer(x: number, y: number, width: number, height: number, chamfer: number, color: string) {
    nameplatePath(x, y, width, height, chamfer);
    context.fillStyle = color;
    context.fill();
  }

  function drawDiamondPattern() {
    context.save();
    nameplatePath(14, 14, 812, 98, 24);
    context.clip();
    for (let x = -20; x < canvas.width + 40; x += 68) {
      for (let y = -20; y < canvas.height + 40; y += 68) {
        context.beginPath();
        context.moveTo(x, y - 28);
        context.lineTo(x + 28, y);
        context.lineTo(x, y + 28);
        context.lineTo(x - 28, y);
        context.closePath();
        context.strokeStyle = "rgba(235, 224, 207, 0.038)";
        context.lineWidth = 2;
        context.stroke();
        context.beginPath();
        context.moveTo(x, y - 15);
        context.lineTo(x + 15, y);
        context.lineTo(x, y + 15);
        context.lineTo(x - 15, y);
        context.closePath();
        context.strokeStyle = "rgba(235, 224, 207, 0.022)";
        context.lineWidth = 1;
        context.stroke();
      }
    }
    context.restore();
  }

  function drawCenteredText(text: string, centerX: number, baselineY: number, spacing: number) {
    const characters = Array.from(text);
    const widths = characters.map((character) => context.measureText(character).width);
    const totalWidth = widths.reduce((sum, width) => sum + width, 0) + spacing * Math.max(0, characters.length - 1);
    let x = centerX - totalWidth / 2;
    characters.forEach((character, index) => {
      context.fillText(character, x, baselineY);
      x += widths[index] + spacing;
    });
  }

  // Uses the component-library Nameplate geometry, kept deliberately flat for kamishibai art.
  fillLayer(0, 0, 840, 126, 36, "#3a291c");
  fillLayer(6, 6, 828, 114, 30, "#ad875f");
  fillLayer(9, 9, 822, 108, 28, "#21140d");
  fillLayer(14, 14, 812, 98, 24, "#302016");

  context.save();
  nameplatePath(14, 14, 812, 98, 24);
  context.clip();
  for (let index = 0; index < 34; index += 1) {
    const x = 24 + ((index * 137) % 780);
    const y = 24 + ((index * 43) % 76);
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(Math.min(x + 54, 812), y + (index % 3) - 1);
    context.strokeStyle = index % 4 === 0
      ? "rgba(22, 11, 6, 0.1)"
      : "rgba(226, 180, 119, 0.045)";
    context.lineWidth = index % 5 === 0 ? 1.2 : 0.65;
    context.stroke();
  }
  context.restore();
  drawDiamondPattern();

  context.font = '600 60px "Noto Serif SC", "Songti SC", serif';
  context.fillStyle = "#f1dfc1";
  context.textBaseline = "middle";
  drawCenteredText(location.name, canvas.width / 2, canvas.height / 2 + 1, 10);

  const texture = new CanvasTexture(canvas);
  texture.encoding = sRGBEncoding;
  texture.anisotropy = anisotropy;
  return texture;
}
