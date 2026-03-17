
import OpenAI from "openai";
import validator from "./aiResponseValidator.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function getUserPayloadText(payload) {
  try {
    return JSON.stringify(payload || {}, null, 2);
  } catch (_) {
    return "{}";
  }
}

function makeDebugMeta(state, extra = {}) {
  return {
    state,
    timestamp: new Date().toISOString(),
    ...extra
  };
}

function safeParseJson(raw) {
  try {
    return JSON.parse(String(raw || "").trim());
  } catch (_) {
    return null;
  }
}

async function runOpenAI({ system, user, temperature = 0.7 }) {
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });

  return String(completion?.choices?.[0]?.message?.content || "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const action = String(body.action || "SCENE_IDEAS").trim().toUpperCase();
    const payload = body.payload || {};

    if (action === "SCENE_IDEAS") {
      const role = String(payload?.meta?.scriptwriter_role || "nika").trim().toLowerCase();
      const langRu = String(payload?.meta?.language || payload?.language || "ru").toLowerCase() !== "en";

      const roleSystem = langRu
        ? {
            nika: `Ты Nika, Creative Director LiVi.

Твоя роль должна влиять на механизм выбора сцены до генерации текста.
Decision priority:
1. Найди concept, image, metaphor, creative hook.
2. Определи центральный образ сцены.
3. Только потом решай, как сцена раскрывается.
Правило: не начинай с камеры, техники или product reveal, если не найден сильный образ.`,
            max: `Ты Max, Commercial Strategist LiVi.

Твоя роль должна влиять на механизм выбора сцены до генерации текста.
Decision priority:
1. Найди audience relevance, value, benefit, message.
2. Сначала покажи, зачем продукт нужен человеку.
3. Только потом решай, как это визуально оформить.
Правило: не начинай с красивого reveal без понятной пользы и сообщения.`,
            sara: `Ты Sara, Cinematographer LiVi.

Твоя роль должна влиять на механизм выбора сцены до генерации текста.
Decision priority:
1. Определи light, optics, composition, visual reveal.
2. Сцена должна строиться через визуальный язык кадра.
3. Смысл раскрывается через изображение, свет и композицию.
Правило: не уходи в abstract concept или marketing message, если shot logic ещё не найден.`,
            zhora: `Ты Zhora, Film Director LiVi.

Твоя роль должна влиять на механизм выбора сцены до генерации текста.
Decision priority:
1. Найди action, movement, staging, progression.
2. Сцена должна строиться через действие героя и развитие события.
3. Сначала событие и постановка, потом визуальная отделка.
Правило: не начинай со статичного reveal, если сцену можно раскрыть через действие.`
          }
        : {
            nika: `You are Nika, LiVi Creative Director.

Your role must affect the mechanism of scene selection before text generation.
Decision priority:
1. Find concept, image, metaphor, creative hook.
2. Choose the central image of the scene.
3. Only then decide how the scene unfolds.
Rule: do not begin with camera technique or product reveal before a strong image exists.`,
            max: `You are Max, LiVi Commercial Strategist.

Your role must affect the mechanism of scene selection before text generation.
Decision priority:
1. Find audience relevance, value, benefit, message.
2. Show why the product matters before showing how it looks.
3. Only then decide the visual packaging.
Rule: do not start from a beautiful reveal without clear usefulness and message.`,
            sara: `You are Sara, LiVi Cinematographer.

Your role must affect the mechanism of scene selection before text generation.
Decision priority:
1. Determine light, optics, composition, visual reveal.
2. The scene must be built through visual language.
3. Meaning is revealed through image, light, and composition.
Rule: do not drift into abstract concept or marketing message before shot logic exists.`,
            zhora: `You are Zhora, LiVi Film Director.

Your role must affect the mechanism of scene selection before text generation.
Decision priority:
1. Find action, movement, staging, progression.
2. The scene must be built through character action and event development.
3. Event and staging come before visual polish.
Rule: do not begin with a static reveal if the scene can be driven by action.`
          };

      const sceneIdeasUser = langRu
        ? `Сгенерируй 3 seed scene ideas для LiVi AI Scriptwriter.

Главная задача:
- Роль должна влиять на тип сцены до генерации текста.
- Сначала выбери сценический угол по decision priority роли.
- Потом сформулируй идею сцены.
- Не делай все 3 варианта вариациями одного и того же slow reveal продукта.

Логика вариантов:
1) exact — самый прямой и сильный вариант в логике роли
2) variation — другой рабочий угол в логике той же роли
3) creative — более смелый, но всё ещё релевантный ход в логике роли

Role bias:
- nika: concept, image, metaphor, creative hook
- max: audience relevance, value, benefit, message
- sara: light, optics, composition, visual reveal
- zhora: action, movement, staging, progression

Требования:
- Каждая идея: short_title, scene_text, why_it_works.
- Идеи должны отличаться типом сцены, а не только стилем текста.
- Не писать длинный сценарий.
- Не собирать финальный результат.
- Не задавать вопросов.
- Вернуть JSON только в формате:
{
  "ideas": [
    { "id": "exact", "short_title": "...", "scene_text": "...", "why_it_works": "..." },
    { "id": "variation", "short_title": "...", "scene_text": "...", "why_it_works": "..." },
    { "id": "creative", "short_title": "...", "scene_text": "...", "why_it_works": "..." }
  ]
}

Payload:
${getUserPayloadText(payload)}`
        : `Generate 3 seed scene ideas for LiVi AI Scriptwriter.

Main task:
- The role must influence scene type before text generation.
- First choose the scene angle through the role's decision priority.
- Then formulate the scene idea.
- Do not make all 3 options variations of the same slow product reveal.

Option logic:
1) exact — the most direct and strong option in the logic of the role
2) variation — a different workable angle within the same role logic
3) creative — a bolder but still relevant move within the same role logic

Role bias:
- nika: concept, image, metaphor, creative hook
- max: audience relevance, value, benefit, message
- sara: light, optics, composition, visual reveal
- zhora: action, movement, staging, progression

Requirements:
- Each idea: short_title, scene_text, why_it_works.
- Ideas must differ by scene type, not just wording style.
- Do not write a full script.
- Do not assemble the final deliverable.
- Ask no questions.
- Return JSON only in this format:
{
  "ideas": [
    { "id": "exact", "short_title": "...", "scene_text": "...", "why_it_works": "..." },
    { "id": "variation", "short_title": "...", "scene_text": "...", "why_it_works": "..." },
    { "id": "creative", "short_title": "...", "scene_text": "...", "why_it_works": "..." }
  ]
}

Payload:
${getUserPayloadText(payload)}`;

      const raw = await runOpenAI({
        system: roleSystem[role] || roleSystem.nika,
        user: sceneIdeasUser
      });

    if (action === "REFINEMENT") {
      const raw = await runOpenAI({
        system: "You refine cinematic scenes for LiVi AI Scriptwriter. Return valid JSON only.",
        user: `Refine the scene using the payload.

Return JSON only:
{
  "patch": {
    "scene_core.main_focus": "...",
    "environment.location": "...",
    "visual_direction.atmosphere": "..."
  },
  "questions": ["..."],
  "ready_hint": false
}

Rules:
- patch must contain only updated fields
- questions must be short
- return JSON only

Payload:
${getUserPayloadText(payload)}`,
        temperature: 0.6
      });

      const checked = validator.validateByAction("REFINEMENT", raw);

      if (!checked.ok) {
        return res.status(422).json({
          error: "Invalid AI response",
          action,
          details: checked.errors,
          raw,
          debug: makeDebugMeta("REFINEMENT_INVALID", {
            validator_errors: checked.errors
          })
        });
      }

      return res.json({
        ok: true,
        action,
        data: checked.data,
        raw,
        debug: makeDebugMeta("REFINEMENT_OK")
      });
    }

    if (action === "FINAL_ASSEMBLY") {
      const raw = await runOpenAI({
        system: "You assemble final structured output for LiVi AI Scriptwriter. Return valid JSON only. Never return screenplay sections like SCENES, CHOICES, TRANSITIONS, VISUAL STYLE or PROMPTS.",
        user: `Build the final structured result using Scene Blueprint as the source of truth and Result Schema as the output rule.

STRICT RULES:
- DO NOT return screenplay.
- DO NOT return sections like SCENES / CHOICES / TRANSITIONS / VISUAL STYLE / PROMPTS.
- You must return ONLY structured JSON blocks.
- Each block must be plain text.
- Return only blocks that are actually supported by the schema/payload.
- No markdown.
- No explanations outside JSON.

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

Definitions:
- preview: short human preview of the concept and intended effect
- video_overview: concise overview of type, goal and delivery logic
- visual_emotional_direction: mood, light, atmosphere, palette and visual language
- scene_description: what happens inside the scene
- story_concept: the narrative meaning of the piece as a whole
- scene_breakdown: production structure / beats / stages
- prompt: generation-ready video or image prompt
- production_notes: short professional notes on pacing, camera, edit or emphasis

Payload:
${getUserPayloadText(payload)}`,
        temperature: 0.7
      });

      const parsed = safeParseJson(raw);
      const blocks = parsed && parsed.blocks && typeof parsed.blocks === "object" ? parsed.blocks : null;

      if (!blocks) {
        console.log("FINAL_ASSEMBLY_VALIDATION_FAILED", { raw });

        return res.status(200).json({
          ok: true,
          action,
          legacy_fallback: true,
          data: {
            blocks: {
              legacy_fallback: String(raw || "").trim()
            }
          },
          raw,
          raw_ai_output: String(raw || "").trim(),
          validator_errors: ["FINAL_ASSEMBLY_JSON_PARSE_FAILED_OR_BLOCKS_MISSING"],
          debug: makeDebugMeta("LEGACY_FALLBACK_TRIGGERED", {
            reason: "FINAL_ASSEMBLY_JSON_PARSE_FAILED_OR_BLOCKS_MISSING"
          })
        });
      }

      return res.json({
        ok: true,
        action,
        data: { blocks },
        raw,
        debug: makeDebugMeta("FINAL_ASSEMBLY_OK")
      });
    }

    return res.status(400).json({
      error: "Unknown action",
      debug: makeDebugMeta("UNKNOWN_ACTION", { action })
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: "AI error",
      message: err?.message || String(err),
      debug: makeDebugMeta("SERVER_ERROR", {
        message: err?.message || String(err)
      })
    });
  }
}
