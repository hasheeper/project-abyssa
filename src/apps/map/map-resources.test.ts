import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { disposeMapObjectResources } from "./map-resources";

describe("disposeMapObjectResources", () => {
  it("disposes mesh and line resources exactly once when they are shared", () => {
    const root = new THREE.Group();
    const geometry = new THREE.PlaneGeometry(1, 1);
    const lineGeometry = new THREE.BufferGeometry();
    const texture = new THREE.Texture();
    const mappedMaterial = new THREE.MeshBasicMaterial({ map: texture });
    const extraMaterial = new THREE.MeshBasicMaterial();
    const lineMaterial = new THREE.LineBasicMaterial();

    const geometryDispose = vi.spyOn(geometry, "dispose");
    const lineGeometryDispose = vi.spyOn(lineGeometry, "dispose");
    const textureDispose = vi.spyOn(texture, "dispose");
    const mappedDispose = vi.spyOn(mappedMaterial, "dispose");
    const extraDispose = vi.spyOn(extraMaterial, "dispose");
    const lineDispose = vi.spyOn(lineMaterial, "dispose");

    root.add(
      new THREE.Mesh(geometry, [mappedMaterial, extraMaterial]),
      new THREE.Mesh(geometry, mappedMaterial),
      new THREE.Line(lineGeometry, lineMaterial),
      new THREE.Object3D()
    );

    disposeMapObjectResources(root);

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(lineGeometryDispose).toHaveBeenCalledTimes(1);
    expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(mappedDispose).toHaveBeenCalledTimes(1);
    expect(extraDispose).toHaveBeenCalledTimes(1);
    expect(lineDispose).toHaveBeenCalledTimes(1);
  });

  it("accepts an empty object tree", () => {
    expect(() => disposeMapObjectResources(new THREE.Group())).not.toThrow();
  });
});
