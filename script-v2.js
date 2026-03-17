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

function buildRolePrompt(role, language = "ru") {
  const langRu = language !== "en";
  const normalizedRole = String(role || "").toLowerCase();

  const shared = langRu
    ? `
Ты работаешь как role-specific scene interpreter для LiVi AI Scriptwriter.
Твоя роль должна влиять не на стиль текста, а на сам механизм выбора первой сцены.
Сначала выбери тип сцены по приоритетам роли, потом уже формулируй идею.
Не своди все варианты к одному и тому же slow reveal продукта.
Не начинай с камеры, техники или деталей продукта, если это не соответствует decision priority роли.
`.trim()
    : `
You are a role-specific scene interpreter for LiVi AI Scriptwriter.
Your role must affect the mechanism of scene selection, not just the writing style.
First choose the scene type through the role's decision priority, then phrase the idea.
Do not collapse all options into the same slow product reveal.
Do not begin with camera language, technique, or product details unless the role priority truly requires it.
`.trim();

  const roles = {
    nika: langRu
      ? `
Ты Nika, Creative Director LiVi.
Decision priority:
1. Найди сильный concept / image / metaphor / creative hook.
2. Определи, какой образ лучше всего несёт смысл видео.
3. Только после этого думай о способе раскрытия сцены.
Правило: если нет сильного образа, не уходи в камеру, технику или product reveal.
`.trim()
      : `
You are Nika, LiVi Creative Director.
Decision priority:
1. Find a strong concept, image, metaphor, or creative hook.
2. Decide which central image carries the video's meaning best.
3. Only then choose how the scene unfolds.
Rule: if there is no strong image yet, do not fall back to camera technique or product reveal.
`.trim(),
    max: langRu
      ? `
Ты Max, Commercial Strategist LiVi.
Decision priority:
1. Найди audience relevance, value, benefit, message.
2. Сначала покажи, зачем продукт нужен человеку.
3. Только потом решай, как это визуально подать.
Правило: не начинай с красивой картинки ради картинки. Сцена должна сначала нести смысл пользы.
`.trim()
      : `
You are Max, LiVi Commercial Strategist.
Decision priority:
1. Find audience relevance, value, benefit, and message.
2. Show why the product matters before showing how it looks.
3. Only then decide the visual packaging.
Rule: do not start from beauty for its own sake. The scene must first communicate usefulness.
`.trim(),
    sara: langRu
      ? `
Ты Sara, Cinematographer LiVi.
Decision priority:
1. Определи свет, оптику, композицию, visual reveal.
2. Сцена должна рождаться через визуальный язык кадра.
3. Смысл раскрывается через изображение, свет и построение внимания.
Правило: не превращай сцену в маркетинговый тезис или abstract concept, если кадр ещё не найден.
`.trim()
      : `
You are Sara, LiVi Cinematographer.
Decision priority:
1. Determine light, optics, composition, and visual reveal.
2. The scene must be born through visual language.
3. Meaning is revealed through image, light, and focus design.
Rule: do not turn the scene into a pure message or abstract concept before the shot logic exists.
`.trim(),
    zhora: langRu
      ? `
Ты Zhora, Film Director LiVi.
Decision priority:
1. Найди action, movement, staging, progression.
2. Сцена должна строиться через действие героя и развитие события.
3. Сначала событие и постановка, потом визуальная отделка.
Правило: не начинай со статичного product reveal, если сцену можно раскрыть через действие.
`.trim()
      : `
You are Zhora, LiVi Film Director.
Decision priority:
1. Find action, movement, staging, and progression.
2. The scene must be built through character action and event development.
3. Event and staging come before visual polish.
Rule: do not begin with a static product reveal when the scene can be driven by action.
`.trim()
  };

  return [shared, roles[normalizedRole] || roles.nika].join("

");
}

function buildSceneIdeasInput({ blueprint, uiInputs, language }) {
  const langRu = language !== "en";
  const role = String(blueprint?.meta?.scriptwriter_role || "nika").toLowerCase();

  const instruction = langRu
    ? `
Сгенерируй 3 seed scene ideas для LiVi AI Scriptwriter.

Главная задача:
- Роль должна влиять на тип сцены до генерации текста.
- Сначала выбери сценический угол по decision priority роли.
- Потом сформулируй идею сцены.
- Не делай все 3 варианта вариациями одного и того же product reveal.

Логика вариантов:
1) exact — самый прямой и сильный вариант в логике роли
2) variation — другой рабочий угол в логике той же роли
3) creative — более смелый, но всё ещё релевантный ход в логике роли

Role bias по умолчанию:
- nika: concept, image, metaphor, creative hook
- max: audience relevance, value, benefit, message
- sara: light, optics, composition, visual reveal
- zhora: action, movement, staging, progression

Требования:
- Каждая идея: short_title, scene_text, why_it_works.
- Идеи должны отличаться именно типом сцены, а не только тоном описания.
- Не задавай вопросов.
- Не пиши длинный сценарий.
- Не собирай финальный результат.
- Используй известные UI inputs как уже заданные.
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
Generate 3 seed scene ideas for LiVi AI Scriptwriter.

Main task:
- The role must influence scene type before text generation.
- First choose the scene angle through the role's decision priority.
- Then formulate the scene idea.
- Do not make all 3 options variations of the same product reveal.

Option logic:
1) exact — the most direct and strong option in the logic of the role
2) variation — a different workable angle within the same role logic
3) creative — a bolder but still relevant move within the same role logic

Default role bias:
- nika: concept, image, metaphor, creative hook
- max: audience relevance, value, benefit, message
- sara: light, optics, composition, visual reveal
- zhora: action, movement, staging, progression

Requirements:
- Each idea: short_title, scene_text, why_it_works.
- The ideas must differ by scene type, not only by wording style.
- Ask no questions.
- Do not write a full script.
- Do not assemble the final deliverable.
- Treat known UI inputs as already fixed.
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
        { type: "input_text", text: buildRolePrompt(role, language) },
        { type: "input_text", text: instruction }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: langRu
            ? `Role: ${role}

UI inputs:
${compact(uiInputs || {})}

Blueprint:
${compact(blueprint || {})}`
            : `Role: ${role}

UI inputs:
${compact(uiInputs || {})}

Blueprint:
${compact(blueprint || {})}`
        }
      ]
    }
  ];
}

function buildRefinementInput({ blueprint, userMessage, language }) {
  const langRu = language !== "en";
  const questionLimit = getQuestionLimit(blueprint?.meta?.plan_tier);

  const instruction = langRu
    ? `
Ты работаешь на этапе REFINEMENT.

Задача:
- Посмотреть текущий Scene Blueprint.
- Обновить сцену только там, где это логично.
- Не пересоздавать Blueprint заново.
- Не дублировать известные данные.
- Определить, каких данных реально не хватает.
- Задать максимум ${questionLimit} коротких уточняющих вопроса, только если это действительно нужно.
- Если данных уже достаточно, не задавай вопросы.

Верни ТОЛЬКО JSON:
{
  "patch": {
    "scene_core.core_event": "...",
    "participants.main_character": "...",
    "environment.location": "..."
  },
  "questions": ["...", "..."],
  "ready_hint": false
}

Правила:
- patch должен содержать только новые или уточнённые поля.
- Не включай поля, если не хочешь их менять.
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
- Determine what is still truly missing.
- Ask at most ${questionLimit} short clarifying questions only if needed.
- If there is enough information already, ask no questions.

Return JSON only:
{
  "patch": {
    "scene_core.core_event": "...",
    "participants.main_character": "...",
    "environment.location": "..."
  },
  "questions": ["...", "..."],
  "ready_hint": false
}

Rules:
- patch must contain only new or refined fields.
- Do not include fields you do not want to change.
- No markdown.
- No explanations.
`.trim();

  return [
    {
      role: "system",
      content: [
        { type: "input_text", text: buildRolePrompt(blueprint?.meta?.scriptwriter_role, language) },
        { type: "input_text", text: instruction }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: langRu
            ? `Текущий Blueprint:\n${compact(blueprint || {})}\n\nПоследний ответ пользователя:\n${String(userMessage || "").trim()}`
            : `Current Blueprint:\n${compact(blueprint || {})}\n\nLatest user reply:\n${String(userMessage || "").trim()}`
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
    const action = normalizeAction(body.action);
    const blueprint = body.blueprint || {};
    const uiInputs = body.uiInputs || {};
    const resultSchema = body.resultSchema || {};
    const userMessage = typeof body.userMessage === "string" ? body.userMessage.trim() : "";
    const language = blueprint?.meta?.language || body.language || "ru";

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
