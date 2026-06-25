// /api/script-v2.js
// Contract Freeze v1 — implementation
// Corrective pass after integration audit: Patch Contract v1 fixed exactly

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

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
  "ready_for_final_assembly",
  "required_inputs_complete",
  "minimum_usable_readiness",
  "system_state",
  "refinement_state",
  "current_stage",
  "build_allowed",
  "can_build",
  "final_result",
  "result_schema",
  "meta.result_schema"
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
  "visual_direction.emotion",
  "visual_direction.visual_style",
  "visual_direction.atmosphere",
  "visual_direction.lighting",
  "visual_direction.color_palette",
  "visual_direction.composition_notes",
  "participants.main_character",
  "participants.secondary_characters",
  "participants.product_entity",
  "participants.narrator",
  "environment.location",
  "environment.time_of_day",
  "environment.setting_style",
  "environment.world_details",
  "environment.scale",
  "technical_layer.camera_direction",
  "technical_layer.shot_type",
  "technical_layer.motion",
  "technical_layer.timing_structure",
  "technical_layer.edit_logic",
  "marketing_layer.message",
  "marketing_layer.product_focus",
  "marketing_layer.cta",
  "marketing_layer.conversion_goal",
  "marketing_layer.brand_tone"
]);

const ALIGNMENT_ALLOWED_PATCH_PATHS = new Set([]);

// Development-only Behavior Directives v1.1
// Field-scoped canonicalization only. Do not replace with a shared normalizeValue().
const ROLE_ALIASES = Object.freeze({
  creative_director: "creative_director",
  creative_director_role: "creative_director",
  cinematic: "creative_director",
  nika: "creative_director",
  nika_creative_director: "creative_director",
  commercial_strategist: "commercial_strategist",
  commercial: "commercial_strategist",
  viral: "commercial_strategist",
  max: "commercial_strategist",
  max_commercial_strategist: "commercial_strategist",
  cinematographer: "cinematographer",
  camera: "cinematographer",
  brand: "cinematographer",
  sara: "cinematographer",
  sara_cinematographer: "cinematographer",
  film_director: "film_director",
  director: "film_director",
  interactive: "film_director",
  zhora: "film_director",
  zhora_film_director: "film_director"
});

const VIDEO_TYPE_ALIASES = Object.freeze({
  video: "video",
  promo: "promo",
  промо: "promo",
  interactive: "interactive",
  interactive_pro: "interactive",
  интерактив: "interactive",
  интерактив_pro: "interactive",
  video_prompt: "video_prompt",
  image_prompt: "image_prompt"
});

const GOAL_ALIASES = Object.freeze({
  product_service: "product_service",
  product: "product_service",
  service: "product_service",
  товар_услуга: "product_service",
  brand_video: "brand_video",
  brand: "brand_video",
  бренд_видео: "brand_video",
  promotion_ad: "promotion_ad",
  promotion: "promotion_ad",
  ad: "promotion_ad",
  promo: "promotion_ad",
  продвижение_реклама: "promotion_ad",
  presentation_pitch: "presentation_pitch",
  presentation: "presentation_pitch",
  pitch: "presentation_pitch",
  презентация_питч: "presentation_pitch",
  youtube_social: "social_media",
  youtube: "social_media",
  social: "social_media",
  social_media: "social_media",
  соцсети: "social_media",
  youtube_соцсети: "social_media",
  explainer_education: "education_explainer",
  education_explainer: "education_explainer",
  explainer: "education_explainer",
  education: "education_explainer",
  объяснение_обучение: "education_explainer",
  story_narrative: "story_narrative",
  story: "story_narrative",
  narrative: "story_narrative",
  история_нарратив: "story_narrative",
  creative_concept: "creative_concept",
  creative: "creative_concept",
  concept: "creative_concept",
  креатив_концепт: "creative_concept",
  general: "creative_concept"
});

const EMOTION_ALIASES = Object.freeze({
  epic: "epic",
  эпично: "epic",
  inspiring: "inspiring",
  inspirational: "inspiring",
  вдохновляюще: "inspiring",
  technological: "technological",
  технологично: "technological",
  mysterious: "mysterious",
  таинственно: "mysterious",
  calm: "calm",
  спокойно: "calm",
  energetic: "energetic",
  энергично: "energetic",
  minimal: "minimalist",
  minimalist: "minimalist",
  минималистично: "minimalist",
  dreamlike: "dreamlike",
  сновидчески: "dreamlike",
  neutral: "neutral"
});

const SCENE_ACTION_ALIASES = Object.freeze({
  reveal: "reveal",
  journey: "journey",
  transformation: "transformation",
  interaction: "interaction",
  presentation: "presentation",
  discovery: "discovery",
  choice: "choice",
  system_awakening: "system_awakening"
});

const ADVANCED_MODULE_ALIASES = Object.freeze({
  characters: "characters",
  characters_pro: "characters",
  voice_over: "voice_over",
  voiceover: "voice_over",
  voice_over_pro: "voice_over",
  camera_details: "camera_details",
  camera_details_pro: "camera_details",
  camera_plan: "camera_details",
  camera_plan_pro: "camera_details",
  video_prompt: "video_prompt",
  video_prompts: "video_prompt",
  video_prompt_pro: "video_prompt",
  video_prompts_pro: "video_prompt",
  branching: "branching",
  branching_choices: "branching",
  branching_choices_pro: "branching",
  cta_strategy: "cta_strategy",
  cta: "cta_strategy",
  cta_strategy_pro: "cta_strategy",
  image_prompt: "image_prompt",
  scene_prompt: "image_prompt",
  scene_prompts: "image_prompt",
  scene_prompts_pro: "image_prompt",
  dialogue: "dialogue",
  dialogue_mode: "dialogue",
  dialogue_mode_pro: "dialogue"
});

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

  const modelInput = buildSceneIdeasInput(surfaceRequest);
  const modelRaw = await callModel(modelInput);
  console.log("=== SCENE IDEAS RAW ===");
  console.log(modelRaw && modelRaw.raw_text);
  console.log("=== SCENE IDEAS PARSED ===");
  console.log(modelRaw && modelRaw.parsed_json);

  const coercedModelRaw = coerceSceneIdeasModelRaw(modelRaw);
  console.log("=== SCENE IDEAS AFTER COERCE ===");
  console.log(coercedModelRaw && coercedModelRaw.parsed_json);

  const validated = validateSceneIdeasResponse(coercedModelRaw);
  const normalized = normalizeSceneIdeasResponse(validated, surfaceRequest);

  return buildJsonEnvelope({
    stage: EXECUTION_SURFACES.SCENE_IDEAS,
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
    stage: EXECUTION_SURFACES.SELECTION,
    status: STATUSES.OK,
    output: normalized.output,
    meta: buildMeta(surfaceRequest, { patch_allowed: true }),
    blueprint_patch: normalized.blueprint_patch,
    error: null
  });
}

async function executeDevelopment(surfaceRequest) {
  assertDevelopmentRequest(surfaceRequest);

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
}

async function executeRefinement(surfaceRequest) {
  assertRefinementRequest(surfaceRequest);

  const modelInput = buildRefinementInput(surfaceRequest);
  const modelRaw = await callModel(modelInput);
  const validated = validateRefinementResponse(modelRaw);
  const normalized = normalizeRefinementResponse(validated, surfaceRequest.language);

  return buildJsonEnvelope({
    stage: EXECUTION_SURFACES.REFINEMENT,
    status: STATUSES.OK,
    output: normalized.output,
    meta: buildMeta(surfaceRequest, {
      patch_allowed: true,
      base_blueprint_revision_echo: normalizeBaseBlueprintRevisionEcho(
        surfaceRequest?.meta?.base_blueprint_revision
      )
    }),
    blueprint_patch: normalized.blueprint_patch,
    error: null
  });
}

async function executeAlignment(surfaceRequest) {
  assertAlignmentRequest(surfaceRequest);

  const modelInput = buildAlignmentInput(surfaceRequest);
  const modelRaw = await callModel(modelInput);
  const validated = validateAlignmentResponse(modelRaw);
  const normalized = normalizeAlignmentResponse(validated, surfaceRequest.language);

  return buildJsonEnvelope({
    stage: EXECUTION_SURFACES.ALIGNMENT,
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

  const schemaValidation = validateBuildResultSchemaContext(
    surfaceRequest?.meta?.result_schema
  );

  if (schemaValidation.ok !== true) {
    return buildBuildSurfaceErrorEnvelope({
      surfaceRequest,
      code: schemaValidation.code,
      message: schemaValidation.message,
    });
  }

  const resultSchema = safeResultSchemaSnapshot(surfaceRequest.meta.result_schema);

  if (!hasBuildAllowedBlocks(resultSchema)) {
    return buildBuildSurfaceErrorEnvelope({
      surfaceRequest,
      code: "BUILD_RESULT_SCHEMA_EMPTY",
      message: "Build result schema has no allowed blocks."
    });
  }

  const modelInput = buildBuildInput(surfaceRequest, resultSchema);

  const modelRaw = await callModel(modelInput);

  console.log("=== BUILD RAW ===");
  console.log(modelRaw && modelRaw.raw_text);

  console.log("=== BUILD PARSED ===");
  console.log(modelRaw && modelRaw.parsed_json);

  const validated = validateBuildResponse(modelRaw);

  console.log("=== BUILD VALIDATED ===");
  console.log(validated);

  const normalized = normalizeBuildResponse(validated, resultSchema);

  console.log("=== BUILD NORMALIZED ===");
  console.log(normalized?.output?.blocks);

  if (!hasNonEmptyBuildBlocks(normalized?.output?.blocks)) {
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
                  "Return ONLY this JSON shape:",
                  '{ "ideas": [ { "slot": "precise", "title": "...", "seed_scene": "...", "why_it_fits": "..." }, { "slot": "variation", "title": "...", "seed_scene": "...", "why_it_fits": "..." }, { "slot": "creative", "title": "...", "seed_scene": "...", "why_it_fits": "..." } ] }',
                  "The top-level JSON object must contain exactly one key: ideas.",
                  "ideas must be an array.",
                  "ideas must contain exactly 3 objects.",
                  "Each idea must contain: slot, title, seed_scene, why_it_fits.",
                  "Allowed slots are exactly: precise, variation, creative.",
                  "Do not wrap ideas inside another object.",
                  "Do not return output.",
                  "Do not return message.",
                  "Do not return questions.",
                  "Do not return patch.",
                  "Do not return blueprint_patch.",
                  "Do not return route decisions.",
                  "Do not return blueprint patch.",
                  "Apply the provided Scene Ideas behavior context as content emphasis only.",
                  "Use role, video type, goal, emotion, scene action and selected advanced modules only to sharpen the first 3 ideas.",
                  "Advanced options are intent only: no questions, no patch paths, no readiness impact, no extensions data, no root advanced_modules and no Build blocks.",
                  "Do not quote the behavior context in the user-facing ideas.",
                  "No markdown."
                ].join("\n")
              : [
                  "Ты работаешь только для текущего этапа: scene_ideas.",
                  "Верни только JSON.",
                  "Верни ТОЛЬКО JSON этой формы:",
                  '{ "ideas": [ { "slot": "precise", "title": "...", "seed_scene": "...", "why_it_fits": "..." }, { "slot": "variation", "title": "...", "seed_scene": "...", "why_it_fits": "..." }, { "slot": "creative", "title": "...", "seed_scene": "...", "why_it_fits": "..." } ] }',
                  "Верхний уровень JSON object должен содержать ровно один ключ: ideas.",
                  "ideas должен быть массивом.",
                  "ideas должен содержать ровно 3 объекта.",
                  "Каждая идея должна содержать: slot, title, seed_scene, why_it_fits.",
                  "Допустимые slots строго: precise, variation, creative.",
                  "Не оборачивай ideas внутрь другого объекта.",
                  "Не возвращай output.",
                  "Не возвращай message.",
                  "Не возвращай questions.",
                  "Не возвращай patch.",
                  "Не возвращай blueprint_patch.",
                  "Не возвращай route decisions.",
                  "Не возвращай blueprint patch.",
                  "Применяй переданный Scene Ideas behavior context только как смысловой акцент качества.",
                  "Используй роль, тип видео, цель, эмоцию, сценическое действие и выбранные advanced-модули только для усиления первых 3 идей.",
                  "Advanced options — только intent: без questions, без новых patch paths, без readiness impact, без extensions data, без root advanced_modules и без Build blocks.",
                  "Не цитируй behavior context в пользовательских идеях.",
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
            `Scene Ideas behavior context:\n${compact(behaviorContext)}\n\n` +
            `Advanced options:\n${compact(surfaceRequest.advanced_options)}`
        }
      ]
    }
  ];
}

function buildSelectionInput(surfaceRequest) {
  const lang = surfaceRequest.language;
  const selectedScene = extractSelectedScene(surfaceRequest.user_input);
  const selectionGuidance = buildSelectionGuidanceContext(surfaceRequest, selectedScene);

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
                  "You work only for the current stage: selection.",
                  "Selection is not route ownership.",
                  "Return JSON only.",
                  "No route decisions.",
                  "Selection must fix the selected scene and immediately return guided continuation for the current server response.",
                  "Required response shape:",
                  '{ "message": "short transition bridge", "questions": ["one next guided question"], "patch": { ...optional } }',
                  "message must be a non-empty string and must briefly acknowledge the selected scene as the basis for further work.",
                  "questions must be an array with exactly one short, concrete next question unless no meaningful question is needed.",
                  "The question must be based on the current Blueprint and the missing guided fields supplied in the user payload.",
                  "Ask only about information that can affect the next refinement quality.",
                  "Do not ask for route approval, build permission, or stage transition.",
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
                  "Selection должен зафиксировать выбранную сцену и сразу вернуть guided continuation в текущем server response.",
                  "Обязательная форма ответа:",
                  '{ "message": "короткий transition bridge", "questions": ["один следующий guided question"], "patch": { ...optional } }',
                  "message — обязательная непустая строка и должен кратко подтвердить выбранную сцену как основу дальнейшей работы.",
                  "questions — массив ровно с одним коротким конкретным следующим вопросом, если содержательный вопрос ещё нужен.",
                  "Вопрос должен опираться на текущий Blueprint и missing guided fields из user payload.",
                  "Спрашивай только о данных, которые влияют на качество следующего refinement.",
                  "Не спрашивай подтверждение маршрута, разрешение на build или переход этапа.",
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
            `Blueprint:\n${compact(surfaceRequest.blueprint)}\n\n` +
            `Selected scene content:\n${selectedScene}\n\n` +
            `Selection guidance context:\n${compact(selectionGuidance)}\n\n` +
            `User input:\n${compact(surfaceRequest.user_input)}\n\n` +
            `Advanced options:\n${compact(surfaceRequest.advanced_options)}`
        }
      ]
    }
  ];
}
function buildDevelopmentInput(surfaceRequest) {
  const lang = surfaceRequest.language;
  const developmentContext = buildDevelopmentContext(surfaceRequest);
  const behaviorContext = deriveStageBehaviorDirectives(surfaceRequest, EXECUTION_SURFACES.DEVELOPMENT);

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
                  "You work only for the current stage: development.",
                  "Return JSON only.",
                  "No route decisions.",
                  "No next_stage, route, route_decision, go_to_alignment, go_to_build or ready_hint.",
                  "No readiness logic.",
                  "Do not launch alignment.",
                  "Do not launch build.",
                  "Do not write system_state.",
                  "Development is not route ownership; it only develops the selected scene.",
                  'Required JSON shape: { "status": "ok", "message": "developed selected scene", "questions": [], "patch": {} }',
                  "status must be ok unless the selected scene cannot be safely developed; blocked must remain blocked and must not be converted to ok.",
                  "message must be a non-empty string and must show how the selected scene is being developed.",
                  "message must first develop the selected scene with concrete story material.",
                  "message must end with exactly one short handoff sentence.",
                  "The handoff sentence must speak directly to the user: You can clarify details, change direction, confirm the current basis, or write: \"do what you think is best\".",
                  "Keep the handoff inside message only; do not put it into questions.",
                  "The handoff must not mention refinement, alignment, build, route decisions, readiness, final result, or final assembly.",
                  "The handoff must not ask a question and must not turn Development into interviewer mode.",
                  "questions must be an array; default to an empty array.",
                  "Ask a question only if the selected scene cannot be safely developed without it.",
                  "Do not be an interviewer.",
                  "Do not ask empty continuation questions.",
                  "Do not collect missing inputs.",
                  "Do not open 3 new scene ideas.",
                  "Do not behave as Commentary Mode.",
                  "Generate concrete story material: visible action, event, conflict, character choice, reveal, state change, and cause-and-effect development.",
                  "Apply the provided Development behavior context as content emphasis only.",
                  "Use role, video type, goal, emotion, scene action and selected advanced modules only to sharpen Development quality.",
                  "Behavior context must not create questions, route changes, readiness changes, patch paths, extensions data, root advanced_modules or Build blocks.",
                  "Do not quote the behavior context in the user-facing message.",
                  "Describe what happens in the scene, not what the scene should achieve.",
                  "Development owns only these patch paths:",
                  "- scene_core.main_focus",
                  "- narrative.scene_setup",
                  "- narrative.scene_development",
                  "patch must fill all three allowed paths whenever possible.",
                  "scene_core.main_focus must state the main dramatic focus of the selected scene as concrete story focus, not an abstract theme.",
                  "narrative.scene_setup must contain the opening story situation as concrete story material.",
                  "narrative.scene_development must contain the next cause-and-effect development of the selected scene.",
                  "Do not patch scene_core.seed_scene.",
                  "Do not patch goal fields.",
                  "Do not patch meta, extensions, participants, environment, technical_layer, marketing_layer, result_schema, blocks, output.blocks, or system_state.",
                  "Do not return conditional sections.",
                  "No markdown."
                ].join("\n")
              : [
                  "Ты работаешь только для текущего этапа: development.",
                  "Верни только JSON.",
                  "Без route decisions.",
                  "Не возвращай next_stage, route, route_decision, go_to_alignment, go_to_build или ready_hint.",
                  "Без readiness logic.",
                  "Не запускай alignment.",
                  "Не запускай build.",
                  "Не пиши system_state.",
                  "Development не владеет маршрутом; он только развивает выбранную сцену.",
                  'Обязательная JSON-форма: { "status": "ok", "message": "развитая выбранная сцена", "questions": [], "patch": {} }',
                  "status должен быть ok, кроме случаев, когда выбранную сцену невозможно безопасно развить; blocked должен оставаться blocked и не должен превращаться в ok.",
                  "message должен быть непустой строкой и должен показывать, как развивается выбранная сцена.",
                  "message сначала должен развить выбранную сцену конкретным сюжетным материалом.",
                  "message должен заканчиваться ровно одним коротким handoff-предложением.",
                  "Handoff-предложение должно обращаться напрямую к пользователю: Можешь уточнить детали, изменить направление, подтвердить текущую основу или написать: “сделай как лучше”.",
                  "Держи handoff только внутри message; не выноси его в questions.",
                  "Handoff не должен упоминать refinement, alignment, build, route decisions, readiness, финальный результат или финальную сборку.",
                  "Handoff не должен быть вопросом и не должен превращать Development в interviewer mode.",
                  "questions должен быть массивом; по умолчанию возвращай пустой массив.",
                  "Задавай вопрос только если без него невозможно безопасно развить выбранную сцену.",
                  "Не будь интервьюером.",
                  "Не задавай пустые вопросы ради продолжения.",
                  "Не собирай missing inputs.",
                  "Не открывай заново 3 идеи сцены.",
                  "Не переходи в Commentary Mode.",
                  "Создавай конкретный сюжетный материал: видимое действие, событие, конфликт, выбор персонажа, открытие, изменение состояния и причинно-следственное развитие.",
                  "Применяй переданный Development behavior context только как смысловой акцент качества.",
                  "Используй роль, тип видео, цель, эмоцию, сценическое действие и выбранные advanced-модули только для усиления качества Development.",
                  "Behavior context не должен создавать вопросы, route changes, readiness changes, patch paths, extensions data, root advanced_modules или Build blocks.",
                  "Не цитируй behavior context в пользовательском message.",
                  "Описывай, что происходит в сцене, а не чего сцена должна добиться.",
                  "Development владеет только этими patch paths:",
                  "- scene_core.main_focus",
                  "- narrative.scene_setup",
                  "- narrative.scene_development",
                  "patch должен закрывать все три разрешённых path, когда это возможно.",
                  "scene_core.main_focus должен фиксировать главный драматургический фокус выбранной сцены как конкретный сюжетный фокус, а не абстрактную тему.",
                  "narrative.scene_setup должен содержать стартовую сюжетную ситуацию как конкретный сюжетный материал.",
                  "narrative.scene_development должен содержать следующее причинно-следственное развитие выбранной сцены.",
                  "Не patch scene_core.seed_scene.",
                  "Не patch goal fields.",
                  "Не patch meta, extensions, participants, environment, technical_layer, marketing_layer, result_schema, blocks, output.blocks или system_state.",
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
            `Development context:\n${compact(developmentContext)}\n\n` +
            `Development behavior context:\n${compact(behaviorContext)}\n\n` +
            `User input:\n${compact(surfaceRequest.user_input)}\n\n` +
            `Advanced options:\n${compact(surfaceRequest.advanced_options)}`
        }
      ]
    }
  ];
}

function formatAllowedPatchPathsForPrompt(allowedPaths) {
  return Array.from(allowedPaths)
    .map((path) => `- ${path}`)
    .join("\n");
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
                  "Output fields: message, user_intent_label, anchor_hint, questions, options, patch.",
                  'Required JSON shape: { "message": "short current-stage message", "user_intent_label": "one allowed label", "anchor_hint": "string or null", "questions": [], "options": [], "patch": {} }',
                  "message must always be present as a non-empty string.",
                  "Use exactly one user_intent_label from this allowed list: brief_or_context, option_selection, actionable_change, unclear_dissatisfaction, ready_to_continue, wants_more_options, asks_question, hold_or_not_ready, alternative_request, new_cycle_request, off_topic_or_unclear.",
                  "Label guidance: brief_or_context = user gives additional brief/context without clear action; option_selection = user selects one offered option; actionable_change = user asks for a concrete change inside current refinement; unclear_dissatisfaction = user is unsure, dissatisfied, or says they do not know; ready_to_continue = user explicitly confirms readiness to continue; wants_more_options = user asks for more variants/options; asks_question = user asks a question back; hold_or_not_ready = user explicitly says not to proceed / not ready; alternative_request = user asks for another approach but not necessarily new cycle; new_cycle_request = user explicitly asks for new scene / new story / start over; off_topic_or_unclear = input is off-topic or impossible to classify.",
                  "anchor_hint is required as a key and may be a string, null, or \"unknown\".",
                  "Return at most one question. questions must be [] or [\"one short question\"].",
                  "Return options only when the user asks for alternatives or when options are more appropriate than a question. options must contain at most 4 objects with option_id and title, and optional description.",
                  "Do not include route, stage, readiness, system_state, refinement_state, final_result, result_schema, or build decisions.",
                  "Primary behavior order: Infer -> Propose -> Patch -> Ask.",
                  "An empty field is not an automatic reason to ask a question.",
                  "First extract the maximum available information from Blueprint, user_input and advanced_options.",
                  "If a value can be reasonably inferred without distorting the user's intent and fits the allowed Refinement patch scope, you may return it through patch.",
                  "Refinement is a working patch step, not the final trust or alignment layer.",
                  "You may independently infer and patch only narrow safe Refinement fields that are explicitly allowed.",
                  "Do not ask about decisions a professional scriptwriter can make: basic emotion, opening situation, scene development, pace, dramatic accent.",
                  "message must describe current-stage processing only: acknowledge the input, say the working scene direction was updated, and prepare it for pre-final alignment.",
                  "message must not start with an accepted scriptwriting decision.",
                  "message must not sound like final fixation, final concept approval, or an explanation of the future final result.",
                  "Forbidden message wording includes: 'Accepted decision', 'Final decision', 'We are making the video focus on', 'The main idea will be', 'Final concept', and full explanations of what the final result will contain.",
                  "The final explanation of what was decided and why belongs to alignment, not refinement.",
                  "A question is allowed only when the missing answer could change the video goal, the meaning of the scene, or the selected direction.",
                  "If a question is needed, ask at most one short, concrete question.",
                  "If a question is asked, keep message limited to the current refinement update, then ask the single question.",
                  "Even when a question is needed, return the fullest valid patch for every field that can already be closed.",
                  "questions must be empty if patch already closes the current stage well enough.",
                  "Allowed Refinement patch paths only:",
                  formatAllowedPatchPathsForPrompt(REFINEMENT_ALLOWED_PATCH_PATHS),
                  "Do not change scene_core.seed_scene.",
                  "Do not change goal.video_topic or goal.video_goal.",
                  "Do not change meta, system_state, refinement_state, extensions, result_schema, final_result, blocks, route/readiness/build fields.",
                  "narrative.scene_setup and narrative.scene_development are working Blueprint fields and may be updated when the user requests a local refinement inside the selected seed_scene.",
                  "Preserve selected seed_scene as the base.",
                  "If the user asks for a completely new scene/story/product/goal/type, classify as new_cycle_request and do not patch seed_scene in this response.",
                  "You may patch allowed participants/environment/visual_direction/technical_layer/marketing_layer fields listed above.",
                  "Do not patch arbitrary nested keys outside the exact whitelist.",
                  "Return a safe all-or-nothing patch only.",
                  "No markdown."
                ].join("\n")
              : [
                  "Ты работаешь только для текущего этапа: refinement.",
                  "Верни только JSON.",
                  "Без route decisions.",
                  "Без readiness logic.",
                  "Верни только output текущего этапа.",
                  "Поля output: message, user_intent_label, anchor_hint, questions, options, patch.",
                  'Обязательная JSON-форма: { "message": "короткое сообщение текущего этапа", "user_intent_label": "одна разрешённая метка", "anchor_hint": "строка или null", "questions": [], "options": [], "patch": {} }',
                  "message должен присутствовать всегда и быть непустой строкой.",
                  "Используй ровно один user_intent_label из разрешённого списка: brief_or_context, option_selection, actionable_change, unclear_dissatisfaction, ready_to_continue, wants_more_options, asks_question, hold_or_not_ready, alternative_request, new_cycle_request, off_topic_or_unclear.",
                  "Подсказка по меткам: brief_or_context = пользователь даёт дополнительный бриф/контекст без ясного действия; option_selection = выбирает один из предложенных вариантов; actionable_change = просит конкретное изменение внутри текущего refinement; unclear_dissatisfaction = сомневается, недоволен или говорит «не знаю»; ready_to_continue = явно подтверждает готовность продолжать; wants_more_options = просит больше вариантов; asks_question = задаёт встречный вопрос; hold_or_not_ready = явно просит не продолжать / не готов; alternative_request = просит другой подход, но не обязательно новый цикл; new_cycle_request = явно просит новую сцену / новую историю / начать заново; off_topic_or_unclear = ввод не по теме или невозможно классифицировать.",
                  "anchor_hint обязателен как ключ и может быть строкой, null или \"unknown\".",
                  "Верни максимум один question. questions должны быть [] или [\"один короткий вопрос\"].",
                  "Возвращай options только когда пользователь просит альтернативы или варианты уместнее вопроса. options — максимум 4 объекта с option_id и title, опционально description.",
                  "Не включай route, stage, readiness, system_state, refinement_state, final_result, result_schema или решения о Build.",
                  "Главный порядок работы: Infer -> Propose -> Patch -> Ask.",
                  "Пустое поле не является автоматической причиной задавать вопрос.",
                  "Сначала извлекай максимум информации из Blueprint, user_input и advanced_options.",
                  "Если значение можно разумно вывести без искажения замысла пользователя и оно входит в разрешённый scope Refinement patch, можешь вернуть его через patch.",
                  "Refinement — это рабочий patch-step, а не финальный trust-layer и не Alignment.",
                  "Ты можешь самостоятельно выводить и патчить только узкие безопасные поля Refinement, которые явно разрешены.",
                  "Не спрашивай о том, что сценарист может профессионально решить сам: базовая эмоция, начальная ситуация, развитие сцены, темп, драматургический акцент.",
                  "message должен описывать только обработку текущего этапа: что ввод понят, рабочая основа сцены обновлена и сцена подготовлена к предфинальному согласованию.",
                  "message не должен начинаться с принятого сценарного решения.",
                  "message не должен звучать как финальная фиксация, утверждение финальной концепции или объяснение будущего финального результата.",
                  "Запрещённые формулировки в message: 'Принято решение', 'Финально фиксируем', 'Делаем видео с акцентом', 'Основная идея будет', 'Финальная концепция' и полноценные объяснения того, каким будет финал.",
                  "Финальное объяснение, что именно решено и почему, принадлежит Alignment, не Refinement.",
                  "Вопрос разрешён только если без ответа есть риск изменить цель видео, смысл сцены или выбранное направление.",
                  "Если вопрос нужен, задай максимум один короткий конкретный вопрос.",
                  "Если вопрос задаётся, ограничь message текущим refinement-обновлением, затем задай единственный вопрос.",
                  "Даже если вопрос нужен, верни максимально полный валидный patch по всем полям, которые уже можно закрыть.",
                  "questions должны быть пустыми, если patch уже достаточно хорошо закрывает текущий этап.",
                  "Разрешённые patch paths для Refinement только:",
                  formatAllowedPatchPathsForPrompt(REFINEMENT_ALLOWED_PATCH_PATHS),
                  "Не меняй scene_core.seed_scene.",
                  "Не меняй goal.video_topic или goal.video_goal.",
                  "Не меняй meta, system_state, refinement_state, extensions, result_schema, final_result, blocks, route/readiness/build fields.",
                  "narrative.scene_setup и narrative.scene_development — рабочие Blueprint fields; их можно обновлять при локальном refinement внутри выбранной seed_scene.",
                  "Сохраняй выбранную seed_scene как базу.",
                  "Если пользователь просит полностью новую сцену/историю/продукт/цель/тип, классифицируй как new_cycle_request и не патчь seed_scene в этом ответе.",
                  "Можно патчить только перечисленные выше allowed participants/environment/visual_direction/technical_layer/marketing_layer fields.",
                  "Не патчь произвольные вложенные ключи вне exact whitelist.",
                  "Возвращай только безопасный all-or-nothing patch.",
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
                  "Write only the current pre-final message for the user.",
                  "Return JSON only.",
                  "Required JSON shape: { \"message\": \"...\" }.",
                  "The key \"message\" is mandatory.",
                  "message must be a non-empty string.",
                  "message must sound like a scriptwriter speaking directly to the user, not like a system report.",
                  "message must contain 4-7 short sentences.",
                  "message must start from direct understanding, for example: I understood the task this way...",
                  "message must name 2-3 decisions that are already fixed from the current scene data: selected scene, goal, emotional direction, story setup, or development logic.",
                  "message must explain what kind of result you will assemble when the user clicks the button, using result categories rather than writing the final script.",
                  "message must softly tell the user: if everything fits, click “Build LiVi structure”.",
                  "message must say that after the result appears, the user will be able to fine-tune the needed parts.",
                  "Do not expose internal data names, raw JSON key names, process labels, or technical status labels in message.",
                  "Do not write like an impersonal system.",
                  "Do not write that any assembly is allowed, approved, already launched, or already finished.",
                  "Do not return a patch.",
                  "Do not open new branches or new options.",
                  "Do not ask broad new questions.",
                  "Do not turn the message into the final script or final deliverable.",
                  "No markdown."
                ].join("\n")
              : [
                  "Пиши только текущее предфинальное сообщение для пользователя.",
                  "Верни только JSON.",
                  "Обязательная JSON-форма: { \"message\": \"...\" }.",
                  "Ключ \"message\" обязателен.",
                  "message должен быть непустой строкой.",
                  "message должен звучать как живая прямая речь сценариста к пользователю, а не как системный отчёт.",
                  "message должен содержать 4–7 коротких предложений.",
                  "message должен начинаться с прямого понимания, например: Я понял задачу так...",
                  "message должен назвать 2–3 уже зафиксированных решения из текущих данных сцены: выбранную сцену, цель, эмоциональное направление, старт ситуации или логику развития.",
                  "message должен объяснить, какой результат ты соберёшь после нажатия кнопки, через категории результата, а не через написание финального сценария.",
                  "message должен мягко сказать пользователю: если всё подходит, нажми “Собрать структуру LiVi”.",
                  "message должен сказать, что после появления результата можно будет точечно доработать нужные части.",
                  "Не раскрывай внутренние названия данных, сырые имена JSON-ключей, процессные ярлыки или технические статусы в message.",
                  "Не пиши обезличенным системным тоном.",
                  "Не пиши, что какая-либо сборка разрешена, одобрена, уже запущена или уже завершена.",
                  "Не возвращай patch.",
                  "Не открывай новые ветки или новые варианты.",
                  "Не задавай широких новых вопросов.",
                  "Не превращай message в финальный сценарий или финальный результат.",
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
            `Current scene data:\n${compact(surfaceRequest.blueprint)}\n\n` +
            `User input:\n${compact(surfaceRequest.user_input)}\n\n` +
            `Advanced options:\n${compact(surfaceRequest.advanced_options)}`
        }
      ]
    }
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

function coerceSceneIdeasModelRaw(modelRaw) {
  const parsed = modelRaw && modelRaw.parsed_json;
  const ideas = extractSceneIdeasArray(parsed);

  if (Array.isArray(ideas)) {
    return {
      ...modelRaw,
      parsed_json: {
        ideas
      }
    };
  }

  return modelRaw;
}

function extractSceneIdeasArray(parsed) {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (!isPlainObject(parsed)) {
    return null;
  }

  const candidates = [
    parsed.ideas,
    parsed.scene_ideas,
    parsed.output?.ideas,
    parsed.output?.scene_ideas,
    parsed.data?.ideas,
    parsed.result?.ideas,
    parsed.response?.ideas
  ];

  return candidates.find(Array.isArray) || null;
}

function validateSceneIdeasResponse(modelRaw) {
  const data = validateBaseModelObject(modelRaw, EXECUTION_SURFACES.SCENE_IDEAS);

  if (!Array.isArray(data.ideas)) {
    throw new Error("scene_ideas model response must contain ideas array");
  }

  return data;
}

function validateSelectionResponse(modelRaw) {
  const data = validateBaseModelObject(modelRaw, EXECUTION_SURFACES.SELECTION);

  if (typeof data.message !== "string" || !data.message.trim()) {
    throw new Error("selection model response must contain message");
  }

  if (!Array.isArray(data.questions)) {
    throw new Error("selection model response must contain questions array");
  }

  if (data.patch != null && !isPlainObject(data.patch)) {
    throw new Error("selection patch must be an object");
  }

  return data;
}

function validateDevelopmentResponse(modelRaw) {
  const data = validateBaseModelObject(modelRaw, EXECUTION_SURFACES.DEVELOPMENT);

  rejectForbiddenDevelopmentTopLevelKeys(data);

  if (typeof data.message !== "string" || !data.message.trim()) {
    throw new Error("development model response must contain message");
  }

  if (data.status != null) {
    data.status = normalizeModelStatus(data.status);
  }

  if (data.questions != null && !Array.isArray(data.questions)) {
    throw new Error("development questions must be an array");
  }

  const rawPatch = getModelPatchObject(data);
  if (rawPatch != null && !isPlainObject(rawPatch)) {
    throw new Error("development patch must be an object");
  }

  return data;
}

function validateRefinementResponse(modelRaw) {
  const data = validateBaseModelObject(modelRaw, EXECUTION_SURFACES.REFINEMENT);

  if (typeof data.message !== "string" || !data.message.trim()) {
    throw new Error("refinement model response must contain message");
  }

  if (typeof data.user_intent_label !== "string" || !data.user_intent_label.trim()) {
    throw new Error("refinement model response must contain user_intent_label");
  }

  if (!REFINEMENT_INTENT_LABELS.has(data.user_intent_label.trim())) {
    throw new Error(`refinement user_intent_label is not allowed: ${data.user_intent_label}`);
  }

  if (
    data.anchor_hint != null &&
    typeof data.anchor_hint !== "string"
  ) {
    throw new Error("refinement anchor_hint must be a string or null");
  }

  if (data.questions != null && !Array.isArray(data.questions)) {
    throw new Error("refinement questions must be an array");
  }

  if (Array.isArray(data.questions)) {
    if (data.questions.length > 1) {
      throw new Error("refinement questions must contain at most one question");
    }

    for (const question of data.questions) {
      if (typeof question !== "string" || !question.trim()) {
        throw new Error("refinement questions must contain non-empty strings");
      }
    }
  }

  if (data.options != null && !Array.isArray(data.options)) {
    throw new Error("refinement options must be an array");
  }

  if (Array.isArray(data.options)) {
    if (data.options.length > 4) {
      throw new Error("refinement options must contain at most four options");
    }

    for (const option of data.options) {
      if (!isPlainObject(option)) {
        throw new Error("refinement options must contain objects");
      }

      if (typeof option.option_id !== "string" || !option.option_id.trim()) {
        throw new Error("refinement option must contain option_id");
      }

      if (typeof option.title !== "string" || !option.title.trim()) {
        throw new Error("refinement option must contain title");
      }

      if (option.description != null && typeof option.description !== "string") {
        throw new Error("refinement option description must be a string");
      }
    }
  }

  if (data.patch != null && !isPlainObject(data.patch)) {
    throw new Error("refinement patch must be an object");
  }

  if (data.blueprint_patch != null && !isPlainObject(data.blueprint_patch)) {
    throw new Error("refinement blueprint_patch must be an object");
  }

  return data;
}

function validateAlignmentResponse(modelRaw) {
  const data = validateBaseModelObject(modelRaw, EXECUTION_SURFACES.ALIGNMENT);
  const language = detectLanguageFromModelRaw(modelRaw);

  if (typeof data.message !== "string" || !data.message.trim()) {
    data.message = getAlignmentFallbackMessage(language);
  }

  if (data.questions != null && !Array.isArray(data.questions)) {
    throw new Error("alignment questions must be an array");
  }

  if (data.patch != null && !isPlainObject(data.patch)) {
    throw new Error("alignment patch must be an object");
  }

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
  const modelPatch = sanitizePatchByPolicy(validated.patch, EXECUTION_SURFACES.SELECTION);
  const normalizedQuestions = normalizeQuestions(validated.questions);
  const questions = normalizedQuestions.length
    ? normalizedQuestions.slice(0, 1)
    : buildSelectionFallbackQuestions(surfaceRequest, selectedScene);

  return {
    output: {
      message: safeTrim(validated.message),
      questions
    },
    blueprint_patch: selectedScene
      ? { "scene_core.seed_scene": selectedScene }
      : modelPatch
  };
}

function normalizeDevelopmentResponse(validated) {
  const status = normalizeModelStatus(validated.status);
  const patch = sanitizePatchByPolicy(getModelPatchObject(validated), EXECUTION_SURFACES.DEVELOPMENT);

  return {
    status,
    output: {
      message: safeTrim(validated.message),
      questions: normalizeQuestions(validated.questions)
    },
    blueprint_patch: patch,
    error: status === STATUSES.OK
      ? null
      : buildModelStatusError(status, validated, "DEVELOPMENT")
  };
}

function normalizeRefinementResponse(validated, language) {
  const patch = sanitizePatchByPolicy(getModelPatchObject(validated), EXECUTION_SURFACES.REFINEMENT);

  return {
    output: {
      message: normalizeRefinementPublicMessage(validated.message, language),
      user_intent_label: validated.user_intent_label.trim(),
      anchor_hint: normalizeRefinementAnchorHint(validated.anchor_hint),
      questions: normalizeRefinementQuestions(validated.questions),
      options: normalizeOptions(validated.options)
    },
    blueprint_patch: patch
  };
}

function normalizeRefinementPublicMessage(message, language) {
  const text = safeTrim(message);

  if (!text || isForbiddenRefinementPublicMessage(text)) {
    return getRefinementFallbackMessage(language);
  }

  return text;
}

function normalizeRefinementAnchorHint(value) {
  if (value == null) return null;
  const text = safeTrim(value);
  return text || null;
}

function normalizeRefinementQuestions(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeTrim(item)).filter(Boolean);
}

function normalizeOptions(value) {
  if (!Array.isArray(value)) return [];

  return value.map((option) => {
    const normalized = {
      option_id: safeTrim(option.option_id),
      title: safeTrim(option.title)
    };

    if (option.description != null) {
      const description = safeTrim(option.description);
      if (description) {
        normalized.description = description;
      }
    }

    return normalized;
  });
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

function getRefinementFallbackMessage(language) {
  return language === "en"
    ? "I've refined the scene based on your input and prepared it for the pre-final alignment step."
    : "Я доуточнил сцену по твоему вводу и подготовил её к предфинальному согласованию.";
}

function normalizeAlignmentResponse(validated, language) {
  return {
    output: {
      message: normalizeAlignmentPublicMessage(validated.message, language),
      questions: normalizeQuestions(validated.questions)
    },
    blueprint_patch: null
  };
}

function normalizeAlignmentPublicMessage(message, language) {
  const text = safeTrim(message);

  if (
    !text ||
    !hasAlignmentSentenceCount(text) ||
    isForbiddenAlignmentPublicMessage(text)
  ) {
    return getAlignmentFallbackMessage(language);
  }

  return text;
}

function hasAlignmentSentenceCount(message) {
  const sentences = safeTrim(message)
    .split(/[.!?…]+|[。！？]+/u)
    .map((item) => item.trim())
    .filter(Boolean);

  return sentences.length >= 4 && sentences.length <= 7;
}

function isForbiddenAlignmentPublicMessage(message) {
  const normalized = safeTrim(message)
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ");

  const forbiddenPatterns = [
    /система поняла/,
    /blueprint/,
    /стади[яи] build/,
    /этап build/,
    /build stage/,
    /\bstage\b/,
    /trust-layer/,
    /trust layer/,
    /\broute\b/,
    /route decisions?/,
    /readiness/,
    /system_state/,
    /build разреш[её]н/,
    /build одобрен/,
    /запускаю build/,
    /финальный результат уже собран/,
    /after build/,
    /current blueprint/,
    /system understood/
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
    model: MODEL,
    ...extras
  };
}

function normalizeBaseBlueprintRevisionEcho(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) {
    return null;
  }

  return numeric;
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
  const unsafePaths = Object.keys(flatPatch).filter(
    (path) => !isAllowedPatchPath(path, surface) || isForbiddenSystemPath(path)
  );

  if (unsafePaths.length > 0) {
    throw new Error(
      `Patch contains forbidden/protected path for ${surface}: ${unsafePaths.join(", ")}`
    );
  }

  if (surface === EXECUTION_SURFACES.REFINEMENT) {
    assertNoUnsafeRefinementPatchPaths(flatPatch);
  }

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
  const protectedPrefixes = [
    "system_state",
    "meta",
    "extensions",
    "result_schema",
    "final_result",
    "blocks",
    "output.blocks",
    "billing",
    "plan",
    "entitlement",
    "messages",
    "history",
    "runtime",
    "localStorage"
  ];

  if (
    path === "ready_for_final_assembly" ||
    path === "required_inputs_complete" ||
    path === "minimum_usable_readiness"
  ) {
    return true;
  }

  return protectedPrefixes.some(
    (protectedPath) =>
      path === protectedPath || path.startsWith(`${protectedPath}.`)
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


function normalizeRole(value) {
  return ROLE_ALIASES[toLookupKey(value)] || "creative_director";
}

function normalizeVideoType(value) {
  return VIDEO_TYPE_ALIASES[toLookupKey(value)] || "video";
}

function normalizeGoal(value) {
  return GOAL_ALIASES[toLookupKey(value)] || "creative_concept";
}

function normalizeEmotion(value) {
  const key = toLookupKey(value);
  return EMOTION_ALIASES[key] || null;
}

function normalizeSceneAction(value) {
  const key = toLookupKey(value);
  return SCENE_ACTION_ALIASES[key] || null;
}

function normalizeAdvancedModules(items) {
  const modules = [];
  const seen = new Set();

  for (const item of extractAdvancedModuleCandidates(items)) {
    const canonical = ADVANCED_MODULE_ALIASES[toLookupKey(item)];
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    modules.push(canonical);
  }

  return modules;
}

function deriveStageBehaviorDirectives(surfaceRequest, surface) {
  if (surface === EXECUTION_SURFACES.SCENE_IDEAS) {
    return buildSceneIdeasBehaviorContext(surfaceRequest);
  }

  if (surface === EXECUTION_SURFACES.DEVELOPMENT) {
    return buildDevelopmentBehaviorContext(surfaceRequest);
  }

  return null;
}

function buildSceneIdeasBehaviorContext(surfaceRequest) {
  const blueprint = ensureObject(surfaceRequest?.blueprint);
  const role = normalizeRole(blueprint?.meta?.scriptwriter_role);
  const videoType = normalizeVideoType(blueprint?.meta?.video_type);
  const goal = normalizeGoal(blueprint?.goal?.video_goal);
  const emotion = normalizeEmotion(blueprint?.visual_direction?.emotion) || "neutral";
  const sceneAction = normalizeSceneAction(
    surfaceRequest?.ui_context?.scene_action ?? blueprint?.scene_core?.scene_action
  );
  const advancedModules = getSelectedAdvancedModules(surfaceRequest);

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
  const role = normalizeRole(blueprint?.meta?.scriptwriter_role);
  const videoType = normalizeVideoType(blueprint?.meta?.video_type);
  const goal = normalizeGoal(blueprint?.goal?.video_goal);
  const emotion = normalizeEmotion(blueprint?.visual_direction?.emotion);
  const sceneAction = normalizeSceneAction(
    surfaceRequest?.ui_context?.scene_action ?? blueprint?.scene_core?.scene_action
  );
  const advancedModules = getSelectedAdvancedModules(surfaceRequest);

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
  const selectedFromOptions = normalizeAdvancedModules(surfaceRequest?.advanced_options?.selected);
  const selectedFromExtensions = normalizeAdvancedModules(extractSelectedExtensions(surfaceRequest?.blueprint?.extensions));
  return uniqueStrings([...selectedFromOptions, ...selectedFromExtensions]);
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
    return "No selected advanced intent.";
  }

  const labels = modules
    .map((moduleId) => ADVANCED_MODULE_LENSES[moduleId])
    .filter(Boolean);

  return `Selected modules are intent only: ${labels.join(", ")}.`;
}

function buildAdvancedSceneIdeasDirective(modules) {
  if (!Array.isArray(modules) || modules.length === 0) {
    return null;
  }

  const moduleLabels = modules.join(", ");
  return `Reflect selected advanced intent where it naturally helps the first 3 ideas (${moduleLabels}), but do not create module data, questions, patch paths or result blocks.`;
}

function buildAdvancedDevelopmentDirective(modules) {
  if (!Array.isArray(modules) || modules.length === 0) {
    return null;
  }

  const moduleLabels = modules.join(", ");
  return `Reflect selected advanced intent where it naturally helps the scene (${moduleLabels}), but do not create module data or separate result blocks.`;
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
    scene_action: safeTrim(surfaceRequest?.ui_context?.scene_action) || safeTrim(blueprint?.scene_core?.scene_action),
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

function buildModelStatusError(status, validated, codePrefix) {
  const code = status === STATUSES.BLOCKED
    ? `${codePrefix}_BLOCKED`
    : `${codePrefix}_ERROR`;

  const message =
    safeTrim(validated?.error?.message) ||
    safeTrim(validated?.error) ||
    safeTrim(validated?.message) ||
    (status === STATUSES.BLOCKED ? "Development blocked" : "Development failed");

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

function buildSelectionFallbackQuestions(surfaceRequest, selectedScene) {
  const language = surfaceRequest?.language || "ru";
  const missing = getSelectionMissingGuidedFields(surfaceRequest?.blueprint, selectedScene);
  const nextField = missing.find((path) => path !== "scene_core.seed_scene") || missing[0] || "narrative.scene_development";
  const question = selectionFallbackQuestionForField(nextField, language);
  return question ? [question] : [];
}

function selectionFallbackQuestionForField(fieldPath, language) {
  const en = language === "en";

  if (fieldPath === "narrative.scene_setup") {
    return en
      ? "What should be the opening situation of this scene?"
      : "С какой ситуации должна начаться эта сцена?";
  }

  if (fieldPath === "narrative.scene_development") {
    return en
      ? "What should change or intensify as this scene develops?"
      : "Что должно измениться или усилиться по ходу этой сцены?";
  }

  if (fieldPath === "visual_direction.emotion") {
    return en
      ? "What emotion should the scene leave with the viewer?"
      : "Какое ощущение сцена должна оставить у зрителя?";
  }

  if (fieldPath === "scene_core.seed_scene") {
    return en
      ? "Which scene direction should I develop as the base?"
      : "Какое направление сцены взять за основу для развития?";
  }

  return en
    ? "What is the most important detail I should preserve while developing this scene?"
    : "Какую самую важную деталь нужно сохранить при развитии этой сцены?";
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

function getAlignmentFallbackMessage(language) {
  return language === "en"
    ? "I understood the task this way: we take the selected scene as the basis and keep the focus on a usable video result. The fixed direction is the scene idea, the goal, and the emotional line already present in the working data. As the result, I’ll assemble the needed LiVi structure: overview, scene logic, script or prompt blocks, and production notes where they apply. If everything fits, click “Build LiVi structure”. After the result appears, you can fine-tune the needed parts."
    : "Я понял задачу так: за основу берём выбранную сцену и держим фокус на применимом результате для видео. Уже зафиксированы направление сцены, цель и эмоциональная линия, которые есть в рабочих данных. В результате я соберу нужную структуру LiVi: обзор, логику сцены, сценарные или prompt-блоки и производственные заметки там, где они нужны. Если всё подходит, нажми “Собрать структуру LiVi”. После результата можно будет точечно доработать нужные части.";
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
