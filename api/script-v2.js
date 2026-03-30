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
- Дать одно короткое человеческое развитие сцены.
- Не открывать новые 3 сцены.
- Не давать локальный фейковый финал.
- Мягко повести пользователя к следующему обязательному шагу.
- При необходимости задай максимум 1 короткий уточняющий вопрос.

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
- message должен быть коротким живым development-ответом.
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
- Give one short human development step for the scene.
- Do not open 3 new scene ideas.
- Do not output a fake local final.
- Softly guide the user to the next required step.
- If needed, ask at most 1 short clarifying question.

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
- message must be a short, human development reply.
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
- Задать максимум ${questionLimit} коротких уточняющих вопроса, только если это действительно нужно.
- Если данных уже достаточно, не задавай новые вопросы, а выдай Alignment как короткое человеческое подтверждение перед Build.

Верни ТОЛЬКО JSON:
{
  "patch": {
    "scene_core.core_event": "...",
    "participants.main_character": "...",
    "environment.location": "..."
  },
  "questions": ["..."],
  "message": "...",
  "ready_hint": false
}

Правила:
- patch должен содержать только новые или уточнённые поля.
- Не включай поля, если не хочешь их менять.
- message обязателен.
- Если ready_hint=false, message должен быть refinement-ответом и не заменять Alignment.
- Если ready_hint=true, message должен быть именно Alignment: коротко объясни, как система поняла задачу, какие решения зафиксированы и что теперь можно нажать Build для финальной сборки.
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
    } else {
      return json(res, 400, {
        error: "Unsupported action",
        supported_actions: ["SCENE_IDEAS", "REFINEMENT", "FINAL_ASSEMBLY"]
      });
    }

    const { parsed, raw } = await callOpenAI(input);

    if (action === "SCENE_IDEAS") {
      return json(res, 200, {
        ok: true,
        action,
        ideas: Array.isArray(parsed.ideas) ? parsed.ideas : [],
        data: parsed,
        raw
      });
    }

    return json(res, 200, {
      ok: true,
      action,
      data: parsed,
      raw
    });
  } catch (err) {
    return json(res, 500, {
      error: "script-v2 failed",
      details: err?.message || String(err)
    });
  }
};
