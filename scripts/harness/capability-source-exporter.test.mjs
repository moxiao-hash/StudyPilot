import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('Java descriptors export output must exist and be valid', () => {
  const targetPath = 'contracts/agent-capabilities/generated/descriptors.json';
  assert.ok(existsSync(targetPath), `导出的 descriptors.json 必须存在于 ${targetPath}`);
  const content = JSON.parse(readFileSync(targetPath, 'utf8'));
  assert.equal(Array.isArray(content), true, 'descriptors.json 必须是工具描述符数组');
  assert.equal(content.length, 65, `必须包含全部 65 个 Java 真实注册工具，当前: ${content.length}`);
});
