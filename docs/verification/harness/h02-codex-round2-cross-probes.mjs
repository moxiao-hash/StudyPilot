import {compileCapabilities,parseYaml} from '/Users/moxiao/IdeaProjects/project-harness-h02-minimax/scripts/compile-agent-capabilities.mjs';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
const mini='/Users/moxiao/IdeaProjects/project-harness-h02-minimax',ds='/Users/moxiao/IdeaProjects/project-harness-h02-deepseek',zc='/Users/moxiao/IdeaProjects/project-harness-h02-zcode',root='/Users/moxiao/IdeaProjects/project';
const temp=mkdtempSync(join(tmpdir(),'h02-codex-cross-'));const heads=Object.fromEntries([mini,ds,zc].map(p=>[p,execFileSync('git',['rev-parse','HEAD'],{cwd:p,encoding:'utf8'}).trim()]));
const descriptors=JSON.parse(readFileSync(mini+'/contracts/agent-capabilities/generated/descriptors.json'));
const metadata=parseYaml(ds+'/contracts/agent-capabilities/metadata.yaml');const manifest=JSON.parse(readFileSync(mini+'/contracts/agent-capabilities/generated/manifest.json'));const results=[];
function compiler(name,mutate,expected='reject'){const d=structuredClone(descriptors),m=structuredClone(metadata);mutate(d,m);const dp=join(temp,'d.json'),mp=join(temp,'m.json');writeFileSync(dp,JSON.stringify(d));writeFileSync(mp,JSON.stringify(m));let actual='accept',error;try{compileCapabilities({descriptorsPath:dp,metadataPath:mp});}catch(e){actual='reject';error=e.message;}results.push({lane:'minimax',name,expected,actual,pass:actual===expected,error});}
function pair(d,m){return [d.find(t=>t.name==='governance.health.get'),m.tools.find(t=>t.name==='governance.health.get')];}
compiler('valid-baseline',()=>{},'accept');
compiler('missing-exported-binding',(d,m)=>{let [x,y]=pair(d,m);delete x.handler;y.source_provenance.handler='UnregisteredClass.noSuchMethod';});
compiler('forged-binding-and-metadata-agree',(d,m)=>{let [x,y]=pair(d,m);x.handler='UnregisteredClass.noSuchMethod';y.source_provenance.handler=x.handler;});
compiler('enum-constraint-ignored',(d,m)=>{let [x,y]=pair(d,m);x.inputSchema.properties.level={type:'string',enum:['A']};y.examples[0].input.level='B';});
compiler('minimum-constraint-ignored',(d,m)=>{let [x,y]=pair(d,m);x.inputSchema.properties.limit={type:'integer',minimum:1};y.examples[0].input.limit=-10;});
compiler('placeholder-empty-required-output',(d,m)=>{const y=m.tools.find(t=>t.examples.some(e=>e.outcome==='ok'&&e.fixture_kind==='shape_placeholder'));y.examples.find(e=>e.outcome==='ok').output={};});
compiler('missing-cost-and-exposure',(d,m)=>{let [x,y]=pair(d,m);delete y.cost_hint;delete y.exposure;});
compiler('non-string-purpose-array',(d,m)=>{let [x,y]=pair(d,m);y.when_to_use=[42];});
compiler('unknown-nested-confirmation',(d,m)=>{let [x,y]=pair(d,m);y.confirmation.unrecognized=true;});
let prev=process.cwd();process.chdir(temp);compiler('missing-java-source-cwd',()=>{});process.chdir(prev);
function consumer(name,mutate,expected='reject'){const doc=structuredClone(manifest),coverage=JSON.parse(readFileSync(zc+'/docs/verification/harness/h02-business-coverage.json'));const overrides={schema:mini+'/contracts/agent-capabilities/manifest.schema.json',metadata:ds+'/contracts/agent-capabilities/metadata.yaml'};mutate(doc,coverage,overrides);const mp=join(temp,'manifest.json'),cp=join(temp,'coverage.json');writeFileSync(mp,JSON.stringify(doc));writeFileSync(cp,JSON.stringify(coverage));const r=spawnSync('node',[zc+'/scripts/harness/capability-consumer-verify.mjs','--manifest',mp,'--coverage',cp,'--schema',overrides.schema,'--metadata',overrides.metadata],{cwd:zc,encoding:'utf8'});const actual=r.status===0?'accept':'reject';results.push({lane:'zcode',name,expected,actual,pass:actual===expected,exit:r.status,summary:r.stdout.split('\n').find(s=>s.includes('All H02')||s.includes('FAILED'))});}
consumer('valid-baseline',()=>{},'accept');
consumer('missing-description',(d)=>{delete d.tools[0].description;});
consumer('unknown-tool-field',(d)=>{d.tools[0].unrecognized=42;});
consumer('invalid-output-instance',(d)=>{const t=d.tools.find(t=>t.examples.some(e=>e.outcome==='ok'));t.examples.find(e=>e.outcome==='ok').output=42;});
consumer('nested-owner-in-output',(d)=>{const t=d.tools.find(t=>t.examples.some(e=>e.outcome==='ok'));t.examples.find(e=>e.outcome==='ok').output={nested:{ownerId:'injected'}};});
consumer('arbitrary-fabricated-fact',(d)=>{d.tools[0].authoritative_facts.push({fact:'made_up_metric_893',meaning:'system truth'});});
consumer('fictional-handler',(d)=>{d.tools[0].source_provenance.handler='UnregisteredClass.noSuchMethod';});
consumer('schema-not-json',(d,c,o)=>{o.schema=join(temp,'bad-schema');writeFileSync(o.schema,'not-json');});
consumer('metadata-not-yaml',(d,c,o)=>{o.metadata=join(temp,'bad-meta');writeFileSync(o.metadata,'[ malformed');});
consumer('coverage-fictional-route',(d,c)=>{c.frontend_route_coverage[0].routeName='fictionalRoute';c.frontend_route_coverage[0].path='/not-registered';});
consumer('stale-source-hash',(d)=>{d.sources.metadata_hash='0'.repeat(64);});
consumer('missing-upstream',(d,c,o)=>{o.metadata=join(temp,'missing-metadata');});
writeFileSync(root+'/docs/verification/harness/h02-codex-round2-cross-probes.json',JSON.stringify({heads,results},null,2)+'\n');console.log(JSON.stringify(results));rmSync(temp,{recursive:true});
