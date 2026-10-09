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
    timeoutMillis: 5000,
    handler: 'TestService.testMethod'
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
    timeoutMillis: 5000,
    handler: 'TestService.testMethod'
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
    timeoutMillis: 5000,
    handler: 'TestService.testMethod'
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
    name: 'artifacts.submit',
    version: 1,
    category: 'WORKSPACE',
    effect: 'WRITE',
    riskLevel: 'HIGH',
    requiredScope: 'WORKSPACE_MANAGEMENT',
    idempotencyRequired: true,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    timeoutMillis: 10000,
    handler: 'RoadmapArtifactService.submit'
  }];
  const metadata = {
    tools: [{
      name: 'artifacts.submit',
      description: 'submit',
      when_to_use: ['submit'],
      when_not_to_use: ['submit'],
      error_contract: ['submit'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'disabled', reason: 'submit' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'RoadmapArtifactService.submit', output_schema: 'out' },
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
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    timeoutMillis: 10000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: { ownerId: 'injected_user' }, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
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
  }, /被禁止的鉴权|ownerId/);

  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects ok example missing output field', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    timeoutMillis: 10000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok' }], // 缺失 output 字段
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
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
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' }, // 非 nullable
    timeoutMillis: 10000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: null }], // 错误声明为 null
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
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


test('negative: compiler rejects missing description', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    timeoutMillis: 10000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      // missing description
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'test' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-nodesc.json';
  const tmpMeta = '/tmp/test-meta-nodesc.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /缺少非空 description/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects fictional handler binding', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    timeoutMillis: 10000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'test' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'NonexistentService.nonexistent', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-fict.json';
  const tmpMeta = '/tmp/test-meta-fict.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /来源绑定错误/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects write tool exposure as allowed', () => {
  const descriptors = [{
    name: 'artifacts.submit',
    version: 1,
    category: 'WORKSPACE',
    effect: 'WRITE',
    riskLevel: 'HIGH',
    requiredScope: 'WORKSPACE_MANAGEMENT',
    idempotencyRequired: true,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    timeoutMillis: 10000,
    handler: 'RoadmapArtifactService.submit'
  }];
  const metadata = {
    tools: [{
      name: 'artifacts.submit',
      description: 'submit',
      when_to_use: ['submit'],
      when_not_to_use: ['submit'],
      error_contract: ['submit'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'allow' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'RoadmapArtifactService.submit', output_schema: 'out' },
      confirmation: { mode: 'always_user_confirmation', waiting_status: 'WAITING_CONFIRMATION', notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-write.json';
  const tmpMeta = '/tmp/test-meta-write.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /必须禁用，禁止 exposure.state=allowed/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects coding/runner tool exposure as allowed', () => {
  const descriptors = [{
    name: 'developer.git.status',
    version: 1,
    category: 'DEVELOPER',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    timeoutMillis: 10000,
    handler: 'WorkspaceDeveloperService.getGitStatus'
  }];
  const metadata = {
    tools: [{
      name: 'developer.git.status',
      description: 'test',
      when_to_use: ['test'],
      when_not_to_use: ['test'],
      error_contract: ['test'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'allow' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'WorkspaceDeveloperService.getGitStatus', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-coding.json';
  const tmpMeta = '/tmp/test-meta-coding.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /默认禁用，禁止 exposure.state=allowed/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects fictional authoritative fact', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object', properties: { totalExecutions: { type: 'integer' } } },
    timeoutMillis: 10000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'allow' },
      authoritative_facts: [{ fact: 'fictionalField', meaning: 'invented' }],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: { totalExecutions: 1 } }],
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-fact.json';
  const tmpMeta = '/tmp/test-meta-fact.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /未在 outputSchema 中存在的权威事实/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects unknown metadata tool fields', () => {
  const descriptors = [{
    name: 'test.unknown_field_tool',
    version: 1,
    category: 'TEST',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object' },
    outputSchema: { type: 'object' },
    timeoutMillis: 10000,
    handler: 'TestService.testMethod'
  }];
  const metadata = {
    tools: [{
      name: 'test.unknown_field_tool',
      description: 'test',
      when_to_use: ['test'],
      when_not_to_use: ['test'],
      error_contract: ['test'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'allow' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'TestService.testMethod', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' },
      inventedExtraField: 42
    }]
  };
  const tmpDesc = '/tmp/test-desc-unkf.json';
  const tmpMeta = '/tmp/test-meta-unkf.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /包含未知字段: inventedExtraField/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects unknown schema constraint', () => {
  const descriptors = [{
    name: 'test.unknown_constraint_tool',
    version: 1,
    category: 'TEST',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', unknownKeywordConstraint: true },
    outputSchema: { type: 'object' },
    timeoutMillis: 10000,
    handler: 'TestService.testMethod'
  }];
  const metadata = {
    tools: [{
      name: 'test.unknown_constraint_tool',
      description: 'test',
      when_to_use: ['test'],
      when_not_to_use: ['test'],
      error_contract: ['test'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'allow' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'TestService.testMethod', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-unkc.json';
  const tmpMeta = '/tmp/test-meta-unkc.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /Schema 包含未知约束关键字/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects missing exported handler binding in descriptors', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    timeoutMillis: 5000
    // no handler field
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-nohandler.json';
  const tmpMeta = '/tmp/test-meta-nohandler.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /缺少.*handler.*绑定/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects forged handler binding not matching Java source truth', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    timeoutMillis: 5000,
    handler: 'UnregisteredClass.noSuchMethod'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'UnregisteredClass.noSuchMethod', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-forged.json';
  const tmpMeta = '/tmp/test-meta-forged.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /未在 Java 源码中声明|非法 handler|未注册/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler enforces enum constraint on example values', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: { level: { type: 'string', enum: ['A'] } } },
    outputSchema: { type: 'object', properties: {} },
    timeoutMillis: 5000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: { level: 'B' }, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-enum.json';
  const tmpMeta = '/tmp/test-meta-enum.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /枚举/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler enforces minimum constraint on example values', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1 } } },
    outputSchema: { type: 'object', properties: {} },
    timeoutMillis: 5000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: { limit: -10 }, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-min.json';
  const tmpMeta = '/tmp/test-meta-min.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /最小值|minimum/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects empty object output when required fields are specified', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'] },
    timeoutMillis: 5000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', fixture_kind: 'shape_placeholder', output: {} }],
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-reqout.json';
  const tmpMeta = '/tmp/test-meta-reqout.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /缺少必填属性/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects missing cost_hint and exposure', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    timeoutMillis: 5000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      // cost_hint missing
      // exposure missing
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-nocost.json';
  const tmpMeta = '/tmp/test-meta-nocost.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /缺少 cost_hint|缺少 exposure/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects non-string purpose array items', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    timeoutMillis: 5000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: [42],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-nonstr.json';
  const tmpMeta = '/tmp/test-meta-nonstr.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /when_to_use.*字符串/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects unknown nested fields in confirmation', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    timeoutMillis: 5000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '', unrecognized: true }
    }]
  };
  const tmpDesc = '/tmp/test-desc-unknest.json';
  const tmpMeta = '/tmp/test-meta-unknest.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /confirmation 包含未知字段/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects compilation when Java source files are missing', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    timeoutMillis: 5000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-nosrc.json';
  const tmpMeta = '/tmp/test-meta-nosrc.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta, sourceRoot: '/tmp' });
  }, /缺少 Java 源码/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects unknown jointly added tool not in Java real registration set', () => {
  const descriptors = [{
    name: 'imaginary.query.get',
    version: 1,
    category: 'IMAGINARY',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    timeoutMillis: 5000,
    handler: 'ImaginaryLearningService.computeEverything'
  }];
  const metadata = {
    tools: [{
      name: 'imaginary.query.get',
      description: 'imaginary',
      when_to_use: ['imaginary'],
      when_not_to_use: ['imaginary'],
      error_contract: ['imaginary'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'imaginary' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'ImaginaryLearningService.computeEverything', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-jointunk.json';
  const tmpMeta = '/tmp/test-meta-jointunk.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /未在 Java 源码配置中注册|非法.*工具|未注册/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects fake method on navigation.resolve even if class matches', () => {
  const descriptors = [{
    name: 'navigation.resolve',
    version: 1,
    category: 'NAVIGATION',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    timeoutMillis: 5000,
    handler: 'NavigationToolHandler.imaginaryMethod'
  }];
  const metadata = {
    tools: [{
      name: 'navigation.resolve',
      description: 'nav',
      when_to_use: ['nav'],
      when_not_to_use: ['nav'],
      error_contract: ['nav'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'nav' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'NavigationToolHandler.imaginaryMethod', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-navfake.json';
  const tmpMeta = '/tmp/test-meta-navfake.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /来源绑定错误|声明了未在 Java 源码中注册的非法 handler/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects scalar placeholder string violating type or constraint', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: { limit: { type: 'integer', minimum: 1 } } },
    outputSchema: { type: 'object', properties: {} },
    timeoutMillis: 5000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: { limit: '<shape-placeholder>' }, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-scalpl.json';
  const tmpMeta = '/tmp/test-meta-scalpl.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /值类型不匹配|期望 integer/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler enforces oneOf constraint on examples', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: { limit: { oneOf: [{ type: 'integer' }] } } },
    outputSchema: { type: 'object', properties: {} },
    timeoutMillis: 5000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: { limit: 'bad-integer' }, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-oneof.json';
  const tmpMeta = '/tmp/test-meta-oneof.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /oneOf/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler enforces uniqueItems constraint on examples', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: { tags: { type: 'array', uniqueItems: true, items: { type: 'string' } } } },
    outputSchema: { type: 'object', properties: {} },
    timeoutMillis: 5000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: { tags: ['a', 'a'] }, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-uniq.json';
  const tmpMeta = '/tmp/test-meta-uniq.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /uniqueItems|重复/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects example missing outcome field', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    timeoutMillis: 5000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: null, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp' }], // 缺少 outcome
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-nooutcome.json';
  const tmpMeta = '/tmp/test-meta-nooutcome.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /缺少或包含非法的 outcome/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});

test('negative: compiler rejects invalid external_dependency type in cost_hint', () => {
  const descriptors = [{
    name: 'governance.health.get',
    version: 1,
    category: 'GOVERNANCE',
    effect: 'READ',
    riskLevel: 'NONE',
    requiredScope: null,
    idempotencyRequired: false,
    inputSchema: { type: 'object', properties: {} },
    outputSchema: { type: 'object', properties: {} },
    timeoutMillis: 5000,
    handler: 'AssistantHealthService.summarize'
  }];
  const metadata = {
    tools: [{
      name: 'governance.health.get',
      description: 'health',
      when_to_use: ['health'],
      when_not_to_use: ['health'],
      error_contract: ['health'],
      cost_hint: { local: true, external_dependency: { not: 'string' }, notes: '' },
      exposure: { state: 'allowed', reason: 'health' },
      authoritative_facts: [],
      examples: [{ name: 'ex', input: {}, expect: 'exp', outcome: 'ok', output: {} }],
      source_provenance: { registration: 'reg', handler: 'AssistantHealthService.summarize', output_schema: 'out' },
      confirmation: { mode: 'none', waiting_status: null, notes: '' }
    }]
  };
  const tmpDesc = '/tmp/test-desc-badcosttype.json';
  const tmpMeta = '/tmp/test-meta-badcosttype.yaml';
  writeFileSync(tmpDesc, JSON.stringify(descriptors));
  writeFileSync(tmpMeta, JSON.stringify(metadata));
  assert.throws(() => {
    compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta });
  }, /external_dependency.*字符串或 null/);
  unlinkSync(tmpDesc);
  unlinkSync(tmpMeta);
});
