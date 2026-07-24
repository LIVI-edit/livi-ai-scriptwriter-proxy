const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fx = require("./fixtures/package6-behavior");
const handlerPath = path.resolve(__dirname, "../api/script-v2.js");

async function invokeDevelopment(model, options = {}) {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldFetch = global.fetch;
  process.env.OPENAI_API_KEY = "mock-only";
  global.fetch = async () => ({
    ok: options.providerOk !== false,
    async text() { return options.providerText || "SECRET provider body /internal/path stack"; },
    async json() { return { output_text: JSON.stringify(model) }; },
  });
  delete require.cache[handlerPath];
  const handler = require(handlerPath);
  let payload;
  let statusCode = 0;
  const res = {
    setHeader() {},
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return value; },
    end() {},
  };
  try {
    await handler({
      method: "POST",
      body: {
        stage: "development",
        language: "ru",
        blueprint: fx.blueprint({ system_state: { current_stage: "development" } }),
        user_input: { raw_text: "Продолжай" },
        ui_context: { scene_action: "reveal" },
        meta: {},
      },
    }, res);
    return { payload, statusCode };
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
}

function assertExactEnvelope(payload) {
  assert.deepEqual(Object.keys(payload).sort(), ["blueprint_patch", "error", "meta", "output", "stage", "status"]);
  assert.equal(payload.stage, "development");
}

function developmentWith(status, overrides = {}) {
  const model = fx.development("ru");
  return { ...model, status, ...overrides };
}

test("Package 6B Proxy Development ok exact envelope", async () => {
  const { payload, statusCode } = await invokeDevelopment(developmentWith("ok"));
  assert.equal(statusCode, 200);
  assertExactEnvelope(payload);
  assert.equal(payload.status, "ok");
  assert.ok(payload.output.message);
  assert.deepEqual(payload.output.questions, []);
  assert.equal(payload.error, null);
  assert.deepEqual(Object.keys(payload.blueprint_patch).sort(), [
    "narrative.scene_development",
    "narrative.scene_setup",
    "scene_core.main_focus",
  ]);
});

test("Package 6B Proxy Development blocked preserves safe output and discards patch", async () => {
  const { payload } = await invokeDevelopment(developmentWith("blocked"));
  assertExactEnvelope(payload);
  assert.equal(payload.status, "blocked");
  assert.ok(payload.output.message);
  assert.deepEqual(payload.output.questions, []);
  assert.equal(payload.blueprint_patch, null);
  assert.equal(payload.error, null);
});

test("Package 6B Proxy Development model-status error returns no partial content", async () => {
  const model = developmentWith("error", {
    message: "Сцена не собрана из-за SECRET provider body /internal/path stack. Решение можно повторить позже.",
  });
  const { payload } = await invokeDevelopment(model);
  assertExactEnvelope(payload);
  assert.equal(payload.status, "error");
  assert.equal(payload.output, null);
  assert.equal(payload.blueprint_patch, null);
  assert.deepEqual(payload.error, { code: "DEVELOPMENT_ERROR", message: "Development failed." });
  assert.doesNotMatch(JSON.stringify(payload), /SECRET|provider body|internal\/path|stack/i);
});

test("Package 6B Proxy invalid Development shape is DEVELOPMENT_RESPONSE_INVALID", async () => {
  const { payload } = await invokeDevelopment({ status: "error", message: "Only one sentence", questions: [] });
  assertExactEnvelope(payload);
  assert.equal(payload.status, "error");
  assert.equal(payload.output, null);
  assert.equal(payload.blueprint_patch, null);
  assert.deepEqual(payload.error, {
    code: "DEVELOPMENT_RESPONSE_INVALID",
    message: "Development response failed validation.",
  });
});

test("Package 6B Proxy Development remains strict for forbidden keys, paths and empty ok patch", async () => {
  for (const model of [
    { ...developmentWith("ok"), route: "refinement" },
    developmentWith("ok", { patch: { scene_core: { seed_scene: "forbidden" } } }),
    developmentWith("ok", { patch: {} }),
  ]) {
    const { payload } = await invokeDevelopment(model);
    assert.equal(payload.status, "error");
    assert.equal(payload.error.code, "DEVELOPMENT_RESPONSE_INVALID");
    assert.equal(payload.output, null);
    assert.equal(payload.blueprint_patch, null);
  }
});

test("Package 6B provider failure leaks no provider/model/internal data", async () => {
  const { payload } = await invokeDevelopment({}, { providerOk: false, providerText: "SECRET model stack /internal/path" });
  assert.equal(payload.error.code, "DEVELOPMENT_RESPONSE_INVALID");
  assert.doesNotMatch(JSON.stringify(payload), /SECRET|model stack|internal\/path/i);
});
