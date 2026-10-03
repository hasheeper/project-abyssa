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

export function createParchmentSkyTexture(image: CanvasImageSource) {
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const context = requireCanvasContext(canvas);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const texture = new CanvasTexture(canvas);
  texture.encoding = sRGBEncoding;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.repeat.set(1, 1);
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
