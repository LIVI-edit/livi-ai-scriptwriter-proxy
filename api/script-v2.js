// /api/script-v2.js

const OPENAI_URL = "https://api.openai.com/v1/responses";
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

function json(res, code, payload) {
  return res.status(code).json(payload);
}

function safeParseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return {};
    }
  }
  return req.body;
}

function compact(value) {
  return JSON.stringify(value, null, 2);
}

function normalizeAction(action) {
  return String(action || "").trim().toUpperCase();
}

function getQuestionLimit(planTier) {
  const tier = String(planTier || "free").toLowerCase();
  if (tier === "pro") return 5;
  if (tier === "ultra") return 8;
  return 2;
}

function normalizeStage(stage) {
  const value = String(stage || "").trim().toLowerCase();
  return value || "start";
}


function hasCommercialGoalContext(blueprint) {
  const videoType = String(blueprint?.meta?.video_type || "").trim().toLowerCase();
  if (videoType === "promo") return true;
  const goal = String(blueprint?.goal?.video_goal || "").trim().toLowerCase();
  return ["product", "service", "brand", "promotion", "promo", "ad", "presentation", "pitch", "commercial"].some((token) => goal.includes(token));
}

function getCriticalAlignmentMissingFromState(blueprint, patch = {}) {
  if (!hasCommercialGoalContext(blueprint)) return [];
  const candidates = [
    "goal.audience",
    "marketing_layer.message",
    "marketing_layer.product_focus"
  ];
  return candidates.filter((path) => {
    const currentValue = path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), blueprint || {});
    const patchedValue = Object.prototype.hasOwnProperty.call(patch || {}, path) ? patch[path] : undefined;
    const finalValue = patchedValue !== undefined ? patchedValue : currentValue;
    if (Array.isArray(finalValue)) return finalValue.length === 0;
    return !(typeof finalValue === 'string' ? finalValue.trim() : finalValue);
  });
}

function getContextTextForBias(blueprint) {
  return [
    blueprint?.goal?.user_request_summary,
    blueprint?.system_state?.last_user_message,
    blueprint?.scene_core?.seed_scene,
    blueprint?.scene_core?.main_focus,
    blueprint?.marketing_layer?.message,
    blueprint?.marketing_layer?.product_focus,
  ].map((value) => String(value || '').trim()).filter(Boolean).join('\n').toLowerCase();
}

function sanitizeRefinementPatch(patch, blueprint) {
  const next = patch && typeof patch === 'object' ? { ...patch } : {};
  const contextText = getContextTextForBias(blueprint);
  const allowLiviContext = /livi|scriptwriter/.test(contextText);
  if (!allowLiviContext) {
    ["goal.user_request_summary", "scene_core.main_focus", "marketing_layer.message", "marketing_layer.product_focus"].forEach((path) => {
      const value = String(next[path] || '').trim();
      if (value && /livi|scriptwriter/i.test(value)) delete next[path];
    });
  }
  return next;
}

function buildRolePrompt(role, language = "ru") {
  const langRu = language !== "en";

  const roles = {
    nika: langRu
      ? "Ты Nika, Creative Director LiVi. Думаешь концептом, образом, цельностью сцены. Усиливай оригинальность, creative unity и сильный образ."
      : "You are Nika, LiVi Creative Director. Think in concepts, scene unity, fresh framing, and strong image.",
    max: langRu
      ? "Ты Max, Commercial Strategist LiVi. Думаешь message, audience, value, CTA и conversion mindset."
      : "You are Max, LiVi Commercial Strategist. Think in message, audience, value, CTA, and conversion mindset.",
    sara: langRu
      ? "Ты Sara, Cinematographer LiVi. Твой приоритет: light → optics → composition → visual reveal → mood. Строй сцену через визуальный язык, свет и способ раскрытия кадра."
      : "You are Sara, LiVi Cinematographer. Your priority is light → optics → composition → visual reveal → mood. Build the scene through visual language, light and the way the frame reveals itself.",
    zhora: langRu
      ? "Ты Zhora, Film Director LiVi. Твой приоритет: action → movement → staging → progression → payoff. Строй сцену через действие героя, мизансцену и развитие события."
      : "You are Zhora, LiVi Film Director. Your priority is action → movement → staging → progression → payoff. Build the scene through character action, staging and event progression."
  };

  return roles[String(role || "").toLowerCase()] || roles.nika;
}

function buildRoleBiasNotes(role, language = "ru") {
  const langRu = language !== "en";
  const notes = {
    nika: langRu
      ? "Role bias: можно сохранить тот же сценический вектор, если user constraints совпадают, но внутри сцены делай акцент на образе, метафоре, символе и creative hook."
      : "Role bias: the same scene vector may remain if user constraints match, but the internal emphasis must be image, metaphor, symbol and creative hook.",
    max: langRu
      ? "Role bias: можно сохранить тот же scene vector, но подай его через audience angle, benefit framing, value clarity, message и product relevance. Не уходи в просто красивую product scene без понятной пользы."
      : "Role bias: the same scene vector may remain, but frame it through audience angle, benefit framing, value clarity, message and product relevance. Do not drift into a merely pretty product scene without clear usefulness.",
    sara: langRu
      ? "Role bias: можно сохранить тот же scene vector, но строй его через свет, глубину кадра, композицию, reveal и visual language."
      : "Role bias: the same scene vector may remain, but build it through light, frame depth, composition, reveal and visual language.",
    zhora: langRu
      ? "Role bias: можно сохранить тот же scene vector, но строй его через действие, blocking, progression и развитие события."
      : "Role bias: the same scene vector may remain, but build it through action, blocking, progression and event development."
  };
  return notes[String(role || "").toLowerCase()] || notes.nika;
}

function buildSceneIdeasInput({ blueprint, uiInputs, language }) {
  const langRu = language !== "en";

  const instruction = langRu
    ? `
Сгенерируй 3 идеи сцены для LiVi AI Scriptwriter.

Задача:
- НЕ писать длинный сценарий.
- НЕ собирать финальный результат.
- НЕ повторять уже известные UI inputs как вопросы.
- Использовать known inputs как уже заданные.
- Вернуть только 3 варианта сцены:
  1) exact
  2) variation
  3) creative

Требования:
- Каждая идея: short_title, scene_text, why_it_works.
- Сцены должны различаться по углу подачи.
- Ответ верни ТОЛЬКО как JSON.
- Без markdown.
- Без пояснений до и после JSON.

Формат JSON:
{
  "ideas": [
    { "id": "exact", "short_title": "...", "scene_text": "...", "why_it_works": "..." },
    { "id": "variation", "short_title": "...", "scene_text": "...", "why_it_works": "..." },
    { "id": "creative", "short_title": "...", "scene_text": "...", "why_it_works": "..." }
  ]
}
`.trim()
    : `
Generate 3 scene ideas for LiVi AI Scriptwriter.

Task:
- Do NOT write a full script.
- Do NOT assemble the final deliverable.
- Do NOT ask again about known UI inputs.
- Treat known inputs as already fixed.
- Return only 3 scene options:
  1) exact
  2) variation
  3) creative

Requirements:
- Each idea: short_title, scene_text, why_it_works.
- The three ideas must differ in angle.
- Role bias must change decision priority, interpretation and scene emphasis, not just wording.
- If user constraints are the same, the broad scene vector may still overlap, but the role-specific reasoning focus must be clearly different.
- Return JSON only.
- No markdown.
- No extra text before or after JSON.

JSON format:
{
  "ideas": [
    { "id": "exact", "short_title": "...", "scene_text": "...", "why_it_works": "..." },
    { "id": "variation", "short_title": "...", "scene_text": "...", "why_it_works": "..." },
    { "id": "creative", "short_title": "...", "scene_text": "...", "why_it_works": "..." }
  ]
}
`.trim();

  return [
    {
      role: "system",
      content: [
        { type: "input_text", text: buildRolePrompt(blueprint?.meta?.scriptwriter_role, language) },
        { type: "input_text", text: buildRoleBiasNotes(blueprint?.meta?.scriptwriter_role, language) },
        { type: "input_text", text: instruction }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: `UI inputs:\n${compact(uiInputs || {})}\n\nBlueprint:\n${compact(blueprint || {})}`
        }
      ]
    }
  ];
}

function buildRefinementInstruction(stage, questionLimit, language) {
  const langRu = language !== "en";

  if (stage === "development") {
    return langRu
      ? `
Ты работаешь на этапе DEVELOPMENT.

Задача:
- Принять уже выбранную сцену как зафиксированную основу.
- В message обязательно: 1) коротко подтвердить, какая сцена выбрана; 2) коротко объяснить, почему это сильный вектор; 3) показать, что именно нужно добрать дальше, если чего-то реально не хватает.
- Не открывать новые 3 сцены.
- Не давать локальный фейковый финал.
- Не закрывать автоматически missing anchors своей интерпретацией.
- Не делать Alignment на этом шаге.
- Если не хватает критически важного слоя, предложи 2–3 коротких варианта добора прямо в message человеческим языком.
- questions использовать только если без короткого вопроса нельзя, максимум 1.

Верни ТОЛЬКО JSON:
{
  "patch": {
    "scene_core.concept_line": "...",
    "narrative.scene_development": "..."
  },
  "questions": ["..."],
  "message": "...",
  "ready_hint": false
}

Правила:
- message обязателен.
- message должен быть живым development-ответом, а не сухим recap.
- Не обещай final assembly.
- Не делай Alignment на этом шаге.
- patch содержит только реально уточнённые поля.
- Без markdown.
- Без пояснений.
`.trim()
      : `
You are in the DEVELOPMENT stage.

Task:
- Treat the selected scene as the locked foundation.
- In message, do 3 things: 1) briefly confirm which scene was chosen; 2) briefly explain why it is a strong direction; 3) show what still needs to be strengthened if anything meaningful is missing.
- Do not open 3 new scene ideas.
- Do not output a fake local final.
- Do not auto-close missing anchors with pure interpretation.
- Do not perform Alignment at this step.
- If a meaningful layer is still missing, offer 2–3 short completion options directly inside message in human language.
- Use questions only if one short question is truly necessary.

Return JSON only:
{
  "patch": {
    "scene_core.concept_line": "...",
    "narrative.scene_development": "..."
  },
  "questions": ["..."],
  "message": "...",
  "response_stage": "development",
  "ready_hint": false
}

Rules:
- message is required.
- response_stage must be "development".
- message must be a live human development reply, not a dry recap.
- Do not promise final assembly here.
- Do not perform Alignment at this step.
- patch contains only truly refined fields.
- No markdown.
- No explanations.
`.trim();
  }

  return langRu
    ? `
Ты работаешь на этапе REFINEMENT.

Задача:
- Посмотреть текущий Scene Blueprint.
- Обновить сцену только там, где это логично.
- Не пересоздавать Blueprint заново.
- Не дублировать известные данные.
- Считать scene_core.seed_scene уже зафиксированным источником истины сцены.
- Не переписывать и не терять seed scene.
- Обновлять Blueprint только patch-подходом.
- Определить, каких данных реально не хватает.
- Если не хватает audience / core message / product focus / CTA / value, нельзя просто додумать всё самому из атмосферы сцены.
- Если не хватает важных данных, message должен явно показать, чего не хватает, и предложить 2–3 коротких варианта добора.
- Не переводи систему в Alignment, пока критичные missing anchors ещё живы.
- Задать максимум ${questionLimit} коротких уточняющих вопроса, только если это действительно нужно.
- Разрешается отдавать Alignment только когда каркас реально достаточен, а не просто красиво интерпретирован.

Верни ТОЛЬКО JSON:
{
  "patch": {
    "scene_core.core_event": "...",
    "participants.main_character": "...",
    "environment.location": "..."
  },
  "questions": ["..."],
  "message": "...",
  "response_stage": "refinement",
  "ready_hint": false
}

Правила:
- patch должен содержать только новые или уточнённые поля.
- Не включай поля, если не хочешь их менять.
- Не заполняй goal.audience, marketing_layer.message, marketing_layer.product_focus и marketing_layer.cta чистой фантазией, если пользователь этого ещё не задал напрямую или очень явно.
- Не считай по умолчанию, что видео про LiVi AI Scriptwriter или сам продукт LiVi, если это не следует из контекста пользователя.
- message обязателен.
- Если ready_hint=false, response_stage должен быть "refinement", а message должен быть refinement-ответом и не заменять Alignment.
- Если ready_hint=true, response_stage должен быть "alignment", а message должен быть именно Alignment: коротко объясни, как система поняла задачу, какие решения зафиксированы и что теперь можно нажать Build для финальной сборки.
- Нельзя запускать Final Assembly внутри этого этапа.
- Не возвращай markdown.
- Не возвращай объяснения.
`.trim()
    : `
You are in the REFINEMENT stage.

Task:
- Inspect the current Scene Blueprint.
- Update the scene only where it makes sense.
- Do not recreate the Blueprint from scratch.
- Do not repeat known data.
- Treat scene_core.seed_scene as the locked source of truth for the scene.
- Do not overwrite or lose the seed scene.
- Update the Blueprint only via patch logic.
- Determine what is still truly missing.
- Ask at most ${questionLimit} short clarifying questions only if needed.
- If there is already enough information, ask no new questions and output Alignment as a short human confirmation before Build.

Return JSON only:
{
  "patch": {
    "scene_core.core_event": "...",
    "participants.main_character": "...",
    "environment.location": "..."
  },
  "questions": ["..."],
  "message": "...",
  "response_stage": "refinement",
  "ready_hint": false
}

Rules:
- patch must contain only new or refined fields.
- Do not include fields you do not want to change.
- message is required.
- If ready_hint=false, response_stage must be "refinement", and message must be a refinement reply without replacing Alignment.
- If ready_hint=true, response_stage must be "alignment", and message must be Alignment: briefly explain how the system understood the task, what decisions are locked, and that the user can now press Build for final assembly.
- Do not launch Final Assembly inside this stage.
- No markdown.
- No explanations.
`.trim();
}

function buildRefinementInput({ blueprint, userMessage, language }) {
  const questionLimit = getQuestionLimit(blueprint?.meta?.plan_tier);
  const currentStage = normalizeStage(blueprint?.system_state?.current_stage);
  const instruction = buildRefinementInstruction(currentStage, questionLimit, language);
  const langRu = language !== "en";

  return [
    {
      role: "system",
      content: [
        { type: "input_text", text: buildRolePrompt(blueprint?.meta?.scriptwriter_role, language) },
        { type: "input_text", text: buildRoleBiasNotes(blueprint?.meta?.scriptwriter_role, language) },
        { type: "input_text", text: instruction }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: langRu
            ? `Текущий этап: ${currentStage}\n\nТекущий Blueprint:\n${compact(blueprint || {})}\n\nПоследний ответ пользователя:\n${String(userMessage || "").trim()}`
            : `Current stage: ${currentStage}\n\nCurrent Blueprint:\n${compact(blueprint || {})}\n\nLatest user reply:\n${String(userMessage || "").trim()}`
        }
      ]
    }
  ];
}

function buildFinalAssemblyInput({ blueprint, resultSchema, language }) {
  const langRu = language !== "en";

  const instruction = langRu
    ? `
Ты работаешь на этапе FINAL ASSEMBLY.

Задача:
- Использовать Scene Blueprint как источник истины.
- Использовать Result Schema как правило выдачи.
- Сгенерировать только разрешённые блоки результата.
- Не задавать вопросов.
- Не писать лишних вступлений.
- Не смешивать все блоки в одну простыню.

Верни ТОЛЬКО JSON:
{
  "blocks": {
    "preview": "...",
    "video_overview": "...",
    "visual_emotional_direction": "...",
    "scene_description": "...",
    "story_concept": "...",
    "scene_breakdown": "...",
    "prompt": "...",
    "production_notes": "..."
  }
}

Правила:
- Возвращай только те блоки, которые действительно есть в schema.
- Если блока нет в schema, не добавляй его.
- Без markdown.
- Без пояснений.
`.trim()
    : `
You are in FINAL ASSEMBLY.

Task:
- Use Scene Blueprint as the source of truth.
- Use Result Schema as the output rule.
- Generate only the allowed output blocks.
- Ask no questions.
- No extra intro.
- Do not collapse all blocks into one blob.

Return JSON only:
{
  "blocks": {
    "preview": "...",
    "video_overview": "...",
    "visual_emotional_direction": "...",
    "scene_description": "...",
    "story_concept": "...",
    "scene_breakdown": "...",
    "prompt": "...",
    "production_notes": "..."
  }
}

Rules:
- Return only blocks actually present in the schema.
- If a block is not in the schema, do not invent it.
- No markdown.
- No explanations.
`.trim();

  return [
    {
      role: "system",
      content: [
        { type: "input_text", text: buildRolePrompt(blueprint?.meta?.scriptwriter_role, language) },
        { type: "input_text", text: buildRoleBiasNotes(blueprint?.meta?.scriptwriter_role, language) },
        { type: "input_text", text: instruction }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: langRu
            ? `Blueprint:\n${compact(blueprint || {})}\n\nResult Schema:\n${compact(resultSchema || {})}`
            : `Blueprint:\n${compact(blueprint || {})}\n\nResult Schema:\n${compact(resultSchema || {})}`
        }
      ]
    }
  ];
}


function getImmutableChangeViolation(userMessage) {
  const text = String(userMessage || "").trim().toLowerCase();
  if (!text) return null;
  const rules = [
    { re: /(не\s+promo|not\s+promo|сделай\s+interactive|make\s+it\s+interactive|другой\s+тип|different\s+type)/i, code: "result_type_change" },
    { re: /(вариант\s*3|option\s*3|другая\s+сцена|different\s+scene|возьми\s+не\s+эту\s+сцену)/i, code: "seed_scene_change" },
    { re: /(полностью\s+поменяй\s+идею|change\s+the\s+whole\s+idea|другое\s+видео|video\s+about\s+something\s+else)/i, code: "core_direction_change" }
  ];
  const match = rules.find((item) => item.re.test(text));
  return match ? match.code : null;
}

function detectPostChatScope(userMessage) {
  const text = String(userMessage || "").trim().toLowerCase();
  const scope = new Set();
  if (!text) return [];
  if (/(prompt|промпт)/i.test(text)) scope.add("prompt");
  if (/(preview|превью|overview|обзор)/i.test(text)) { scope.add("preview"); scope.add("video_overview"); }
  if (/(scene description|описани[ея]\s+сцен|описание\s+сцены)/i.test(text)) scope.add("scene_description");
  if (/(story concept|концепт|идея\s+истории|story)/i.test(text)) scope.add("story_concept");
  if (/(scene breakdown|breakdown|разбивк|сцены)/i.test(text)) scope.add("scene_breakdown");
  if (/(production notes|production|продакшн|notes|заметк)/i.test(text)) scope.add("production_notes");
  if (/(cta|call to action|призыв)/i.test(text)) { scope.add("prompt"); scope.add("production_notes"); }
  if (/(tone|тон|премиаль|premium|динамик|dynamic|hook|хук|сильнее|intensity|эмоци)/i.test(text)) {
    if (!scope.size) { scope.add("prompt"); scope.add("preview"); }
  }
  return Array.from(scope);
}

function buildPostChatInput({ blueprint, deliverableBlocks, userMessage, language }) {
  const langRu = language !== "en";
  const editScope = detectPostChatScope(userMessage);
  const violation = getImmutableChangeViolation(userMessage);

  const instruction = langRu
    ? `
Ты работаешь на этапе POST_CHAT controlled improvement.

Задача:
- Улучшить только уже собранный deliverable.
- НЕ запускать новый полный цикл.
- НЕ возвращаться в refinement.
- НЕ менять video goal, result type, core scene, seed scene и базовое смысловое направление.
- Если запрос требует смены этой основы — верни out_of_scope.
- Если запрос слишком общий и неясно, что менять — верни needs_clarification.
- Если запрос нормальный — измени только нужные блоки deliverable.

Верни ТОЛЬКО JSON:
{
  "status": "improved",
  "message": "...",
  "edit_scope": ["prompt"],
  "updated_blocks": {
    "prompt": "..."
  },
  "blocked_reason": null
}

Правила:
- status только один из: improved, needs_clarification, out_of_scope.
- message обязателен всегда.
- При improved меняй только edit_scope и только связанные блоки.
- Не дублируй весь deliverable, если пользователь просил локальную правку.
- При out_of_scope не переписывай блоки, а коротко объясни, что нужен новый цикл.
- При needs_clarification не переписывай блоки, а коротко спроси, что именно улучшить.
- Без markdown.
- Без пояснений вне JSON.
`.trim()
    : `
You are in POST_CHAT controlled improvement.

Task:
- Improve only the already assembled deliverable.
- Do NOT start a new full cycle.
- Do NOT go back to refinement.
- Do NOT change video goal, result type, core scene, seed scene, or the base direction.
- If the request tries to change that foundation, return out_of_scope.
- If the request is too vague, return needs_clarification.
- Otherwise improve only the needed deliverable blocks.

Return JSON only:
{
  "status": "improved",
  "message": "...",
  "edit_scope": ["prompt"],
  "updated_blocks": {
    "prompt": "..."
  },
  "blocked_reason": null
}

Rules:
- status must be one of: improved, needs_clarification, out_of_scope.
- message is always required.
- On improved, update only the targeted scope and directly adjacent blocks if truly needed.
- Do not resend the whole deliverable when the user requested a local change.
- On out_of_scope, do not rewrite blocks; explain that a new cycle is required.
- On needs_clarification, do not rewrite blocks; ask what exactly should be improved.
- No markdown.
- No extra text outside JSON.
`.trim();

  const contextText = langRu
    ? `Текущий Blueprint:
${compact(blueprint || {})}

Текущий deliverable blocks:
${compact(deliverableBlocks || {})}

Запрос пользователя:
${String(userMessage || "").trim()}

Предварительно определённый scope:
${compact(editScope)}

Guardrail violation:
${violation || "none"}`
    : `Current Blueprint:
${compact(blueprint || {})}

Current deliverable blocks:
${compact(deliverableBlocks || {})}

User request:
${String(userMessage || "").trim()}

Pre-detected scope:
${compact(editScope)}

Guardrail violation:
${violation || "none"}`;

  return [
    {
      role: "system",
      content: [
        { type: "input_text", text: buildRolePrompt(blueprint?.meta?.scriptwriter_role, language) },
        { type: "input_text", text: buildRoleBiasNotes(blueprint?.meta?.scriptwriter_role, language) },
        { type: "input_text", text: instruction }
      ]
    },
    {
      role: "user",
      content: [{ type: "input_text", text: contextText }]
    }
  ];
}

function getClarificationMessage(language) {
  return language === "en"
    ? "Please уточни what exactly to improve: Prompt, CTA, Preview, Overview, Breakdown, Story Concept or Notes."
    : "Уточни, что именно улучшить: Prompt, CTA, Preview, Overview, Breakdown, Story Concept или Notes.";
}

function pickAllowedPostChatBlocks(scope) {
  const requested = Array.isArray(scope) ? scope.filter(Boolean) : [];
  const allowed = new Set(["prompt", "preview", "video_overview", "scene_description", "story_concept", "scene_breakdown", "production_notes"]);
  return requested.filter((key) => allowed.has(key));
}

function sanitizeUpdatedBlocks(updatedBlocks, editScope) {
  const allowedKeys = new Set(pickAllowedPostChatBlocks(editScope));
  const next = {};
  Object.entries(updatedBlocks && typeof updatedBlocks === "object" ? updatedBlocks : {}).forEach(([key, value]) => {
    if (!allowedKeys.has(key)) return;
    if (typeof value !== "string") return;
    const text = value.trim();
    if (!text) return;
    next[key] = text;
  });
  return next;
}

function hasUsableUpdatedBlocks(updatedBlocks, editScope) {
  const keys = Object.keys(sanitizeUpdatedBlocks(updatedBlocks, editScope));
  if (!keys.length) return false;
  return keys.some(Boolean);
}

function buildLocalPostChatFallback(deliverableBlocks, editScope, userMessage, language) {
  const blocks = deliverableBlocks && typeof deliverableBlocks === "object" ? deliverableBlocks : {};
  const scope = pickAllowedPostChatBlocks(editScope);
  const text = String(userMessage || "").trim();
  const lower = text.toLowerCase();
  const updates = {};

  function withNote(base, noteRu, noteEn) {
    const note = language === "en" ? noteEn : noteRu;
    const content = String(base || "").trim();
    return content ? `${note}

${content}` : note;
  }

  if (scope.includes("prompt")) {
    const noteRu = /cta|призыв/i.test(text)
      ? "Обновил Prompt: усилил CTA и финальное действие пользователя."
      : /преми|premium/i.test(lower)
        ? "Обновил Prompt: сделал тон более премиальным и точным."
        : "Обновил Prompt: усилил формулировку и читаемость для генерации.";
    const noteEn = /cta|call to action/i.test(text)
      ? "Updated Prompt: strengthened the CTA and the final user action."
      : /premium/i.test(lower)
        ? "Updated Prompt: made the tone more premium and precise."
        : "Updated Prompt: strengthened the wording and generator-readiness.";
    updates.prompt = withNote(blocks.prompt, noteRu, noteEn);
  }

  if (scope.includes("production_notes")) {
    const noteRu = /cta|призыв/i.test(text)
      ? "Обновил Production Notes: усилил CTA-слой, коммерческое действие и финальный акцент."
      : "Обновил Production Notes: уточнил практические акценты и исполнительские указания.";
    const noteEn = /cta|call to action/i.test(text)
      ? "Updated Production Notes: strengthened the CTA layer, commercial action and final emphasis."
      : "Updated Production Notes: refined the practical emphasis and execution notes.";
    updates.production_notes = withNote(blocks.production_notes, noteRu, noteEn);
  }

  if (scope.includes("preview")) {
    updates.preview = withNote(blocks.preview, "Обновил Preview: сделал вход сильнее и чище.", "Updated Preview: made the opening sharper and clearer.");
  }
  if (scope.includes("video_overview")) {
    updates.video_overview = withNote(blocks.video_overview, "Обновил Overview: усилил общий вектор и подачу.", "Updated Overview: strengthened the overall direction and framing.");
  }
  if (scope.includes("scene_description")) {
    updates.scene_description = withNote(blocks.scene_description, "Обновил Scene Description: сделал описание более выразительным.", "Updated Scene Description: made the description more vivid.");
  }
  if (scope.includes("story_concept")) {
    updates.story_concept = withNote(blocks.story_concept, "Обновил Story Concept: сделал идею точнее и сильнее.", "Updated Story Concept: made the concept sharper and stronger.");
  }
  if (scope.includes("scene_breakdown")) {
    updates.scene_breakdown = withNote(blocks.scene_breakdown, "Обновил Scene Breakdown: усилил структуру и полезность для сборки.", "Updated Scene Breakdown: strengthened the structure and execution usefulness.");
  }

  return updates;
}

function normalizePostChatResult(parsed, userMessage, deliverableBlocks = {}, language = "ru") {
  const data = parsed && typeof parsed === "object" ? { ...parsed } : {};
  const violation = getImmutableChangeViolation(userMessage);
  const detectedScope = detectPostChatScope(userMessage);
  const status = String(data.status || "").trim().toLowerCase();
  const vague = !detectedScope.length && String(userMessage || "").trim().length < 18;
  const normalized = {
    status: status || (violation ? "out_of_scope" : (vague ? "needs_clarification" : "improved")),
    message: typeof data.message === "string" ? data.message.trim() : "",
    edit_scope: Array.isArray(data.edit_scope) ? data.edit_scope.filter(Boolean) : detectedScope,
    updated_blocks: data.updated_blocks && typeof data.updated_blocks === "object" ? data.updated_blocks : {},
    blocked_reason: typeof data.blocked_reason === "string" ? data.blocked_reason.trim() : null
  };
  if (violation) {
    normalized.status = "out_of_scope";
    normalized.updated_blocks = {};
    normalized.edit_scope = [];
    normalized.blocked_reason = violation;
    if (!normalized.message) {
      normalized.message = language === "en"
        ? "This request changes the base direction and needs a new cycle."
        : "Этот запрос меняет базовую основу результата и требует нового цикла.";
    }
  }
  if (normalized.status === "needs_clarification") {
    normalized.updated_blocks = {};
    if (!normalized.message) normalized.message = getClarificationMessage(language);
  }
  if (normalized.status === "out_of_scope") {
    normalized.updated_blocks = {};
  }
  if (normalized.status === "improved" && !normalized.edit_scope.length) {
    normalized.status = "needs_clarification";
    normalized.updated_blocks = {};
    normalized.message = normalized.message || getClarificationMessage(language);
  }
  normalized.updated_blocks = sanitizeUpdatedBlocks(normalized.updated_blocks, normalized.edit_scope);
  if (normalized.status === "improved" && !hasUsableUpdatedBlocks(normalized.updated_blocks, normalized.edit_scope)) {
    normalized.updated_blocks = buildLocalPostChatFallback(deliverableBlocks, normalized.edit_scope, userMessage, language);
  }
  if (normalized.status === "improved" && !hasUsableUpdatedBlocks(normalized.updated_blocks, normalized.edit_scope)) {
    normalized.status = "needs_clarification";
    normalized.updated_blocks = {};
    normalized.message = normalized.message || getClarificationMessage(language);
  }
  return normalized;
}

async function repairPostChatExecutionIfNeeded(normalizedParsed, deliverableBlocks, userMessage, language) {
  const current = normalizedParsed && typeof normalizedParsed === "object" ? { ...normalizedParsed } : {};
  if (current.status !== "improved") return current;
  if (hasUsableUpdatedBlocks(current.updated_blocks, current.edit_scope)) return current;
  const scope = pickAllowedPostChatBlocks(current.edit_scope);
  if (!scope.length) return current;

  const langRu = language !== "en";
  const instruction = langRu
    ? `Ты исправляешь POST_CHAT execution. Верни только JSON с обновлёнными targeted blocks. Не меняй базовую сцену, goal, тип результата. Не возвращай пустой updated_blocks.`
    : `You are repairing POST_CHAT execution. Return JSON only with the updated targeted blocks. Do not change the base scene, goal or result type. Do not return empty updated_blocks.`;
  const contextText = langRu
    ? `Текущий deliverable:
${compact(deliverableBlocks || {})}

Запрос пользователя:
${String(userMessage || '').trim()}

Целевой scope:
${compact(scope)}`
    : `Current deliverable:
${compact(deliverableBlocks || {})}

User request:
${String(userMessage || '').trim()}

Target scope:
${compact(scope)}`;

  try {
    const repair = await callOpenAI([
      { role: "system", content: [{ type: "input_text", text: instruction }] },
      { role: "user", content: [{ type: "input_text", text: contextText }] }
    ]);
    const repaired = normalizePostChatResult(repair.parsed, userMessage, deliverableBlocks, language);
    if (repaired.status === "improved" && hasUsableUpdatedBlocks(repaired.updated_blocks, repaired.edit_scope)) {
      return repaired;
    }
  } catch (_) {}

  const fallbackBlocks = buildLocalPostChatFallback(deliverableBlocks, scope, userMessage, language);
  if (hasUsableUpdatedBlocks(fallbackBlocks, scope)) {
    return {
      status: "improved",
      message: current.message || (langRu ? "Обновил выбранный блок deliverable." : "Updated the selected deliverable block."),
      edit_scope: scope,
      updated_blocks: fallbackBlocks,
      blocked_reason: null
    };
  }

  return {
    status: "needs_clarification",
    message: getClarificationMessage(language),
    edit_scope: [],
    updated_blocks: {},
    blocked_reason: null
  };
}

async function callOpenAI(input) {
  const r = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      input,
      text: { format: { type: "json_object" } },
      max_output_tokens: 1400
    })
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(text || "OpenAI request failed");
  }

  const data = await r.json();
  const raw =
    data.output_text ||
    (Array.isArray(data.output)
      ? data.output
          .flatMap((o) => o.content || [])
          .filter((c) => c.type === "output_text" && c.text)
          .map((c) => c.text)
          .join("\n")
      : "");

  if (!raw) {
    throw new Error("Empty OpenAI response");
  }

  return { raw, parsed: JSON.parse(raw) };
}

function normalizeRefinementResult(parsed, currentStage, blueprint) {
  const data = parsed && typeof parsed === "object" ? { ...parsed } : {};
  data.patch = sanitizeRefinementPatch(data.patch, blueprint);
  const stage = normalizeStage(currentStage);
  const normalizedStage = String(data.response_stage || "").trim().toLowerCase();

  if (stage === "development") {
    data.response_stage = normalizedStage || "development";
    data.ready_hint = false;
    return data;
  }

  const criticalMissing = getCriticalAlignmentMissingFromState(blueprint, data.patch);
  if (criticalMissing.length) {
    data.ready_hint = false;
    data.response_stage = "refinement";
  } else if (data.ready_hint === true) {
    data.response_stage = "alignment";
  } else {
    data.response_stage = normalizedStage || "refinement";
  }

  return data;
}


function diffPatchPaths(patch) {
  if (!patch || typeof patch !== "object") return [];
  return Object.keys(patch).filter(Boolean).sort();
}

function detectPatchSources(blueprint, patch) {
  const sources = {};
  const userMessage = String(blueprint?.system_state?.last_user_message || "").trim();
  const knownInputs = new Set(Array.isArray(blueprint?.system_state?.known_inputs) ? blueprint.system_state.known_inputs : []);
  for (const path of diffPatchPaths(patch)) {
    if (["goal.user_request_summary", "system_state.last_user_message"].includes(path) && userMessage) {
      sources[path] = "user_input";
    } else if (knownInputs.has(path.split('.').slice(-1)[0])) {
      sources[path] = "ui_input";
    } else {
      sources[path] = "scriptwriter_interpretation";
    }
  }
  return sources;
}

function buildServerTrace({ blueprint, action, parsed, normalizedParsed }) {
  const currentStage = normalizeStage(blueprint?.system_state?.current_stage);
  const data = normalizedParsed || parsed || {};
  const patch = data && typeof data.patch === "object" ? data.patch : {};
  const patchedFields = diffPatchPaths(patch);
  return {
    current_stage_before: currentStage,
    requested_action: action,
    response_stage: String(data?.response_stage || "").trim().toLowerCase() || null,
    ready_hint: !!data?.ready_hint,
    patched_fields: patchedFields,
    patched_field_sources: detectPatchSources(blueprint, patch),
    message_present: typeof data?.message === "string" && data.message.trim().length > 0,
    questions_count: Array.isArray(data?.questions) ? data.questions.length : 0,
  };
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  try {
    const body = safeParseBody(req);
    const payload = body.payload || {};
    const action = normalizeAction(body.action);
    const blueprint = body.blueprint || payload.blueprint || {};
    const uiInputs = body.uiInputs || payload.uiInputs || {};
    const resultSchema = body.resultSchema || payload.resultSchema || {};
    const userMessage = typeof body.userMessage === "string"
      ? body.userMessage.trim()
      : (typeof payload.userMessage === "string" ? payload.userMessage.trim() : "");
    const language = blueprint?.meta?.language || body.language || payload.language || "ru";

    if (!process.env.OPENAI_API_KEY) {
      return json(res, 500, { error: "Missing OPENAI_API_KEY" });
    }

    let input;

    if (action === "SCENE_IDEAS") {
      input = buildSceneIdeasInput({ blueprint, uiInputs, language });
    } else if (action === "REFINEMENT") {
      if (!userMessage) {
        return json(res, 400, { error: "Missing userMessage for REFINEMENT" });
      }
      if (!blueprint?.scene_core?.seed_scene || !String(blueprint.scene_core.seed_scene).trim()) {
        return json(res, 400, { error: "Missing scene_core.seed_scene for REFINEMENT" });
      }
      input = buildRefinementInput({ blueprint, userMessage, language });
    } else if (action === "FINAL_ASSEMBLY") {
      input = buildFinalAssemblyInput({ blueprint, resultSchema, language });
    } else if (action === "POST_CHAT") {
      if (!userMessage) {
        return json(res, 400, { error: "Missing userMessage for POST_CHAT" });
      }
      input = buildPostChatInput({
        blueprint,
        deliverableBlocks: body.deliverableBlocks || payload.deliverableBlocks || {},
        userMessage,
        language
      });
    } else {
      return json(res, 400, {
        error: "Unsupported action",
        supported_actions: ["SCENE_IDEAS", "REFINEMENT", "FINAL_ASSEMBLY", "POST_CHAT"]
      });
    }

    const { parsed, raw } = await callOpenAI(input);
    let normalizedParsed = action === "REFINEMENT"
      ? normalizeRefinementResult(parsed, blueprint?.system_state?.current_stage, blueprint)
      : (action === "POST_CHAT"
          ? normalizePostChatResult(parsed, userMessage, body.deliverableBlocks || payload.deliverableBlocks || {}, language)
          : parsed);

    if (action === "POST_CHAT") {
      normalizedParsed = await repairPostChatExecutionIfNeeded(
        normalizedParsed,
        body.deliverableBlocks || payload.deliverableBlocks || {},
        userMessage,
        language
      );
    }

    if (action === "SCENE_IDEAS") {
      return json(res, 200, {
        ok: true,
        action,
        ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
        data: parsed,
        raw,
        trace: buildServerTrace({ blueprint, action, parsed, normalizedParsed: parsed })
      });
    }

    return json(res, 200, {
      ok: true,
      action,
      data: normalizedParsed,
      raw,
      trace: buildServerTrace({ blueprint, action, parsed, normalizedParsed })
    });
  } catch (err) {
    return json(res, 500, {
      error: "script-v2 failed",
      details: err?.message || String(err)
    });
  }
};
