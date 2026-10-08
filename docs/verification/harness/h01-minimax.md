# H01 证据：MiniMax Code —— Runtime 契约草案与离线验证（Round 2 整改交付）

状态：**READY_FOR_CODEX ROUND2**（本文件不代表验收通过）。仅 H01，不进入 H02～H12。

---

## 0. ACKNOWLEDGED（环境与核验基准）

| 项目 | 实际值 |
| --- | --- |
| workspace / cwd | `/Users/moxiao/IdeaProjects/project-harness-h01-minimax`（命令显式 `cd`；宿主应用标签仍显示旧 Task33，未在旧目录顶替执行） |
| 分支 | `codex/harness-h01-minimax-contract` |
| 共同基线 | `f7311079a83b84c5e7f3a9076ce4efccb3044c86`（核对一致） |
| 验收对象 (Round 1) | `6371c8439ae81fba6270a0136d3c3028df74e73d`（交付实现 `7930399`） |
| Codex 审阅意见 | `CHANGES_REQUESTED`，按 `docs/verification/harness/h01-codex-round1.md` 落实 R1/R2/R3 整改 |
| 当前 UI 模型标签 | `deepseek-flash` |
| 真实 provider model ID | **未知**（未通过额外调用探测，符合任务书要求） |

边界守则执行情况：
- 原 Task33 工作树未触碰、未改动；
- 未 push / merge / deploy；
- 未改动生产模型配置或 API 密钥；
- 未重启服务、未做真实模型评测、未操作业务数据库；
- 未触碰 `ai-service/**`、`web/**`、根脚本、共享交接或 Obsidian 档案；
- `backend/mvnw.cmd` 属已知基线 CRLF 快照工件，未提交亦未恢复。

---

## 1. Round 1 审查缺口与 R1/R2/R3 整改清单

Codex 独立验收在 `docs/verification/harness/h01-codex-round1.md` 中指出了第一轮交付的 3 个主要缺陷，并在 `docs/verification/harness/h01-round1-probes.json` 中给出了失败反例：

1. **R1 [P1] 三端协议未对齐**：
   - 前端草案小写事件名与公共 Schema 不一致。
   - 裁决：以公共 Schema 全大写（UPPERCASE）事件名、`protocolVersion: "1.0-draft"` 为唯一标准。
   - 补充 `PROGRESS` 事件（结构化承载阶段描述、步数、`CONTEXT_LOADED`、`PLAN_HINT`，不限制模型原推理循环）。
   - 补充 `UI_ACTION` 事件（严格封闭的白名单客户端指令：`NAVIGATE`、`OPEN_MODAL`、`PREFILL_FORM`、`REFRESH_RESOURCE`、`FOCUS_ELEMENT`，封闭 `routeKey` 与受限参数，严禁任意 URL 或选择器）。
   - 补充 `CALL_FINISHED` 丰富元数据：`status` (`SUCCEEDED`/`FAILED`/`PENDING`/`DENIED`)、`truncated`、`originalBytes`、`error`、`resultPreview`，事实被忠实表达而不被吞噬。
   - 规范事件 `sequence >= 1`，`subscribeFrom: 0` 表示从首条事件订阅。
2. **R2 [P1] 交互提问与业务确认不可渲染，答复退化为文本**：
   - `INTERACTION_REQUIRED` 扩充可渲染载荷：
     - `kind: "question"` 包含结构化 `question` 对象（`questionId`、`prompt`/`text`、可选 `options` 选项列表、`selectionMode`）。
     - `kind: "confirmation"` 包含结构化 `confirmation` 对象（`executionId`、`actionId`、`toolName`、`summary`、`expectedVersion`、`riskLevel`、`expiresAt`）。
   - `request.respond` 支持类型化答复（`respondTo`）：
     - 区分问答答复（`questionId` + `answer`）与业务确认决策（`actionId` + `decision: "CONFIRM"|"REJECT"` + `confirmed`）。
     - **红线**：严禁仅以自由文本代替业务确认授权！
   - **传输 Schema 与 Harness 工具 Schema 隔离声明**：本契约属于传输层 Draft 2020-12 规范，不等于 Harness 内部工具解析器支持的子集，不得声称直接进入 Harness 工具定义。
3. **R3 [P1] 全量轨迹校验接受不可能的生命周期**：
   - 状态机完善：覆盖未启动终态拒绝、重复启动拒绝、孤立/跨轮次调用拒绝、会话关闭后活动拒绝、轮次结束时未闭合调用拒绝。
   - 支持显式部分回放模式（`options.isPartialReplay` 与 `options.snapshot`），合法支持中途断线重连。

---

## 2. RED 证据（先于生产改动）

在修改实现前，通过独立反例脚本与单元测试证实缺陷存在：

### 2.1 Codex 独立探针（`h01-round1-probes.mjs`）Round 1 失败结果
```json
[
  { "name": "terminal before TURN_STARTED", "expectedReject": true, "actualAccepted": true },
  { "name": "CALL_FINISHED without matching CALL_STARTED", "expectedReject": true, "actualAccepted": true },
  { "name": "duplicate TURN_STARTED", "expectedReject": true, "actualAccepted": true },
  { "name": "question event with renderable question data", "expectedReject": false, "actualAccepted": false }
]
```

### 2.2 专项测试失败记录
在 `scripts/harness/runtime-contract.test.mjs` 中添加针对 R1/R2/R3 的断言后直接运行：
```
✖ R3: scenario rejects terminal before TURN_STARTED
  AssertionError: 未启动轮次出现终态必须被拒绝 (expected false, actual true)
✖ R3: scenario rejects CALL_FINISHED without matching CALL_STARTED
  AssertionError: 孤立 CALL_FINISHED 必须被拒绝 (expected false, actual true)
✖ R3: scenario rejects duplicate TURN_STARTED for same turnId
  AssertionError: 同一轮次重复 TURN_STARTED 必须被拒绝 (expected false, actual true)
✖ R2: question event with renderable question data accepted
  AssertionError: 可渲染 question 必须被接受，实际错误: SCHEMA: $/payload 存在未允许的额外字段 "question"
```

---

## 3. GREEN 证据（整改后）

### 3.1 本地测试套件全绿（79/79 项通过）
```bash
$ cd /Users/moxiao/IdeaProjects/project-harness-h01-minimax
$ node --test scripts/harness/runtime-contract.test.mjs
✔ contract declares a draft protocol version and is structurally closed (1.44ms)
✔ valid message accepted: request.open.create (0.92ms)
...
✔ valid message accepted: event.progress (0.31ms)
✔ valid message accepted: event.ui-action (0.33ms)
✔ valid message accepted: event.interaction-required.question (0.43ms)
✔ valid message accepted: event.interaction-required.confirmation (0.36ms)
✔ valid message accepted: request.respond.confirmation (0.32ms)
✔ valid message accepted: event.call-finished.enriched (0.29ms)
...
✔ invalid message rejected: invalid.respond-confirmation-with-text-only (0.86ms)
✔ invalid message rejected: invalid.interaction-question-without-text-or-prompt (0.80ms)
✔ invalid message rejected: invalid.interaction-confirmation-without-action-id (0.56ms)
✔ invalid message rejected: invalid.ui-action-with-arbitrary-url (0.56ms)
✔ invalid message rejected: invalid.sequence-zero (0.43ms)
...
✔ invalid scenario rejected: invalid.scenario.terminal-without-started (0.19ms)
✔ invalid scenario rejected: invalid.scenario.duplicate-turn-started (0.25ms)
✔ invalid scenario rejected: invalid.scenario.call-finished-without-started (0.23ms)
✔ invalid scenario rejected: invalid.scenario.duplicate-call-started (0.39ms)
✔ invalid scenario rejected: invalid.scenario.event-after-session-closed (0.19ms)
...
✔ R3: scenario rejects terminal before TURN_STARTED (0.21ms)
✔ R3: scenario rejects CALL_FINISHED without matching CALL_STARTED (0.24ms)
✔ R3: scenario rejects duplicate TURN_STARTED for same turnId (0.20ms)
✔ R2: question event with renderable question data accepted (0.41ms)
✔ R2: confirmation event with renderable confirmation data accepted (0.31ms)
✔ R2: typed respond for confirmation requires decision and rejects plain text answer (1.11ms)
✔ R1: PROGRESS event accepts structured progress and rejects unknown fields (0.69ms)
✔ R1: UI_ACTION event accepts closed whitelisted action and rejects arbitrary URL/selector (0.46ms)
✔ R3: scenario partial replay succeeds when backed by snapshot state (0.58ms)
ℹ tests 79
ℹ suites 0
ℹ pass 79
ℹ fail 0
ℹ skipped 0
ℹ duration_ms 84.27ms
```

### 3.2 Codex 独立反例探针验证（全量符合预期）
运行 `node /Users/moxiao/IdeaProjects/project/docs/verification/harness/h01-round1-probes.mjs`：
```json
[
  { "name": "terminal before TURN_STARTED", "expectedReject": true, "actualAccepted": false },
  { "name": "CALL_FINISHED without matching CALL_STARTED", "expectedReject": true, "actualAccepted": false },
  { "name": "duplicate TURN_STARTED", "expectedReject": true, "actualAccepted": false },
  { "name": "turn content after terminal (control)", "expectedReject": true, "actualAccepted": false },
  { "name": "question event with renderable question data", "expectedReject": false, "actualAccepted": true, "errors": [] },
  { "name": "unchanged baseline (control)", "expectedReject": false, "actualAccepted": true },
  { "name": "same HEAD but modified core loop hash", "expectedReject": true, "actualAccepted": false },
  { "name": "same bundles but changed profile hash", "expectedReject": true, "actualAccepted": false },
  { "name": "frontend proposed event names vs Runtime schema", "runtimeEventTypes": [ ...全部 13 种事件... ], "mappings": [ ...全部 12 项 legacy 均 inSchema: true... ] }
]
```

### 3.3 契约自身结构断言（Harness 兼容性）
- `findTypeArrays(contract)` → `[]`：**无任何 `type: [T, "null"]` 数组**。
- `findOpenObjects(contract)` → `[]`：**所有对象类型均 `additionalProperties: false`**。

---

## 4. 交付文件清单与变更说明

| 文件 | 变更说明 |
| --- | --- |
| `contracts/agent-runtime/runtime.schema.json` | 增加 `event.progress`、`event.uiAction`；富化 `CALL_FINISHED`、`INTERACTION_REQUIRED`（question/confirmation）与 `request.respond`（typedRespondTo）；规范 `sequence >= 1` |
| `contracts/agent-runtime/README.md` | 补充 Codex R1 裁决（全大写命名、进度与 UI 动作封闭、序号规则）；补充 R2 交互渲染与结构化确认决策；声明传输 Schema 与 Harness 工具 Schema 隔离；补充 R3 全量状态机规则与部分回放快照规范 |
| `scripts/harness/runtime-contract.mjs` | 状态机实现 `INVARIANT_TERMINAL_WITHOUT_START`、`INVARIANT_DUPLICATE_TURN_START`、`INVARIANT_CALL_WITHOUT_START`、`INVARIANT_DUPLICATE_CALL_START`、`INVARIANT_CALL_CROSS_TURN`、`INVARIANT_EVENT_AFTER_SESSION_CLOSED`、`INVARIANT_PENDING_CALL_AT_TURN_END`、`INVARIANT_TYPED_RESPOND`；支持 `options.isPartialReplay` |
| `scripts/harness/runtime-contract.fixtures.json` | 增补至 65 个正反用例（覆盖问答/确认渲染、类型化答复、进度、UI动作、无开始终态、孤立完成、重复启动、关闭后活动、序号0等） |
| `scripts/harness/runtime-contract.test.mjs` | 增补至 79 项断言，包含 R1/R2/R3 专项测试与快照支撑的部分回放通过断言 |
| `docs/verification/harness/h01-minimax.md` | 本交付证据文档 |

---

## 5. 待 H05/H10/H11 落实的服务语义（非本轮静态 Schema 职责）

以下服务层业务语义由契约记录，但不伪装为纯 Schema 即可保证，将在对应 Task 由服务代码落地：
1. **单次结算保护（Single Settle）**：`respond` 重复调用返回 `ALREADY_SETTLED`（H10/H11）。
2. **事件保留窗口与快照回退**：`subscribeFrom` 超限返回 `SEQUENCE_EXPIRED`，前端由 REST 快照重建（H03/H07）。
3. **Java 写入治理真值**：协议层的 `CONFIRM` 只是意图传递，真正的写入锁、版本比对与幂等由 Java 后端在 H11 终审定稿。
4. **Secret 不落痕迹**：API Key 仅在表单提交瞬时存在内存，全链路日志/事件流不出现（H04/H08）。
5. **Session 与 Owner 强绑定**：中间件必须校验 Java 身份签发者与受众，防越权读取他人会话（H05）。

---

## 6. 本地提交记录

- 提交 Hash：`8d031fb375b5d52557ee6ae6bc98de400557d355`（最终 amend HEAD）
- 分支：`codex/harness-h01-minimax-contract`
- 基线：`f7311079a83b84c5e7f3a9076ce4efccb3044c86`
- 状态：已本地提交，未 push，等待 Codex 独立验收。
