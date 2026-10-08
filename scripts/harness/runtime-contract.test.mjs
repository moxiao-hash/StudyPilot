/**
 * H01：Runtime 契约离线验证。
 *
 * 目标：用离线有效/无效实例证明
 *   1. schema 能拒绝额外字段与错误类型；
 *   2. 标识一致性、终态与重连边界被真实检查（schema 表达不了的用 INVARIANT_* 规则）；
 *   3. 契约本身与 Harness 兼容：任何位置都不得出现 `type: [T, "null"]` 类型数组，
 *      且所有 object 必须封闭（additionalProperties: false）。
 *
 * 依赖：仅 Node 内置模块，无网络、无第三方包、不启动服务、不调用模型。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  loadContract,
  validateMessage,
  validateScenario,
  findTypeArrays,
  findOpenObjects,
} from './runtime-contract.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(
  readFileSync(join(here, 'runtime-contract.fixtures.json'), 'utf8'),
);

const contract = loadContract();

test('contract declares a draft protocol version and is structurally closed', () => {
  assert.equal(typeof contract.$id, 'string');
  assert.ok(contract.$defs, '契约必须使用 $defs 组织定义');

  const typeArrays = findTypeArrays(contract);
  assert.deepEqual(
    typeArrays,
    [],
    `契约不得使用类型数组（Harness 不支持）: ${typeArrays.join(', ')}`,
  );

  const openObjects = findOpenObjects(contract);
  assert.deepEqual(
    openObjects,
    [],
    `所有 object 必须 additionalProperties:false，发现: ${openObjects.join(', ')}`,
  );
});

for (const positive of fixtures.validMessages) {
  test(`valid message accepted: ${positive.name}`, () => {
    const result = validateMessage(contract, positive.message);
    assert.equal(result.ok, true, `期望通过，实际: ${result.errors.join('; ')}`);
  });
}

for (const positive of fixtures.validScenarios) {
  test(`valid scenario accepted: ${positive.name}`, () => {
    const result = validateScenario(contract, positive.messages);
    assert.equal(result.ok, true, `期望通过，实际: ${result.errors.join('; ')}`);
  });
}

for (const negative of fixtures.invalidMessages) {
  test(`invalid message rejected: ${negative.name}`, () => {
    const result = validateMessage(contract, negative.message);
    assert.equal(result.ok, false, '无效实例必须被拒绝');
    assert.ok(
      result.errors.some((error) => error.startsWith(negative.rule)),
      `期望规则 ${negative.rule}，实际: ${result.errors.join('; ')}`,
    );
  });
}

for (const negative of fixtures.invalidScenarios) {
  test(`invalid scenario rejected: ${negative.name}`, () => {
    const result = validateScenario(contract, negative.messages);
    assert.equal(result.ok, false, '无效场景必须被拒绝');
    assert.ok(
      result.errors.some((error) => error.startsWith(negative.rule)),
      `期望规则 ${negative.rule}，实际: ${result.errors.join('; ')}`,
    );
  });
}

test('every operation, event type and response status has a valid instance', () => {
  const pickConst = (prefix, field) => {
    const values = new Set();
    for (const [name, def] of Object.entries(contract.$defs)) {
      if (!name.startsWith(prefix)) continue;
      const value = def?.allOf?.[1]?.properties?.[field]?.const;
      if (typeof value === 'string') values.add(value);
    }
    return values;
  };

  const requestMessages = fixtures.validMessages
    .filter((entry) => entry.message.kind === 'request')
    .map((entry) => entry.message.operation);
  const coveredOperations = new Set(requestMessages);
  const missingOperations = [...new Set(contract.$defs.operation.enum)]
    .filter((operation) => !coveredOperations.has(operation));
  assert.deepEqual(missingOperations, [], '存在没有任何有效实例的操作');

  const coveredEvents = new Set();
  for (const entry of fixtures.validMessages) {
    if (entry.message.kind === 'event') coveredEvents.add(entry.message.type);
  }
  for (const scenario of fixtures.validScenarios) {
    for (const message of scenario.messages) {
      if (message.kind === 'event') coveredEvents.add(message.type);
    }
  }
  const missingEvents = [...pickConst('event.', 'type')]
    .filter((type) => !coveredEvents.has(type));
  assert.deepEqual(missingEvents, [], '存在没有任何有效实例的事件类型');

  const coveredStatuses = new Set(
    fixtures.validMessages
      .filter((entry) => entry.message.kind === 'response')
      .map((entry) => entry.message.status),
  );
  const missingStatuses = [...pickConst('response.', 'status')]
    .filter((status) => !coveredStatuses.has(status));
  assert.deepEqual(missingStatuses, [], '存在没有任何有效实例的响应状态');
});

test('every fixture case name is unique so failures are traceable', () => {
  const names = [
    ...fixtures.validMessages,
    ...fixtures.validScenarios,
    ...fixtures.invalidMessages,
    ...fixtures.invalidScenarios,
  ].map((entry) => entry.name);
  assert.equal(new Set(names).size, names.length, 'fixture 名称必须唯一');
  assert.ok(names.length >= 24, `离线用例过少: ${names.length}`);
});
