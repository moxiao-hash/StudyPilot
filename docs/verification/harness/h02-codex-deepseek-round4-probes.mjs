import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {loadMetadata,validateMetadata} from '/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/scripts/harness/capability-semantics.mjs';
const ds='/Users/moxiao/IdeaProjects/project-harness-h02-deepseek',mini='/Users/moxiao/IdeaProjects/project-harness-h02-minimax';
const fixture=JSON.parse(readFileSync(ds+'/agent-service/tests/fixtures/capability-semantics.json'));
const doc=loadMetadata(ds+'/contracts/agent-capabilities/metadata.yaml');
const bytes=readFileSync(mini+'/contracts/agent-capabilities/generated/descriptors.json');const descriptors=JSON.parse(bytes);const result=[];
const sha=x=>createHash('sha256').update(x).digest('hex');const canonical=x=>Array.isArray(x)?x.map(canonical):(x&&typeof x==='object')?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
function assert(name,ok,details){result.push({name,pass:!!ok,details});}
const provenance=fixture.frozenFacts.descriptorProvenance;assert('current descriptor hash',provenance.artifactSha256===sha(bytes));assert('schema hash',provenance.manifestSchemaSha256===sha(readFileSync(mini+'/contracts/agent-capabilities/manifest.schema.json')));
assert('declared source commit artifact hash',sha(execFileSync('git',['show',provenance.sourceCommit+':contracts/agent-capabilities/generated/descriptors.json'],{cwd:mini}))===provenance.artifactSha256);
const known=new Set(['type','properties','required','additionalProperties','items','description']);
function check(s,v,path='$'){
 for(const k of Object.keys(s)){if(!known.has(k))throw Error('unimplemented keyword '+path+'.'+k);}
 const type=v===null?'null':Array.isArray(v)?'array':typeof v==='number'&&Number.isInteger(v)?'integer':typeof v;
 const allowed=Array.isArray(s.type)?s.type:[s.type];if(s.type&&!allowed.includes(type)&&!(type==='integer'&&allowed.includes('number')))throw Error(path+' invalid type '+type);
 if(v===null)return;
 if(Array.isArray(v)){if(s.items)v.forEach((x,i)=>check(s.items,x,path+'/'+i));return;}
 if(typeof v==='object'){
 for(const k of s.required||[]){if(!Object.hasOwn(v,k))throw Error(path+' missing '+k);}
 for(const [k,x]of Object.entries(v)){if(s.additionalProperties===false&&!Object.hasOwn(s.properties||{},k))throw Error(path+' unknown '+k);if(s.properties?.[k])check(s.properties[k],x,path+'/'+k);}
 }
}
let inputs=0,outputs=0,deliberateRejections=0;const errs=[];
for(const d of descriptors){assert('frozen schema '+d.name,equal(fixture.frozenFacts.toolSchemas[d.name],{inputSchema:d.inputSchema,outputSchema:d.outputSchema}));const m=doc.tools.find(t=>t.name===d.name);for(const e of m.examples){try{if(e.outcome==='rejected'){deliberateRejections++;}else{check(d.inputSchema,e.input);inputs++;}if(e.outcome==='ok'){check(d.outputSchema,e.output);outputs++;}}catch(err){errs.push({tool:d.name,example:e.name,error:err.message});}}}
assert('independent actual-schema instances',errs.length===0,{inputs,outputs,deliberateRejections,errors:errs});assert('no placeholder positive fixtures',doc.tools.every(t=>t.examples.every(e=>e.fixture_kind!=='shape_placeholder'&&!JSON.stringify(e).includes('<shape-placeholder>'))));
function corruptNumeric(doc){function walk(s,v){if(!v||typeof v!=='object')return false;if(Array.isArray(v)){for(const x of v)if(walk(s.items||{},x))return true;}else{for(const [k,child]of Object.entries(s.properties||{})){if(['integer','number'].includes(child.type)&&Object.hasOwn(v,k)){v[k]='wrong';return true;}if(walk(child,v[k]))return true;}}return false;}for(const t of doc.tools){const ex=t.examples.find(e=>e.outcome==='ok'&&e.output!==null);const ds=descriptors.find(x=>x.name===t.name);if(ex&&walk(ds.outputSchema,ex.output))return;}throw Error('No numeric output fixture found');}
const cases=[['baseline',false,()=>{}],['nested numeric type',true,d=>corruptNumeric(d)],['top-level output type',true,d=>{d.tools.find(t=>t.name==='learning.context.get').examples.find(e=>e.outcome==='ok').output=42;}],['required output property',true,d=>{const t=d.tools.find(t=>t.name==='learning.context.get'),s=fixture.frozenFacts.toolSchemas[t.name].outputSchema;delete t.examples.find(e=>e.outcome==='ok').output[s.required[0]];}],['unknown output property',true,d=>{d.tools.find(t=>t.name==='learning.context.get').examples.find(e=>e.outcome==='ok').output.unknown=42;}],['missing nullable output',true,d=>{for(const e of d.tools.find(t=>t.name==='roadmap.current.get').examples)delete e.output;}],['placeholder output',true,d=>{d.tools.find(t=>t.name==='learning.context.get').examples.find(e=>e.outcome==='ok').output={};}]];
for(const [name,reject,change]of cases){const d=structuredClone(doc);change(d);let accepted=true,error;try{validateMetadata(d,fixture,fixture.frozenFacts.tools);}catch(e){accepted=false;error=e.message;}assert('metadata mutation '+name,accepted!==reject,{expected:reject?'reject':'accept',actual:accepted?'accept':'reject',error});}
writeFileSync('docs/verification/harness/h02-codex-deepseek-round4-probes.json',JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:ds,encoding:'utf8'}).trim(),result},null,2)+'\n');console.log(JSON.stringify({checks:result.length,passed:result.filter(r=>r.pass).length,failures:result.filter(r=>!r.pass),inputs,outputs,deliberateRejections},null,2));
