#!/usr/bin/env node

/**
 * scripts/harness/capability-source-verifier.mjs
 *
 * 校验 Capability Manifest 及导出描述符与契约规范。
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function verifyManifestStructure(manifestPath, schemaPath) {
  if (!existsSync(manifestPath)) throw new Error(`Manifest 不存在: ${manifestPath}`);
  if (!existsSync(schemaPath)) throw new Error(`Schema 不存在: ${schemaPath}`);

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

  if (manifest.manifest_version !== '1.0-draft') {
    throw new Error(`manifest_version 必须为 1.0-draft，实际: ${manifest.manifest_version}`);
  }
  if (!Array.isArray(manifest.tools) || manifest.tools.length !== 65) {
    throw new Error(`tools 必须为恰好 65 个工具，实际: ${manifest.tools?.length}`);
  }

  // 校验每个工具是否包含 manifestToolEntry 的所有必填字段
  const requiredFields = schema.$defs.manifestToolEntry.required;
  for (const tool of manifest.tools) {
    for (const req of requiredFields) {
      if (!Object.hasOwn(tool, req)) {
        throw new Error(`工具 ${tool.name} 缺少必填字段: ${req}`);
      }
    }
    // 校验未定义字段
    const allowed = new Set(Object.keys(schema.$defs.manifestToolEntry.properties));
    for (const key of Object.keys(tool)) {
      if (!allowed.has(key)) {
        throw new Error(`工具 ${tool.name} 包含未允许字段: ${key}`);
      }
    }
  }

  return { valid: true, toolCount: manifest.tools.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const manifestPath = resolve('contracts/agent-capabilities/generated/manifest.json');
    const schemaPath = resolve('contracts/agent-capabilities/manifest.schema.json');
    const res = verifyManifestStructure(manifestPath, schemaPath);
    console.log(`[SUCCESS] Manifest 校验通过，全部 ${res.toolCount} 个工具结构合规！`);
  } catch (err) {
    console.error(`[ERROR] 校验失败: ${err.message}`);
    process.exit(1);
  }
}
