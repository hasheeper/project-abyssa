import { gsap } from "gsap";
import * as THREE from "three";
import type { MapLocationConfig, MapLocationId } from "./types";
import { MAP_GROUND_URL, cloneMapLocations } from "./types";

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
  rootGroup: THREE.Group;
  pivotGroup: THREE.Group;
  sceneMesh: THREE.Mesh;
  plateMesh: THREE.Mesh;
  aspect: number;
  heightScale: number;
  verticalShiftScale: number;
}

function requireCanvasContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器不支持 2D Canvas");
  return context;
}

function createParchmentSkyTexture() {
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

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.repeat.set(1.35, 1);
  return texture;
}

export function createMapScene(container: HTMLElement, options: MapSceneOptions): MapSceneController {
  const locations = cloneMapLocations(options.locations);
  const sceneObjects = new Map<MapLocationId, SceneLocation>();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x11191a);

  const size = () => ({ width: Math.max(container.clientWidth, 1), height: Math.max(container.clientHeight, 1) });
  const initialSize = size();
  const camera = new THREE.PerspectiveCamera(30.5, initialSize.width / initialSize.height, 0.1, 100);
  const cameraBasePosition = new THREE.Vector3(0, 17, 22);
  const cameraLookTarget = new THREE.Vector3(0, -0.5, 0);
  const cameraPitchAngle = Math.atan2(cameraBasePosition.y, cameraBasePosition.z);
  camera.position.copy(cameraBasePosition);
  camera.lookAt(cameraLookTarget);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(initialSize.width, initialSize.height);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.shadowMap.enabled = false;
  renderer.domElement.setAttribute("aria-label", "守望者之崖副本地图");
  container.appendChild(renderer.domElement);

  const skyTexture = createParchmentSkyTexture();
  skyTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(72, 40, 24),
    new THREE.MeshBasicMaterial({
      map: skyTexture,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false
    })
  );
  skyDome.renderOrder = -100;
  scene.add(skyDome);

  scene.add(new THREE.AmbientLight(0xffebd2, 0.85));
  const keyLight = new THREE.DirectionalLight(0xffdfb5, 0.45);
  keyLight.position.set(-8, 22, 12);
  keyLight.castShadow = false;
  scene.add(keyLight);

  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin("anonymous");
  let routeCanvas: HTMLCanvasElement | null = null;
  let routeContext: CanvasRenderingContext2D | null = null;
  let routeTexture: THREE.CanvasTexture | null = null;
  let animationFrame = 0;
  let entranceTimer = 0;
  let destroyed = false;
  let pointerX = 0;
  let pointerY = 0;

  function loadTexture(url: string) {
    return new Promise<THREE.Texture>((resolve, reject) => {
      textureLoader.load(url, (texture) => {
        texture.encoding = THREE.sRGBEncoding;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        resolve(texture);
      }, undefined, reject);
    });
  }

  function createPaperCutoutTexture(image: CanvasImageSource & { width: number; height: number }, outlineWidth = 9) {
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

    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const baselineHeight = imageHeight + originalPadding * 2;
    return {
      texture,
      aspect: canvas.width / canvas.height,
      heightScale: canvas.height / baselineHeight,
      verticalShiftScale: -(padding - originalPadding) / baselineHeight
    };
  }

  function createNameplateTexture(location: MapLocationConfig) {
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

    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
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

  function createGround(texture: THREE.Texture) {
    const frameGroup = new THREE.Group();
    const backing = new THREE.Mesh(
      new THREE.PlaneGeometry(33, 19),
      new THREE.MeshBasicMaterial({ color: 0x17100c })
    );
    backing.rotation.x = -Math.PI / 2;
    backing.position.y = -0.07;
    frameGroup.add(backing);

    const railMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a271b,
      roughness: 0.84,
      metalness: 0.08
    });
    const horizontalRail = new THREE.BoxGeometry(33, 0.13, 0.42);
    const verticalRail = new THREE.BoxGeometry(0.42, 0.13, 18.2);
    [-9.18, 9.18].forEach((z) => {
      const rail = new THREE.Mesh(horizontalRail, railMaterial);
      rail.position.set(0, -0.045, z);
      frameGroup.add(rail);
    });
    [-16.18, 16.18].forEach((x) => {
      const rail = new THREE.Mesh(verticalRail, railMaterial);
      rail.position.set(x, -0.045, 0);
      frameGroup.add(rail);
    });

    const innerBorderGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-15.78, 0.025, -8.78),
      new THREE.Vector3(15.78, 0.025, -8.78),
      new THREE.Vector3(15.78, 0.025, 8.78),
      new THREE.Vector3(-15.78, 0.025, 8.78)
    ]);
    frameGroup.add(new THREE.LineLoop(
      innerBorderGeometry,
      new THREE.LineBasicMaterial({ color: 0xa17c57, transparent: true, opacity: 0.82 })
    ));
    scene.add(frameGroup);

    const geometry = new THREE.PlaneGeometry(32, 18);
    const ground = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture, color: 0xc2ad93 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = false;
    scene.add(ground);

    routeCanvas = document.createElement("canvas");
    routeCanvas.width = 2048;
    routeCanvas.height = 1152;
    routeContext = requireCanvasContext(routeCanvas);
    routeTexture = new THREE.CanvasTexture(routeCanvas);
    routeTexture.encoding = THREE.sRGBEncoding;
    drawRoute();

    const route = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: routeTexture, transparent: true, depthWrite: false }));
    route.rotation.x = -Math.PI / 2;
    route.position.y = 0.01;
    scene.add(route);
  }

  function createLocation(location: MapLocationConfig, rawTexture: THREE.Texture) {
    const image = rawTexture.image as CanvasImageSource & { width: number; height: number };
    const cutout = createPaperCutoutTexture(image);
    const rootGroup = new THREE.Group();
    rootGroup.position.set(location.position.x, 0, location.position.z);
    rootGroup.quaternion.copy(camera.quaternion);
    const pivotGroup = new THREE.Group();
    rootGroup.add(pivotGroup);

    const planeHeight = location.height * cutout.heightScale;
    const geometry = new THREE.PlaneGeometry(planeHeight * cutout.aspect, planeHeight);
    geometry.translate(0, planeHeight / 2 + location.height * cutout.verticalShiftScale, 0);
    const sceneMesh = new THREE.Mesh(geometry, new THREE.MeshLambertMaterial({
      map: cutout.texture,
      transparent: true,
      alphaTest: 0.04,
      color: 0xd2bea0,
      side: THREE.FrontSide
    }));
    sceneMesh.castShadow = false;
    pivotGroup.add(sceneMesh);

    const backMesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
      map: cutout.texture,
      transparent: true,
      alphaTest: 0.04,
      color: 0x22130b,
      side: THREE.BackSide
    }));
    backMesh.position.z = -0.03;
    pivotGroup.add(backMesh);

    const plateWidth = 3.4;
    const plateMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(plateWidth, plateWidth / (840 / 126)),
      new THREE.MeshBasicMaterial({ map: createNameplateTexture(location), transparent: true, depthTest: false })
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
      plateMesh,
      aspect: cutout.aspect,
      heightScale: cutout.heightScale,
      verticalShiftScale: cutout.verticalShiftScale
    });
  }

  function replay() {
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
    const locationIndex = locations.findIndex((entry) => entry.id === id);
    if (locationIndex < 0) return;
    locations[locationIndex] = { ...next, position: { ...next.position } };
    const object = sceneObjects.get(id);
    if (!object) return;
    object.location = locations[locationIndex];
    object.rootGroup.position.set(next.position.x, 0, next.position.z);
    object.sceneMesh.geometry.dispose();
    const planeHeight = next.height * object.heightScale;
    const geometry = new THREE.PlaneGeometry(planeHeight * object.aspect, planeHeight);
    geometry.translate(0, planeHeight / 2 + next.height * object.verticalShiftScale, 0);
    object.sceneMesh.geometry = geometry;
    object.plateMesh.position.y = next.plateY;
    drawRoute();
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
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

  function animate() {
    if (destroyed) return;
    animationFrame = requestAnimationFrame(animate);
    camera.position.x += (cameraBasePosition.x + pointerX * 0.3 - camera.position.x) * 0.04;
    camera.position.y += (cameraBasePosition.y + pointerY * 0.2 - camera.position.y) * 0.04;
    camera.lookAt(cameraLookTarget);
    sceneObjects.forEach((object) => object.rootGroup.quaternion.copy(camera.quaternion));
    renderer.render(scene, camera);
  }

  renderer.domElement.addEventListener("pointerdown", handlePointerDown);
  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("resize", handleResize);
  animate();

  Promise.all([
    loadTexture(MAP_GROUND_URL),
    ...locations.map((location) => loadTexture(location.imageUrl))
  ]).then(([groundTexture, ...locationTextures]) => {
    if (destroyed) return;
    createGround(groundTexture);
    locations.forEach((location, index) => createLocation(location, locationTextures[index]));
    options.onReady?.();
    entranceTimer = window.setTimeout(replay, 200);
  }).catch((error: unknown) => {
    if (!destroyed) options.onError?.(error);
  });

  return {
    replay,
    updateLocation,
    destroy() {
      destroyed = true;
      window.clearTimeout(entranceTimer);
      cancelAnimationFrame(animationFrame);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
      sceneObjects.forEach((object) => {
        gsap.killTweensOf(object.pivotGroup.rotation);
        gsap.killTweensOf(object.pivotGroup.scale);
      });
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh) && !(object instanceof THREE.Line)) return;
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          const texture = (material as THREE.MeshBasicMaterial).map;
          texture?.dispose();
          material.dispose();
        });
      });
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
