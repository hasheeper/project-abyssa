import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  renderers: [] as Array<{
    domElement: HTMLCanvasElement;
    scene?: import("three").Scene;
    dispose: ReturnType<typeof vi.fn>;
    forceContextLoss: ReturnType<typeof vi.fn>;
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
    forceContextLoss = vi.fn();
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
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createMapScene", () => {
  it("waits for the page cue, springs the paper above its foot, and cancels to the exact resting pose", async () => {
    const clock = vi.spyOn(performance, "now").mockReturnValue(1000);
    const locations = cloneMapLocations();
    const controller = createMapScene(document.createElement("div"), { locations, intro: true });
    await flushPromiseQueue();
    const root = mocks.renderers[0].scene!.children.find(child => child instanceof THREE.Group && child.position.x === locations[0].position.x)!;
    const paper = root.children[0], label = root.children[1];
    expect(root.visible).toBe(false);
    controller.setIntroState("playing");
    const tick = (time: number) => {
      clock.mockReturnValue(time);
      vi.mocked(requestAnimationFrame).mock.calls.at(-1)![0](time);
    };
    tick(1478);
    expect(root.visible).toBe(true);
    expect(paper.scale.x).toBeGreaterThan(1.2);
    expect(paper.scale.x).toBe(paper.scale.y);
    expect(label.scale.x).toBe(1);
    expect(label.position.y).toBe(locations[0].plateY);
    tick(1736);
    expect(paper.scale.x).toBeLessThan(.94);
    controller.setIntroState("ready");
    expect(paper.scale.x).toBe(1);
    expect(paper.rotation.x).toBe(0);
    controller.setIntroState("playing");
    controller.setReducedMotion(true); tick(1800);
    expect(paper.scale.x).toBe(1); expect(paper.rotation.x).toBe(0);
    controller.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("loads full-sized static landmarks, updates shared geometry and destroys once", async () => {
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

    expect(mocks.gsapTo).not.toHaveBeenCalled();
    expect(mocks.gsapFromTo).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
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
    expect(pivot.scale.toArray()).toEqual([1, 1, 1]);
    expect([pivot.rotation.x, pivot.rotation.y, pivot.rotation.z]).toEqual([0, 0, 0]);
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
    expect(renderer.forceContextLoss).toHaveBeenCalledOnce();
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

  it("pushes the camera toward the selected landmark and restores the full-map pose", async () => {
    const container = document.createElement("div");
    Object.defineProperties(container, {
      clientWidth: { value: 800 },
      clientHeight: { value: 450 }
    });
    const locations = cloneMapLocations();
    const controller = createMapScene(container, { locations });
    await flushPromiseQueue();
    mocks.gsapTo.mockClear();
    mocks.gsapKill.mockClear();

    const tower = locations.find((location) => location.id === "tower")!;
    controller.setSelected(tower.id, "right");

    const focusTween = mocks.gsapTo.mock.lastCall!;
    const focusPose = focusTween[1] as Record<string, number | string>;
    expect(mocks.gsapKill).toHaveBeenCalledWith(focusTween[0]);
    expect(focusPose).toMatchObject({
      duration: 0.78,
      ease: expect.any(Function)
    });
    /* 侧板在右，镜头中心向右让位，地标因此落在左侧可视区。 */
    expect(focusPose.targetX as number).toBeGreaterThan(tower.position.x);
    expect(focusPose.positionX as number).toBeGreaterThan(tower.position.x);
    /* 小队占住底部，镜头中心向下让位，地标落在上方可视区。 */
    expect(focusPose.targetY as number).toBeLessThan(tower.height * 0.24);
    expect(focusPose.targetZ as number).toBeGreaterThan(tower.position.z);
    expect(focusPose.positionY as number).toBeLessThan(17);
    expect(focusPose.positionZ as number).toBeLessThan(22);

    controller.setSelected(null);
    expect(mocks.gsapTo.mock.lastCall?.[1]).toMatchObject({
      positionX: 0,
      positionY: 17,
      positionZ: 22,
      targetX: 0,
      targetY: -0.5,
      targetZ: 0
    });

    controller.destroy();
  });

  it("selects a hit landmark without tilting or queuing a click animation", async () => {
    const container = document.createElement("div");
    const locations = cloneMapLocations(), onLocationSelect = vi.fn();
    const controller = createMapScene(container, { locations, onLocationSelect });
    await flushPromiseQueue();
    const scene = mocks.renderers[0].scene!;
    const root = scene.children.find(child => child instanceof THREE.Group &&
      child.position.x === locations[0].position.x && child.position.z === locations[0].position.z)!;
    const pivot = root.children[0], mesh = pivot.children[0];
    vi.spyOn(THREE.Raycaster.prototype, "intersectObjects").mockReturnValue([{ object: mesh }] as THREE.Intersection[]);
    const canvas = container.querySelector("canvas")!;
    vi.spyOn(canvas, "getBoundingClientRect").mockReturnValue({ left: 0, top: 0, width: 800, height: 450 } as DOMRect);
    canvas.dispatchEvent(new PointerEvent("pointerdown", { clientX: 400, clientY: 225 }));
    expect(onLocationSelect).toHaveBeenCalledExactlyOnceWith(locations[0]);
    expect(mocks.gsapFromTo).not.toHaveBeenCalled();
    expect(mocks.gsapTo).not.toHaveBeenCalled();
    expect([pivot.rotation.x, pivot.rotation.y, pivot.rotation.z]).toEqual([0, 0, 0]);
    controller.setInteractive(false);
    canvas.dispatchEvent(new PointerEvent("pointerdown"));
    expect(onLocationSelect).toHaveBeenCalledOnce();
    controller.destroy();
  });

  it("cancels obsolete focus moves and settles directly when reduced motion is requested", async () => {
    const controller = createMapScene(document.createElement("div"), { locations: cloneMapLocations() });
    await flushPromiseQueue();
    controller.setSelected("tower", "right");
    const pose = mocks.gsapTo.mock.lastCall![0];
    controller.setSelected("cave", "left");
    expect(mocks.gsapKill).toHaveBeenCalledTimes(2);
    expect(mocks.gsapKill).toHaveBeenLastCalledWith(pose);
    expect(mocks.gsapTo).toHaveBeenCalledTimes(2);
    controller.setSelected("cave", "left");
    expect(mocks.gsapTo).toHaveBeenCalledTimes(2);
    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    controller.setSelected(null);
    expect(mocks.gsapKill).toHaveBeenLastCalledWith(pose);
    expect(mocks.gsapTo).toHaveBeenCalledTimes(2);
    expect(pose).toMatchObject({ positionX: 0, positionY: 17, positionZ: 22, targetX: 0, targetY: -0.5, targetZ: 0 });
    controller.destroy();
  });
});
