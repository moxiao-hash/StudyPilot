import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { writeFileSync, unlinkSync, readFileSync } from 'node:fs';
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

test('verifyManifestStructure rejects invalid version type and illegal enum values', () => {
  const manifestPath = resolve('contracts/agent-capabilities/generated/manifest.json');
  const schemaPath = resolve('contracts/agent-capabilities/manifest.schema.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  manifest.tools[0].version = 'invalid_version_string';
  const tmpPath = '/tmp/test-manifest-invalid-ver.json';
  writeFileSync(tmpPath, JSON.stringify(manifest));

  assert.throws(() => {
    verifyManifestStructure(tmpPath, schemaPath);
  }, /version 必须是 >= 1 的整数/);

  manifest.tools[0].version = 1;
  manifest.tools[0].exposure.state = 'ILLEGAL_ENUM';
  writeFileSync(tmpPath, JSON.stringify(manifest));

  assert.throws(() => {
    verifyManifestStructure(tmpPath, schemaPath);
  }, /exposure.state 枚举非法/);

  unlinkSync(tmpPath);
});
