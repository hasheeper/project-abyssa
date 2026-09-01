import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  renderers: [] as Array<{
    domElement: HTMLCanvasElement;
    scene?: import("three").Scene;
    dispose: ReturnType<typeof vi.fn>;
  }>,
  rawTextures: [] as Array<import("three").Texture>,
  deferredLoads: [] as Array<() => void>,
  deferTextures: false,
  disposeResources: vi.fn(),
  gsapTo: vi.fn(),
  gsapFromTo: vi.fn(),
  gsapKill: vi.fn()
}));

vi.mock("gsap", () => ({
  gsap: {
    to: mocks.gsapTo,
    fromTo: mocks.gsapFromTo,
    killTweensOf: mocks.gsapKill
  }
}));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();

  class FakeWebGLRenderer {
    domElement = document.createElement("canvas");
    capabilities = { getMaxAnisotropy: () => 4 };
    shadowMap = { enabled: true };
    outputEncoding = actual.LinearEncoding;
    toneMapping = actual.NoToneMapping;
    dispose = vi.fn();
    scene?: import("three").Scene;

    constructor() {
      mocks.renderers.push(this);
    }

    setPixelRatio() {}
    setSize() {}
    render(scene: import("three").Scene) {
      this.scene = scene;
    }
  }

  class FakeTextureLoader {
    setCrossOrigin() {}

    load(
      _url: string,
      onLoad: (texture: import("three").Texture) => void
    ) {
      const texture = new actual.Texture();
      texture.image = { width: 120, height: 180 };
      vi.spyOn(texture, "dispose");
      mocks.rawTextures.push(texture);
      const finish = () => onLoad(texture);
      if (mocks.deferTextures) mocks.deferredLoads.push(finish);
      else finish();
      return texture;
    }
  }

  return {
    ...actual,
    TextureLoader: FakeTextureLoader,
    WebGLRenderer: FakeWebGLRenderer
  };
});

vi.mock("./map-resources", () => ({
  disposeMapObjectResources: mocks.disposeResources
}));

vi.mock("./map-textures", () => {
  const canvasTexture = () => ({
    anisotropy: 0,
    dispose: vi.fn()
  });
  const context = {
    clearRect: vi.fn(),
    setLineDash: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn()
  };
  return {
    createParchmentSkyTexture: vi.fn(canvasTexture),
    createPaperCutoutTexture: vi.fn(() => ({
      texture: canvasTexture(),
      aspect: 1,
      heightScale: 1,
      verticalShiftScale: 0
    })),
    createNameplateTexture: vi.fn(canvasTexture),
    requireCanvasContext: vi.fn(() => context)
  };
});

import * as THREE from "three";
import { createMapScene } from "./createMapScene";
import { cloneMapLocations } from "./types";

async function flushPromiseQueue() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.renderers.length = 0;
  mocks.rawTextures.length = 0;
  mocks.deferredLoads.length = 0;
  mocks.deferTextures = false;
  mocks.disposeResources.mockClear();
  mocks.gsapTo.mockClear();
  mocks.gsapFromTo.mockClear();
  mocks.gsapKill.mockClear();
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 73));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createMapScene", () => {
  it("loads the scene, replays locations, updates shared front/back geometry and destroys once", async () => {
    const container = document.createElement("div");
    Object.defineProperties(container, {
      clientWidth: { value: 800 },
      clientHeight: { value: 450 }
    });
    const locations = cloneMapLocations();
    const onReady = vi.fn();
    const controller = createMapScene(container, { locations, onReady });

    expect(container.querySelector("canvas")).not.toBeNull();
    await flushPromiseQueue();
    expect(onReady).toHaveBeenCalledOnce();

    controller.replay();
    expect(mocks.gsapTo).toHaveBeenCalledTimes(locations.length * 3);
    for (const texture of mocks.rawTextures.slice(1)) {
      expect(texture.dispose).toHaveBeenCalledOnce();
    }

    const renderer = mocks.renderers[0];
    const scene = renderer.scene!;
    const location = locations[0];
    const root = scene.children.find((child) =>
      child instanceof THREE.Group &&
      child.position.x === location.position.x &&
      child.position.z === location.position.z
    ) as THREE.Group;
    const pivot = root.children[0] as THREE.Group;
    const meshes = pivot.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
    const oldGeometry = meshes[0].geometry;
    const disposeOldGeometry = vi.spyOn(oldGeometry, "dispose");
    expect(meshes[1].geometry).toBe(oldGeometry);

    controller.updateLocation(location.id, {
      ...location,
      height: location.height + 1,
      position: { ...location.position, x: location.position.x + 2 }
    });

    expect(disposeOldGeometry).toHaveBeenCalledOnce();
    expect(meshes[0].geometry).not.toBe(oldGeometry);
    expect(meshes[1].geometry).toBe(meshes[0].geometry);

    controller.destroy();
    controller.destroy();
    expect(mocks.disposeResources).toHaveBeenCalledOnce();
    expect(renderer.dispose).toHaveBeenCalledOnce();
    expect(container.querySelector("canvas")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("disposes textures that finish loading after an early destroy without firing callbacks", async () => {
    mocks.deferTextures = true;
    const container = document.createElement("div");
    const onReady = vi.fn();
    const onError = vi.fn();
    const controller = createMapScene(container, {
      locations: cloneMapLocations(),
      onReady,
      onError
    });

    controller.destroy();
    for (const finish of mocks.deferredLoads) finish();
    await flushPromiseQueue();

    expect(onReady).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    for (const texture of mocks.rawTextures) {
      expect(texture.dispose).toHaveBeenCalledOnce();
    }
  });
});
