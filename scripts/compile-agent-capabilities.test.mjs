import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { compileCapabilities, parseYaml } from './compile-agent-capabilities.mjs';

const baseDescriptorsPath = 'contracts/agent-capabilities/generated/descriptors.json';
const baseMetadataPath = '/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/contracts/agent-capabilities/metadata.yaml';

const baseDescriptors = JSON.parse(readFileSync(baseDescriptorsPath, 'utf8'));
const baseMetadata = parseYaml(baseMetadataPath);

function testMutation(mutate) {
  const d = structuredClone(baseDescriptors);
  const m = structuredClone(baseMetadata);
  mutate(d, m);
  const tmpDesc = `/tmp/test-desc-${Date.now()}-${Math.random().toString(36).slice(2)}.json`;
  const tmpMeta = `/tmp/test-meta-${Date.now()}-${Math.random().toString(36).slice(2)}.yaml`;
  writeFileSync(tmpDesc, JSON.stringify(d));
  writeFileSync(tmpMeta, JSON.stringify(m));
  try {
    return compileCapabilities({ descriptorsPath: tmpDesc, metadataPath: tmpMeta, sourceRoot: '.' });
  } finally {
    if (existsSync(tmpDesc)) unlinkSync(tmpDesc);
    if (existsSync(tmpMeta)) unlinkSync(tmpMeta);
  }
}

const pair = (d, m) => [
  d.find(t => t.name === 'governance.health.get'),
  m.tools.find(t => t.name === 'governance.health.get')
];

test('compiled manifest.json must exist, be deterministically sorted, and contain all 65 tools', async () => {
  const manifestPath = 'contracts/agent-capabilities/generated/manifest.json';
  assert.ok(existsSync(manifestPath), `编译产物必须存在于 ${manifestPath}`);

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  assert.equal(manifest.manifest_version, '1.0-draft');
  assert.equal(typeof manifest.generated_at, 'string');
  assert.equal(manifest.tools.length, 65, 'Manifest 必须包含全部 65 个工具');

  const names = manifest.tools.map(t => t.name);
  const sortedNames = [...names].sort();
  assert.deepEqual(names, sortedNames, 'Manifest 工具必须按 name 严格升序排序');

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
  const fixedTime = '2026-10-08T00:00:00.000Z';
  const res1 = compileCapabilities({ descriptorsPath: baseDescriptorsPath, metadataPath: baseMetadataPath, fixedGeneratedAt: fixedTime });
  const res2 = compileCapabilities({ descriptorsPath: baseDescriptorsPath, metadataPath: baseMetadataPath, fixedGeneratedAt: fixedTime });

  const str1 = JSON.stringify(res1);
  const str2 = JSON.stringify(res2);
  assert.equal(str1, str2, '相同输入与固定时间戳下必须产出完全相同的 JSON 字节');
  assert.equal(res1.sources.descriptors_hash, res2.sources.descriptors_hash);
  assert.equal(res1.sources.metadata_hash, res2.sources.metadata_hash);
});

test('negative: compiler rejects missing descriptors file', () => {
  assert.throws(() => {
    compileCapabilities({
      descriptorsPath: 'nonexistent-descriptors.json',
      metadataPath: baseMetadataPath
    });
  }, /Java 描述符文件不存在/);
});

test('negative: compiler rejects missing metadata file', () => {
  assert.throws(() => {
    compileCapabilities({
      descriptorsPath: baseDescriptorsPath,
      metadataPath: 'nonexistent-metadata-file-test.yaml'
    });
  }, /元数据文件不存在/);
});

test('negative: compiler rejects missing tool in metadata', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      m.tools.splice(0, 1);
    });
  }, /元数据遗漏了已注册工具|元数据遗漏了 Java 源码中已注册的工具/);
});

test('negative: compiler rejects unknown tool in metadata', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const extra = structuredClone(m.tools[0]);
      extra.name = 'unknown.invented.tool';
      m.tools.push(extra);
    });
  }, /元数据包含未在 Java 源码配置中注册的未知工具|元数据包含了未在 Java 注册的未知工具/);
});

test('negative: compiler rejects governance conflict (e.g. HIGH risk with confirmation none)', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const t = m.tools.find(x => x.name === 'artifacts.submit');
      t.confirmation.mode = 'none';
      t.confirmation.waiting_status = null;
    });
  }, /治理冲突: 必须为 always_user_confirmation 与 WAITING_CONFIRMATION/);
});

test('negative: compiler rejects example input carrying forbidden auth/secret fields', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      pair(d, m)[1].examples[0].input.ownerId = 'injected_user';
    });
  }, /被禁止的鉴权|ownerId/);
});

test('negative: compiler rejects ok example missing output field', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const t = m.tools.find(x => x.name === 'learning.context.get');
      const ex = t.examples.find(e => e.outcome === 'ok');
      delete ex.output;
    });
  }, /outcome=ok 时必须提供 output 字段/);
});

test('negative: compiler rejects non-nullable tool having null output for ok example', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const t = m.tools.find(x => x.name === 'learning.context.get');
      const ex = t.examples.find(e => e.outcome === 'ok');
      ex.output = null;
    });
  }, /只有声明为可空的工具才允许输出 null/);
});

test('negative: compiler rejects missing description', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      delete pair(d, m)[1].description;
    });
  }, /缺少非空 description/);
});

test('negative: compiler rejects fictional handler binding', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      pair(d, m)[1].source_provenance.handler = 'NonexistentService.nonexistent';
    });
  }, /来源绑定错误/);
});

test('negative: compiler rejects write tool exposure as allowed', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const t = m.tools.find(x => x.name === 'artifacts.submit');
      t.exposure.state = 'allowed';
    });
  }, /必须禁用，禁止 exposure.state=allowed/);
});

test('negative: compiler rejects coding/runner tool exposure as allowed', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const t = m.tools.find(x => x.name === 'developer.git.status');
      t.exposure.state = 'allowed';
    });
  }, /默认禁用，禁止 exposure.state=allowed/);
});

test('negative: compiler rejects fictional authoritative fact', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      pair(d, m)[1].authoritative_facts.push({ fact: 'inventedField', meaning: 'invented' });
    });
  }, /未在 outputSchema 中存在的权威事实/);
});

test('negative: compiler rejects unknown metadata tool fields', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      pair(d, m)[1].inventedExtraField = 42;
    });
  }, /包含未知字段: inventedExtraField/);
});

test('negative: compiler rejects unknown schema constraint', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      pair(d, m)[0].inputSchema.unknownKeywordConstraint = true;
    });
  }, /Schema 包含未知约束关键字/);
});

test('negative: compiler rejects missing exported handler binding in descriptors', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      delete pair(d, m)[0].handler;
    });
  }, /缺少描述符 handler 绑定/);
});

test('negative: compiler rejects forged handler binding not matching Java source truth', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const [x, y] = pair(d, m);
      x.handler = 'UnregisteredClass.noSuchMethod';
      y.source_provenance.handler = x.handler;
    });
  }, /未在 Java 源码中注册的非法 handler/);
});

test('negative: compiler enforces enum constraint on example values', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const [x, y] = pair(d, m);
      x.inputSchema.properties.level = { type: 'string', enum: ['A'] };
      y.examples[0].input.level = 'B';
    });
  }, /枚举/);
});

test('negative: compiler enforces minimum constraint on example values', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const [x, y] = pair(d, m);
      x.inputSchema.properties.limit = { type: 'integer', minimum: 1 };
      y.examples[0].input.limit = -10;
    });
  }, /最小值|minimum/);
});

test('negative: compiler rejects empty object output when required fields are specified', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const t = m.tools.find(x => x.name === 'learning.context.get');
      const ex = t.examples.find(e => e.outcome === 'ok');
      ex.output = {};
    });
  }, /缺少必填属性/);
});

test('negative: compiler rejects missing cost_hint and exposure', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      delete pair(d, m)[1].cost_hint;
      delete pair(d, m)[1].exposure;
    });
  }, /缺少 cost_hint|缺少 exposure/);
});

test('negative: compiler rejects non-string purpose array items', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      pair(d, m)[1].when_to_use = [42];
    });
  }, /when_to_use 必须是非空字符串数组/);
});

test('negative: compiler rejects unknown nested fields in confirmation', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      pair(d, m)[1].confirmation.unrecognized = true;
    });
  }, /confirmation 包含未知字段/);
});

test('negative: compiler rejects compilation when Java source files are missing', () => {
  assert.throws(() => {
    compileCapabilities({
      descriptorsPath: baseDescriptorsPath,
      metadataPath: baseMetadataPath,
      sourceRoot: '/tmp'
    });
  }, /缺少 Java 源码/);
});

test('negative: compiler rejects unknown jointly added tool not in Java real registration set', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const [x, y] = pair(d, m);
      const a = structuredClone(x), b = structuredClone(y);
      a.name = b.name = 'imaginary.query.get';
      a.handler = b.source_provenance.handler = 'ImaginaryLearningService.computeEverything';
      d.push(a);
      m.tools.push(b);
    });
  }, /未在 Java 源码配置中注册/);
});

test('negative: compiler rejects fake method on navigation.resolve even if class matches', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const x = d.find(t => t.name === 'navigation.resolve');
      const y = m.tools.find(t => t.name === x.name);
      x.handler = y.source_provenance.handler = 'NavigationToolHandler.imaginaryMethod';
    });
  }, /未在 Java 源码中注册的非法 handler/);
});

test('negative: compiler rejects scalar placeholder string violating type or constraint', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const [x, y] = pair(d, m);
      x.inputSchema.properties.limit = { type: 'integer', minimum: 1 };
      y.examples[0].input.limit = '<shape-placeholder>';
    });
  }, /值类型不匹配.*期望 integer/);
});

test('negative: compiler enforces oneOf constraint on examples', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const [x, y] = pair(d, m);
      x.inputSchema.properties.limit = { oneOf: [{ type: 'integer' }] };
      y.examples[0].input.limit = 'bad-integer';
    });
  }, /oneOf/);
});

test('negative: compiler enforces uniqueItems constraint on examples', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const [x, y] = pair(d, m);
      x.inputSchema.properties.tags = { type: 'array', uniqueItems: true, items: { type: 'string' } };
      y.examples[0].input.tags = ['a', 'a'];
    });
  }, /uniqueItems|重复/);
});

test('negative: compiler rejects example missing outcome field', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      delete pair(d, m)[1].examples[0].outcome;
    });
  }, /缺少或包含非法的 outcome/);
});

test('negative: compiler rejects invalid external_dependency type in cost_hint', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      pair(d, m)[1].cost_hint.external_dependency = { not: 'string' };
    });
  }, /cost_hint.external_dependency 必须是字符串或 null/);
});

test('negative: compiler rejects not constraint violation in example input', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const [x, y] = pair(d, m);
      x.inputSchema.properties.n = { type: 'integer', not: { const: 1 } };
      y.examples[0].input.n = 1;
    });
  }, /值违反 not 约束/);
});

test('negative: compiler rejects conditional if-then constraint violation in example input', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const [x, y] = pair(d, m);
      x.inputSchema.properties.n = { type: 'integer', if: { const: 1 }, then: { minimum: 2 } };
      y.examples[0].input.n = 1;
    });
  }, /数值低于最小值.*then/);
});

test('negative: compiler rejects boolean schema false for property when provided', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      const [x, y] = pair(d, m);
      x.inputSchema.properties.n = false;
      y.examples[0].input.n = 1;
    });
  }, /Schema 为 false，任何值均不允许/);
});

test('negative: compiler rejects omission of registered tool even if descriptors and metadata both omit it', () => {
  assert.throws(() => {
    testMutation((d, m) => {
      d.splice(d.findIndex(t => t.name === 'governance.health.get'), 1);
      m.tools.splice(m.tools.findIndex(t => t.name === 'governance.health.get'), 1);
    });
  }, /描述符遗漏了 Java 源码中已注册的工具/);
});

test('negative: compiler fails closed when manifest.schema.json is missing', () => {
  const tmpRoot = `/tmp/fake-source-root-noschema-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  mkdirSync(join(tmpRoot, 'backend/src/main/java/com/moxiao/studypilot/agent/tool'), { recursive: true });
  ['AgentReadToolConfiguration.java', 'AgentWriteToolConfiguration.java', 'NavigationToolHandler.java', 'AgentToolOutputSchemas.java'].forEach(f => {
    writeFileSync(join(tmpRoot, 'backend/src/main/java/com/moxiao/studypilot/agent/tool', f),
      readFileSync(join('backend/src/main/java/com/moxiao/studypilot/agent/tool', f)));
  });
  execFileSync('git', ['init'], { cwd: tmpRoot });
  execFileSync('git', ['config', 'user.name', 'test'], { cwd: tmpRoot });
  execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpRoot });
  execFileSync('git', ['commit', '-m', 'init', '--allow-empty'], { cwd: tmpRoot });

  try {
    assert.throws(() => {
      compileCapabilities({ descriptorsPath: baseDescriptorsPath, metadataPath: baseMetadataPath, sourceRoot: tmpRoot });
    }, /manifest\.schema\.json.*不存在/);
  } finally {
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});
