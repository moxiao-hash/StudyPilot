import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { compileCapabilities } from './compile-agent-capabilities.mjs';

test('compiled manifest.json must exist, be deterministically sorted, and contain all 65 tools', async () => {
  const manifestPath = 'contracts/agent-capabilities/generated/manifest.json';
  assert.ok(existsSync(manifestPath), `编译产物必须存在于 ${manifestPath}`);

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.manifest_version, '1.0-draft');
  assert.equal(typeof manifest.generated_at, 'string');
  assert.equal(manifest.tools.length, 65, 'Manifest 必须包含全部 65 个工具');

  // 必须是确定性排序（按 name 升序）
  const names = manifest.tools.map(t => t.name);
  const sortedNames = [...names].sort();
  assert.deepEqual(names, sortedNames, 'Manifest 工具必须按 name 严格升序排序');

  // 每项必须包含完整契约字段
  for (const t of manifest.tools) {
    assert.ok(t.name, 'name 必须存在');
    assert.ok(t.version >= 1, 'version 必须 >= 1');
    assert.ok(t.category, 'category 必须存在');
    assert.ok(t.description, 'description 必须存在');
    assert.ok(Array.isArray(t.when_to_use) && t.when_to_use.length >= 1, 'when_to_use 必须有内容');
    assert.ok(Array.isArray(t.when_not_to_use) && t.when_not_to_use.length >= 1, 'when_not_to_use 必须有内容');
    assert.ok(typeof t.input_schema === 'object', 'input_schema 必须是对象');
    assert.ok(typeof t.output_schema === 'object', 'output_schema 必须是对象');
    assert.ok(['READ', 'NAVIGATE', 'WRITE', 'LOCAL'].includes(t.side_effect.effect), 'side_effect.effect 合法');
    assert.ok(['NONE', 'LOW', 'HIGH'].includes(t.side_effect.risk_level), 'side_effect.risk_level 合法');
    assert.ok(['none', 'always_user_confirmation', 'conditional_scope_grant'].includes(t.confirmation.mode), 'confirmation.mode 合法');
    assert.ok(typeof t.idempotency.required === 'boolean', 'idempotency.required 必须是布尔值');
    assert.ok(t.timeout_ms >= 1000, 'timeout_ms >= 1000');
    assert.ok(Array.isArray(t.error_contract) && t.error_contract.length >= 1, 'error_contract 必须有内容');
    assert.ok(typeof t.cost_hint.local === 'boolean', 'cost_hint.local 必须是布尔值');
    assert.ok(['allowed', 'disabled', 'pending'].includes(t.exposure.state), 'exposure.state 合法');
    assert.ok(Array.isArray(t.examples) && t.examples.length >= 1, 'examples 必须至少 1 个');
    assert.ok(t.source_provenance.registration, 'source_provenance.registration 必须存在');
    assert.ok(t.source_provenance.handler, 'source_provenance.handler 必须存在');
    assert.ok(t.source_provenance.output_schema, 'source_provenance.output_schema 必须存在');
  }
});

test('compiler must be deterministic: identical inputs yield identical bytes and hashes', () => {
  const descriptorsPath = 'contracts/agent-capabilities/generated/descriptors.json';
  const metadataPath = '/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/contracts/agent-capabilities/metadata.yaml';

  const fixedTime = '2026-10-08T00:00:00.000Z';
  const res1 = compileCapabilities({ descriptorsPath, metadataPath, fixedGeneratedAt: fixedTime });
  const res2 = compileCapabilities({ descriptorsPath, metadataPath, fixedGeneratedAt: fixedTime });

  const str1 = JSON.stringify(res1);
  const str2 = JSON.stringify(res2);
  assert.equal(str1, str2, '相同输入与固定时间戳下必须产出完全相同的 JSON 字节');
  assert.equal(res1.sources.descriptors_hash, res2.sources.descriptors_hash);
  assert.equal(res1.sources.metadata_hash, res2.sources.metadata_hash);
});

test('negative: compiler rejects missing descriptors file', () => {
  const metadataPath = '/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/contracts/agent-capabilities/metadata.yaml';
  assert.throws(() => {
    compileCapabilities({
      descriptorsPath: 'nonexistent-descriptors.json',
      metadataPath
    });
  }, /Java 描述符文件不存在/);
});

test('negative: compiler rejects missing metadata file', () => {
  const descriptorsPath = 'contracts/agent-capabilities/generated/descriptors.json';
  assert.throws(() => {
    compileCapabilities({
      descriptorsPath,
      metadataPath: 'nonexistent-metadata-file-test.yaml'
    });
  }, /元数据文件不存在/);
});

test('negative: compiler rejects missing tool in metadata', () => {
  const descriptors = [{
    name: 'test.tool_a',
    version: 1,
    category: 'TEST',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    timeoutMillis: 5000
  }, {
    name: 'test.tool_b',
    version: 1,
    category: 'TEST',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    timeoutMillis: 5000
  }];
  const metadata = {
    tools: [{
      name: 'test.tool_a',
      description: 'a',
      when_to_use: ['a'],
      when_not_to_use: ['a'],
      error_contract: ['a'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'a' },
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'r', handler: 'h', output_schema: 'o' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };

  const tmpDesc = '/tmp/test-desc-miss.json';
  const tmpMeta = '/tmp/test-meta-miss.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));

  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /元数据遗漏了已注册工具/);

  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects unknown tool in metadata', () => {
  const descriptors = [{
    name: 'test.tool_a',
    version: 1,
    category: 'TEST',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    timeoutMillis: 5000
  }];
  const metadata = {
    tools: [{
      name: 'test.tool_a',
      description: 'a',
      when_to_use: ['a'],
      when_not_to_use: ['a'],
      error_contract: ['a'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'a' },
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'r', handler: 'h', output_schema: 'o' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }, {
      name: 'test.fictional_tool',
      description: 'f',
      when_to_use: ['f'],
      when_not_to_use: ['f'],
      error_contract: ['f'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'f' },
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'r', handler: 'h', output_schema: 'o' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };

  const tmpDesc = '/tmp/test-desc-unk.json';
  const tmpMeta = '/tmp/test-meta-unk.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));

  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /元数据包含了未在 Java 注册的未知工具/);

  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects governance conflict (e.g. HIGH risk with confirmation none)', () => {
  const descriptors = [{
    name: 'test.high_risk_tool',
    version: 1,
    category: 'TEST',
    effect: 'WRITE',
    riskLevel: 'HIGH',
    requiredScope: 'TEST_SCOPE',
    idempotencyRequired: true,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    timeoutMillis: 10000
  }];
  const metadata = {
    tools: [{
      name: 'test.high_risk_tool',
      description: 'test',
      when_to_use: ['test'],
      when_not_to_use: ['test'],
      error_contract: ['test'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'disabled', reason: 'test' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'hand', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };

  const tmpDesc = '/tmp/test-desc-gov.json';
  const tmpMeta = '/tmp/test-meta-gov.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));

  assert.throws(() => {
    compileCapabilities({
      descriptorsPath: tmpDesc,
      metadataPath: tmpMeta
    });
  }, /治理冲突: 必须为 always_user_confirmation 与 WAITING_CONFIRMATION/);

  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects example input carrying forbidden auth/secret fields', () => {
  const descriptors = [{
    name: 'test.forbidden_fields_tool',
    version: 1,
    category: 'TEST',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    timeoutMillis: 10000
  }];
  const metadata = {
    tools: [{
      name: 'test.forbidden_fields_tool',
      description: 'test',
      when_to_use: ['test'],
      when_not_to_use: ['test'],
      error_contract: ['test'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'test' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: { ownerId: 'injected_user' }, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'hand', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };

  const tmpDesc = '/tmp/test-desc-sec.json';
  const tmpMeta = '/tmp/test-meta-sec.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));

  assert.throws(() => {
    compileCapabilities({
      descriptorsPath: tmpDesc,
      metadataPath: tmpMeta
    });
  }, /示例输入包含被禁止的鉴权字段: ownerId/);

  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects ok example missing output field', () => {
  const descriptors = [{
    name: 'test.missing_output_tool',
    version: 1,
    category: 'TEST',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    timeoutMillis: 10000
  }];
  const metadata = {
    tools: [{
      name: 'test.missing_output_tool',
      description: 'test',
      when_to_use: ['test'],
      when_not_to_use: ['test'],
      error_contract: ['test'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'test' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok' }], // 缺失 output 字段
      source_provenance: { registration: 'reg', handler: 'hand', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };

  const tmpDesc = '/tmp/test-desc-noout.json';
  const tmpMeta = '/tmp/test-meta-noout.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));

  assert.throws(() => {
    compileCapabilities({
      descriptorsPath: tmpDesc,
      metadataPath: tmpMeta
    });
  }, /outcome=ok 时必须提供 output 字段/);

  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects non-nullable tool having null output for ok example', () => {
  const descriptors = [{
    name: 'test.non_nullable_tool',
    version: 1,
    category: 'TEST',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' }, // 非 nullable
    timeoutMillis: 10000
  }];
  const metadata = {
    tools: [{
      name: 'test.non_nullable_tool',
      description: 'test',
      when_to_use: ['test'],
      when_not_to_use: ['test'],
      error_contract: ['test'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'test' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: null }], // 错误声明为 null
      source_provenance: { registration: 'reg', handler: 'hand', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };

  const tmpDesc = '/tmp/test-desc-nullout.json';
  const tmpMeta = '/tmp/test-meta-nullout.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));

  assert.throws(() => {
    compileCapabilities({
      descriptorsPath: tmpDesc,
      metadataPath: tmpMeta
    });
  }, /只有声明为可空的工具才允许输出 null/);

  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});
