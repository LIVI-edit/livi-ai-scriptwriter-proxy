
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


function getLanguage(payload = {}) {
  return String(payload?.language || payload?.lang || "ru").toLowerCase() === "en" ? "en" : "ru";
}

function buildRolePrompt(role, language = "ru") {
  const langRu = language !== "en";
  const roles = {
    nika: langRu
      ? "Ты Nika, Creative Director LiVi. Думаешь концептом, образом, metaphor и сильным creative hook."
      : "You are Nika, LiVi Creative Director. Think in concept, image, metaphor, and strong creative hook.",
    max: langRu
      ? "Ты Max, Commercial Strategist LiVi. Твой приоритет: Problem → Need → Product → Value → Audience relevance → Reveal. Сначала ищи practical relevance, benefit, message и audience fit."
      : "You are Max, LiVi Commercial Strategist. Your priority is Problem → Need → Product → Value → Audience relevance → Reveal. Start with practical relevance, benefit, message, and audience fit.",
    sara: langRu
      ? "Ты Sara, Cinematographer LiVi. Думаешь светом, optics, композицией, visual reveal и кадром."
      : "You are Sara, LiVi Cinematographer. Think in light, optics, composition, visual reveal, and framing.",
    zhora: langRu
      ? "Ты Zhora, Film Director LiVi. Думаешь действием, movement, staging и progression сцены."
      : "You are Zhora, LiVi Film Director. Think in action, movement, staging, and scene progression."
  };
  return roles[String(role || "").toLowerCase()] || roles.nika;
}

function buildSceneIdeasRoleBias(role, language = "ru") {
  const langRu = language !== "en";
  const map = {
    nika: langRu
      ? "Role Bias — Nika: сначала concept, image, metaphor, hook; не начинать с камеры без сильного образа."
      : "Role Bias — Nika: concept, image, metaphor, hook first; do not start from camera before the image is strong.",
    max: langRu
      ? "Role Bias — Max: Problem → Need → Product → Value → Audience relevance → Reveal. Не уходить в просто красивую product scene без audience value и benefit clarity."
      : "Role Bias — Max: Problem → Need → Product → Value → Audience relevance → Reveal. Avoid a merely beautiful product scene without audience value and benefit clarity.",
    sara: langRu
      ? "Role Bias — Sara: сначала light, composition, optics, reveal rhythm и visual language."
      : "Role Bias — Sara: light, composition, optics, reveal rhythm, and visual language first.",
    zhora: langRu
      ? "Role Bias — Zhora: сначала action, movement, staging и progression события."
      : "Role Bias — Zhora: action, movement, staging, and scene progression first."
  };
  return map[String(role || "").toLowerCase()] || map.nika;
}

function makeDebugMeta(state, extra = {}) {
  return {
    state,
    timestamp: new Date().toISOString(),
    ...extra
  };
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
      const raw = await runOpenAI({
        system: `${buildRolePrompt(payload?.meta?.scriptwriter_role, getLanguage(payload))}
${buildSceneIdeasRoleBias(payload?.meta?.scriptwriter_role, getLanguage(payload))}
Return valid JSON only.`,
        user: `Create 3 scene ideas based on this payload.

Rules:
- Keep the same user constraints if they are fixed.
- The role should change decision priority, focus, and interpretation angle, not randomly break the scene direction.
- Return 3 options: exact, variation, creative.
- Each idea must include short_title, scene_text, why_it_works.
- why_it_works must reflect the role logic.


Return JSON only:
{
  "ideas": [
    {
      "id": "exact",
      "short_title": "...",
      "scene_text": "...",
      "why_it_works": "..."
    },
    {
      "id": "variation",
      "short_title": "...",
      "scene_text": "...",
      "why_it_works": "..."
    },
    {
      "id": "creative",
      "short_title": "...",
      "scene_text": "...",
      "why_it_works": "..."
    }
  ]
}

Payload:
${getUserPayloadText(payload)}`
      });

      const checked = validator.validateByAction("SCENE_IDEAS", raw);

      if (!checked.ok) {
        return res.status(422).json({
          error: "Invalid AI response",
          action,
          details: checked.errors,
          raw,
          debug: makeDebugMeta("SCENE_IDEAS_INVALID", {
            validator_errors: checked.errors
          })
        });
      }

      return res.json({
        ok: true,
        action,
        data: checked.data,
        raw,
        debug: makeDebugMeta("SCENE_IDEAS_OK")
      });
    }

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
        user: `Build the final structured result.

STRICT RULES:
- DO NOT return screenplay.
- DO NOT return sections like SCENES / CHOICES / TRANSITIONS / VISUAL STYLE / PROMPTS.
- You must return ONLY structured JSON blocks.
- Each block must be plain text.

Return JSON only:
{
  "blocks": {
    "scene_preview": "...",
    "scene_story": "...",
    "visual_direction": "...",
    "cinematic_prompt": "..."
  }
}

Definitions:
- scene_preview: short cinematic description of the scene concept
- scene_story: what actually happens in the scene
- visual_direction: camera / lighting / atmosphere
- cinematic_prompt: full generation-ready prompt for video or image AI

Payload:
${getUserPayloadText(payload)}`,
        temperature: 0.7
      });

      const checked = validator.validateByAction("FINAL_ASSEMBLY", raw);

      if (!checked.ok) {
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
          debug: makeDebugMeta("LEGACY_FALLBACK_TRIGGERED", {
            reason: "FINAL_ASSEMBLY_VALIDATION_FAILED",
            validator_errors: checked.errors
          })
        });
      }

      return res.json({
        ok: true,
        action,
        data: checked.data,
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
