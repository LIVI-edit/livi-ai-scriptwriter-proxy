const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const handlerPath = path.resolve(__dirname, '../api/script-v2.js');

function bp(language='ru') { return { meta:{video_type:'video',scriptwriter_role:'creative_director',language}, goal:{video_topic:'Topic',video_goal:'story_narrative'}, scene_core:{seed_scene:'Seed',scene_action:'reveal'}, narrative:{scene_setup:'Setup',scene_development:'Development'}, visual_direction:{emotion:'calm'}, extensions:{}, system_state:{current_stage:'refinement'} }; }
async function capture(operation, language='ru') {
  const oldKey=process.env.OPENAI_API_KEY, oldFetch=global.fetch; process.env.OPENAI_API_KEY='mock-only'; let requestBody;
  global.fetch=async(_u,req)=>{requestBody=JSON.parse(req.body);return{ok:true,async json(){return{output_text:JSON.stringify(operation==='chat'?{message:language==='en'?'Usable message.':'Рабочий ответ.'}:{message:language==='en'?'Applied.':'Зафиксировал.',proposal:{}})}}};};
  delete require.cache[handlerPath]; const handler=require(handlerPath); let payload; const res={setHeader(){},status(){return this;},json(v){payload=v;return v;},end(){}};
  try { await handler({method:'POST',body:{stage:'refinement',language,blueprint:bp(language),user_input:operation==='chat'?'mixed input':null,ui_context:{},meta:{refinement_operation:operation,refinement_conversation:[]}}},res); return {requestBody,payload}; }
  finally { global.fetch=oldFetch; if(oldKey===undefined)delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY=oldKey; }
}
function promptText(requestBody){ return JSON.stringify(requestBody?.input || []); }

test('CHAT prompt retires V2 intent/anchor/readiness machine contract', async()=>{
  const {requestBody,payload}=await capture('chat','ru'); const text=promptText(requestBody);
  assert.equal(payload.status,'ok');
  assert.match(text,/Refinement CHAT/i);
  assert.match(text,/read-only|read only/i);
  assert.match(text,/не возвращай user_intent_label|do not return user_intent_label/i);
  assert.doesNotMatch(text,/Canonical user_intent_label exact strings|brief_or_context \| option_selection \| actionable_change/);
  assert.doesNotMatch(text,/active_anchor|open_anchor|pending_options|selected_option_id matching exactly one trusted/i);
});

test('APPLY prompt is consolidation-only and four-key proposal contract', async()=>{
  const {requestBody,payload}=await capture('apply','en'); const text=promptText(requestBody);
  assert.equal(payload.status,'ok');
  assert.match(text,/Refinement APPLY/i);
  for (const key of ['main_focus','scene_setup','scene_development','emotion']) assert.match(text,new RegExp(key));
  assert.match(text,/empty proposal is valid/i);
  assert.doesNotMatch(text,/user_intent_label whitelist|active_anchor|pending_options|selected_option_id/);
});
