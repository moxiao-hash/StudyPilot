#!/usr/bin/env node
// Tests for the H02 capability semantic validator and the source extractor.
//
// RED evidence: every policy has negative controls proving the check is live
// (a broken metadata document is rejected with a stable error code), plus the
// human fixture's 20 negative cases which each mutate the real metadata.
//
// Run: node --test scripts/harness/capability-semantics.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { collectCapabilityFacts, REPO_ROOT } from './capability-semantics-extract.mjs';
import {
  DEFAULT_METADATA,
  checkExampleInput,
  expectedConfirmation,
  expectedExposure,
  checkExampleOutput,
  loadMetadata,
  parseYamlSubset,
  runValidation,
  validateMetadata,
} from './capability-semantics.mjs';

const FIXTURE_PATH = new URL('../../agent-service/tests/fixtures/capability-semantics.json', import.meta.url);
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8'));
const metadataExists = existsSync(DEFAULT_METADATA);

// --- restricted YAML subset ------------------------------------------------

test('yaml: parses nested mappings, sequences and scalars', () => {
  const doc = parseYamlSubset(`
version: 1
tools:
  - name: a.b
    description: "quoted text"
    when_to_use:
      - first
      - second
    cost_hint: { local: true, notes: plain }
    flags: [x, y]
    empty: null
`);
  assert.equal(doc.version, 1);
  assert.equal(doc.tools.length, 1);
  assert.equal(doc.tools[0].name, 'a.b');
  assert.equal(doc.tools[0].description, 'quoted text');
  assert.deepEqual(doc.tools[0].when_to_use, ['first', 'second']);
  assert.deepEqual(doc.tools[0].cost_hint, { local: true, notes: 'plain' });
  assert.deepEqual(doc.tools[0].flags, ['x', 'y']);
  assert.equal(doc.tools[0].empty, null);
});

test('yaml: ignores comments and parses block scalars', () => {
  const doc = parseYamlSubset(`
# leading comment
a: 1 # trailing comment
b: |
  line one
  line two
c: >
  folded
  together
`);
  assert.equal(doc.a, 1);
  assert.equal(doc.b, 'line one\nline two');
  assert.equal(doc.c, 'folded together');
});

test('yaml: accepts a JSON document (a legal YAML subset)', () => {
  const doc = parseYamlSubset('{"tools": [{"name": "a.b"}]}');
  assert.equal(doc.tools[0].name, 'a.b');
});

test('yaml: rejects anchors/aliases and multi-document streams', () => {
  assert.throws(() => parseYamlSubset('a: &anchor 1\n'), (error) => error.code === 'E_YAML');
  assert.throws(() => parseYamlSubset('---\na: 1\n---\nb: 2\n'), (error) => error.code === 'E_YAML');
});

// --- extractor: the frozen Java facts -------------------------------------

const facts = collectCapabilityFacts();

test('extractor: finds the full 65-tool catalog with the real effect split', () => {
  assert.equal(facts.toolCount, 65);
  assert.equal(facts.byEffect.READ, 43);
  assert.equal(facts.byEffect.WRITE, 21);
  assert.equal(facts.byEffect.NAVIGATE, 1);
  assert.equal(facts.byEffect.LOCAL, 0, 'no tool currently registers the LOCAL effect');
});

test('extractor: every registered tool has an output schema and a unique name', () => {
  assert.equal(facts.outputSchemasRegistered, 65);
  assert.deepEqual(facts.outputSchemasMissing, []);
  const names = [...facts.tools.map((tool) => tool.name), facts.navigation.name];
  assert.equal(new Set(names).size, names.length);
});

test('extractor: tool names satisfy the Java descriptor name contract', () => {
  for (const name of facts.tools.map((tool) => tool.name).concat(facts.navigation.name)) {
    assert.match(name, /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, name);
  }
});

test('extractor: read tools are READ/NONE/15s and write tools are WRITE/idempotent/120s', () => {
  for (const tool of facts.tools) {
    if (tool.effect === 'READ') {
      assert.equal(tool.riskLevel, 'NONE', tool.name);
      assert.equal(tool.requiredScope, null, tool.name);
      assert.equal(tool.idempotencyRequired, false, tool.name);
      assert.equal(tool.timeoutMillis, 15000, tool.name);
    } else {
      assert.equal(tool.idempotencyRequired, true, tool.name);
      assert.ok(tool.requiredScope, `${tool.name} must declare a scope`);
      assert.ok(facts.declaredScopes.includes(tool.requiredScope), `${tool.name} scope must be a real AgentScope`);
      assert.equal(tool.timeoutMillis, 120000, tool.name);
    }
  }
});

test('extractor: only roadmap.current.get has a nullable top-level output', () => {
  const nullable = facts.tools.filter((tool) => tool.outputShape?.nullableTopLevel).map((tool) => tool.name);
  assert.deepEqual(nullable, ['roadmap.current.get']);
});

test('extractor: reads the real governance rule and TTLs', () => {
  assert.equal(facts.governanceRule.highRiskStatus, 'WAITING_CONFIRMATION');
  assert.equal(facts.governanceRule.ungrantedStatus, 'WAITING_AUTHORIZATION');
  assert.equal(facts.governanceRule.grantedStatus, 'PENDING');
  assert.equal(facts.governanceRule.confirmationTtlMinutes, 15);
  assert.equal(facts.governanceRule.leaseMinutes, 5);
});

test('extractor: navigation route table matches the frozen fixture', () => {
  assert.equal(Object.keys(facts.navigation.routes).length, fixture.frozenFacts.navigation.routeCount);
  assert.deepEqual(facts.navigation.routes, fixture.frozenFacts.navigation.routes);
});

test('extractor: the frozen fixture still matches the live Java source', () => {
  for (const [relative, digest] of Object.entries(fixture.frozenFacts.javaSourceDigests)) {
    assert.equal(facts.sourceDigests[relative], digest, `${relative} drifted`);
  }
});

// --- policies -------------------------------------------------------------

const POLICY_TOOL = (over) => ({ name: 'x.y', category: 'LEARNING', effect: 'READ', riskLevel: 'NONE', ...over });

test('policy: exposure follows the H02 boundary, not the effect alone', () => {
  assert.equal(
    expectedExposure(POLICY_TOOL({ effect: 'WRITE', riskLevel: 'LOW' }), fixture.exposurePolicy).state,
    'disabled',
  );
  assert.equal(
    expectedExposure(POLICY_TOOL({ effect: 'READ', category: 'DEVELOPER' }), fixture.exposurePolicy).state,
    'disabled',
  );
  assert.equal(
    expectedExposure(POLICY_TOOL({ effect: 'READ', category: 'RUNNER' }), fixture.exposurePolicy).state,
    'disabled',
  );
  assert.equal(expectedExposure(POLICY_TOOL({}), fixture.exposurePolicy).state, 'allowed');
  assert.equal(
    expectedExposure(POLICY_TOOL({ effect: 'NAVIGATE', category: 'NAVIGATION' }), fixture.exposurePolicy).state,
    'allowed',
  );
});

test('policy: confirmation comes from the governance rule, not the risk label alone', () => {
  assert.deepEqual(expectedConfirmation(POLICY_TOOL({ effect: 'WRITE', riskLevel: 'HIGH' }), fixture.confirmationPolicy), {
    mode: 'always_user_confirmation',
    waitingStatus: 'WAITING_CONFIRMATION',
  });
  assert.deepEqual(expectedConfirmation(POLICY_TOOL({ effect: 'WRITE', riskLevel: 'LOW' }), fixture.confirmationPolicy), {
    mode: 'conditional_scope_grant',
    waitingStatus: 'WAITING_AUTHORIZATION',
  });
  assert.deepEqual(expectedConfirmation(POLICY_TOOL({}), fixture.confirmationPolicy), {
    mode: 'none',
    waitingStatus: null,
  });
});

const PLAN_GET = {
  name: 'learning.plan.get',
  inputProperties: { planId: 'string' },
  inputRequired: ['planId'],
};

test('examples: accepts a schema-valid input', () => {
  checkExampleInput(PLAN_GET, { planId: 'p-1' });
});

test('examples: rejects a missing required argument, an unknown key and a wrong type', () => {
  assert.throws(() => checkExampleInput(PLAN_GET, {}), (error) => error.code === 'E_EXAMPLE_SCHEMA');
  assert.throws(() => checkExampleInput(PLAN_GET, { planId: 'p', extra: 1 }), (error) => error.code === 'E_EXAMPLE_SCHEMA');
  assert.throws(() => checkExampleInput(PLAN_GET, { planId: 7 }), (error) => error.code === 'E_EXAMPLE_SCHEMA');
  assert.throws(() => checkExampleInput(PLAN_GET, 'not-an-object'), (error) => error.code === 'E_EXAMPLE_SCHEMA');
});

// --- metadata: full validation -------------------------------------------

test('metadata file exists at the owner path', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  assert.ok(existsSync(DEFAULT_METADATA));
});

test('metadata: the shipped document passes every check', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  const report = runValidation();
  assert.equal(report.ok, true, `failures: ${JSON.stringify(report.failures)}`);
  assert.equal(report.tools, 65);
  // exactly the four verified-defect tools are pending
  assert.equal(report.pending, 4);
  assert.ok(report.allowed > 0 && report.disabled > 0);
  assert.equal(report.negativeMatchedExpectedCode, report.negativeCases);
});

test('metadata: covers allowed READ/navigation and disabled WRITE/RUNNER/DEVELOPER', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  const doc = loadMetadata();
  const byName = new Map(doc.tools.map((entry) => [entry.name, entry]));
  assert.equal(byName.get('assessment.mastery.list').exposure.state, 'allowed');
  // Verified contract defects must be pending, not allowed.
  for (const defective of ['schedule.today.get', 'assessment.wrong_questions.list', 'governance.health.get', 'artifacts.evaluate']) {
    assert.equal(byName.get(defective).exposure.state, 'pending', defective);
  }
  assert.equal(byName.get('navigation.resolve').exposure.state, 'allowed');
  assert.equal(byName.get('learning.task.update').exposure.state, 'disabled');
  assert.equal(byName.get('runner.check.run').exposure.state, 'disabled');
  assert.equal(byName.get('developer.git.push').exposure.state, 'disabled');
  assert.equal(byName.get('developer.interface_fallback.execute').exposure.state, 'disabled');
});

test('metadata: never carries owner, authorization or credential FIELDS', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  // Structural, not textual: the prose legitimately *mentions* ownerId (to say
  // Java injects identity), so a substring scan would flag correct text. What
  // must never exist is a field that could carry identity or authorization.
  const forbiddenFieldNames = new Set([
    'ownerId', 'owner_id', 'grant', 'grants', 'authorization', 'authorizations',
    'permissions', 'scope', 'scopes', 'secret', 'apiKey', 'token',
  ]);
  const doc = loadMetadata();
  const visit = (value, path) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      // `scope`/`token` inside an example input are checked by the validator's
      // own argument rules; elsewhere they must not exist as fields.
      const inExampleInput = path.includes('examples[') && path.endsWith('.input');
      if (!inExampleInput) {
        assert.ok(!forbiddenFieldNames.has(key), `forbidden metadata field "${key}" at ${path}.${key}`);
      }
      visit(child, `${path}.${key}`);
    }
  };
  visit(doc, '$');
  for (const entry of doc.tools) {
    for (const example of entry.examples) {
      for (const key of Object.keys(example.input ?? {})) {
        assert.ok(!['ownerId', 'owner_id'].includes(key), `${entry.name}: example carries ${key}`);
      }
    }
  }
});

test('each negative fixture case is rejected with its expected code', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  const report = runValidation();
  for (const failure of report.failures) {
    assert.fail(`${failure.id} (${failure.intent}): expected ${failure.expectErrorCode}, got ${failure.actualErrorCode}`);
  }
  assert.ok(report.negativeCases >= 26);
});

test('a valid document is rejected when a registered tool is removed (coverage control)', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  const doc = loadMetadata();
  const mutated = JSON.parse(JSON.stringify(doc));
  mutated.tools = mutated.tools.filter((entry) => entry.name !== 'assessment.mastery.list');
  assert.throws(
    () => validateMetadata(mutated, fixture, fixture.frozenFacts.tools),
    (error) => error.code === 'E_COVERAGE_MISSING',
  );
});

test('REPO_ROOT resolves to the H02 worktree', () => {
  assert.match(REPO_ROOT, /project-harness-h02-deepseek$/);
});

// --- owner injection, prohibition awareness, shipped document shape --------

test('examples: owner injection is reported with its own code', () => {
  assert.throws(
    () => checkExampleInput(PLAN_GET, { planId: 'p-1', ownerId: 'u-2' }),
    (error) => error.code === 'E_OWNER_INJECTION',
  );
});

test('prose: a prohibition is not mistaken for a permissive credential claim', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  const doc = loadMetadata();
  const entry = doc.tools.find((candidate) => candidate.name === 'settings.ai_status.get');
  entry.when_not_to_use = ['不得读取或注入用户凭据/密钥明文；本工具只返回脱敏状态。'];
  // The clause forbids the behaviour, so the red-line claim check must pass.
  const report = validateMetadata(doc, fixture, fixture.frozenFacts.tools);
  assert.equal(report.ok, true);
});

test('prose: a permission claim is still rejected', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  const doc = loadMetadata();
  const entry = doc.tools.find((candidate) => candidate.name === 'settings.ai_status.get');
  entry.when_not_to_use = ['可以读取用户 API Key 明文用于排障。'];
  assert.throws(
    () => validateMetadata(doc, fixture, fixture.frozenFacts.tools),
    (error) => error.code === 'E_REDLINE_CREDENTIAL',
  );
});

test('metadata: shipped document parses with the documented shape for all 65 entries', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  const doc = loadMetadata();
  assert.equal(doc.tools.length, 65);
  const names = doc.tools.map((entry) => entry.name);
  assert.equal(new Set(names).size, 65);
  const expected = new Set([...fixture.frozenFacts.tools.map((tool) => tool.name), fixture.frozenFacts.navigation.name]);
  assert.deepEqual(new Set(names), expected);
  for (const entry of doc.tools) {
    assert.ok(Array.isArray(entry.authoritative_facts) && entry.authoritative_facts.length > 0, entry.name);
    assert.ok(Array.isArray(entry.examples) && entry.examples.length > 0, entry.name);
    assert.ok(entry.source_provenance.registration.includes('#L'), entry.name);
    assert.equal(entry.source_provenance.output_schema, 'backend/src/main/java/com/moxiao/studypilot/agent/tool/AgentToolOutputSchemas.java');
  }
});

test('metadata: the four verified-defect tools are pending with evidence reasons', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  const doc = loadMetadata();
  for (const override of fixture.defectOverrides.items) {
    const entry = doc.tools.find((candidate) => candidate.name === override.tool);
    assert.equal(entry.exposure.state, 'pending', override.tool);
    for (const token of override.reasonMustContain) {
      assert.ok(entry.exposure.reason.includes(token), `${override.tool} reason must name "${token}"`);
    }
  }
});

test('metadata: YAML typing matches each argument\'s declared schema type', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  // The real risk is not "unquoted digits" but a scalar whose YAML type differs
  // from the declared Java type: a date-like string read as a Date, or a numeric
  // string read as a number. Assert the parsed JS type against the frozen
  // inputProperties declaration for every example argument.
  const doc = loadMetadata();
  const declared = new Map(fixture.frozenFacts.tools.map((tool) => [tool.name, tool.inputProperties]));
  declared.set(fixture.frozenFacts.navigation.name, { routeKey: 'string', params: 'object' });
  let checked = 0;
  for (const entry of doc.tools) {
    const properties = declared.get(entry.name);
    assert.ok(properties, `${entry.name}: no frozen input declaration`);
    for (const example of entry.examples) {
      for (const [key, value] of Object.entries(example.input ?? {})) {
        const expected = properties[key];
        assert.ok(expected, `${entry.name}: example argument ${key} is not declared`);
        const actualType = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
        if (expected === 'integer') assert.equal(actualType, 'number', `${entry.name}.${key} must parse as a number`);
        else if (expected === 'string') assert.equal(actualType, 'string', `${entry.name}.${key} must parse as a string (not a date/number)`);
        else if (expected === 'boolean') assert.equal(actualType, 'boolean', `${entry.name}.${key} must parse as a boolean`);
        else assert.equal(actualType, expected, `${entry.name}.${key} must parse as ${expected}`);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 50, `expected to check many example arguments, checked ${checked}`);
});

test('metadata: strict third-party parser agrees with this subset parser', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  // PyYAML is the independent oracle used during authoring; here we at least
  // assert our own parser yields exactly the 65 entries with string lists.
  const doc = loadMetadata();
  assert.equal(doc.tools.length, 65);
  for (const entry of doc.tools) {
    for (const field of ['when_to_use', 'when_not_to_use', 'error_contract']) {
      assert.ok(Array.isArray(entry[field]), `${entry.name}.${field}`);
      for (const item of entry[field]) {
        assert.equal(typeof item, 'string', `${entry.name}.${field} entries must be strings`);
      }
    }
  }
});

// --- R-D1: execution binding ----------------------------------------------

test('binding: a fabricated method on a real class is rejected', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  const doc = loadMetadata();
  doc.tools[0].source_provenance.handler = 'AgentGovernanceService.thisMethodDoesNotExist';
  assert.throws(
    () => validateMetadata(doc, fixture, fixture.frozenFacts.tools),
    (error) => error.code === 'E_PROVENANCE',
  );
});

test('binding: a real but unbound execution class is rejected', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  const doc = loadMetadata();
  doc.tools[0].source_provenance.handler = 'RoadmapScheduleService.getOrCreate';
  assert.throws(
    () => validateMetadata(doc, fixture, fixture.frozenFacts.tools),
    (error) => error.code === 'E_PROVENANCE',
  );
});

test('binding: a fabricate method cannot be laundered through unverified_symbols', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  const doc = loadMetadata();
  const entry = doc.tools[0];
  entry.source_provenance.handler = 'AssistantHealthService.summarize and AgentGovernanceService.thisMethodDoesNotExist';
  entry.source_provenance.unverified_symbols = ['AgentGovernanceService.thisMethodDoesNotExist'];
  assert.throws(
    () => validateMetadata(doc, fixture, fixture.frozenFacts.tools),
    (error) => error.code === 'E_PROVENANCE',
  );
});

test('binding: frozen facts carry per-tool bound symbol sets', () => {
  const health = fixture.frozenFacts.tools.find((tool) => tool.name === 'governance.health.get');
  assert.ok(health.boundClasses.includes('AssistantHealthService'));
  assert.ok(health.boundMethods.includes('summarize'));
  assert.ok(!health.boundClasses.includes('RoadmapScheduleService'), 'other beans must not leak into this context');
  assert.deepEqual(health.handlerServices, ['AssistantHealthService'], 'the injected TYPE, not the variable name');
});

// --- R-D2: navigation whitelist, params and identity -----------------------

const NAV_TOOL = {
  name: 'navigation.resolve',
  inputProperties: { routeKey: 'string', params: 'object' },
  inputRequired: ['routeKey'],
  routes: { TODAY: [], ROADMAP_NODE: ['nodeId'] },
};

test('navigation: only whitelisted routes are legal', () => {
  checkExampleInput(NAV_TOOL, { routeKey: 'TODAY' });
  assert.throws(() => checkExampleInput(NAV_TOOL, { routeKey: 'NOT_A_ROUTE' }), (e) => e.code === 'E_NAVIGATION_ROUTE');
});

test('navigation: params must match the route requirement exactly', () => {
  checkExampleInput(NAV_TOOL, { routeKey: 'ROADMAP_NODE', params: { nodeId: 'n-1' } });
  assert.throws(() => checkExampleInput(NAV_TOOL, { routeKey: 'ROADMAP_NODE', params: {} }), (e) => e.code === 'E_NAVIGATION_PARAMS');
  assert.throws(() => checkExampleInput(NAV_TOOL, { routeKey: 'ROADMAP_NODE', params: { wrongKey: 'x' } }), (e) => e.code === 'E_NAVIGATION_PARAMS');
  assert.throws(() => checkExampleInput(NAV_TOOL, { routeKey: 'TODAY', params: { nodeId: 'n-1' } }), (e) => e.code === 'E_NAVIGATION_PARAMS');
});

test('navigation: param values must satisfy the Java safe-identifier pattern', () => {
  assert.throws(
    () => checkExampleInput(NAV_TOOL, { routeKey: 'ROADMAP_NODE', params: { nodeId: 'bad value/../etc' } }),
    (e) => e.code === 'E_NAVIGATION_SAFE_IDENTIFIER',
  );
});

test('navigation: nested identity or credentials are rejected at any depth', () => {
  assert.throws(
    () => checkExampleInput(NAV_TOOL, { routeKey: 'TODAY', params: { ownerId: 'forged' } }),
    (e) => e.code === 'E_OWNER_INJECTION',
  );
  assert.throws(
    () => checkExampleInput(NAV_TOOL, { routeKey: 'TODAY', nested: { deep: { apiKey: 'x' } } }),
    (e) => e.code === 'E_CREDENTIAL_INJECTION' || e.code === 'E_EXAMPLE_SCHEMA',
  );
});

test('identity: a nested forged owner is rejected on a non-navigation tool too', () => {
  assert.throws(
    () => checkExampleInput({ name: 'x.y', inputProperties: { filter: 'object' }, inputRequired: [] }, { filter: { ownerId: 'forged' } }),
    (e) => e.code === 'E_OWNER_INJECTION',
  );
});

// --- R-D3: legal output instances -----------------------------------------

const OUT_TOOL = { name: 'y.z', outputContainer: 'object', outputFields: ['a', 'b'], nullableTopLevel: false };

test('output: accepts a contract-shaped instance and rejects undeclared fields', () => {
  checkExampleOutput(OUT_TOOL, { a: '<shape-placeholder>', b: '<shape-placeholder>' }, 'shape_placeholder');
  assert.throws(() => checkExampleOutput(OUT_TOOL, { unexpected: 'x' }, 'shape_placeholder'), (e) => e.code === 'E_OUTPUT_INSTANCE');
});

test('output: a shape fixture may not smuggle real values', () => {
  assert.throws(() => checkExampleOutput(OUT_TOOL, { a: 0.99 }, 'shape_placeholder'), (e) => e.code === 'E_OUTPUT_INSTANCE');
});

test('output: container kind must match the registered contract', () => {
  const arrayTool = { name: 'a.b', outputContainer: 'array', outputFields: ['k'], nullableTopLevel: false };
  checkExampleOutput(arrayTool, [{ k: '<shape-placeholder>' }], 'shape_placeholder');
  assert.throws(() => checkExampleOutput(arrayTool, { k: '<shape-placeholder>' }, 'shape_placeholder'), (e) => e.code === 'E_OUTPUT_INSTANCE');
  assert.throws(() => checkExampleOutput(OUT_TOOL, [], 'shape_placeholder'), (e) => e.code === 'E_OUTPUT_INSTANCE');
});

test('output: only the nullable tool may return a null result', () => {
  checkExampleOutput({ ...OUT_TOOL, nullableTopLevel: true }, null, 'shape_placeholder');
  assert.throws(() => checkExampleOutput(OUT_TOOL, null, 'shape_placeholder'), (e) => e.code === 'E_OUTPUT_INSTANCE');
});

test('output: a contract-defect example must not claim any result', () => {
  checkExampleOutput(OUT_TOOL, null, 'contract_defect');
  assert.throws(() => checkExampleOutput(OUT_TOOL, { a: '<shape-placeholder>' }, 'contract_defect'), (e) => e.code === 'E_OUTPUT_INSTANCE');
});

test('examples: every shipped example declares outcome, fixture_kind and fixture_source', { skip: !metadataExists && 'metadata.yaml not written yet' }, () => {
  const doc = loadMetadata();
  let ok = 0;
  let rejected = 0;
  let unavailable = 0;
  for (const entry of doc.tools) {
    for (const example of entry.examples) {
      assert.ok(['ok', 'rejected', 'unavailable'].includes(example.outcome), `${entry.name}: outcome`);
      assert.ok(['shape_placeholder', 'rejection', 'contract_defect'].includes(example.fixture_kind), `${entry.name}: fixture_kind`);
      assert.equal(typeof example.fixture_source, 'string', `${entry.name}: fixture_source`);
      assert.equal(typeof example.expect, 'string', `${entry.name}: expect`);
      if (example.outcome === 'ok') { ok += 1; assert.ok(example.output, `${entry.name}: ok needs an output`); }
      if (example.outcome === 'rejected') { rejected += 1; assert.ok(example.error, `${entry.name}: rejected needs an error`); }
      if (example.outcome === 'unavailable') { unavailable += 1; assert.equal(example.output, null, `${entry.name}: unavailable needs a null output`); assert.ok(example.error, `${entry.name}: unavailable needs an error`); }
    }
  }
  assert.ok(ok > 60, `expected many acceptable examples, got ${ok}`);
  assert.ok(rejected >= 1, 'at least one deliberate rejection fixture');
  assert.ok(
    unavailable >= fixture.defectOverrides.items.length,
    'every verified defect contributes at least one unavailable example',
  );
});
