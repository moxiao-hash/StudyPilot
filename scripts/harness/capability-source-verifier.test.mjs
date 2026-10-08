import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { verifyManifestStructure } from './capability-source-verifier.mjs';

test('verifyManifestStructure passes on valid compiled manifest', () => {
  const manifestPath = resolve('contracts/agent-capabilities/generated/manifest.json');
  const schemaPath = resolve('contracts/agent-capabilities/manifest.schema.json');
  const res = verifyManifestStructure(manifestPath, schemaPath);
  assert.equal(res.valid, true);
  assert.equal(res.toolCount, 65);
});

test('verifyManifestStructure rejects nonexistent manifest', () => {
  const schemaPath = resolve('contracts/agent-capabilities/manifest.schema.json');
  assert.throws(() => {
    verifyManifestStructure('nonexistent-manifest.json', schemaPath);
  }, /Manifest 不存在/);
});
