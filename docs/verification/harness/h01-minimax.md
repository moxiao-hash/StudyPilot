# H01 证据：MiniMax Code —— Runtime 契约草案与离线验证

状态：**READY_FOR_CODEX**（本文件不代表验收通过）。仅 H01，不进入 H02～H12。

## 0. ACKNOWLEDGED（开工前实际核对）

| 项目 | 实际值 |
| --- | --- |
| workspace / cwd | `/Users/moxiao/IdeaProjects/project-harness-h01-minimax`（命令显式 `cd`；应用 workspace 标签仍显示旧 Task33，未在旧目录代替执行） |
| 分支 | `codex/harness-h01-minimax-contract` |
| 共同基线 | `f7311079a83b84c5e7f3a9076ce4efccb3044c86`（与任务书一致，`git rev-parse HEAD` 核对通过） |
| 可访问性 | 可访问：工作树、`docs/dispatch/h01-minimax.md`、`docs/协同开发交接说明.md`、设计与 H01～H12 计划、`docs/verification/harness/h01-baseline-provenance.json` 全部读到 |
| 当前 UI 模型标签 | `deepseek-flash`（本会话环境声明的模型标签） |
| 真实 provider model ID | **未知**（未通过额外调用探测，符合任务书要求） |

只读确认：原 Task33 工作树未改动；未 push / merge / deploy；未改模型或密钥；未重启服务；
未做真实模型评测；未操作业务数据库；未改 `ai-service/**`、`web/**`、根脚本、共享计划与交接文档、Obsidian。

## 1. 交付物（仅本轮所有权文件）

| 文件 | 说明 |
| --- | --- |
| `contracts/agent-runtime/runtime.schema.json` | Runtime 契约草案（JSON Schema 2020-12，23 个顶层 `oneOf` 变体、44 个 `$defs`） |
| `contracts/agent-runtime/README.md` | 约定、操作/事件/结束原因表、约束强制层级、待冻结决定 |
| `scripts/harness/runtime-contract.mjs` | 离线校验器（JSON Schema 子集 + 跨字段/跨消息不变量；仅 Node 内置模块） |
| `scripts/harness/runtime-contract.fixtures.json` | 52 个离线实例（22 有效消息 + 2 有效场景 + 22 无效消息 + 6 无效场景） |
| `scripts/harness/runtime-contract.test.mjs` | 离线回归测试（55 项） |
| `docs/verification/harness/h01-minimax.md` | 本证据文件 |

未创建 `agent-service/**`、`agent-plugins/**`、`contracts/agent-capabilities/**`
（后者属 H02，任务书明确不得提前实现 Manifest）。

## 2. RED（先于实现）

新增离线可执行逻辑先写失败测试。校验器与契约尚不存在时：

```
$ node --test scripts/harness/runtime-contract.test.mjs
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
  '.../scripts/harness/runtime-contract.mjs'
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

## 3. GREEN（实现后）

```
$ node --test scripts/harness/runtime-contract.test.mjs
ℹ tests 55
ℹ suites 0
ℹ pass 55
ℹ fail 0
ℹ skipped 0
```

契约自身结构检查（同一套测试内的独立断言）：

- `findTypeArrays(contract)` → `[]`：**任何位置都没有 `type: [T, "null"]` 类型数组**，
  null 一律用互斥分支表达（与接入设计中 Harness 不支持类型数组的结论对齐，避免二次翻译）。
- `findOpenObjects(contract)` → `[]`：**所有 object 都是 `additionalProperties:false`**，
  未知字段必须被拒绝。

负例拒绝信息示例（证明检查有实际作用，而非空跑）：

```
invalid.max-tokens-reported-as-success
  INVARIANT_TERMINAL_OK: $/payload ok=true 与 endReason=MAX_TOKENS 不一致（只有 COMPLETED 为成功）
invalid.extra-root-field
  SCHEMA: $ 必须精确匹配 oneOf 的一个分支，实际匹配 0 个
  SCHEMA: $ 最接近分支的具体错误: SCHEMA: $ 存在未允许的额外字段 "unexpectedField"
invalid.client-supplied-owner-id
  SCHEMA: $ 最接近分支的具体错误: ...
  INVARIANT_FORBIDDEN_FIELD: $/ownerId 禁止出现（模型 Secret 或客户端自报 owner 授权）
invalid.respond-payload-belongs-to-another-operation
  SCHEMA: $ 最接近分支的具体错误: SCHEMA: $ 缺少必需字段 "respondTo" | 存在未允许的额外字段 "subscribeFrom"
invalid.scenario.event-after-terminal
  INVARIANT_EVENT_AFTER_TERMINAL: 场景第 1 条 轮次 turn-000000000001 已终结，仍出现 ASSISTANT_MESSAGE
```

## 4. 覆盖情况

### 4.1 契约覆盖（派发要求逐项）

| 要求 | 落实 |
| --- | --- |
| 版本 | `protocolVersion` 固定 `"1.0-draft"`，破坏性变更升主版本 |
| identity / session / turn / call / request / configVersion | `$defs` 中分别定义；`configVersion` 前缀 `cfg-`，会话内不可变 |
| open / create / resume / prompt / cancel / steer / respond / subscribe / close | 9 个操作各有独立 `oneOf` 变体，**每个都有有效实例**（见 4.3） |
| 事件序号 | `sequence` 整数且会话内严格递增 |
| 结束原因与错误/恢复语义 | `endReason` 六值 + `errorCode` 十三值；`SEQUENCE_EXPIRED`/`SEQUENCE_OUT_OF_RANGE`/`ALREADY_SETTLED` 覆盖重连与重复答复边界 |
| 区分 capability denied / budget exhausted / max tokens / cancelled / failed / completed | `endReason` 六值枚举 |
| 不把 token 耗尽当成功 | `TURN_FINISHED.payload.ok` 必须与 `endReason` 一致，不一致即 `INVARIANT_TERMINAL_OK`；三个反例（max tokens 报成功、预算耗尽报成功、完成报失败）均被拒绝 |
| 字段不含 Secret 或客户端 owner 授权 | 契约内无此类字段；`INVARIANT_FORBIDDEN_FIELD` 递归拒绝 16 个保留名（含 `ownerId`/`owner`/`apiKey`/`secret` 等） |
| 明确草案待冻结、不实现完整 Agent Service | `README.md` 标注 DRAFT 并列出 6 项待 Codex 冻结决定；未创建 `agent-service/**` |

### 4.2 有效/无效实例分布（52 例）

| 类别 | 数量 | 覆盖 |
| --- | --- | --- |
| 有效消息 | 22 | **全部 9 个操作**、**全部 11 种事件类型**、3 种响应状态（含 `NO_OP` 幂等关闭、`REJECTED`+`SEQUENCE_EXPIRED`） |
| 有效场景 | 2 | happy path（含工具调用后继续、终态 `COMPLETED`）、预算耗尽路径（`ERROR`+终态非成功） |
| 无效消息 | 22 | 额外字段、Secret 字段、客户端 ownerId、错误版本、未知操作、缺必需字段、payload 串位、类型错误、模式错误、非 UTC 时间戳、缺/错 `endReason`、事件缺 `turnId`、事件与 payload 不匹配、三种 `ok` 不一致、响应与 error 不匹配、scopes 重复 |
| 合计 | 52 | 55 项测试 = 52 个实例用例 + 契约结构检查 + 操作/事件/响应覆盖检查 + fixture 唯一性检查 |
| 无效场景 | 6 | 序号回退、轮次重复终态、终态后仍有事件、`configVersion` 中途变更、会话标识混用、调用先于 TURN_STARTED |

规则分布：`SCHEMA` 17 例，`INVARIANT_*` 11 例（`TERMINAL_OK` 3、`FORBIDDEN_FIELD` 2、
`SEQUENCE_MONOTONIC`、`TURN_TERMINAL_ONCE`、`EVENT_AFTER_TERMINAL`、`CONFIG_IMMUTABLE`、
`SESSION_CONSISTENT`、`CALL_WITHIN_TURN` 各 1）。

契约结构检查同时断言：全部 9 个操作、11 种事件类型在有效实例中各至少出现一次
（避免“定义了却从未被正向验证”的字段）。

### 4.3 schema 表达不了的约束

已离线强制的用 `INVARIANT_*` 实现；无法离线判定的在
`contracts/agent-runtime/README.md` §5 逐条列出并指定归属 Task，包括：
`respond` 只结算一次（H10）、序号保留窗口与快照重建（H03）、`close` 幂等语义、
身份有效期/audience/scope 校验（H05）、owner 解析与跨 owner 隔离（H05）、
Secret 全链路策略（H04/H05/H07）、跨进程真实顺序与投递（H03 起）、工具 schema 投影（H02/H06）。

## 5. 只读盘点：Java / Python 身份、预算、配置迁移点

只读检查，**未修改任何后端或 AI 文件**。证据层级：静态源码阅读。

| 区域 | 当前入口 | 现状 | 后续迁移依赖 / 风险 |
| --- | --- | --- | --- |
| 模型凭据（浏览器→Java） | `backend/.../aicredential/api/AiCredentialController.java`（`/api/ai-settings`，GET/PUT/deepseek-key/tavily-key） | 浏览器把模型 Key 交给 Java 保存 | H04/H08 接独立 Agent Config 后，H12 才退役该入口；迁移前不能宣称已解耦 |
| 模型凭据（Java→Python） | `backend/.../aicredential/api/InternalAiCredentialController.java`（`/internal/ai-credentials/{provider}` → `RuntimeCredentialResponse(String apiKey)`） | **Java 直接把明文模型 Key 返回给 Python** | 这是核心解耦点：Agent Service 必须改为从自有加密 Secret 域解析；H12 前不得删除旧 API |
| Python 凭据解析 | `ai-service/app/providers/credentials.py`（`CredentialResolver.resolve`） | 调 Java 取 Key；**仅 404 才回退环境默认值**，其它错误抛 `CredentialServiceUnavailableError` | 迁移时保留“错误不静默降级”的语义；新路径要按 owner 解析，不能退回服务器默认身份 |
| Python 模型装配 | `ai-service/app/providers/model_factory.py`（`create_chat_model`）、`providers/budgeted_model.py`、`providers/budget.py` | 统一包 `BudgetedChatModel` + `ModelBudgetGuard`，在模型边界预占 | H05 的预算插件必须挂在**同一 `llm/stream` 边界**并覆盖压缩/重试/子 Agent；`max-tokens` 的结束原因不得被当作业务完成 |
| Python 用量上报 | `ai-service/app/observability/usage.py` → `clients/java_backend.py`（`record_assistant_usage`、`reserve_assistant_usage`、`release_assistant_usage_reservation`） | Java 是预算与用量的真值来源 | Agent Service 需按 owner 预占/上报/释放；重复上报要幂等，取消要释放 |
| Java 预算入口 | `backend/.../agent/usage/InternalAssistantUsageController.java`（`/internal/assistant-usage`、`/reservations`、`/reservations/{id}/release`、`/budget?ownerId=`） | 预算真值在 Java | `/budget` 以 **query 参数 ownerId** 取数：Agent Service 侧必须禁止模型提供 ownerId，只能使用凭据解析出的 owner（H05 校验） |
| Python 服务配置 | `ai-service/app/core/settings.py`（`model_provider`、`model_base_url=https://api.deepseek.com`、`model_name=deepseek-v4-flash`、`deepseek_api_key`、`tavily_api_key`、`java_backend_base_url=http://localhost:8080`） | provider/endpoint/model 目前来自服务端环境配置 | 设计第 4 条要求 provider/base URL/model/Key 归独立 Agent Config；H04 建独立域，H12 迁移全部旧消费者 |
| Java 内网鉴权 | `auth/security/InternalServiceTokenFilter`（`X-Internal-Service-Token`，缺失/错误返回 401） | 服务间共享静态令牌 | 新 Agent Service 需要独立、可撤销、限定 owner/audience/scope 的接入凭据（H05）；不应复用可无限期的共享令牌 |
| Java 用户身份 | `auth/security/AuthenticatedUser` + `SecurityConfig`（`anyRequest().authenticated()`，`/api/auth/**` 与 `/actuator/health` 除外） | 浏览器登录态 | Agent 接入凭据要由该身份签发，且不与模型 Key 混用 |
| 工具桥 | `agent/api/InternalAgentToolController`（`/internal/agent-tools/catalog`、`/{toolName}/invoke`）、`AgentToolRegistry`（65536 字节输出上限） | Java 是工具与输出契约真值 | H02 的 Manifest 必须由真实描述符编译；H06 需处理 nullable→`oneOf` 与点号名称投影；**截断不是完整证据、空数据是有效 null、HTTP 失败不得伪装成无数据**（本契约的事件/错误语义已与其对齐） |

## 6. 未覆盖 / 限制

1. **离线层级**：本文件全部证据为离线静态检查与纯 Node 校验，不含 provider / production 证据，
   也未启动任何服务或调用模型。
2. **未实现**：完整 Agent Service、Runtime 适配、控制桥、Capability Manifest（H02）、16 个固定评测场景
   （由 DeepSeek Harness 负责）均未开始；本草案不宣称可运行。
3. **契约未冻结**：`protocolVersion` 仍为 `1.0-draft`；README §6 的 6 项决定待 Codex 冻结。
4. **不覆盖**：真实跨进程顺序/延迟/投递语义、序号保留窗口的实际大小、Secret 是否真的不入日志
   （需 H04/H05 测试），以及真实前端与悬浮球行为（ZCode）。
5. **快照工件**：`backend/mvnw.cmd` 在本树显示为已修改，是快照 CRLF 规范化差异（见 Codex 的
   `docs/verification/harness/h01-baseline-note.md`），**非本 Agent 改动，本 Agent 未提交也未恢复该文件**。
6. `docs/verification/harness/h01-baseline-note.md` 由 Codex 创建，属共享文档，未纳入本 Agent 提交。

## 7. 提交与文件清单

只提交本轮所有权文件（见 §1）；不含 `backend/**`、`ai-service/**`、`web/**`、
共享计划/交接/基线文件或 Obsidian。**未 push**。

commit：`<见 READY_FOR_CODEX 回执>`（本地）

复跑命令：

```bash
cd /Users/moxiao/IdeaProjects/project-harness-h01-minimax
node --test scripts/harness/runtime-contract.test.mjs
```
