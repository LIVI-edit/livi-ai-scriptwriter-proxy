const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const handlerPath = path.resolve(__dirname, '../api/script-v2.js');

function deepMerge(a, b) {
  const out = structuredClone(a);
  for (const [k, v] of Object.entries(b || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) out[k] = deepMerge(out[k], v);
    else out[k] = structuredClone(v);
  }
  return out;
}

function blueprint(overrides = {}) {
  return deepMerge({
    meta: { scriptwriter_role: 'film_director', video_type: 'interactive', language: 'ru' },
    goal: { video_topic: 'Тема', video_goal: 'story_narrative' },
    scene_core: { seed_scene: 'Seed', main_focus: 'Focus' },
    narrative: { scene_setup: 'Setup', scene_development: 'Development' },
    visual_direction: { emotion: 'calm' },
    system_state: {
      current_stage: 'refinement',
      refinement_state: {
        pending_options: true,
        options_context: [
          { id: 'opt_1', label: 'One', target_anchor: 'structure', mode: 'blocking' },
          { id: 'opt_2', label: 'Two', target_anchor: 'structure', mode: 'blocking' },
        ],
      },
    },
  }, overrides);
}

function model(overrides = {}) {
  return {
    message: 'Безопасное полезное сообщение.',
    user_intent_label: 'brief_or_context',
    ...structuredClone(overrides),
  };
}

async function invoke(providerModel, { bp = blueprint(), userInput = { raw_text: 'fixture' }, nodeEnv = 'production', fetchOk = true, fetchText = 'provider failure' } = {}) {
  const oldKey = process.env.OPENAI_API_KEY;
  const oldEnv = process.env.NODE_ENV;
  const oldFetch = global.fetch;
  process.env.OPENAI_API_KEY = 'fixture-key';
  process.env.NODE_ENV = nodeEnv;
  global.fetch = async () => ({
    ok: fetchOk,
    async text() { return fetchText; },
    async json() { return { output_text: JSON.stringify(providerModel) }; },
  });
  delete require.cache[handlerPath];
  const handler = require(handlerPath);
  const req = { method: 'POST', body: { stage: 'refinement', language: 'ru', blueprint: bp, user_input: userInput } };
  let statusCode = 0;
  let payload = null;
  const res = { setHeader() {}, status(c) { statusCode = c; return this; }, json(v) { payload = v; return v; }, end() {} };
  try {
    await handler(req, res);
    return { statusCode, payload };
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = oldKey;
    if (oldEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnv;
  }
}

function exactTop(payload) {
  assert.deepEqual(Object.keys(payload).sort(), ['blueprint_patch','error','meta','output','stage','status']);
}
function assertBlocked(payload) {
  exactTop(payload);
  assert.equal(payload.stage, 'refinement');
  assert.equal(payload.status, 'blocked');
  assert.equal(payload.error, null);
  assert.equal(payload.blueprint_patch, null);
  assert.deepEqual(payload.output, {
    message: 'Безопасное полезное сообщение.',
    user_intent_label: null,
    anchor_hint: null,
    selected_option_id: null,
    questions: [],
    options: [],
  });
}
function assertTrustedMeta(payload) {
  assert.equal(payload.meta.current_stage_echo, 'refinement');
  assert.equal(payload.meta.role_id_echo, 'film_director');
  assert.equal(payload.meta.video_type_echo, 'interactive');
  assert.equal(payload.meta.language_echo, 'ru');
}

// Cases 1-17: provider contract.
test('V3 case 1 minimal message + brief_or_context', async () => {
  const { payload } = await invoke(model());
  assert.equal(payload.status, 'ok');
  assert.deepEqual(payload.output, { message:'Безопасное полезное сообщение.', user_intent_label:'brief_or_context', anchor_hint:null, selected_option_id:null, questions:[], options:[] });
});
test('V3 case 2 missing message -> fatal', async () => {
  const { payload } = await invoke({ user_intent_label:'brief_or_context' });
  assert.equal(payload.status, 'error'); assert.equal(payload.output, null); assert.equal(payload.blueprint_patch, null);
});
test('V3 case 3 invalid intent + valid message -> blocked salvage', async () => {
  const { payload } = await invoke(model({ user_intent_label:'not_canonical' })); assertBlocked(payload);
});
test('V3 case 4 missing anchor -> accepted null', async () => {
  const { payload } = await invoke(model()); assert.equal(payload.status,'ok'); assert.equal(payload.output.anchor_hint,null);
});
test('V3 case 5 invalid anchor -> accepted null', async () => {
  const { payload } = await invoke(model({ anchor_hint:'not_anchor' })); assert.equal(payload.status,'ok'); assert.equal(payload.output.anchor_hint,null);
});
test('V3 case 6 no provider questions/options -> public arrays', async () => {
  const { payload } = await invoke(model()); assert.deepEqual(payload.output.questions,[]); assert.deepEqual(payload.output.options,[]);
});
test('V3 case 7 question core valid without reason -> accepted', async () => {
  const q={id:'q1',text:'Что важнее?',target_anchor:'conflict'};
  const { payload } = await invoke(model({ user_intent_label:'asks_question', questions:[q] }));
  assert.equal(payload.status,'ok'); assert.deepEqual(payload.output.questions,[q]);
});
test('V3 case 8 question invalid core -> blocked when required', async () => {
  const { payload } = await invoke(model({ user_intent_label:'asks_question', questions:[{id:'q1',text:'x'}] })); assertBlocked(payload);
});
test('V3 case 9 option core valid without presentation fields', async () => {
  const o={id:'o1',label:'Вариант',target_anchor:'structure',mode:'blocking'};
  const { payload } = await invoke(model({ user_intent_label:'wants_more_options', options:[o] }));
  assert.equal(payload.status,'ok'); assert.deepEqual(payload.output.options,[o]);
});
test('V3 case 10 bad option description dropped', async () => {
  const o={id:'o1',label:'Вариант',target_anchor:'structure',mode:'blocking',description:{bad:true}};
  const { payload } = await invoke(model({ user_intent_label:'wants_more_options', options:[o] }));
  assert.equal(payload.status,'ok'); assert.equal('description' in payload.output.options[0],false);
});
test('V3 case 11 bad option effect dropped', async () => {
  const o={id:'o1',label:'Вариант',target_anchor:'structure',mode:'blocking',effect:7};
  const { payload } = await invoke(model({ user_intent_label:'wants_more_options', options:[o] }));
  assert.equal(payload.status,'ok'); assert.equal('effect' in payload.output.options[0],false);
});
test('V3 case 12 bad option recommended dropped', async () => {
  const o={id:'o1',label:'Вариант',target_anchor:'structure',mode:'blocking',recommended:'yes'};
  const { payload } = await invoke(model({ user_intent_label:'wants_more_options', options:[o] }));
  assert.equal(payload.status,'ok'); assert.equal('recommended' in payload.output.options[0],false);
});
test('V3 case 13 model meta absent -> accepted', async () => {
  const { payload } = await invoke(model()); assert.equal(payload.status,'ok'); assertTrustedMeta(payload);
});
test('V3 case 14 model meta mismatch ignored in production and diagnostic in test', async () => {
  const prod = await invoke(model({ meta:{current_stage_echo:'build'} })); assert.equal(prod.payload.status,'ok'); assertTrustedMeta(prod.payload);
  const diag = await invoke(model({ meta:{current_stage_echo:'build'} }), { nodeEnv:'test' }); assert.equal(diag.payload.status,'error');
});
test('V3 case 15 canonical blueprint_patch valid', async () => {
  const patch={narrative:{scene_development:'Changed'}};
  const { payload } = await invoke(model({ user_intent_label:'actionable_change', blueprint_patch:patch }));
  assert.equal(payload.status,'ok'); assert.deepEqual(payload.blueprint_patch,patch);
});
test('V3 case 16 legacy patch only never applied', async () => {
  const { payload } = await invoke(model({ user_intent_label:'actionable_change', patch:{narrative:{scene_development:'legacy'}} })); assertBlocked(payload);
});
test('V3 case 17 both patch names reject legacy without silent priority', async () => {
  const { payload } = await invoke(model({ user_intent_label:'actionable_change', patch:{narrative:{scene_development:'legacy'}}, blueprint_patch:{narrative:{scene_development:'canonical'}} }));
  assertBlocked(payload);
});


// Cases 18-54: intent dependency and option-selection normalization at the Proxy boundary.
const validPatch = () => ({ narrative:{ scene_development:'Changed by V2' } });
const validQuestion = () => ({ id:'q1', text:'Что важнее?', target_anchor:'conflict' });
const validOption = (id='opt_x', mode='blocking') => ({ id, label:`Option ${id}`, target_anchor:'structure', mode });

test('V3 case 18 actionable_change valid patch -> ok', async()=>{const {payload}=await invoke(model({user_intent_label:'actionable_change',blueprint_patch:validPatch()}));assert.equal(payload.status,'ok');assert.deepEqual(payload.blueprint_patch,validPatch());});
test('V3 case 19 actionable_change missing patch -> blocked', async()=>{const {payload}=await invoke(model({user_intent_label:'actionable_change'}));assertBlocked(payload);});
test('V3 case 20 actionable_change invalid patch -> blocked', async()=>{const {payload}=await invoke(model({user_intent_label:'actionable_change',blueprint_patch:{scene_core:{seed_scene:'forbidden'}}}));assertBlocked(payload);});
test('V3 case 21 actionable valid patch + malformed unrelated options -> patch survives', async()=>{const {payload}=await invoke(model({user_intent_label:'actionable_change',blueprint_patch:validPatch(),options:{bad:true}}));assert.equal(payload.status,'ok');assert.deepEqual(payload.blueprint_patch,validPatch());assert.deepEqual(payload.output.options,[]);});
test('V3 case 22 actionable_change never grants readiness authority', async()=>{const {payload}=await invoke(model({user_intent_label:'actionable_change',blueprint_patch:validPatch()}));assert.equal(payload.status,'ok');assert.equal('ready_for_final_assembly' in payload.output,false);assert.equal('route' in payload.output,false);});
test('V3 case 23 asks_question valid core -> ok', async()=>{const q=validQuestion();const {payload}=await invoke(model({user_intent_label:'asks_question',questions:[q]}));assert.equal(payload.status,'ok');assert.deepEqual(payload.output.questions,[q]);});
test('V3 case 24 asks_question missing or invalid question -> blocked', async()=>{for(const questions of [[],[{id:'q',text:'x'}]]){const {payload}=await invoke(model({user_intent_label:'asks_question',questions}));assertBlocked(payload);}});
test('V3 case 25 asks_question valid question + invalid unrelated patch -> question survives', async()=>{const q=validQuestion();const {payload}=await invoke(model({user_intent_label:'asks_question',questions:[q],blueprint_patch:{scene_core:{seed_scene:'bad'}}}));assert.equal(payload.status,'ok');assert.deepEqual(payload.output.questions,[q]);assert.equal(payload.blueprint_patch,null);});
test('V3 case 26 asks_question forbidden authority -> blocked', async()=>{const {payload}=await invoke(model({user_intent_label:'asks_question',questions:[validQuestion()],nested:{route:'alignment'}}));assertBlocked(payload);});
test('V3 case 27 wants_more_options blocking option -> valid public option', async()=>{const o=validOption('b','blocking');const {payload}=await invoke(model({user_intent_label:'wants_more_options',options:[o]}));assert.equal(payload.status,'ok');assert.deepEqual(payload.output.options,[o]);});
test('V3 case 28 wants_more_options suggestive option -> valid public option', async()=>{const o=validOption('s','suggestive');const {payload}=await invoke(model({user_intent_label:'wants_more_options',options:[o]}));assert.equal(payload.status,'ok');assert.equal(payload.output.options[0].mode,'suggestive');});
test('V3 case 29 wants_more_options mixed modes survive normalization', async()=>{const opts=[validOption('b','blocking'),validOption('s','suggestive')];const {payload}=await invoke(model({user_intent_label:'wants_more_options',options:opts}));assert.equal(payload.status,'ok');assert.deepEqual(payload.output.options,opts);});
test('V3 case 30 wants_more_options invalid options -> blocked', async()=>{const {payload}=await invoke(model({user_intent_label:'wants_more_options',options:[{id:'x',label:'x',target_anchor:'bad',mode:'blocking'}]}));assertBlocked(payload);});
test('V3 case 31 wants_more_options valid options + invalid unrelated patch -> options survive', async()=>{const o=validOption();const {payload}=await invoke(model({user_intent_label:'wants_more_options',options:[o],blueprint_patch:{scene_core:{seed_scene:'bad'}}}));assert.equal(payload.status,'ok');assert.deepEqual(payload.output.options,[o]);assert.equal(payload.blueprint_patch,null);});
test('V3 case 32 ready_to_continue clean -> ok neutral sidecars', async()=>{const {payload}=await invoke(model({user_intent_label:'ready_to_continue'}));assert.equal(payload.status,'ok');assert.equal(payload.output.user_intent_label,'ready_to_continue');assert.equal(payload.blueprint_patch,null);assert.deepEqual(payload.output.questions,[]);assert.deepEqual(payload.output.options,[]);});
test('V3 case 33 ready_to_continue does not clear trusted Blueprint blockers at Proxy', async()=>{const {payload}=await invoke(model({user_intent_label:'ready_to_continue'}),{bp:blueprint()});assert.equal(payload.status,'ok');assert.equal(payload.meta.current_stage_echo,'refinement');assert.equal('next_stage' in payload,false);});
test('V3 case 34 ready_to_continue invalid patch sidecar -> blocked', async()=>{const {payload}=await invoke(model({user_intent_label:'ready_to_continue',blueprint_patch:{scene_core:{seed_scene:'bad'}}}));assertBlocked(payload);});
test('V3 case 35 ready_to_continue non-empty questions or options -> blocked', async()=>{for(const extra of [{questions:[validQuestion()]},{options:[validOption()]}]){const {payload}=await invoke(model({user_intent_label:'ready_to_continue',...extra}));assertBlocked(payload);}});
test('V3 case 36 ready_to_continue forbidden authority -> blocked', async()=>{const {payload}=await invoke(model({user_intent_label:'ready_to_continue',nested:{route:'alignment'}}));assertBlocked(payload);});
test('V3 case 37 blocked ready envelope contains no transition carrier', async()=>{const {payload}=await invoke(model({user_intent_label:'ready_to_continue',options:[validOption()]}));assertBlocked(payload);assert.equal('next_stage' in payload,false);});
test('V3 case 38 hold_or_not_ready clean -> ok without mutation', async()=>{const {payload}=await invoke(model({user_intent_label:'hold_or_not_ready'}));assert.equal(payload.status,'ok');assert.equal(payload.output.user_intent_label,'hold_or_not_ready');assert.equal(payload.blueprint_patch,null);});
test('V3 case 39 hold_or_not_ready invalid patch is dropped', async()=>{const {payload}=await invoke(model({user_intent_label:'hold_or_not_ready',blueprint_patch:{scene_core:{seed_scene:'bad'}}}));assert.equal(payload.status,'ok');assert.equal(payload.blueprint_patch,null);});
test('V3 case 40 hold_or_not_ready malformed question/options are dropped', async()=>{const {payload}=await invoke(model({user_intent_label:'hold_or_not_ready',questions:{bad:true},options:{bad:true}}));assert.equal(payload.status,'ok');assert.deepEqual(payload.output.questions,[]);assert.deepEqual(payload.output.options,[]);});
test('V3 case 41 hold_or_not_ready forbidden authority -> blocked', async()=>{const {payload}=await invoke(model({user_intent_label:'hold_or_not_ready',billing:{allow:true}}));assertBlocked(payload);});
test('V3 case 42 structured option valid trusted ID + patch -> selected ID public', async()=>{const {payload}=await invoke(model({user_intent_label:'option_selection',blueprint_patch:validPatch()}),{userInput:{type:'option_selection',id:'opt_1'}});assert.equal(payload.status,'ok');assert.equal(payload.output.selected_option_id,'opt_1');assert.deepEqual(payload.blueprint_patch,validPatch());});
test('V3 case 43 structured unknown option ID -> blocked', async()=>{const {payload}=await invoke(model({user_intent_label:'option_selection',blueprint_patch:validPatch()}),{userInput:{type:'option_selection',id:'unknown'}});assertBlocked(payload);});
test('V3 case 44 structured trusted option ID + missing invalid patch -> blocked', async()=>{for(const patch of [undefined,{scene_core:{seed_scene:'bad'}}]){const m=model({user_intent_label:'option_selection'});if(patch!==undefined)m.blueprint_patch=patch;const {payload}=await invoke(m,{userInput:{type:'option_selection',id:'opt_1'}});assertBlocked(payload);}});
test('V3 case 45 typed option_selection matching provider ID + patch -> selected ID public', async()=>{const {payload}=await invoke(model({user_intent_label:'option_selection',selected_option_id:'opt_2',blueprint_patch:validPatch()}),{userInput:{raw_text:'берём второй'}});assert.equal(payload.status,'ok');assert.equal(payload.output.selected_option_id,'opt_2');});
test('V3 case 46 typed option_selection missing or unknown provider ID -> blocked', async()=>{for(const id of [undefined,'unknown']){const m=model({user_intent_label:'option_selection',blueprint_patch:validPatch()});if(id!==undefined)m.selected_option_id=id;const {payload}=await invoke(m,{userInput:{raw_text:'выбор'}});assertBlocked(payload);}});
test('V3 case 47 typed trusted ID + invalid patch -> blocked', async()=>{const {payload}=await invoke(model({user_intent_label:'option_selection',selected_option_id:'opt_2',blueprint_patch:{scene_core:{seed_scene:'bad'}}}),{userInput:{raw_text:'берём второй'}});assertBlocked(payload);});
test('V3 case 48 option_selection public result carries no route', async()=>{const {payload}=await invoke(model({user_intent_label:'option_selection',blueprint_patch:validPatch()}),{userInput:{type:'option_selection',id:'opt_1'}});assert.equal(payload.status,'ok');assert.equal('route' in payload,false);assert.equal('next_stage' in payload,false);});
test('V3 case 49 unclear_dissatisfaction keeps diagnostic intent without mutation', async()=>{const {payload}=await invoke(model({user_intent_label:'unclear_dissatisfaction',anchor_hint:'conflict',blueprint_patch:validPatch()}));assert.equal(payload.status,'ok');assert.equal(payload.output.user_intent_label,'unclear_dissatisfaction');assert.equal(payload.blueprint_patch,null);});
test('V3 case 50 unclear_dissatisfaction valid diagnostic blocking options survive', async()=>{const o=validOption('d','blocking');const {payload}=await invoke(model({user_intent_label:'unclear_dissatisfaction',anchor_hint:'conflict',options:[o]}));assert.equal(payload.status,'ok');assert.deepEqual(payload.output.options,[o]);});
test('V3 case 51 brief_or_context carries no direct route or mutation', async()=>{const {payload}=await invoke(model({user_intent_label:'brief_or_context',blueprint_patch:validPatch()}));assert.equal(payload.status,'ok');assert.equal(payload.blueprint_patch,null);assert.equal('next_stage' in payload,false);});
test('V3 case 52 alternative_request carries no direct route or mutation', async()=>{const {payload}=await invoke(model({user_intent_label:'alternative_request',blueprint_patch:validPatch()}));assert.equal(payload.status,'ok');assert.equal(payload.blueprint_patch,null);});
test('V3 case 53 new_cycle_request does not reset Blueprint through Proxy', async()=>{const {payload}=await invoke(model({user_intent_label:'new_cycle_request',blueprint_patch:validPatch()}));assert.equal(payload.status,'ok');assert.equal(payload.blueprint_patch,null);});
test('V3 case 54 off_topic_or_unclear returns intent only and no mutation', async()=>{const {payload}=await invoke(model({user_intent_label:'off_topic_or_unclear',blueprint_patch:validPatch()}));assert.equal(payload.status,'ok');assert.equal(payload.output.user_intent_label,'off_topic_or_unclear');assert.equal(payload.blueprint_patch,null);});

// Cases 55-58: forbidden authority.
test('V3 case 55 nested route key -> production blocked salvage', async () => {
  const { payload } = await invoke(model({ debug:{nested:{route:'alignment'}} })); assertBlocked(payload);
});
test('V3 case 56 readiness/system/refinement authority -> production blocked salvage', async () => {
  for (const extra of [{system_state:{}},{nested:{refinement_state:{}}},{ready_for_final_assembly:true}]) {
    const { payload } = await invoke(model(extra)); assertBlocked(payload);
  }
});
test('V3 case 57 Build Billing final_result Result Schema authority -> blocked', async () => {
  for (const extra of [{build_now:true},{billing:{}},{final_result:{}},{result_schema:{}}]) {
    const { payload } = await invoke(model(extra)); assertBlocked(payload);
  }
});
test('V3 case 58 dev/test forbidden authority -> hard diagnostic failure', async () => {
  const { payload } = await invoke(model({ nested:{route:'alignment'} }), { nodeEnv:'test' }); assert.equal(payload.status,'error');
});

// Cases 59-67: exact public fixtures.
test('V3 case 59 full ok fixture exact keys/types', async () => {
  const { payload } = await invoke(model({ anchor_hint:'structure', user_intent_label:'actionable_change', blueprint_patch:{narrative:{scene_development:'Changed'}}, questions:[], options:[] }));
  exactTop(payload); assert.equal(payload.status,'ok'); assert.deepEqual(Object.keys(payload.output).sort(),['anchor_hint','message','options','questions','selected_option_id','user_intent_label']); assertTrustedMeta(payload);
});
test('V3 case 60 invalid intent blocked fixture exact', async () => { const { payload }=await invoke(model({user_intent_label:'invalid'})); assertBlocked(payload); });
test('V3 case 61 invalid patch blocked fixture exact', async () => { const { payload }=await invoke(model({user_intent_label:'actionable_change',blueprint_patch:{scene_core:{seed_scene:'evil'}}})); assertBlocked(payload); });
test('V3 case 62 failed question blocked fixture exact', async () => { const { payload }=await invoke(model({user_intent_label:'asks_question',questions:[]})); assertBlocked(payload); });
test('V3 case 63 failed options blocked fixture exact', async () => { const { payload }=await invoke(model({user_intent_label:'wants_more_options',options:[]})); assertBlocked(payload); });
test('V3 case 64 forbidden-authority blocked fixture exact', async () => { const { payload }=await invoke(model({nested:{route:'alignment'}})); assertBlocked(payload); });
test('V3 case 65 fatal error fixture exact', async () => {
  const { payload }=await invoke({user_intent_label:'brief_or_context'}); exactTop(payload); assert.equal(payload.status,'error'); assert.equal(payload.output,null); assert.equal(payload.blueprint_patch,null); assert.ok(payload.error && payload.error.code);
});
test('V3 case 66 ok anchor-null fixture exact', async () => { const { payload }=await invoke(model()); assert.equal(payload.status,'ok'); assert.equal(payload.output.anchor_hint,null); assert.equal(payload.output.selected_option_id,null); });
test('V3 case 67 ok question without reason fixture exact', async () => {
  const q={id:'q1',text:'Вопрос?',target_anchor:'structure'}; const {payload}=await invoke(model({user_intent_label:'asks_question',questions:[q]})); assert.equal(payload.status,'ok'); assert.deepEqual(payload.output.questions,[q]);
});
