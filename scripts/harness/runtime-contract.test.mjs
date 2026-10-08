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
    const result = validateScenario(contract, positive.messages, positive.options);
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
    const result = validateScenario(contract, negative.messages, negative.options);
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

/* ------------------------------------------------------------------ *
 * Round 1 整改专项断言 (RED -> GREEN)
 * ------------------------------------------------------------------ */

test('R3: scenario rejects terminal before TURN_STARTED', () => {
  const result = validateScenario(contract, [
    {
      protocolVersion: '1.0-draft',
      kind: 'event',
      eventId: 'evt-term-001',
      sequence: 1,
      sessionId: 'sess-000000000001',
      turnId: 'turn-000000000001',
      type: 'TURN_FINISHED',
      occurredAt: '2026-10-08T00:00:01Z',
      payload: { endReason: 'COMPLETED', ok: true },
    },
  ]);
  assert.equal(result.ok, false, '未启动轮次出现终态必须被拒绝');
  assert.ok(
    result.errors.some((e) => e.includes('INVARIANT_TERMINAL_WITHOUT_START')),
    `期望 INVARIANT_TERMINAL_WITHOUT_START，实际: ${result.errors.join('; ')}`,
  );
});

test('R3: scenario rejects CALL_FINISHED without matching CALL_STARTED', () => {
  const result = validateScenario(contract, [
    {
      protocolVersion: '1.0-draft',
      kind: 'event',
      eventId: 'evt-start-001',
      sequence: 1,
      sessionId: 'sess-000000000001',
      turnId: 'turn-000000000001',
      type: 'TURN_STARTED',
      occurredAt: '2026-10-08T00:00:01Z',
    },
    {
      protocolVersion: '1.0-draft',
      kind: 'event',
      eventId: 'evt-finish-001',
      sequence: 2,
      sessionId: 'sess-000000000001',
      turnId: 'turn-000000000001',
      callId: 'call-orphan0001',
      type: 'CALL_FINISHED',
      occurredAt: '2026-10-08T00:00:02Z',
      payload: { status: 'SUCCEEDED' },
    },
  ]);
  assert.equal(result.ok, false, '孤立 CALL_FINISHED 必须被拒绝');
  assert.ok(
    result.errors.some((e) => e.includes('INVARIANT_CALL_WITHOUT_START')),
    `期望 INVARIANT_CALL_WITHOUT_START，实际: ${result.errors.join('; ')}`,
  );
});

test('R3: scenario rejects duplicate TURN_STARTED for same turnId', () => {
  const result = validateScenario(contract, [
    {
      protocolVersion: '1.0-draft',
      kind: 'event',
      eventId: 'evt-start-001',
      sequence: 1,
      sessionId: 'sess-000000000001',
      turnId: 'turn-000000000001',
      type: 'TURN_STARTED',
      occurredAt: '2026-10-08T00:00:01Z',
    },
    {
      protocolVersion: '1.0-draft',
      kind: 'event',
      eventId: 'evt-start-002',
      sequence: 2,
      sessionId: 'sess-000000000001',
      turnId: 'turn-000000000001',
      type: 'TURN_STARTED',
      occurredAt: '2026-10-08T00:00:02Z',
    },
  ]);
  assert.equal(result.ok, false, '同一轮次重复 TURN_STARTED 必须被拒绝');
  assert.ok(
    result.errors.some((e) => e.includes('INVARIANT_DUPLICATE_TURN_START')),
    `期望 INVARIANT_DUPLICATE_TURN_START，实际: ${result.errors.join('; ')}`,
  );
});

test('R2: question event with renderable question data accepted', () => {
  const result = validateMessage(contract, {
    protocolVersion: '1.0-draft',
    kind: 'event',
    eventId: 'evt-q-001',
    sequence: 1,
    sessionId: 'sess-000000000001',
    turnId: 'turn-000000000001',
    type: 'INTERACTION_REQUIRED',
    occurredAt: '2026-10-08T00:00:01Z',
    payload: {
      interactionId: 'intr-000000000001',
      kind: 'question',
      question: {
        text: '选择哪一个？',
        options: ['a', 'b'],
      },
    },
  });
  assert.equal(result.ok, true, `可渲染 question 必须被接受，实际错误: ${result.errors.join('; ')}`);
});



test('R2: confirmation event with renderable confirmation data accepted', () => {
  const result = validateMessage(contract, {
    protocolVersion: '1.0-draft',
    kind: 'event',
    eventId: 'evt-conf-001',
    sequence: 1,
    sessionId: 'sess-000000000001',
    turnId: 'turn-000000000001',
    type: 'INTERACTION_REQUIRED',
    occurredAt: '2026-10-08T00:00:01Z',
    payload: {
      interactionId: 'intr-000000000002',
      kind: 'confirmation',
      confirmation: {
        executionId: 'exec-000000000001',
        actionId: 'act-000000000001',
        toolName: 'roadmap.enroll',
        summary: '确认加入路线',
        expectedVersion: 1,
        riskLevel: 'HIGH',
        expiresAt: '2026-10-08T00:15:00Z',
      },
    },
  });
  assert.equal(result.ok, true, `可渲染 confirmation 必须被接受: ${result.errors.join('; ')}`);
});

test('R2: typed respond for confirmation requires decision and rejects plain text answer', () => {
  // 正例：明确 decision: 'CONFIRM'
  const validConf = validateMessage(contract, {
    protocolVersion: '1.0-draft',
    kind: 'request',
    requestId: 'req-conf-001',
    operation: 'respond',
    sessionRef: { sessionId: 'sess-000000000001', configVersion: 'cfg-000001' },
    respondTo: {
      interactionId: 'intr-000000000002',
      kind: 'confirmation',
      actionId: 'act-000000000001',
      expectedVersion: 1,
      decision: 'CONFIRM',
      confirmed: true,
    },
    identity: {
      subjectRef: 'subj-ref-000000000001',
      issuer: 'studypilot-java',
      audience: 'studypilot-agent-service',
      scopes: ['agent.interaction.respond'],
      issuedAt: '2026-10-08T00:00:00Z',
      expiresAt: '2026-10-08T00:15:00Z',
    },
  });
  assert.equal(validConf.ok, true, `有效结构化确认必须被接受: ${validConf.errors.join('; ')}`);

  // 负例：试图用 answer 代替结构化 decision
  const invalidConf = validateMessage(contract, {
    protocolVersion: '1.0-draft',
    kind: 'request',
    requestId: 'req-conf-002',
    operation: 'respond',
    sessionRef: { sessionId: 'sess-000000000001', configVersion: 'cfg-000001' },
    respondTo: {
      interactionId: 'intr-000000000002',
      kind: 'confirmation',
      actionId: 'act-000000000001',
      expectedVersion: 1,
      answer: '好的我同意',
    },
    identity: {
      subjectRef: 'subj-ref-000000000001',
      issuer: 'studypilot-java',
      audience: 'studypilot-agent-service',
      scopes: ['agent.interaction.respond'],
      issuedAt: '2026-10-08T00:00:00Z',
      expiresAt: '2026-10-08T00:15:00Z',
    },
  });
  assert.equal(invalidConf.ok, false, '文本代替确认权限必须被拒绝');
});

test('R1: PROGRESS event accepts structured progress and rejects unknown fields', () => {
  const validProg = validateMessage(contract, {
    protocolVersion: '1.0-draft',
    kind: 'event',
    eventId: 'evt-prog-001',
    sequence: 1,
    sessionId: 'sess-000000000001',
    type: 'PROGRESS',
    occurredAt: '2026-10-08T00:00:01Z',
    payload: {
      kind: 'PLAN_HINT',
      stage: 'planning',
      description: '生成执行路线',
      step: 1,
      totalSteps: 2,
    },
  });
  assert.equal(validProg.ok, true, `有效 PROGRESS 必须通过: ${validProg.errors.join('; ')}`);

  const invalidProg = validateMessage(contract, {
    protocolVersion: '1.0-draft',
    kind: 'event',
    eventId: 'evt-prog-002',
    sequence: 1,
    sessionId: 'sess-000000000001',
    type: 'PROGRESS',
    occurredAt: '2026-10-08T00:00:01Z',
    payload: {
      kind: 'PLAN_HINT',
      stage: 'planning',
      description: '生成执行路线',
      arbitraryField: 'not allowed',
    },
  });
  assert.equal(invalidProg.ok, false, 'PROGRESS 额外字段必须被拒绝');
});

test('R1: UI_ACTION event accepts closed whitelisted action and rejects arbitrary URL/selector', () => {
  const validUi = validateMessage(contract, {
    protocolVersion: '1.0-draft',
    kind: 'event',
    eventId: 'evt-ui-001',
    sequence: 1,
    sessionId: 'sess-000000000001',
    turnId: 'turn-000000000001',
    type: 'UI_ACTION',
    occurredAt: '2026-10-08T00:00:01Z',
    payload: {
      actionId: 'act-ui-00000001',
      actionType: 'NAVIGATE',
      routeKey: 'ROADMAP_NODE',
      params: { nodeId: 'node-01' },
    },
  });
  assert.equal(validUi.ok, true, `有效 UI_ACTION 必须通过: ${validUi.errors.join('; ')}`);

  const invalidUi = validateMessage(contract, {
    protocolVersion: '1.0-draft',
    kind: 'event',
    eventId: 'evt-ui-002',
    sequence: 1,
    sessionId: 'sess-000000000001',
    turnId: 'turn-000000000001',
    type: 'UI_ACTION',
    occurredAt: '2026-10-08T00:00:01Z',
    payload: {
      actionId: 'act-ui-00000002',
      actionType: 'NAVIGATE',
      selector: '#arbitrary-dom-element',
    },
  });
  assert.equal(invalidUi.ok, false, 'UI_ACTION 任意选择器必须被拒绝');
});

test('R3: scenario partial replay succeeds when backed by snapshot state', () => {
  // 在显式 partial replay 模式下，有活跃轮次和调用的快照支撑时，续传事件被正确接受
  const replayEvents = [
    {
      protocolVersion: '1.0-draft',
      kind: 'event',
      eventId: 'evt-rep-001',
      sequence: 5,
      sessionId: 'sess-000000000001',
      turnId: 'turn-000000000001',
      callId: 'call-000000000001',
      type: 'CALL_FINISHED',
      occurredAt: '2026-10-08T00:00:05Z',
      payload: { status: 'SUCCEEDED' },
    },
    {
      protocolVersion: '1.0-draft',
      kind: 'event',
      eventId: 'evt-rep-002',
      sequence: 6,
      sessionId: 'sess-000000000001',
      turnId: 'turn-000000000001',
      type: 'TURN_FINISHED',
      occurredAt: '2026-10-08T00:00:06Z',
      payload: { endReason: 'COMPLETED', ok: true },
    },
  ];

  // 无快照时必须被拒绝（未启动即终态）
  const noSnapshot = validateScenario(contract, replayEvents);
  assert.equal(noSnapshot.ok, false, '无快照的部分回放必须被拒绝');

  // 有显式快照模式时允许合法续传
  const withSnapshot = validateScenario(contract, replayEvents, {
    isPartialReplay: true,
    snapshot: {
      sessionId: 'sess-000000000001',
      configVersion: 'cfg-000001',
      lastSequence: 4,
      activeTurnId: 'turn-000000000001',
      activeCalls: { 'call-000000000001': 'turn-000000000001' },
    },
  });
  assert.equal(withSnapshot.ok, true, `快照支撑的部分回放必须通过: ${withSnapshot.errors.join('; ')}`);
});
