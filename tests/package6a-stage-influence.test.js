const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const fx=require('./fixtures/package6-behavior');
const handlerPath=path.resolve(__dirname,'../api/script-v2.js');

function response(stage,lang='ru',bp=fx.blueprint()){
  if(stage==='scene_ideas') return fx.ideas(lang);
  if(stage==='development') return fx.development(lang);
  if(stage==='alignment') return fx.alignment(lang);
  if(stage==='refinement') return fx.refinement(lang,{meta:{current_stage_echo:'refinement',role_id_echo:bp.meta.scriptwriter_role,video_type_echo:bp.meta.video_type,language_echo:lang}});
  return fx.selection(lang);
}
async function capture(stage,bp=fx.blueprint(),lang='ru'){
  const oldKey=process.env.OPENAI_API_KEY,oldFetch=global.fetch;process.env.OPENAI_API_KEY='mock-only';let modelBody;
  global.fetch=async(_u,req)=>{modelBody=JSON.parse(req.body);return{ok:true,async json(){return{output_text:JSON.stringify(response(stage,lang,bp))}}};};
  delete require.cache[handlerPath];const handler=require(handlerPath);let payload,status;
  const res={setHeader(){},status(c){status=c;return this;},json(v){payload=v;return v;},end(){}};
  try{await handler({method:'POST',body:{stage,language:lang,blueprint:bp,user_input:{raw_text:'Same topic and same user input'},ui_context:{},meta:{}}},res);assert.equal(status,200);assert.equal(payload.status,'ok');return (modelBody.input||[]).flatMap(x=>x.content||[]).map(x=>x.text||'').join('\n');}
  finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;}
}
function bp(overrides={}){return fx.blueprint(overrides);}

const ROLE_EXPECT={creative_director:/concept|creative unity/i,commercial_strategist:/audience|conversion|value/i,cinematographer:/camera|composition|light/i,film_director:/staging|action|payoff/i};
test('all four roles materially change Scene Ideas on the same topic',async()=>{const values=[];for(const [id,re] of Object.entries(ROLE_EXPECT)){const t=await capture('scene_ideas',bp({meta:{scriptwriter_role:id}}));values.push(t);assert.match(t,re,id);}assert.equal(new Set(values).size,4);});

const TYPE_EXPECT={video:/usable video|scene progression/i,promo:/product|offer|CTA|conversion/i,interactive:/choice|consequence|interactive mechanics/i,video_prompt:/generation-ready|motion|camera/i,image_prompt:/single-frame|composition|iconic frame/i};
test('all five video types materially change the first three ideas',async()=>{const values=[];for(const [id,re] of Object.entries(TYPE_EXPECT)){const t=await capture('scene_ideas',bp({meta:{video_type:id}}));values.push(t);assert.match(t,re,id);}assert.equal(new Set(values).size,5);});

test('interactive and video_prompt influence Scene Ideas before Development',async()=>{
  const interactive=await capture('scene_ideas',bp({meta:{video_type:'interactive'}}));
  const prompt=await capture('scene_ideas',bp({meta:{video_type:'video_prompt'}}));
  assert.match(interactive,/choice|consequence|interactive mechanics/i);
  assert.match(prompt,/generation-ready|motion|camera/i);
  assert.notEqual(interactive,prompt);
});

test('representative goals, emotions and scene actions change Development directives',async()=>{
  const goals=[];for(const id of ['product_service','promotion_ad','education_explainer','story_narrative']) goals.push(await capture('development',bp({goal:{video_goal:id}})));
  const emotions=[];for(const id of ['epic','calm','energetic','dreamlike']) emotions.push(await capture('development',bp({visual_direction:{emotion:id}})));
  const actions=[];for(const id of ['reveal','journey','choice','system_awakening']) actions.push(await capture('development',bp({scene_core:{scene_action:id}})));
  assert.equal(new Set(goals).size,4);assert.equal(new Set(emotions).size,4);assert.equal(new Set(actions).size,4);
  for(const [text,id] of [...goals.map((v,i)=>[v,['product_service','promotion_ad','education_explainer','story_narrative'][i]]),...emotions.map((v,i)=>[v,['epic','calm','energetic','dreamlike'][i]]),...actions.map((v,i)=>[v,['reveal','journey','choice','system_awakening'][i]])]) assert.match(text,new RegExp(id));
});

test('branching has early module-specific influence on Scene Ideas',async()=>{
  const base=await capture('scene_ideas',bp({extensions:{}}));
  const branching=await capture('scene_ideas',bp({extensions:{branching:{enabled:true}}}));
  assert.notEqual(base,branching);
  assert.match(branching,/branching|choice|consequence/i);
});

test('branching remains available before Build in Development and open-anchor Refinement',async()=>{
  const b=bp({extensions:{branching:{enabled:true}},system_state:{refinement_state:{active_anchor:'structure',open_anchor:true,pending_options:false,open_question:false}}});
  assert.match(await capture('development',b),/branching|choice|consequence/i);
  assert.match(await capture('refinement',b),/branching|choice|consequence/i);
});

test('result-only/deferred timing and visual_style_extra do not invent early behavior directives',async()=>{
  const base=await capture('scene_ideas',bp({extensions:{}}));
  const deferred=await capture('scene_ideas',bp({extensions:{timing:{enabled:true},visual_style_extra:{enabled:true}}}));
  assert.equal(base,deferred);
  const devBase=await capture('development',bp({extensions:{}}));
  const devDeferred=await capture('development',bp({extensions:{timing:{enabled:true},visual_style_extra:{enabled:true}}}));
  assert.equal(devBase,devDeferred);
});

test('Refinement-bound module directives appear only inside an already open anchor',async()=>{
  const closed=bp({extensions:{dialogue:{enabled:true}},system_state:{refinement_state:{active_anchor:'conflict',open_anchor:false,pending_options:false,open_question:false}}});
  const opened=bp({extensions:{dialogue:{enabled:true}},system_state:{refinement_state:{active_anchor:'conflict',open_anchor:true,pending_options:false,open_question:false}}});
  const closedText=await capture('refinement',closed);
  const openText=await capture('refinement',opened);
  assert.doesNotMatch(closedText,/dialogue rhythm|spoken exchange/i);
  assert.match(openText,/dialogue|spoken exchange/i);
});

test('selected Advanced module never grants route, readiness or Build authority in prompts',async()=>{
  const text=await capture('refinement',bp({extensions:{characters:{enabled:true},cta_strategy:{enabled:true}},system_state:{refinement_state:{active_anchor:'hero_focus',open_anchor:true}}}));
  assert.match(text,/Never return route|Никогда не возвращай route/i);
  assert.match(text,/Build authority/i);
  assert.doesNotMatch(text,/"ready_for_final_assembly":true|"build_allowed":true/);
});

test('video_prompt type and same-named extension do not collide',async()=>{
  const typeOnly=await capture('scene_ideas',bp({meta:{video_type:'video_prompt'},extensions:{}}));
  const extensionOnly=await capture('scene_ideas',bp({meta:{video_type:'video'},extensions:{video_prompt:{enabled:true}}}));
  const both=await capture('scene_ideas',bp({meta:{video_type:'video_prompt'},extensions:{video_prompt:{enabled:true}}}));
  assert.match(typeOnly,/generation-ready|motion|camera/i);
  assert.notEqual(typeOnly,extensionOnly);
  assert.notEqual(both,typeOnly);
});
