"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const {
  createTraceRecorder,
  redactSecrets,
  writeSanitizedJson,
  writeSanitizedText,
  writeSanitizedNdjson,
  captureProviderModelOutput,
} = require("./helpers/trace-recorder.js");

const HANDLER_PATH = path.resolve(__dirname, "../../api/script-v2.js");
const ARTIFACT_DIR = path.resolve(process.env.LIVI_REAL_AI_ARTIFACT_DIR || path.resolve(__dirname, "artifacts/proxy"));
const ACCEPTED_BASELINE_ID = "proxy:090af4bae8f216d9b3f390b0036aa4509e15ac48c778eec30049b6469be9db8c";
const TEST_VERSION = "REAL_AI_PROXY_MINIMAL_REFINEMENT_MVP_TEST_ONLY_20260820";
const SCENARIO_ID = "REAL_AI_MINIMAL_REFINEMENT_MVP_INTERACTIVE_CHOICE_20260820";
const FIXED_REFINEMENT_INPUT = "Сохрани выбранную основу. Сделай точку выбора зрителя визуально понятной, без мрачного финала.";
const MAX_LIVE_CALLS = 7;
const STEPS = Object.freeze([
  Object.freeze({ id: "scene_ideas", stage: "scene_ideas" }),
  Object.freeze({ id: "selection", stage: "selection" }),
  Object.freeze({ id: "development", stage: "development" }),
  Object.freeze({ id: "refinement_chat", stage: "refinement", operation: "chat" }),
  Object.freeze({ id: "refinement_apply", stage: "refinement", operation: "apply" }),
  Object.freeze({ id: "alignment", stage: "alignment" }),
  Object.freeze({ id: "build", stage: "build" }),
]);
const FORBIDDEN_KEYS = new Set([
  "next_stage", "route", "route_decision", "go_to_alignment", "go_to_build", "build_now",
  "move_next", "finish", "ready_hint", "response_stage", "ready_for_final_assembly",
  "semantic_readiness", "readiness_reason", "system_state", "interaction_state",
  "refinement_state", "current_stage", "open_anchor", "active_anchor", "open_question",
  "pending_options", "build_status", "billing", "plan", "paywall", "entitlement", "final_result",
  "result_schema", "allowed_blocks", "blueprint", "changes", "patch",
]);
const PATCH_PATHS = Object.freeze({
  scene_ideas: new Set(),
  selection: new Set(["scene_core.seed_scene"]),
  development: new Set(["scene_core.main_focus", "narrative.scene_setup", "narrative.scene_development"]),
  refinement: new Set(["scene_core.main_focus", "narrative.scene_setup", "narrative.scene_development", "visual_direction.emotion"]),
  alignment: new Set(),
  build: new Set(),
});
const RESULT_SCHEMA_FIXTURE = Object.freeze({
  version: "v1",
  plan_tier: "pro",
  video_type: "interactive",
  density_mode: "standard",
  text_budget_total: 3200,
  blocks: [
    "preview", "video_overview", "visual_emotional_direction", "scene_description",
    "story_concept", "scene_breakdown", "prompt", "production_notes", "branching",
  ],
  block_character_budget: {
    preview: 242,
    video_overview: 242,
    visual_emotional_direction: 362,
    scene_description: 543,
    story_concept: 483,
    scene_breakdown: 483,
    prompt: 423,
    production_notes: 242,
    branching: 181,
  },
  selected_advanced_options: ["branching"],
});

function requireRuntimeConfig() {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error("REAL_AI_RUNTIME_CONFIG_MISSING:OPENAI_API_KEY");
    error.code = "REAL_AI_RUNTIME_CONFIG_MISSING";
    throw error;
  }
  return {
    apiKey,
    model: String(process.env.OPENAI_MODEL || "").trim() || null,
  };
}

function baseBlueprint(stage) {
  return {
    meta: {
      blueprint_id: "bp_real_ai_minimal_refinement_interactive_choice",
      scriptwriter_role: "film_director",
      video_type: "interactive",
      language: "ru",
      plan_tier: "pro",
    },
    goal: {
      video_topic: "Короткий интерактивный ролик о вымышленной умной лампе NOVA. Зритель выбирает режим света, и выбор меняет развитие одной сцены.",
      video_goal: "story_narrative",
    },
    scene_core: {
      seed_scene: "Герой подходит к лампе NOVA, а зритель выбирает один из двух режимов света.",
      main_focus: "Один видимый выбор зрителя меняет развитие одной сцены.",
      scene_action: "choice",
    },
    narrative: {
      scene_setup: "Герой работает в нейтральной комнате рядом с выключенной лампой NOVA.",
      scene_development: "На экране появляется точка выбора режима света, после чего атмосфера и действие меняются.",
    },
    visual_direction: { emotion: "mysterious" },
    extensions: { branching: { enabled: true } },
    system_state: {
      current_stage: stage === "build" ? "alignment" : stage,
      selected_advanced_options: ["branching"],
    },
  };
}

function requestForStep(step, context = {}) {
  const common = {
    stage: step.stage,
    language: "ru",
    blueprint: baseBlueprint(step.stage),
    ui_context: {
      video_type: "interactive",
      scriptwriter_role: "film_director",
      video_topic: "Короткий интерактивный ролик о вымышленной умной лампе NOVA. Зритель выбирает режим света, и выбор меняет развитие одной сцены.",
      video_goal: "story_narrative",
      emotion: "mysterious",
      scene_action: "choice",
      selected_extensions: ["branching"],
    },
    meta: { source: "real_ai_minimal_refinement_mvp_proxy_contour" },
    user_input: null,
  };

  if (step.stage === "selection") {
    common.user_input = {
      mode: "scene_idea_click",
      selected_index: 1,
      slot: "variation",
      seed_scene: "Герой подходит к лампе NOVA, а зритель выбирает один из двух режимов света.",
    };
  } else if (step.id === "refinement_chat") {
    common.user_input = FIXED_REFINEMENT_INPUT;
    common.meta = {
      source: "real_ai_minimal_refinement_mvp_proxy_contour",
      refinement_operation: "chat",
      refinement_conversation: [],
    };
  } else if (step.id === "refinement_apply") {
    const assistantMessage = String(context.chatAssistantMessage || "").trim();
    if (!assistantMessage) throw new Error("REAL_AI_REFINEMENT_CHAT_CONTEXT_MISSING");
    common.user_input = null;
    common.meta = {
      source: "real_ai_minimal_refinement_mvp_proxy_contour",
      refinement_operation: "apply",
      refinement_conversation: [
        { role: "user", content: FIXED_REFINEMENT_INPUT },
        { role: "assistant", content: assistantMessage },
      ],
    };
  } else if (step.stage === "build") {
    common.meta = {
      source: "real_ai_minimal_refinement_mvp_proxy_contour",
      result_schema: RESULT_SCHEMA_FIXTURE,
      applied_plan_context: {
        plan_id: "scriptwriter_pro",
        plan_tier: "pro",
        status: "active",
        features: {
          "scriptwriter.interactive.enabled": true,
          "scriptwriter.advanced.enabled": true,
          "scriptwriter.build.enabled": true,
        },
      },
    };
  }
  return common;
}

function createResponseCollector() {
  let statusCode = 0;
  let payload = null;
  const headers = {};
  return {
    res: {
      setHeader(key, value) { headers[String(key)] = String(value); },
      status(code) { statusCode = Number(code); return this; },
      json(value) { payload = value; return value; },
      end() { return null; },
    },
    snapshot() { return { statusCode, payload, headers }; },
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function flattenPatch(value, prefix = "", output = []) {
  if (!isPlainObject(value)) return output;
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(child)) flattenPatch(child, next, output);
    else output.push(next);
  }
  return output;
}
function assertNoForbiddenKeys(value, currentPath = "response") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertNoForbiddenKeys(child, `${currentPath}[${index}]`));
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    assert.equal(FORBIDDEN_KEYS.has(key), false, `forbidden response key ${currentPath}.${key}`);
    assertNoForbiddenKeys(child, `${currentPath}.${key}`);
  }
}
function assertPatchAllowed(stage, patch) {
  if (patch == null) return;
  const allowed = PATCH_PATHS[stage];
  for (const patchPath of flattenPatch(patch)) {
    assert.equal(allowed.has(patchPath), true, `${stage} returned forbidden patch path ${patchPath}`);
  }
}
function assertUsableMessage(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim().length > 0, `${label} must be non-empty`);
}

function assertStepResponse(step, snapshot) {
  assert.equal(snapshot.statusCode, 200, `${step.id} HTTP status`);
  assert.ok(snapshot.payload && typeof snapshot.payload === "object", `${step.id} response payload missing`);
  assert.equal(snapshot.payload.stage, step.stage, `${step.id} exact stage mismatch`);
  assert.equal(snapshot.payload.status, "ok", `${step.id} status must be ok`);
  assertNoForbiddenKeys(snapshot.payload.output, `${step.id}.output`);
  assertNoForbiddenKeys(snapshot.payload.blueprint_patch, `${step.id}.blueprint_patch`);
  assertPatchAllowed(step.stage, snapshot.payload.blueprint_patch);

  if (step.stage !== "build") {
    assert.equal(Object.prototype.hasOwnProperty.call(snapshot.payload, "final_result"), false, `${step.id} must not return canonical final_result`);
    assert.equal(snapshot.payload.output && Object.prototype.hasOwnProperty.call(snapshot.payload.output, "final_result"), false, `${step.id}.output must not return canonical final_result`);
  }

  if (step.id === "refinement_chat") {
    assertUsableMessage(snapshot.payload.output && snapshot.payload.output.message, "Refinement CHAT message");
    assert.equal(snapshot.payload.blueprint_patch, null, "Refinement CHAT must be read-only");
  } else if (step.id === "refinement_apply") {
    assertUsableMessage(snapshot.payload.output && snapshot.payload.output.message, "Refinement APPLY message");
    assert.ok(isPlainObject(snapshot.payload.blueprint_patch), "Refinement APPLY blueprint_patch must be an object");
    const patchPaths = flattenPatch(snapshot.payload.blueprint_patch);
    assert.ok(patchPaths.length > 0, "standard Refinement APPLY happy path must return a non-empty patch");
    patchPaths.forEach((patchPath) => assert.equal(PATCH_PATHS.refinement.has(patchPath), true, `APPLY returned forbidden patch path ${patchPath}`));
  } else if (step.stage === "build") {
    const blocks = snapshot.payload.output && snapshot.payload.output.blocks;
    assert.ok(isPlainObject(blocks), "build candidate blocks missing");
    const allowed = new Set(RESULT_SCHEMA_FIXTURE.blocks);
    const keys = Object.keys(blocks);
    assert.ok(keys.length > 0, "build candidate blocks empty");
    keys.forEach((key) => assert.equal(allowed.has(key), true, `unknown build block ${key}`));
    assert.equal(Object.prototype.hasOwnProperty.call(snapshot.payload, "final_result"), false, "Proxy must not create final_result");
  }
}

function classifyFailure(error) {
  const message = String(error && error.message || error || "");
  if (/REAL_AI_RUNTIME_CONFIG_MISSING|fetch failed|ENOTFOUND|ECONN|ETIMEDOUT|429|5\d\d|OpenAI|provider/i.test(message)) {
    return "INFRA_FAILURE";
  }
  return "PRODUCT_REGRESSION";
}

function buildRunMetadata({ outcome, failureClass, observedModel, liveCallCount, startedAt, results = [] }) {
  const finishedAt = new Date();
  return {
    run_id: String(process.env.GITHUB_RUN_ID || `local-${crypto.randomUUID()}`),
    repository: String(process.env.GITHUB_REPOSITORY || "local/livi-ai-scriptwriter-proxy"),
    branch: String(process.env.GITHUB_REF_NAME || "local"),
    commit_sha: String(process.env.GITHUB_SHA || "local-uncommitted"),
    accepted_baseline_identity: ACCEPTED_BASELINE_ID,
    workflow_test_version: TEST_VERSION,
    scenario_version: SCENARIO_ID,
    openai_model_label: observedModel || null,
    started_at: startedAt.toISOString(),
    finished_at: finishedAt.toISOString(),
    total_duration_ms: finishedAt.getTime() - startedAt.getTime(),
    live_call_count: liveCallCount,
    automatic_retry: false,
    outcome,
    failure_class: failureClass || null,
    results,
  };
}

function writeRequiredArtifacts(recorder, metadata, buildCandidateBlocks) {
  writeSanitizedJson(path.join(ARTIFACT_DIR, "run.json"), metadata);
  writeSanitizedNdjson(path.join(ARTIFACT_DIR, "events.ndjson"), recorder.events);
  writeSanitizedJson(path.join(ARTIFACT_DIR, "final_result.json"), {
    canonical_final_result: null,
    proxy_is_final_result_owner: false,
    build_candidate_blocks: buildCandidateBlocks || null,
  });
  writeSanitizedJson(path.join(ARTIFACT_DIR, "openai_diagnostics.json"), {
    model_label: metadata.openai_model_label,
    live_call_count: metadata.live_call_count,
    provider_events: recorder.events.filter((event) => event && /^provider_/.test(String(event.type || ""))),
  });
  writeSanitizedText(path.join(ARTIFACT_DIR, "summary.md"), [
    "# Real-AI Proxy Minimal Refinement MVP Contour",
    "",
    `Outcome: ${metadata.outcome}`,
    `Failure class: ${metadata.failure_class || "none"}`,
    `Scenario: ${metadata.scenario_version}`,
    `Live AI calls: ${metadata.live_call_count}`,
    "Refinement operations: CHAT -> APPLY",
    "Automatic AI retry: NO",
    "Canonical final_result created by Proxy: NO",
  ].join("\n"));
}

async function main() {
  const runtimeConfig = requireRuntimeConfig();
  const recorder = createTraceRecorder({ artifactDir: ARTIFACT_DIR });
  const nativeFetch = global.fetch;
  if (typeof nativeFetch !== "function") throw new Error("REAL_AI_NATIVE_FETCH_MISSING");

  let liveCallCount = 0;
  let observedModel = runtimeConfig.model;
  let buildCandidateBlocks = null;
  let activeSurface = null;
  let chatAssistantMessage = null;
  const startedAt = new Date();

  global.fetch = async (url, options = {}) => {
    liveCallCount += 1;
    if (liveCallCount > MAX_LIVE_CALLS) {
      const error = new Error(`REAL_AI_LIVE_CALL_LIMIT_EXCEEDED:${liveCallCount}`);
      error.code = "REAL_AI_LIVE_CALL_LIMIT_EXCEEDED";
      throw error;
    }

    let providerBody = null;
    try { providerBody = JSON.parse(String(options.body || "")); } catch (_) {}
    if (providerBody && providerBody.model) observedModel = String(providerBody.model);
    recorder.record("provider_request", {
      call_index: liveCallCount,
      url: String(url),
      method: options.method || "POST",
      headers: options.headers || {},
      body: providerBody,
    });

    const response = await nativeFetch(url, options);
    recorder.record("provider_response", {
      call_index: liveCallCount,
      http_status: response.status,
      http_ok: response.ok === true,
      surface: activeSurface,
    });
    try {
      const diagnostic = await captureProviderModelOutput({
        response,
        callIndex: liveCallCount,
        surface: activeSurface,
        artifactDir: ARTIFACT_DIR,
      });
      recorder.record("provider_model_output_capture", {
        call_index: liveCallCount,
        http_status: response.status,
        surface: activeSurface,
        artifact_file: diagnostic.artifact_file,
        model_output_json_parse_ok: diagnostic.model_output_json != null,
        parse_error: diagnostic.parse_error,
      });
    } catch (error) {
      recorder.record("provider_model_output_capture_error", {
        call_index: liveCallCount,
        http_status: response.status,
        surface: activeSurface,
        error: { name: error && error.name, code: error && error.code, message: error && error.message },
      });
    }
    return response;
  };

  delete require.cache[HANDLER_PATH];
  const handler = require(HANDLER_PATH);
  assert.equal(typeof handler, "function", "accepted handleScriptV2Request export missing");

  const results = [];
  try {
    for (let index = 0; index < STEPS.length; index += 1) {
      const step = STEPS[index];
      activeSurface = step.id;
      const requestBody = requestForStep(step, { chatAssistantMessage });

      if (step.stage === "development") assert.equal(requestBody.user_input, null, "Development must use user_input:null");
      if (step.id === "refinement_chat") {
        assert.equal(requestBody.stage, "refinement");
        assert.equal(requestBody.user_input, FIXED_REFINEMENT_INPUT);
        assert.equal(requestBody.meta.refinement_operation, "chat");
        assert.ok(Array.isArray(requestBody.meta.refinement_conversation));
      }
      if (step.id === "refinement_apply") {
        assert.equal(requestBody.stage, "refinement");
        assert.equal(requestBody.user_input, null);
        assert.equal(requestBody.meta.refinement_operation, "apply");
        assert.deepEqual(requestBody.meta.refinement_conversation, [
          { role: "user", content: FIXED_REFINEMENT_INPUT },
          { role: "assistant", content: chatAssistantMessage },
        ]);
      }
      if (step.stage === "build") {
        assert.ok(Array.isArray(requestBody.meta.result_schema.blocks) && requestBody.meta.result_schema.blocks.length > 0);
      }

      recorder.record("surface_request", { surface: step.id, request: requestBody });
      writeSanitizedJson(path.join(ARTIFACT_DIR, `request_${String(index + 1).padStart(2, "0")}_${step.id}.json`), requestBody);

      const collector = createResponseCollector();
      await handler({ method: "POST", body: requestBody }, collector.res);
      const snapshot = collector.snapshot();
      assertStepResponse(step, snapshot);

      if (step.id === "refinement_chat") {
        chatAssistantMessage = snapshot.payload.output.message.trim();
      }
      if (step.stage === "build") {
        buildCandidateBlocks = snapshot.payload.output && snapshot.payload.output.blocks || null;
      }
      results.push({ id: step.id, stage: step.stage, operation: step.operation || null, status: snapshot.payload.status });
      recorder.record("surface_response", { surface: step.id, response: snapshot.payload });
      writeSanitizedJson(path.join(ARTIFACT_DIR, `response_${String(index + 1).padStart(2, "0")}_${step.id}.json`), snapshot.payload);
    }

    assert.equal(liveCallCount, MAX_LIVE_CALLS, "standard Proxy Minimal Refinement contour must perform exactly 7 live provider calls");
    assert.deepEqual(results.map((item) => item.id), STEPS.map((step) => step.id), "Proxy contour step order mismatch");
    const metadata = buildRunMetadata({ outcome: "PASS", failureClass: null, observedModel, liveCallCount, startedAt, results });
    recorder.flush(metadata);
    writeRequiredArtifacts(recorder, metadata, buildCandidateBlocks);
    console.log(JSON.stringify({ status: "PASS", steps: STEPS.length, live_call_count: liveCallCount }));
  } catch (error) {
    recorder.record("failure", { failure_class: classifyFailure(error), error: { name: error && error.name, code: error && error.code, message: error && error.message } });
    const metadata = buildRunMetadata({
      outcome: "FAIL",
      failureClass: classifyFailure(error),
      observedModel,
      liveCallCount,
      startedAt,
      results,
    });
    recorder.flush(metadata);
    writeRequiredArtifacts(recorder, metadata, buildCandidateBlocks);
    throw error;
  } finally {
    global.fetch = nativeFetch;
  }
}

if (require.main === module) {
  main().catch((error) => {
    const safe = redactSecrets({ name: error && error.name, code: error && error.code, message: error && error.message });
    console.error(JSON.stringify({ status: "FAIL", failure_class: classifyFailure(error), error: safe }));
    process.exitCode = 1;
  });
}

module.exports = Object.freeze({
  main,
  requireRuntimeConfig,
  requestForStep,
  assertStepResponse,
  classifyFailure,
  RESULT_SCHEMA_FIXTURE,
  STEPS,
});
