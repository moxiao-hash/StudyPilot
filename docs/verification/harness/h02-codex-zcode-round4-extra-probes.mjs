import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import {join} from 'node:path';import {tmpdir} from 'node:os';
const mi='/Users/moxiao/IdeaProjects/project-harness-h02-minimax',zc='/Users/moxiao/IdeaProjects/project-harness-h02-zcode',ds='/Users/moxiao/IdeaProjects/project-harness-h02-deepseek';
const manifest=JSON.parse(readFileSync(mi+'/contracts/agent-capabilities/generated/manifest.json')),coverage=JSON.parse(readFileSync(zc+'/docs/verification/harness/h02-business-coverage.json')),dir=mkdtempSync(join(tmpdir(),'h02-z-final-')),results=[];
function check(name,mutate,expected='reject'){const m=structuredClone(manifest),c=structuredClone(coverage);mutate(m,c);const mp=join(dir,'manifest.json'),cp=join(dir,'coverage.json');writeFileSync(mp,JSON.stringify(m));writeFileSync(cp,JSON.stringify(c));const r=spawnSync('node',[zc+'/scripts/harness/capability-consumer-verify.mjs','--manifest',mp,'--coverage',cp,'--schema',mi+'/contracts/agent-capabilities/manifest.schema.json','--metadata',ds+'/contracts/agent-capabilities/metadata.yaml'],{cwd:zc,encoding:'utf8'});const actual=r.status===0?'accept':'reject';results.push({name,expected,actual,pass:actual===expected,exit:r.status,stderr:r.stderr.slice(-1000)});}
check('current cross-lane baseline',()=>{},'accept');
check('nonrepeating invented descriptor hash',m=>m.sources.descriptors_hash='0123456789abcdef'.repeat(4));
check('existing unrelated baseline commit',m=>m.sources.commit='16b37d34c882a17e7bc45c69c84411f28f52bff8');
check('missing all controller operations',(_,c)=>c.backend_controller_audit=[]);
check('invented controller endpoint',(_,c)=>c.backend_controller_audit[0].endpoints=['POST /api/imaginary-business-action']);
check('invented coverage authoritative service',(_,c)=>c.authoritative_facts_sources[0].javaService='ImaginaryService.makeUpProgress');
writeFileSync('docs/verification/harness/h02-codex-zcode-round4-extra-probes.json',JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{cwd:zc,encoding:'utf8'}).trim(),results},null,2)+'\n');console.log(JSON.stringify(results));rmSync(dir,{recursive:true});
