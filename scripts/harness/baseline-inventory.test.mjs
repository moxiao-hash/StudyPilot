#!/usr/bin/env node
// Tests for the H01 read-only baseline inventory.
//
// RED evidence: the drift detector is driven with deliberately perturbed
// documents and must report drift for each. The live-tree tests assert the
// recorded lock still matches this machine's Harness checkout; they are
// skipped (not failed) when the read-only reference tree is absent, so the
// suite stays runnable on a machine without it.
//
// Run: node --test scripts/harness/baseline-inventory.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  EXTENSION_POINTS,
  collectInventory,
  checkAgainstFixture,
} from './baseline-inventory.mjs';

const FIXTURE = new URL('../../agent-service/tests/fixtures/runtime_scenarios.json', import.meta.url);
const fixtureDoc = JSON.parse(readFileSync(FIXTURE, 'utf8'));
const HARNESS_PATH = fixtureDoc.baseline.harnessSourcePath;
const available = existsSync(HARNESS_PATH) && existsSync(`${HARNESS_PATH}/.git`);
const live = available ? collectInventory(HARNESS_PATH) : null;

function cloneFixture() {
  return JSON.parse(JSON.stringify(fixtureDoc));
}

test('the fixture records a read-only harness source path', () => {
  assert.equal(typeof fixtureDoc.baseline.harnessSourcePath, 'string');
  assert.ok(fixtureDoc.baseline.harnessSourcePath.length > 0);
});

test('every locked extension point is a path, not an absolute location', () => {
  for (const entry of EXTENSION_POINTS) {
    assert.ok(!entry.path.startsWith('/'), `${entry.id} must be repo-relative`);
    assert.equal(typeof entry.role, 'string', `${entry.id} must document its role`);
  }
  const ids = EXTENSION_POINTS.map((entry) => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'extension point ids must be unique');
});

test('the inventory covers loop, compaction, resume, tools, events, approval, question and budget seams', () => {
  const ids = new Set(EXTENSION_POINTS.map((entry) => entry.id));
  for (const required of [
    'loop-main',
    'loop-tool-calls',
    'loop-inbox',
    'tools-registry',
    'tools-json-schema',
    'compaction-basic',
    'session-persistence-jsonl',
    'session-checkpoint-policy',
    'agent-dispatch',
    'user-approval',
    'user-questions',
    'llm-service',
    'token-meter',
    'sdk-server-impl',
    'preset-standard',
  ]) {
    assert.ok(ids.has(required), `inventory must lock ${required}`);
  }
});

test('live: HEAD matches the frozen baseline', { skip: !available && 'harness tree unavailable' }, () => {
  assert.equal(live.harnessHead, fixtureDoc.baseline.harnessHead);
});

test('live: lockfile digests match the frozen baseline', { skip: !available && 'harness tree unavailable' }, () => {
  for (const [file, locked] of Object.entries(fixtureDoc.baseline.lockedHashes)) {
    assert.equal(live.lockedHashes[file], locked, `${file} digest drifted`);
  }
});

test('live: no required extension point is missing', { skip: !available && 'harness tree unavailable' }, () => {
  assert.deepEqual(live.missingRequired, []);
});

test('live: the drift check passes against the shipped fixture', { skip: !available && 'harness tree unavailable' }, () => {
  const result = checkAgainstFixture(live, fixtureDoc);
  assert.equal(result.ok, true, `unexpected drift: ${result.drift.join('; ')}`);
});

test('live: the recorded dirty paths match the read-only tree', { skip: !available && 'harness tree unavailable' }, () => {
  assert.deepEqual(live.harnessDirtyPaths, fixtureDoc.baseline.harnessDirtyPaths);
});

test('live: the active profile composition matches the frozen bundles', { skip: !available && 'harness tree unavailable' }, () => {
  assert.deepEqual(live.profileBundles, fixtureDoc.baseline.profileBundles);
});

test('live: the dot-named tool token is absent from the frozen fixture catalog', { skip: !available && 'harness tree unavailable' }, () => {
  // The registry accepts dots but provider wire names are constrained; H01 keeps
  // the frozen business names without asserting a provider-side guarantee.
  const read = fixtureDoc.toolCatalog.read;
  assert.ok(read.every((name) => typeof name === 'string' && name.includes('.')));
});

// --- Drift detector negative controls -------------------------------------

test('drift: a changed HEAD is reported', () => {
  const doc = cloneFixture();
  doc.baseline.harnessHead = '0'.repeat(40);
  const result = checkAgainstFixture(live ?? { harnessHead: fixtureDoc.baseline.harnessHead, lockedHashes: {}, missingRequired: [], profileBundles: fixtureDoc.baseline.profileBundles, extensionPoints: [] }, doc);
  assert.equal(result.ok, false);
  assert.match(result.drift.join(' '), /HEAD changed/);
});

test('drift: a changed lockfile digest is reported', () => {
  const doc = cloneFixture();
  doc.baseline.lockedHashes['pnpm-lock.yaml'] = 'f'.repeat(64);
  const synthetic = {
    harnessHead: doc.baseline.harnessHead,
    lockedHashes: { ...fixtureDoc.baseline.lockedHashes, 'pnpm-lock.yaml': 'e'.repeat(64) },
    missingRequired: [],
    profileBundles: fixtureDoc.baseline.profileBundles,
    extensionPoints: [{ id: 'preset-standard', present: true }],
  };
  const result = checkAgainstFixture(synthetic, doc);
  assert.equal(result.ok, false);
  assert.match(result.drift.join(' '), /pnpm-lock\.yaml changed/);
});

test('drift: a missing required extension point is reported', () => {
  const synthetic = {
    harnessHead: fixtureDoc.baseline.harnessHead,
    lockedHashes: fixtureDoc.baseline.lockedHashes,
    missingRequired: ['packages/core/agent-loop/src/agent.ts'],
    profileBundles: fixtureDoc.baseline.profileBundles,
    extensionPoints: [{ id: 'preset-standard', present: true }],
  };
  const result = checkAgainstFixture(synthetic, cloneFixture());
  assert.equal(result.ok, false);
  assert.match(result.drift.join(' '), /required extension points missing/);
});

test('drift: a changed profile bundle list is reported', () => {
  const synthetic = {
    harnessHead: fixtureDoc.baseline.harnessHead,
    lockedHashes: fixtureDoc.baseline.lockedHashes,
    missingRequired: [],
    profileBundles: ['@deepseek-ai/dsh-base'],
    extensionPoints: [{ id: 'preset-standard', present: true }],
  };
  const result = checkAgainstFixture(synthetic, cloneFixture());
  assert.equal(result.ok, false);
  assert.match(result.drift.join(' '), /profile bundles changed/);
});

test('drift: an unreadable profile bundle list is UNVERIFIED, not silently clean', () => {
  const synthetic = {
    harnessHead: fixtureDoc.baseline.harnessHead,
    lockedHashes: fixtureDoc.baseline.lockedHashes,
    missingRequired: [],
    profileBundles: [],
    extensionPoints: [{ id: 'preset-standard', present: true }],
  };
  const result = checkAgainstFixture(synthetic, cloneFixture());
  assert.equal(result.ok, false);
  assert.match(result.drift.join(' '), /UNVERIFIED/);
});

test('a missing harness tree raises a typed IO error', () => {
  assert.throws(
    () => collectInventory('/definitely/not/a/harness/tree'),
    (error) => error.code === 'INVENTORY_IO',
  );
});
