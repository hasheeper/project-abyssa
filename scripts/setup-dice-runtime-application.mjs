const apiBase = (
  process.env.DICE_RUNTIME_API_BASE_URL ?? "http://127.0.0.1:8787/api/v1"
).replace(/\/$/u, "");

const applicationSlug = "lumen-dice";

const polishVariants = [
  {
    key: "polishA",
    file: "battle-polish.json",
    title: "Dice Battle Polisher A",
    focus: "Prefer sharp pacing, physical action and table tension.",
  },
  {
    key: "polishB",
    file: "battle-polish-b.json",
    title: "Dice Battle Polisher B",
    focus:
      "Prefer character interaction, restrained humor and emotional rhythm.",
  },
  {
    key: "polishC",
    file: "battle-polish-c.json",
    title: "Dice Battle Polisher C",
    focus:
      "Prefer deduction, public-versus-hidden information and tactical reversals.",
  },
];

const roles = [
  {
    key: "reaction",
    path: "roles/realtime/tibby-reaction.json",
    title: "Tibby Realtime Reaction",
    purpose: "Fast opponent action and dialogue for the Lumen dice game",
    instruction: [
      "You are Tibby at a hidden-information dice table.",
      "Choose exactly one action from ALLOWED_ACTIONS using only the supplied projection.",
      "Return exactly three lines: ACTION=<token>, MOOD=<calm|thinking|amused|curious|surprised|serious>, LINE=<short in-character Chinese line>.",
      "Do not reveal hidden reasoning, invent dice, or add Markdown.",
    ].join("\n"),
    maxBytes: 16 * 1024,
    generation: { temperature: 0.45, maxOutputTokens: 160 },
  },
  {
    key: "outline",
    path: "roles/postgame/battle-outline.json",
    title: "Dice Battle Outline",
    purpose: "Plan a coherent post-game battle report",
    instruction: [
      "Turn the supplied deterministic dice battle record into a Chinese writing outline.",
      "Preserve the result, action order, public/private information boundaries and requested approximate length.",
      "Include scene beats, tension changes, character reactions and a compact ending. Do not write the final report.",
    ].join("\n"),
    maxBytes: 256 * 1024,
    generation: { temperature: 0.55, maxOutputTokens: 1800 },
  },
  ...polishVariants.map((variant) => ({
    key: variant.key,
    path: `roles/postgame/${variant.file}`,
    title: variant.title,
    purpose: "Produce one independent stylistic candidate from a fixed outline",
    instruction: [
      "Write one complete Chinese battle-report candidate from the fixed outline and source record.",
      "Follow STYLE_BRIEF, preserve all game facts, and never change the winner, wagers or dice results.",
      variant.focus,
      "Return only the candidate prose.",
    ].join("\n"),
    maxBytes: 512 * 1024,
    generation: { temperature: 0.9, maxOutputTokens: 5000 },
  })),
  {
    key: "review",
    path: "roles/postgame/battle-review.json",
    title: "Dice Battle Editor",
    purpose: "Review parallel candidates and produce the final report",
    instruction: [
      "Act as the lead editor for a dice battle report.",
      "Compare the candidate drafts against the outline and deterministic record, repair factual or semantic contradictions, and produce one coherent final Chinese report near the requested length.",
      "Return only the final report.",
    ].join("\n"),
    maxBytes: 1024 * 1024,
    generation: { temperature: 0.35, maxOutputTokens: 7000 },
  },
  {
    key: "proposal",
    path: "roles/postgame/state-memory-proposal.json",
    title: "Dice State Memory Proposal",
    purpose: "Extract a non-committing variable and memory proposal",
    instruction: [
      "Create a proposal from the final report and deterministic battle record.",
      "Return strict JSON with keys variables, memories and sessionEvent. variables must only contain facts present in the record; memories must be a bounded array of concise strings.",
      "This is a proposal only. Do not claim that any state was committed.",
    ].join("\n"),
    maxBytes: 256 * 1024,
    generation: { temperature: 0.1, maxOutputTokens: 1600 },
  },
];

const pipelines = [
  {
    key: "reaction",
    path: "pipelines/realtime/tibby-reaction.json",
    title: "Realtime Reaction",
    fields: [
      ["gameState", "GAME_STATE", "string", 128 * 1024],
      ["allowedActions", "ALLOWED_ACTIONS", "string", 8 * 1024],
      ["recentEvents", "RECENT_EVENTS", "string", 64 * 1024],
    ],
  },
  {
    key: "outline",
    path: "pipelines/postgame/battle-outline.json",
    title: "Battle Outline",
    fields: [
      ["battleRecord", "BATTLE_RECORD", "string", 512 * 1024],
      ["targetLength", "TARGET_LENGTH", "number", 1024],
      ["reportIntent", "REPORT_INTENT", "string", 16 * 1024],
    ],
  },
  ...polishVariants.map((variant) => ({
    key: variant.key,
    path: `pipelines/postgame/${variant.file}`,
    title: variant.title.replace("Dice ", ""),
    fields: [
      ["outline", "OUTLINE", "string", 256 * 1024],
      ["battleRecord", "BATTLE_RECORD", "string", 512 * 1024],
      ["styleBrief", "STYLE_BRIEF", "string", 32 * 1024],
    ],
  })),
  {
    key: "review",
    path: "pipelines/postgame/battle-review.json",
    title: "Battle Review",
    fields: [
      ["outline", "OUTLINE", "string", 256 * 1024],
      ["candidates", "CANDIDATES", "string", 1024 * 1024],
      ["battleRecord", "BATTLE_RECORD", "string", 512 * 1024],
      ["targetLength", "TARGET_LENGTH", "number", 1024],
    ],
  },
  {
    key: "proposal",
    path: "pipelines/postgame/state-memory-proposal.json",
    title: "State Memory Proposal",
    fields: [
      ["finalReport", "FINAL_REPORT", "string", 1024 * 1024],
      ["battleRecord", "BATTLE_RECORD", "string", 512 * 1024],
    ],
  },
];

const roleDocument = (role) => ({
  schemaVersion: 1,
  purpose: role.purpose,
  instruction: { format: "markdown", content: role.instruction },
  output: { kind: "text", maxBytes: role.maxBytes },
  capability: { streaming: "required" },
  generation: role.generation,
});

function pipelineDocument(roleArtifactId, fields) {
  const runtimePorts = fields.map(([id, , type, maxBytes]) => ({
    id,
    required: true,
    maxBytes,
    source: { kind: "invocation.input", schema: { type } },
  }));
  const renderers = fields.map(([id, label]) => ({
    id: `${id}-renderer`,
    version: "typed-text-renderer-v1",
    escaping: "plain-text-v1",
    root: {
      type: "sequence",
      separator: "",
      children: [
        { type: "literal", value: `${label}:\n` },
        {
          type: "value",
          value: { scope: "port", portId: id, path: [] },
          onMissing: "error",
        },
      ],
    },
  }));
  const sourceNodes = fields.map(([id]) => ({
    id: `${id}-source`,
    type: "runtime-source",
    runtimePortId: id,
  }));
  const rendererNodes = fields.map(([id]) => ({
    id: `${id}-text`,
    type: "typed-text-renderer",
    rendererId: `${id}-renderer`,
    inputPortIds: [id],
  }));
  const assemblerInputs = fields.map(([id], index) => ({
    id,
    type: "text",
    required: true,
    placement: { kind: "instruction" },
    order: index * 10,
    carrier: { kind: "instruction", purpose: `dice-${id}` },
  }));
  return {
    schemaVersion: 4,
    requestTopology: { mode: "turns" },
    budget: { maxContextTokens: 64_000, reservedOutputTokens: 8_000 },
    runtimePorts,
    renderers,
    slots: [],
    resourceBindings: [],
    nodes: [
      ...sourceNodes,
      ...rendererNodes,
      { id: "prompt", type: "prompt-assembler", inputs: assemblerInputs },
      {
        id: "model",
        type: "model-call",
        roleArtifactId,
        generation: {},
      },
      { id: "output", type: "pipeline-output" },
    ],
    edges: [
      ...fields.flatMap(([id]) => [
        {
          id: `${id}-source-to-renderer`,
          from: { nodeId: `${id}-source`, portId: "data" },
          to: { nodeId: `${id}-text`, portId: id },
        },
        {
          id: `${id}-renderer-to-prompt`,
          from: { nodeId: `${id}-text`, portId: "text" },
          to: { nodeId: "prompt", portId: id },
        },
      ]),
      {
        id: "prompt-to-model",
        from: { nodeId: "prompt", portId: "prompt" },
        to: { nodeId: "model", portId: "prompt" },
      },
      {
        id: "model-to-output",
        from: { nodeId: "model", portId: "candidate" },
        to: { nodeId: "output", portId: "candidate" },
      },
    ],
    outputNodeId: "output",
  };
}

async function request(path, init = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || "error" in payload) {
    throw new Error(
      payload?.error?.message ??
        `Runtime API request failed (${response.status}).`,
    );
  }
  return payload.data;
}

const jsonRequest = (method, body) => ({ method, body: JSON.stringify(body) });

async function main() {
  const catalog = await request("/applications");
  let summary = catalog.applications.find(
    (item) => item.slug === applicationSlug,
  );
  let application;
  if (summary) {
    application = await request(
      `/applications/${encodeURIComponent(summary.id)}`,
    );
  } else {
    application = await request(
      "/applications",
      jsonRequest("POST", {
        slug: applicationSlug,
        name: "光影骰局",
        summary: "独立骰子游戏的即时反应与局后战报工作流。",
        creator: "RP Style Lab",
      }),
    );
    summary = application.application;
  }

  let artifacts = (await request(`/applications/${summary.id}/artifacts`))
    .artifacts;
  const roleIds = new Map();
  for (const role of roles) {
    let artifact = artifacts.find((item) => item.path === role.path);
    if (!artifact) {
      const created = await request(
        `/applications/${summary.id}/artifacts`,
        jsonRequest("POST", {
          kind: "model-role",
          path: role.path,
          title: role.title,
          document: roleDocument(role),
        }),
      );
      artifact = created.artifact;
      artifacts.push(artifact);
    }
    if (artifact.kind !== "model-role") {
      throw new Error(
        `Artifact path is occupied by the wrong kind: ${role.path}`,
      );
    }
    roleIds.set(role.key, artifact.id);
  }

  const pipelineIds = new Map();
  for (const pipeline of pipelines) {
    let artifact = artifacts.find((item) => item.path === pipeline.path);
    if (!artifact) {
      const created = await request(
        `/applications/${summary.id}/artifacts`,
        jsonRequest("POST", {
          kind: "pipeline",
          path: pipeline.path,
          title: pipeline.title,
          document: pipelineDocument(
            roleIds.get(pipeline.key),
            pipeline.fields,
          ),
        }),
      );
      artifact = created.artifact;
      artifacts.push(artifact);
    }
    if (artifact.kind !== "pipeline") {
      throw new Error(
        `Artifact path is occupied by the wrong kind: ${pipeline.path}`,
      );
    }
    pipelineIds.set(pipeline.key, artifact.id);
  }

  application = await request(`/applications/${summary.id}`);
  const requiredIds = artifacts.map((item) => item.id);
  const folders = [
    "roles/realtime",
    "roles/postgame",
    "pipelines/realtime",
    "pipelines/postgame",
  ];
  const nextArtifactIds = [
    ...application.draft.artifactIds,
    ...requiredIds.filter((id) => !application.draft.artifactIds.includes(id)),
  ];
  const nextFolders = [
    ...application.draft.folders,
    ...folders.filter((path) => !application.draft.folders.includes(path)),
  ].sort();
  if (
    nextArtifactIds.length !== application.draft.artifactIds.length ||
    nextFolders.length !== application.draft.folders.length
  ) {
    application = await request(
      `/applications/${summary.id}/draft`,
      jsonRequest("PUT", {
        expectedRevision: application.application.draftRevision,
        draft: {
          ...application.draft,
          artifactIds: nextArtifactIds,
          folders: nextFolders,
        },
      }),
    );
  }

  const releases = (await request(`/applications/${summary.id}/releases`))
    .releases;
  const requiredPaths = new Set(pipelines.map((item) => item.path));
  let release = releases.find((item) => {
    const paths = new Set(
      item.manifest.artifacts.map((artifact) => artifact.mountPath),
    );
    return [...requiredPaths].every((path) => paths.has(path));
  });
  if (!release) {
    release = await request(
      `/applications/${summary.id}/releases`,
      jsonRequest("POST", {
        expectedRevision: application.application.draftRevision,
        version: nextVersion(releases.map((item) => item.version)),
      }),
    );
  }

  const existingBindings = (
    await request(`/applications/${summary.id}/model-bindings`)
  ).bindings;
  const configuredBindings = [];
  const unboundPipelines = [];
  for (const pipeline of pipelines) {
    const modelTargetId = modelTargetFor(pipeline.key);
    const pipelineArtifactId = pipelineIds.get(pipeline.key);
    const modelRoleId = roleIds.get(pipeline.key);
    const existing = existingBindings.find(
      (item) =>
        item.pipelineArtifactId === pipelineArtifactId &&
        item.modelRoleId === modelRoleId,
    );
    if (!modelTargetId) {
      if (!existing) unboundPipelines.push(pipeline.path);
      continue;
    }
    if (existing?.modelTargetId === modelTargetId) {
      configuredBindings.push(existing);
      continue;
    }
    const saved = await request(
      `/applications/${summary.id}/pipelines/${pipelineArtifactId}/model-bindings/${modelRoleId}`,
      jsonRequest("PUT", {
        expectedRevision: existing?.revision ?? 0,
        modelTargetId,
      }),
    );
    configuredBindings.push(saved);
  }

  const releasedPipelines = release.manifest.artifacts
    .filter((item) => requiredPaths.has(item.mountPath))
    .map((item) => ({
      path: item.mountPath,
      artifactVersionId: item.artifactVersionId,
    }));
  console.log(
    JSON.stringify(
      {
        applicationId: summary.id,
        applicationSlug,
        releaseId: release.id,
        releaseVersion: release.version,
        pipelines: releasedPipelines,
        configuredBindings: configuredBindings.map((binding) => ({
          pipelineArtifactId: binding.pipelineArtifactId,
          modelRoleId: binding.modelRoleId,
          modelTargetId: binding.modelTargetId,
        })),
        unboundPipelines,
        next: unboundPipelines.length
          ? "Bind the remaining Pipeline Roles in Applications, or provide DICE_RUNTIME_MODEL_TARGET_* environment variables."
          : "The independent Dice Runtime is ready.",
      },
      null,
      2,
    ),
  );
}

function modelTargetFor(key) {
  const suffix = key.replace(/([a-z])([A-Z])/gu, "$1_$2").toUpperCase();
  return (
    process.env[`DICE_RUNTIME_MODEL_TARGET_${suffix}`] ??
    process.env.DICE_RUNTIME_MODEL_TARGET_DEFAULT ??
    null
  );
}

function nextVersion(versions) {
  let patch = 0;
  const existing = new Set(versions);
  while (existing.has(`0.1.${patch}`)) patch += 1;
  return `0.1.${patch}`;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
