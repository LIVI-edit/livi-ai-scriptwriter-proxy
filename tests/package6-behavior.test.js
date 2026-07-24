const test=require("node:test");const assert=require("node:assert/strict");const fs=require("node:fs");const path=require("node:path");
const source=fs.readFileSync(path.resolve(__dirname,"../api/script-v2.js"),"utf8");
const required=[
 ["anti questionnaire",/do not behave like a questionnaire|не превращай ответ в анкету/i],
 ["known input guard",/do not repeat known inputs|не повторяй известные/i],
 ["no selection fallback",/Do not invent a question from missing fields|Не придумывай вопрос/i],
 ["role lens",/ROLE_LENSES/], ["type lens",/TYPE_LENSES/],
 ["refinement anchor context",/active_anchor:[\s\S]*pending_options:[\s\S]*question_context:/],
 ["alignment minimum three",/sentences\.length >= 3/],
 ["raw scene ideas logging removed",/SCENE IDEAS RAW/]
];
for(const [name,re] of required){test(name,()=>{if(name==="raw scene ideas logging removed")assert.doesNotMatch(source,re);else assert.match(source,re);});}
test("semantic fallback replacement functions are not active",()=>{assert.doesNotMatch(source,/return getRefinementFallbackMessage\(/);assert.doesNotMatch(source,/return getAlignmentFallbackMessage\(/);});
test("wrapper compatibility functions removed",()=>{assert.doesNotMatch(source,/extractSceneIdeasArray|coerceSceneIdeasModelRaw|parsed\.output\?\.ideas/);});
test("production does not import tests",()=>assert.doesNotMatch(source,/require\([^)]*tests|from\s+["'][^"']*tests/));
test("raw model logging absent from Scene Ideas path",()=>{const block=source.slice(source.indexOf("async function executeSceneIdeas"),source.indexOf("async function executeSelection"));assert.doesNotMatch(block,/raw_text|parsed_json|console\.log/);});
const crypto=require("node:crypto");
function extractNamedFunction(text,name){const marker=new RegExp(`function\\s+${name}\\s*\\(`);const match=marker.exec(text);assert.ok(match,`missing frozen Build function ${name}`);const start=match.index;let i=text.indexOf('{',start),depth=0,quote=null,escape=false,line=false,block=false;for(let j=i;j<text.length;j++){const c=text[j],n=text[j+1]||'';if(line){if(c==='\n')line=false;continue;}if(block){if(c==='*'&&n==='/'){block=false;j++;}continue;}if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue;}if(c==='/'&&n==='/'){line=true;j++;continue;}if(c==='/'&&n==='*'){block=true;j++;continue;}if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0)return text.slice(start,j+1);}throw new Error(`unclosed function ${name}`);}
const frozenBuildHashes={
 executeBuildSurface:'5147f2aeef91eedf092fcd205760eb55547c94faabc3f2058f99a41e907598fe',
 buildBuildInput:'9d8016748428e694112853d2639e3971cacb2b5130db9cbdd02c092afb4f7dfb',
 validateBuildResponse:'cdf5f1f112336c53741e5bebdd3b2d8e25fcfcf4a6f4acb635c1726da6dada10',
 assertExactBuildTopLevelContract:'1ac2d0581556a2972e812e65576bdb9b0bed275cffaeeb124e265b90c120390a',
 normalizeBuildResponse:'1b494c67794c8e6ead0999e2381efa7fb59ae2970a33b81fba76d2b1b674ebdf',
 validateBuildResultSchemaContext:'f1ea3bc6e08e806588e0d0605282d0a0b31ccdc86a622b41cde0d0b452cec5a8'
};
for(const [name,expected] of Object.entries(frozenBuildHashes))test(`Build source slice frozen: ${name}`,()=>{const actual=crypto.createHash('sha256').update(extractNamedFunction(source,name)).digest('hex');assert.equal(actual,expected);});
