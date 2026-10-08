/**
 * H01 Runtime 契约离线校验器（草案工具，仅离线使用）。
 *
 * 职责：
 *   1. 校验契约自身：不得出现 `type: [T, "null"]` 类型数组；所有 object 必须封闭。
 *   2. 用 JSON Schema 子集校验单条消息（request/response/event）。
 *   3. 校验 JSON Schema 表达不了的约束：按名字的禁字段策略、跨字段相等（ok/endReason）、
 *      类型化问答/确认答复（自然语言不能代确认权限）。
 *   4. 全量轨迹状态机（validateScenario）：
 *      - 轮次生命周期：未启动终态拒绝、重复启动拒绝、终态后事件拒绝、终态时未完成调用拒绝。
 *      - 调用生命周期：孤立 CALL_FINISHED 拒绝、重复 CALL_STARTED 拒绝、跨轮次调用拒绝。
 *      - 会话生命周期：会话关闭后活动拒绝、序号严格单调递增（>=1）、configVersion 不可变。
 *      - 支持显式快照回放模式（options.isPartialReplay），避免误拒合法重连续传。
 *
 * 依赖：仅 Node 内置模块。不联网、不启动服务、不调用模型、不需要第三方包。
 * 说明：这是 H01 草案的离线校验器，不是产品运行时校验器；生产实现见 H03/H05。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CONTRACT_URL = new URL(
  '../../contracts/agent-runtime/runtime.schema.json',
  import.meta.url,
);
const CONTRACT_PATH = fileURLToPath(CONTRACT_URL);

const MAX_DEPTH = 64;

/** 不得出现在任何位置的字段名：模型 Secret 与客户端自报 owner 授权。 */
const FORBIDDEN_FIELD_NAMES = new Set([
  'apiKey',
  'api_key',
  'apiSecret',
  'secret',
  'clientSecret',
  'password',
  'authorization',
  'privateKey',
  'accessToken',
  'refreshToken',
  'credentialValue',
  'tokenValue',
  'ownerId',
  'owner',
  'userId',
  'subjectId',
]);

/** 只有这些事件类型会在完成时终结一个轮次。 */
const TURN_TERMINAL_TYPE = 'TURN_FINISHED';
const EVENT_TYPE_WITH_TURN = new Set([
  'TURN_STARTED',
  'TURN_FINISHED',
  'CALL_STARTED',
  'CALL_FINISHED',
  'ASSISTANT_DELTA',
  'ASSISTANT_MESSAGE',
  'INTERACTION_REQUIRED',
  'PROGRESS',
  'UI_ACTION',
]);
const CALL_EVENT_TYPES = new Set(['CALL_STARTED', 'CALL_FINISHED']);

export function loadContract() {
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
  if (!contract.$defs) {
    throw new Error('Runtime 契约缺少 $defs');
  }
  const version = contract.$defs.protocolVersion;
  if (!version || typeof version.const !== 'string') {
    throw new Error('Runtime 契约缺少 protocolVersion const');
  }
  return contract;
}

export function expectedProtocolVersion(contract) {
  return contract.$defs.protocolVersion.const;
}

/* ------------------------------------------------------------------ *
 * 结构自检：类型数组与开放对象
 * ------------------------------------------------------------------ */

export function findTypeArrays(node, path = '$', found = []) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => findTypeArrays(item, `${path}[${index}]`, found));
    return found;
  }
  if (node === null || typeof node !== 'object') {
    return found;
  }
  if (Object.hasOwn(node, 'type') && Array.isArray(node.type)) {
    found.push(`${path}.type`);
  }
  for (const [key, value] of Object.entries(node)) {
    findTypeArrays(value, `${path}.${key}`, found);
  }
  return found;
}

export function findOpenObjects(node, path = '$', found = []) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => findOpenObjects(item, `${path}[${index}]`, found));
    return found;
  }
  if (node === null || typeof node !== 'object') {
    return found;
  }
  if (node.type === 'object' && node.additionalProperties !== false) {
    found.push(path);
  }
  for (const [key, value] of Object.entries(node)) {
    findOpenObjects(value, `${path}.${key}`, found);
  }
  return found;
}

/* ------------------------------------------------------------------ *
 * 判别字段助手
 * ------------------------------------------------------------------ */

function discriminatorField(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  if (value.kind === 'request') return 'operation';
  if (value.kind === 'response') return 'status';
  if (value.kind === 'event') return 'type';
  return null;
}

/* ------------------------------------------------------------------ *
 * JSON Schema 子集校验
 * ------------------------------------------------------------------ */

function resolveRef(contract, ref) {
  if (!ref.startsWith('#/')) {
    throw new Error(`仅支持本地 $ref，收到: ${ref}`);
  }
  let current = contract;
  for (const part of ref.slice(2).split('/')) {
    current = current?.[part];
    if (current === undefined) {
      throw new Error(`无法解析 $ref: ${ref}`);
    }
  }
  return current;
}

function typeOf(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  if (typeof value === 'number') return 'number';
  return typeof value;
}

function matchesType(value, expected) {
  const actual = typeOf(value);
  if (expected === 'number') return actual === 'number' || actual === 'integer';
  return actual === expected;
}

function validateNode(contract, schema, value, path, errors, depth = 0) {
  if (depth > MAX_DEPTH) {
    errors.push(`SCHEMA: ${path} 校验深度超限`);
    return;
  }
  if (schema === true || schema === undefined || schema === null) {
    return;
  }
  if (typeof schema !== 'object') {
    return;
  }

  if (schema.$ref) {
    validateNode(contract, resolveRef(contract, schema.$ref), value, path, errors, depth + 1);
    return;
  }

  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`SCHEMA: ${path} 必须等于 ${JSON.stringify(schema.const)}，实际 ${JSON.stringify(value)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`SCHEMA: ${path} 不在允许枚举内 (${JSON.stringify(value)})`);
  }

  if (schema.type !== undefined) {
    const expected = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!expected.some((one) => matchesType(value, one))) {
      errors.push(`SCHEMA: ${path} 类型必须是 ${expected.join('|')}，实际 ${typeOf(value)}`);
      return;
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`SCHEMA: ${path} 长度小于 ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`SCHEMA: ${path} 长度大于 ${schema.maxLength}`);
    }
    if (schema.pattern !== undefined && !new RegExp(schema.pattern).test(value)) {
      errors.push(`SCHEMA: ${path} 不匹配模式 ${schema.pattern}`);
    }
    if (schema.format === 'date-time' && !/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(value)) {
      errors.push(`SCHEMA: ${path} 不是规范 UTC date-time`);
    }
  }

  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`SCHEMA: ${path} 小于最小值 ${schema.minimum}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`SCHEMA: ${path} 元素少于 ${schema.minItems}`);
    }
    if (schema.uniqueItems === true) {
      const seen = new Set(value.map((item) => JSON.stringify(item)));
      if (seen.size !== value.length) {
        errors.push(`SCHEMA: ${path} 存在重复元素`);
      }
    }
    if (schema.items) {
      value.forEach((item, index) =>
        validateNode(contract, schema.items, item, `${path}[${index}]`, errors, depth + 1));
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const name of required) {
      if (!Object.hasOwn(value, name)) {
        errors.push(`SCHEMA: ${path} 缺少必需字段 "${name}"`);
      }
    }
    const properties = schema.properties ?? {};
    if (schema.additionalProperties === false) {
      for (const name of Object.keys(value)) {
        if (!Object.hasOwn(properties, name)) {
          errors.push(`SCHEMA: ${path} 存在未允许的额外字段 "${name}"`);
        }
      }
    }
    for (const [name, child] of Object.entries(properties)) {
      if (Object.hasOwn(value, name)) {
        validateNode(contract, child, value[name], `${path}/${name}`, errors, depth + 1);
      }
    }
  }

  if (Array.isArray(schema.allOf)) {
    schema.allOf.forEach((branch) =>
      validateNode(contract, branch, value, path, errors, depth + 1));
  }
  if (Array.isArray(schema.anyOf)) {
    const matched = schema.anyOf.some((branch) => {
      const branchErrors = [];
      validateNode(contract, branch, value, path, branchErrors, depth + 1);
      return branchErrors.length === 0;
    });
    if (!matched) {
      errors.push(`SCHEMA: ${path} 不满足 anyOf 任一分支`);
    }
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((branch) => {
      const branchErrors = [];
      validateNode(contract, branch, value, path, branchErrors, depth + 1);
      return branchErrors.length === 0;
    });
    if (matches.length !== 1) {
      errors.push(`SCHEMA: ${path} 必须精确匹配 oneOf 的一个分支，实际匹配 ${matches.length} 个`);
      if (matches.length === 0 && schema.oneOf.length > 1) {
        // 诊断提示：优先选择判别字段（operation/status/type）一致的分支，
        // 再取其中错误最少者，避免只报 "匹配 0 个" 或指向错误分支。
        const discriminator = discriminatorField(value);
        const scored = schema.oneOf.map((branch) => {
          const branchErrors = [];
          validateNode(contract, branch, value, path, branchErrors, depth + 1);
          const mismatch = discriminator !== null && branchErrors.some((error) =>
            error.includes(`${path}/${discriminator} 必须等于`));
          return { branchErrors, mismatch };
        });
        const aligned = scored.filter((entry) => !entry.mismatch);
        const pool = aligned.length > 0 ? aligned : scored;
        const best = pool.reduce((left, right) =>
          (right.branchErrors.length < left.branchErrors.length ? right : left));
        if (best.branchErrors.length > 0) {
          errors.push(
            `SCHEMA: ${path} 最接近分支的具体错误: ${best.branchErrors.slice(0, 3).join(' | ')}`,
          );
        }
      }
    }
  }
  if (schema.not !== undefined) {
    const notErrors = [];
    validateNode(contract, schema.not, value, path, notErrors, depth + 1);
    if (notErrors.length === 0) {
      errors.push(`SCHEMA: ${path} 命中禁止分支 (not)`);
    }
  }
  if (schema.if !== undefined) {
    const ifErrors = [];
    validateNode(contract, schema.if, value, path, ifErrors, depth + 1);
    if (ifErrors.length === 0 && schema.then !== undefined) {
      validateNode(contract, schema.then, value, path, errors, depth + 1);
    }
    if (ifErrors.length > 0 && schema.else !== undefined) {
      validateNode(contract, schema.else, value, path, errors, depth + 1);
    }
  }
}

/* ------------------------------------------------------------------ *
 * 不变量：JSON Schema 表达不了的约束
 * ------------------------------------------------------------------ */

function checkForbiddenFieldNames(value, path, errors) {
  if (value === null || typeof value !== 'object') {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => checkForbiddenFieldNames(item, `${path}[${index}]`, errors));
    return;
  }
  for (const [name, child] of Object.entries(value)) {
    if (FORBIDDEN_FIELD_NAMES.has(name)) {
      errors.push(
        `INVARIANT_FORBIDDEN_FIELD: ${path}/${name} 禁止出现（模型 Secret 或客户端自报 owner 授权）`,
      );
    }
    checkForbiddenFieldNames(child, `${path}/${name}`, errors);
  }
}

function validateMessageLevel(message, errors) {
  checkForbiddenFieldNames(message, '$', errors);

  if (message?.kind === 'event') {
    // 检查持久事件序号从 1 开始
    if (Number.isInteger(message.sequence) && message.sequence < 1) {
      errors.push(`INVARIANT_SEQUENCE_START: $/sequence 持久事件序号必须从 1 开始，实际 ${message.sequence}`);
    }

    if (message.type === TURN_TERMINAL_TYPE) {
      const payload = message.payload ?? {};
      const expectedOk = payload.endReason === 'COMPLETED';
      if (payload.ok !== expectedOk) {
        errors.push(
          `INVARIANT_TERMINAL_OK: $/payload ok=${payload.ok} 与 endReason=${payload.endReason} 不一致（只有 COMPLETED 为成功）`,
        );
      }
    }

    if (message.type === 'INTERACTION_REQUIRED') {
      const payload = message.payload ?? {};
      if (payload.kind === 'question' && !payload.question) {
        errors.push('INVARIANT_INTERACTION_SHAPE: $/payload kind=question 时必须提供可渲染 question 对象');
      }
      if (payload.kind === 'confirmation' && !payload.confirmation) {
        errors.push('INVARIANT_INTERACTION_SHAPE: $/payload kind=confirmation 时必须提供可渲染 confirmation 对象');
      }
    }
  }

  if (message?.kind === 'request' && message.operation === 'respond') {
    const respondTo = message.respondTo;
    if (respondTo?.kind === 'confirmation') {
      if (!respondTo.decision || !['CONFIRM', 'REJECT'].includes(respondTo.decision)) {
        errors.push(
          'INVARIANT_TYPED_RESPOND: $/respondTo 确认答复必须提供明确 decision (CONFIRM 或 REJECT)，不能使用自然语言文本代业务授权',
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ *
 * 对外入口
 * ------------------------------------------------------------------ */

export function validateMessage(contract, message) {
  const errors = [];
  try {
    validateNode(contract, contract, message, '$', errors);
    validateMessageLevel(message, errors);
  } catch (error) {
    errors.push(`SCHEMA: 校验异常 ${error.message}`);
  }
  return { ok: errors.length === 0, errors };
}

export function validateScenario(contract, messages, options = {}) {
  const errors = [];
  if (!Array.isArray(messages)) {
    return { ok: false, errors: ['SCHEMA: 场景必须是消息数组'] };
  }
  messages.forEach((message, index) => {
    const result = validateMessage(contract, message);
    result.errors.forEach((error) => errors.push(`${error} (场景第 ${index} 条)`));
  });

  const isPartialReplay = options.isPartialReplay === true;
  const snapshot = options.snapshot ?? {};

  const lastSequenceBySession = new Map();
  const finishedTurns = new Set(snapshot.finishedTurnIds ?? []);
  const startedTurns = new Set(snapshot.activeTurnId ? [snapshot.activeTurnId] : []);
  const activeCalls = new Map(); // callId -> turnId
  if (snapshot.activeCalls) {
    for (const [cId, tId] of Object.entries(snapshot.activeCalls)) {
      activeCalls.set(cId, tId);
    }
  }
  let sessionClosed = snapshot.sessionClosed === true;
  const configVersions = new Set(snapshot.configVersion ? [snapshot.configVersion] : []);
  const sessionIds = new Set(snapshot.sessionId ? [snapshot.sessionId] : []);

  messages.forEach((message, index) => {
    const position = `场景第 ${index} 条`;
    if (message?.kind !== 'event') {
      return;
    }
    const sessionId = message.sessionId;
    const turnId = message.turnId;
    const callId = message.callId;
    sessionIds.add(sessionId);

    // 0. 会话关闭后活动检查
    if (sessionClosed) {
      errors.push(
        `INVARIANT_EVENT_AFTER_SESSION_CLOSED: ${position} 会话 ${sessionId} 已关闭，仍出现事件 ${message.type}`,
      );
    }

    if (message.type === 'SESSION_CLOSED') {
      sessionClosed = true;
    }

    // 1. 序号单调递增检查
    if (Number.isInteger(message.sequence)) {
      const previous = lastSequenceBySession.get(sessionId) ?? (snapshot.lastSequence ?? 0);
      if (message.sequence <= previous) {
        errors.push(
          `INVARIANT_SEQUENCE_MONOTONIC: ${position} 会话 ${sessionId} 序号 ${message.sequence} 未大于前一条 ${previous}`,
        );
      }
      lastSequenceBySession.set(sessionId, message.sequence);
    }

    // 2. 配置版本一致性
    if (message.payload && typeof message.payload.configVersion === 'string') {
      configVersions.add(message.payload.configVersion);
    }

    // 3. 轮次生命周期检查
    if (message.type === 'TURN_STARTED' && typeof turnId === 'string') {
      if (startedTurns.has(turnId)) {
        errors.push(`INVARIANT_DUPLICATE_TURN_START: ${position} 轮次 ${turnId} 重复启动 (TURN_STARTED)`);
      }
      startedTurns.add(turnId);
    }

    if (message.type === TURN_TERMINAL_TYPE && typeof turnId === 'string') {
      if (!startedTurns.has(turnId) && !isPartialReplay) {
        errors.push(
          `INVARIANT_TERMINAL_WITHOUT_START: ${position} 轮次 ${turnId} 未调用 TURN_STARTED 即出现终态事件`,
        );
      }
      if (finishedTurns.has(turnId)) {
        errors.push(`INVARIANT_TURN_TERMINAL_ONCE: ${position} 轮次 ${turnId} 出现多个终态事件`);
      }
      finishedTurns.add(turnId);

      // 检查当前轮次是否有未关闭的调用
      for (const [cId, tId] of activeCalls.entries()) {
        if (tId === turnId) {
          errors.push(
            `INVARIANT_PENDING_CALL_AT_TURN_END: ${position} 轮次 ${turnId} 终结时调用 ${cId} 仍未完成`,
          );
        }
      }
    }

    // 终态后事件检查
    if (EVENT_TYPE_WITH_TURN.has(message.type) && typeof turnId === 'string' && message.type !== TURN_TERMINAL_TYPE) {
      if (finishedTurns.has(turnId)) {
        errors.push(
          `INVARIANT_EVENT_AFTER_TERMINAL: ${position} 轮次 ${turnId} 已终结，仍出现 ${message.type}`,
        );
      }
      if (!startedTurns.has(turnId) && !isPartialReplay && message.type !== 'TURN_STARTED') {
        errors.push(
          `INVARIANT_CALL_WITHIN_TURN: ${position} 轮次 ${turnId} 的 ${message.type} 没有先前的 TURN_STARTED`,
        );
      }
    }

    // 4. 调用生命周期检查
    if (message.type === 'CALL_STARTED') {
      if (typeof callId === 'string') {
        if (activeCalls.has(callId)) {
          errors.push(`INVARIANT_DUPLICATE_CALL_START: ${position} 调用 ${callId} 重复启动 (CALL_STARTED)`);
        }
        activeCalls.set(callId, turnId);
      }
    }

    if (message.type === 'CALL_FINISHED') {
      if (typeof callId === 'string') {
        if (!activeCalls.has(callId) && !isPartialReplay) {
          errors.push(
            `INVARIANT_CALL_WITHOUT_START: ${position} 调用 ${callId} 未启动 (CALL_STARTED) 即出现 CALL_FINISHED`,
          );
        } else if (activeCalls.has(callId)) {
          const startedTurnId = activeCalls.get(callId);
          if (startedTurnId !== turnId) {
            errors.push(
              `INVARIANT_CALL_CROSS_TURN: ${position} 调用 ${callId} 跨轮次 (启动于 ${startedTurnId}，结束于 ${turnId})`,
            );
          }
          activeCalls.delete(callId);
        }
      }
    }
  });

  if (configVersions.size > 1) {
    errors.push(
      `INVARIANT_CONFIG_IMMUTABLE: 同一会话出现多个 configVersion (${[...configVersions].join(', ')})`,
    );
  }
  if (sessionIds.size > 1) {
    errors.push(
      `INVARIANT_SESSION_CONSISTENT: 同一场景出现多个 sessionId (${[...sessionIds].join(', ')})`,
    );
  }

  return { ok: errors.length === 0, errors };
}
