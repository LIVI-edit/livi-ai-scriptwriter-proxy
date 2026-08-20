const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const handlerPath = path.resolve(__dirname, '../api/script-v2.js');

function blueprint() {
  return {
    meta: { video_type: 'video', scriptwriter_role: 'creative_director', language: 'ru' },
    goal: { video_topic: 'Topic', video_goal: 'story_narrative' },
    scene_core: { seed_scene: 'Seed', main_focus: 'Focus', scene_action: 'reveal' },
    narrative: { scene_setup: 'Setup', scene_development: 'Development' },
    visual_direction: { emotion: 'calm' },
    extensions: {},
    system_state: { current_stage: 'refinement' },
  };
}

async function invoke(operation, model, options = {}) {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldFetch = global.fetch;
  const oldWarn = console.warn;
  const warnings = [];
  process.env.OPENAI_API_KEY = 'mock-only';
  let providerRequest = null;
  global.fetch = async (_url, request) => {
    providerRequest = JSON.parse(request.body);
    if (options.providerFailure) return { ok: false, async text() { return options.providerFailure; } };
    return { ok: true, async json() { return { output_text: JSON.stringify(model) }; } };
  };
  console.warn = (...args) => warnings.push(args);
  delete require.cache[handlerPath];
  const handler = require(handlerPath);
  let statusCode = null;
  let payload = null;
  const req = {
    method: 'POST',
    body: {
      stage: 'refinement',
      language: options.language || 'ru',
      blueprint: options.blueprint || blueprint(),
      user_input: operation === 'chat' ? (options.user_input || 'Усиль развитие') : null,
      ui_context: {},
      meta: {
        refinement_operation: operation,
        refinement_conversation: options.conversation || [],
      },
    },
  };
  const res = {
    setHeader() {},
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return value; },
    end() {},
  };
  try {
    await handler(req, res);
    return { statusCode, payload, warnings, providerRequest };
  } finally {
    global.fetch = oldFetch;
    console.warn = oldWarn;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
}

test('CHAT preserves usable message while dropping harmless unknown non-authority sidecar with trace', async () => {
  const r = await invoke('chat', {
    message: 'Сообщение остаётся пригодным.',
    suggestions: ['Усилить темп'],
    telemetry_note: { trace_id: 'abc-123', provider_hint: 'harmless' },
  });
  assert.equal(r.statusCode, 200);
  assert.equal(r.payload.status, 'ok');
  assert.equal(r.payload.output.message, 'Сообщение остаётся пригодным.');
  assert.deepEqual(r.payload.output.suggestions, ['Усилить темп']);
  assert.equal(r.payload.blueprint_patch, null);
  assert.equal(Object.prototype.hasOwnProperty.call(r.payload.output, 'telemetry_note'), false);
  assert.ok(r.warnings.some((args) => JSON.stringify(args).includes('SCRIPT_V2_REFINEMENT_SIDECAR_DROPPED')));
});

test('CHAT retired V2 machine sidecars are discarded and never become public truth', async () => {
  const r = await invoke('chat', {
    message: 'Живой ответ.',
    user_intent_label: 'ready_to_continue',
    anchor_hint: 'conflict',
    selected_option_id: 'old-option',
    options: [{ id: 'old-option' }],
  });
  assert.equal(r.payload.status, 'ok');
  assert.deepEqual(Object.keys(r.payload.output).sort(), ['confirmation_label', 'message', 'suggestions']);
  assert.equal(r.payload.output.message, 'Живой ответ.');
  assert.equal(r.payload.blueprint_patch, null);
});

test('CHAT authority/state carrier is quarantined and cannot carry mutation', async () => {
  for (const model of [
    { message: 'Safe text', route: 'alignment' },
    { message: 'Safe text', sidecar: { system_state: { current_stage: 'alignment' } } },
    { message: 'Safe text', blueprint_patch: { narrative: { scene_development: 'forbidden' } } },
    { message: 'Safe text', final_result: { blocks: {} } },
  ]) {
    const r = await invoke('chat', model);
    assert.equal(r.statusCode, 200);
    assert.equal(r.payload.status, 'blocked');
    assert.equal(r.payload.output.message, 'Safe text');
    assert.equal(r.payload.blueprint_patch, null);
  }
});

test('CHAT blueprint and changes mutation carriers are quarantined recursively', async () => {
  for (const model of [
    { message: 'Safe text', blueprint: { scene_core: { main_focus: 'forbidden' } } },
    { message: 'Safe text', changes: { main_focus: 'forbidden' } },
    { message: 'Safe text', telemetry_note: { nested: { blueprint: { scene_core: { main_focus: 'forbidden' } } } } },
  ]) {
    const r = await invoke('chat', model);
    assert.equal(r.statusCode, 200);
    assert.equal(r.payload.status, 'blocked');
    assert.equal(r.payload.output.message, 'Safe text');
    assert.equal(r.payload.blueprint_patch, null);
  }
});

test('CHAT presentation suggestions are optional best-effort and never mutation carriers', async () => {
  const r = await invoke('chat', {
    message: 'Продолжаем.',
    suggestions: ['Первое', 42, '', 'Второе', 'Третье', 'Четвёртое'],
    confirmation_label: 42,
  });
  assert.equal(r.payload.status, 'ok');
  assert.deepEqual(r.payload.output.suggestions, ['Первое', 'Второе', 'Третье']);
  assert.equal(r.payload.output.confirmation_label, null);
  assert.equal(r.payload.blueprint_patch, null);
});

test('APPLY maps only four frozen proposal fields to exact Blueprint paths', async () => {
  const r = await invoke('apply', {
    message: 'Фиксирую согласованное.',
    proposal: {
      main_focus: 'Новый фокус',
      scene_setup: 'Новый setup',
      scene_development: 'Новое развитие',
      emotion: 'mysterious',
    },
  }, { conversation: [{ role: 'user', content: 'Сделай сцену напряжённее' }, { role: 'assistant', content: 'Усилим выбор героя.' }] });
  assert.equal(r.statusCode, 200);
  assert.equal(r.payload.status, 'ok');
  assert.deepEqual(r.payload.blueprint_patch, {
    'scene_core.main_focus': 'Новый фокус',
    'narrative.scene_setup': 'Новый setup',
    'narrative.scene_development': 'Новое развитие',
    'visual_direction.emotion': 'mysterious',
  });
  assert.deepEqual(Object.keys(r.payload.output), ['message']);
});

test('APPLY accepts an empty no-op proposal', async () => {
  const r = await invoke('apply', { message: 'Новых изменений нет.', proposal: {} });
  assert.equal(r.payload.status, 'ok');
  assert.deepEqual(r.payload.blueprint_patch, {});
});

test('APPLY rejects unknown fifth field atomically with null public patch', async () => {
  const r = await invoke('apply', {
    message: 'Пробую применить.',
    proposal: { main_focus: 'Allowed candidate', seed_scene: 'Forbidden candidate' },
  });
  assert.equal(r.payload.status, 'blocked');
  assert.equal(r.payload.blueprint_patch, null);
  assert.equal(r.payload.output.message, 'Пробую применить.');
});

test('APPLY rejects invalid proposal value atomically', async () => {
  const r = await invoke('apply', {
    message: 'Пробую применить.',
    proposal: { main_focus: 'Allowed candidate', emotion: '' },
  });
  assert.equal(r.payload.status, 'blocked');
  assert.equal(r.payload.blueprint_patch, null);
});

test('APPLY authority carrier is quarantined even with otherwise valid proposal', async () => {
  const r = await invoke('apply', {
    message: 'Фиксирую.',
    proposal: { scene_development: 'Allowed candidate' },
    readiness: true,
  });
  assert.equal(r.payload.status, 'blocked');
  assert.equal(r.payload.blueprint_patch, null);
});

test('APPLY blueprint and changes mutation carriers are quarantined with valid proposal', async () => {
  for (const carrier of [
    { blueprint: { scene_core: { main_focus: 'forbidden' } } },
    { changes: { main_focus: 'forbidden' } },
  ]) {
    const r = await invoke('apply', {
      message: 'Фиксирую.',
      proposal: { scene_development: 'Allowed candidate' },
      ...carrier,
    });
    assert.equal(r.statusCode, 200);
    assert.equal(r.payload.status, 'blocked');
    assert.equal(r.payload.output.message, 'Фиксирую.');
    assert.equal(r.payload.blueprint_patch, null);
  }
});

test('Refinement provider failure remains controlled and leaks no raw provider text', async () => {
  const r = await invoke('chat', { message: 'unused' }, { providerFailure: 'SECRET prompt /internal/stack' });
  assert.equal(r.statusCode, 200);
  assert.equal(r.payload.status, 'error');
  assert.equal(r.payload.output, null);
  assert.equal(r.payload.blueprint_patch, null);
  assert.equal(r.payload.error.code, 'REFINEMENT_RESPONSE_FATAL');
  assert.doesNotMatch(JSON.stringify(r.payload), /SECRET|internal|stack|prompt/i);
});
