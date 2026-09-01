import { gsap } from "gsap";
import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  FrontSide,
  Group,
  LineBasicMaterial,
  LineLoop,
  LinearToneMapping,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Raycaster,
  Scene,
  SphereGeometry,
  TextureLoader,
  Vector2,
  Vector3,
  WebGLRenderer,
  sRGBEncoding
} from "three";
import type { Texture } from "three";
import type { MapLocationConfig, MapLocationId } from "./types";
import { MAP_GROUND_URL, cloneMapLocations } from "./types";
import { disposeMapObjectResources } from "./map-resources";
import {
  createNameplateTexture,
  createPaperCutoutTexture,
  createParchmentSkyTexture,
  requireCanvasContext
} from "./map-textures";
import { createMapSceneRuntime } from "./map-scene-runtime";
import type { MapSceneRuntime } from "./map-scene-runtime";

interface MapSceneOptions {
  locations: MapLocationConfig[];
  onReady?: () => void;
  onError?: (error: unknown) => void;
  onLocationSelect?: (location: MapLocationConfig) => void;
}

export interface MapSceneController {
  replay: () => void;
  updateLocation: (id: MapLocationId, location: MapLocationConfig) => void;
  destroy: () => void;
}

interface SceneLocation {
  location: MapLocationConfig;
  rootGroup: Group;
  pivotGroup: Group;
  sceneMesh: Mesh;
  backMesh: Mesh;
  plateMesh: Mesh;
  aspect: number;
  heightScale: number;
  verticalShiftScale: number;
}

export function createMapScene(container: HTMLElement, options: MapSceneOptions): MapSceneController {
  const locations = cloneMapLocations(options.locations);
  const sceneObjects = new Map<MapLocationId, SceneLocation>();
  const scene = new Scene();
  scene.background = new Color(0x11191a);

  const size = () => ({ width: Math.max(container.clientWidth, 1), height: Math.max(container.clientHeight, 1) });
  const initialSize = size();
  const camera = new PerspectiveCamera(30.5, initialSize.width / initialSize.height, 0.1, 100);
  const cameraBasePosition = new Vector3(0, 17, 22);
  const cameraLookTarget = new Vector3(0, -0.5, 0);
  const cameraPitchAngle = Math.atan2(cameraBasePosition.y, cameraBasePosition.z);
  camera.position.copy(cameraBasePosition);
  camera.lookAt(cameraLookTarget);

  const renderer = new WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(initialSize.width, initialSize.height);
  renderer.outputEncoding = sRGBEncoding;
  renderer.toneMapping = LinearToneMapping;
  renderer.shadowMap.enabled = false;
  renderer.domElement.setAttribute("aria-label", "守望者之崖副本地图");
  container.appendChild(renderer.domElement);

  const skyTexture = createParchmentSkyTexture();
  skyTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const skyDome = new Mesh(
    new SphereGeometry(72, 40, 24),
    new MeshBasicMaterial({
      map: skyTexture,
      side: BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false
    })
  );
  skyDome.renderOrder = -100;
  scene.add(skyDome);

  scene.add(new AmbientLight(0xffebd2, 0.85));
  const keyLight = new DirectionalLight(0xffdfb5, 0.45);
  keyLight.position.set(-8, 22, 12);
  keyLight.castShadow = false;
  scene.add(keyLight);

  const textureLoader = new TextureLoader();
  textureLoader.setCrossOrigin("anonymous");
  let routeCanvas: HTMLCanvasElement | null = null;
  let routeContext: CanvasRenderingContext2D | null = null;
  let routeTexture: CanvasTexture | null = null;
  const pendingTextures = new Set<Texture>();
  let runtime: MapSceneRuntime;
  let pointerX = 0;
  let pointerY = 0;

  function loadTexture(url: string) {
    return new Promise<Texture>((resolve, reject) => {
      textureLoader.load(url, (texture) => {
        texture.encoding = sRGBEncoding;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        if (runtime.destroyed) {
          texture.dispose();
          reject(new Error("Map scene was destroyed while loading textures"));
          return;
        }
        pendingTextures.add(texture);
        resolve(texture);
      }, undefined, reject);
    });
  }

  function disposePendingTextures() {
    pendingTextures.forEach((texture) => texture.dispose());
    pendingTextures.clear();
  }


  function drawRoute() {
    if (!routeCanvas || !routeContext || !routeTexture) return;
    const width = routeCanvas.width;
    const height = routeCanvas.height;
    const pointFor = (location: MapLocationConfig) => ({
      x: ((location.position.x + 16) / 32) * width,
      y: ((location.position.z + 9) / 18) * height
    });
    const cave = pointFor(locations.find((entry) => entry.id === "cave")!);
    const tower = pointFor(locations.find((entry) => entry.id === "tower")!);
    const church = pointFor(locations.find((entry) => entry.id === "church")!);

    routeContext.clearRect(0, 0, width, height);
    routeContext.strokeStyle = "#4a2f1c";
    routeContext.lineWidth = 7;
    routeContext.setLineDash([18, 14]);
    routeContext.lineCap = "round";
    routeContext.beginPath();
    routeContext.moveTo(cave.x, cave.y);
    routeContext.quadraticCurveTo((cave.x + tower.x) / 2 + 60, (cave.y + tower.y) / 2 + 40, tower.x, tower.y);
    routeContext.quadraticCurveTo((tower.x + church.x) / 2 - 40, (tower.y + church.y) / 2 + 60, church.x, church.y);
    routeContext.stroke();

    [cave, tower, church].forEach((point) => {
      routeContext!.save();
      routeContext!.strokeStyle = "#6b452b";
      routeContext!.lineWidth = 5;
      routeContext!.setLineDash([8, 6]);
      routeContext!.beginPath();
      routeContext!.arc(point.x, point.y, 38, 0, Math.PI * 2);
      routeContext!.stroke();
      routeContext!.restore();
      routeContext!.fillStyle = "#301b0f";
      routeContext!.beginPath();
      routeContext!.arc(point.x, point.y, 12, 0, Math.PI * 2);
      routeContext!.fill();
      routeContext!.fillStyle = "#c79e70";
      routeContext!.beginPath();
      routeContext!.arc(point.x, point.y, 4, 0, Math.PI * 2);
      routeContext!.fill();
    });
    routeTexture.needsUpdate = true;
  }

  function createGround(texture: Texture) {
    const frameGroup = new Group();
    const backing = new Mesh(
      new PlaneGeometry(33, 19),
      new MeshBasicMaterial({ color: 0x17100c })
    );
    backing.rotation.x = -Math.PI / 2;
    backing.position.y = -0.07;
    frameGroup.add(backing);

    const railMaterial = new MeshStandardMaterial({
      color: 0x3a271b,
      roughness: 0.84,
      metalness: 0.08
    });
    const horizontalRail = new BoxGeometry(33, 0.13, 0.42);
    const verticalRail = new BoxGeometry(0.42, 0.13, 18.2);
    [-9.18, 9.18].forEach((z) => {
      const rail = new Mesh(horizontalRail, railMaterial);
      rail.position.set(0, -0.045, z);
      frameGroup.add(rail);
    });
    [-16.18, 16.18].forEach((x) => {
      const rail = new Mesh(verticalRail, railMaterial);
      rail.position.set(x, -0.045, 0);
      frameGroup.add(rail);
    });

    const innerBorderGeometry = new BufferGeometry().setFromPoints([
      new Vector3(-15.78, 0.025, -8.78),
      new Vector3(15.78, 0.025, -8.78),
      new Vector3(15.78, 0.025, 8.78),
      new Vector3(-15.78, 0.025, 8.78)
    ]);
    frameGroup.add(new LineLoop(
      innerBorderGeometry,
      new LineBasicMaterial({ color: 0xa17c57, transparent: true, opacity: 0.82 })
    ));
    scene.add(frameGroup);

    const geometry = new PlaneGeometry(32, 18);
    const ground = new Mesh(geometry, new MeshBasicMaterial({ map: texture, color: 0xc2ad93 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = false;
    scene.add(ground);

    routeCanvas = document.createElement("canvas");
    routeCanvas.width = 2048;
    routeCanvas.height = 1152;
    routeContext = requireCanvasContext(routeCanvas);
    routeTexture = new CanvasTexture(routeCanvas);
    routeTexture.encoding = sRGBEncoding;
    drawRoute();

    const route = new Mesh(geometry, new MeshBasicMaterial({ map: routeTexture, transparent: true, depthWrite: false }));
    route.rotation.x = -Math.PI / 2;
    route.position.y = 0.01;
    scene.add(route);
  }

  function createLocation(location: MapLocationConfig, rawTexture: Texture) {
    const image = rawTexture.image as CanvasImageSource & { width: number; height: number };
    const cutout = createPaperCutoutTexture(image, renderer.capabilities.getMaxAnisotropy());
    rawTexture.dispose();
    pendingTextures.delete(rawTexture);
    const rootGroup = new Group();
    rootGroup.position.set(location.position.x, 0, location.position.z);
    rootGroup.quaternion.copy(camera.quaternion);
    const pivotGroup = new Group();
    rootGroup.add(pivotGroup);

    const planeHeight = location.height * cutout.heightScale;
    const geometry = new PlaneGeometry(planeHeight * cutout.aspect, planeHeight);
    geometry.translate(0, planeHeight / 2 + location.height * cutout.verticalShiftScale, 0);
    const sceneMesh = new Mesh(geometry, new MeshLambertMaterial({
      map: cutout.texture,
      transparent: true,
      alphaTest: 0.04,
      color: 0xd2bea0,
      side: FrontSide
    }));
    sceneMesh.castShadow = false;
    pivotGroup.add(sceneMesh);

    const backMesh = new Mesh(geometry, new MeshBasicMaterial({
      map: cutout.texture,
      transparent: true,
      alphaTest: 0.04,
      color: 0x22130b,
      side: BackSide
    }));
    backMesh.position.z = -0.03;
    pivotGroup.add(backMesh);

    const plateWidth = 3.4;
    const plateMesh = new Mesh(
      new PlaneGeometry(plateWidth, plateWidth / (840 / 126)),
      new MeshBasicMaterial({ map: createNameplateTexture(location, renderer.capabilities.getMaxAnisotropy()), transparent: true, depthTest: false })
    );
    plateMesh.position.set(0, location.plateY, 0.15);
    plateMesh.renderOrder = 20;
    pivotGroup.add(plateMesh);
    scene.add(rootGroup);
    sceneObjects.set(location.id, {
      location,
      rootGroup,
      pivotGroup,
      sceneMesh,
      backMesh,
      plateMesh,
      aspect: cutout.aspect,
      heightScale: cutout.heightScale,
      verticalShiftScale: cutout.verticalShiftScale
    });
  }

  function replay() {
    if (runtime.destroyed) return;
    Array.from(sceneObjects.values()).forEach((object, index) => {
      gsap.killTweensOf(object.pivotGroup.rotation);
      gsap.killTweensOf(object.pivotGroup.scale);
      object.pivotGroup.rotation.set(-cameraPitchAngle, 0, index % 2 === 0 ? -0.12 : 0.12);
      object.pivotGroup.scale.set(0.15, 0.15, 0.15);
      const delay = index * 0.15;
      gsap.to(object.pivotGroup.scale, { x: 1, y: 1, z: 1, duration: 0.38, delay, ease: "back.out(2.0)" });
      gsap.to(object.pivotGroup.rotation, { x: 0, duration: 1.25, delay, ease: "elastic.out(1.1, 0.45)" });
      gsap.to(object.pivotGroup.rotation, { z: 0, duration: 1.35, delay: delay + 0.02, ease: "elastic.out(1.3, 0.38)" });
    });
  }

  function updateLocation(id: MapLocationId, next: MapLocationConfig) {
    if (runtime.destroyed) return;
    const locationIndex = locations.findIndex((entry) => entry.id === id);
    if (locationIndex < 0) return;
    locations[locationIndex] = { ...next, position: { ...next.position } };
    const object = sceneObjects.get(id);
    if (!object) return;
    object.location = locations[locationIndex];
    object.rootGroup.position.set(next.position.x, 0, next.position.z);
    object.sceneMesh.geometry.dispose();
    const planeHeight = next.height * object.heightScale;
    const geometry = new PlaneGeometry(planeHeight * object.aspect, planeHeight);
    geometry.translate(0, planeHeight / 2 + next.height * object.verticalShiftScale, 0);
    object.sceneMesh.geometry = geometry;
    object.backMesh.geometry = geometry;
    object.plateMesh.position.y = next.plateY;
    drawRoute();
  }

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  function handlePointerDown(event: PointerEvent) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const targets = Array.from(sceneObjects.values()).flatMap((object) => [object.sceneMesh, object.plateMesh]);
    const hit = raycaster.intersectObjects(targets)[0];
    if (!hit) return;
    const selected = Array.from(sceneObjects.values()).find((object) => object.sceneMesh === hit.object || object.plateMesh === hit.object);
    if (!selected) return;
    gsap.fromTo(selected.pivotGroup.rotation,
      { x: -0.18, z: (Math.random() - 0.5) * 0.08 },
      { x: 0, z: 0, duration: 0.85, ease: "elastic.out(1.4, 0.35)" }
    );
    options.onLocationSelect?.(selected.location);
  }

  function handlePointerMove(event: PointerEvent) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointerX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    pointerY = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
  }

  function handleResize() {
    const nextSize = size();
    camera.aspect = nextSize.width / nextSize.height;
    camera.updateProjectionMatrix();
    renderer.setSize(nextSize.width, nextSize.height);
  }

  function renderFrame() {
    camera.position.x += (cameraBasePosition.x + pointerX * 0.3 - camera.position.x) * 0.04;
    camera.position.y += (cameraBasePosition.y + pointerY * 0.2 - camera.position.y) * 0.04;
    camera.lookAt(cameraLookTarget);
    sceneObjects.forEach((object) => object.rootGroup.quaternion.copy(camera.quaternion));
    renderer.render(scene, camera);
  }

  runtime = createMapSceneRuntime({
    element: renderer.domElement,
    onFrame: renderFrame,
    onResize: handleResize,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onDestroy() {
      disposePendingTextures();
      sceneObjects.forEach((object) => {
        gsap.killTweensOf(object.pivotGroup.rotation);
        gsap.killTweensOf(object.pivotGroup.scale);
      });
      disposeMapObjectResources(scene);
      sceneObjects.clear();
      renderer.dispose();
      renderer.domElement.remove();
    }
  });

  Promise.all([
    loadTexture(MAP_GROUND_URL),
    ...locations.map((location) => loadTexture(location.imageUrl))
  ]).then(([groundTexture, ...locationTextures]) => {
    if (runtime.destroyed) {
      disposePendingTextures();
      return;
    }
    createGround(groundTexture);
    pendingTextures.delete(groundTexture);
    locations.forEach((location, index) => createLocation(location, locationTextures[index]));
    options.onReady?.();
    runtime.scheduleReplay(replay, 200);
  }).catch((error: unknown) => {
    disposePendingTextures();
    if (!runtime.destroyed) options.onError?.(error);
  });

  return {
    replay,
    updateLocation,
    destroy: runtime.destroy
  };
}
