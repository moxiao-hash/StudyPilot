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

  const validEffects = new Set(['READ', 'NAVIGATE', 'WRITE', 'LOCAL']);
  const validRisks = new Set(['NONE', 'LOW', 'HIGH']);
  const validConfModes = new Set(['none', 'always_user_confirmation', 'conditional_scope_grant']);
  const validConfStatuses = new Set(['WAITING_CONFIRMATION', 'WAITING_AUTHORIZATION', null]);
  const validExposures = new Set(['allowed', 'disabled', 'pending']);

  const requiredFields = schema.$defs.manifestToolEntry.required;
  for (const tool of manifest.tools) {
    for (const req of requiredFields) {
      if (!Object.hasOwn(tool, req)) {
        throw new Error(`工具 ${tool.name} 缺少必填字段: ${req}`);
      }
    }

    // 校验类型与枚举
    if (!Number.isInteger(tool.version) || tool.version < 1) {
      throw new Error(`工具 ${tool.name} version 必须是 >= 1 的整数，实际: ${tool.version}`);
    }
    if (!validExposures.has(tool.exposure?.state)) {
      throw new Error(`工具 ${tool.name} exposure.state 枚举非法: ${tool.exposure?.state}`);
    }
    if (!validEffects.has(tool.side_effect?.effect)) {
      throw new Error(`工具 ${tool.name} side_effect.effect 枚举非法: ${tool.side_effect?.effect}`);
    }
    if (!validRisks.has(tool.side_effect?.risk_level)) {
      throw new Error(`工具 ${tool.name} side_effect.risk_level 枚举非法: ${tool.side_effect?.risk_level}`);
    }
    if (!validConfModes.has(tool.confirmation?.mode)) {
      throw new Error(`工具 ${tool.name} confirmation.mode 枚举非法: ${tool.confirmation?.mode}`);
    }
    if (!validConfStatuses.has(tool.confirmation?.waiting_status)) {
      throw new Error(`工具 ${tool.name} confirmation.waiting_status 枚举非法: ${tool.confirmation?.waiting_status}`);
    }
    if (typeof tool.idempotency?.required !== 'boolean') {
      throw new Error(`工具 ${tool.name} idempotency.required 必须是布尔值`);
    }
    if (!Number.isInteger(tool.timeout_ms) || tool.timeout_ms < 1000) {
      throw new Error(`工具 ${tool.name} timeout_ms 必须 >= 1000`);
    }
    if (typeof tool.cost_hint?.local !== 'boolean') {
      throw new Error(`工具 ${tool.name} cost_hint.local 必须是布尔值`);
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
