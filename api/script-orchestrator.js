
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
        system: "You are a cinematic scene generator for LiVi AI Scriptwriter. Return valid JSON only.",
        user: `Create 3 cinematic scene ideas based on this payload.

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
      const seedScene = String(payload?.blueprint?.scene_core?.seed_scene || "").trim();
      if (!seedScene) {
        throw new Error("Assembly blocked: seed_scene missing");
      }
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
        return res.status(422).json({
          error: "Assembly blocked: final assembly validation failed",
          action,
          details: checked.errors,
          raw,
          debug: makeDebugMeta("FINAL_ASSEMBLY_BLOCKED", {
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
