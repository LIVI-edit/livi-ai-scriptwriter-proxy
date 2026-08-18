// /api/script-v2.js
// Contract Freeze v1 — implementation
// Corrective pass after integration audit: Patch Contract v1 fixed exactly

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const BUILD_DIAGNOSTIC_PREVIEW_LIMIT = 600;

const EXECUTION_SURFACES = Object.freeze({
  // Technical request surfaces. These are not Blueprint product stages.
  SCENE_IDEAS: "scene_ideas",
  SELECTION: "selection",
  DEVELOPMENT: "development",
  REFINEMENT: "refinement",
  ALIGNMENT: "alignment",
  BUILD: "build"
});

const STATUSES = {
  OK: "ok",
  ERROR: "error",
  BLOCKED: "blocked"
};

const PATCH_POLICY = {
  [EXECUTION_SURFACES.SCENE_IDEAS]: false,
  [EXECUTION_SURFACES.SELECTION]: true,
  [EXECUTION_SURFACES.DEVELOPMENT]: true,
  [EXECUTION_SURFACES.REFINEMENT]: true,
  [EXECUTION_SURFACES.ALIGNMENT]: false,
  [EXECUTION_SURFACES.BUILD]: false
};

const FORBIDDEN_ROUTE_KEYS = new Set([
  "next_stage",
  "route",
  "route_decision",
  "go_to_alignment",
  "go_to_build",
  "build_now",
  "move_next",
  "finish",
  "ready_hint",
  "response_stage",
  "ready_for_final_assembly",
  "semantic_readiness",
  "readiness_reason",
  "system_state",
  "interaction_state",
  "refinement_state",
  "current_stage",
  "open_anchor",
  "active_anchor",
  "open_question",
  "pending_options",
  "build_status",
  "billing",
  "plan",
  "paywall",
  "entitlement",
  "final_result",
  "result_schema",
  "meta.result_schema",
  "advance",
  "advance_to_alignment",
  "advance_to_build",
  "build_allowed",
  "can_build"
]);

const REFINEMENT_INTENT_LABELS = new Set([
  "brief_or_context",
  "option_selection",
  "actionable_change",
  "unclear_dissatisfaction",
  "ready_to_continue",
  "wants_more_options",
  "asks_question",
  "hold_or_not_ready",
  "alternative_request",
  "new_cycle_request",
  "off_topic_or_unclear"
]);

const REFINEMENT_ALLOWED_ANCHORS = new Set([
  "scene_core",
  "hero_focus",
  "conflict",
  "visual_tone",
  "tempo_pacing",
  "ending_payoff",
  "cta_offer",
  "audience_value",
  "format_platform",
  "generation_prompt",
  "structure",
  "unknown"
]);

const REFINEMENT_OPTION_MODES = new Set(["blocking", "suggestive"]);
const REFINEMENT_QUESTION_KEYS = new Set(["id", "text", "target_anchor", "reason"]);
const REFINEMENT_OPTION_KEYS = new Set([
  "id",
  "label",
  "description",
  "target_anchor",
  "effect",
  "mode",
  "recommended"
]);
const REFINEMENT_MODEL_TOP_LEVEL_KEYS = new Set([
  "message",
  "user_intent_label",
  "anchor_hint",
  "questions",
  "options",
  "blueprint_patch",
  "selected_option_id",
  // V1-only provider fields are recognized only so they can be rejected/traced cleanly.
  "patch",
  "meta"
]);

// Patch Contract v1 — exact
const SELECTION_ALLOWED_PATCH_PATHS = new Set([
  "scene_core.seed_scene"
]);

const DEVELOPMENT_ALLOWED_PATCH_PATHS = new Set([
  "scene_core.main_focus",
  "narrative.scene_setup",
  "narrative.scene_development"
]);

const REFINEMENT_ALLOWED_PATCH_PATHS = new Set([
  "scene_core.main_focus",
  "narrative.scene_setup",
  "narrative.scene_development",
  "visual_direction.emotion"
]);

const ALIGNMENT_ALLOWED_PATCH_PATHS = new Set([]);

// Package 6A narrow repair: normal-stage Proxy input is canonical-only.
// Legacy migration remains exclusively at the Blueprint/UI restore ingress.
// The behavior maps below also provide the canonical field allowlists.
const ROLE_LENSES = Object.freeze({
  creative_director: "concept, atmosphere, meaning and creative unity",
  commercial_strategist: "audience value, retention, offer and CTA logic",
  cinematographer: "frame, light, optics, composition and visual depth",
  film_director: "action, staging, pace, mise-en-scene and dramatic rhythm"
});

const TYPE_LENSES = Object.freeze({
  video: "clear scene, action development and usable video structure",
  promo: "pain, value, offer, viewer action and commercial logic",
  interactive: "choice, consequence, viewer role and branching-ready setup",
  video_prompt: "motion, camera, in-frame action and generation-ready detail",
  image_prompt: "one strong frame, subject, composition, light and style"
});

const GOAL_LENSES = Object.freeze({
  product_service: "show product or service value and viewer action",
  brand_video: "build brand image, trust and distinctive character",
  promotion_ad: "strengthen retention, offer, conversion and CTA logic",
  presentation_pitch: "clarify the idea, argument, persuasion and delivery",
  social_media: "increase hook, tempo, attention and retention",
  education_explainer: "make the sequence clear, useful and easy to learn",
  story_narrative: "develop conflict, choice, transformation and emotional arc",
  creative_concept: "protect originality, atmosphere and symbolic idea"
});

const EMOTION_LENSES = Object.freeze({
  epic: "scale, high dramatic weight and elevated stakes",
  inspiring: "hope, growth and forward movement",
  technological: "digital clarity, innovation and modernity",
  mysterious: "hidden meaning, tension and controlled uncertainty",
  calm: "soft tempo, clarity and restraint",
  energetic: "speed, impulse and dynamic escalation",
  minimalist: "clean, simple and precise expression",
  dreamlike: "surreal, soft and symbolic perception",
  neutral: "neutral tone without extra emotional pressure"
});

const SCENE_ACTION_LENSES = Object.freeze({
  reveal: "build toward discovery or changed understanding",
  journey: "show progression through stages",
  transformation: "show a change of state, identity, perception or system",
  interaction: "center the scene on exchange or response",
  presentation: "structure the scene around demonstration and clarity",
  discovery: "focus on finding, research, insight or evidence",
  choice: "make decision and consequence central",
  system_awakening: "show a hidden mechanism, technology or system becoming active"
});

const ADVANCED_MODULE_LENSES = Object.freeze({
  characters: "character intent",
  voice_over: "voice-over intent",
  camera_details: "camera-planning intent",
  video_prompt: "video-prompt intent",
  branching: "branching intent",
  cta_strategy: "CTA strategy intent",
  image_prompt: "image-prompt intent",
  dialogue: "dialogue intent"
});
const CANONICAL_ADVANCED_MODULE_KEYS = new Set([
  ...Object.keys(ADVANCED_MODULE_LENSES),
  "timing",
  "visual_style_extra"
]);
const PRE_BUILD_BEHAVIOR_MODULE_KEYS = Object.freeze([
  "characters",
  "dialogue",
  "voice_over",
  "camera_details",
  "branching",
  "image_prompt",
  "video_prompt",
  "cta_strategy"
]);

const ADVANCED_SCENE_IDEAS_DIRECTIVES = Object.freeze({
  characters: "Give the first 3 ideas a clear character function or point of view without inventing character data.",
  dialogue: "Let dialogue potential shape the first 3 ideas where natural, without opening a question or writing full dialogue.",
  voice_over: "Let voice-over potential shape the idea framing where useful, without generating a voice-over block.",
  camera_details: "Make camera intent materially visible in the idea premise without creating technical module data.",
  branching: "Make choice and consequence visible in the first 3 ideas so the premise is branching-ready before Build.",
  image_prompt: "Keep a strong frame/prompt-ready visual anchor inside each idea without changing the video type.",
  video_prompt: "Keep motion, camera and generation-ready visual continuity visible inside each idea without changing the video type.",
  cta_strategy: "Let viewer action and CTA logic influence the idea premise where appropriate without creating a result block."
});

const ADVANCED_DEVELOPMENT_DIRECTIVES = Object.freeze({
  characters: "Develop character motivation and function inside the selected scene without writing extension data.",
  dialogue: "Develop where dialogue would carry action or meaning without creating a dialogue block or new question.",
  voice_over: "Develop where voice-over would clarify the scene without generating the final voice-over.",
  camera_details: "Develop camera movement, framing and visual reveal as scene intent without technical module payload.",
  branching: "Develop the selected scene with a clear decision point and consequence while preserving the existing route.",
  image_prompt: "Develop a strong image-ready visual anchor without changing the selected result type.",
  video_prompt: "Develop visible motion and generation-ready continuity without creating a separate route.",
  cta_strategy: "Develop viewer action and CTA logic where relevant without creating a mandatory question."
});

const ADVANCED_REFINEMENT_DIRECTIVES = Object.freeze({
  characters: "Within the already open anchor, improve options/questions through character motivation and function.",
  dialogue: "Within the already open anchor, improve options/questions through dialogue purpose and exchange.",
  voice_over: "Within the already open anchor, improve options/questions through voice-over purpose.",
  camera_details: "Within the already open anchor, improve options/questions through camera and composition intent.",
  branching: "Within the already open anchor, improve options/questions through choice and consequence.",
  image_prompt: "Within the already open anchor, improve options/questions through image-ready visual specificity.",
  video_prompt: "Within the already open anchor, improve options/questions through motion and generation-ready continuity.",
  cta_strategy: "Within the already open anchor, improve options/questions through viewer action and CTA clarity."
});

const ADVANCED_ALIGNMENT_DIRECTIVES = Object.freeze({
  characters: "Acknowledge the agreed character function without promising a separate unavailable block.",
  dialogue: "Acknowledge dialogue intent without promising a separate unavailable block.",
  voice_over: "Acknowledge voice-over intent without promising a separate unavailable block.",
  camera_details: "Acknowledge camera intent without promising a separate unavailable block.",
  branching: "Acknowledge the choice/consequence direction without claiming route or Build authority.",
  image_prompt: "Acknowledge the image-prompt intent without changing the selected result type.",
  video_prompt: "Acknowledge the video-prompt intent without changing the selected result type.",
  cta_strategy: "Acknowledge the viewer-action/CTA direction without promising an unavailable block."
});

const ROLE_DEVELOPMENT_DIRECTIVES = Object.freeze({
  creative_director: "Develop the scene through concept, atmosphere, meaning and creative unity.",
  commercial_strategist: "Develop the scene through audience value, retention, offer logic and a clear viewer action.",
  cinematographer: "Develop the scene through frame, light, optics, composition and visual depth.",
  film_director: "Develop the scene through staged action, tempo, mise-en-scene and dramatic rhythm."
});

const TYPE_DEVELOPMENT_DIRECTIVES = Object.freeze({
  video: "Make the scene clear, actionable and usable as a video sequence.",
  promo: "Structure the development around pain, value shift, offer logic and CTA-ready viewer action.",
  interactive: "Make choice, consequence, viewer role and branching-ready tension central without changing the route.",
  video_prompt: "Emphasize visible motion, camera logic, in-frame action and generation-ready continuity.",
  image_prompt: "Concentrate the development into one strong frame with subject, composition, light and style."
});

const GOAL_DEVELOPMENT_DIRECTIVES = Object.freeze({
  product_service: "Show why the product or service matters through concrete use and viewer action.",
  brand_video: "Build trust and brand character through the situation, not abstract claims.",
  promotion_ad: "Strengthen hook, retention, offer and conversion logic inside the scene.",
  presentation_pitch: "Make the idea understandable, persuasive and clearly structured.",
  social_media: "Protect attention with a strong hook, fast readability and visible progression.",
  education_explainer: "Make the development sequential, clear and useful for learning.",
  story_narrative: "Build conflict, choice, transformation and emotional arc through cause and effect.",
  creative_concept: "Keep originality, atmosphere and symbolic meaning connected to concrete action."
});

const EMOTION_DEVELOPMENT_DIRECTIVES = Object.freeze({
  epic: "Use scale and high stakes without losing concrete action.",
  inspiring: "Move the scene toward hope, growth or forward motion.",
  technological: "Make the scene feel modern, digital and precise.",
  mysterious: "Use tension, hidden information and gradual disclosure.",
  calm: "Keep the tempo controlled, clear and restrained.",
  energetic: "Use impulse, speed and escalating visible action.",
  minimalist: "Keep the scene clean, focused and precise.",
  dreamlike: "Allow soft surrealism and symbolism while keeping the scene usable.",
  neutral: "Use a neutral emotional tone unless the scene itself demands more."
});

const SCENE_ACTION_DEVELOPMENT_DIRECTIVES = Object.freeze({
  reveal: "Build the development toward a specific reveal or changed understanding.",
  journey: "Show progression through clear stages rather than a static description.",
  transformation: "Make the change of state or perception visible in the scene.",
  interaction: "Let the scene develop through exchange, response or system feedback.",
  presentation: "Make the demonstration concrete and easy to follow.",
  discovery: "Make finding, evidence or insight drive the next beat.",
  choice: "Make the decision and its consequence drive the scene.",
  system_awakening: "Show the hidden system or technology becoming active through visible signs."
});

const ROLE_SCENE_IDEAS_DIRECTIVES = Object.freeze({
  creative_director: "Generate scene ideas through concept, atmosphere, meaning and creative unity.",
  commercial_strategist: "Generate scene ideas through audience value, retention, offer logic and a clear viewer action.",
  cinematographer: "Generate scene ideas through frame, light, composition and visual depth.",
  film_director: "Generate scene ideas through staged action, pace, mise-en-scene and dramatic rhythm."
});

const TYPE_SCENE_IDEAS_DIRECTIVES = Object.freeze({
  video: "Make all 3 ideas usable as video directions with clear scene action and progression.",
  promo: "Make all 3 ideas commercial: pain, value, offer, viewer action and ad applicability.",
  interactive: "Make all 3 ideas interactive: viewer role, choice, consequence and branching-ready premise.",
  video_prompt: "Make all 3 ideas generation-ready for video: visible motion, camera, in-frame action and visual sequence.",
  image_prompt: "Make all 3 ideas single-frame focused: subject, composition, light, style and one strong image."
});

const GOAL_SCENE_IDEAS_DIRECTIVES = Object.freeze({
  product_service: "Show product or service value through concrete use, benefit and viewer action.",
  brand_video: "Show brand image, trust and distinctive character through the scene premise.",
  promotion_ad: "Strengthen hook, retention, offer and conversion logic in each idea.",
  presentation_pitch: "Make each idea clarify the pitch, argument and persuasive delivery.",
  social_media: "Make each idea quick to read, hook-driven and retention-aware.",
  education_explainer: "Make each idea clear, sequential and useful for explanation or learning.",
  story_narrative: "Make each idea carry conflict, choice, transformation or emotional arc.",
  creative_concept: "Protect originality, atmosphere and symbolic meaning in each idea."
});

const EMOTION_SCENE_IDEAS_DIRECTIVES = Object.freeze({
  epic: "Use scale, heightened stakes and elevated dramatic weight as the emotional bias.",
  inspiring: "Use hope, growth and forward movement as the emotional bias.",
  technological: "Use digital clarity, innovation and modern precision as the emotional bias.",
  mysterious: "Use hidden meaning, tension and controlled uncertainty as the emotional bias.",
  calm: "Use soft tempo, clarity and restraint as the emotional bias.",
  energetic: "Use speed, impulse and dynamic escalation as the emotional bias.",
  minimalist: "Use clean, simple and precise expression as the emotional bias.",
  dreamlike: "Use surreal, soft and symbolic perception as the emotional bias.",
  neutral: "Use neutral emotional handling without inventing an extra emotion requirement."
});

const SCENE_ACTION_SCENE_IDEAS_DIRECTIVES = Object.freeze({
  reveal: "Let the ideas build toward discovery or changed understanding.",
  journey: "Let the ideas show progression through stages.",
  transformation: "Let the ideas show a visible change of state, identity, perception or system.",
  interaction: "Let the ideas center on exchange, response or system feedback.",
  presentation: "Let the ideas structure the scene around demonstration and clarity.",
  discovery: "Let the ideas focus on finding, research, insight or evidence.",
  choice: "Let the ideas make decision and consequence central.",
  system_awakening: "Let the ideas show a hidden mechanism, technology or system becoming active."
});

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
    if (error && error.code === "SETTINGS_IDENTIFIER_INVALID") {
      console.warn("[SCRIPT_V2_SETTINGS_INVALID]", {
        code: error.code,
        field: error.field || null
      });
      return sendJson(res, 400, buildErrorEnvelope({
        stage: error.stage || null,
        code: error.code,
        message: error.message
      }));
    }
    console.warn("[SCRIPT_V2_FAILURE]", { code: "SCRIPT_V2_FAILURE" });
    return sendJson(res, 500, buildErrorEnvelope({
      stage: null,
      code: "SCRIPT_V2_FAILURE",
      message: "Script request failed."
    }));
  }
}

// ============================================================
// Request contract
// ============================================================

function buildSurfaceRequest(body = {}) {
  const stage = normalizeExecutionSurface(body.stage);
  const blueprint = stage === EXECUTION_SURFACES.BUILD
    ? ensureObject(body.blueprint)
    : normalizeNormalStageBlueprintIdentifiers(body.blueprint, stage);

  if (
    stage !== EXECUTION_SURFACES.BUILD &&
    hasLegacyAdvancedSelection(body.advanced_options)
  ) {
    throw createIdentifierValidationError(
      "advanced_options.selected",
      body.advanced_options,
      stage,
      "Legacy advanced_options.selected is forbidden; use blueprint.extensions."
    );
  }

  return {
    stage,
    language: normalizeLanguage(body.language),
    blueprint,
    user_input: body.user_input ?? null,
    ui_context: stage === EXECUTION_SURFACES.BUILD
      ? ensureObject(body.ui_context)
      : buildCanonicalUiContext(blueprint),
    advanced_options: stage === EXECUTION_SURFACES.BUILD
      ? ensureObject(body.advanced_options)
      : undefined,
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
    case EXECUTION_SURFACES.SCENE_IDEAS:
      return executeSceneIdeas(surfaceRequest);
    case EXECUTION_SURFACES.SELECTION:
      return executeSelection(surfaceRequest);
    case EXECUTION_SURFACES.DEVELOPMENT:
      return executeDevelopment(surfaceRequest);
    case EXECUTION_SURFACES.REFINEMENT:
      return executeRefinement(surfaceRequest);
    case EXECUTION_SURFACES.ALIGNMENT:
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
  try {
    const modelInput = buildSceneIdeasInput(surfaceRequest);
    const modelRaw = await callModel(modelInput);
    const validated = validateSceneIdeasResponse(modelRaw);
    const normalized = normalizeSceneIdeasResponse(validated);
    return buildJsonEnvelope({
      stage: EXECUTION_SURFACES.SCENE_IDEAS,
      status: STATUSES.OK,
      output: normalized.output,
      meta: buildMeta(surfaceRequest, { patch_allowed: false }),
      blueprint_patch: null,
      error: null
    });
  } catch (_) {
    console.warn("[SCRIPT_V2_STAGE_INVALID]", { stage: EXECUTION_SURFACES.SCENE_IDEAS, code: "SCENE_IDEAS_RESPONSE_INVALID" });
    return buildErrorEnvelope({
      stage: EXECUTION_SURFACES.SCENE_IDEAS,
      code: "SCENE_IDEAS_RESPONSE_INVALID",
      message: "Scene Ideas response failed validation."
    });
  }
}

async function executeSelection(surfaceRequest) {
  assertSelectionRequest(surfaceRequest);
  try {
    const modelInput = buildSelectionInput(surfaceRequest);
    const modelRaw = await callModel(modelInput);
    const validated = validateSelectionResponse(modelRaw);
    const normalized = normalizeSelectionResponse(validated, surfaceRequest);
    return buildJsonEnvelope({
      stage: EXECUTION_SURFACES.SELECTION,
      status: STATUSES.OK,
      output: normalized.output,
      meta: buildMeta(surfaceRequest, { patch_allowed: true }),
      blueprint_patch: normalized.blueprint_patch,
      error: null
    });
  } catch (_) {
    console.warn("[SCRIPT_V2_STAGE_INVALID]", { stage: EXECUTION_SURFACES.SELECTION, code: "SELECTION_RESPONSE_INVALID" });
    return buildErrorEnvelope({
      stage: EXECUTION_SURFACES.SELECTION,
      code: "SELECTION_RESPONSE_INVALID",
      message: "Selection response failed validation."
    });
  }
}

async function executeDevelopment(surfaceRequest) {
  assertDevelopmentRequest(surfaceRequest);
  try {
    const modelInput = buildDevelopmentInput(surfaceRequest);
    const modelRaw = await callModel(modelInput);
    const validated = validateDevelopmentResponse(modelRaw);
    const normalized = normalizeDevelopmentResponse(validated);
    return buildJsonEnvelope({
      stage: EXECUTION_SURFACES.DEVELOPMENT,
      status: normalized.status,
      output: normalized.output,
      meta: buildMeta(surfaceRequest, { patch_allowed: true }),
      blueprint_patch: normalized.blueprint_patch,
      error: normalized.error
    });
  } catch (_) {
    console.warn("[SCRIPT_V2_STAGE_INVALID]", { stage: EXECUTION_SURFACES.DEVELOPMENT, code: "DEVELOPMENT_RESPONSE_INVALID" });
    return buildErrorEnvelope({
      stage: EXECUTION_SURFACES.DEVELOPMENT,
      code: "DEVELOPMENT_RESPONSE_INVALID",
      message: "Development response failed validation."
    });
  }
}

async function executeRefinement(surfaceRequest) {
  assertRefinementRequest(surfaceRequest);

  try {
    const modelInput = buildRefinementInput(surfaceRequest);
    const modelRaw = await callModel(modelInput);
    const validated = validateRefinementResponse(modelRaw, surfaceRequest);
    const normalized = normalizeRefinementResponse(validated);

    return buildJsonEnvelope({
      stage: EXECUTION_SURFACES.REFINEMENT,
      status: normalized.status,
      output: normalized.output,
      meta: buildMeta(surfaceRequest, {
        patch_allowed: true,
        ...buildTrustedRefinementEchoes(surfaceRequest)
      }),
      blueprint_patch: normalized.blueprint_patch,
      error: null
    });
  } catch (error) {
    console.warn("[SCRIPT_V2_REFINEMENT_INVALID]", {
      code: "REFINEMENT_RESPONSE_FATAL",
      diagnostic: safeTrim(error && error.message) || "unknown"
    });
    return buildJsonEnvelope({
      stage: EXECUTION_SURFACES.REFINEMENT,
      status: STATUSES.ERROR,
      output: null,
      meta: buildMeta(surfaceRequest, {
        patch_allowed: true,
        ...buildTrustedRefinementEchoes(surfaceRequest)
      }),
      blueprint_patch: null,
      error: {
        code: "REFINEMENT_RESPONSE_FATAL",
        message: "Refinement response is unusable."
      }
    });
  }
}

async function executeAlignment(surfaceRequest) {
  assertAlignmentRequest(surfaceRequest);
  try {
    const modelInput = buildAlignmentInput(surfaceRequest);
    const modelRaw = await callModel(modelInput);
    const validated = validateAlignmentResponse(modelRaw);
    const normalized = normalizeAlignmentResponse(validated);
    return buildJsonEnvelope({
      stage: EXECUTION_SURFACES.ALIGNMENT,
      status: STATUSES.OK,
      output: normalized.output,
      meta: buildMeta(surfaceRequest, { patch_allowed: false }),
      blueprint_patch: null,
      error: null
    });
  } catch (_) {
    console.warn("[SCRIPT_V2_STAGE_INVALID]", { stage: EXECUTION_SURFACES.ALIGNMENT, code: "ALIGNMENT_RESPONSE_INVALID" });
    return buildErrorEnvelope({
      stage: EXECUTION_SURFACES.ALIGNMENT,
      code: "ALIGNMENT_RESPONSE_INVALID",
      message: "Alignment response failed validation."
    });
  }
}

// ============================================================
// Build execution surface
// ============================================================

async function executeBuildSurface(surfaceRequest) {
  assertBuildRequest(surfaceRequest);

  const rawResultSchema = surfaceRequest?.meta?.result_schema;
  logBuildDiagnostic("debug", "build_request_context", buildBuildRequestDiagnostic(surfaceRequest, rawResultSchema));

  const schemaValidation = validateBuildResultSchemaContext(rawResultSchema);

  if (schemaValidation.ok !== true) {
    logBuildDiagnostic("warn", "build_result_schema_invalid", {
      code: schemaValidation.code,
      message: schemaValidation.message,
      result_schema: buildResultSchemaDiagnostic(rawResultSchema)
    });
    return buildBuildSurfaceErrorEnvelope({
      surfaceRequest,
      code: schemaValidation.code,
      message: schemaValidation.message,
    });
  }

  const resultSchema = safeResultSchemaSnapshot(rawResultSchema);

  if (!hasBuildAllowedBlocks(resultSchema)) {
    logBuildDiagnostic("warn", "build_result_schema_empty", {
      code: "BUILD_RESULT_SCHEMA_EMPTY",
      message: "Build result schema has no allowed blocks.",
      result_schema: buildResultSchemaDiagnostic(resultSchema)
    });
    return buildBuildSurfaceErrorEnvelope({
      surfaceRequest,
      code: "BUILD_RESULT_SCHEMA_EMPTY",
      message: "Build result schema has no allowed blocks."
    });
  }

  const modelInput = buildBuildInput(surfaceRequest, resultSchema);

  let modelRaw;
  try {
    modelRaw = await callModel(modelInput);
  } catch (error) {
    logBuildDiagnostic("warn", "build_model_call_failed", {
      message: error?.message || "Build model call failed",
      result_schema: buildResultSchemaDiagnostic(resultSchema)
    });
    throw error;
  }

  logBuildDiagnostic("debug", "build_model_raw_response", buildBuildModelRawDiagnostic(modelRaw));

  let validated;
  try {
    validated = validateBuildResponse(modelRaw);
  } catch (error) {
    logBuildDiagnostic("warn", "build_response_validation_failed", {
      message: error?.message || "Build response validation failed",
      parsed_json: buildBuildParsedDiagnostic(modelRaw?.parsed_json),
      raw_response: buildBuildModelRawDiagnostic(modelRaw)
    });
    throw error;
  }

  logBuildDiagnostic("debug", "build_parsed_json", buildBuildParsedDiagnostic(validated));

  let normalized;
  try {
    normalized = normalizeBuildResponse(validated, resultSchema);
  } catch (error) {
    logBuildDiagnostic("warn", "build_response_normalization_failed", {
      message: error?.message || "Build response normalization failed",
      normalization: buildBuildNormalizationDiagnostic(validated, null, resultSchema)
    });
    throw error;
  }

  logBuildDiagnostic("debug", "build_normalization_result", buildBuildNormalizationDiagnostic(validated, normalized, resultSchema));

  if (!hasNonEmptyBuildBlocks(normalized?.output?.blocks)) {
    logBuildDiagnostic("warn", "BUILD_EMPTY_BLOCKS_context", {
      code: "BUILD_EMPTY_BLOCKS",
      message: "Build returned no content blocks.",
      empty_blocks_context: buildBuildEmptyBlocksDiagnostic(validated, normalized, resultSchema),
      normalization: buildBuildNormalizationDiagnostic(validated, normalized, resultSchema)
    });
    return buildBuildSurfaceErrorEnvelope({
      surfaceRequest,
      code: "BUILD_EMPTY_BLOCKS",
      message: "Build returned no content blocks."
    });
  }

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
  const rawText = extractRawSelectionText(surfaceRequest.user_input);
  if (!selectedScene && !rawText) {
    throw new Error("Missing selection input");
  }
}

function assertDevelopmentRequest(surfaceRequest) {
  if (!surfaceRequest.blueprint || typeof surfaceRequest.blueprint !== "object") {
    throw new Error("Missing blueprint for development");
  }

  if (!surfaceRequest.blueprint?.scene_core?.seed_scene) {
    throw new Error("Missing blueprint.scene_core.seed_scene for development");
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
  const behaviorContext = deriveStageBehaviorDirectives(surfaceRequest, EXECUTION_SURFACES.SCENE_IDEAS);
  const rules = lang === "en" ? [
    "You work only on Scene Ideas and write directly in English.",
    "Return JSON only with exactly one top-level key: ideas.",
    'Exact shape: {"ideas":[{"slot":"precise","title":"...","seed_scene":"...","why_it_fits":"..."},{"slot":"variation","title":"...","seed_scene":"...","why_it_fits":"..."},{"slot":"creative","title":"...","seed_scene":"...","why_it_fits":"..."}]}.',
    "Return exactly three genuinely different directions: precise, variation, creative; each slot exactly once.",
    "Every idea must have a distinct non-empty title and a distinct non-empty seed_scene.",
    "Do not ask questions and do not behave like a questionnaire.",
    "Do not repeat known inputs back to the user; use them as constraints.",
    "Do not favor LiVi, this product, or any platform unless the brief explicitly requires it.",
    "Role and video type must materially change the creative decision, not merely wording.",
    "Advanced modules are intent-only quality lenses; do not create module data, patches, state, routes, readiness, Build or result fields.",
    "Do not return message, questions, output, patch, blueprint_patch or technical fields. No markdown."
  ] : [
    "Ты работаешь только над Scene Ideas и пишешь сразу на русском языке.",
    "Верни только JSON ровно с одним top-level ключом: ideas.",
    'Точная форма: {"ideas":[{"slot":"precise","title":"...","seed_scene":"...","why_it_fits":"..."},{"slot":"variation","title":"...","seed_scene":"...","why_it_fits":"..."},{"slot":"creative","title":"...","seed_scene":"...","why_it_fits":"..."}]}.',
    "Верни ровно три действительно разные идеи: precise, variation, creative; каждый slot ровно один раз.",
    "У каждой идеи должны быть уникальные непустые title и seed_scene.",
    "Не задавай вопросов и не превращай ответ в анкету.",
    "Не повторяй известные входные данные пользователю; используй их как ограничения.",
    "Не отдавай предпочтение LiVi, этому продукту или платформе, если бриф явно этого не требует.",
    "Роль и тип видео должны заметно менять творческое решение, а не только формулировку.",
    "Advanced-модули — только intent-линзы качества; не создавай module data, patch, state, route, readiness, Build или result fields.",
    "Не возвращай message, questions, output, patch, blueprint_patch или технические поля. Без markdown."
  ];
  return [
    { role: "system", content: [{ type: "input_text", text: `${getLanguageInstruction(lang)}\n${rules.join("\n")}` }] },
    { role: "user", content: [{ type: "input_text", text:
      `Trusted brief context:\n${compact(buildTrustedBriefContext(surfaceRequest))}\n\n` +
      `Scene Ideas behavior context:\n${compact(behaviorContext)}`
    }] }
  ];
}

function buildSelectionInput(surfaceRequest) {
  const lang = surfaceRequest.language;
  const selectedScene = extractSelectedScene(surfaceRequest.user_input);
  const rules = lang === "en" ? [
    "You work only on Selection and write directly in English.",
    'Return JSON only: {"message":"...","questions":[],"patch":{}}.',
    "Allowed top-level keys are only message, questions, patch.",
    "Briefly acknowledge the chosen scene and fix it as the working basis.",
    "questions must contain zero or one short question; normally return an empty array.",
    "Ask one question only when a truly critical ambiguity prevents safe continuation.",
    "Do not reopen the three ideas, announce a stage transition, mention Build, or request route approval.",
    "patch is optional and may contain only scene_core.seed_scene.",
    "Do not invent a question from missing fields. No markdown."
  ] : [
    "Ты работаешь только над Selection и пишешь сразу на русском языке.",
    'Верни только JSON: {"message":"...","questions":[],"patch":{}}.',
    "Допустимые top-level keys только message, questions, patch.",
    "Коротко подтверди выбранную сцену и зафиксируй её как рабочую основу.",
    "questions содержит ноль или один короткий вопрос; обычно возвращай пустой массив.",
    "Задай один вопрос только при действительно критической неоднозначности, без которой нельзя безопасно продолжить.",
    "Не открывай заново три идеи, не объявляй переход этапа, не упоминай Build и не проси подтверждение маршрута.",
    "patch опционален и может содержать только scene_core.seed_scene.",
    "Не придумывай вопрос из-за незаполненных полей. Без markdown."
  ];
  return [
    { role: "system", content: [{ type: "input_text", text: `${getLanguageInstruction(lang)}\n${rules.join("\n")}` }] },
    { role: "user", content: [{ type: "input_text", text:
      `Trusted selected scene:\n${selectedScene}\n\n` +
      `Trusted current context:\n${compact(buildTrustedBriefContext(surfaceRequest))}\n\n` +
      `Raw user input:\n${compact(surfaceRequest.user_input)}`
    }] }
  ];
}
function buildDevelopmentInput(surfaceRequest) {
  const lang = surfaceRequest.language;
  const developmentContext = buildDevelopmentContext(surfaceRequest);
  const behaviorContext = deriveStageBehaviorDirectives(surfaceRequest, EXECUTION_SURFACES.DEVELOPMENT);
  const rules = lang === "en" ? [
    "You work only on Development and write directly in English.",
    'Return JSON only: {"status":"ok","message":"...","questions":[],"patch":{}}.',
    "Allowed top-level keys are exactly status, message, questions, patch.",
    "status is exactly ok, blocked, or error. message is non-empty. questions contains zero or one non-empty string.",
    "Develop the protected selected scene with concrete visible action, cause and effect, staging and progression.",
    "Normally ask no question. Ask one only when a critical ambiguity makes safe development impossible.",
    "End message with one natural non-question handoff inviting clarification, a change, confirmation, or delegation such as 'do what you think is best'.",
    "The final handoff sentence must not contain a question mark or mention route, Alignment, Build, Final Assembly, readiness, or stage names.",
    "For status ok, patch must contain meaningful content on one or more allowed paths: scene_core.main_focus, narrative.scene_setup, narrative.scene_development.",
    "Never patch scene_core.seed_scene or any system, route, result, meta, goal, extension or Build field.",
    "Role, type, goal, emotion, action and selected modules are quality lenses only. No markdown."
  ] : [
    "Ты работаешь только над Development и пишешь сразу на русском языке.",
    'Верни только JSON: {"status":"ok","message":"...","questions":[],"patch":{}}.',
    "Допустимые top-level keys ровно status, message, questions, patch.",
    "status строго ok, blocked или error. message непустой. questions содержит ноль или одну непустую строку.",
    "Развивай защищённую выбранную сцену через конкретное видимое действие, причинно-следственную логику, постановку и движение сцены.",
    "Обычно не задавай вопрос. Один вопрос допустим только при критической неоднозначности, без которой сцену нельзя безопасно развить.",
    "Заверши message одним естественным handoff-предложением без вопроса: пользователь может уточнить, изменить, подтвердить основу или делегировать решением «сделай как лучше».",
    "Последнее handoff-предложение не должно содержать вопросительный знак или упоминать route, Alignment, Build, Final Assembly, readiness либо названия этапов.",
    "При status ok patch должен содержать содержательное изменение хотя бы по одному разрешённому path: scene_core.main_focus, narrative.scene_setup, narrative.scene_development.",
    "Никогда не patch scene_core.seed_scene или system, route, result, meta, goal, extensions и Build fields.",
    "Роль, тип, цель, эмоция, действие и выбранные модули — только линзы качества. Без markdown."
  ];
  return [
    { role: "system", content: [{ type: "input_text", text: `${getLanguageInstruction(lang)}\n${rules.join("\n")}` }] },
    { role: "user", content: [{ type: "input_text", text:
      `Development context:\n${compact(developmentContext)}\n\n` +
      `Behavior context:\n${compact(behaviorContext)}\n\n` +
      `Raw user input:\n${compact(surfaceRequest.user_input)}`
    }] }
  ];
}

function buildRefinementInput(surfaceRequest) {
  const lang = surfaceRequest.language;
  const behaviorContext = deriveStageBehaviorDirectives(surfaceRequest, EXECUTION_SURFACES.REFINEMENT);
  const rules = lang === "en" ? [
    "You work only on Refinement and write directly in English.",
    'Return JSON only. Required fields: message, user_intent_label. Conditional fields only when needed: anchor_hint, questions, options, blueprint_patch, selected_option_id.',
    "Do not return model meta echoes. The server owns trusted public meta.",
    "Use only canonical user_intent_label and anchor values from the trusted context. anchor_hint may be omitted when unnecessary.",
    'questions is optional, max 1. Question core: {"id":"...","text":"...","target_anchor":"..."}; reason is optional presentation metadata.',
    'options is optional, max 4. Option core: {"id":"...","label":"...","target_anchor":"...","mode":"blocking|suggestive"}; description, effect, recommended are optional presentation metadata.',
    "blueprint_patch is the only mutation carrier. Never return legacy patch. Preserve scene_core.seed_scene. Allowed patch paths only: scene_core.main_focus, narrative.scene_setup, narrative.scene_development, visual_direction.emotion.",
    "For actionable_change return a non-empty blueprint_patch. For asks_question return exactly one valid question. For wants_more_options return at least one valid option.",
    "For ready_to_continue return no non-empty blueprint_patch, questions or options. For hold_or_not_ready do not mutate state-bearing sidecars.",
    "For a typed free-text option_selection while trusted pending options exist, return selected_option_id matching exactly one trusted options_context ID and a non-empty blueprint_patch. For structured option clicks, do not invent or reinterpret the ID.",
    "Infer -> propose -> patch -> ask. Do not ask merely because a field is empty.",
    "For unclear_dissatisfaction: acknowledge uncertainty and use only narrow diagnostic question/options when useful.",
    "For a local alternative preserve seed_scene. For a fully new scene use new_cycle_request and do not reset the Blueprint yourself.",
    "Raw short input such as yes, ok, next, 1, 2 remains raw text and is classified from current context.",
    "Never return route/readiness/stage/system/refinement state, Build permission, Billing/access, Result Schema or final_result authority. No markdown."
  ] : [
    "Ты работаешь только над Refinement и пишешь сразу на русском языке.",
    'Верни только JSON. Обязательные поля: message, user_intent_label. Условные поля только при необходимости: anchor_hint, questions, options, blueprint_patch, selected_option_id.',
    "Не возвращай model meta echoes. Trusted public meta принадлежит серверу.",
    "Используй только canonical user_intent_label и anchor из trusted context. anchor_hint можно не возвращать, если он не нужен.",
    'questions опционален, максимум 1. Core question: {"id":"...","text":"...","target_anchor":"..."}; reason — опциональная presentation metadata.',
    'options опционален, максимум 4. Core option: {"id":"...","label":"...","target_anchor":"...","mode":"blocking|suggestive"}; description, effect, recommended — опциональная presentation metadata.',
    "blueprint_patch — единственный mutation carrier. Никогда не возвращай legacy patch. Сохраняй scene_core.seed_scene. Разрешённые patch paths только: scene_core.main_focus, narrative.scene_setup, narrative.scene_development, visual_direction.emotion.",
    "Для actionable_change верни непустой blueprint_patch. Для asks_question верни ровно один валидный question. Для wants_more_options верни минимум один валидный option.",
    "Для ready_to_continue не возвращай непустые blueprint_patch, questions или options. Для hold_or_not_ready не добавляй state-bearing sidecars.",
    "Для typed free-text option_selection при trusted pending options верни selected_option_id, точно совпадающий с одним ID из trusted options_context, и непустой blueprint_patch. Для structured option click не придумывай и не переинтерпретируй ID.",
    "Порядок: Infer -> Propose -> Patch -> Ask. Не спрашивай только потому, что поле пустое.",
    "Для unclear_dissatisfaction признай неопределённость и используй только узкие diagnostic question/options, когда они полезны.",
    "Для локальной альтернативы сохраняй seed_scene. Для полностью новой сцены используй new_cycle_request и не сбрасывай Blueprint самостоятельно.",
    "Короткий raw input «да», «ок», «дальше», «1», «2» остаётся raw text и классифицируется по текущему контексту.",
    "Никогда не возвращай authority по route/readiness/stage/system/refinement state, Build, Billing/access, Result Schema или final_result. Без markdown."
  ];
  return [
    { role: "system", content: [{ type: "input_text", text: `${getLanguageInstruction(lang)}\n${rules.join("\n")}` }] },
    { role: "user", content: [{ type: "input_text", text:
      `Trusted refinement behavior context:\n${compact(behaviorContext)}\n\n` +
      `Current working content:\n${compact(buildTrustedWorkingScene(surfaceRequest.blueprint))}\n\n` +
      `Raw user input:\n${compact(surfaceRequest.user_input)}`
    }] }
  ];
}

function buildAlignmentInput(surfaceRequest) {
  const lang = surfaceRequest.language;
  const behaviorContext = deriveStageBehaviorDirectives(surfaceRequest, EXECUTION_SURFACES.ALIGNMENT);
  const rules = lang === "en" ? [
    "Write only the current pre-final Alignment message directly in English.",
    'Return JSON only with exactly: {"message":"...","questions":[]}.',
    "message must contain 3-7 short natural sentences and questions must be an empty array.",
    "Speak as the selected scriptwriter role, directly to the user; do not use a mandatory fixed opening.",
    "Summarize the selected scene and 2-3 agreed decisions, then explain the kind of usable result the selected video type will produce without creating it.",
    "Do not open options, ask questions, return a patch, decide route/readiness/admission, or expose technical terms.",
    "Do not say Build is launched or authorized, and do not promise direct mutation of the canonical result after assembly.",
    "You may neutrally indicate that the user can use the manual action when the summary fits and can discuss improvements afterward. No markdown."
  ] : [
    "Пиши только текущее предфинальное Alignment-сообщение сразу на русском языке.",
    'Верни только JSON ровно: {"message":"...","questions":[]}.',
    "message должен содержать 3–7 коротких естественных предложений, questions — пустой массив.",
    "Говори как выбранная роль сценариста напрямую пользователю; обязательного фиксированного начала нет.",
    "Кратко суммируй выбранную сцену и 2–3 согласованных решения, затем объясни тип применимого результата для выбранного video type, не создавая сам результат.",
    "Не открывай варианты, не задавай вопросы, не возвращай patch, не решай route/readiness/admission и не раскрывай технические термины.",
    "Не говори, что Build уже запущен или разрешён, и не обещай прямую мутацию canonical result после сборки.",
    "Можно нейтрально сказать, что при совпадении понимания пользователь использует ручное действие, а после результата сможет обсудить точечные улучшения. Без markdown."
  ];
  return [
    { role: "system", content: [{ type: "input_text", text: `${getLanguageInstruction(lang)}\n${rules.join("\n")}` }] },
    { role: "user", content: [{ type: "input_text", text:
      `Trusted Alignment context:\n${compact(behaviorContext)}\n\n` +
      `Current agreed scene:\n${compact(buildTrustedWorkingScene(surfaceRequest.blueprint))}`
    }] }
  ];
}

function buildBuildInput(surfaceRequest, resultSchemaSnapshot = null) {
  const lang = surfaceRequest.language;
  if (!isPlainObject(resultSchemaSnapshot)) {
    throw new Error("Build result schema snapshot is required.");
  }
  const resultSchema = resultSchemaSnapshot;
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
                  "Return ONLY this JSON shape:",
                  '{ "blocks": { ... } }',
                  "The top-level JSON object must contain exactly one key: blocks.",
                  "Do not return message.",
                  "Do not return text.",
                  "Do not return explanation.",
                  "Do not return output.",
                  "Do not return any keys outside blocks.",
                  "If one allowed block cannot be generated, omit only that block.",
                  "If allowed_blocks is non-empty, do not return an empty blocks object.",
                  "Generate every possible allowed block from the Blueprint.",
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
                  "Верни ТОЛЬКО JSON этой формы:",
                  '{ "blocks": { ... } }',
                  "Верхний уровень JSON должен содержать ровно один ключ: blocks.",
                  "Не возвращай message.",
                  "Не возвращай text.",
                  "Не возвращай explanation.",
                  "Не возвращай output.",
                  "Не возвращай любые ключи вне blocks.",
                  "Если один разрешённый блок невозможно сгенерировать, пропусти только этот блок.",
                  "Если allowed_blocks непустой, не возвращай пустой объект blocks.",
                  "Сгенерируй каждый возможный разрешённый блок из Blueprint.",
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
  const data = validateBaseModelObject(modelRaw, EXECUTION_SURFACES.SCENE_IDEAS);
  assertExactObjectKeys(data, new Set(["ideas"]), "scene_ideas model response");
  if (!Array.isArray(data.ideas) || data.ideas.length !== 3) {
    throw new Error("scene_ideas ideas must contain exactly three items");
  }
  const expectedSlots = new Set(["precise", "variation", "creative"]);
  const seenSlots = new Set();
  const titles = new Set();
  const scenes = new Set();
  for (const idea of data.ideas) {
    if (!isPlainObject(idea)) throw new Error("scene_ideas item must be a plain object");
    assertExactObjectKeys(idea, new Set(["slot", "title", "seed_scene", "why_it_fits"]), "scene_ideas item");
    for (const key of ["slot", "title", "seed_scene", "why_it_fits"]) assertNonEmptyModelString(idea[key], `scene_ideas ${key}`);
    const slot = safeTrim(idea.slot).toLowerCase();
    if (!expectedSlots.has(slot) || seenSlots.has(slot)) throw new Error("scene_ideas slots must be exact and unique");
    seenSlots.add(slot);
    const titleKey = normalizeSemanticKey(idea.title);
    const sceneKey = normalizeSemanticKey(idea.seed_scene);
    if (titles.has(titleKey) || scenes.has(sceneKey)) throw new Error("scene_ideas content must be distinct");
    titles.add(titleKey); scenes.add(sceneKey);
  }
  if (seenSlots.size !== 3) throw new Error("scene_ideas slots incomplete");
  return data;
}

function validateSelectionResponse(modelRaw) {
  const data = validateBaseModelObject(modelRaw, EXECUTION_SURFACES.SELECTION);
  assertExactObjectKeys(data, new Set(["message", "questions", "patch"]), "selection model response");
  assertNonEmptyModelString(data.message, "selection message");
  assertStringQuestionArray(data.questions, 1, "selection questions");
  if (data.patch != null) {
    if (!isPlainObject(data.patch)) throw new Error("selection patch must be an object");
    assertPatchAllowed(data.patch, EXECUTION_SURFACES.SELECTION, { allowEmpty: true });
  }
  return data;
}

function validateDevelopmentResponse(modelRaw) {
  const data = validateBaseModelObject(modelRaw, EXECUTION_SURFACES.DEVELOPMENT);
  assertExactObjectKeys(data, new Set(["status", "message", "questions", "patch"]), "development model response");
  const status = safeTrim(data.status).toLowerCase();
  if (![STATUSES.OK, STATUSES.BLOCKED, STATUSES.ERROR].includes(status)) throw new Error("development status invalid");
  data.status = status;
  assertNonEmptyModelString(data.message, "development message");
  assertStringQuestionArray(data.questions, 1, "development questions");
  if (!isPlainObject(data.patch)) throw new Error("development patch must be a plain object");
  assertPatchAllowed(data.patch, EXECUTION_SURFACES.DEVELOPMENT, { allowEmpty: status !== STATUSES.OK });
  if (status === STATUSES.OK && !hasMeaningfulPatch(data.patch)) throw new Error("development ok requires meaningful patch");
  assertDevelopmentHandoff(data.message);
  return data;
}

function validateRefinementResponse(modelRaw, surfaceRequest) {
  const data = modelRaw?.parsed_json;
  if (!isPlainObject(data)) {
    throw new Error("refinement model response must be a JSON object");
  }

  const message = normalizeRefinementPublicMessage(data.message);
  if (!message) {
    throw new Error("refinement model response must contain message");
  }

  const strictDiagnostic = process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";
  const forbiddenPath = findForbiddenRefinementAuthorityPath(data);
  if (forbiddenPath) {
    if (strictDiagnostic) throw new Error(`Forbidden route key returned by model: ${forbiddenPath}`);
    console.warn("[SCRIPT_V2_REFINEMENT_QUARANTINED]", { reason: "forbidden_authority", path: forbiddenPath });
    return buildBlockedRefinementValidation(message, "forbidden_authority");
  }

  const unknownTopLevel = Object.keys(data).find((key) => !REFINEMENT_MODEL_TOP_LEVEL_KEYS.has(key));
  if (unknownTopLevel) {
    if (strictDiagnostic) throw new Error(`refinement model response contains unsupported key: ${unknownTopLevel}`);
    console.warn("[SCRIPT_V2_REFINEMENT_QUARANTINED]", { reason: "unsupported_top_level", key: unknownTopLevel });
    return buildBlockedRefinementValidation(message, "unsupported_top_level");
  }

  if (Object.prototype.hasOwnProperty.call(data, "meta")) {
    if (strictDiagnostic) throw new Error("refinement model meta echoes are not accepted in V2 diagnostics");
    console.warn("[SCRIPT_V2_REFINEMENT_SIDECAR_DROPPED]", { reason: "model_meta_ignored" });
  }

  const intent = safeTrim(data.user_intent_label);
  if (!REFINEMENT_INTENT_LABELS.has(intent)) {
    console.warn("[SCRIPT_V2_REFINEMENT_QUARANTINED]", { reason: "invalid_intent" });
    return buildBlockedRefinementValidation(message, "invalid_intent");
  }

  const anchorHint = typeof data.anchor_hint === "string" && REFINEMENT_ALLOWED_ANCHORS.has(data.anchor_hint.trim())
    ? data.anchor_hint.trim()
    : null;
  if (Object.prototype.hasOwnProperty.call(data, "anchor_hint") && anchorHint === null) {
    console.warn("[SCRIPT_V2_REFINEMENT_SIDECAR_DROPPED]", { reason: "invalid_anchor_hint" });
  }

  const questionInspection = inspectRefinementQuestions(data.questions);
  const optionInspection = inspectRefinementOptions(data.options);
  const patchInspection = inspectRefinementBlueprintPatch(data.blueprint_patch);
  const hasLegacyPatch = Object.prototype.hasOwnProperty.call(data, "patch");
  const providerSelectedOptionId = safeTrim(data.selected_option_id) || null;

  if (hasLegacyPatch) {
    console.warn("[SCRIPT_V2_REFINEMENT_SIDECAR_DROPPED]", { reason: "legacy_patch_rejected" });
  }

  const accepted = {
    status: STATUSES.OK,
    message,
    user_intent_label: intent,
    anchor_hint: anchorHint,
    selected_option_id: null,
    questions: [],
    options: [],
    blueprint_patch: null,
    diagnostic_reason: null
  };

  if (intent === "actionable_change") {
    if (hasLegacyPatch || !patchInspection.valid || !patchInspection.non_empty) {
      return buildBlockedRefinementValidation(message, "actionable_patch_required");
    }
    accepted.blueprint_patch = patchInspection.value;
    return accepted;
  }

  if (intent === "asks_question") {
    if (!questionInspection.exactly_one_valid) {
      return buildBlockedRefinementValidation(message, "required_question_invalid");
    }
    accepted.questions = questionInspection.values;
    return accepted;
  }

  if (intent === "wants_more_options") {
    if (optionInspection.values.length < 1) {
      return buildBlockedRefinementValidation(message, "required_options_invalid");
    }
    accepted.options = optionInspection.values;
    return accepted;
  }

  if (intent === "ready_to_continue") {
    const hasPatchSidecar = hasLegacyPatch || (patchInspection.present && patchInspection.non_empty) || (patchInspection.present && !patchInspection.valid);
    const hasQuestionSidecar = questionInspection.present && (questionInspection.raw_non_empty || !questionInspection.container_valid);
    const hasOptionSidecar = optionInspection.present && (optionInspection.raw_non_empty || !optionInspection.container_valid);
    if (hasPatchSidecar || hasQuestionSidecar || hasOptionSidecar || providerSelectedOptionId) {
      return buildBlockedRefinementValidation(message, "ready_state_sidecar_conflict");
    }
    return accepted;
  }

  if (intent === "hold_or_not_ready") {
    return accepted;
  }

  if (intent === "option_selection") {
    if (hasLegacyPatch || !patchInspection.valid || !patchInspection.non_empty) {
      return buildBlockedRefinementValidation(message, "option_selection_patch_required");
    }
    const structuredId = getStructuredRefinementOptionId(surfaceRequest);
    const trustedIds = getTrustedRefinementOptionIds(surfaceRequest);
    let selectedId = null;
    if (structuredId) {
      if (!trustedIds.has(structuredId)) return buildBlockedRefinementValidation(message, "structured_option_id_mismatch");
      if (providerSelectedOptionId && providerSelectedOptionId !== structuredId) return buildBlockedRefinementValidation(message, "structured_provider_id_conflict");
      selectedId = structuredId;
    } else {
      if (!providerSelectedOptionId || !trustedIds.has(providerSelectedOptionId)) return buildBlockedRefinementValidation(message, "typed_option_id_mismatch");
      selectedId = providerSelectedOptionId;
    }
    accepted.selected_option_id = selectedId;
    accepted.blueprint_patch = patchInspection.value;
    return accepted;
  }

  if (intent === "unclear_dissatisfaction") {
    if (questionInspection.exactly_one_valid) accepted.questions = questionInspection.values;
    if (optionInspection.values.length) accepted.options = optionInspection.values;
    return accepted;
  }

  // brief_or_context, alternative_request, new_cycle_request and off_topic_or_unclear
  // keep only the canonical intent/message/soft anchor. Mutation and sidecar data are dropped.
  return accepted;
}

function buildBlockedRefinementValidation(message, diagnosticReason) {
  return {
    status: STATUSES.BLOCKED,
    message,
    user_intent_label: null,
    anchor_hint: null,
    selected_option_id: null,
    questions: [],
    options: [],
    blueprint_patch: null,
    diagnostic_reason: diagnosticReason || "blocked"
  };
}

function findForbiddenRefinementAuthorityPath(value) {
  for (const path of collectObjectPaths(value)) {
    const last = path.split(".").pop();
    if (FORBIDDEN_ROUTE_KEYS.has(path) || FORBIDDEN_ROUTE_KEYS.has(last)) return path;
  }
  return null;
}

function inspectRefinementQuestions(value) {
  if (value === undefined || value === null) {
    return { present: false, container_valid: true, raw_non_empty: false, exactly_one_valid: false, values: [] };
  }
  if (!Array.isArray(value) || value.length > 1) {
    return { present: true, container_valid: false, raw_non_empty: true, exactly_one_valid: false, values: [] };
  }
  if (value.length === 0) {
    return { present: true, container_valid: true, raw_non_empty: false, exactly_one_valid: false, values: [] };
  }
  const normalized = normalizeRefinementQuestionCore(value[0]);
  return { present: true, container_valid: true, raw_non_empty: true, exactly_one_valid: Boolean(normalized), values: normalized ? [normalized] : [] };
}

function normalizeRefinementQuestionCore(question) {
  if (!isPlainObject(question)) return null;
  if (Object.keys(question).some((key) => !REFINEMENT_QUESTION_KEYS.has(key))) return null;
  const id = safeTrim(question.id);
  const text = safeTrim(question.text);
  const targetAnchor = safeTrim(question.target_anchor);
  if (!id || !text || !REFINEMENT_ALLOWED_ANCHORS.has(targetAnchor)) return null;
  const normalized = { id, text, target_anchor: targetAnchor };
  const reason = safeTrim(question.reason);
  if (reason) normalized.reason = reason;
  return normalized;
}

function inspectRefinementOptions(value) {
  if (value === undefined || value === null) {
    return { present: false, container_valid: true, raw_non_empty: false, values: [] };
  }
  if (!Array.isArray(value) || value.length > 4) {
    return { present: true, container_valid: false, raw_non_empty: true, values: [] };
  }
  const values = value.map(normalizeRefinementOptionCore).filter(Boolean);
  return { present: true, container_valid: true, raw_non_empty: value.length > 0, values };
}

function normalizeRefinementOptionCore(option) {
  if (!isPlainObject(option)) return null;
  if (Object.keys(option).some((key) => !REFINEMENT_OPTION_KEYS.has(key))) return null;
  const id = safeTrim(option.id);
  const label = safeTrim(option.label);
  const targetAnchor = safeTrim(option.target_anchor);
  const mode = safeTrim(option.mode);
  if (!id || !label || !REFINEMENT_ALLOWED_ANCHORS.has(targetAnchor) || !REFINEMENT_OPTION_MODES.has(mode)) return null;
  const normalized = { id, label, target_anchor: targetAnchor, mode };
  const description = safeTrim(option.description);
  const effect = safeTrim(option.effect);
  if (description) normalized.description = description;
  if (effect) normalized.effect = effect;
  if (typeof option.recommended === "boolean") normalized.recommended = option.recommended;
  return normalized;
}

function inspectRefinementBlueprintPatch(value) {
  if (value === undefined || value === null) {
    return { present: false, valid: true, non_empty: false, value: null };
  }
  if (!isPlainObject(value)) {
    return { present: true, valid: false, non_empty: false, value: null };
  }
  try {
    assertPatchAllowed(value, EXECUTION_SURFACES.REFINEMENT, { allowEmpty: true });
  } catch (error) {
    console.warn("[SCRIPT_V2_REFINEMENT_SIDECAR_DROPPED]", { reason: "blueprint_patch_invalid", diagnostic: safeTrim(error && error.message) });
    return { present: true, valid: false, non_empty: false, value: null };
  }
  const nonEmpty = hasMeaningfulPatch(value);
  return {
    present: true,
    valid: true,
    non_empty: nonEmpty,
    value: nonEmpty ? sanitizeNestedRefinementPatch(value) : null
  };
}

function sanitizeNestedRefinementPatch(value) {
  if (!isPlainObject(value)) return null;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (isPlainObject(item)) {
      const nested = sanitizeNestedRefinementPatch(item);
      if (nested && Object.keys(nested).length) out[key] = nested;
      continue;
    }
    out[key] = sanitizePatchValue(item);
  }
  return out;
}

function getTrustedRefinementOptionIds(surfaceRequest) {
  const options = surfaceRequest?.blueprint?.system_state?.refinement_state?.options_context;
  const ids = new Set();
  if (!Array.isArray(options)) return ids;
  for (const option of options) {
    const id = safeTrim(option && option.id);
    if (id) ids.add(id);
  }
  return ids;
}

function getStructuredRefinementOptionId(surfaceRequest) {
  const input = surfaceRequest && surfaceRequest.user_input;
  if (!isPlainObject(input) || input.type !== "option_selection") return null;
  return safeTrim(input.id) || null;
}

function assertExactObjectKeys(value, allowedKeys, label) {
  for (const key of Object.keys(value || {})) {
    if (!allowedKeys.has(key)) throw new Error(`${label} contains forbidden key: ${key}`);
  }
}

function assertNonEmptyModelString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
}

function buildTrustedRefinementEchoes(surfaceRequest) {
  return {
    current_stage_echo: EXECUTION_SURFACES.REFINEMENT,
    role_id_echo: safeTrim(surfaceRequest?.blueprint?.meta?.scriptwriter_role),
    video_type_echo: safeTrim(surfaceRequest?.blueprint?.meta?.video_type),
    language_echo: surfaceRequest?.language || "ru"
  };
}

function validateAlignmentResponse(modelRaw) {
  const data = validateBaseModelObject(modelRaw, EXECUTION_SURFACES.ALIGNMENT);
  assertExactObjectKeys(data, new Set(["message", "questions"]), "alignment model response");
  assertNonEmptyModelString(data.message, "alignment message");
  if (!Array.isArray(data.questions) || data.questions.length !== 0) throw new Error("alignment questions must be empty");
  if (!hasAlignmentSentenceCount(data.message)) throw new Error("alignment message must contain 3-7 sentences");
  if (isForbiddenAlignmentPublicMessage(data.message)) throw new Error("alignment message contains forbidden content");
  return data;
}

function assertExactBuildTopLevelContract(data) {
  const keys = Object.keys(data);
  const forbiddenKeys = new Set([
    "final_result",
    "next_stage",
    "route_decision",
    "ready_hint",
    "response_stage",
    "system_state",
    "ready_for_final_assembly",
    "required_inputs_complete",
    "minimum_usable_readiness",
    "meta",
    "result_schema",
    "message",
    "questions",
    "blueprint_patch",
    "output",
  ]);

  for (const key of keys) {
    if (forbiddenKeys.has(key)) {
      throw new Error(`Forbidden build response key returned by model: ${key}`);
    }
  }

  if (keys.length !== 1 || keys[0] !== "blocks") {
    throw new Error("build model response must contain exactly one top-level key: blocks");
  }
}

function validateBuildResponse(modelRaw) {
  const data = validateBaseModelObject(modelRaw, EXECUTION_SURFACES.BUILD);

  assertExactBuildTopLevelContract(data);

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

function normalizeSceneIdeasResponse(validated) {
  return {
    output: {
      ideas: validated.ideas.map((idea) => ({
        slot: safeTrim(idea.slot).toLowerCase(),
        title: safeTrim(idea.title),
        seed_scene: safeTrim(idea.seed_scene),
        why_it_fits: safeTrim(idea.why_it_fits)
      }))
    }
  };
}

function normalizeSelectionResponse(validated, surfaceRequest) {
  const selectedScene = extractSelectedScene(surfaceRequest.user_input);
  const modelPatch = sanitizePatchByPolicy(validated.patch, EXECUTION_SURFACES.SELECTION);
  return {
    output: {
      message: safeTrim(validated.message),
      questions: normalizeQuestions(validated.questions, 1)
    },
    blueprint_patch: selectedScene ? { "scene_core.seed_scene": selectedScene } : (Object.keys(modelPatch).length ? modelPatch : null)
  };
}

function normalizeDevelopmentResponse(validated) {
  const status = validated.status;
  const output = {
    message: safeTrim(validated.message),
    questions: normalizeQuestions(validated.questions, 1)
  };

  if (status === STATUSES.BLOCKED) {
    return {
      status,
      output,
      blueprint_patch: null,
      error: null
    };
  }

  if (status === STATUSES.ERROR) {
    return {
      status,
      output: null,
      blueprint_patch: null,
      error: buildModelStatusError(status, validated, "DEVELOPMENT")
    };
  }

  const patch = sanitizePatchByPolicy(validated.patch, EXECUTION_SURFACES.DEVELOPMENT);
  return {
    status,
    output,
    blueprint_patch: Object.keys(patch).length ? patch : null,
    error: null
  };
}

function normalizeRefinementResponse(validated) {
  if (validated.status === STATUSES.BLOCKED) {
    return {
      status: STATUSES.BLOCKED,
      output: {
        message: normalizeRefinementPublicMessage(validated.message),
        user_intent_label: null,
        anchor_hint: null,
        selected_option_id: null,
        questions: [],
        options: []
      },
      blueprint_patch: null
    };
  }

  return {
    status: STATUSES.OK,
    output: {
      message: normalizeRefinementPublicMessage(validated.message),
      user_intent_label: validated.user_intent_label,
      anchor_hint: validated.anchor_hint || null,
      selected_option_id: validated.user_intent_label === "option_selection"
        ? validated.selected_option_id
        : null,
      questions: Array.isArray(validated.questions) ? validated.questions : [],
      options: Array.isArray(validated.options) ? validated.options : []
    },
    blueprint_patch: validated.blueprint_patch || null
  };
}

function normalizeRefinementPublicMessage(message) {
  return safeTrim(message);
}

function normalizeRefinementAnchorHint(value) {
  const normalized = safeTrim(value);
  return REFINEMENT_ALLOWED_ANCHORS.has(normalized) ? normalized : null;
}

function normalizeRefinementQuestions(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeRefinementQuestionCore).filter(Boolean);
}

function normalizeOptions(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeRefinementOptionCore).filter(Boolean);
}

function isForbiddenRefinementPublicMessage(message) {
  const normalized = safeTrim(message)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");

  const forbiddenPatterns = [
    /\baccepted decision\b/,
    /\bfinal decision\b/,
    /\bfinal concept\b/,
    /\bthe main idea will be\b/,
    /\bwe (are|will be|'re) making the video focus on\b/,
    /\bthe video will focus on\b/,
    /\bfinally fix(ing)?\b/,
    /\bfinal result will\b/,
    /принято решение/,
    /финально фиксируем/,
    /делаем видео с акцентом/,
    /основная идея будет/,
    /финальная концепция/,
    /финальный результат будет/
  ];

  return forbiddenPatterns.some((pattern) => pattern.test(normalized));
}

function getRefinementFallbackMessage() {
  return "";
}

function normalizeAlignmentResponse(validated) {
  return {
    output: {
      message: safeTrim(validated.message),
      questions: []
    },
    blueprint_patch: null
  };
}

function normalizeAlignmentPublicMessage(message) {
  return safeTrim(message);
}

function hasAlignmentSentenceCount(message) {
  const sentences = splitSentences(message);
  return sentences.length >= 3 && sentences.length <= 7 && sentences.every((sentence) => sentence.length <= 260);
}

function isForbiddenAlignmentPublicMessage(message) {
  const normalized = normalizeSemanticKey(message);
  const forbiddenPatterns = [
    /\bblueprint\b/, /\bsystem_state\b/, /\broute\b/, /\breadiness\b/, /\bnext_stage\b/,
    /\bbuild (is|has been) (launched|started|approved|authorized)\b/,
    /\bbuild уже (запущен|начат|разрешен|одобрен)\b/,
    /\bзапускаю build\b/, /\bфинальный результат уже собран\b/,
    /\bcanonical result (will be|is) directly (changed|mutated|updated)\b/,
    /напрямую\s+(?:изменю|обновлю|перезапишу)\s+(?:canonical|канонический)\s+result/,
    /\bstage\b/, /\bresult_schema\b/, /\bfinal_result\b/
  ];
  return forbiddenPatterns.some((pattern) => pattern.test(normalized));
}

function normalizeBuildResponse(validated, resultSchema = {}) {
  return {
    output: {
      blocks: normalizeBlocks(validated.blocks, getBuildAllowedBlocks(resultSchema))
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
    ...extras
  };
}

// ============================================================
// Patch discipline
// ============================================================

function sanitizePatchByPolicy(rawPatch, surface) {
  if (!isPlainObject(rawPatch)) return {};
  rejectForbiddenRouteKeys(rawPatch);
  assertPatchAllowed(rawPatch, surface, { allowEmpty: true });
  const flatPatch = flattenPatchObject(rawPatch);
  const sanitized = {};
  for (const [path, value] of Object.entries(flatPatch)) {
    sanitized[path] = sanitizePatchValue(value);
  }
  return sanitized;
}

function assertNoUnsafeRefinementPatchPaths(flatPatch) {
  const unsafePaths = Object.keys(flatPatch).filter(
    (path) =>
      !isAllowedPatchPath(path, EXECUTION_SURFACES.REFINEMENT) ||
      isForbiddenSystemPath(path)
  );

  if (unsafePaths.length > 0) {
    throw new Error(
      `Refinement patch contains forbidden/protected path: ${unsafePaths.join(", ")}`
    );
  }
}

function isAllowedPatchPath(path, surface) {
  if (surface === EXECUTION_SURFACES.SELECTION) {
    return SELECTION_ALLOWED_PATCH_PATHS.has(path);
  }

  if (surface === EXECUTION_SURFACES.DEVELOPMENT) {
    return DEVELOPMENT_ALLOWED_PATCH_PATHS.has(path);
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
    path.startsWith("marketing_layer.") ||
    path === "result_schema" ||
    path.startsWith("result_schema.") ||
    path === "blocks" ||
    path.startsWith("blocks.") ||
    path === "output.blocks" ||
    path.startsWith("output.blocks.")
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


function createIdentifierValidationError(field, value, stage, message) {
  const error = new Error(
    message || `Unknown non-empty identifier for ${field}: ${String(value)}`
  );
  error.code = "SETTINGS_IDENTIFIER_INVALID";
  error.field = field;
  error.value = value;
  error.stage = stage || null;
  return error;
}

function isEmptyIdentifierInput(value) {
  return value === null || value === undefined || (
    typeof value === "string" && value.trim() === ""
  );
}

function normalizeRole(value, stage) {
  if (isEmptyIdentifierInput(value)) return "creative_director";
  if (
    typeof value !== "string" ||
    !Object.prototype.hasOwnProperty.call(ROLE_LENSES, value)
  ) {
    throw createIdentifierValidationError("meta.scriptwriter_role", value, stage);
  }
  return value;
}

function normalizeVideoType(value, stage) {
  if (isEmptyIdentifierInput(value)) return "video";
  if (
    typeof value !== "string" ||
    !Object.prototype.hasOwnProperty.call(TYPE_LENSES, value)
  ) {
    throw createIdentifierValidationError("meta.video_type", value, stage);
  }
  return value;
}

function normalizeGoal(value, stage) {
  if (isEmptyIdentifierInput(value)) return "creative_concept";
  if (
    typeof value !== "string" ||
    !Object.prototype.hasOwnProperty.call(GOAL_LENSES, value)
  ) {
    throw createIdentifierValidationError("goal.video_goal", value, stage);
  }
  return value;
}

function normalizeEmotion(value, stage) {
  if (isEmptyIdentifierInput(value)) return "neutral";
  if (
    typeof value !== "string" ||
    !Object.prototype.hasOwnProperty.call(EMOTION_LENSES, value)
  ) {
    throw createIdentifierValidationError("visual_direction.emotion", value, stage);
  }
  return value;
}

function normalizeSceneAction(value, stage) {
  if (isEmptyIdentifierInput(value)) return null;
  if (
    typeof value !== "string" ||
    !Object.prototype.hasOwnProperty.call(SCENE_ACTION_LENSES, value)
  ) {
    throw createIdentifierValidationError("scene_core.scene_action", value, stage);
  }
  return value;
}

function normalizeAdvancedModules(items, stage) {
  const modules = [];
  const seen = new Set();

  for (const item of extractAdvancedModuleCandidates(items)) {
    if (typeof item !== "string" || !CANONICAL_ADVANCED_MODULE_KEYS.has(item)) {
      throw createIdentifierValidationError("extensions", item, stage);
    }
    if (seen.has(item)) continue;
    seen.add(item);
    modules.push(item);
  }

  return modules;
}

function normalizeNormalStageBlueprintIdentifiers(blueprintValue, stage) {
  const blueprint = JSON.parse(JSON.stringify(ensureObject(blueprintValue)));
  blueprint.meta = ensureObject(blueprint.meta);
  blueprint.goal = ensureObject(blueprint.goal);
  blueprint.scene_core = ensureObject(blueprint.scene_core);
  blueprint.visual_direction = ensureObject(blueprint.visual_direction);

  blueprint.meta.scriptwriter_role = normalizeRole(
    blueprint.meta.scriptwriter_role,
    stage
  );
  blueprint.meta.video_type = normalizeVideoType(
    blueprint.meta.video_type,
    stage
  );
  blueprint.goal.video_goal = normalizeGoal(
    blueprint.goal.video_goal,
    stage
  );
  blueprint.visual_direction.emotion = normalizeEmotion(
    blueprint.visual_direction.emotion,
    stage
  );
  blueprint.scene_core.scene_action = normalizeSceneAction(
    blueprint.scene_core.scene_action,
    stage
  );
  blueprint.extensions = normalizeBlueprintExtensions(
    blueprint.extensions,
    stage
  );

  return blueprint;
}

function normalizeBlueprintExtensions(extensionsValue, stage) {
  if (extensionsValue === null || extensionsValue === undefined) return {};
  if (!isPlainObject(extensionsValue)) {
    throw createIdentifierValidationError("extensions", extensionsValue, stage);
  }

  const normalized = {};
  for (const [rawKey, rawState] of Object.entries(extensionsValue)) {
    if (!CANONICAL_ADVANCED_MODULE_KEYS.has(rawKey)) {
      throw createIdentifierValidationError("extensions", rawKey, stage);
    }
    if (!isAdvancedSelectedState(rawState)) continue;
    normalized[rawKey] = isPlainObject(rawState)
      ? { ...rawState, enabled: true }
      : { enabled: true };
    delete normalized[rawKey].selected;
    delete normalized[rawKey].is_selected;
    delete normalized[rawKey].status;
    delete normalized[rawKey].state;
    delete normalized[rawKey].mode;
  }
  return normalized;
}

function hasLegacyAdvancedSelection(value) {
  if (!isPlainObject(value)) return false;
  return extractAdvancedModuleCandidates(value.selected).length > 0;
}

function buildCanonicalUiContext(blueprint) {
  return {
    video_type: blueprint?.meta?.video_type || null,
    scriptwriter_role: blueprint?.meta?.scriptwriter_role || null,
    video_topic: blueprint?.goal?.video_topic || null,
    video_goal: blueprint?.goal?.video_goal || null,
    emotion: blueprint?.visual_direction?.emotion || null,
    scene_action: blueprint?.scene_core?.scene_action || null,
    selected_extensions: extractSelectedExtensions(blueprint?.extensions)
  };
}

function deriveStageBehaviorDirectives(surfaceRequest, surface) {
  if (surface === EXECUTION_SURFACES.SCENE_IDEAS) return buildSceneIdeasBehaviorContext(surfaceRequest);
  if (surface === EXECUTION_SURFACES.DEVELOPMENT) return buildDevelopmentBehaviorContext(surfaceRequest);
  if (surface === EXECUTION_SURFACES.REFINEMENT) return buildRefinementBehaviorContext(surfaceRequest);
  if (surface === EXECUTION_SURFACES.ALIGNMENT) return buildAlignmentBehaviorContext(surfaceRequest);
  return null;
}

function buildSceneIdeasBehaviorContext(surfaceRequest) {
  const blueprint = ensureObject(surfaceRequest?.blueprint);
  const role = normalizeRole(blueprint?.meta?.scriptwriter_role, surfaceRequest?.stage);
  const videoType = normalizeVideoType(blueprint?.meta?.video_type, surfaceRequest?.stage);
  const goal = normalizeGoal(blueprint?.goal?.video_goal, surfaceRequest?.stage);
  const emotion = normalizeEmotion(blueprint?.visual_direction?.emotion, surfaceRequest?.stage);
  const sceneAction = normalizeSceneAction(
    blueprint?.scene_core?.scene_action,
    surfaceRequest?.stage
  );
  const advancedModules = getBehaviorAdvancedModules(surfaceRequest);

  const sceneIdeasBehavior = [
    ROLE_SCENE_IDEAS_DIRECTIVES[role],
    TYPE_SCENE_IDEAS_DIRECTIVES[videoType],
    GOAL_SCENE_IDEAS_DIRECTIVES[goal],
    EMOTION_SCENE_IDEAS_DIRECTIVES[emotion],
    sceneAction ? SCENE_ACTION_SCENE_IDEAS_DIRECTIVES[sceneAction] : null,
    buildAdvancedSceneIdeasDirective(advancedModules),
    "Keep advanced options as intent only: no new questions, no new patch paths, no readiness impact, no extensions data, no root advanced_modules and no Build blocks.",
    "Return exactly 3 ideas in slots precise, variation and creative; do not change the response shape."
  ].filter(Boolean).slice(0, 8);

  return {
    stage: EXECUTION_SURFACES.SCENE_IDEAS,
    output_language: surfaceRequest?.language || "ru",
    role,
    video_type: videoType,
    video_goal: goal,
    emotion,
    scene_action: sceneAction || null,
    advanced_modules: advancedModules,
    role_lens: ROLE_LENSES[role],
    type_lens: TYPE_LENSES[videoType],
    goal_lens: GOAL_LENSES[goal],
    emotion_lens: EMOTION_LENSES[emotion],
    scene_action_lens: sceneAction ? SCENE_ACTION_LENSES[sceneAction] : "none / optional",
    advanced_lens: buildAdvancedLens(advancedModules),
    scene_ideas_behavior: sceneIdeasBehavior
  };
}

function buildDevelopmentBehaviorContext(surfaceRequest) {
  const blueprint = ensureObject(surfaceRequest?.blueprint);
  const role = normalizeRole(blueprint?.meta?.scriptwriter_role, surfaceRequest?.stage);
  const videoType = normalizeVideoType(blueprint?.meta?.video_type, surfaceRequest?.stage);
  const goal = normalizeGoal(blueprint?.goal?.video_goal, surfaceRequest?.stage);
  const emotion = normalizeEmotion(blueprint?.visual_direction?.emotion, surfaceRequest?.stage);
  const sceneAction = normalizeSceneAction(
    blueprint?.scene_core?.scene_action,
    surfaceRequest?.stage
  );
  const advancedModules = getBehaviorAdvancedModules(surfaceRequest);

  const developmentBehavior = [
    ROLE_DEVELOPMENT_DIRECTIVES[role],
    TYPE_DEVELOPMENT_DIRECTIVES[videoType],
    GOAL_DEVELOPMENT_DIRECTIVES[goal],
    emotion
      ? EMOTION_DEVELOPMENT_DIRECTIVES[emotion]
      : "Use neutral emotional handling; do not invent an extra emotion requirement.",
    sceneAction ? SCENE_ACTION_DEVELOPMENT_DIRECTIVES[sceneAction] : null,
    buildAdvancedDevelopmentDirective(advancedModules),
    "Keep advanced options as intent only: no new questions, no new patch paths, no readiness impact, no extensions data, no root advanced_modules.",
    "Return Development only and patch only scene_core.main_focus, narrative.scene_setup and narrative.scene_development."
  ].filter(Boolean).slice(0, 8);

  return {
    stage: EXECUTION_SURFACES.DEVELOPMENT,
    output_language: surfaceRequest?.language || "ru",
    role,
    video_type: videoType,
    video_goal: goal,
    emotion: emotion || null,
    scene_action: sceneAction || null,
    advanced_modules: advancedModules,
    role_lens: ROLE_LENSES[role],
    type_lens: TYPE_LENSES[videoType],
    goal_lens: GOAL_LENSES[goal],
    emotion_lens: emotion ? EMOTION_LENSES[emotion] : "neutral / no extra emotion bias",
    scene_action_lens: sceneAction ? SCENE_ACTION_LENSES[sceneAction] : "none / optional",
    advanced_lens: buildAdvancedLens(advancedModules),
    development_behavior: developmentBehavior
  };
}

function getSelectedAdvancedModules(surfaceRequest) {
  return normalizeAdvancedModules(
    extractSelectedExtensions(surfaceRequest?.blueprint?.extensions),
    surfaceRequest?.stage
  );
}

function getBehaviorAdvancedModules(surfaceRequest) {
  return getSelectedAdvancedModules(surfaceRequest).filter((moduleId) =>
    PRE_BUILD_BEHAVIOR_MODULE_KEYS.includes(moduleId)
  );
}

function extractSelectedExtensions(extensions) {
  if (!isPlainObject(extensions)) return [];

  const selected = [];
  for (const [key, value] of Object.entries(extensions)) {
    if (isAdvancedSelectedState(value)) {
      selected.push(key);
    }
  }
  return selected;
}

function buildAdvancedLens(modules) {
  if (!Array.isArray(modules) || modules.length === 0) {
    return "No selected advanced behavior lens.";
  }

  return modules
    .map((moduleId) => ADVANCED_MODULE_LENSES[moduleId])
    .filter(Boolean)
    .join(", ");
}

function buildAdvancedStageDirectives(modules, directiveMap) {
  if (!Array.isArray(modules) || modules.length === 0) return [];
  return modules.map((moduleId) => directiveMap[moduleId]).filter(Boolean);
}

function buildAdvancedSceneIdeasDirective(modules) {
  const directives = buildAdvancedStageDirectives(
    modules,
    ADVANCED_SCENE_IDEAS_DIRECTIVES
  );
  return directives.length ? directives.join(" ") : null;
}

function buildAdvancedDevelopmentDirective(modules) {
  const directives = buildAdvancedStageDirectives(
    modules,
    ADVANCED_DEVELOPMENT_DIRECTIVES
  );
  return directives.length ? directives.join(" ") : null;
}

function extractAdvancedModuleCandidates(items) {
  if (items == null) return [];

  if (Array.isArray(items)) {
    return items.flatMap((item) => extractAdvancedModuleCandidates(item));
  }

  if (typeof items === "string") {
    return items
      .split(/[,\n;]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (!isPlainObject(items)) {
    return [];
  }

  const nestedCandidateArrays = [
    items.selected,
    items.items,
    items.modules,
    items.enabled,
    items.values
  ];

  const nested = nestedCandidateArrays
    .filter((value) => Array.isArray(value))
    .flatMap((value) => extractAdvancedModuleCandidates(value));

  const entryCandidates = [];
  for (const [key, value] of Object.entries(items)) {
    if (key === "selected" || key === "items" || key === "modules" || key === "enabled" || key === "values") {
      continue;
    }

    if (isAdvancedSelectedState(value)) {
      entryCandidates.push(key);
      continue;
    }

    if (typeof value === "string" && !isPlainObject(value)) {
      entryCandidates.push(value);
    }
  }

  const selfCandidate = readLookupCandidate(items);
  return uniqueStrings([...nested, ...entryCandidates, selfCandidate].filter(Boolean));
}

function isAdvancedSelectedState(value) {
  if (value === true) return true;

  if (typeof value === "string") {
    const key = toLookupKey(value);
    return key === "selected" || key === "enabled" || key === "true" || key === "on";
  }

  if (!isPlainObject(value)) return false;

  if (value.enabled === true || value.selected === true || value.is_selected === true) {
    return true;
  }

  const status = toLookupKey(value.status || value.state || value.mode);
  return status === "selected" || status === "enabled" || status === "on";
}

function toLookupKey(value) {
  const candidate = readLookupCandidate(value);

  return String(candidate || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/&/g, " and ")
    .replace(/[—–-]+/g, " ")
    .replace(/[\/]+/g, " ")
    .replace(/[()[\]{}'"`.,:;!?]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function readLookupCandidate(value) {
  if (!isPlainObject(value)) return value;

  return (
    value.canonical_id ??
    value.current_code_value ??
    value.id ??
    value.value ??
    value.key ??
    value.code ??
    value.name ??
    value.label ??
    value.title ??
    ""
  );
}

function uniqueStrings(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    if (typeof item !== "string" || !item) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    result.push(item);
  }

  return result;
}

function buildDevelopmentContext(surfaceRequest) {
  const blueprint = ensureObject(surfaceRequest?.blueprint);

  return {
    selected_scene: safeTrim(blueprint?.scene_core?.seed_scene),
    concept_line: safeTrim(blueprint?.scene_core?.concept_line),
    video_topic: safeTrim(blueprint?.goal?.video_topic),
    video_goal: safeTrim(blueprint?.goal?.video_goal),
    video_type: safeTrim(blueprint?.meta?.video_type),
    scriptwriter_role: safeTrim(blueprint?.meta?.scriptwriter_role),
    emotion: blueprint?.visual_direction?.emotion ?? null,
    scene_action: safeTrim(blueprint?.scene_core?.scene_action),
    known_inputs: ensureObject(blueprint?.system_state?.known_inputs),
    current_stage: blueprint?.system_state?.current_stage || EXECUTION_SURFACES.DEVELOPMENT,
    development_owns: [
      "scene_core.main_focus",
      "narrative.scene_setup",
      "narrative.scene_development"
    ],
    forbidden_patch_paths: [
      "scene_core.seed_scene",
      "system_state.*",
      "meta.*",
      "extensions.*",
      "participants.*",
      "environment.*",
      "technical_layer.*",
      "marketing_layer.*",
      "result_schema",
      "blocks",
      "output.blocks"
    ]
  };
}

function getModelPatchObject(data) {
  if (!isPlainObject(data)) return null;
  if (isPlainObject(data.patch)) return data.patch;
  if (isPlainObject(data.blueprint_patch)) return data.blueprint_patch;
  return null;
}

function normalizeModelStatus(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return STATUSES.OK;
  }

  const status = String(value).trim().toLowerCase();

  if (status === STATUSES.OK) return STATUSES.OK;
  if (status === STATUSES.BLOCKED) return STATUSES.BLOCKED;
  if (status === STATUSES.ERROR) return STATUSES.ERROR;

  return STATUSES.ERROR;
}

function buildModelStatusError(status, _validated, codePrefix) {
  const code = status === STATUSES.BLOCKED
    ? `${codePrefix}_BLOCKED`
    : `${codePrefix}_ERROR`;
  const message = status === STATUSES.BLOCKED
    ? "Development is temporarily blocked."
    : "Development failed.";
  return { code, message };
}

function rejectForbiddenDevelopmentTopLevelKeys(data) {
  const forbiddenTopLevelKeys = new Set([
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
    "response_stage",
    "system_state",
    "ready_for_final_assembly",
    "required_inputs_complete",
    "minimum_usable_readiness",
    "meta",
    "extensions",
    "participants",
    "environment",
    "technical_layer",
    "marketing_layer",
    "result_schema",
    "blocks"
  ]);

  for (const key of Object.keys(ensureObject(data))) {
    if (key === "patch" || key === "blueprint_patch") continue;
    if (forbiddenTopLevelKeys.has(key)) {
      throw new Error(`Forbidden development response key returned by model: ${key}`);
    }
  }

  if (isPlainObject(data.output) && isPlainObject(data.output.blocks)) {
    throw new Error("Forbidden development response key returned by model: output.blocks");
  }
}

function buildSelectionGuidanceContext(surfaceRequest, selectedScene) {
  return {
    selected_scene: safeTrim(selectedScene),
    missing_guided_fields: getSelectionMissingGuidedFields(surfaceRequest?.blueprint, selectedScene),
    allowed_guided_fields: [
      "narrative.scene_setup",
      "narrative.scene_development",
      "visual_direction.emotion"
    ],
    patch_boundary: [
      "scene_core.seed_scene"
    ]
  };
}

function getSelectionMissingGuidedFields(blueprint, selectedScene) {
  const effectiveSeedScene = safeTrim(selectedScene) || safeTrim(blueprint?.scene_core?.seed_scene);
  const fieldValues = [
    ["narrative.scene_setup", blueprint?.narrative?.scene_setup],
    ["narrative.scene_development", blueprint?.narrative?.scene_development],
    ["visual_direction.emotion", blueprint?.visual_direction?.emotion]
  ];

  const missing = fieldValues
    .filter(([, value]) => !safeTrim(value))
    .map(([path]) => path);

  if (!effectiveSeedScene) {
    missing.unshift("scene_core.seed_scene");
  }

  return missing;
}





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





function normalizeQuestions(value, max = 1) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeTrim(item)).filter(Boolean).slice(0, max);
}

function normalizeBlocks(blocks, allowedBlocks = null) {
  const next = {};
  const allowedSet = Array.isArray(allowedBlocks)
    ? new Set(allowedBlocks)
    : null;

  for (const [key, value] of Object.entries(ensureObject(blocks))) {
    if (allowedSet && !allowedSet.has(key)) continue;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) continue;
      next[key] = trimmed;
      continue;
    }

    if (
      isPlainObject(value) &&
      typeof value.text === "string"
    ) {
      const trimmed = value.text.trim();
      if (!trimmed) continue;
      next[key] = trimmed;
    }
  }

  return next;
}

function getBuildAllowedBlocks(resultSchema) {
  return Array.isArray(resultSchema?.blocks)
    ? resultSchema.blocks.map((block) => safeTrim(block)).filter(Boolean)
    : [];
}

function hasBuildAllowedBlocks(resultSchema) {
  return getBuildAllowedBlocks(resultSchema).length > 0;
}

function hasNonEmptyBuildBlocks(blocks) {
  return Object.keys(ensureObject(blocks)).length > 0;
}

function buildBuildSurfaceErrorEnvelope({ surfaceRequest, code, message }) {
  return buildJsonEnvelope({
    stage: EXECUTION_SURFACES.BUILD,
    status: STATUSES.ERROR,
    output: {
      blocks: {}
    },
    meta: buildMeta(surfaceRequest, { patch_allowed: false }),
    blueprint_patch: null,
    error: {
      code,
      message
    }
  });
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

function extractRawSelectionText(userInput) {
  if (!isPlainObject(userInput)) {
    return "";
  }

  if (typeof userInput.raw_text !== "string") {
    return "";
  }

  return userInput.raw_text.trim();
}

function logBuildDiagnostic(level, eventName, details) {
  const payload = {
    patch: "stage3_patch8",
    surface: EXECUTION_SURFACES.BUILD,
    event: eventName,
    ...ensureObject(details)
  };
  const writer = level === "warn" ? console.warn : console.debug;

  try {
    writer.call(console, "[SW_PATCH8_BUILD_DIAGNOSTICS]", payload);
  } catch (_) {
    // Diagnostics must never affect Build execution.
  }
}

function buildBuildRequestDiagnostic(surfaceRequest, rawSchema) {
  const blueprint = ensureObject(surfaceRequest?.blueprint);
  const meta = ensureObject(blueprint.meta);
  const systemState = ensureObject(blueprint.system_state);
  const requestMeta = ensureObject(surfaceRequest?.meta);

  return {
    request_stage: normalizeDiagnosticString(surfaceRequest?.stage) || null,
    blueprint_current_stage: normalizeDiagnosticString(systemState.current_stage) || null,
    video_type: normalizeDiagnosticString(meta.video_type) || normalizeDiagnosticString(requestMeta.video_type) || null,
    role_id: normalizeDiagnosticString(meta.scriptwriter_role) || normalizeDiagnosticString(meta.role_id) || normalizeDiagnosticString(requestMeta.role_id) || null,
    language: normalizeDiagnosticString(surfaceRequest?.language) || normalizeDiagnosticString(meta.language) || null,
    meta_result_schema_exists: isPlainObject(rawSchema),
    result_schema: buildResultSchemaDiagnostic(rawSchema)
  };
}

function buildResultSchemaDiagnostic(schema) {
  const blockCharacterBudget = isPlainObject(schema?.block_character_budget)
    ? schema.block_character_budget
    : {};
  const allowedBlocks = Array.isArray(schema?.blocks)
    ? schema.blocks.map((block) => normalizeDiagnosticString(block)).filter(Boolean)
    : [];

  return {
    exists: isPlainObject(schema),
    keys: getPlainObjectKeys(schema),
    allowed_block_ids: allowedBlocks,
    allowed_block_count: allowedBlocks.length,
    block_character_budget_keys: Object.keys(blockCharacterBudget),
    selected_advanced_options_count: Array.isArray(schema?.selected_advanced_options)
      ? schema.selected_advanced_options.length
      : 0
  };
}

function buildBuildModelRawDiagnostic(modelRaw) {
  const rawText = typeof modelRaw?.raw_text === "string" ? modelRaw.raw_text : "";
  return {
    raw_text_length: rawText.length,
    raw_text_preview: buildDiagnosticPreview(rawText),
    parse_success: isPlainObject(modelRaw?.parsed_json),
    parsed_top_level_keys: getPlainObjectKeys(modelRaw?.parsed_json)
  };
}

function buildBuildParsedDiagnostic(parsed) {
  const data = ensureObject(parsed);
  const blocks = isPlainObject(data.blocks) ? data.blocks : null;
  const output = isPlainObject(data.output) ? data.output : null;
  const outputBlocks = isPlainObject(output?.blocks) ? output.blocks : null;

  return {
    top_level_keys: getPlainObjectKeys(data),
    output_keys: getPlainObjectKeys(output),
    blocks_keys: getPlainObjectKeys(blocks),
    output_blocks_keys: getPlainObjectKeys(outputBlocks),
    has_top_level_blocks_object: isPlainObject(blocks),
    has_output_object: isPlainObject(output),
    has_output_blocks_object: isPlainObject(outputBlocks)
  };
}

function buildBuildNormalizationDiagnostic(validated, normalized, resultSchema) {
  const allowedBlockIds = getBuildAllowedBlocks(resultSchema);
  const parsedBlockKeys = getPlainObjectKeys(validated?.blocks);
  const normalizedBlocks = ensureObject(normalized?.output?.blocks);
  const normalizedBlockIds = Object.keys(normalizedBlocks);
  const droppedOrIgnoredBlockKeys = parsedBlockKeys.filter((key) => !normalizedBlockIds.includes(key));

  return {
    allowed_block_ids: allowedBlockIds,
    parsed_block_keys: parsedBlockKeys,
    normalized_block_ids: normalizedBlockIds,
    normalized_block_count: normalizedBlockIds.length,
    dropped_or_ignored_block_keys: droppedOrIgnoredBlockKeys,
    parsed_blocks_outside_allowed_schema: parsedBlockKeys.filter((key) => !allowedBlockIds.includes(key))
  };
}

function buildBuildEmptyBlocksDiagnostic(validated, normalized, resultSchema) {
  const parsedBlocks = isPlainObject(validated?.blocks) ? validated.blocks : null;
  const parsedBlockKeys = getPlainObjectKeys(parsedBlocks);
  const allowedBlockIds = getBuildAllowedBlocks(resultSchema);
  const allowedSet = new Set(allowedBlockIds);
  const allowedBlockMatches = parsedBlockKeys.filter((key) => allowedSet.has(key));
  const normalizedBlockIds = Object.keys(ensureObject(normalized?.output?.blocks));

  return {
    parsed_output_missing: !isPlainObject(validated?.output),
    output_blocks_missing: !isPlainObject(validated?.output?.blocks),
    top_level_blocks_missing: !isPlainObject(parsedBlocks),
    blocks_object_empty: parsedBlockKeys.length === 0,
    allowed_block_ids_mismatch: parsedBlockKeys.length > 0 && allowedBlockMatches.length === 0,
    allowed_block_matches_count: allowedBlockMatches.length,
    normalized_blocks_empty: normalizedBlockIds.length === 0
  };
}

function getPlainObjectKeys(value) {
  return isPlainObject(value) ? Object.keys(value) : [];
}

function normalizeDiagnosticString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function buildDiagnosticPreview(value, limit = BUILD_DIAGNOSTIC_PREVIEW_LIMIT) {
  const text = typeof value === "string" ? value : "";
  const normalized = text.replace(/\s+/g, " ").trim();

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit)}…`;
}

function validateBuildResultSchemaContext(rawSchema) {
  if (rawSchema == null) {
    return {
      ok: false,
      code: "BUILD_RESULT_SCHEMA_MISSING",
      message: "Build result schema is missing."
    };
  }

  if (!isPlainObject(rawSchema)) {
    return {
      ok: false,
      code: "BUILD_RESULT_SCHEMA_INVALID",
      message: "Build result schema must be an object."
    };
  }

  const requiredKeys = [
    "version",
    "plan_tier",
    "video_type",
    "density_mode",
    "text_budget_total",
    "blocks",
    "block_character_budget",
  ];

  const allowedKeys = new Set([
    ...requiredKeys,
    "selected_advanced_options",
  ]);

  for (const key of requiredKeys) {
    if (!Object.prototype.hasOwnProperty.call(rawSchema, key)) {
      return {
        ok: false,
        code: "BUILD_RESULT_SCHEMA_INVALID",
        message: `Build result schema key is missing: ${key}`
      };
    }
  }

  for (const key of Object.keys(rawSchema)) {
    if (!allowedKeys.has(key)) {
      return {
        ok: false,
        code: "BUILD_RESULT_SCHEMA_INVALID",
        message: `Build result schema contains forbidden key: ${key}`
      };
    }
  }

  const blocks = Array.isArray(rawSchema.blocks)
    ? rawSchema.blocks.map((block) => safeTrim(block)).filter(Boolean)
    : [];

  if (!blocks.length) {
    return {
      ok: false,
      code: "BUILD_RESULT_SCHEMA_INVALID",
      message: "Build result schema must contain a non-empty blocks array."
    };
  }

  if (new Set(blocks).size !== blocks.length) {
    return {
      ok: false,
      code: "BUILD_RESULT_SCHEMA_INVALID",
      message: "Build result schema blocks must be unique."
    };
  }

  const textBudgetTotal = Number(rawSchema.text_budget_total);
  if (!Number.isFinite(textBudgetTotal) || textBudgetTotal <= 0) {
    return {
      ok: false,
      code: "BUILD_RESULT_SCHEMA_INVALID",
      message: "Build result schema text_budget_total must be a positive number."
    };
  }

  if (!isPlainObject(rawSchema.block_character_budget)) {
    return {
      ok: false,
      code: "BUILD_RESULT_SCHEMA_INVALID",
      message: "Build result schema block_character_budget must be an object."
    };
  }

  for (const [blockKey, budget] of Object.entries(rawSchema.block_character_budget)) {
    const normalizedBlockKey = safeTrim(blockKey);

    if (!blocks.includes(normalizedBlockKey)) {
      return {
        ok: false,
        code: "BUILD_RESULT_SCHEMA_INVALID",
        message: `Build result schema budget key is not allowed: ${blockKey}`
      };
    }

    const numericBudget = Number(budget);
    if (
      !Number.isFinite(numericBudget) ||
      numericBudget <= 0 ||
      !Number.isInteger(numericBudget)
    ) {
      return {
        ok: false,
        code: "BUILD_RESULT_SCHEMA_INVALID",
        message: `Build result schema budget must be a positive integer: ${blockKey}`
      };
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(rawSchema, "selected_advanced_options") &&
    !Array.isArray(rawSchema.selected_advanced_options)
  ) {
    return {
      ok: false,
      code: "BUILD_RESULT_SCHEMA_INVALID",
      message: "Build result schema selected_advanced_options must be an array."
    };
  }

  return { ok: true };
}

function safeResultSchemaSnapshot(value) {
  const schema = value;
  const blocks = schema.blocks.map((block) => safeTrim(block)).filter(Boolean);
  const blockCharacterBudget = {};

  for (const block of blocks) {
    if (Object.prototype.hasOwnProperty.call(schema.block_character_budget, block)) {
      blockCharacterBudget[block] = Math.trunc(Number(schema.block_character_budget[block]));
    }
  }

  return {
    version: safeTrim(schema.version) || "v1",
    plan_tier: safeTrim(schema.plan_tier) || "free",
    video_type: safeTrim(schema.video_type) || "video",
    density_mode: safeTrim(schema.density_mode) || "compact",
    text_budget_total: Math.trunc(Number(schema.text_budget_total)),
    blocks,
    block_character_budget: blockCharacterBudget,
    selected_advanced_options: Array.isArray(schema.selected_advanced_options)
      ? schema.selected_advanced_options.map((item) => safeTrim(item)).filter(Boolean)
      : [],
  };
}

function buildBuildSchemaPrompt(resultSchema, language) {
  const allowedBlocks = Array.isArray(resultSchema.blocks)
    ? resultSchema.blocks
    : [];
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
      "- Any block not listed in allowed_blocks is forbidden.",
      "- expected_result_composition:",
      ...compositionLines,
      "- Return blocks only under blocks.",
      "- Do not add blocks outside allowed_blocks.",
      "- If a block is not allowed, omit it completely.",
      "- If one allowed block cannot be generated, omit only that block.",
      "- If allowed_blocks is non-empty, do not return an empty blocks object.",
      "- Generate every possible allowed block from the Blueprint."
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
    "- Любой блок, которого нет в allowed_blocks, запрещён.",
    "- expected_result_composition:",
    ...compositionLines,
    "- Возвращай блоки только внутри blocks.",
    "- Не добавляй блоки вне allowed_blocks.",
    "- Если блок не разрешён, полностью пропусти его.",
    "- Если один разрешённый блок невозможно сгенерировать, пропусти только этот блок.",
    "- Если allowed_blocks непустой, не возвращай пустой объект blocks.",
    "- Сгенерируй каждый возможный разрешённый блок из Blueprint."
  ].join("\n");
}

// ============================================================
// Validation guards against route behavior
// ============================================================

function rejectForbiddenRouteKeys(obj) {
  const paths = collectObjectPaths(obj);

  for (const path of paths) {
    const last = path.split(".").pop();
    if (FORBIDDEN_ROUTE_KEYS.has(path) || FORBIDDEN_ROUTE_KEYS.has(last)) {
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


function buildTrustedBriefContext(surfaceRequest) {
  const blueprint = ensureObject(surfaceRequest?.blueprint);
  return {
    language: surfaceRequest?.language || "ru",
    role: normalizeRole(blueprint?.meta?.scriptwriter_role, surfaceRequest?.stage),
    video_type: normalizeVideoType(blueprint?.meta?.video_type, surfaceRequest?.stage),
    video_goal: normalizeGoal(blueprint?.goal?.video_goal, surfaceRequest?.stage),
    video_topic: safeTrim(blueprint?.goal?.video_topic),
    emotion: normalizeEmotion(blueprint?.visual_direction?.emotion, surfaceRequest?.stage),
    scene_action: normalizeSceneAction(blueprint?.scene_core?.scene_action, surfaceRequest?.stage) || null,
    selected_advanced_modules: getBehaviorAdvancedModules(surfaceRequest),
    known_inputs: ensureObject(blueprint?.system_state?.known_inputs)
  };
}

function buildTrustedWorkingScene(blueprintValue) {
  const blueprint = ensureObject(blueprintValue);
  return {
    seed_scene: safeTrim(blueprint?.scene_core?.seed_scene),
    main_focus: safeTrim(blueprint?.scene_core?.main_focus),
    scene_setup: safeTrim(blueprint?.narrative?.scene_setup),
    scene_development: safeTrim(blueprint?.narrative?.scene_development),
    emotion: normalizeEmotion(blueprint?.visual_direction?.emotion, null),
    goal: normalizeGoal(blueprint?.goal?.video_goal, null)
  };
}

function buildRefinementBehaviorContext(surfaceRequest) {
  const brief = buildTrustedBriefContext(surfaceRequest);
  const state = ensureObject(surfaceRequest?.blueprint?.system_state?.refinement_state);
  const activeAnchor = safeTrim(state.active_anchor) || null;
  const openAnchor = state.open_anchor === true;
  const refinementAdvancedDirectives = openAnchor
    ? buildAdvancedStageDirectives(
        brief.selected_advanced_modules,
        ADVANCED_REFINEMENT_DIRECTIVES
      )
    : [];

  return {
    ...brief,
    selected_advanced_modules: openAnchor ? brief.selected_advanced_modules : [],
    advanced_refinement_directives: refinementAdvancedDirectives,
    active_anchor: activeAnchor,
    open_anchor: openAnchor,
    pending_options: state.pending_options === true,
    options_context: Array.isArray(state.options_context) ? state.options_context.slice(0, 4) : null,
    open_question: state.open_question === true,
    question_context: isPlainObject(state.question_context) ? state.question_context : null,
    hold_or_not_ready: state.hold_or_not_ready === true,
    latest_trusted_intent: safeTrim(state.last_user_intent) || null,
    last_anchor_hint: safeTrim(state.anchor_hint) || null
  };
}

function buildAlignmentBehaviorContext(surfaceRequest) {
  const brief = buildTrustedBriefContext(surfaceRequest);
  return {
    ...brief,
    advanced_alignment_directives: buildAdvancedStageDirectives(
      brief.selected_advanced_modules,
      ADVANCED_ALIGNMENT_DIRECTIVES
    ),
    working_scene: buildTrustedWorkingScene(surfaceRequest?.blueprint),
    role_lens: ROLE_LENSES[brief.role],
    type_lens: TYPE_LENSES[brief.video_type]
  };
}

function assertStringQuestionArray(value, max, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  if (value.length > max) throw new Error(`${label} contains too many questions`);
  for (const item of value) assertNonEmptyModelString(item, label);
}

function assertPatchAllowed(rawPatch, surface, { allowEmpty = true } = {}) {
  if (!isPlainObject(rawPatch)) throw new Error("patch must be a plain object");
  rejectForbiddenRouteKeys(rawPatch);
  const flatPatch = flattenPatchObject(rawPatch);
  const paths = Object.keys(flatPatch);
  if (!allowEmpty && paths.length === 0) throw new Error("patch must not be empty");
  for (const path of paths) {
    if (!isAllowedPatchPath(path, surface) || isForbiddenSystemPath(path)) {
      throw new Error(`Patch contains forbidden/protected path: ${path}`);
    }
    const value = sanitizePatchValue(flatPatch[path]);
    if (typeof value === "string" && !value) throw new Error(`Patch value is empty: ${path}`);
  }
}

function hasMeaningfulPatch(rawPatch) {
  if (!isPlainObject(rawPatch)) return false;
  const flat = flattenPatchObject(rawPatch);
  return Object.values(flat).some((value) => {
    if (typeof value === "string") return Boolean(value.trim());
    if (Array.isArray(value)) return value.length > 0;
    return value !== null && value !== undefined;
  });
}

function splitSentences(message) {
  return safeTrim(message).split(/[.!?…]+|[。！？]+/u).map((item) => item.trim()).filter(Boolean);
}

function assertDevelopmentHandoff(message) {
  const sentences = splitSentences(message);
  if (sentences.length < 2) throw new Error("development message needs content and handoff");
  const tail = sentences[sentences.length - 1];
  const originalTail = safeTrim(message).slice(Math.max(0, safeTrim(message).lastIndexOf(tail)));
  if (originalTail.includes("?")) throw new Error("development handoff must not be a question");
  const normalized = normalizeSemanticKey(tail);
  if (/\b(route|alignment|build|readiness|final assembly|final_result|stage)\b/.test(normalized) || /\b(маршрут|этап|готовность|финальная сборка|билд)\b/.test(normalized)) {
    throw new Error("development handoff contains forbidden process language");
  }
}

function normalizeSemanticKey(value) {
  return safeTrim(value).normalize("NFKC").toLowerCase().replace(/ё/g, "е").replace(/[“”«»]/g, '"').replace(/\s+/g, " ");
}

// ============================================================
// Low-level utils
// ============================================================

function detectLanguageFromModelRaw(modelRaw) {
  const rawText = String(modelRaw?.raw_text || "").toLowerCase();

  if (rawText.includes("english")) {
    return "en";
  }

  return "ru";
}



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
