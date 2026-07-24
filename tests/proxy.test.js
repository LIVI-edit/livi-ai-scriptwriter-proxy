const test=require("node:test");const assert=require("node:assert/strict");
const path=require("node:path");
const handlerPath=path.resolve(__dirname,"../api/script-v2.js");
function validModel(overrides={}){return {message:"Обновил рабочую основу сцены.",user_intent_label:"actionable_change",anchor_hint:"conflict",questions:[],options:[],patch:{narrative:{scene_development:"Новый конфликт"}},meta:{current_stage_echo:"refinement",role_id_echo:"creative_director",video_type_echo:"video",language_echo:"ru"},...overrides};}
async function invoke(model,fetchOptions={}){
  const oldKey=process.env.OPENAI_API_KEY;process.env.OPENAI_API_KEY="fixture-key";
  const oldFetch=global.fetch;global.fetch=async()=>({ok:fetchOptions.ok!==false,async text(){return fetchOptions.text||"model failure";},async json(){return {output_text:JSON.stringify(model)}}});
  delete require.cache[handlerPath];const handler=require(handlerPath);
  const req={method:"POST",body:{stage:"refinement",language:"ru",blueprint:{meta:{scriptwriter_role:"creative_director",video_type:"video"},system_state:{current_stage:"refinement"}},user_input:{raw_text:"fixture"}}};
  let statusCode=0,payload=null;const headers={};const res={setHeader(k,v){headers[k]=v;},status(code){statusCode=code;return this;},json(v){payload=v;return v;},end(){return null;}};
  try{await handler(req,res);return {statusCode,payload,headers};}finally{global.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;}
}

test("valid refinement response normalization",async()=>{const r=await invoke(validModel());assert.equal(r.statusCode,200);assert.equal(r.payload.status,"ok");assert.equal(r.payload.output.user_intent_label,"actionable_change");assert.equal(r.payload.meta.role_id_echo,"creative_director");});
test("exact question schema accepted",async()=>{const q={id:"q1",text:"Что важнее?",target_anchor:"conflict",reason:"Уточнение"};const r=await invoke(validModel({user_intent_label:"asks_question",questions:[q],patch:{}}));assert.deepEqual(r.payload.output.questions,[q]);});
test("exact option schema accepted",async()=>{const o={id:"o1",label:"Сильнее",description:"Добавить риск",target_anchor:"conflict",effect:"Напряжение",mode:"blocking",recommended:true};const r=await invoke(validModel({user_intent_label:"wants_more_options",options:[o],patch:{}}));assert.deepEqual(r.payload.output.options,[o]);});
for(const [name,mutate] of [
 ["option.value rejection",m=>{m.options=[{id:"o",label:"x",target_anchor:"conflict",mode:"blocking",value:"x"}]}],
 ["unknown label rejection",m=>{m.user_intent_label="unknown"}],
 ["two questions rejection",m=>{const q={id:"q",text:"x",target_anchor:"conflict",reason:"x"};m.questions=[q,{...q,id:"q2"}]}],
 ["missing target anchor rejection",m=>{m.questions=[{id:"q",text:"x",reason:"x"}]}],
 ["forbidden nested key rejection",m=>{m.options=[{id:"o",label:"x",target_anchor:"conflict",mode:"blocking",description:{nested:{route:"alignment"}}}]}],
 ["patch-policy violation rejection",m=>{m.patch={scene_core:{seed_scene:"forbidden"}}}],
 ["echo mismatch rejection",m=>{m.meta.role_id_echo="commercial_strategist"}],
]) test(name,async()=>{const m=validModel();mutate(m);const r=await invoke(m);assert.equal(r.payload.status,"error");assert.equal(r.payload.error.code,"REFINEMENT_RESPONSE_INVALID");});
test("controlled error envelope has no secret or stack leakage",async()=>{const r=await invoke(validModel(),{ok:false,text:"SECRET_TOKEN stack at internal/path"});const body=JSON.stringify(r.payload);assert.equal(r.payload.status,"error");assert.doesNotMatch(body,/SECRET_TOKEN|internal\/path|stack/i);assert.match(r.payload.error.message,/failed validation/i);});
