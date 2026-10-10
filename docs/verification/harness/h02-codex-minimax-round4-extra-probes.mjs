import {compileCapabilities,parseYaml} from '/Users/moxiao/IdeaProjects/project-harness-h02-minimax/scripts/compile-agent-capabilities.mjs';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
const root='/Users/moxiao/IdeaProjects/project-harness-h02-minimax',temp=mkdtempSync(join(tmpdir(),'h02-mini-r3-'));const ds=JSON.parse(readFileSync(root+'/contracts/agent-capabilities/generated/descriptors.json'));const meta=parseYaml('/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/contracts/agent-capabilities/metadata.yaml');const results=[];
function test(name,mutate,expect='reject'){const d=structuredClone(ds),m=structuredClone(meta);mutate(d,m);const dp=join(temp,'d.json'),mp=join(temp,'m.json');writeFileSync(dp,JSON.stringify(d));writeFileSync(mp,JSON.stringify(m));let actual='accept',error;try{compileCapabilities({descriptorsPath:dp,metadataPath:mp,sourceRoot:root});}catch(e){actual='reject';error=e.message;}results.push({name,expect,actual,pass:expect===actual,error});}
const pair=(d,m)=>[d.find(t=>t.name==='governance.health.get'),m.tools.find(t=>t.name==='governance.health.get')];
test('latest typed baseline',()=>{},'accept');
test('not constraint',(d,m)=>{const[x,y]=pair(d,m);x.inputSchema.properties.n={type:'integer',not:{const:1}};y.examples[0].input.n=1;});
test('conditional then constraint',(d,m)=>{const[x,y]=pair(d,m);x.inputSchema.properties.n={type:'integer',if:{const:1},then:{minimum:2}};y.examples[0].input.n=1;});
test('false property schema',(d,m)=>{const[x,y]=pair(d,m);x.inputSchema.properties.n=false;y.examples[0].input.n=1;});
test('descriptor omission',(d,m)=>{d.splice(d.findIndex(t=>t.name==='governance.health.get'),1);m.tools.splice(m.tools.findIndex(t=>t.name==='governance.health.get'),1);});
writeFileSync('docs/verification/harness/h02-codex-minimax-round4-extra-probes.json',JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),results},null,2)+'\n');console.log(JSON.stringify(results));rmSync(temp,{recursive:true});
