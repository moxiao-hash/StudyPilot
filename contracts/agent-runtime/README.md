# StudyPilot Agent Runtime 契约（H01 草案，Round 2 整改后）

状态：**DRAFT，已按 Codex 第一轮验收裁决整改（R1/R2/R3），待 Codex 最终冻结**。
本目录由 H01 的公共 schema Owner（MiniMax Code）独占维护；冻结后其他端只通过报告提出修改建议，不直接改写本目录。

| 文件 | 用途 |
| --- | --- |
| `runtime.schema.json` | Runtime 请求 / 响应 / 事件形状（JSON Schema 2020-12） |
| `../../scripts/harness/runtime-contract.mjs` | 离线校验器（无第三方依赖，含全量轨迹状态机） |
| `../../scripts/harness/runtime-contract.fixtures.json` | 65 个正反实例（27 有效消息 + 2 有效场景 + 25 无效消息 + 11 无效场景） |
| `../../scripts/harness/runtime-contract.test.mjs` | 离线回归与整改专项测试（79 项） |

运行：

```bash
cd /Users/moxiao/IdeaProjects/project-harness-h01-minimax
node --test scripts/harness/runtime-contract.test.mjs
```

---

## 1. Codex 裁决核心原则与约定（R1）

1. **版本与名称规范**：
   - `protocolVersion` 固定为 `"1.0-draft"`，待二轮过门由 Codex 统一冻结为 `"1.0"`。
   - 所有事件名统一为 **UPPERCASE** 驼峰下划线风格（`SESSION_OPENED`、`SESSION_CLOSED`、`TURN_STARTED`、`TURN_FINISHED`、`CALL_STARTED`、`CALL_FINISHED`、`ASSISTANT_DELTA`、`ASSISTANT_MESSAGE`、`INTERACTION_REQUIRED`、`USAGE_REPORTED`、`ERROR`、`PROGRESS`、`UI_ACTION`）。
   - 任何小写事件名（如 `turn.started`、`content.delta`）属于非线上草案，禁止在契约出现。
2. **事件序号（Sequence）与订阅续传**：
   - 持久事件的 `sequence` **从 1 开始单调严格递增**（`minimum: 1`）。
   - `subscribeFrom: 0` 表示从第一条事件（序号 >= 1）起订阅；续传场景必须排除已确认的序号。
   - 支持显式快照回放模式（`isPartialReplay`），断线重连与增量消费不得凭空要求每次回放都包含历史全量起点。
3. **空值与类型表达**：
   - 契约内部一律使用互斥分支（`oneOf` / `not`），**不使用 `type: [T, "null"]` 类型数组**（Harness `tools/src/json-schema.ts` 不支持类型数组）。
   - 所有 object 必须显式声明 `additionalProperties: false`，严格封闭，拒绝意外或拼写错误的字段。
4. **传输 Schema 与 Harness 工具 Schema 域隔离声明（重要）**：
   - 本传输契约（JSON Schema Draft 2020-12）定义的是 Agent Service、Java 后端与 Vue 前端之间的 Wire 协议，**不等于** Harness 内部工具 Schema。
   - Harness 内部工具解析器（`tools/src/json-schema.ts`）仅支持其严格子集，在 H02/H06 会进行投影转换。**严禁宣称本传输 Schema 可直接作为 Harness 内部工具 Schema 消费**。
5. **身份、Owner 与密钥红线**：
   - 契约禁止出现 `apiKey`、`api_key`、`secret`、`password` 等模型 Secret。
   - 契约禁止出现 `ownerId`、`owner`、`userId` 等客户端自报授权字段。
   - 客户端唯一合法身份为 Java 签发的 `identityAssertion`（`issuer: "studypilot-java"`, `audience: "studypilot-agent-service"`）；真实 owner 由 Agent Service 在服务端鉴权解析。
6. **成功与终态边界**：
   - 只有 `COMPLETED` 表示正常完成（`ok: true`）。
   - `MAX_TOKENS`、`BUDGET_EXHAUSTED`、`CANCELLED`、`CAPABILITY_DENIED`、`FAILED` **均非成功**（`ok: false`），严禁将 Token 耗尽或预算不足伪装为完成。
   - 等待交互（`INTERACTION_REQUIRED`）属于进行中的待答/待确认挂起状态，不是完成。
   - `steer` 是下一步动态指示注入，不是取消，不是终态。

---

## 2. 操作目录（Request）

| operation | 必需字段 | 说明 |
| --- | --- | --- |
| `open` | `openMode`（`create` 或 `resume`） | 统一入口；`create` 不带 `sessionRef`，`resume` 必须带 |
| `create` | — | 显式新建会话；禁止携带 `sessionRef` |
| `resume` | `sessionRef` | 显式恢复会话（服务端调用原 resume，不能仅重传 ID） |
| `prompt` | `sessionRef`, `prompt{messageId, content}` | 会话追加用户输入 |
| `cancel` | `sessionRef` | 取消当前进行中轮次；禁止以进程级 shutdown 代替 |
| `steer` | `sessionRef`, `steer{content}` | 原步骤边界注入新指示（H10 启用） |
| `respond` | `sessionRef`, `respondTo` | **类型化结构化答复**（见下文 R2 详述） |
| `subscribe` | `sessionRef`, `subscribeFrom` | 事件增量订阅，`subscribeFrom: 0` 为全量起点 |
| `close` | `sessionRef` | 关闭会话；幂等，重复关闭返回 `NO_OP` |

---

## 3. 事件目录（Event）

所有事件遵循统一信封 `eventEnvelope`：`protocolVersion`、`kind: "event"`、`eventId`、`sequence >= 1`、`sessionId`、`type`、`occurredAt`。

| type | 轮次标识 | Payload 必需字段与结构 | 语义说明 |
| --- | --- | --- | --- |
| `SESSION_OPENED` | 无 | `{ configVersion }` | 会话建立或恢复成功，绑定配置版本 |
| `SESSION_CLOSED` | 无 | 无 | 会话正式关闭，后续禁止出现任何新事件 |
| `TURN_STARTED` | `turnId` | 无 | 轮次开始，建立轮次生命周期 |
| `TURN_FINISHED` | `turnId` | `{ endReason, ok, usage? }` | 轮次终结；只有 COMPLETED 对应 ok:true |
| `CALL_STARTED` | `turnId`, `callId` | `{ toolName }` | 工具调用发起，保留点号名称（如 `roadmap.current.get`） |
| `CALL_FINISHED` | `turnId`, `callId` | `{ status, summary?, truncated?, originalBytes?, error?, resultPreview? }` | 工具调用结束，携带净化结果/裁剪元数据；PENDING 不等于成功 |
| `ASSISTANT_DELTA` | `turnId` | `{ content }` | 助手模型实时流式增量 Token |
| `ASSISTANT_MESSAGE` | `turnId` | `{ content }` | 助手模型完整回复或阶段发言 |
| `INTERACTION_REQUIRED` | `turnId` | `{ interactionId, kind, question?, confirmation? }` | 交互待答挂起，**必须包含可渲染对象**（见 R2） |
| `USAGE_REPORTED` | 可选 | `{ inputTokens, outputTokens, costMicros? }` | 模型 Token 用量报告 |
| `ERROR` | 可选 | `{ code, message, retryable? }` | 运行时稳定错误 |
| `PROGRESS` **[新]** | 可选 | `{ kind, stage, description, step?, totalSteps?, details? }` | 过程进度展示（CONTEXT_LOADED, PLAN_HINT 等），不约束推理循环 |
| `UI_ACTION` **[新]** | `turnId` | `{ actionId, actionType, routeKey?, params?, modalKey?, resourceKey?, elementKey? }` | 封闭 UI 指令（NAVIGATE, OPEN_MODAL 等），严禁任意 URL/选择器 |

---

## 4. 交互与类型化响应规范（R2 整改）

### 4.1 可渲染交互事件（`INTERACTION_REQUIRED`）
当发生用户交互挂起时，Payload 必须提供客户端可直接渲染的结构化对象：
- **问答提问（`kind: "question"`）**：
  - 必须提供 `question` 对象。
  - 必须包含 `prompt` 或 `text`（提问正文）。
  - 可包含 `questionId`、可选 `options`（单选/多选项列表，支持字符串或 `{ value, label, description? }`）与 `selectionMode`（`single` 或 `multiple`）。
- **高风险写入确认（`kind: "confirmation"`）**：
  - 必须提供 `confirmation` 对象。
  - 必须包含：`executionId`、`actionId`、`toolName`、`summary`、`riskLevel` (`LOW` | `HIGH`)、`expiresAt`（ISO-8601 UTC）。
  - 可包含 `expectedVersion`。

### 4.2 类型化答复（`request.respond` -> `respondTo`）
客户端回复必须区分为结构化问答答复或高风险确认决策：
- **问答答复（`kind: "question"`）**：
  - 必须包含 `interactionId`、`questionId`、`answer`（字符串或多选数组）。
- **确认决策（`kind: "confirmation"`）**：
  - 必须包含 `interactionId`、`actionId`、`decision` (`"CONFIRM"` 或 `"REJECT"`)。
  - 可包含 `confirmed: boolean`。
  - **红线**：严禁仅使用自然语言字符串（如 `"我确认"`）代业务授权！自然语言不是权限真值，必须提供确定性的 `decision`。
- **通用问答兜底（无 `kind`）**：
  - 允许 `{ interactionId, answer: string }` 用于简单自由文本提问，但禁止用于业务写入授权。

---

## 5. 全量轨迹状态机与生命周期验证（R3 整改）

`scripts/harness/runtime-contract.mjs` 中的 `validateScenario(contract, messages, options)` 实现了全量生命周期验证：

| 校验规则代码 | 触发条件 | 保护目的 |
| --- | --- | --- |
| `INVARIANT_TERMINAL_WITHOUT_START` | 某 `turnId` 未发射 `TURN_STARTED` 即出现 `TURN_FINISHED` | 防止幽灵终态伪造轮次完成 |
| `INVARIANT_DUPLICATE_TURN_START` | 同一 `turnId` 出现多次 `TURN_STARTED` | 防止轮次状态机竞争或重复启动 |
| `INVARIANT_TURN_TERMINAL_ONCE` | 同一 `turnId` 出现多个终态事件（如重复 `TURN_FINISHED`） | 保证轮次终态确定且唯一 |
| `INVARIANT_EVENT_AFTER_TERMINAL` | 轮次终结后仍出现该轮次内容（如 `ASSISTANT_MESSAGE`、`CALL_*` 等） | 防止终态后产生未授权副作用或脏输出 |
| `INVARIANT_CALL_WITHIN_TURN` | `CALL_STARTED` 出现在未启动的轮次或非活跃轮次中 | 保证工具调用严格受限于所属轮次生命周期 |
| `INVARIANT_DUPLICATE_CALL_START` | 同一 `callId` 出现多次 `CALL_STARTED` | 防止工具调用重复分发 |
| `INVARIANT_CALL_WITHOUT_START` | 出现 `CALL_FINISHED` 但未有匹配的 `CALL_STARTED` | 防止孤立或伪造工具执行完成 |
| `INVARIANT_CALL_CROSS_TURN` | 某个 `callId` 在一个轮次启动却在另一个轮次结束 | 防止调用跨轮次悬挂逃逸 |
| `INVARIANT_PENDING_CALL_AT_TURN_END` | 轮次发射 `TURN_FINISHED` 时仍有未完成的活跃 `callId` | 防止轮次在工具未终结时早熟关闭 |
| `INVARIANT_EVENT_AFTER_SESSION_CLOSED` | `SESSION_CLOSED` 后仍出现该会话的新事件 | 保证会话关闭彻底终结 |
| `INVARIANT_SEQUENCE_START` | 持久事件序号小于 1（如 `sequence: 0`） | 规范持久事件 1-based 序号 |
| `INVARIANT_SEQUENCE_MONOTONIC` | 同一会话事件序号未严格单调递增 | 保证消息队列与续传序号严格可靠 |
| `INVARIANT_CONFIG_IMMUTABLE` | 同一会话内部 `configVersion` 发生漂移 | 禁止 mid-turn 偷换模型或运行时配置 |
| `INVARIANT_SESSION_CONSISTENT` | 同一场景混入多个不同的 `sessionId` | 保证单场景会话隔离性 |

### 显式部分回放模式（`options.isPartialReplay`）
在断线重连、从中途 `subscribeFrom` 消费事件流时，首条事件可能不是 `SESSION_OPENED`，或直接从已开启轮次的调用阶段开始。
此时传入 `options = { isPartialReplay: true, snapshot: { activeTurnId, activeCalls, lastSequence } }`，状态机将以快照作为初始上下文，既不误拒合法的断线续传，又能彻底阻断缺乏快照背书的非法孤立事件。

---

## 6. 协议决策与待 H05/H10/H11 落实的服务语义

以下语义无法单凭传输 Schema 静态判定，必须由运行时服务在后续 Task 中实现保证：
1. **单次结算（Single Settle）**：`respond` 接口对于已终结或超时的 `interactionId` 必须返回 `ALREADY_SETTLED`，严禁重复执行写入副作用（H10/H11）。
2. **事件序号保留窗口与快照重建**：当 `subscribeFrom` 小于服务持久化保留队列下限时，服务返回 `SEQUENCE_EXPIRED`，客户端通过 REST 快照重建界面状态（H03/H07）。
3. **Java 写入治理真值**：Vue 确认弹窗产生的确认决策必须透传至 Java `AgentToolActionService`，由 Java 进行租约锁、版本比对与事务定稿，协议层的 `CONFIRM` 只是用户意图传输通道，不等于 Java 事务已提交（H11）。
4. **Secret 全生命周期隔离**：API Key 仅存在于设置表单内存，传输时不进全局 Store、不入会话日志、不入 EventStream（H04/H08）。
5. **Session 与 Owner 强绑定**：虽然 Schema 排除了 `ownerId`，但 Agent Service 在收到每个带 `identityAssertion` 的请求时，必须由安全中间件解码并校验 Java 签名及颁发者，确保用户不可越权访问他人 `sessionId`（H05）。
