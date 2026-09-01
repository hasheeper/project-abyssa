import { Line, Mesh } from "three";
import type { BufferGeometry, Material, Object3D, Texture } from "three";

type MaterialWithMap = Material & { map?: Texture | null };

/**
 * Releases scene-owned geometries, materials and their color-map textures.
 * Sets prevent shared resources from being disposed more than once.
 */
export function disposeMapObjectResources(root: Object3D) {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();

  root.traverse((object) => {
    if (!(object instanceof Mesh) && !(object instanceof Line)) return;
    geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : [object.material];
    objectMaterials.forEach((material) => {
      materials.add(material);
      const texture = (material as MaterialWithMap).map;
      if (texture) textures.add(texture);
    });
  });

  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}
