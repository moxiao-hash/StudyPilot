#!/usr/bin/env node
// Negative-control suite for the H01 offline fixture validator.
//
// RED evidence: every test below breaks ONE rule in a deep copy of the real
// fixture and asserts the validator REJECTS it. A passing run therefore proves
// each rule is live rather than vacuous. The first test is the GREEN control.
//
// Run: node --test scripts/harness/baseline-fixtures.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { DEFAULT_FIXTURE, EXPECTED_SCENARIO_COUNT, validateFixtures } from './baseline-fixtures.mjs';

const realDoc = JSON.parse(readFileSync(DEFAULT_FIXTURE, 'utf8'));

/** Deep copy of the shipped fixture, so no mutation leaks between tests. */
function clone() {
  return JSON.parse(JSON.stringify(realDoc));
}

function scenario(doc, id) {
  const found = doc.scenarios.find((s) => s.id === id);
  assert.ok(found, `fixture must contain ${id}`);
  return found;
}

/** Assert the validator rejects the mutated document, mentioning `fragment`. */
function assertRejected(doc, fragment) {
  let thrown;
  try {
    validateFixtures(doc);
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, 'expected the validator to reject the mutated fixture');
  if (fragment) {
    assert.match(thrown.message, fragment, `rejection reason should mention ${fragment}`);
  }
}

// --- GREEN control ---------------------------------------------------------

test('shipped fixture passes every check', () => {
  const report = validateFixtures(clone());
  assert.equal(report.ok, true);
  assert.equal(report.scenarioCount, EXPECTED_SCENARIO_COUNT);
  assert.equal(report.coveredTags, 16);
  assert.ok(report.assertionsEvaluated > 0);
  assert.ok(report.hardFailureRules > 0);
  assert.equal(report.evidenceLevel, 'mock/offline');
});

test('file-level API accepts the shipped fixture path', async () => {
  const { validateFixtureFile } = await import('./baseline-fixtures.mjs');
  const report = validateFixtureFile(DEFAULT_FIXTURE);
  assert.equal(report.ok, true);
});

// --- Structural mutations --------------------------------------------------

test('rejects a missing scenario', () => {
  const doc = clone();
  doc.scenarios.pop();
  assertRejected(doc, /expected 16 scenarios/);
});

test('rejects a duplicate scenario id', () => {
  const doc = clone();
  doc.scenarios[1].id = doc.scenarios[0].id;
  assertRejected(doc, /duplicate scenario id/);
});

test('rejects an id outside the H01-SNN shape', () => {
  const doc = clone();
  scenario(doc, 'H01-S01').id = 'S01';
  assertRejected(doc, /id must match/);
});

test('rejects a scenario with no hard failures', () => {
  const doc = clone();
  scenario(doc, 'H01-S01').hardFailures = [];
  assertRejected(doc, /hardFailures is missing or empty/);
});

test('rejects an incomplete rubric', () => {
  const doc = clone();
  scenario(doc, 'H01-S01').rubric.advice = '   ';
  assertRejected(doc, /rubric\.advice/);
});

test('rejects an action that is both allowed and forbidden', () => {
  const doc = clone();
  const s = scenario(doc, 'H01-S02');
  s.forbiddenActions.push(s.allowedActions[0]);
  assertRejected(doc, /both allowed and forbidden/);
});

test('rejects an outcome kind outside the vocabulary', () => {
  const doc = clone();
  scenario(doc, 'H01-S01').expectedOutcome.kind = 'maybe';
  assertRejected(doc, /not in the vocabulary/);
});

test('rejects non-contiguous mock tool sequences', () => {
  const doc = clone();
  scenario(doc, 'H01-S05').mockToolResults[1].sequence = 5;
  assertRejected(doc, /sequences must be 1\.\.2/);
});

// --- Coverage mutations ----------------------------------------------------

test('rejects a dropped required coverage tag', () => {
  const doc = clone();
  for (const s of doc.scenarios) {
    s.coverage = s.coverage.filter((tag) => tag !== 'idempotency');
  }
  assertRejected(doc, /required coverage tag "idempotency" is not covered/);
});

test('rejects a coverage tag outside the taxonomy', () => {
  const doc = clone();
  scenario(doc, 'H01-S01').coverage = ['vibes'];
  assertRejected(doc, /outside the taxonomy/);
});

// --- Baseline lock mutations ----------------------------------------------

test('rejects a truncated harness commit hash', () => {
  const doc = clone();
  doc.baseline.harnessHead = 'ddefc45';
  assertRejected(doc, /40-char commit hash/);
});

test('rejects a missing lockfile digest', () => {
  const doc = clone();
  delete doc.baseline.lockedHashes['pnpm-lock.yaml'];
  assertRejected(doc, /lockedHashes\.pnpm-lock\.yaml/);
});

test('requires the real provider model id to be recorded', () => {
  const doc = clone();
  delete doc.baseline.uiModelLabel.realProviderModelId;
  assertRejected(doc, /realProviderModelId must be recorded/);
});

// --- Anti-fabrication rules ------------------------------------------------

test('rejects a scenario that claims real model runs', () => {
  const doc = clone();
  scenario(doc, 'H01-S03').measurement.modelRuns = 3;
  assertRejected(doc, /modelRuns must be 0/);
});

test('rejects a recorded paired result before H05', () => {
  const doc = clone();
  scenario(doc, 'H01-S03').measurement.pairedResult = { native: 4, integrated: 4 };
  assertRejected(doc, /pairedResult must be null/);
});

test('rejects an extra measurement key carrying a score', () => {
  const doc = clone();
  scenario(doc, 'H01-S03').measurement.medianScore = 3.5;
  assertRejected(doc, /unexpected measurement key "medianScore"/);
});

test('rejects a document-level fabricated score key', () => {
  const doc = clone();
  doc.scenarios[0].nativeScore = 4;
  assertRejected(doc, /unexpected score-bearing key "nativeScore"/);
});

test('rejects a protocol that permits real model runs', () => {
  const doc = clone();
  doc.evaluationProtocol.realModelRunsAllowed = true;
  assertRejected(doc, /realModelRunsAllowed must be false/);
});

test('rejects a protocol with the wrong run count or aggregation', () => {
  const doc = clone();
  doc.evaluationProtocol.aggregation = 'single-run';
  assertRejected(doc, /aggregation must be "median"/);

  const doc2 = clone();
  doc2.evaluationProtocol.runsPerScenarioPerSide = 1;
  assertRejected(doc2, /runsPerScenarioPerSide must be 3/);
});

// --- Assertion resolver mutations -----------------------------------------

test('rejects an unknown offline assertion kind', () => {
  const doc = clone();
  scenario(doc, 'H01-S01').offlineAssertions.push({ kind: 'vibes_check' });
  assertRejected(doc, /unknown offline assertion kind/);
});

test('rejects a mustMention token with no factual source', () => {
  const doc = clone();
  scenario(doc, 'H01-S01').expectedOutcome.mustMention.push('掌握度 0.93');
  assertRejected(doc, /not traceable/);
});

test('rejects an unnecessary tool call where none is allowed', () => {
  const doc = clone();
  const s = scenario(doc, 'H01-S01');
  s.availableTools = ['studypilot.get_mastery'];
  s.mockToolResults = [
    { sequence: 1, toolName: 'studypilot.get_mastery', arguments: {}, result: { status: 'ok', data: [] } },
  ];
  assertRejected(doc, /availableTools must be empty/);
});

test('rejects a tool call that is not in the frozen catalog', () => {
  const doc = clone();
  const s = scenario(doc, 'H01-S02');
  s.availableTools.push('studypilot.do_everything');
  s.mockToolResults[0].toolName = 'studypilot.do_everything';
  assertRejected(doc, /is not in the frozen toolCatalog/);
});

test('rejects post-tool continuation that stops after the first call', () => {
  const doc = clone();
  scenario(doc, 'H01-S05').mockToolResults.pop();
  assertRejected(doc, /modelRuns|expected \[|expected >= 1|tool sequence/);
});

test('rejects a cancellation scenario that still ends ok', () => {
  const doc = clone();
  scenario(doc, 'H01-S10').expectedOutcome.terminationReason = 'ok';
  assertRejected(doc, /terminationReason is "ok"/);
});

test('rejects a cancellation scenario with a call after the stop point', () => {
  const doc = clone();
  const s = scenario(doc, 'H01-S10');
  s.availableTools.push('studypilot.get_learning_route');
  s.mockToolResults.push({
    sequence: 2,
    toolName: 'studypilot.get_learning_route',
    arguments: {},
    result: { status: 'ok', data: {} },
  });
  assertRejected(doc, /exists after the stop point/);
});

test('rejects an empty state that is treated as an error', () => {
  const doc = clone();
  const s = scenario(doc, 'H01-S08');
  s.mockToolResults[0].result.status = 'error';
  assertRejected(doc, /empty-state result status/);
});

test('rejects a failure with no error code', () => {
  const doc = clone();
  delete scenario(doc, 'H01-S09').mockToolResults[0].result.error.code;
  assertRejected(doc, /carries no error code/);
});

test('rejects a write preview reported as already executed', () => {
  const doc = clone();
  scenario(doc, 'H01-S16').mockToolResults[0].result = {
    status: 'ok',
    data: { actionId: 'act-5551', executed: true },
  };
  assertRejected(doc, /executed side effect before confirmation/);
});

test('rejects a PENDING write projected as success', () => {
  const doc = clone();
  scenario(doc, 'H01-S16').mockToolResults[0].result.status = 'ok';
  assertRejected(doc, /expected "pending_confirmation"/);
});

test('rejects idempotency drift producing two action ids', () => {
  const doc = clone();
  scenario(doc, 'H01-S16').mockToolResults[1].result.data.actionId = 'act-9999';
  assertRejected(doc, /distinct action ids|distinct confirmation cards/);
});

test('rejects a permission scenario that leaks a foreign owner', () => {
  const doc = clone();
  const s = scenario(doc, 'H01-S14');
  s.availableTools = ['studypilot.list_tasks'];
  s.mockToolResults = [
    {
      sequence: 1,
      toolName: 'studypilot.list_tasks',
      arguments: { ownerId: 'u-2002' },
      result: { status: 'ok', data: [] },
    },
  ];
  assertRejected(doc, /forbidden owner|not traceable|leaks the forbidden owner/);
});

test('rejects a resume scenario that replays an executed action', () => {
  const doc = clone();
  const s = scenario(doc, 'H01-S13');
  s.availableTools = ['studypilot.preview_reschedule_task'];
  s.mockToolResults = [
    {
      sequence: 1,
      toolName: 'studypilot.preview_reschedule_task',
      arguments: { taskId: 't-204', idempotencyKey: 'idem-t-204-1' },
      result: { status: 'pending_confirmation', data: { actionId: 'act-5500' } },
    },
  ];
  assertRejected(doc, /must not declare fresh tool calls/);
});

test('rejects a budget scenario that ignores the compaction call', () => {
  const doc = clone();
  scenario(doc, 'H01-S15').inputFacts.note = '预算在第二次模型请求前耗尽';
  assertRejected(doc, /does not cover the compaction call/);
});

test('rejects a silent-fallback-free claim with no forbidden rule', () => {
  const doc = clone();
  scenario(doc, 'H01-S15').forbiddenActions = ['胡说'];
  assertRejected(doc, /rules out a silent fallback/);
});

test('rejects a steer that repeats the pre-interjection tool', () => {
  const doc = clone();
  scenario(doc, 'H01-S11').mockToolResults[1].toolName = 'studypilot.get_learning_route';
  assertRejected(doc, /steer had no effect/);
});

test('rejects a compaction scenario that loses a key fact', () => {
  const doc = clone();
  delete scenario(doc, 'H01-S12').inputFacts.mustSurviveCompaction.dueAt;
  assertRejected(doc, /would not survive compaction/);
});

test('rejects a truncated result that is never acknowledged', () => {
  const doc = clone();
  for (const entry of scenario(doc, 'H01-S06').mockToolResults) delete entry.result.truncated;
  assertRejected(doc, /marked truncated/);
});

test('rejects an unbounded retry loop', () => {
  const doc = clone();
  const s = scenario(doc, 'H01-S06');
  s.mockToolResults.push(JSON.parse(JSON.stringify(s.mockToolResults[1])), JSON.parse(JSON.stringify(s.mockToolResults[1])));
  s.mockToolResults.forEach((entry, index) => {
    entry.sequence = index + 1;
  });
  assertRejected(doc, /exceeds bounded retry limit/);
});
