#!/usr/bin/env node
// H01 offline fixture validator for the 16 frozen runtime scenarios.
//
// Owner: deepseek-harness (H01). Read-only with respect to the desktop Harness
// source tree; this script only reads its own repository's fixture file.
//
// It performs NO model calls and NO network access. It validates:
//   1. fixture structure + frozen baseline lock fields,
//   2. the 16 required coverage tags, and 16 unique scenarios,
//   3. the per-scenario contract (facts, allowed/forbidden, hard failures,
//      4-dimension rubric, outcome, offline-only measurement),
//   4. every declared `offlineAssertions` predicate, resolved against the
//      scenario's own frozen facts and mock tool results.
//
// Exit codes: 0 = all checks pass, 1 = at least one check failed,
// 2 = usage/IO error.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(HERE, '..', '..');
export const DEFAULT_FIXTURE = join(REPO_ROOT, 'agent-service', 'tests', 'fixtures', 'runtime_scenarios.json');

export const RUBRIC_DIMENSIONS = ['understanding', 'grounding', 'advice', 'expression'];
export const EXPECTED_SCENARIO_COUNT = 16;
export const OUTCOME_KINDS = [
  'answer',
  'clarify',
  'tool_use',
  'refusal',
  'failed',
  'cancelled',
  'pending_confirmation',
];
export const ALLOWED_TERMINATION_REASONS = [
  'ok',
  'cancelled',
  'budget_exhausted',
  'max_tokens',
  'failed',
  'needs_confirmation',
];
// Keys that would indicate a fabricated MODEL-EVALUATION score. H01 must ship
// none. Business metrics legitimately named `score` (e.g. a mastery score)
// live inside `inputFacts`/`mockToolResults` and are therefore not listed here.
const FABRICATED_SCORE_KEYS = [
  'scores',
  'measuredScore',
  'nativeScore',
  'integratedScore',
  'modelScore',
  'rubricScores',
  'medianScore',
  'pairedMedian',
];
const MEASUREMENT_KEYS = ['mode', 'modelRuns', 'pairedResult'];

class CheckError extends Error {}

function fail(message) {
  throw new CheckError(message);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Recursively collect every object key in a value (for fabricated-score scans). */
function collectKeys(value, out = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, out);
  } else if (isPlainObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      out.add(key);
      collectKeys(child, out);
    }
  }
  return out;
}

/** All text/JSON content a `mustMention` token may legitimately come from. */
function traceableCorpus(scenario, doc) {
  return JSON.stringify({
    frozenBusinessFacts: doc.frozenBusinessFacts ?? {},
    inputFacts: scenario.inputFacts ?? {},
    mockToolResults: scenario.mockToolResults ?? [],
  });
}

function toolCallNames(result) {
  return (result.mockToolResults ?? []).map((entry) => entry.toolName);
}

function sortedBySequence(results) {
  return [...results].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
}

// ---------------------------------------------------------------------------
// Predicate resolver: one implementation per declared assertion kind.
// ---------------------------------------------------------------------------

const ASSERTION_RESOLVERS = {
  fact_defined(ctx, a) {
    const value = ctx.scenario.inputFacts?.[a.field];
    if (value === undefined || value === null) {
      fail(`inputFacts.${a.field} is not defined`);
    }
    if (typeof value === 'string' && value.trim() === '') {
      fail(`inputFacts.${a.field} is empty`);
    }
    if (Array.isArray(value) && value.length === 0) {
      fail(`inputFacts.${a.field} is an empty list`);
    }
  },

  no_tool_allowed(ctx) {
    if ((ctx.scenario.availableTools ?? []).length > 0) {
      fail('availableTools must be empty when no tool may be used');
    }
    if ((ctx.scenario.mockToolResults ?? []).length > 0) {
      fail('mockToolResults must be empty when no tool may be used');
    }
  },

  no_tool_invoked(ctx) {
    if ((ctx.scenario.mockToolResults ?? []).length > 0) {
      fail('no tool may be invoked, but mockToolResults is not empty');
    }
  },

  expected_outcome_kind(ctx, a) {
    const actual = ctx.scenario.expectedOutcome?.kind;
    if (actual !== a.value) fail(`expectedOutcome.kind is "${actual}", expected "${a.value}"`);
  },

  must_mention_traceable(ctx) {
    const corpus = traceableCorpus(ctx.scenario, ctx.doc);
    for (const token of ctx.scenario.expectedOutcome?.mustMention ?? []) {
      if (!corpus.includes(token)) {
        fail(`mustMention token "${token}" is not traceable to any frozen fact or tool result`);
      }
    }
  },

  rubric_complete(ctx) {
    const rubric = ctx.scenario.rubric ?? {};
    for (const dim of RUBRIC_DIMENSIONS) {
      if (!isNonEmptyString(rubric[dim])) fail(`rubric.${dim} is missing or empty`);
    }
  },

  forbidden_disjoint_allowed(ctx) {
    const allowed = new Set(ctx.scenario.allowedActions ?? []);
    for (const action of ctx.scenario.forbiddenActions ?? []) {
      if (allowed.has(action)) fail(`action "${action}" is both allowed and forbidden`);
    }
  },

  tool_sequence(ctx, a) {
    const actual = toolCallNames(ctx.scenario);
    const expected = a.expected ?? [];
    if (actual.length !== expected.length || actual.some((name, i) => name !== expected[i])) {
      fail(`tool sequence is [${actual.join(', ')}], expected [${expected.join(', ')}]`);
    }
  },

  post_tool_continuation_required(ctx, a) {
    const after = a.afterSequence ?? 0;
    const min = a.minAdditionalCalls ?? 1;
    const additional = sortedBySequence(ctx.scenario.mockToolResults ?? []).filter(
      (entry) => (entry.sequence ?? 0) > after,
    );
    if (additional.length < min) {
      fail(`only ${additional.length} tool call(s) after sequence ${after}, expected >= ${min}`);
    }
  },

  bounded_retry(ctx, a) {
    const calls = ctx.scenario.mockToolResults ?? [];
    const extra = Math.max(0, calls.length - 1);
    if (extra > (a.maxExtraCalls ?? 1)) {
      fail(`${extra} extra call(s) exceeds bounded retry limit ${a.maxExtraCalls}`);
    }
  },

  truncation_acknowledged(ctx) {
    const truncated = (ctx.scenario.mockToolResults ?? []).filter((e) => e.result?.truncated === true);
    if (truncated.length === 0) fail('no mock tool result is marked truncated: true');
  },

  empty_result_is_valid(ctx) {
    const results = sortedBySequence(ctx.scenario.mockToolResults ?? []);
    const last = results[results.length - 1];
    if (!last) fail('no mock tool result to check for an empty payload');
    if (last.result?.status !== 'ok') fail(`empty-state result status is "${last.result?.status}", expected "ok"`);
    const data = last.result?.data;
    const empty = data === null || (Array.isArray(data) && data.length === 0);
    if (!empty) fail('the empty-state payload is not null or an empty list');
  },

  no_retry_on_empty(ctx) {
    if ((ctx.scenario.mockToolResults ?? []).length !== 1) {
      fail('an empty state must not trigger a retry, but more than one call is declared');
    }
  },

  error_result_present(ctx, a) {
    const match = (ctx.scenario.mockToolResults ?? []).find((e) => e.sequence === a.sequence);
    if (!match) fail(`no mock tool result at sequence ${a.sequence}`);
    if (match.result?.status !== 'error') {
      fail(`result at sequence ${a.sequence} is "${match.result?.status}", expected "error"`);
    }
  },

  failure_not_empty_state(ctx) {
    const errors = (ctx.scenario.mockToolResults ?? []).filter((e) => e.result?.status === 'error');
    if (errors.length === 0) fail('no error result declared, so failure is indistinguishable from empty state');
    for (const entry of errors) {
      if (!isNonEmptyString(entry.result?.error?.code)) {
        fail(`error result at sequence ${entry.sequence} carries no error code`);
      }
    }
  },

  no_retry_on_error(ctx) {
    if ((ctx.scenario.mockToolResults ?? []).length !== 1) {
      fail('a declared hard failure must not silently retry');
    }
  },

  termination_reason(ctx, a) {
    const actual = ctx.scenario.expectedOutcome?.terminationReason;
    if (actual !== a.value) fail(`terminationReason is "${actual}", expected "${a.value}"`);
    for (const forbidden of a.mustNotBe ?? []) {
      if (actual === forbidden) fail(`terminationReason must not be "${forbidden}"`);
    }
    if (!ALLOWED_TERMINATION_REASONS.includes(actual)) {
      fail(`terminationReason "${actual}" is outside the frozen vocabulary`);
    }
  },

  no_calls_after_sequence(ctx, a) {
    const sequences = (ctx.scenario.mockToolResults ?? []).map((e) => e.sequence ?? 0);
    const max = sequences.length > 0 ? Math.max(...sequences) : 0;
    if (max > a.sequence) fail(`tool call at sequence ${max} exists after the stop point ${a.sequence}`);
  },

  steer_takes_effect(ctx, a) {
    const calls = sortedBySequence(ctx.scenario.mockToolResults ?? []);
    const pivot = calls.find((e) => e.sequence === a.afterSequence);
    const later = calls.filter((e) => (e.sequence ?? 0) > a.afterSequence);
    if (!pivot) fail(`no tool call at steer boundary sequence ${a.afterSequence}`);
    if (later.length === 0) fail('the interjection produced no follow-up call');
    if (later.every((e) => e.toolName === pivot.toolName)) {
      fail('the follow-up call repeats the pre-interjection tool, so the steer had no effect');
    }
  },

  compaction_fact_retention(ctx, a) {
    const kept = ctx.scenario.inputFacts?.mustSurviveCompaction;
    if (!isPlainObject(kept)) fail('inputFacts.mustSurviveCompaction is missing');
    for (const fact of a.facts ?? []) {
      const value = kept[fact];
      if (value === undefined || value === null || value === '') {
        fail(`fact "${fact}" would not survive compaction`);
      }
    }
  },

  resume_no_replay(ctx, a) {
    const executed = ctx.scenario.inputFacts?.alreadyExecuted;
    if (!Array.isArray(executed) || executed.length === 0) {
      fail('inputFacts.alreadyExecuted is missing or empty');
    }
    for (const id of a.executedActionIds ?? []) {
      if (!executed.some((entry) => entry.actionId === id)) {
        fail(`action "${id}" is not recorded as already executed`);
      }
    }
    if ((ctx.scenario.mockToolResults ?? []).length > 0) {
      fail('a resume scenario must not declare fresh tool calls that could replay the action');
    }
  },

  owner_not_model_settable(ctx, a) {
    const bound = ctx.scenario.inputFacts?.boundOwnerId;
    if (!isNonEmptyString(bound)) fail('inputFacts.boundOwnerId is missing');
    if (bound === a.forbiddenOwnerId) fail('the bound owner equals the forbidden cross-owner id');
    const corpus = JSON.stringify(ctx.scenario.mockToolResults ?? []);
    if (corpus.includes(a.forbiddenOwnerId)) {
      fail(`a tool call leaks the forbidden owner "${a.forbiddenOwnerId}"`);
    }
  },

  budget_reservation_covers(ctx, a) {
    const limit = ctx.scenario.inputFacts?.budgetLimitTokens;
    if (typeof limit !== 'number' || limit <= 0) fail('inputFacts.budgetLimitTokens is missing or not positive');
    if (a.includeCompaction === true && !/压缩/.test(ctx.scenario.inputFacts?.note ?? '')) {
      fail('the budget scenario does not cover the compaction call');
    }
    const accounting = ctx.doc.evaluationProtocol?.costAccounting ?? [];
    if (!accounting.includes('model_calls')) fail('costAccounting does not track model_calls');
  },

  no_silent_fallback(ctx) {
    const corpus = JSON.stringify(ctx.scenario.forbiddenActions ?? []);
    if (!/静默|无声/.test(corpus)) {
      fail('no forbidden action rules out a silent fallback');
    }
  },

  no_side_effect_before_confirmation(ctx, a) {
    const writeTools = new Set(a.writeTools ?? []);
    for (const call of ctx.scenario.mockToolResults ?? []) {
      if (!writeTools.has(call.toolName)) continue;
      if (call.result?.status === 'ok' && call.result?.data?.executed === true) {
        fail(`write tool ${call.toolName} reported an executed side effect before confirmation`);
      }
    }
    if (!writeTools.has((ctx.scenario.mockToolResults ?? [])[0]?.toolName)) {
      fail('the write-confirmation scenario does not start with its declared write preview tool');
    }
  },

  pending_not_success(ctx, a) {
    const match = (ctx.scenario.mockToolResults ?? []).find((e) => e.sequence === a.sequence);
    if (!match) fail(`no mock tool result at sequence ${a.sequence}`);
    if (match.result?.status !== 'pending_confirmation') {
      fail(`result at sequence ${a.sequence} is "${match.result?.status}", expected "pending_confirmation"`);
    }
  },

  idempotent_replay(ctx, a) {
    const calls = ctx.scenario.mockToolResults ?? [];
    const keyed = calls.filter((e) => e.arguments?.idempotencyKey === a.key);
    if (keyed.length === 0) fail(`no tool call carries idempotency key "${a.key}"`);
    const actionIds = new Set(keyed.map((e) => e.result?.data?.actionId));
    if (actionIds.size !== (a.expectedActionIds ?? 1)) {
      fail(`idempotency key "${a.key}" produced ${actionIds.size} distinct action ids`);
    }
    const executions = keyed.filter((e) => e.result?.data?.executed === true).length;
    if (executions > (a.expectedExecutions ?? 1)) {
      fail(`idempotency key "${a.key}" executed ${executions} times`);
    }
  },

  no_duplicate_confirmation_card(ctx) {
    const actionIds = new Set(
      (ctx.scenario.mockToolResults ?? [])
        .filter((e) => e.result?.status === 'pending_confirmation')
        .map((e) => e.result?.data?.actionId),
    );
    if (actionIds.size !== 1) {
      fail(`pending confirmation produced ${actionIds.size} distinct confirmation cards`);
    }
  },

  no_write_invoked(ctx) {
    const writeTools = new Set(ctx.doc.toolCatalog?.write ?? []);
    const invoked = toolCallNames(ctx.scenario).filter((name) => writeTools.has(name));
    if (invoked.length > 0) fail(`a write tool was invoked: ${invoked.join(', ')}`);
  },
};

// ---------------------------------------------------------------------------
// Document-level checks
// ---------------------------------------------------------------------------

function checkDocumentShape(doc) {
  for (const field of ['fixtureVersion', 'schemaId', 'task', 'owner', 'frozenAt', 'evidenceLevel']) {
    if (!isNonEmptyString(doc[field])) fail(`top-level field "${field}" is missing`);
  }
  if (doc.task !== 'H01') fail(`task is "${doc.task}", expected "H01"`);
  if (doc.evidenceLevel !== 'mock/offline') fail('evidenceLevel must be "mock/offline" for H01');
  if (!isPlainObject(doc.baseline)) fail('baseline block is missing');
  if (!isPlainObject(doc.evaluationProtocol)) fail('evaluationProtocol block is missing');
  if (!isPlainObject(doc.coverageTaxonomy)) fail('coverageTaxonomy block is missing');
  if (!Array.isArray(doc.requiredCoverage) || doc.requiredCoverage.length === 0) {
    fail('requiredCoverage is missing or empty');
  }
  if (!isPlainObject(doc.frozenBusinessFacts)) fail('frozenBusinessFacts block is missing');
  if (!isPlainObject(doc.terminationReasons)) fail('terminationReasons block is missing');
  if (!isPlainObject(doc.toolCatalog)) fail('toolCatalog block is missing');
  if (!Array.isArray(doc.scenarios)) fail('scenarios must be an array');
}

function checkBaselineLock(doc) {
  const b = doc.baseline;
  if (!isNonEmptyString(b.harnessSourcePath)) fail('baseline.harnessSourcePath is missing');
  if (!/^[0-9a-f]{40}$/.test(b.harnessHead ?? '')) fail('baseline.harnessHead is not a full 40-char commit hash');
  for (const [file, hash] of Object.entries(b.lockedHashes ?? {})) {
    if (!/^[0-9a-f]{64}$/.test(hash)) fail(`baseline.lockedHashes.${file} is not a sha256 digest`);
  }
  for (const required of ['pnpm-lock.yaml', 'pnpm-workspace.yaml', 'package.json']) {
    if (!b.lockedHashes?.[required]) fail(`baseline.lockedHashes.${required} is missing`);
  }
  if (!Array.isArray(b.profileBundles) || b.profileBundles.length === 0) fail('baseline.profileBundles is empty');
  if (!isNonEmptyString(b.agentPreset)) fail('baseline.agentPreset is missing');
  const label = b.uiModelLabel ?? {};
  if (!isNonEmptyString(label.provider) || !isNonEmptyString(label.model)) {
    fail('baseline.uiModelLabel.provider/model is missing');
  }
  if (!isNonEmptyString(label.realProviderModelId)) {
    fail('baseline.uiModelLabel.realProviderModelId must be recorded, even as "unknown"');
  }
}

function checkNoFabricatedScores(doc) {
  const p = doc.evaluationProtocol;
  if (p.mode !== 'offline_fixture_only') fail('evaluationProtocol.mode must be "offline_fixture_only" in H01');
  if (p.realModelRunsAllowed !== false) fail('evaluationProtocol.realModelRunsAllowed must be false in H01');
  if (p.realModelRunsPerformed !== 0) fail('evaluationProtocol.realModelRunsPerformed must be 0 in H01');
  if (p.modelSelfScoringAllowed !== false) fail('evaluationProtocol.modelSelfScoringAllowed must be false');
  const dims = p.rubricDimensions ?? [];
  for (const dim of RUBRIC_DIMENSIONS) {
    if (!dims.includes(dim)) fail(`evaluationProtocol.rubricDimensions is missing "${dim}"`);
  }
  if (p.aggregation !== 'median') fail('evaluationProtocol.aggregation must be "median"');
  if (p.runsPerScenarioPerSide !== 3) fail('evaluationProtocol.runsPerScenarioPerSide must be 3');
  if ((p.pairedSides ?? []).length !== 2) fail('evaluationProtocol.pairedSides must name exactly two sides');
  for (const scenario of doc.scenarios) {
    const m = scenario.measurement ?? {};
    if (m.mode !== 'offline_fixture_only') fail(`${scenario.id}: measurement.mode must be offline_fixture_only`);
    if (m.modelRuns !== 0) fail(`${scenario.id}: measurement.modelRuns must be 0 in H01`);
    if (m.pairedResult !== null) fail(`${scenario.id}: measurement.pairedResult must be null in H01`);
    for (const key of Object.keys(m)) {
      if (!MEASUREMENT_KEYS.includes(key)) {
        fail(`${scenario.id}: unexpected measurement key "${key}" — no real model result may be recorded before H05`);
      }
    }
  }
  // No score-bearing key may appear outside the rubric prose.
  for (const scenario of doc.scenarios) {
    const scrub = { ...scenario };
    delete scrub.rubric;
    const keys = collectKeys(scrub);
    for (const key of FABRICATED_SCORE_KEYS) {
      if (keys.has(key)) fail(`${scenario.id}: unexpected score-bearing key "${key}"`);
    }
  }
}

function checkCoverage(doc) {
  const taxonomy = new Set(Object.keys(doc.coverageTaxonomy));
  const covered = new Map();
  for (const scenario of doc.scenarios) {
    if (!Array.isArray(scenario.coverage) || scenario.coverage.length === 0) {
      fail(`${scenario.id}: coverage is missing or empty`);
    }
    for (const tag of scenario.coverage) {
      if (!taxonomy.has(tag)) fail(`${scenario.id}: coverage tag "${tag}" is outside the taxonomy`);
      covered.set(tag, (covered.get(tag) ?? 0) + 1);
    }
  }
  for (const tag of doc.requiredCoverage) {
    if (!taxonomy.has(tag)) fail(`requiredCoverage tag "${tag}" is not declared in the taxonomy`);
    if (!covered.has(tag)) fail(`required coverage tag "${tag}" is not covered by any scenario`);
  }
  const uncovered = [...taxonomy].filter((tag) => !covered.has(tag));
  if (uncovered.length > 0) {
    fail(`taxonomy tags with no scenario: ${uncovered.join(', ')}`);
  }
}

function checkScenarioContract(doc, scenario) {
  for (const field of ['id', 'title', 'userInput']) {
    if (!isNonEmptyString(scenario[field])) fail(`${scenario.id ?? '<unknown>'}: "${field}" is missing`);
  }
  if (!/^H01-S\d{2}$/.test(scenario.id)) fail(`${scenario.id}: id must match H01-SNN`);
  if (!isPlainObject(scenario.inputFacts) || Object.keys(scenario.inputFacts).length === 0) {
    fail(`${scenario.id}: inputFacts is missing or empty`);
  }
  if (!Array.isArray(scenario.availableTools)) fail(`${scenario.id}: availableTools must be an array`);
  if (!Array.isArray(scenario.mockToolResults)) fail(`${scenario.id}: mockToolResults must be an array`);
  if (!Array.isArray(scenario.allowedActions) || scenario.allowedActions.length === 0) {
    fail(`${scenario.id}: allowedActions is missing or empty`);
  }
  if (!Array.isArray(scenario.forbiddenActions) || scenario.forbiddenActions.length === 0) {
    fail(`${scenario.id}: forbiddenActions is missing or empty`);
  }
  if (!Array.isArray(scenario.hardFailures) || scenario.hardFailures.length === 0) {
    fail(`${scenario.id}: hardFailures is missing or empty`);
  }
  if (!Array.isArray(scenario.offlineAssertions) || scenario.offlineAssertions.length === 0) {
    fail(`${scenario.id}: offlineAssertions is missing or empty`);
  }
  const kind = scenario.expectedOutcome?.kind;
  if (!OUTCOME_KINDS.includes(kind)) fail(`${scenario.id}: expectedOutcome.kind "${kind}" is not in the vocabulary`);
  if (!Array.isArray(scenario.expectedOutcome?.mustMention)) {
    fail(`${scenario.id}: expectedOutcome.mustMention must be an array`);
  }
  if (!Array.isArray(scenario.expectedOutcome?.mustNotClaim)) {
    fail(`${scenario.id}: expectedOutcome.mustNotClaim must be an array`);
  }
  // Tool calls must be sequenced deterministically from 1..n.
  const sequences = scenario.mockToolResults.map((entry) => entry.sequence);
  const expected = sequences.map((_, index) => index + 1);
  if (sequences.some((value, index) => value !== expected[index])) {
    fail(`${scenario.id}: mockToolResults sequences must be 1..${scenario.mockToolResults.length}`);
  }
  // Declared tools must exist in the frozen catalog.
  const catalog = new Set([...(doc.toolCatalog?.read ?? []), ...(doc.toolCatalog?.write ?? [])]);
  for (const name of [...scenario.availableTools, ...toolCallNames(scenario)]) {
    if (!catalog.has(name)) fail(`${scenario.id}: tool "${name}" is not in the frozen toolCatalog`);
  }
  // A declared tool call must be one the scenario makes available.
  for (const name of toolCallNames(scenario)) {
    if (!scenario.availableTools.includes(name)) {
      fail(`${scenario.id}: tool "${name}" was called but is not in availableTools`);
    }
  }
}

function runAssertions(doc, scenario) {
  for (const assertion of scenario.offlineAssertions) {
    const resolver = ASSERTION_RESOLVERS[assertion.kind];
    if (!resolver) fail(`${scenario.id}: unknown offline assertion kind "${assertion.kind}"`);
    try {
      resolver({ doc, scenario }, assertion);
    } catch (error) {
      if (error instanceof CheckError) {
        fail(`${scenario.id} [${assertion.kind}]: ${error.message}`);
      }
      throw error;
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function validateFixtures(doc) {
  checkDocumentShape(doc);
  checkBaselineLock(doc);
  if (!isPlainObject(doc.evaluationProtocol)) fail('evaluationProtocol is missing');
  checkNoFabricatedScores(doc);

  // Scenario identity, count and per-scenario contract are checked before
  // coverage, so a missing or malformed scenario reports its own cause rather
  // than the coverage gap it would also produce.
  if (doc.scenarios.length !== EXPECTED_SCENARIO_COUNT) {
    fail(`expected ${EXPECTED_SCENARIO_COUNT} scenarios, found ${doc.scenarios.length}`);
  }
  const ids = new Set();
  for (const scenario of doc.scenarios) {
    if (ids.has(scenario.id)) fail(`duplicate scenario id "${scenario.id}"`);
    ids.add(scenario.id);
    checkScenarioContract(doc, scenario);
    runAssertions(doc, scenario);
  }

  checkCoverage(doc);

  return {
    ok: true,
    fixtureVersion: doc.fixtureVersion,
    scenarioCount: doc.scenarios.length,
    coveredTags: doc.requiredCoverage.length,
    assertionsEvaluated: doc.scenarios.reduce((sum, s) => sum + s.offlineAssertions.length, 0),
    hardFailureRules: doc.scenarios.reduce((sum, s) => sum + s.hardFailures.length, 0),
    evidenceLevel: doc.evidenceLevel,
  };
}

export function validateFixtureFile(path = DEFAULT_FIXTURE) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (error) {
    const err = new Error(`cannot read fixture at ${path}: ${error.message}`);
    err.code = 'FIXTURE_IO';
    throw err;
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (error) {
    const err = new Error(`fixture at ${path} is not valid JSON: ${error.message}`);
    err.code = 'FIXTURE_JSON';
    throw err;
  }
  return validateFixtures(doc);
}

function main(argv) {
  const json = argv.includes('--json');
  const pathArgIndex = argv.indexOf('--fixture');
  const path = pathArgIndex >= 0 ? argv[pathArgIndex + 1] : DEFAULT_FIXTURE;
  try {
    const report = validateFixtureFile(path);
    if (json) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(
        [
          `PASS  ${report.scenarioCount} scenarios, ${report.coveredTags} coverage tags`,
          `      ${report.assertionsEvaluated} offline assertions, ${report.hardFailureRules} hard-failure rules`,
          `      fixture ${report.fixtureVersion}, evidence level ${report.evidenceLevel}`,
          `      source ${path}`,
        ].join('\n') + '\n',
      );
    }
    return 0;
  } catch (error) {
    if (json) {
      process.stdout.write(`${JSON.stringify({ ok: false, error: error.message }, null, 2)}\n`);
    } else {
      process.stderr.write(`FAIL  ${error.message}\n`);
    }
    return error.code === 'FIXTURE_IO' || error.code === 'FIXTURE_JSON' ? 2 : 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv.slice(2));
}
