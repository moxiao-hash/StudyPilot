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
  PROFILE_FILES,
  collectLock,
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

/**
 * A synthetic "live" inventory whose digests equal the frozen lock. Drift tests
 * perturb it, so they are deterministic and independent of this machine's tree.
 */
function inventoryFromLock(doc = fixtureDoc) {
  return {
    harnessHead: doc.baseline.harnessHead,
    lockedHashes: { ...doc.baseline.lockedHashes },
    profileBundles: [...doc.baseline.profileBundles],
    missingRequired: [],
    harnessDirtyPaths: [],
    extensionPoints: Object.entries(doc.baseline.extensionPoints).map(([id, sha256]) => ({
      id,
      path: EXTENSION_POINTS.find((entry) => entry.id === id)?.path ?? `unknown/${id}`,
      required: true,
      present: true,
      sha256,
      lines: 1,
      bytes: 1,
    })),
    profileFiles: Object.entries(doc.baseline.profileFiles).map(([id, sha256]) => ({
      id,
      path: PROFILE_FILES.find((entry) => entry.id === id)?.path ?? `unknown/${id}`,
      present: true,
      sha256,
    })),
  };
}

/** Assert the drift check rejects, mentioning `fragment`. */
function assertDrift(inventory, doc, fragment) {
  const result = checkAgainstFixture(inventory, doc);
  assert.equal(result.ok, false, 'expected the drift check to reject');
  const all = [...result.drift, ...(result.unverified ?? [])].join(' | ');
  if (fragment) assert.match(all, fragment, `rejection reason should mention ${fragment}`);
  return result;
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
    extensionPoints: inventoryFromLock().extensionPoints,
    profileFiles: [],
  };
  const result = checkAgainstFixture(synthetic, cloneFixture());
  assert.equal(result.ok, false);
  assert.match([...result.drift, ...result.unverified].join(' '), /UNVERIFIED/);
});

test('a missing harness tree raises a typed IO error', () => {
  assert.throws(
    () => collectInventory('/definitely/not/a/harness/tree'),
    (error) => error.code === 'INVENTORY_IO',
  );
});

// --- R4: frozen mechanism / composition / preset / profile digests ---------

test('the baseline freezes a digest for every necessary mechanism', () => {
  for (const id of [
    'loop-main',
    'loop-tool-calls',
    'loop-inbox',
    'agent-registry',
    'tools-registry',
    'tools-json-schema',
    'system-prompt',
    'compaction-basic',
    'session-persistence-jsonl',
    'session-checkpoint-policy',
    'llm-service',
    'token-meter',
    'user-approval',
    'user-questions',
    'subagent',
    'agent-presets',
    'sdk-server-impl',
    'bundle-base',
    'bundle-web-app',
    'bundle-sdk-app',
    'bundle-sdk-minimal',
    'preset-standard',
  ]) {
    assert.match(fixtureDoc.baseline.extensionPoints[id] ?? '', /^[0-9a-f]{64}$/, `${id} must be frozen as a sha256`);
  }
});

test('the baseline freezes the adopted profile layers as digests only', () => {
  for (const id of ['profile-web-root', 'profile-web-patch', 'profile-web-package', 'profile-desktop-patch']) {
    assert.match(fixtureDoc.baseline.profileFiles[id] ?? '', /^[0-9a-f]{64}$/, `${id} must be frozen as a sha256`);
  }
  const serialized = JSON.stringify(fixtureDoc.baseline);
  // A real API key shape (sk- plus a long opaque tail), never the "ask-user"
  // substring, so the guard cannot false-positive on a tool name.
  assert.doesNotMatch(serialized, /sk-[A-Za-z0-9]{16,}/, 'the frozen baseline must not embed an API key');
  for (const marker of ['apiKeyEnv:', 'baseURL: http', 'BEGIN PRIVATE KEY', 'password=', '"password"']) {
    assert.ok(!serialized.includes(marker), `the frozen baseline must not embed secret-ish content (${marker})`);
  }
});

test('collectLock emits digests only, never file contents', () => {
  const lock = collectLock(inventoryFromLock());
  assert.deepEqual(Object.keys(lock).sort(), ['extensionPoints', 'harnessHead', 'lockedHashes', 'profileBundles', 'profileFiles']);
  for (const hash of Object.values(lock.extensionPoints)) assert.match(hash, /^[0-9a-f]{64}$/);
  for (const hash of Object.values(lock.profileFiles)) assert.match(hash, /^[0-9a-f]{64}$/);
});

test('positive control: an inventory equal to the lock passes', () => {
  const result = checkAgainstFixture(inventoryFromLock(), fixtureDoc);
  assert.equal(result.ok, true, `unexpected drift: ${result.drift.join('; ')}`);
});

test('rejects a changed core loop digest at the same HEAD', () => {
  const inv = inventoryFromLock();
  inv.extensionPoints.find((entry) => entry.id === 'loop-main').sha256 = 'f'.repeat(64);
  assertDrift(inv, fixtureDoc, /mechanism "loop-main" content changed/);
});

test('rejects a changed preset composition digest', () => {
  const inv = inventoryFromLock();
  inv.extensionPoints.find((entry) => entry.id === 'preset-standard').sha256 = 'a'.repeat(64);
  assertDrift(inv, fixtureDoc, /mechanism "preset-standard" content changed/);
});

test('rejects a changed composition patch digest', () => {
  const inv = inventoryFromLock();
  inv.extensionPoints.find((entry) => entry.id === 'bundle-web-app').sha256 = 'b'.repeat(64);
  assertDrift(inv, fixtureDoc, /mechanism "bundle-web-app" content changed/);
});

test('rejects a changed adopted profile-layer digest with unchanged bundles', () => {
  const inv = inventoryFromLock();
  inv.profileFiles.find((entry) => entry.id === 'profile-web-patch').sha256 = 'e'.repeat(64);
  assertDrift(inv, fixtureDoc, /profile layer "profile-web-patch" content changed/);
});

test('rejects a mechanism that disappears from the inventory', () => {
  const inv = inventoryFromLock();
  inv.extensionPoints = inv.extensionPoints.filter((entry) => entry.id !== 'tools-json-schema');
  assertDrift(inv, fixtureDoc, /"tools-json-schema" is absent from the live inventory/);
});

test('rejects a mechanism file that is missing on disk', () => {
  const inv = inventoryFromLock();
  inv.extensionPoints.find((entry) => entry.id === 'compaction-basic').present = false;
  assertDrift(inv, fixtureDoc, /mechanism "compaction-basic" is MISSING/);
});

test('rejects a profile layer that is missing or unreadable', () => {
  const inv = inventoryFromLock();
  inv.profileFiles.find((entry) => entry.id === 'profile-desktop-patch').present = false;
  assertDrift(inv, fixtureDoc, /profile layer "profile-desktop-patch" is MISSING or unreadable/);
});

test('rejects when the profile layers cannot be read at all (UNVERIFIED)', () => {
  const inv = inventoryFromLock();
  inv.profileFiles = [];
  inv.profileBundles = [];
  assertDrift(inv, fixtureDoc, /UNVERIFIED/);
});

test('rejects a live mechanism outside the frozen lock (UNVERIFIED)', () => {
  const inv = inventoryFromLock();
  inv.extensionPoints.push({ id: 'brand-new-mechanism', path: 'packages/x/src/new.ts', required: false, present: true, sha256: 'c'.repeat(64) });
  assertDrift(inv, fixtureDoc, /outside the frozen lock/);
});

test('rejects a locked core path reported modified, without needing a full dirty-list match', () => {
  const inv = inventoryFromLock();
  inv.harnessDirtyPaths = [' M packages/core/agent-loop/src/agent.ts'];
  assertDrift(inv, fixtureDoc, /locked core mechanism path\(s\) appear modified/);
});

test('accepts unrelated untracked working-tree artifacts as non-drift', () => {
  const inv = inventoryFromLock();
  inv.harnessDirtyPaths = ['?? .dsh-artifacts/', '?? _dsh_v4.ts', '?? workspaces/'];
  const result = checkAgainstFixture(inv, fixtureDoc);
  assert.equal(result.ok, true, `unrelated artifacts must not be drift: ${result.drift.join('; ')}`);
});

test('rejects a baseline that freezes no mechanism digests', () => {
  const doc = cloneFixture();
  delete doc.baseline.extensionPoints;
  assertDrift(inventoryFromLock(), doc, /freezes no mechanism digests/);
});

test('rejects a baseline that freezes no profile-layer digests', () => {
  const doc = cloneFixture();
  delete doc.baseline.profileFiles;
  const inv = inventoryFromLock();
  assertDrift(inv, doc, /freezes no profile-layer digests/);
});

test('live: the frozen mechanism and profile digests match this machine (read-only)', { skip: !available && 'harness tree unavailable' }, () => {
  const result = checkAgainstFixture(live, fixtureDoc);
  assert.equal(result.ok, true, `drift: ${result.drift.concat(result.unverified).join('; ')}`);
  const lock = collectLock(live);
  assert.deepEqual(lock.extensionPoints, fixtureDoc.baseline.extensionPoints);
  assert.deepEqual(lock.profileFiles, fixtureDoc.baseline.profileFiles);
});
