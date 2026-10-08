# H01 证据：MiniMax Code —— Runtime 契约草案与离线验证（Round 2 最终整改）

状态：**READY_FOR_CODEX ROUND2**（本文件不代表验收通过）。仅 H01，不进入 H02～H12。

---

## 0. ACKNOWLEDGED（环境与核验基准）

| 项目 | 实际值 |
| --- | --- |
| workspace / cwd | `/Users/moxiao/IdeaProjects/project-harness-h01-minimax`（显式进入，未在原 Task33 目录操作） |
| 分支 | `codex/harness-h01-minimax-contract` |
| 共同基线 | `f7311079a83b84c5e7f3a9076ce4efccb3044c86`（核对一致） |
| 验收对象 (Round 2 partial) | `docs/verification/harness/h01-round2-partial.md` 及 `h01-round2-partial-probes.json` |
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

## 1. Round 2 部分验收（10:20）缺口与专项整改

Codex 自动复验指出的 4 项具体遗漏已全部整改：

### 1.1 快照强制绑定与部分回放防线（R3 增补）
- **问题**：此前 `validateScenario(..., { isPartialReplay: true })` 在未提供 `snapshot` 时仍直接放行孤立 `TURN_FINISHED`，导致 flag 变成绕过生命周期的漏洞。
- **整改**：
  - 声明 `isPartialReplay: true` 时必须提供合法的 `snapshot` 对象（包含 `sessionId`、`configVersion`、`lastSequence >= 0`），缺少即报错 `INVARIANT_SNAPSHOT_REQUIRED` / `INVARIANT_SNAPSHOT_INVALID`。
  - 只有在 `snapshot.activeTurnId === turnId` 时，该未在消息流中启动的轮次才被允许进入终态或处理调用，否则坚决拒绝（`INVARIANT_TERMINAL_WITHOUT_START` / `INVARIANT_CALL_WITHIN_TURN`）。
  - 只有在 `snapshot.activeCalls[callId] === turnId` 时，未在消息流中启动的调用才被允许终结，否则坚决拒绝（`INVARIANT_CALL_WITHOUT_START`）。
  - 严格核验消息流的 `sessionId` 与 `configVersion` 必须与快照一致。

### 1.2 确认卡与类型化答复强绑定（R2 增补）
- **问题**：`expectedVersion` 曾为可选，导致缺少版本的确认卡仍被放行；`typedRespondTo` 曾保留无 `kind` 的 `answer: string` 兼容分支，导致自由文本答复仍能通过。
- **整改**：
  - `interactionConfirmation` 中 `expectedVersion` 改为 **REQUIRED**，严禁无版本确认卡。
  - `typedRespondTo` 彻底删除无 `kind` 的未标型兼容分支，仅保留明确的 2 个分支：
    1. 问答答复：`kind: "question"`，绑定 `questionId`，携带 `answer`。
    2. 确认答复：`kind: "confirmation"`，绑定 `actionId`，携带 `expectedVersion` 与 `decision: "CONFIRM" | "REJECT"`。
  - 严正拒绝纯文本代替业务确认授权。

### 1.3 决策矛盾实例严格拦截（R2 增补）
- **问题**：`decision: "CONFIRM", confirmed: false` 矛盾载荷此前未被阻止。
- **整改**：
  - Schema 层面通过 `if/then/not` 规则约束：当 `decision: "CONFIRM"` 时禁止 `confirmed: false`；当 `decision: "REJECT"` 时禁止 `confirmed: true`。
  - 校验器层面增加 `INVARIANT_TYPED_RESPOND` 双重互斥断言，任何矛盾决策直接拒绝。

### 1.4 溯源与提交 Hash 规范
- 纠正自引用 Hash 漂移问题：本次采用“功能实现提交 + 独立文档记录提交”分离，真实记录 Git 提交链路。

---

### 1.5 Codex 10:45 追加整改（可选 confirmed 与 questionId 必填）
Codex 独立复验审查实现 `f272aa50` 时发现 2 个新缺陷：
1. **省略可选 `confirmed` 时被误拒**：`typedRespondTo.confirmation` 原声明 `confirmed` 可选，但此前 `allOf` 采用 `not: { properties: { confirmed: { const: false } } }`，在 `confirmed` 缺失时由于无属性报错被 `not` 判定为命中禁止分支并报错。现修正为显式条件判断：`if: { required: ["confirmed"], ... }`，仅在显式提供 `confirmed` 时才约束其与 `decision` 一致；省略 `confirmed` 时仅凭 `decision: "CONFIRM" | "REJECT"` 合法生效，矛盾双字段（如 CONFIRM+false、REJECT+true）坚决拒绝。
2. **强制 `interactionQuestion.questionId` 必填**：此前 `interactionQuestion` 的 `questionId` 未设为必填，导致前端缺少关联锚点。现将其设为必填（REQUIRED），并补充缺失 `questionId` 的负例与专项测试，确保问答往返闭环。

---

## 2. RED 证据（先于生产改动）

在整改实现前，4 个专项 probe 表现为 ACCEPTED（即漏项）：
```
Probe 1 (partial replay terminal without snapshot): accepted: true -> 应当拒绝
Probe 2 (CONFIRM with confirmed false): accepted: true -> 应当拒绝
Probe 3 (confirmation card missing expectedVersion): accepted: true -> 应当拒绝
Probe 4 (untyped natural language response): accepted: true -> 应当拒绝
```

同时回归测试出现 3 项失败（包含快照参数不全、版本缺失与矛盾决策未拦截）。

---


### 2.3 10:45 追加整改的 RED 证据
在修复前验证两项缺陷：
```
1. 省略 confirmed 的合法确认答复:
   SCHEMA: $/respondTo 命中禁止分支 (not) -> 真实缺陷：合法正例被误拒！
2. 缺失 questionId 的 question 卡:
   validateMessage 返回 true [] -> 真实缺陷：未包含必须锚点却被放行！
```

---

## 3. GREEN 证据（整改后）

### 3.1 本地测试套件全绿（91/91 项通过）
```bash
$ cd /Users/moxiao/IdeaProjects/project-harness-h01-minimax
$ node --test scripts/harness/runtime-contract.test.mjs
✔ contract declares a draft protocol version and is structurally closed (1.42ms)
✔ valid message accepted: request.open.create (0.99ms)
...
✔ valid message accepted: event.progress (0.29ms)
✔ valid message accepted: event.ui-action (0.30ms)
✔ valid message accepted: event.interaction-required.question (0.36ms)
✔ valid message accepted: event.interaction-required.confirmation (0.35ms)
✔ valid message accepted: request.respond.confirmation (0.31ms)
...
✔ invalid message rejected: invalid.respond-confirmation-decision-confirmed-conflict (0.48ms)
✔ invalid message rejected: invalid.respond-untyped-without-kind (0.37ms)
✔ invalid message rejected: invalid.respond-confirmation-missing-expected-version (0.42ms)
✔ invalid message rejected: invalid.respond-question-missing-question-id (0.43ms)
✔ invalid message rejected: invalid.confirmation-card-missing-expected-version (0.32ms)
✔ invalid scenario rejected: invalid.scenario.partial-replay-without-snapshot (0.14ms)
...
✔ R3: scenario rejects terminal before TURN_STARTED (0.16ms)
✔ R3: scenario rejects CALL_FINISHED without matching CALL_STARTED (0.30ms)
✔ R3: scenario rejects duplicate TURN_STARTED for same turnId (0.20ms)
✔ R2: question event with renderable question data accepted (0.33ms)
✔ R2: confirmation event with renderable confirmation data accepted (0.36ms)
✔ R2: typed respond for confirmation requires decision and rejects plain text answer (1.41ms)
✔ R1: PROGRESS event accepts structured progress and rejects unknown fields (0.76ms)
✔ R1: UI_ACTION event accepts closed whitelisted action and rejects arbitrary URL/selector (0.47ms)
✔ R3: scenario partial replay succeeds when backed by snapshot state (0.58ms)
ℹ tests 91
ℹ suites 0
ℹ pass 91
ℹ fail 0
ℹ skipped 0
ℹ duration_ms 83.37ms
```

### 3.2 Codex 10:20 独立探针结果核验
4 项部分验收探针现已全部按预期拒绝：
1. `partial replay terminal without snapshot` -> `accepted: false` (`INVARIANT_SNAPSHOT_REQUIRED`)
2. `CONFIRM with confirmed false` -> `accepted: false` (`INVARIANT_TYPED_RESPOND` + `SCHEMA`)
3. `confirmation card missing expectedVersion` -> `accepted: false` (`SCHEMA`)
4. `untyped natural language response` -> `accepted: false` (`SCHEMA` + `INVARIANT_TYPED_RESPOND`)

同时 Codex Round 1 探针脚本 `h01-round1-probes.mjs` 保持全量通过（5 项探针 + 12 项事件映射全覆盖）。

### 3.3 契约自身结构自检
- `findTypeArrays(contract)` → `[]`（无任何类型数组，Harness 友好）
- `findOpenObjects(contract)` → `[]`（所有对象严格 `additionalProperties: false` 封闭）

---

## 4. 交付文件清单

| 文件 | 变更说明 |
| --- | --- |
| `contracts/agent-runtime/runtime.schema.json` | 强制 `interactionConfirmation.expectedVersion`；强制 `typedRespondTo` 仅双分支（删除未标型文本分支）；约束 `decision` 与 `confirmed` 强一致 |
| `contracts/agent-runtime/README.md` | 补充快照约束（`isPartialReplay` 必要前提）、强版本确认答复、决策冲突拦截及 Schema 域隔离声明 |
| `scripts/harness/runtime-contract.mjs` | 状态机实现严格快照上下文比对（未提供有效快照直接拒绝）；双重拦截 `decision` 与 `confirmed` 矛盾决策 |
| `scripts/harness/runtime-contract.fixtures.json` | 增加决策冲突、省略 confirmed 正例、无类型回复、缺失 expectedVersion、缺失 questionId、无快照部分回放等实例（67 例） |
| `scripts/harness/runtime-contract.test.mjs` | 测试套件扩充至 91 项，包含省略 confirmed 正例、矛盾决策反例、缺失 questionId 反例等 |
| `docs/verification/harness/h01-minimax.md` | 本交付证据文档 |

---

## 5. 待 H05/H10/H11 落实的服务语义（非本轮静态 Schema 职责）

1. **单次结算保护（Single Settle）**：`respond` 重复调用返回 `ALREADY_SETTLED`（H10/H11）。
2. **事件保留窗口与快照回退**：`subscribeFrom` 超限返回 `SEQUENCE_EXPIRED`，前端由 REST 快照重建（H03/H07）。
3. **Java 写入治理真值**：协议层的 `CONFIRM` 只是意图传递，真正的写入锁、版本比对与幂等由 Java 后端在 H11 终审定稿。
4. **Secret 不落痕迹**：API Key 仅在表单提交瞬时存在内存，全链路日志/事件流不出现（H04/H08）。
5. **Session 与 Owner 强绑定**：中间件必须校验 Java 身份签发者与受众，防越权读取他人会话（H05）。

---

## 6. 本地提交记录

- 实现提交 Hash：`d3a491db26811461ba692a1fc85a92b4522a4daf`
- 证据提交 Hash：`<本提交>`
- 分支：`codex/harness-h01-minimax-contract`
- 基线：`f7311079a83b84c5e7f3a9076ce4efccb3044c86`
- 状态：已本地提交，未 push，停止等待 Codex 独立复验。
