#!/usr/bin/env node

/**
 * scripts/harness/capability-source-verifier.mjs
 *
 * 完整校验 Capability Manifest 及其工具条目对 manifest.schema.json 的完整合规性。
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function validateSchema(schema, data, path = '$', rootSchema = schema) {
  if (!schema || typeof schema !== 'object') return;

  // 处理 $ref
  if (schema.$ref) {
    const refPath = schema.$ref.replace(/^#\//, '').split('/');
    let target = rootSchema;
    for (const seg of refPath) {
      target = target?.[seg];
    }
    if (!target) {
      throw new Error(`无法解析 Schema 引用: ${schema.$ref}`);
    }
    validateSchema(target, data, path, rootSchema);
    return;
  }

  // enum 约束
  if (Array.isArray(schema.enum)) {
    if (!schema.enum.includes(data)) {
      if (path.endsWith('.exposure.state')) {
        throw new Error(`工具 ${path} exposure.state 枚举非法: ${data}`);
      }
      throw new Error(`枚举值非法: ${path} 值 ${JSON.stringify(data)} 不在允许列表 [${schema.enum.join(', ')}] 中`);
    }
  }

  // const 约束
  if (schema.const !== undefined && data !== schema.const) {
    throw new Error(`常量值不匹配: ${path} 期望 ${JSON.stringify(schema.const)}，实际 ${JSON.stringify(data)}`);
  }

  const expectedType = schema.type;
  if (expectedType) {
    if (Array.isArray(expectedType)) {
      if (data === null && expectedType.includes('null')) return;
      const nonNullType = expectedType.find(t => t !== 'null');
      if (nonNullType) {
        validateSchema({ ...schema, type: nonNullType }, data, path, rootSchema);
      }
      return;
    }

    if (expectedType === 'object') {
      if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error(`类型错误: ${path} 期望 object，实际 ${typeof data}`);
      }

      if (schema.additionalProperties === false) {
        const allowedProps = new Set(Object.keys(schema.properties || {}));
        for (const k of Object.keys(data)) {
          if (!allowedProps.has(k)) {
            throw new Error(`未声明属性: ${path} 包含未允许属性 "${k}"`);
          }
        }
      }

      if (Array.isArray(schema.required)) {
        for (const req of schema.required) {
          if (!Object.hasOwn(data, req)) {
            throw new Error(`缺少必填属性: ${path}.${req}`);
          }
        }
      }

      if (schema.properties) {
        for (const [k, propSchema] of Object.entries(schema.properties)) {
          if (Object.hasOwn(data, k)) {
            validateSchema(propSchema, data[k], `${path}.${k}`, rootSchema);
          }
        }
      }
    } else if (expectedType === 'array') {
      if (!Array.isArray(data)) {
        throw new Error(`类型错误: ${path} 期望 array，实际 ${typeof data}`);
      }
      if (schema.minItems !== undefined && data.length < schema.minItems) {
        throw new Error(`数组项数过少: ${path} 期望至少 ${schema.minItems} 项，实际 ${data.length}`);
      }
      if (schema.maxItems !== undefined && data.length > schema.maxItems) {
        throw new Error(`数组项数过多: ${path} 期望最多 ${schema.maxItems} 项，实际 ${data.length}`);
      }
      if (schema.items) {
        data.forEach((item, idx) => {
          validateSchema(schema.items, item, `${path}[${idx}]`, rootSchema);
        });
      }
    } else if (expectedType === 'string') {
      if (typeof data !== 'string') {
        throw new Error(`类型错误: ${path} 期望 string，实际 ${typeof data}`);
      }
      if (schema.minLength !== undefined && data.length < schema.minLength) {
        throw new Error(`字符串长度不足: ${path} 期望长度 >= ${schema.minLength}`);
      }
      if (schema.maxLength !== undefined && data.length > schema.maxLength) {
        throw new Error(`字符串长度超出: ${path} 期望长度 <= ${schema.maxLength}`);
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
        throw new Error(`正则匹配失败: ${path} 模式 "${schema.pattern}"，实际 "${data}"`);
      }
    } else if (expectedType === 'integer') {
      if (!Number.isInteger(data)) {
        if (path.endsWith('.version')) {
          throw new Error(`工具 ${path} version 必须是 >= 1 的整数，实际: ${data}`);
        }
        throw new Error(`类型错误: ${path} 期望 integer，实际 ${typeof data} (${data})`);
      }
      if (schema.minimum !== undefined && data < schema.minimum) {
        if (path.endsWith('.version')) {
          throw new Error(`工具 ${path} version 必须是 >= 1 的整数，实际: ${data}`);
        }
        throw new Error(`数值过小: ${path} 期望 >= ${schema.minimum}，实际 ${data}`);
      }
      if (schema.maximum !== undefined && data > schema.maximum) {
        throw new Error(`数值过大: ${path} 期望 <= ${schema.maximum}，实际 ${data}`);
      }
    } else if (expectedType === 'number') {
      if (typeof data !== 'number') {
        throw new Error(`类型错误: ${path} 期望 number，实际 ${typeof data}`);
      }
      if (schema.minimum !== undefined && data < schema.minimum) {
        throw new Error(`数值过小: ${path} 期望 >= ${schema.minimum}，实际 ${data}`);
      }
    } else if (expectedType === 'boolean') {
      if (typeof data !== 'boolean') {
        throw new Error(`类型错误: ${path} 期望 boolean，实际 ${typeof data}`);
      }
    }
  }
}

export function verifyManifestStructure(manifestPath, schemaPath) {
  if (!existsSync(manifestPath)) throw new Error(`Manifest 不存在: ${manifestPath}`);
  if (!existsSync(schemaPath)) throw new Error(`Schema 不存在: ${schemaPath}`);

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));

  // 执行完整根级及递归子模式校验
  validateSchema(schema, manifest, '$', schema);

  if (manifest.tools.length !== 65) {
    throw new Error(`tools 必须为恰好 65 个工具，实际: ${manifest.tools?.length}`);
  }

  // 严格验证 tools 按 name 升序排序
  for (let i = 1; i < manifest.tools.length; i++) {
    if (manifest.tools[i].name <= manifest.tools[i - 1].name) {
      throw new Error(`tools 数组必须按 name 严格升序排序: 索引 ${i - 1} "${manifest.tools[i - 1].name}" >= "${manifest.tools[i].name}"`);
    }
  }

  return { valid: true, toolCount: manifest.tools.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const manifestPath = resolve('contracts/agent-capabilities/generated/manifest.json');
    const schemaPath = resolve('contracts/agent-capabilities/manifest.schema.json');
    const res = verifyManifestStructure(manifestPath, schemaPath);
    console.log(`[SUCCESS] Manifest 完整 Schema 深度校验通过，全部 ${res.toolCount} 个工具结构合规！`);
  } catch (err) {
    console.error(`[ERROR] 校验失败: ${err.message}`);
    process.exit(1);
  }
}
