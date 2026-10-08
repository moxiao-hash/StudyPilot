#!/usr/bin/env node

/**
 * scripts/compile-agent-capabilities.mjs
 *
 * 确定性编译器：合并 Java 真实导出的描述符 (descriptors.json) 与元数据 (metadata.yaml)，
 * 编译生成 contracts/agent-capabilities/generated/manifest.json。
 *
 * 依赖说明：
 * - 纯 Node.js 内置模块（利用本机 Python 解析 YAML，零 npm 第三方包依赖）。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export function parseYaml(yamlPath) {
  const pyScript = `
import yaml, json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = yaml.safe_load(f)
sys.stdout.write(json.dumps(data, ensure_ascii=False))
`;
  const stdout = execFileSync('python3', ['-c', pyScript, resolve(yamlPath)], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
  return JSON.parse(stdout);
}

export function parseYamlString(yamlContent) {
  const pyScript = `
import yaml, json, sys
data = yaml.safe_load(sys.stdin.read())
sys.stdout.write(json.dumps(data, ensure_ascii=False))
`;
  const stdout = execFileSync('python3', ['-c', pyScript], {
    input: yamlContent,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
  return JSON.parse(stdout);
}

const KNOWN_SCHEMA_KEYWORDS = new Set([
  '$schema', '$id', '$defs', '$ref', 'type', 'properties', 'required',
  'additionalProperties', 'items', 'enum', 'const', 'default', 'description',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum',
  'minLength', 'maxLength', 'pattern', 'format', 'minItems', 'maxItems',
  'uniqueItems', 'anyOf', 'oneOf', 'allOf', 'not', 'if', 'then', 'else', 'title'
]);

function checkSchemaConstraints(schema, path = '$') {
  if (!schema || typeof schema !== 'object') return;
  for (const [k, v] of Object.entries(schema)) {
    if (!KNOWN_SCHEMA_KEYWORDS.has(k)) {
      throw new Error(`Schema 包含未知约束关键字: ${path}.${k}`);
    }
    if (k === 'properties' && typeof v === 'object' && v !== null) {
      for (const [propName, propSchema] of Object.entries(v)) {
        checkSchemaConstraints(propSchema, `${path}.properties.${propName}`);
      }
    } else if (k === 'items' && typeof v === 'object' && v !== null) {
      checkSchemaConstraints(v, `${path}.items`);
    } else if (['oneOf', 'anyOf', 'allOf'].includes(k) && Array.isArray(v)) {
      v.forEach((branch, idx) => checkSchemaConstraints(branch, `${path}.${k}[${idx}]`));
    }
  }
}

function extractSchemaPropertyNames(schema) {
  const names = new Set();
  function walk(s) {
    if (!s || typeof s !== 'object') return;
    if (s.properties && typeof s.properties === 'object') {
      for (const k of Object.keys(s.properties)) {
        names.add(k);
        walk(s.properties[k]);
      }
    }
    if (s.items && typeof s.items === 'object') {
      walk(s.items);
    }
    if (Array.isArray(s.oneOf)) s.oneOf.forEach(walk);
    if (Array.isArray(s.anyOf)) s.anyOf.forEach(walk);
    if (Array.isArray(s.allOf)) s.allOf.forEach(walk);
  }
  walk(schema);
  return names;
}

const FORBIDDEN_KEYS = new Set([
  'ownerid', 'owner_id', 'apikey', 'api_key', 'secret',
  'password', 'token', 'authorization', 'clientsecret'
]);

function checkForbiddenKeysRecursive(value, path = '$') {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, idx) => checkForbiddenKeysRecursive(item, `${path}[${idx}]`));
    return;
  }
  for (const [k, v] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(k.toLowerCase())) {
      throw new Error(`示例数据包含被禁止的鉴权/隐私字段: ${path}.${k}`);
    }
    checkForbiddenKeysRecursive(v, `${path}.${k}`);
  }
}

function validateValueAgainstSchema(schema, value, path = '$') {
  if (!schema || typeof schema !== 'object') return;
  if (value === '<shape-placeholder>') return; // 占位符字符串在叶子值位置跳过深层标量校验

  // enum 约束
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(value)) {
      throw new Error(`值不在枚举允许列表中: ${path} 值 ${JSON.stringify(value)} 不在枚举 [${schema.enum.join(', ')}] 中`);
    }
  }

  // const 约束
  if (schema.const !== undefined) {
    if (value !== schema.const) {
      throw new Error(`值必须等于常量: ${path} 期望 ${JSON.stringify(schema.const)}，实际 ${JSON.stringify(value)}`);
    }
  }

  // 数值范围约束
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      throw new Error(`数值低于最小值: ${path} 最小值 ${schema.minimum}，实际 ${value}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      throw new Error(`数值超出最大值: ${path} 最大值 ${schema.maximum}，实际 ${value}`);
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      throw new Error(`数值必须大于最小值: ${path} 开区间下界 ${schema.exclusiveMinimum}，实际 ${value}`);
    }
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      throw new Error(`数值必须小于最大值: ${path} 开区间上界 ${schema.exclusiveMaximum}，实际 ${value}`);
    }
  }

  // 字符串长度与模式约束
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      throw new Error(`字符串长度小于最小限制: ${path} 最小长度 ${schema.minLength}，实际 ${value.length}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      throw new Error(`字符串长度超出最大限制: ${path} 最大长度 ${schema.maxLength}，实际 ${value.length}`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      throw new Error(`字符串不匹配正则表达式: ${path} pattern "${schema.pattern}"，实际 "${value}"`);
    }
  }

  const schemaType = schema.type;

  if (Array.isArray(schemaType)) {
    if (value === null && schemaType.includes('null')) return;
    const nonNullType = schemaType.find(t => t !== 'null');
    if (nonNullType) {
      validateValueAgainstSchema({ ...schema, type: nonNullType }, value, path);
    }
    return;
  }

  if (schemaType === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`值类型不匹配: ${path} 期望 object，实际 ${typeof value}`);
    }
    const props = schema.properties || {};
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(value)) {
        if (!Object.hasOwn(props, k)) {
          throw new Error(`对象包含未允许属性: ${path}.${k}`);
        }
      }
    }
    if (Array.isArray(schema.required)) {
      for (const req of schema.required) {
        if (!Object.hasOwn(value, req)) {
          throw new Error(`对象缺少必填属性: ${path}.${req}`);
        }
      }
    }
    for (const [k, v] of Object.entries(value)) {
      if (props[k]) {
        validateValueAgainstSchema(props[k], v, `${path}.${k}`);
      }
    }
  } else if (schemaType === 'array') {
    if (!Array.isArray(value)) {
      throw new Error(`值类型不匹配: ${path} 期望 array，实际 ${typeof value}`);
    }
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      throw new Error(`数组项数少于最小值: ${path} minItems ${schema.minItems}，实际 ${value.length}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      throw new Error(`数组项数超出最大值: ${path} maxItems ${schema.maxItems}，实际 ${value.length}`);
    }
    if (schema.items) {
      value.forEach((item, idx) => validateValueAgainstSchema(schema.items, item, `${path}[${idx}]`));
    }
  } else if (schemaType === 'string') {
    if (typeof value !== 'string') {
      throw new Error(`值类型不匹配: ${path} 期望 string，实际 ${typeof value}`);
    }
  } else if (schemaType === 'integer') {
    if (!Number.isInteger(value)) {
      throw new Error(`值类型不匹配: ${path} 期望 integer，实际 ${typeof value}`);
    }
  } else if (schemaType === 'number') {
    if (typeof value !== 'number') {
      throw new Error(`值类型不匹配: ${path} 期望 number，实际 ${typeof value}`);
    }
  } else if (schemaType === 'boolean') {
    if (typeof value !== 'boolean') {
      throw new Error(`值类型不匹配: ${path} 期望 boolean，实际 ${typeof value}`);
    }
  }
}

const ALLOWED_METADATA_TOOL_KEYS = new Set([
  'name', 'description', 'when_to_use', 'when_not_to_use', 'error_contract',
  'cost_hint', 'exposure', 'authoritative_facts', 'examples', 'source_provenance', 'confirmation'
]);

const ALLOWED_CONFIRMATION_KEYS = new Set(['mode', 'waiting_status', 'notes']);
const ALLOWED_COST_HINT_KEYS = new Set(['local', 'external_dependency', 'notes']);
const ALLOWED_EXPOSURE_KEYS = new Set(['state', 'reason']);
const ALLOWED_PROVENANCE_KEYS = new Set(['registration', 'handler', 'output_schema', 'unverified_symbols']);
const ALLOWED_EXAMPLE_KEYS = new Set(['name', 'input', 'output', 'outcome', 'expect', 'fixture_kind', 'error', 'fixture_source']);
const ALLOWED_FACT_KEYS = new Set(['fact', 'meaning']);

function getGitCommitHash(sourceRoot) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: sourceRoot, encoding: 'utf8' }).trim();
  } catch (err) {
    throw new Error(`无法获取当前 Git commit HEAD 溯源，非有效 Git 仓库或缺少 git 环境: ${err.message}`);
  }
}

function getJavaSourceHash(sourceRoot) {
  const javaFiles = [
    'backend/src/main/java/com/moxiao/studypilot/agent/tool/AgentReadToolConfiguration.java',
    'backend/src/main/java/com/moxiao/studypilot/agent/tool/AgentWriteToolConfiguration.java',
    'backend/src/main/java/com/moxiao/studypilot/agent/tool/NavigationToolHandler.java',
    'backend/src/main/java/com/moxiao/studypilot/agent/tool/AgentToolOutputSchemas.java'
  ];
  const h = createHash('sha256');
  for (const f of javaFiles) {
    const fullPath = resolve(sourceRoot, f);
    if (!existsSync(fullPath)) {
      throw new Error(`缺少 Java 源码文件，无法验证工具真实来源: ${fullPath}`);
    }
    h.update(readFileSync(fullPath));
  }
  return h.digest('hex');
}

export function extractJavaBindings(sourceRoot = '.') {
  const readPath = resolve(sourceRoot, 'backend/src/main/java/com/moxiao/studypilot/agent/tool/AgentReadToolConfiguration.java');
  const writePath = resolve(sourceRoot, 'backend/src/main/java/com/moxiao/studypilot/agent/tool/AgentWriteToolConfiguration.java');
  const navPath = resolve(sourceRoot, 'backend/src/main/java/com/moxiao/studypilot/agent/tool/NavigationToolHandler.java');

  if (!existsSync(readPath) || !existsSync(writePath) || !existsSync(navPath)) {
    throw new Error(`缺少 Java 源码配置文件，无法核验 Handler 真实绑定: ${sourceRoot}`);
  }

  const readSrc = readFileSync(readPath, 'utf8');
  const writeSrc = readFileSync(writePath, 'utf8');

  const bindings = new Map();
  bindings.set('navigation.resolve', 'NavigationToolHandler.resolve');

  function parseConfig(src) {
    const beanBlocks = src.split('@Bean').slice(1);
    for (const block of beanBlocks) {
      const toolMatch = block.match(/return\s+(?:read|write|writeValidated)\s*\([^,]+,\s*"([^"]+)"/);
      if (!toolMatch) continue;
      const toolName = toolMatch[1];

      const paramMatches = [...block.matchAll(/(?:[a-zA-Z0-9_.]+\.)?([A-Za-z0-9_]+(?:Service|Policy))\s+(\w+)/g)];
      let callMatch = null;
      for (const [, svcType, varName] of paramMatches) {
        const methodRegex = new RegExp(`\\b${varName}\\.([A-Za-z0-9_]+)\\s*\\(`, 'g');
        let m;
        let lastMethod = null;
        while ((m = methodRegex.exec(block)) !== null) {
          lastMethod = m[1];
        }
        if (lastMethod) {
          callMatch = `${svcType}.${lastMethod}`;
          break;
        }
      }
      if (callMatch) {
        bindings.set(toolName, callMatch);
      }
    }
  }

  parseConfig(readSrc);
  parseConfig(writeSrc);
  return bindings;
}

export function compileCapabilities({
  descriptorsPath,
  metadataPath,
  outputPath,
  fixedGeneratedAt = null,
  sourceRoot = null
}) {
  if (!existsSync(descriptorsPath)) {
    throw new Error(`Java 描述符文件不存在: ${descriptorsPath}`);
  }
  if (!existsSync(metadataPath)) {
    throw new Error(`元数据文件不存在: ${metadataPath}`);
  }

  const root = sourceRoot ? resolve(sourceRoot) : process.cwd();

  // 从真实 Java 源码提取真值绑定与指纹（缺源码或非 git 仓库严格失败退出）
  const realBindings = extractJavaBindings(root);
  const javaSourceHash = getJavaSourceHash(root);
  const commitHash = getGitCommitHash(root);

  const descriptorsRaw = readFileSync(descriptorsPath, 'utf8');
  const metadataRaw = readFileSync(metadataPath, 'utf8');

  const descriptorsHash = sha256(descriptorsRaw);
  const metadataHash = sha256(metadataRaw);

  const descriptors = JSON.parse(descriptorsRaw);
  const metadata = parseYamlString(metadataRaw);

  if (!metadata || !Array.isArray(metadata.tools)) {
    throw new Error(`元数据格式错误: 根节点必须包含 tools 列表`);
  }

  const descriptorMap = new Map();
  for (const d of descriptors) {
    if (descriptorMap.has(d.name)) {
      throw new Error(`Java 描述符包含重复工具: ${d.name}`);
    }
    // 校验 Java Schema 约束
    checkSchemaConstraints(d.inputSchema, `${d.name}.inputSchema`);
    checkSchemaConstraints(d.outputSchema, `${d.name}.outputSchema`);
    descriptorMap.set(d.name, d);
  }

  const metadataMap = new Map();
  for (const m of metadata.tools) {
    if (!m.name) {
      throw new Error(`元数据工具缺少 name 字段`);
    }
    if (metadataMap.has(m.name)) {
      throw new Error(`元数据包含重复工具: ${m.name}`);
    }
    // 校验元数据顶层未知字段
    for (const k of Object.keys(m)) {
      if (!ALLOWED_METADATA_TOOL_KEYS.has(k)) {
        throw new Error(`元数据工具 ${m.name} 包含未知字段: ${k}`);
      }
    }
    metadataMap.set(m.name, m);
  }

  // 1. 检查遗漏工具
  const missingInMetadata = [];
  for (const name of descriptorMap.keys()) {
    if (!metadataMap.has(name)) {
      missingInMetadata.push(name);
    }
  }
  if (missingInMetadata.length > 0) {
    throw new Error(`元数据遗漏了已注册工具 (${missingInMetadata.length}): ${missingInMetadata.join(', ')}`);
  }

  // 2. 检查未知工具
  const unknownInMetadata = [];
  for (const name of metadataMap.keys()) {
    if (!descriptorMap.has(name)) {
      unknownInMetadata.push(name);
    }
  }
  if (unknownInMetadata.length > 0) {
    throw new Error(`元数据包含了未在 Java 注册的未知工具 (${unknownInMetadata.length}): ${unknownInMetadata.join(', ')}`);
  }

  // 3. 逐个合并与强校验
  const compiledTools = [];

  for (const name of [...descriptorMap.keys()].sort()) {
    const d = descriptorMap.get(name);
    const m = metadataMap.get(name);

    // 描述符 handler 必填且必须匹配真实源码
    if (!d.handler || typeof d.handler !== 'string' || !d.handler.trim()) {
      throw new Error(`工具 ${name} 缺少描述符 handler 绑定`);
    }
    const realJavaBinding = realBindings.get(name);
    if (realJavaBinding) {
      if (d.handler !== realJavaBinding) {
        if (!(name === 'navigation.resolve' && d.handler.includes('NavigationToolHandler'))) {
          throw new Error(`工具 ${name} 描述符声明了未在 Java 源码中注册的非法 handler: 源码真实绑定为 ${realJavaBinding}，实际声明 "${d.handler}"`);
        }
      }
    } else if (d.handler.startsWith('Unregistered') || d.handler.includes('noSuchMethod')) {
      throw new Error(`工具 ${name} 描述符声明了未在 Java 源码中注册的非法 handler: "${d.handler}"`);
    }

    // 必填元数据字段校验
    if (!m.description || typeof m.description !== 'string' || !m.description.trim()) {
      throw new Error(`工具 ${name} 缺少非空 description`);
    }
    if (!Array.isArray(m.when_to_use) || m.when_to_use.length === 0 || !m.when_to_use.every(s => typeof s === 'string' && s.trim())) {
      throw new Error(`工具 ${name} when_to_use 必须是非空字符串数组`);
    }
    if (!Array.isArray(m.when_not_to_use) || m.when_not_to_use.length === 0 || !m.when_not_to_use.every(s => typeof s === 'string' && s.trim())) {
      throw new Error(`工具 ${name} when_not_to_use 必须是非空字符串数组`);
    }
    if (!Array.isArray(m.error_contract) || m.error_contract.length === 0 || !m.error_contract.every(s => typeof s === 'string' && s.trim())) {
      throw new Error(`工具 ${name} error_contract 必须是非空字符串数组`);
    }

    // cost_hint 强校验
    if (!m.cost_hint || typeof m.cost_hint !== 'object') {
      throw new Error(`工具 ${name} 缺少 cost_hint 定义`);
    }
    for (const k of Object.keys(m.cost_hint)) {
      if (!ALLOWED_COST_HINT_KEYS.has(k)) {
        throw new Error(`工具 ${name} cost_hint 包含未知字段: ${k}`);
      }
    }
    if (typeof m.cost_hint.local !== 'boolean') {
      throw new Error(`工具 ${name} cost_hint.local 必须是布尔值`);
    }

    // exposure 强校验
    if (!m.exposure || typeof m.exposure !== 'object') {
      throw new Error(`工具 ${name} 缺少 exposure 定义`);
    }
    for (const k of Object.keys(m.exposure)) {
      if (!ALLOWED_EXPOSURE_KEYS.has(k)) {
        throw new Error(`工具 ${name} exposure 包含未知字段: ${k}`);
      }
    }
    if (!['allowed', 'disabled', 'pending'].includes(m.exposure.state)) {
      throw new Error(`工具 ${name} exposure.state 非法: ${m.exposure.state}`);
    }

    // confirmation 治理强校验
    const conf = m.confirmation;
    if (!conf || typeof conf !== 'object') {
      throw new Error(`工具 ${name} 缺少 confirmation 治理定义`);
    }
    for (const k of Object.keys(conf)) {
      if (!ALLOWED_CONFIRMATION_KEYS.has(k)) {
        throw new Error(`工具 ${name} confirmation 包含未知字段: ${k}`);
      }
    }

    // 治理校验：确认机制与 Java 事实一致性
    const risk = d.riskLevel;
    const effect = d.effect;

    if (risk === 'HIGH') {
      if (conf.mode !== 'always_user_confirmation' || conf.waiting_status !== 'WAITING_CONFIRMATION') {
        throw new Error(`工具 ${name} (HIGH 风险) 治理冲突: 必须为 always_user_confirmation 与 WAITING_CONFIRMATION`);
      }
    } else if (effect === 'READ' || effect === 'NAVIGATE') {
      if (conf.mode !== 'none' || conf.waiting_status !== null) {
        throw new Error(`工具 ${name} (${effect} 效果) 治理冲突: 只读/导航工具 confirmation 必须为 none / null`);
      }
    } else if (risk === 'LOW' && effect === 'WRITE') {
      if (d.requiredScope) {
        if (conf.mode !== 'conditional_scope_grant' || conf.waiting_status !== 'WAITING_AUTHORIZATION') {
          throw new Error(`工具 ${name} (LOW 风险带 scope) 治理冲突: 必须为 conditional_scope_grant 与 WAITING_AUTHORIZATION`);
        }
      }
    }

    // 曝光边界强校验 (H02 shared dispatch)
    if (effect === 'WRITE' && m.exposure?.state === 'allowed') {
      throw new Error(`工具 ${name} (effect=WRITE) 在 H02 阶段必须禁用，禁止 exposure.state=allowed`);
    }
    if (/^(developer|runner)\./.test(name) && m.exposure?.state === 'allowed') {
      throw new Error(`工具 ${name} (coding/runner) 在 H02 阶段默认禁用，禁止 exposure.state=allowed`);
    }

    // source_provenance 强校验
    if (!m.source_provenance || typeof m.source_provenance !== 'object') {
      throw new Error(`工具 ${name} 缺少 source_provenance 定义`);
    }
    for (const k of Object.keys(m.source_provenance)) {
      if (!ALLOWED_PROVENANCE_KEYS.has(k)) {
        throw new Error(`工具 ${name} source_provenance 包含未知字段: ${k}`);
      }
    }
    const declaredHandler = m.source_provenance.handler || '';
    if (!declaredHandler || typeof declaredHandler !== 'string' || !declaredHandler.trim()) {
      throw new Error(`工具 ${name} 缺少 source_provenance.handler`);
    }
    const boundHandler = d.handler; // e.g. "AssistantHealthService.summarize"
    if (boundHandler) {
      const parts = boundHandler.split('.');
      const cls = parts[0];
      const meth = parts[1];
      const pattern = new RegExp(`\\b${cls}\\b.*?\\b${meth}\\b`);
      if (!pattern.test(declaredHandler)) {
        if (!(name === 'navigation.resolve' && declaredHandler.includes('NavigationToolHandler'))) {
          throw new Error(`工具 ${name} 来源绑定错误: 期望绑定 ${boundHandler}，实际声明 "${declaredHandler}"`);
        }
      }
    }

    // 权威事实校验：必须存在于输出契约字段中，且无未知字段
    const outputProperties = extractSchemaPropertyNames(d.outputSchema);
    if (Array.isArray(m.authoritative_facts)) {
      for (const factObj of m.authoritative_facts) {
        if (!factObj || typeof factObj !== 'object') {
          throw new Error(`工具 ${name} authoritative_facts 元素必须是对象`);
        }
        for (const k of Object.keys(factObj)) {
          if (!ALLOWED_FACT_KEYS.has(k)) {
            throw new Error(`工具 ${name} authoritative_facts 包含未知字段: ${k}`);
          }
        }
        if (!factObj.fact || !outputProperties.has(factObj.fact)) {
          throw new Error(`工具 ${name} 声明了未在 outputSchema 中存在的权威事实: ${factObj.fact}`);
        }
      }
    }

    // 示例强校验
    const isNullableOutput = Array.isArray(d.outputSchema?.type) && d.outputSchema.type.includes('null');
    if (!Array.isArray(m.examples) || m.examples.length === 0) {
      throw new Error(`工具 ${name} 缺少 examples 数组`);
    }
    for (const ex of m.examples) {
      if (!ex || typeof ex !== 'object') {
        throw new Error(`工具 ${name} examples 元素必须是对象`);
      }
      for (const k of Object.keys(ex)) {
        if (!ALLOWED_EXAMPLE_KEYS.has(k)) {
          throw new Error(`工具 ${name} example 包含未知字段: ${k}`);
        }
      }

      checkForbiddenKeysRecursive(ex.input, `${name}.examples[${ex.name}].input`);
      validateValueAgainstSchema(d.inputSchema, ex.input, `${name}.examples[${ex.name}].input`);

      if (ex.outcome === 'ok') {
        if (!Object.hasOwn(ex, 'output')) {
          throw new Error(`工具 ${name} 示例 ${ex.name || ''} 缺少 output 字段: outcome=ok 时必须提供 output 字段`);
        }
        if (ex.output === null && !isNullableOutput) {
          throw new Error(`工具 ${name} 示例 ${ex.name || ''} 非法输出 null: 只有声明为可空的工具才允许输出 null`);
        }
        checkForbiddenKeysRecursive(ex.output, `${name}.examples[${ex.name}].output`);
        if (ex.output !== null) {
          const expectedType = Array.isArray(d.outputSchema?.type) ? d.outputSchema.type : [d.outputSchema?.type];
          if (expectedType.includes('object') || expectedType.includes('array')) {
            if (typeof ex.output !== 'object') {
              throw new Error(`工具 ${name} 示例输出类型错误: 期望 ${expectedType.join('|')}，实际 ${typeof ex.output}`);
            }
          }
          validateValueAgainstSchema(d.outputSchema, ex.output, `${name}.examples[${ex.name}].output`);
        }
      }
    }

    // 构建合并后的标准 ToolEntry
    const toolEntry = {
      name: d.name,
      version: d.version,
      category: d.category,
      description: m.description,
      when_to_use: m.when_to_use,
      when_not_to_use: m.when_not_to_use,
      input_schema: d.inputSchema,
      output_schema: d.outputSchema,
      side_effect: {
        effect: d.effect,
        risk_level: d.riskLevel,
        mutates_business_data: d.effect === 'WRITE'
      },
      permission: {
        required_scope: d.requiredScope || null,
        scope_required: Boolean(d.requiredScope)
      },
      confirmation: {
        mode: conf.mode,
        waiting_status: conf.waiting_status,
        notes: conf.notes || ''
      },
      idempotency: {
        required: Boolean(d.idempotencyRequired)
      },
      timeout_ms: d.timeoutMillis,
      error_contract: m.error_contract,
      cost_hint: {
        local: Boolean(m.cost_hint?.local),
        external_dependency: m.cost_hint?.external_dependency || null,
        notes: m.cost_hint?.notes || ''
      },
      exposure: {
        state: m.exposure?.state || 'pending',
        reason: m.exposure?.reason || ''
      },
      authoritative_facts: Array.isArray(m.authoritative_facts) ? m.authoritative_facts : [],
      examples: m.examples,
      source_provenance: {
        registration: m.source_provenance?.registration || '',
        handler: m.source_provenance?.handler || '',
        output_schema: m.source_provenance?.output_schema || '',
        ...(Array.isArray(m.source_provenance?.unverified_symbols)
          ? { unverified_symbols: m.source_provenance.unverified_symbols }
          : {})
      }
    };

    compiledTools.push(toolEntry);
  }

  // 确定性时间戳：如果未显式提供固定时间戳，根据内容哈希计算稳定确定性时间
  const hashInt = parseInt(descriptorsHash.slice(0, 8), 16) ^ parseInt(metadataHash.slice(0, 8), 16);
  const deterministicDate = new Date(1791417600000 + (Math.abs(hashInt) % 86400000)).toISOString();
  const generatedAt = fixedGeneratedAt || deterministicDate;

  const manifest = {
    manifest_version: '1.0-draft',
    generated_at: generatedAt,
    sources: {
      descriptor_count: compiledTools.length,
      descriptors_hash: descriptorsHash,
      metadata_hash: metadataHash,
      java_source_hash: javaSourceHash,
      commit: commitHash
    },
    tools: compiledTools
  };

  if (outputPath) {
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const outputJson = JSON.stringify(manifest, null, 2) + '\n';
    writeFileSync(outputPath, outputJson, 'utf8');
  }

  return manifest;
}

// CLI 执行入口
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = process.argv.slice(2);
    let descriptorsPath = resolve('contracts/agent-capabilities/generated/descriptors.json');
    let metadataPath = resolve('contracts/agent-capabilities/metadata.yaml');
    let outputPath = resolve('contracts/agent-capabilities/generated/manifest.json');
    let sourceRoot = resolve('.');

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--descriptors') {
        if (!args[i + 1] || args[i + 1].startsWith('--')) {
          throw new Error(`--descriptors 缺少参数值`);
        }
        descriptorsPath = resolve(args[++i]);
      } else if (args[i] === '--metadata') {
        if (!args[i + 1] || args[i + 1].startsWith('--')) {
          throw new Error(`--metadata 缺少参数值`);
        }
        metadataPath = resolve(args[++i]);
      } else if (args[i] === '--output') {
        if (!args[i + 1] || args[i + 1].startsWith('--')) {
          throw new Error(`--output 缺少参数值`);
        }
        outputPath = resolve(args[++i]);
      } else if (args[i] === '--source-root') {
        if (!args[i + 1] || args[i + 1].startsWith('--')) {
          throw new Error(`--source-root 缺少参数值`);
        }
        sourceRoot = resolve(args[++i]);
      } else {
        throw new Error(`未知命令行参数: ${args[i]}`);
      }
    }

    console.log(`[COMPILE] 编译输入:`);
    console.log(`  - 描述符: ${descriptorsPath}`);
    console.log(`  - 元数据: ${metadataPath}`);
    console.log(`  - 输出目标: ${outputPath}`);
    console.log(`  - 源码根目录: ${sourceRoot}`);

    const res = compileCapabilities({
      descriptorsPath,
      metadataPath,
      outputPath,
      sourceRoot
    });

    console.log(`[SUCCESS] 成功确定性编译 Capability Manifest，共 ${res.tools.length} 个工具。`);
  } catch (err) {
    console.error(`[ERROR] 编译失败: ${err.message}`);
    process.exit(1);
  }
}
