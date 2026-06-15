// /api/script-v2.js
// Contract Freeze v1 — implementation
// Corrective pass after integration audit: Patch Contract v1 fixed exactly

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const STAGES = {
  SCENE_IDEAS: "scene_ideas",
  SELECTION: "selection",
  DEVELOPMENT: "development",
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
  "response_stage"
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
    case STAGES.DEVELOPMENT:
      return executeDevelopment(surfaceRequest);
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

async function executeDevelopment(surfaceRequest) {
  assertDevelopmentRequest(surfaceRequest);

  const modelInput = buildDevelopmentInput(surfaceRequest);
  const modelRaw = await callModel(modelInput);
  const validated = validateDevelopmentResponse(modelRaw);
  const normalized = normalizeDevelopmentResponse(validated);

  return buildJsonEnvelope({
    stage: STAGES.DEVELOPMENT,
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
  const normalized = normalizeAlignmentResponse(validated, surfaceRequest.language);

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

  const resultSchema = safeResultSchemaSnapshot(surfaceRequest?.meta?.result_schema);

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
  if (!selectedScene) {
    throw new Error("Missing selected scene for selection");
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
            `User input:\n${compact(surfaceRequest.user_input)}\n\n` +
            `Advanced options:\n${compact(surfaceRequest.advanced_options)}`
        }
      ]
    }
  ];
}

function buildRefinementInput(surfaceRequest) {
  const lang = surfaceRequest.language;
  const refinementFieldValues = [
    ["goal.video_topic", surfaceRequest.blueprint?.goal?.video_topic],
    ["goal.video_goal", surfaceRequest.blueprint?.goal?.video_goal],
    ["scene_core.seed_scene", surfaceRequest.blueprint?.scene_core?.seed_scene],
    ["narrative.scene_setup", surfaceRequest.blueprint?.narrative?.scene_setup],
    ["narrative.scene_development", surfaceRequest.blueprint?.narrative?.scene_development],
    ["visual_direction.emotion", surfaceRequest.blueprint?.visual_direction?.emotion]
  ];
  const missingRefinementFields = refinementFieldValues
    .filter(([, value]) => !safeTrim(value))
    .map(([path]) => path);

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
                  "Primary behavior order: Infer -> Propose -> Patch -> Ask.",
                  "An empty field is not an automatic reason to ask a question.",
                  "First extract the maximum available information from Blueprint, user_input and advanced_options.",
                  "If a value can be reasonably inferred without distorting the user's intent, you must return it through patch.",
                  "Refinement is a working patch step, not the final trust or alignment layer.",
                  "You may independently infer and patch simple missing details, especially for narrative.scene_setup, narrative.scene_development, and visual_direction.emotion.",
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
                  "Главный порядок работы: Infer -> Propose -> Patch -> Ask.",
                  "Пустое поле не является автоматической причиной задавать вопрос.",
                  "Сначала извлекай максимум информации из Blueprint, user_input и advanced_options.",
                  "Если значение можно разумно вывести без искажения замысла пользователя, обязательно верни его через patch.",
                  "Refinement — это рабочий patch-step, а не финальный trust-layer и не Alignment.",
                  "Ты можешь самостоятельно вывести и закрыть через patch простые недостающие детали, особенно narrative.scene_setup, narrative.scene_development и visual_direction.emotion.",
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
            `Candidate refinement fields to close by inference or patch:\n${compact(missingRefinementFields)}\n\n` +
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
  const resultSchema = isPlainObject(resultSchemaSnapshot)
    ? resultSchemaSnapshot
    : safeResultSchemaSnapshot(surfaceRequest?.meta?.result_schema);
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

  if (Array.isArray(parsed)) {
    return {
      ...modelRaw,
      parsed_json: {
        ideas: parsed
      }
    };
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    Array.isArray(parsed.scene_ideas)
  ) {
    return {
      ...modelRaw,
      parsed_json: {
        ideas: parsed.scene_ideas
      }
    };
  }

  return modelRaw;
}

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

  if (!Array.isArray(data.questions)) {
    throw new Error("selection model response must contain questions array");
  }

  if (data.patch != null && !isPlainObject(data.patch)) {
    throw new Error("selection patch must be an object");
  }

  return data;
}

function validateDevelopmentResponse(modelRaw) {
  const data = validateBaseModelObject(modelRaw, STAGES.DEVELOPMENT);

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
  const data = validateBaseModelObject(modelRaw, STAGES.REFINEMENT);

  if (typeof data.message !== "string" || !data.message.trim()) {
    throw new Error("refinement model response must contain message");
  }

  if (data.questions != null && !Array.isArray(data.questions)) {
    throw new Error("refinement questions must be an array");
  }

  if (data.patch != null && !isPlainObject(data.patch)) {
    throw new Error("refinement patch must be an object");
  }

  return data;
}

function validateAlignmentResponse(modelRaw) {
  const data = validateBaseModelObject(modelRaw, STAGES.ALIGNMENT);
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
      : {}
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
  const patch = sanitizePatchByPolicy(validated.patch, EXECUTION_SURFACES.REFINEMENT);

  return {
    output: {
      message: normalizeRefinementPublicMessage(validated.message, language),
      questions: normalizeQuestions(validated.questions)
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
    known_inputs: ensureObject(blueprint?.system_state?.known_inputs),
    current_stage: blueprint?.system_state?.current_stage || STAGES.DEVELOPMENT,
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

function safeResultSchemaSnapshot(value) {
  const rawSchema = isPlainObject(value) ? value : {};
  const sanitized = sanitizeResultSchemaValue(rawSchema);
  const schema = isPlainObject(sanitized) ? sanitized : {};

  if (Array.isArray(schema.blocks)) {
    schema.blocks = schema.blocks
      .map((block) => safeTrim(block))
      .filter(Boolean);
  } else {
    schema.blocks = [];
  }

  if (!isPlainObject(schema.block_character_budget)) {
    schema.block_character_budget = {};
  }

  return schema;
}

function sanitizeResultSchemaValue(value) {
  if (value == null) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => sanitizeResultSchemaValue(item))
      .filter((item) => item !== undefined);
  }

  if (isPlainObject(value)) {
    const next = {};

    for (const [key, item] of Object.entries(value)) {
      const sanitized = sanitizeResultSchemaValue(item);
      if (sanitized !== undefined) {
        next[key] = sanitized;
      }
    }

    return next;
  }

  return value;
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
    `- forbidden_blocks: ${forbiddenBlocks.join(", ") || "none"}`,
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
