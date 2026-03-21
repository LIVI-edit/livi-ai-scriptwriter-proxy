
import OpenAI from "openai";
import validator from "./aiResponseValidator.js";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


function applyCors(req, res) {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

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
