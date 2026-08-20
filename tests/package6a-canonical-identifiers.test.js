const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const fx = require('./fixtures/package6-behavior');
const handlerPath = path.resolve(__dirname, '../api/script-v2.js');

const STAGES = ['scene_ideas', 'selection', 'development', 'refinement', 'alignment'];
const ROLES = ['creative_director', 'commercial_strategist', 'cinematographer', 'film_director'];
const TYPES = ['video', 'promo', 'interactive', 'video_prompt', 'image_prompt'];
const GOALS = ['product_service', 'brand_video', 'promotion_ad', 'presentation_pitch', 'social_media', 'education_explainer', 'story_narrative', 'creative_concept'];
const EMOTIONS = ['epic', 'inspiring', 'technological', 'mysterious', 'calm', 'energetic', 'minimalist', 'dreamlike', 'neutral'];
const ACTIONS = ['reveal', 'journey', 'transformation', 'interaction', 'presentation', 'discovery', 'choice', 'system_awakening'];
const EXTENSIONS = ['characters', 'dialogue', 'voice_over', 'camera_details', 'timing', 'visual_style_extra', 'branching', 'image_prompt', 'video_prompt', 'cta_strategy'];

const LEGACY_ROLE_ALIASES = [
  'creative_director_role', 'cinematic', 'nika', 'Nika', 'nika_creative_director',
  'commercial', 'viral', 'max', 'Max', 'max_commercial_strategist',
  'camera', 'brand', 'sara', 'Sara', 'sara_cinematographer',
  'director', 'interactive', 'zhora', 'Zhora', 'zhora_film_director',
  'Креативный директор', 'Коммерческий стратег', 'Оператор-постановщик', 'Режиссёр-постановщик'
];
const LEGACY_TYPE_ALIASES = [
  'Video', 'Promo', 'промо', 'Interactive', 'interactive_pro', 'интерактив', 'интерактив_pro',
  'Video Prompt', 'Image Prompt', 'Интерактив PRO'
];
const LEGACY_GOAL_ALIASES = [
  'product', 'service', 'товар_услуга', 'Product / Service', 'Товар / услуга',
  'brand', 'бренд_видео', 'Brand Video', 'Бренд-видео',
  'promotion', 'ad', 'promo', 'продвижение_реклама', 'Promotion / Ad', 'Продвижение / реклама',
  'presentation', 'pitch', 'презентация_питч', 'Presentation / Pitch', 'Презентация / питч',
  'youtube_social', 'youtube', 'social', 'соцсети', 'youtube_соцсети', 'YouTube / Social', 'YouTube / соцсети',
  'explainer_education', 'explainer', 'education', 'объяснение_обучение', 'Explainer / Education', 'Объяснение / обучение',
  'story', 'narrative', 'история_нарратив', 'Story / Narrative', 'История / нарратив',
  'creative', 'concept', 'креатив_концепт', 'general', 'Creative / Concept', 'Креатив / концепт'
];
const LEGACY_EMOTION_ALIASES = [
  'Epic', 'Эпично', 'Inspirational', 'Inspiring', 'Вдохновляюще', 'Technological', 'Технологично',
  'Mysterious', 'Таинственно', 'Calm', 'Спокойно', 'Energetic', 'Энергично',
  'minimal', 'Minimal', 'Minimalist', 'Минималистично', 'Dreamlike', 'Сновидчески', 'Neutral'
];
const LEGACY_ACTION_ALIASES = [
  'Reveal', 'Journey', 'Transformation', 'Interaction', 'Presentation', 'Discovery', 'Choice',
  'System Awakening', 'Раскрытие', 'Путешествие', 'Трансформация', 'Взаимодействие', 'Презентация', 'Открытие', 'Выбор', 'Пробуждение системы'
];
const LEGACY_EXTENSION_ALIASES = [
  'characters_pro', 'voiceover', 'voice_over_pro', 'camera_details_pro', 'camera_plan', 'camera_plan_pro',
  'video_prompts', 'video_prompt_pro', 'video_prompts_pro', 'branching_choices', 'branching_choices_pro',
  'cta', 'cta_strategy_pro', 'scene_prompt', 'scene_prompts', 'scene_prompts_pro',
  'dialogue_mode', 'dialogue_mode_pro', 'timing_pro', 'visual_style', 'visual_style_extra_pro'
];
const PROXY_ONLY_EXTENSION_ALIASES = [
  'branching_choices_pro', 'camera_details_pro', 'camera_plan_pro', 'characters_pro',
  'cta_strategy_pro', 'dialogue_mode_pro', 'scene_prompts_pro', 'timing_pro',
  'video_prompt_pro', 'video_prompts_pro', 'visual_style_extra_pro', 'voice_over_pro'
];

function expectedRole(blueprint) {
  const value = blueprint?.meta?.scriptwriter_role;
  return value === '' || value === null || value === undefined ? 'creative_director' : value;
}
function expectedType(blueprint) {
  const value = blueprint?.meta?.video_type;
  return value === '' || value === null || value === undefined ? 'video' : value;
}
function modelFor(stage, language = 'ru', blueprint = fx.blueprint()) {
  if (stage === 'scene_ideas') return fx.ideas(language);
  if (stage === 'selection') return fx.selection(language);
  if (stage === 'development') return fx.development(language);
  if (stage === 'alignment') return fx.alignment(language);
  if (stage === 'refinement') {
    return {
      message: language === 'en' ? 'Usable refinement message.' : 'Рабочий refinement ответ.',
      suggestions: [],
      confirmation_label: null
    };
  }
  return { blocks: { video_overview: 'Usable overview' } };
}

async function invoke({ stage = 'scene_ideas', blueprint = fx.blueprint(), language = 'ru', model, extra = {} } = {}) {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldFetch = global.fetch;
  process.env.OPENAI_API_KEY = 'mock-only';
  let fetchCalled = 0;
  let requestBody = null;
  global.fetch = async (_url, req) => {
    fetchCalled += 1;
    requestBody = JSON.parse(req.body);
    return {
      ok: true,
      async json() {
        return { output_text: JSON.stringify(model || modelFor(stage, language, blueprint)) };
      }
    };
  };
  delete require.cache[handlerPath];
  const handler = require(handlerPath);
  let statusCode = 0;
  let payload;
  const body = {
    stage,
    language,
    blueprint,
    user_input: stage === 'selection' ? { seed_scene: 'Chosen scene' } : stage === 'refinement' ? 'same topic' : { raw_text: 'same topic' },
    ui_context: { scene_action: 'raw-ui-ignored' },
    meta: stage === 'refinement' ? { refinement_operation: 'chat', refinement_conversation: [] } : {},
    ...extra
  };
  const before = JSON.parse(JSON.stringify(body));
  const req = { method: 'POST', body };
  const res = {
    setHeader() {},
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return value; },
    end() {}
  };
  try {
    await handler(req, res);
    return { statusCode, payload, requestBody, fetchCalled, requestBefore: before, requestAfter: body };
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
}

function promptText(result) {
  return (result.requestBody?.input || [])
    .flatMap((message) => message.content || [])
    .map((content) => content.text || '')
    .join('\n');
}
function bp(overrides = {}) { return fx.blueprint(overrides); }
function setPathFamily(family, value) {
  if (family === 'role') return { meta: { scriptwriter_role: value } };
  if (family === 'video_type') return { meta: { video_type: value } };
  if (family === 'goal') return { goal: { video_goal: value } };
  if (family === 'emotion') return { visual_direction: { emotion: value } };
  if (family === 'scene_action') return { scene_core: { scene_action: value } };
  if (family === 'extension') return { extensions: { [value]: { enabled: true } } };
  throw new Error(`Unknown family ${family}`);
}
async function assertRejected({ stage, family, value }) {
  const blueprint = bp(setPathFamily(family, value));
  const result = await invoke({ stage, blueprint });
  assert.equal(result.statusCode, 400, `${stage}/${family}/${value}`);
  assert.equal(result.payload.status, 'error', `${stage}/${family}/${value}`);
  assert.equal(result.payload.error.code, 'SETTINGS_IDENTIFIER_INVALID', `${stage}/${family}/${value}`);
  assert.equal(result.fetchCalled, 0, `${stage}/${family}/${value}`);
  assert.equal(result.payload.blueprint_patch, null, `${stage}/${family}/${value}`);
  assert.deepEqual(result.requestAfter, result.requestBefore, `${stage}/${family}/${value} request mutation`);
  assert.equal(Object.hasOwn(result.payload.meta || {}, 'role_id_echo'), false, `${stage}/${family}/${value}`);
  assert.equal(Object.hasOwn(result.payload.meta || {}, 'video_type_echo'), false, `${stage}/${family}/${value}`);
}

for (const [name, values, setter, promptRequired = true] of [
  ['role', ROLES, (id) => ({ meta: { scriptwriter_role: id } })],
  ['video type', TYPES, (id) => ({ meta: { video_type: id } })],
  ['goal', GOALS, (id) => ({ goal: { video_goal: id } })],
  ['emotion', EMOTIONS, (id) => ({ visual_direction: { emotion: id } })],
  ['scene action', ACTIONS, (id) => ({ scene_core: { scene_action: id } })],
  ['extension', EXTENSIONS, (id) => ({ extensions: { [id]: { enabled: true } } }), false]
]) {
  test(`all canonical ${name} identifiers are accepted on every normal stage`, async () => {
    for (const stage of STAGES) {
      for (const id of values) {
        const result = await invoke({ stage, blueprint: bp(setter(id)) });
        assert.equal(result.statusCode, 200, `${stage}/${id}`);
        assert.equal(result.payload.status, 'ok', `${stage}/${id}`);
        assert.equal(result.fetchCalled, 1, `${stage}/${id}`);
        if (promptRequired) assert.match(promptText(result), new RegExp(`\\b${id}\\b`), `${stage}/${id}`);
      }
    }
  });
}

test('absent and empty field defaults are exact on every normal stage', async () => {
  for (const variant of ['empty', 'absent']) {
    for (const stage of STAGES) {
      const blueprint = bp({ extensions: {} });
      if (variant === 'empty') {
        blueprint.meta.scriptwriter_role = '';
        blueprint.meta.video_type = '';
        blueprint.goal.video_goal = '';
        blueprint.visual_direction.emotion = '';
        blueprint.scene_core.scene_action = '';
      } else {
        delete blueprint.meta.scriptwriter_role;
        delete blueprint.meta.video_type;
        delete blueprint.goal.video_goal;
        delete blueprint.visual_direction.emotion;
        delete blueprint.scene_core.scene_action;
        delete blueprint.extensions;
      }
      const result = await invoke({ stage, blueprint });
      assert.equal(result.statusCode, 200, `${variant}/${stage}`);
      assert.equal(result.payload.status, 'ok', `${variant}/${stage}`);
      const text = promptText(result);
      for (const id of ['creative_director', 'video', 'creative_concept', 'neutral']) {
        assert.match(text, new RegExp(`\\b${id}\\b`), `${variant}/${stage}/${id}`);
      }
      assert.match(text, /"scene_action"\s*:\s*null/, `${variant}/${stage}/scene_action`);
    }
  }
});

test('all pre-repair role aliases and persona/UI labels fail closed on every normal stage', async () => {
  for (const stage of STAGES) for (const value of LEGACY_ROLE_ALIASES) await assertRejected({ stage, family: 'role', value });
});

test('all noncanonical video type aliases and labels fail closed on every normal stage', async () => {
  for (const stage of STAGES) for (const value of LEGACY_TYPE_ALIASES) await assertRejected({ stage, family: 'video_type', value });
});

test('all noncanonical and localized goal aliases fail closed on every normal stage', async () => {
  for (const stage of STAGES) for (const value of LEGACY_GOAL_ALIASES) await assertRejected({ stage, family: 'goal', value });
});

test('all noncanonical and localized emotion aliases fail closed on every normal stage', async () => {
  for (const stage of STAGES) for (const value of LEGACY_EMOTION_ALIASES) await assertRejected({ stage, family: 'emotion', value });
});

test('noncanonical scene action labels fail closed on every normal stage', async () => {
  for (const stage of STAGES) for (const value of LEGACY_ACTION_ALIASES) await assertRejected({ stage, family: 'scene_action', value });
});

test('all pre-repair extension aliases fail closed on every normal stage', async () => {
  for (const stage of STAGES) for (const value of LEGACY_EXTENSION_ALIASES) await assertRejected({ stage, family: 'extension', value });
});

test('all twelve Proxy-only extension aliases from the HOLD evidence fail closed', async () => {
  for (const value of PROXY_ONLY_EXTENSION_ALIASES) await assertRejected({ stage: 'scene_ideas', family: 'extension', value });
});

test('unknown non-empty identifiers fail closed before model call on every normal stage', async () => {
  const cases = [
    ['role', 'unknown_role'], ['video_type', 'unknown_type'], ['goal', 'unknown_goal'],
    ['emotion', 'unknown_emotion'], ['scene_action', 'unknown_action'], ['extension', 'unknown_extension']
  ];
  for (const stage of STAGES) for (const [family, value] of cases) await assertRejected({ stage, family, value });
});

test('non-string non-empty identifier shapes fail closed instead of being coerced', async () => {
  const cases = [
    ['role', ['creative_director']], ['video_type', { id: 'video' }], ['goal', 1],
    ['emotion', ['epic']], ['scene_action', true]
  ];
  for (const [family, value] of cases) await assertRejected({ stage: 'scene_ideas', family, value });
});

test('interactive remains canonical video type but is rejected as a role alias', async () => {
  const accepted = await invoke({ blueprint: bp({ meta: { scriptwriter_role: 'film_director', video_type: 'interactive' } }) });
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.payload.status, 'ok');
  assert.match(promptText(accepted), /film_director/);
  assert.match(promptText(accepted), /"video_type"\s*:\s*"interactive"/);
  await assertRejected({ stage: 'scene_ideas', family: 'role', value: 'interactive' });
});

test('video_prompt remains a distinct canonical type and canonical extension key', async () => {
  const result = await invoke({ blueprint: bp({ meta: { video_type: 'video_prompt' }, extensions: { video_prompt: { enabled: true } } }) });
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.status, 'ok');
  const text = promptText(result);
  assert.match(text, /"video_type"\s*:\s*"video_prompt"/);
  assert.match(text, /video-prompt intent/);
});

test('Refinement retires trusted V2 echoes while preserving canonical role/type as prompt quality context', async () => {
  for (const role of ROLES) {
    for (const videoType of TYPES) {
      const blueprint = bp({ meta: { scriptwriter_role: role, video_type: videoType } });
      const result = await invoke({ stage: 'refinement', blueprint });
      assert.equal(result.statusCode, 200, `${role}/${videoType}`);
      assert.deepEqual(result.payload.meta, {}, `${role}/${videoType}`);
      const text = promptText(result);
      assert.match(text, new RegExp(`\\b${role}\\b`), `${role}/${videoType}/role`);
      assert.match(text, new RegExp(`\\b${videoType}\\b`), `${role}/${videoType}/type`);
    }
  }
});

test('raw ui_context aliases cannot override canonical Blueprint identifiers', async () => {
  const result = await invoke({
    blueprint: bp({ meta: { scriptwriter_role: 'cinematographer', video_type: 'video_prompt' }, scene_core: { scene_action: 'choice' } }),
    extra: { ui_context: { scriptwriter_role: 'nika', video_type: 'Promo', scene_action: 'Journey' } }
  });
  assert.equal(result.statusCode, 200);
  const text = promptText(result);
  assert.match(text, /cinematographer/);
  assert.match(text, /video_prompt/);
  assert.match(text, /choice/);
  assert.doesNotMatch(text, /nika|Promo|Journey/);
});

test('raw advanced_options.selected remains forbidden and never reaches model', async () => {
  const result = await invoke({ extra: { advanced_options: { selected: ['camera_details'] } } });
  assert.equal(result.statusCode, 400);
  assert.equal(result.payload.error.code, 'SETTINGS_IDENTIFIER_INVALID');
  assert.equal(result.fetchCalled, 0);
});

test('characters_pro runtime proof is reversed: controlled 400, model call 0, no trusted echo or partial mutation', async () => {
  const blueprint = bp({ extensions: { characters_pro: { enabled: true } } });
  const result = await invoke({ stage: 'refinement', blueprint });
  assert.equal(result.statusCode, 400);
  assert.equal(result.payload.status, 'error');
  assert.equal(result.payload.error.code, 'SETTINGS_IDENTIFIER_INVALID');
  assert.equal(result.fetchCalled, 0);
  assert.equal(result.payload.output, null);
  assert.equal(result.payload.blueprint_patch, null);
  assert.deepEqual(result.requestAfter, result.requestBefore);
  assert.equal(Object.hasOwn(result.payload.meta, 'role_id_echo'), false);
  assert.equal(Object.hasOwn(result.payload.meta, 'video_type_echo'), false);
});

test('Proxy source contains canonical validation only and no legacy alias registry', () => {
  const source = fs.readFileSync(handlerPath, 'utf8');
  for (const name of ['ROLE_ALIASES', 'VIDEO_TYPE_ALIASES', 'GOAL_ALIASES', 'EMOTION_ALIASES', 'SCENE_ACTION_ALIASES', 'ADVANCED_MODULE_ALIASES']) {
    assert.doesNotMatch(source, new RegExp(`\\b${name}\\b`), name);
  }
  for (const alias of ['characters_pro', 'camera_plan_pro', 'branching_choices_pro', 'cinematic', 'nika_creative_director', 'товар_услуга', 'эпично']) {
    assert.equal(source.includes(alias), false, alias);
  }
  assert.match(source, /Object\.prototype\.hasOwnProperty\.call\(ROLE_LENSES, value\)/);
  assert.match(source, /CANONICAL_ADVANCED_MODULE_KEYS\.has\(rawKey\)/);
});
