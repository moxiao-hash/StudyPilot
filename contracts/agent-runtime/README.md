# StudyPilot Agent Runtime 契约（H01 草案）

状态：**DRAFT，待 Codex 冻结**。本目录由 H01 的公共 schema Owner（MiniMax Code）起草；
冻结后其他端只能通过报告提出修改建议，不直接改本目录。

| 文件 | 用途 |
| --- | --- |
| `runtime.schema.json` | Runtime 请求 / 响应 / 事件形状（JSON Schema 2020-12） |
| `../../scripts/harness/runtime-contract.mjs` | 离线校验器（仅 Node 内置模块） |
| `../../scripts/harness/runtime-contract.fixtures.json` | 有效/无效实例 |
| `../../scripts/harness/runtime-contract.test.mjs` | 离线回归测试 |

运行：

```bash
node --test scripts/harness/runtime-contract.test.mjs
```

## 1. 约定

1. **版本**：`protocolVersion` 目前固定为 `"1.0-draft"`。冻结时改为 `"1.0"`；破坏性变更升主版本，
   同一会话内不得混用不同协议版本。
2. **空值表达**：一律使用互斥分支（`oneOf` / `not`），**不使用 `type: [T, "null"]` 类型数组**。
   原因见接入设计：Harness 的 `tools/src/json-schema.ts` 不支持类型数组，适配层需要把
   nullable 递归转换为等价的 `oneOf`。草案直接采用适配后的形状，避免两侧再翻译一次。
3. **封闭对象**：所有 object 都是 `additionalProperties: false`。未知字段必须被拒绝，
   而不是被忽略——否则模型/前端拼写错误会静默降级为“没有这个能力”。
4. **标识**：`sessionId` / `turnId` / `callId` / `configVersion` 有固定前缀与字符集；
   其余不透明标识使用 `opaqueRef`。标识只用于关联，不承载 Secret、路径或用户可读凭据。
5. **身份与 owner**：`identity` 是 **Java 签发**的断言（`issuer`/`audience` 固定）。
   契约中不出现 `ownerId`/`owner`/`userId` 等客户端自报授权字段；owner 由 Agent Service
   依据凭据解析。模型不能指定 owner、目标 URL 或令牌。
6. **工具名**：沿用 Java 冻结的 wire 名称，包含点号形式（例如 `roadmap.current.get`）。
7. **结束原因**：只有 `COMPLETED` 表示完成。`MAX_TOKENS`、`BUDGET_EXHAUSTED`、`CANCELLED`、
   `CAPABILITY_DENIED`、`FAILED` 都不是成功，`TURN_FINISHED.payload.ok` 必须与之一致。

## 2. 操作（request）

| operation | 必需字段 | 说明 |
| --- | --- | --- |
| `open` | `openMode`（`create`/`resume`） | 统一入口；`create` 不得携带 `sessionRef`，`resume` 必须携带 |
| `create` | — | 显式新建；不得携带 `sessionRef` |
| `resume` | `sessionRef` | 恢复既有会话（服务端必须调用原 resume，不能只重传旧 ID） |
| `prompt` | `sessionRef` + `prompt{messageId,content}` | 入队回执形状与 `session/prompt` 的 messageId 对齐 |
| `cancel` | `sessionRef` | 单会话取消；不得以进程 shutdown 代替 |
| `steer` | `sessionRef` + `steer{content}` | 在原步骤边界插入指示（H10 起启用） |
| `respond` | `sessionRef` + `respondTo{interactionId,answer}` | 结构化问答/确认答复；不得携带 `subscribeFrom` |
| `subscribe` | `sessionRef` + `subscribeFrom` | 事件订阅起点，用于断线续传 |
| `close` | `sessionRef` | 幂等；已关闭会话返回 `NO_OP` 而不是错误 |

## 3. 事件（event）

`sequence` 在会话内单调递增；重连从 `subscribeFrom` 续传。根会话最终输出才作为用户回复，
子 Agent 文本只作内部结果。

| type | 必需标识 | payload |
| --- | --- | --- |
| `SESSION_OPENED` | `sessionId` | `{configVersion}` |
| `SESSION_CLOSED` | `sessionId` | 无 |
| `TURN_STARTED` | `sessionId`,`turnId` | 无 |
| `TURN_FINISHED` | `sessionId`,`turnId` | `{endReason, ok, usage?}` |
| `CALL_STARTED` | `sessionId`,`turnId`,`callId` | `{toolName}` |
| `CALL_FINISHED` | `sessionId`,`turnId`,`callId` | `{status}`；`PENDING` 不算成功 |
| `ASSISTANT_DELTA` | `sessionId`,`turnId` | `{content}` |
| `ASSISTANT_MESSAGE` | `sessionId`,`turnId` | `{content}` |
| `INTERACTION_REQUIRED` | `sessionId`,`turnId` | `{interactionId, kind}` |
| `USAGE_REPORTED` | `sessionId` | `{inputTokens, outputTokens, costMicros?}` |
| `ERROR` | `sessionId` | `{code, message, retryable?}` |

## 4. 结束原因与成功判定

| endReason | ok | 含义 |
| --- | --- | --- |
| `COMPLETED` | `true` | 正常完成 |
| `MAX_TOKENS` | `false` | 达到 token 上限，**不是完成** |
| `BUDGET_EXHAUSTED` | `false` | 预算不足，需可见原因 |
| `CANCELLED` | `false` | 用户/会话取消 |
| `CAPABILITY_DENIED` | `false` | 能力或权限被拒绝 |
| `FAILED` | `false` | 执行失败 |

## 5. 约束的强制层级

| 约束 | 位置 |
| --- | --- |
| 协议版本、封闭对象、字段类型/枚举/格式/模式、`uniqueItems` | schema |
| operation → 必需字段（`sessionRef`/`openMode`/`prompt`/`subscribeFrom`/`respondTo`/`steer`） | schema（`if/then`） |
| `create` 不带 `sessionRef`、`respond` 不带 `subscribeFrom` | schema（`not`） |
| 事件 type ↔ 必需标识与 payload 形状（`oneOf` 变体） | schema |
| 响应 `status` ↔ `error`（`REJECTED` 必须有 error，`ACCEPTED`/`NO_OP` 不得有） | schema |
| 禁止字段名（模型 Secret、客户端自报 owner） | 离线不变量 `INVARIANT_FORBIDDEN_FIELD` |
| `ok` ↔ `endReason`（只有 `COMPLETED` 为成功） | 离线不变量 `INVARIANT_TERMINAL_OK` |
| 会话内序号严格递增 | 离线不变量 `INVARIANT_SEQUENCE_MONOTONIC` |
| 每个轮次只有一个 `TURN_FINISHED` | 离线不变量 `INVARIANT_TURN_TERMINAL_ONCE` |
| 轮次终态之后不再有该轮次事件 | 离线不变量 `INVARIANT_EVENT_AFTER_TERMINAL` |
| 会话内 `configVersion` 不可变（禁止 mid-turn 换模型） | 离线不变量 `INVARIANT_CONFIG_IMMUTABLE` |
| 同一订阅场景只有一个 `sessionId` | 离线不变量 `INVARIANT_SESSION_CONSISTENT` |
| `CALL_*` 必须出现在该轮次 `TURN_STARTED` 之后 | 离线不变量 `INVARIANT_CALL_WITHIN_TURN` |

### schema 表达不了、本草案也未离线强制的约束（交给实现与后续 Task）

1. **`respond` 只结算一次**：迟到或重复答复必须返回 `ALREADY_SETTLED` 且不重新执行——语义约束，H10。
2. **序号保留窗口与快照重建**：`subscribeFrom` 落在保留窗口之前要返回 `SEQUENCE_EXPIRED` 并让前端
   用快照重建；窗口大小是运行时策略，H03。
3. **`close` 幂等**：草案只定义了 `NO_OP` 状态，重复关闭不产生副作用的语义由服务实现保证。
4. **身份有效性**：`expiresAt` 过期、audience/scope 不匹配的拒绝逻辑属于 H05，不由 schema 判定。
5. **owner 解析与跨 owner 隔离**：凭据→owner 的绑定与越权拒绝，H05。
6. **Secret 全链路**（不入日志/事件/浏览器存储/会话）：策略与测试边界，H04/H05/H07。
7. **跨进程真实顺序、延迟与至少一次投递**：H01 只做离线形状校验，真实证据在 H03 起的运行验证。
8. **工具 schema 投影**（nullable → `oneOf`、点号名称、PTC）：H02/H06，本契约只固定事件与工具名形状。

## 6. 需要 Codex 冻结的草案决定

1. `protocolVersion` 冻结值由 `"1.0-draft"` 改为 `"1.0"` 的时机。
2. `open` 与 `create`/`resume` 是否同时保留（草案保留三者：`open` 为统一入口，`create`/`resume` 供显式调用）。
3. `identity` 断言的字段集（`subjectRef`/`issuer`/`audience`/`scopes`/`issuedAt`/`expiresAt`）是否为最终形态。
4. 事件 payload 是否需要在 H03 增加 `ASSISTANT_REASONING`、`CALL_PROGRESS` 等类型。
5. `CALL_FINISHED.payload.status` 是否保留 `PENDING`（用于“等待业务确认”），还是改为独立事件。
6. 是否把 `INVARIANT_*` 中可离线检查的部分固化为 CI 门禁脚本。
