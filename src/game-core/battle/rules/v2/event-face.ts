import type { DemoContent, DemoFace } from "../../../contracts/demo";
export function eventFaceMethod(catalog: DemoContent, face: DemoFace): "strong" | "weak" | "failed" {
  const action = catalog.actions[face.actionId].kind;
  if (["heal", "expensive-heal", "protect", "guard-all", "wild"].includes(action)) return "strong";
  return face.fate === "awake" && (face.pip.kind === "wild" || face.pip.value >= 4) ? "weak" : "failed";
}
