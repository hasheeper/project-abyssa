import { defaultSpecification } from "../../game-runtime/airp-generation";
import { v7BuiltinGenerationPreset, v7GenerationResources } from "../../content/presentation/airp/generation-resources";
import { parsePreset } from "../airp-generation/preset";

/** Historical fixture: changing the default must not rewrite an existing v7 run. */
export function outlineSpecificationV7() {
  const spec = defaultSpecification();
  spec.resources = structuredClone(v7GenerationResources);
  spec.preset = parsePreset(JSON.stringify(v7BuiltinGenerationPreset));
  spec.orderId = spec.preset.orders[0].id;
  return spec;
}
