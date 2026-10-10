import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import {join} from 'node:path';import {tmpdir} from 'node:os';
const mi='/Users/moxiao/IdeaProjects/project-harness-h02-minimax',zc='/Users/moxiao/IdeaProjects/project-harness-h02-zcode',ds='/Users/moxiao/IdeaProjects/project-harness-h02-deepseek';
const manifest=JSON.parse(readFileSync(mi+'/contracts/agent-capabilities/generated/manifest.json')),coverage=JSON.parse(readFileSync(zc+'/docs/verification/harness/h02-business-coverage.json')),dir=mkdtempSync(join(tmpdir(),'h02-z-final-')),results=[];
function check(name,mutate,expected='reject'){const m=structuredClone(manifest),c=structuredClone(coverage);mutate(m,c);const mp=join(dir,'manifest.json'),cp=join(dir,'coverage.json');writeFileSync(mp,JSON.stringify(m));writeFileSync(cp,JSON.stringify(c));const r=spawnSync('node',[zc+'/scripts/harness/capability-consumer-verify.mjs','--manifest',mp,'--coverage',cp,'--schema',mi+'/contracts/agent-capabilities/manifest.schema.json','--metadata',ds+'/contracts/agent-capabilities/metadata.yaml'],{cwd:zc,encoding:'utf8'});const actual=r.status===0?'accept':'reject';results.push({name,expected,actual,pass:actual===expected,exit:r.status,stderr:r.stderr.slice(-1000)});}
check('current baseline',()=>{},'accept');
check('omit one endpoint within retained controller',(_,c)=>{const x=c.backend_controller_audit.find(x=>x.endpoints.length>1);x.endpoints.pop();});
check('duplicate endpoint within controller',(_,c)=>c.backend_controller_audit[0].endpoints.push(c.backend_controller_audit[0].endpoints[0]));
check('real service method paired to wrong fact',(_,c)=>c.authoritative_facts_sources[0].javaService=c.authoritative_facts_sources[1].javaService);
check('real endpoint paired to wrong authoritative fact',(_,c)=>c.authoritative_facts_sources[0].endpoint='GET /api/mastery');
// Exercise normal explicit descriptor input alongside mismatched commit.
const m=structuredClone(manifest);m.sources.commit='da3bae15bbc74978b5cff82ef7b26f357bd50837';writeFileSync(join(dir,'manifest.json'),JSON.stringify(m));writeFileSync(join(dir,'coverage.json'),JSON.stringify(coverage));
const rr=spawnSync('node',[zc+'/scripts/harness/capability-consumer-verify.mjs','--manifest',join(dir,'manifest.json'),'--coverage',join(dir,'coverage.json'),'--schema',mi+'/contracts/agent-capabilities/manifest.schema.json','--metadata',ds+'/contracts/agent-capabilities/metadata.yaml','--descriptors',mi+'/contracts/agent-capabilities/generated/descriptors.json'],{cwd:zc,encoding:'utf8'});
results.push({name:'mismatched source commit with explicit current descriptors',expected:'reject',actual:rr.status===0?'accept':'reject',pass:rr.status!==0,exit:rr.status,stderr:rr.stderr.slice(-1000)});
writeFileSync('docs/verification/harness/h02-codex-zcode-round6-final-controls.json',JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:zc,encoding:'utf8'}).trim(),results},null,2)+'\n');console.log(JSON.stringify(results));rmSync(dir,{recursive:true});
