import { AIRP_LIMITS as limits } from "./airp";
import { assertJson, invalid, list, utf8Size } from "./validation";

/** Storage planning guard, not a record reader. AIRP-2 also validates the whole 8 MiB record. */
export function measureAirpCapacity(input: {
  scenes: readonly unknown[]; instances: readonly unknown[]; memories: readonly unknown[];
  jobs: readonly unknown[]; metadata: unknown;
}, sceneByteLimit: number = limits.sceneBytes): { totalBytes: number; sceneBytes: number } {
  assertJson(input);
  let sceneBytes = 0;
  for (const [key, count, maxBytes] of [
    ["scenes", limits.sceneCount, limits.sceneBytes], ["instances", limits.instances, limits.instanceBytes],
    ["memories", limits.memories, limits.memoryBytes], ["jobs", limits.jobs, limits.jobBytes],
  ] as const) {
    list(input[key], key, count).forEach((entry, index) => {
      const bytes = utf8Size(JSON.stringify(entry));
      if (bytes > (key === "scenes" ? sceneByteLimit : maxBytes)) invalid(`${key}[${index}]`, "AIRP entry exceeds byte budget", "airp-capacity");
      if (key === "scenes") sceneBytes += bytes;
    });
  }
  if (utf8Size(JSON.stringify(input.metadata)) > limits.metadataBytes) invalid("metadata", "AIRP metadata exceeds byte budget", "airp-capacity");
  const totalBytes = utf8Size(JSON.stringify(input));
  if (totalBytes > limits.narrativeBytes) invalid("narrative", "AIRP archive exceeds byte budget", "airp-capacity");
  return { totalBytes, sceneBytes };
}
