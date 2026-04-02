// /api/script-v2.js
// Contract Freeze v1 — implementation
// Corrective pass after integration audit: Patch Contract v1 fixed exactly

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const STAGES = {
  SCENE_IDEAS: "scene_ideas",
  SELECTION: "selection",
  REFINEMENT: "refinement",
  ALIGNMENT: "alignment"
};

const EXECUTION_SURFACES = {
  ...STAGES,
  BUILD: "build"
};

const STATUSES = {
  OK: "ok",
  ERROR: "error",
  BLOCKED: "blocked"
};

const PATCH_POLICY = {
  [EXECUTION_SURFACES.SCENE_IDEAS]: false,
  [EXECUTION_SURFACES.SELECTION]: true,
  [EXECUTION_SURFACES.REFINEMENT]: true,
  [EXECUTION_SURFACES.ALIGNMENT]: false,
  [EXECUTION_SURFACES.BUILD]: false
};

const FORBIDDEN_ROUTE_KEYS = new Set([
  "next_stage",
  "go_to_alignment",
  "go_to_build",
  "ask_more_questions",
  "route_decision",
  "route",
  "advance",
  "advance_to_alignment",
  "advance_to_build",
  "ready_hint",
  "response_stage"
]);

// Patch Contract v1 — exact
const SELECTION_ALLOWED_PATCH_PATHS = new Set([
  "scene_core.seed_scene"
]);

const REFINEMENT_ALLOWED_PATCH_PATHS = new Set([
  "goal.video_topic",
  "goal.video_goal",
  "scene_core.seed_scene",
  "narrative.scene_setup",
  "narrative.scene_development",
  "visual_direction.emotion"
]);

const ALIGNMENT_ALLOWED_PATCH_PATHS = new Set([]);

const BUILD_BLOCK_CATALOG = Object.freeze([
  "preview",
  "video_overview",
  "visual_emotional_direction",
  "scene_description",
  "story_concept",
  "full_script",
  "scene_breakdown",
  "prompt",
  "production_notes",
  "director_notes",
  "characters",
  "dialogue",
  "voice_over",
  "camera_direction",
  "cta_strategy",
  "timing",
  "branching",
  "visual_style_extra",
  "image_prompt_variations",
  "video_prompt_variations"
]);

// ============================================================
// Public API
// ============================================================

module.exports = handleScriptV2Request;

// ============================================================
// HTTP shell
// ============================================================

async function handleScriptV2Request(req, res) {
  applyCors(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, buildErrorEnvelope({
      stage: null,
      code: "METHOD_NOT_ALLOWED",
      message: "Method not allowed"
    }));
  }

  try {
    const body = safeParseBody(req.body);
    const surfaceRequest = buildSurfaceRequest(body);
    const result = await executeSurface(surfaceRequest);

    return sendJson(res, 200, result);
  } catch (error) {
    return sendJson(res, 500, buildErrorEnvelope({
      stage: null,
      code: "SCRIPT_V2_FAILURE",
      message: error?.message || "script-v2 failed"
    }));
  }
}

// ============================================================
// Request contract
// ============================================================

function buildSurfaceRequest(body = {}) {
  return {
    stage: normalizeExecutionSurface(body.stage),
    language: normalizeLanguage(body.language),
    blueprint: ensureObject(body.blueprint),
    user_input: body.user_input ?? null,
    ui_context: ensureObject(body.ui_context),
    advanced_options: ensureObject(body.advanced_options),
    meta: ensureObject(body.meta)
  };
}

function normalizeExecutionSurface(value) {
  const stage = String(value || "").trim().toLowerCase();

  if (Object.values(EXECUTION_SURFACES).includes(stage)) {
    return stage;
  }

  throw new Error(`Unsupported execution surface: ${value}`);
}

function normalizeLanguage(value) {
  return String(value || "ru").trim().toLowerCase() === "en" ? "en" : "ru";
}

// ============================================================
// Core executor
// build is explicit surface, not normal stage-handling
// ============================================================

async function executeSurface(surfaceRequest) {
  const { stage } = surfaceRequest;

  if (stage === EXECUTION_SURFACES.BUILD) {
    return executeBuildSurface(surfaceRequest);
  }

  switch (stage) {
    case STAGES.SCENE_IDEAS:
      return executeSceneIdeas(surfaceRequest);
    case STAGES.SELECTION:
      return executeSelection(surfaceRequest);
    case STAGES.REFINEMENT:
      return executeRefinement(surfaceRequest);
    case STAGES.ALIGNMENT:
      return executeAlignment(surfaceRequest);
    default:
      return buildErrorEnvelope({
        stage,
        code: "UNSUPPORTED_STAGE",
        message: "Unsupported stage"
      });
  }
}

// ============================================================
// Normal stage handlers
// ============================================================

async function executeSceneIdeas(surfaceRequest) {
  assertSceneIdeasRequest(surfaceRequest);

  const modelInput = buildSceneIdeasInput(surfaceRequest);
  const modelRaw = await callModel(modelInput);
  const validated = validateSceneIdeasResponse(modelRaw);
  const normalized = normalizeSceneIdeasResponse(validated, surfaceRequest);

  return buildJsonEnvelope({
    stage: STAGES.SCENE_IDEAS,
    status: STATUSES.OK,
    output: normalized.output,
    meta: buildMeta(surfaceRequest, { patch_allowed: false }),
    blueprint_patch: null,
    error: null
  });
}

async function executeSelection(surfaceRequest) {
  assertSelectionRequest(surfaceRequest);

  const modelInput = buildSelectionInput(surfaceRequest);
  const modelRaw = await callModel(modelInput);
  const validated = validateSelectionResponse(modelRaw);
  const normalized = normalizeSelectionResponse(validated, surfaceRequest);

  return buildJsonEnvelope({
    stage: STAGES.SELECTION,
    status: STATUSES.OK,
    output: normalized.output,
    meta: buildMeta(surfaceRequest, { patch_allowed: true }),
    blueprint_patch: normalized.blueprint_patch,
    error: null
  });
}

async function executeRefinement(surfaceRequest) {
  assertRefinementRequest(surfaceRequest);

  const modelInput = buildRefinementInput(surfaceRequest);
  const modelRaw = await callModel(modelInput);
  const validated = validateRefinementResponse(modelRaw, surfaceRequest.language);
  const normalized = normalizeRefinementResponse(validated);

  return buildJsonEnvelope({
    stage: STAGES.REFINEMENT,
    status: STATUSES.OK,
    output: normalized.output,
    meta: buildMeta(surfaceRequest, { patch_allowed: true }),
    blueprint_patch: normalized.blueprint_patch,
    error: null
  });
}

async function executeAlignment(surfaceRequest) {
  assertAlignmentRequest(surfaceRequest);

  const modelInput = buildAlignmentInput(surfaceRequest);
  const modelRaw = await callModel(modelInput);
  const validated = validateAlignmentResponse(modelRaw);
  const normalized = normalizeAlignmentResponse(validated);

  return buildJsonEnvelope({
    stage: STAGES.ALIGNMENT,
    status: STATUSES.OK,
    output: normalized.output,
    meta: buildMeta(surfaceRequest, { patch_allowed: false }),
    blueprint_patch: null,
    error: null
  });
}

// ============================================================
// Build execution surface
// ============================================================

async function executeBuildSurface(surfaceRequest) {
  assertBuildRequest(surfaceRequest);

  const modelInput = buildBuildInput(surfaceRequest);
  const modelRaw = await callModel(modelInput);
  const validated = validateBuildResponse(modelRaw);
  const normalized = normalizeBuildResponse(validated);

  return buildJsonEnvelope({
    stage: EXECUTION_SURFACES.BUILD,
    status: STATUSES.OK,
    output: normalized.output,
    meta: buildMeta(surfaceRequest, { patch_allowed: false }),
    blueprint_patch: null,
    error: null
  });
}

// ============================================================
// Input assertions
// no readiness logic, only surface-level input sanity
// ============================================================

function assertSceneIdeasRequest(surfaceRequest) {
  if (!surfaceRequest.blueprint?.meta?.video_type) {
    throw new Error("Missing blueprint.meta.video_type for scene_ideas");
  }
  if (!surfaceRequest.blueprint?.meta?.scriptwriter_role) {
    throw new Error("Missing blueprint.meta.scriptwriter_role for scene_ideas");
  }
  if (!surfaceRequest.blueprint?.goal?.video_topic) {
    throw new Error("Missing blueprint.goal.video_topic for scene_ideas");
  }
}

function assertSelectionRequest(surfaceRequest) {
  const selectedScene = extractSelectedScene(surfaceRequest.user_input);
  if (!selectedScene) {
    throw new Error("Missing selected scene for selection");
  }
}

function assertRefinementRequest(surfaceRequest) {
  if (!surfaceRequest.user_input) {
    throw new Error("Missing user_input for refinement");
  }
}

function assertAlignmentRequest(surfaceRequest) {
  if (!surfaceRequest.blueprint || typeof surfaceRequest.blueprint !== "object") {
    throw new Error("Missing blueprint for alignment");
  }
}

function assertBuildRequest(surfaceRequest) {
  if (!surfaceRequest.blueprint || typeof surfaceRequest.blueprint !== "object") {
    throw new Error("Missing blueprint for build");
  }
}

// ============================================================
// Stage-specific input building
// ============================================================

function buildSceneIdeasInput(surfaceRequest) {
  const lang = surfaceRequest.language;

  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text:
            `${getLanguageInstruction(lang)}\n` +
            (lang === "en"
              ? [
                  "You work only for the current stage: scene_ideas.",
                  "Return JSON only.",
                  "Do not return route decisions.",
                  "Generate exactly 3 scene ideas.",
                  "Each idea must contain: slot, title, seed_scene, why_it_fits.",
                  "Allowed slots: precise, variation, creative.",
                  "Do not return blueprint patch.",
                  "No markdown."
                ].join("\n")
              : [
                  "Ты работаешь только для текущего этапа: scene_ideas.",
                  "Верни только JSON.",
                  "Не возвращай route decisions.",
                  "Сгенерируй ровно 3 идеи сцены.",
                  "Каждая идея должна содержать: slot, title, seed_scene, why_it_fits.",
                  "Допустимые slot: precise, variation, creative.",
                  "Не возвращай blueprint patch.",
                  "Без markdown."
                ].join("\n"))
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text:
            `Blueprint:\n${compact(surfaceRequest.blueprint)}\n\n` +
            `UI context:\n${compact(surfaceRequest.ui_context)}\n\n` +
            `Advanced options:\n${compact(surfaceRequest.advanced_options)}`
        }
      ]
    }
  ];
}

function buildSelectionInput(surfaceRequest) {
  const lang = surfaceRequest.language;
  const selectedScene = extractSelectedScene(surfaceRequest.user_input);

  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text:
            `${getLanguageInstruction(lang)}
` +
            (lang === "en"
              ? [
                  "You work only for the current stage: selection.",
                  "Selection is not route ownership.",
                  "Return JSON only.",
                  "No route decisions.",
                  "Required response shape:",
                  '{ "message": "short current-stage message", "patch": { ...optional } }',
                  "message must be a non-empty string.",
                  "patch is optional and must be an object if present.",
                  "Allowed patch path only:",
                  "- scene_core.seed_scene",
                  "Do not return any other blueprint patch fields.",
                  "No markdown."
                ].join("\n")
              : [
                  "Ты работаешь только для текущего этапа: selection.",
                  "Selection не даёт ownership над маршрутом.",
                  "Верни только JSON.",
                  "Без route decisions.",
                  "Обязательная форма ответа:",
                  '{ "message": "короткое сообщение текущего этапа", "patch": { ...optional } }',
                  "message — обязательная непустая строка.",
                  "patch — опциональный объект, если он присутствует.",
                  "Разрешённый patch path только:",
                  "- scene_core.seed_scene",
                  "Не возвращай никакие другие blueprint patch fields.",
                  "Без markdown."
                ].join("\n"))
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text:
            `Blueprint:
${compact(surfaceRequest.blueprint)}

` +
            `Selected scene content:
${selectedScene}

` +
            `User input:
${compact(surfaceRequest.user_input)}

` +
            `Advanced options:
${compact(surfaceRequest.advanced_options)}`
        }
      ]
    }
  ];
}
function buildRefinementInput(surfaceRequest) {
  const lang = surfaceRequest.language;

  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text:
            `${getLanguageInstruction(lang)}\n` +
            (lang === "en"
              ? [
                  "You work only for the current stage: refinement.",
                  "Return JSON only.",
                  "No route decisions.",
                  "No readiness logic.",
                  "Return only current-stage output.",
                  "Output fields: message, questions, patch.",
                  'Required JSON shape: { "message": "short current-stage message", "questions": [], "patch": {} }',
                  "message must always be present as a non-empty string.",
                  "Questions must be short, concrete and current-stage only.",
                  "Allowed patch paths only:",
                  "- goal.video_topic",
                  "- goal.video_goal",
                  "- scene_core.seed_scene",
                  "- narrative.scene_setup",
                  "- narrative.scene_development",
                  "- visual_direction.emotion",
                  "Do not return any other blueprint patch paths.",
                  "Do not return conditional sections.",
                  "No markdown."
                ].join("\n")
              : [
                  "Ты работаешь только для текущего этапа: refinement.",
                  "Верни только JSON.",
                  "Без route decisions.",
                  "Без readiness logic.",
                  "Верни только output текущего этапа.",
                  "Поля output: message, questions, patch.",
                  'Обязательная JSON-форма: { "message": "короткое сообщение текущего этапа", "questions": [], "patch": {} }',
                  "message должен присутствовать всегда и быть непустой строкой.",
                  "Вопросы должны быть короткими, конкретными и только по текущему этапу.",
                  "Разрешённые patch paths только:",
                  "- goal.video_topic",
                  "- goal.video_goal",
                  "- scene_core.seed_scene",
                  "- narrative.scene_setup",
                  "- narrative.scene_development",
                  "- visual_direction.emotion",
                  "Не возвращай никакие другие blueprint patch paths.",
                  "Не возвращай conditional sections.",
                  "Без markdown."
                ].join("\n"))
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text:
            `Blueprint:\n${compact(surfaceRequest.blueprint)}\n\n` +
            `User input:\n${compact(surfaceRequest.user_input)}\n\n` +
            `Advanced options:\n${compact(surfaceRequest.advanced_options)}`
        }
      ]
    }
  ];
}

function buildAlignmentInput(surfaceRequest) {
  const lang = surfaceRequest.language;

  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text:
            `${getLanguageInstruction(lang)}\n` +
            (lang === "en"
              ? [
                  "You work only for the current stage: alignment.",
                  "Return JSON only.",
                  "No route decisions.",
                  "No build admission.",
                  "Return a short alignment-supporting message.",
                  "Do not return blueprint patch.",
                  "Do not open new branches.",
                  "Do not ask broad new questions.",
                  "No markdown."
                ].join("\n")
              : [
                  "Ты работаешь только для текущего этапа: alignment.",
                  "Верни только JSON.",
                  "Без route decisions.",
                  "Без build admission.",
                  "Верни короткое alignment-supporting сообщение.",
                  "Не возвращай blueprint patch.",
                  "Не открывай новые ветки.",
                  "Не задавай широких новых вопросов.",
                  "Без markdown."
                ].join("\n"))
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text:
            `Blueprint:\n${compact(surfaceRequest.blueprint)}\n\n` +
            `User input:\n${compact(surfaceRequest.user_input)}\n\n` +
            `Advanced options:\n${compact(surfaceRequest.advanced_options)}`
        }
      ]
    }
  ];
}

function buildBuildInput(surfaceRequest) {
  const lang = surfaceRequest.language;
  const resultSchema = safeResultSchemaSnapshot(surfaceRequest?.meta?.result_schema);
  const schemaPrompt = buildBuildSchemaPrompt(resultSchema, lang);

  return [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text:
            `${getLanguageInstruction(lang)}\n` +
            (lang === "en"
              ? [
                  "You work only for the explicit build surface.",
                  "Build is a user action, not a normal stage.",
                  "Return JSON only.",
                  "No route decisions.",
                  "No questions.",
                  "No blueprint patch.",
                  "Return only the current build output as structured blocks.",
                  "Use result_schema as a hard pre-generation constraint.",
                  "Generate only the allowed blocks from result_schema.blocks.",
                  "Do not generate any forbidden blocks.",
                  "Preserve the block order from result_schema.blocks.",
                  "No markdown."
                ].join("\n")
              : [
                  "Ты работаешь только для explicit build surface.",
                  "Build — это действие пользователя, а не normal stage.",
                  "Верни только JSON.",
                  "Без route decisions.",
                  "Без questions.",
                  "Без blueprint patch.",
                  "Верни только текущий build output как structured blocks.",
                  "Используй result_schema как жёсткое pre-generation ограничение.",
                  "Генерируй только разрешённые блоки из result_schema.blocks.",
                  "Не генерируй запрещённые блоки.",
                  "Сохраняй порядок блоков из result_schema.blocks.",
                  "Без markdown."
                ].join("\n")) +
            `\n\n${schemaPrompt}`
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text:
            `Blueprint:\n${compact(surfaceRequest.blueprint)}\n\n` +
            `Advanced options:\n${compact(surfaceRequest.advanced_options)}\n\n` +
            `Result schema:\n${compact(resultSchema)}`
        }
      ]
    }
  ];
}

// ============================================================
// Model call
// ============================================================

async function callModel(modelInput) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }

  const response = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      input: modelInput,
      text: {
        format: {
          type: "json_object"
        }
      },
      max_output_tokens: 1400
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "OpenAI request failed");
  }

  const data = await response.json();
  const rawText =
    data.output_text ||
    (Array.isArray(data.output)
      ? data.output
          .flatMap((item) => item.content || [])
          .filter((item) => item.type === "output_text" && item.text)
          .map((item) => item.text)
          .join("\n")
      : "");

  if (!rawText) {
    throw new Error("Empty OpenAI response");
  }

  let parsedJson;
  try {
    parsedJson = JSON.parse(rawText);
  } catch (_) {
    throw new Error("Invalid JSON from model");
  }

  return {
    raw_text: rawText,
    parsed_json: parsedJson
  };
}

// ============================================================
// Response validation
// ============================================================

function validateSceneIdeasResponse(modelRaw) {
  const data = validateBaseModelObject(modelRaw, STAGES.SCENE_IDEAS);

  if (!Array.isArray(data.ideas)) {
    throw new Error("scene_ideas model response must contain ideas array");
  }

  return data;
}

function validateSelectionResponse(modelRaw) {
  const data = validateBaseModelObject(modelRaw, STAGES.SELECTION);

  if (typeof data.message !== "string" || !data.message.trim()) {
    throw new Error("selection model response must contain message");
  }

  if (data.patch != null && !isPlainObject(data.patch)) {
    throw new Error("selection patch must be an object");
  }

  return data;
}

function validateRefinementResponse(modelRaw, language = "ru") {
  const data = validateBaseModelObject(modelRaw, STAGES.REFINEMENT);

  if (data.questions != null && !Array.isArray(data.questions)) {
    throw new Error("refinement questions must be an array");
  }

  if (data.patch != null && !isPlainObject(data.patch)) {
    throw new Error("refinement patch must be an object");
  }

  if (typeof data.message !== "string" || !data.message.trim()) {
    const hasQuestions = Array.isArray(data.questions)
      && data.questions.some((item) => !!safeTrim(item));
    const hasPatch = isPlainObject(data.patch)
      && Object.keys(data.patch).length > 0;

    if (hasQuestions || hasPatch) {
      data.message = language === "en"
        ? "Got it. I’ll refine the next step from your input."
        : "Принято. Я уточняю следующий шаг по твоему вводу.";
    } else {
      throw new Error("refinement model response must contain message");
    }
  }

  return data;
}

function validateAlignmentResponse(modelRaw) {
  const data = validateBaseModelObject(modelRaw, STAGES.ALIGNMENT);

  if (typeof data.message !== "string" || !data.message.trim()) {
    throw new Error("alignment model response must contain message");
  }

  if (data.questions != null && !Array.isArray(data.questions)) {
    throw new Error("alignment questions must be an array");
  }

  if (data.patch != null && !isPlainObject(data.patch)) {
    throw new Error("alignment patch must be an object");
  }

  return data;
}

function validateBuildResponse(modelRaw) {
  const data = validateBaseModelObject(modelRaw, EXECUTION_SURFACES.BUILD);

  if (!isPlainObject(data.blocks)) {
    throw new Error("build model response must contain blocks object");
  }

  return data;
}

function validateBaseModelObject(modelRaw, expectedSurface) {
  const data = modelRaw?.parsed_json;

  if (!isPlainObject(data)) {
    throw new Error(`${expectedSurface} model response must be a JSON object`);
  }

  rejectForbiddenRouteKeys(data);

  return data;
}

// ============================================================
// Response normalization
// ============================================================

function normalizeSceneIdeasResponse(validated, surfaceRequest) {
  const ideas = validated.ideas
    .map(normalizeSceneIdea)
    .filter(Boolean)
    .slice(0, 3);

  const bySlot = enforceSceneIdeaSlots(ideas, surfaceRequest.language);

  return {
    output: {
      ideas: bySlot
    }
  };
}

function normalizeSelectionResponse(validated, surfaceRequest) {
  const selectedScene = extractSelectedScene(surfaceRequest.user_input);

  return {
    output: {
      message: safeTrim(validated.message),
      questions: []
    },
    blueprint_patch: selectedScene
      ? { "scene_core.seed_scene": selectedScene }
      : {}
  };
}

function normalizeRefinementResponse(validated) {
  const patch = sanitizePatchByPolicy(validated.patch, EXECUTION_SURFACES.REFINEMENT);

  return {
    output: {
      message: safeTrim(validated.message),
      questions: normalizeQuestions(validated.questions)
    },
    blueprint_patch: patch
  };
}

function normalizeAlignmentResponse(validated) {
  return {
    output: {
      message: safeTrim(validated.message),
      questions: normalizeQuestions(validated.questions)
    },
    blueprint_patch: null
  };
}

function normalizeBuildResponse(validated) {
  return {
    output: {
      blocks: normalizeBlocks(validated.blocks)
    }
  };
}

// ============================================================
// JSON envelope builder
// ============================================================

function buildJsonEnvelope({
  stage,
  status,
  output,
  meta,
  blueprint_patch = null,
  error = null
}) {
  return {
    stage,
    status,
    output,
    meta,
    blueprint_patch,
    error
  };
}

function buildErrorEnvelope({ stage, code, message }) {
  return buildJsonEnvelope({
    stage,
    status: STATUSES.ERROR,
    output: null,
    meta: {
      route_decisions_returned: false
    },
    blueprint_patch: null,
    error: {
      code,
      message
    }
  });
}

function buildMeta(surfaceRequest, extras = {}) {
  return {
    language: surfaceRequest?.language || "ru",
    patch_policy: PATCH_POLICY[surfaceRequest?.stage] || false,
    route_decisions_returned: false,
    model: MODEL,
    ...extras
  };
}

// ============================================================
// Patch discipline
// ============================================================

function sanitizePatchByPolicy(rawPatch, surface) {
  if (!isPlainObject(rawPatch)) {
    return {};
  }

  rejectForbiddenRouteKeys(rawPatch);

  const flatPatch = flattenPatchObject(rawPatch);
  const sanitized = {};

  for (const [path, value] of Object.entries(flatPatch)) {
    if (!isAllowedPatchPath(path, surface)) continue;
    if (isForbiddenSystemPath(path)) continue;
    sanitized[path] = sanitizePatchValue(value);
  }

  return sanitized;
}

function isAllowedPatchPath(path, surface) {
  if (surface === EXECUTION_SURFACES.SELECTION) {
    return SELECTION_ALLOWED_PATCH_PATHS.has(path);
  }

  if (surface === EXECUTION_SURFACES.REFINEMENT) {
    return REFINEMENT_ALLOWED_PATCH_PATHS.has(path);
  }

  if (surface === EXECUTION_SURFACES.ALIGNMENT) {
    return ALIGNMENT_ALLOWED_PATCH_PATHS.has(path);
  }

  return false;
}

function isForbiddenSystemPath(path) {
  return (
    path.startsWith("system_state.") ||
    path === "meta" ||
    path === "system_state" ||
    path.startsWith("meta.") ||
    path === "ready_for_final_assembly" ||
    path === "required_inputs_complete" ||
    path === "minimum_usable_readiness" ||
    path.startsWith("extensions.") ||
    path.startsWith("participants.") ||
    path.startsWith("environment.") ||
    path.startsWith("technical_layer.") ||
    path.startsWith("marketing_layer.")
  );
}

function sanitizePatchValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : item))
      .filter((item) => item !== "" && item != null);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return value;
}

// ============================================================
// Helpers for ideas / questions / blocks / selection
// ============================================================

function normalizeSceneIdea(item) {
  if (!isPlainObject(item)) return null;

  const slot = normalizeSceneIdeaSlot(item.slot);
  const title = safeTrim(item.title);
  const seedScene = safeTrim(item.seed_scene);
  const whyItFits = safeTrim(item.why_it_fits);

  if (!slot || !title || !seedScene) return null;

  return {
    slot,
    title,
    seed_scene: seedScene,
    why_it_fits: whyItFits
  };
}

function normalizeSceneIdeaSlot(value) {
  const slot = String(value || "").trim().toLowerCase();
  if (slot === "precise" || slot === "variation" || slot === "creative") {
    return slot;
  }
  return null;
}

function enforceSceneIdeaSlots(ideas, language) {
  const map = new Map();
  for (const idea of ideas) {
    if (!map.has(idea.slot)) {
      map.set(idea.slot, idea);
    }
  }

  const requiredSlots = ["precise", "variation", "creative"];
  return requiredSlots.map((slot) => {
    if (map.has(slot)) return map.get(slot);

    return {
      slot,
      title: fallbackSceneIdeaTitle(slot, language),
      seed_scene: "",
      why_it_fits: ""
    };
  });
}

function fallbackSceneIdeaTitle(slot, language) {
  const titles = language === "en"
    ? {
        precise: "Precise direction",
        variation: "Variation",
        creative: "Creative interpretation"
      }
    : {
        precise: "Точное направление",
        variation: "Вариация",
        creative: "Креативная трактовка"
      };

  return titles[slot] || slot;
}

function normalizeQuestions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => safeTrim(item))
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeBlocks(blocks) {
  const next = {};
  for (const [key, value] of Object.entries(ensureObject(blocks))) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    next[key] = trimmed;
  }
  return next;
}

function extractSelectedScene(userInput) {
  if (!isPlainObject(userInput)) {
    return "";
  }

  if (typeof userInput.seed_scene !== "string") {
    return "";
  }

  return userInput.seed_scene.trim();
}

function buildBuildSchemaPrompt(resultSchema, language) {
  const allowedBlocks = Array.isArray(resultSchema.blocks)
    ? resultSchema.blocks
    : [];
  const forbiddenBlocks = BUILD_BLOCK_CATALOG.filter(
    (block) => !allowedBlocks.includes(block)
  );
  const compositionLines = allowedBlocks.map((block, index) => {
    const budget = resultSchema.block_character_budget[block];
    if (typeof budget === "number" && budget > 0) {
      return `${index + 1}. ${block} — target_char_budget=${budget}`;
    }
    return `${index + 1}. ${block}`;
  });

  if (language === "en") {
    return [
      "Build schema contract:",
      `- version: ${resultSchema.version}`,
      `- plan_tier: ${resultSchema.plan_tier}`,
      `- video_type: ${resultSchema.video_type}`,
      `- density_mode: ${resultSchema.density_mode}`,
      `- text_budget_total: ${resultSchema.text_budget_total}`,
      `- allowed_blocks: ${allowedBlocks.join(", ") || "none"}`,
      `- forbidden_blocks: ${forbiddenBlocks.join(", ") || "none"}`,
      "- expected_result_composition:",
      ...compositionLines,
      "- Return blocks only under output.blocks.",
      "- Do not add blocks outside allowed_blocks.",
      "- If a block is not allowed, omit it completely."
    ].join("\n");
  }

  return [
    "Контракт build schema:",
    `- version: ${resultSchema.version}`,
    `- plan_tier: ${resultSchema.plan_tier}`,
    `- video_type: ${resultSchema.video_type}`,
    `- density_mode: ${resultSchema.density_mode}`,
    `- text_budget_total: ${resultSchema.text_budget_total}`,
    `- allowed_blocks: ${allowedBlocks.join(", ") || "none"}`,
    `- forbidden_blocks: ${forbiddenBlocks.join(", ") || "none"}`,
    "- expected_result_composition:",
    ...compositionLines,
    "- Возвращай блоки только внутри output.blocks.",
    "- Не добавляй блоки вне allowed_blocks.",
    "- Если блок не разрешён, полностью пропусти его."
  ].join("\n");
}

// ============================================================
// Validation guards against route behavior
// ============================================================

function rejectForbiddenRouteKeys(obj) {
  const paths = collectObjectPaths(obj);

  for (const path of paths) {
    const last = path.split(".").pop();
    if (FORBIDDEN_ROUTE_KEYS.has(last)) {
      throw new Error(`Forbidden route key returned by model: ${path}`);
    }
  }
}

function collectObjectPaths(obj, prefix = "") {
  if (!isPlainObject(obj) && !Array.isArray(obj)) return [];
  const paths = [];

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i += 1) {
      const nextPrefix = prefix ? `${prefix}.${i}` : String(i);
      paths.push(nextPrefix);
      paths.push(...collectObjectPaths(obj[i], nextPrefix));
    }
    return paths;
  }

  for (const [key, value] of Object.entries(obj)) {
    const nextPrefix = prefix ? `${prefix}.${key}` : key;
    paths.push(nextPrefix);
    paths.push(...collectObjectPaths(value, nextPrefix));
  }

  return paths;
}

// ============================================================
// Low-level utils
// ============================================================

function safeParseBody(body) {
  if (!body) return {};

  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch (_) {
      return {};
    }
  }

  return body;
}

function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function sendJson(res, code, payload) {
  return res.status(code).json(payload);
}

function getLanguageInstruction(language) {
  return language === "en"
    ? "Respond only in English."
    : "Отвечай только на русском языке.";
}

function compact(value) {
  return JSON.stringify(value ?? {}, null, 2);
}

function safeTrim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function ensureObject(value) {
  return isPlainObject(value) ? value : {};
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function flattenPatchObject(obj, prefix = "") {
  const result = {};

  for (const [key, value] of Object.entries(ensureObject(obj))) {
    const nextPath = prefix ? `${prefix}.${key}` : key;

    if (isPlainObject(value)) {
      Object.assign(result, flattenPatchObject(value, nextPath));
    } else {
      result[nextPath] = value;
    }
  }

  return result;
}
