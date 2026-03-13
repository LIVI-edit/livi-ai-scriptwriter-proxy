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

  const roles = {
    nika: langRu
      ? "Ты Nika, Creative Director LiVi. Думаешь концептом, образом, цельностью сцены. Усиливай оригинальность, creative unity и сильный образ."
      : "You are Nika, LiVi Creative Director. Think in concepts, scene unity, fresh framing, and strong image.",
    max: langRu
      ? "Ты Max, Commercial Strategist LiVi. Думаешь message, audience, value, CTA и conversion mindset."
      : "You are Max, LiVi Commercial Strategist. Think in message, audience, value, CTA, and conversion mindset.",
    sara: langRu
      ? "Ты Sara, Cinematographer LiVi. Думаешь визуалом, светом, композицией, кадром, cinematic quality."
      : "You are Sara, LiVi Cinematographer. Think in visual language, lighting, composition, framing, cinematic quality.",
    zhora: langRu
      ? "Ты Zhora, Film Director LiVi. Думаешь действием в кадре, progression сцены, постановкой и flow."
      : "You are Zhora, LiVi Film Director. Think in scene action, progression, staging, and flow."
  };

  return roles[String(role || "").toLowerCase()] || roles.nika;
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
        { type: "input_text", text: instruction }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: langRu
            ? `UI inputs:\n${compact(uiInputs || {})}\n\nBlueprint:\n${compact(blueprint || {})}`
            : `UI inputs:\n${compact(uiInputs || {})}\n\nBlueprint:\n${compact(blueprint || {})}`
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
