import {readFileSync,writeFileSync} from 'node:fs';
import {loadMetadata,validateMetadata} from '/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/scripts/harness/capability-semantics.mjs';
import {collectCapabilityFacts} from '/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/scripts/harness/capability-semantics-extract.mjs';
const root='/Users/moxiao/IdeaProjects/project-harness-h02-deepseek';
const fixture=JSON.parse(readFileSync(root+'/agent-service/tests/fixtures/capability-semantics.json','utf8'));
const doc=loadMetadata();const tools=fixture.frozenFacts.tools;
const cases=[
 ['valid metadata',false,()=>{}],
 ['missing registered tool',true,d=>d.tools.pop()],
 ['duplicate wire',true,d=>d.tools.push(structuredClone(d.tools[0]))],
 ['nonexistent method on existing class',true,d=>d.tools[0].source_provenance.handler='AgentGovernanceService.thisMethodDoesNotExist'],
 ['wrong existing execution class',true,d=>d.tools[0].source_provenance.handler='RoadmapScheduleService.getOrCreate'],
 ['navigation invalid route example',true,d=>d.tools.find(t=>t.name==='navigation.resolve').examples[0].input.routeKey='NOT_A_ROUTE'],
 ['navigation nested owner injection',true,d=>d.tools.find(t=>t.name==='navigation.resolve').examples[0].input.params={ownerId:'forged'}],
 ['illegal output example',true,d=>d.tools[0].examples[0].output={unexpected:'not_schema'}],
 ['missing expected example result',true,d=>{for(const t of d.tools) for(const e of t.examples) delete e.expect;}],
];
const results=cases.map(([name,expectReject,change])=>{const d=structuredClone(doc);change(d);try{validateMetadata(d,fixture,tools);return {name,expectReject,accepted:true,pass:!expectReject};}catch(e){return {name,expectReject,accepted:false,code:e.code,error:e.message,pass:expectReject};}});
writeFileSync('docs/verification/harness/h02-codex-deepseek-probes.json',JSON.stringify({head:'f9d481978fbff9ae19364e3220b65c1332770887',results},null,2)+'\n');
console.log(JSON.stringify(results,null,2));
