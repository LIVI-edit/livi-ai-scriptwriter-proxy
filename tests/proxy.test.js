const test=require("node:test");const assert=require("node:assert/strict");
const path=require("node:path");
const handlerPath=path.resolve(__dirname,"../api/script-v2.js");
function validModel(overrides={}){return {message:"Обновил рабочую основу сцены.",user_intent_label:"actionable_change",anchor_hint:"conflict",questions:[],options:[],blueprint_patch:{narrative:{scene_development:"Новый конфликт"}},...overrides};}
async function invoke(model,fetchOptions={}){
  const oldKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY="fixture-key";
  const oldFetch=global.fetch;global.fetch=async()=>({ok:fetchOptions.ok!==false,async text(){return fetchOptions.text||"model failure";},async json(){return {output_text:JSON.stringify(model)}}});
  delete require.cache[handlerPath];const handler=require(handlerPath);
  const req={method:"POST",body:{stage:"refinement",language:"ru",blueprint:{meta:{scriptwriter_role:"creative_director",video_type:"video"},system_state:{current_stage:"refinement"}},user_input:{raw_text:"fixture"}}};
  let statusCode=0,payload=null;const headers={};const res={setHeader(k,v){headers[k]=v;},status(code){statusCode=code;return this;},json(v){payload=v;return v;},end(){return null;}};
  try{await handler(req,res);return {statusCode,payload,headers};}finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;}
}

test("valid refinement response normalization",async()=>{const r=await invoke(validModel());assert.equal(r.statusCode,200);assert.equal(r.payload.status,"ok");assert.equal(r.payload.output.user_intent_label,"actionable_change");assert.equal(r.payload.meta.role_id_echo,"creative_director");});
test("exact question schema accepted",async()=>{const q={id:"q1",text:"Что важнее?",target_anchor:"conflict",reason:"Уточнение"};const r=await invoke(validModel({user_intent_label:"asks_question",questions:[q],blueprint_patch:undefined}));assert.deepEqual(r.payload.output.questions,[q]);});
test("exact option schema accepted",async()=>{const o={id:"o1",label:"Сильнее",description:"Добавить риск",target_anchor:"conflict",effect:"Напряжение",mode:"blocking",recommended:true};const r=await invoke(validModel({user_intent_label:"wants_more_options",options:[o],blueprint_patch:undefined}));assert.deepEqual(r.payload.output.options,[o]);});
for(const [name,mutate] of [
 ["option.value blocks required options",m=>{m.user_intent_label="wants_more_options";m.blueprint_patch=undefined;m.options=[{id:"o",label:"x",target_anchor:"conflict",mode:"blocking",value:"x"}]}],
 ["unknown label blocks machine payload",m=>{m.user_intent_label="unknown"}],
 ["two questions block asks_question",m=>{m.user_intent_label="asks_question";m.blueprint_patch=undefined;const q={id:"q",text:"x",target_anchor:"conflict"};m.questions=[q,{...q,id:"q2"}]}],
 ["missing target anchor blocks asks_question",m=>{m.user_intent_label="asks_question";m.blueprint_patch=undefined;m.questions=[{id:"q",text:"x"}]}],
 ["forbidden nested key quarantines machine payload",m=>{m.user_intent_label="wants_more_options";m.blueprint_patch=undefined;m.options=[{id:"o",label:"x",target_anchor:"conflict",mode:"blocking",description:{nested:{route:"alignment"}}}]}],
 ["patch-policy violation blocks actionable change",m=>{m.blueprint_patch={scene_core:{seed_scene:"forbidden"}}}],
]) test(name,async()=>{const m=validModel();mutate(m);const r=await invoke(m);assert.equal(r.payload.status,"blocked");assert.equal(r.payload.blueprint_patch,null);assert.equal(r.payload.output.user_intent_label,null);});
test("model meta is ignored and trusted public meta remains server-owned",async()=>{const m=validModel({meta:{current_stage_echo:"refinement",role_id_echo:"commercial_strategist",video_type_echo:"promo",language_echo:"en"}});const r=await invoke(m);assert.equal(r.payload.status,"ok");assert.equal(r.payload.meta.role_id_echo,"creative_director");assert.equal(r.payload.meta.video_type_echo,"video");assert.equal(r.payload.meta.language_echo,"ru");});
test("controlled error envelope has no secret or stack leakage",async()=>{const r=await invoke(validModel(),{ok:false,text:"SECRET_TOKEN stack at internal/path"});const body=JSON.stringify(r.payload);assert.equal(r.payload.status,"error");assert.doesNotMatch(body,/SECRET_TOKEN|internal\/path|stack/i);assert.equal(r.payload.error.code,"REFINEMENT_RESPONSE_FATAL");assert.match(r.payload.error.message,/unusable/i);});
