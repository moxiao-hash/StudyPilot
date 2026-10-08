#!/usr/bin/env node

/**
 * scripts/compile-agent-capabilities.mjs
 *
 * 确定性编译器：合并 Java 真实导出的描述符 (descriptors.json) 与元数据 (metadata.yaml)，
 * 编译生成 contracts/agent-capabilities/generated/manifest.json。
 *
 * 依赖说明：
 * - 纯 Node.js 内置模块（使用 python3 原生解析 yaml，无需安装第三方 npm yaml 包）。
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

export function compileCapabilities({
  descriptorsPath,
  metadataPath,
  outputPath,
  fixedGeneratedAt = null
}) {
  if (!existsSync(descriptorsPath)) {
    throw new Error(`Java 描述符文件不存在: ${descriptorsPath}`);
  }
  if (!existsSync(metadataPath)) {
    throw new Error(`元数据文件不存在: ${metadataPath}`);
  }

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

  // 3. 逐个合并与治理校验
  const compiledTools = [];
  const forbiddenKeys = ['ownerId', 'apiKey', 'secret', 'password', 'token', 'authorization'];

  for (const name of [...descriptorMap.keys()].sort()) {
    const d = descriptorMap.get(name);
    const m = metadataMap.get(name);

    // 治理校验：确认机制与 Java 事实一致性
    const risk = d.riskLevel;
    const effect = d.effect;
    const conf = m.confirmation;

    if (!conf || typeof conf !== 'object') {
      throw new Error(`工具 ${name} 缺少 confirmation 治理定义`);
    }

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

    // 示例安全检查与输出字段存在性检查
    const isNullable = Array.isArray(d.outputSchema?.type) && d.outputSchema.type.includes("null");
    if (Array.isArray(m.examples)) {
      for (const ex of m.examples) {
        for (const fk of forbiddenKeys) {
          if (ex.input && Object.hasOwn(ex.input, fk)) {
            throw new Error(`工具 ${name} 示例输入包含被禁止的鉴权字段: ${fk}`);
          }
        }
        if (ex.outcome === "ok") {
          if (!Object.hasOwn(ex, "output")) {
            throw new Error(`工具 ${name} 示例 ${ex.name || ""} 缺少 output 字段: outcome=ok 时必须提供 output 字段`);
          }
          if (ex.output === null && !isNullable) {
            throw new Error(`工具 ${name} 示例 ${ex.name || ""} 非法输出 null: 只有声明为可空的工具才允许输出 null`);
          }
        }
      }
    }
    if (Array.isArray(m.examples)) {
      for (const ex of m.examples) {
        for (const fk of forbiddenKeys) {
          if (ex.input && Object.hasOwn(ex.input, fk)) {
            throw new Error(`工具 ${name} 示例输入包含被禁止的鉴权字段: ${fk}`);
          }
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
      examples: Array.isArray(m.examples) ? m.examples : [],
      source_provenance: {
        registration: m.source_provenance?.registration || '',
        handler: m.source_provenance?.handler || '',
        output_schema: m.source_provenance?.output_schema || ''
      }
    };

    compiledTools.push(toolEntry);
  }

  const manifest = {
    manifest_version: '1.0-draft',
    generated_at: fixedGeneratedAt || new Date().toISOString(),
    sources: {
      descriptor_count: compiledTools.length,
      descriptors_hash: descriptorsHash,
      metadata_hash: metadataHash
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
    const descriptorsPath = resolve('contracts/agent-capabilities/generated/descriptors.json');
    // 默认查找本树，若本树没有则查找 deepseek H02 树
    let metadataPath = resolve('contracts/agent-capabilities/metadata.yaml');
    if (!existsSync(metadataPath)) {
      const fallback = resolve('/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/contracts/agent-capabilities/metadata.yaml');
      if (existsSync(fallback)) {
        metadataPath = fallback;
      }
    }
    const outputPath = resolve('contracts/agent-capabilities/generated/manifest.json');

    console.log(`[COMPILE] 编译输入:`);
    console.log(`  - 描述符: ${descriptorsPath}`);
    console.log(`  - 元数据: ${metadataPath}`);
    console.log(`  - 输出目标: ${outputPath}`);

    const res = compileCapabilities({
      descriptorsPath,
      metadataPath,
      outputPath
    });

    console.log(`[SUCCESS] 成功编译 Capability Manifest，共 ${res.tools.length} 个工具。`);
  } catch (err) {
    console.error(`[ERROR] 编译失败: ${err.message}`);
    process.exit(1);
  }
}
