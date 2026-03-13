// aiResponseValidator.js
// Proxy project / root or /api/lib
// Validates and normalizes AI JSON responses before returning them to UI

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function asBool(value) {
  return !!value;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return isPlainObject(value) ? value : {};
}

function clampText(value, max = 4000) {
  const text = asString(value);
  return text.length > max ? text.slice(0, max).trim() : text;
}

function parseJsonMaybe(raw) {
  if (isPlainObject(raw)) return raw;
  if (typeof raw !== "string") return null;

  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function normalizeIdea(item, fallbackId = "idea") {
  const obj = safeObject(item);

  return {
    id: asString(obj.id, fallbackId),
    short_title: clampText(obj.short_title, 120),
    scene_text: clampText(obj.scene_text, 1200),
    why_it_works: clampText(obj.why_it_works, 500),
  };
}

function validateSceneIdeas(raw) {
  const parsed = parseJsonMaybe(raw);
  const data = safeObject(parsed);
  const ideas = safeArray(data.ideas)
    .slice(0, 3)
    .map((item, i) => normalizeIdea(item, `idea_${i + 1}`))
    .filter((item) => item.short_title || item.scene_text);

  return {
    ok: ideas.length > 0,
    data: { ideas },
    errors: ideas.length ? [] : ["Invalid SCENE_IDEAS response"],
  };
}

function validateRefinement(raw) {
  const parsed = parseJsonMaybe(raw);
  const data = safeObject(parsed);

  const patch = safeObject(data.patch);
  const questions = safeArray(data.questions)
    .slice(0, 3)
    .map((q) => clampText(q, 220))
    .filter(Boolean);

  return {
    ok: Object.keys(patch).length > 0 || questions.length > 0 || typeof data.ready_hint !== "undefined",
    data: {
      patch,
      questions,
      ready_hint: asBool(data.ready_hint),
    },
    errors: (Object.keys(patch).length > 0 || questions.length > 0 || typeof data.ready_hint !== "undefined")
      ? []
      : ["Invalid REFINEMENT response"],
  };
}

function validateFinalAssembly(raw) {
  const parsed = parseJsonMaybe(raw);
  const data = safeObject(parsed);
  const blocks = safeObject(data.blocks);

  const cleanBlocks = {};
  Object.entries(blocks).forEach(([key, value]) => {
    const text = clampText(value, 4000);
    if (text) cleanBlocks[key] = text;
  });

  return {
    ok: Object.keys(cleanBlocks).length > 0,
    data: { blocks: cleanBlocks },
    errors: Object.keys(cleanBlocks).length ? [] : ["Invalid FINAL_ASSEMBLY response"],
  };
}

function validateByAction(action, raw) {
  const a = String(action || "").trim().toUpperCase();

  if (a === "SCENE_IDEAS") return validateSceneIdeas(raw);
  if (a === "REFINEMENT") return validateRefinement(raw);
  if (a === "FINAL_ASSEMBLY") return validateFinalAssembly(raw);

  return {
    ok: false,
    data: null,
    errors: [`Unsupported action: ${a}`],
  };
}

module.exports = {
  validateByAction,
  validateSceneIdeas,
  validateRefinement,
  validateFinalAssembly,
};
