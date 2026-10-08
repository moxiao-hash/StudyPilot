# H01 验证证据：前端兼容基线、事件映射与消费侧需求 (ZCode)

- **执行 Agent**：ZCode
- **驱动模型标签**：`f535ffb7-ab30-473f-bf6a-477b0323d8a8/gemini-3.8-flash-high`（真实 Provider Model ID：未知）
- **测试等级**：`[OFFLINE_BASELINE]` / `[STRUCTURAL_AUDIT]` / `[FIXTURE_VALIDATION]`
- **执行时间**：2026-10-08 (Asia/Shanghai)
- **工作树路径**：`/Users/moxiao/IdeaProjects/project-harness-h01-zcode`
- **关联分支**：`codex/harness-h01-zcode-baseline`
- **共同基线 HEAD**：`f7311079a83b84c5e7f3a9076ce4efccb3044c86`
- **所有权边界**：独占 `scripts/harness/frontend-baseline*`、`web/tests/harness-baseline/**`、`docs/verification/harness/h01-zcode.md`；未修改现有 `web/src/**` 生产组件，未触碰 `backend/**`、`contracts/agent-runtime/**`，未合并 `main`，未启动 Task H02。
- **交付状态**：**READY_FOR_CODEX**（等待 Codex 独立技术验收）

---

## 1. 开始前环境与基线核对

1. **实际 Workspace / cwd / Branch**：
   - 实际工作树目录：`/Users/moxiao/IdeaProjects/project-harness-h01-zcode`
   - Git 分支：`codex/harness-h01-zcode-baseline`
   - 起始基线提交：`f7311079a83b84c5e7f3a9076ce4efccb3044c86`
   - 工作树可访问性：完全可读可写，已通过独立命令测试。
   - 原 Task 33 工作树（`/Users/moxiao/IdeaProjects/project-zcode-task-33`）保持原样，零修改。
2. **基线来源溯源 (`h01-baseline-provenance.json`)**：
   - 本工作树快照继承了 ZCode Task 33 (`0fe122d2169ed4a9ec6e3a1e65ce514883b0fb40`) 的 `web` 与 `ai-service` 现场及后续已通过的本地修复。
3. **操作禁令遵守**：
   - 未执行 `git push`、`git merge`、`deploy`；
   - 未更改应用模型配置与任何平台密钥；
   - 未重启现有服务或操作业务数据库；
   - 未调用真实付费模型进行跑分评测；
   - 未提前编写 H07 悬浮球生产代码或删除旧页面。

---

## 2. 前端路由与界面全量只读盘点

基于 `web/src/app/router.ts` 与 `web/src/components/AppShell.vue` 的真实源码，当前前端共包含 **31 个具名路由**与 **1 个顶层布局路由**：

### 2.1 路由分类清单

| 路由名称 | 访问路径 | 页面组件 | 访问权限 | 说明与后续迁移点 |
| :--- | :--- | :--- | :--- | :--- |
| **login** | `/login` | `LoginView.vue` | `public: true` | 公开登录页；未登录会话重定向目标 |
| **register** | `/register` | `RegisterView.vue` | `public: true` | 公开注册页 |
| **not-found** | `/:pathMatch(.*)*` | `NotFoundView.vue` | `public: true` | 公开 404 兜底页 |
| **assistant** | `/` | `AssistantView.vue` | 需认证 | 当前主 Agent 聊天首页（旧入口，H07 悬浮球验收后逐步退役为只读历史或保留兼容） |
| **dashboard** | `/dashboard` | `DashboardView.vue` | 需认证 | 工作台首页；未来悬浮球首批挂载与上下文感知业务页面 |
| **roadmap** | `/roadmap` | `RoadmapView.vue` | 需认证 | Java + AI 学习路线图总览 |
| **roadmap-stage** | `/roadmap/stages/:id` | `StageView.vue` | 需认证 | 路线阶段详情 |
| **roadmap-module** | `/roadmap/modules/:id` | `ModuleView.vue` | 需认证 | 路线模块详情 |
| **roadmap-node** | `/roadmap/nodes/:id` | `NodeView.vue` | 需认证 | 知识节点详情与学习循环（测验/代码/打卡） |
| **goals** | `/goals` | `GoalsView.vue` | 需认证 | 学习目标列表与创建 |
| **courses** | `/courses` | `CourseCatalogView.vue` | 需认证 (`legacy`) | 历史课程目录（旧版本兼容） |
| **course-detail** | `/courses/:slug` | `CourseDetailView.vue` | 需认证 (`legacy`) | 历史课程详情 |
| **lesson** | `/lessons/:lessonId` | `LessonView.vue` | 需认证 (`legacy`) | 历史课时播放页（旧版本兼容） |
| **plans** | `/plans` | `PlansView.vue` | 需认证 | 学习计划列表 |
| **plan-detail** | `/plans/:id` | `PlanDetailView.vue` | 需认证 | 学习计划详情与日历看板 |
| **today** | `/today` | `TodayView.vue` | 需认证 | 今日任务清单与打卡 |
| **materials** | `/materials` | `MaterialsView.vue` | 需认证 | 学习资料库列表 |
| **material-detail**| `/materials/:id` | `MaterialDetailView.vue` | 需认证 | 学习资料阅读与正文提取 |
| **quiz** | `/quizzes/:id` | `QuizView.vue` | 需认证 | 测验作答界面（用户专属行为，不可代办） |
| **attempt** | `/attempts/:id` | `AttemptView.vue` | 需认证 | 测验作答结果与错题复盘 |
| **wrong-questions**| `/wrong-questions` | `WrongQuestionsView.vue` | 需认证 | 错题集与重做批次管理 |
| **mastery** | `/mastery` | `MasteryView.vue` | 需认证 | 知识点掌握度雷达与清单 |
| **knowledge** | `/knowledge` | `KnowledgeView.vue` | 需认证 (`mock: true`) | 旧版单轮问答入口（计划迁移入 Harness 窗口） |
| **agent-plan** | `/agent/plan` | `PlanChatView.vue` | 需认证 (`mock: true`) | 旧版对话生成计划（计划迁移入 Harness 对话） |
| **agent-tasks** | `/agent/tasks` | `TaskAgentView.vue` | 需认证 (`mock: true`) | 旧版任务 Agent 页面（计划迁移入 Harness 窗口） |
| **activity** | `/activity` | `ActivityView.vue` | 需认证 | Agent 执行记录与安全审计台账 |
| **assistant-health**| `/assistant/health`| `AssistantHealthView.vue`| 需认证 | Agent 模型用量、预算与响应监控（保留于管理入口） |
| **notifications** | `/notifications` | `NotificationsView.vue` | 需认证 | 系统与治理审批通知 |
| **settings** | `/settings` | `SettingsView.vue` | 需认证 | 学习偏好与日常限制设置 |
| **settings-ai** | `/settings/ai` | `AiSettingsView.vue` | 需认证 | 旧版 AI 设置页面（H04/H08 迁移至悬浮球设置入口） |
| **workspace-artifacts**| `/workspaces` | `WorkspaceArtifactsView.vue`| 需认证 | 本地代码工作区登记与实践成果评测看板 |

### 2.2 AppShell 侧边栏导航分组事实
当前 `web/src/components/AppShell.vue` 侧边栏包含 3 个导航组：
1. **总览**：工作台 (`/dashboard`)、通知 (`/notifications`)；
2. **学习**：学习路线 (`/roadmap`)、今日任务 (`/today`)、学习资料 (`/materials`)、错题集 (`/wrong-questions`)、掌握度 (`/mastery`)、工作区与成果 (`/workspaces`)；
3. **AI 助手**：知识问答 (`/knowledge`)、对话生成计划 (`/agent/plan`)、任务 Agent (`/agent/tasks`)、执行与审计 (`/activity`)、运行健康 (`/assistant/health`)。

### 2.3 迁移与挂载关键设计约束（面向 H07 / H08）
- **挂载点**：全局悬浮球壳（`FloatingAgentHost.vue`）必须挂载在 `AppShell.vue` 内部或顶层插槽中，使得用户在 28 个受保护业务页面间切换时，悬浮球保持常驻、对话流不断开；
- **旧入口平滑退役**：当前侧边栏“AI 助手”组中的 `knowledge`、`agent/plan`、`agent/tasks` 均为旧版专用页面。在 H07 悬浮球与 H08 Workspace 交付验收前，保留现有旧页面与路由；H08 具备完整替代能力并经用户验收后，将侧边栏链接收缩或平滑重定向至悬浮球调用；
- **设置域分离**：当前 `/settings/ai` 是传统页面。新架构要求 API Key、Endpoint 与模型配置完全迁入独立 Agent Service，在悬浮球右键菜单中提供独立模态/面板设置（H08），Java 业务后端不再持有或中转模型 Secret。

---

## 3. 现有 SSE 事件与 UI Action 机制盘点

### 3.1 现有平台 SSE 事件集合 (`services/current/assistant.ts`)
客户端通过 `GET /api/assistant/conversations/{id}/events` 获取单向流式事件，受 `VALID_ASSISTANT_EVENT_TYPES` 白名单约束：

1. `HEARTBEAT`：`": heartbeat\n\n"`，每 30 秒保活注释帧，客户端仅更新心跳活性；
2. `TURN_STARTED`：轮次开始，包含 `turnId`；
3. `CONTEXT_LOADED`：Java 上下文加载就绪（`learning.context.get`）；
4. `PLAN_GENERATED`：多步计划生成通知，包含意图与步骤摘要；
5. `TOOL_STARTED`：工具开始执行，预算检查通过后推送；
6. `TOOL_SUCCEEDED`：工具执行成功及结果摘要；
7. `TOOL_FAILED`：工具执行失败或结果超出上限截断；
8. `ACTION_PREVIEW`：写操作专用预览，附带 `WAITING_CONFIRMATION` 与确认卡片数据；
9. `ASSISTANT_DELTA`：模型增量 token 片段；
10. `UI_ACTION`：前端白名单界面动作指令；
11. `TURN_COMPLETED`：轮次成功终态，包含最终文本；
12. `TURN_FAILED`：轮次异常终态，包含错误信息；
13. `TURN_CANCELLED`：轮次取消终态，包含中止原因。

### 3.2 现有流式恢复与断线控制
- **断线续传**：重连时通过请求头 `Last-Event-ID: {sequence}` 发送已消费的最后序号，服务端只回放后续持久事件；
- **严格单调递增**：帧的 `id:` 与 payload 内的 `sequence` 必须严格一致且单调递增；乱序或不匹配立即丢弃；
- **轮次世代隔离**：增量片段 `ASSISTANT_DELTA` 严格绑定 `eventTurnId === activeTurnId`，防止陈旧或并发轮次污染当前回答；
- **取消与失败清理**：收到 `TURN_FAILED` 或 `TURN_CANCELLED` 时，丢弃未完成的流式文本碎片，替换为确定的状态通知。

### 3.3 现有 UI Action 执行器与注册表 (`uiActionDispatcher.ts`)
支持 5 类受控白名单动作，严禁任意代码执行与开放选择器：
1. `NAVIGATE`：仅允许映射至 28 个受控具名路由；
2. `OPEN_MODAL`：受限于 `FROZEN_MODAL_MATRIX`（`CREATE_GOAL`, `CREATE_PLAN`, `IMPORT_MATERIAL`）；
3. `PREFILL_FORM`：受限于 `FROZEN_FORM_MATRIX`，且参数若包含 `autoSubmit` 即刻硬阻断并报错；
4. `REFRESH_RESOURCE`：受限于 `FROZEN_RESOURCE_MATRIX`（仅允许刷新已声明的数据集）；
5. `FOCUS_ELEMENT`：受限于 `FROZEN_FOCUS_MATRIX`（`MESSAGE_INPUT`, `PLAN_TITLE_INPUT`），严禁原生 CSS 选择器。

---

## 4. 事件兼容映射与消费侧契约需求

基于 `scripts/harness/frontend-baseline-event-samples.json`，为即将由 MiniMax Code 编写的 `contracts/agent-runtime/runtime.schema.json` 提出消费侧映射与规范需求：

### 4.1 事件映射对照表

| 现有平台 SSE 事件 | 拟映射 Runtime 事件 | 语义及消费端处理要求 |
| :--- | :--- | :--- |
| `TURN_STARTED` | `turn.started` | 标记轮次启动，绑定 `sessionId` 与 `turnId`，重置上一轮的展开状态与流式槽位 |
| `CONTEXT_LOADED` | `context.loaded` | 上下文事实已就绪；作为定位事实，不赋权 |
| `PLAN_GENERATED` | `reasoning.plan` | 模型多步意图展示，作为可选的信息性摘要 |
| `TOOL_STARTED` | `tool.call.started` | 工具已通过预算与权限检查开始执行，渲染为紧凑进度条步骤 |
| `TOOL_SUCCEEDED` | `tool.call.completed`| 工具执行完成并返回数据，供后续推理步骤消费 |
| `TOOL_FAILED` | `tool.call.failed` | 工具执行失败或数据截断；显式标记非成功（`FAILED`），不误标全部成功 |
| `ACTION_PREVIEW` | `interaction.approval.requested` | 写入操作审批请求；触发独立确认卡片与高风险标签，不可由文字自动确认 |
| `ASSISTANT_DELTA` | `content.delta` | 逐字流式打字效果；必须严格做 `turnId` 世代检查 |
| `UI_ACTION` | `client.ui_directive` | 执行白名单动作，并在完成后通过客户端回执接口异步上报终态 |
| `TURN_COMPLETED` | `turn.completed` | 轮次正常完成，携带最终回答、`finishReason` 及 `usage` 统计 |
| `TURN_FAILED` | `turn.failed` | 轮次失败终态，携带结构化错误码与用户可见脱敏错误文案 |
| `TURN_CANCELLED` | `turn.cancelled` | 轮次由用户主动停止或打断，清理半成品文本并呈现取消标记 |

### 4.2 终态原因 (`finish_reasons`) 区分
为了解决旧版本将所有非失败均误判为完成的问题，新 Runtime 协议必须区分以下枚举：
- `completed`：自然完成全部推理与调用；
- `cancelled`：用户点击 Stop 或输入插话中止；
- `max_tokens`：达到单次输出最大 Token 上限（**必须与 completed 区分，前端需提示回答已被截断**）；
- `budget_exhausted`：用户会话或每日预算耗尽；
- `waiting_confirmation`：高风险写操作等待确认；
- `failed`：底层异常或工具致命错误。

### 4.3 提交给 MiniMax 的消费端契约需求 (Consumption Requirements)
1. **REQ-CON-01 (单调递增序号与续传)**：每个服务端事件必须携带基于会话的严格递增整数 `sequence`（从 1 起步），客户端重连回传 `Last-Event-ID: {sequence}` 即可无副作用续传；
2. **REQ-CON-02 (Turn 世代绑定)**：所有属于某一轮次的事件必须携带 `turnId`，防止迟到的旧分块污染新对话；
3. **REQ-CON-03 (Token 截断独立标识)**：终态必须输出强类型 `finishReason`，禁止将 `max_tokens` 伪装成 `completed`；
4. **REQ-CON-04 (元数据与内容正文严格分离)**：工具调用与执行步骤（`tool.call.*`）以结构化卡片下发，模型正文增量（`content.delta`）只包含对话内容，禁止将工具原始 JSON 杂质混入聊天气泡；
5. **REQ-CON-05 (零凭据与绝对路径泄漏)**：事件流内严禁出现 API Key、Bearer Token、数据库密码或本地磁盘绝对路径；
6. **REQ-CON-06 (原生交互式提问支持)**：Runtime 协议需原生支持模型发起结构化追问（`interaction.question`）并等待用户答复（`interaction.response`），支持插话而不强制销毁会话。

---

## 5. 真实性防线与防虚假成功规则

在离线基线与未来的真实验收中，必须严格恪守以下真实性边界：

1. **不可将登录重定向当作业务成功**：
   - 访问 `/`、`/workspaces`、`/roadmap` 等受保护路由时，若未携带有效认证，客户端路由守卫（`router.beforeEach`）会触发重定向跳转至 `/login?redirect=...`；
   - 自动化适配器或测试必须验证目标 URL 的实际路径与页面关键地标元素，**检测到 `/login` 重定向必须明确断言为 `BLOCKED`（需要认证），严禁报告 `SUCCEEDED`**；
2. **不可将页面打开当作业务完成**：
   - 导航到 `/workspaces` 仅代表页面被渲染，不代表工作区操作或评测已通过；
   - 实践成果评测结果面板必须真实拉取 API（`/api/roadmap-artifacts`），接口失败时展示明确的错误状态（`workspace-results-error`），空列表时展示真实的空状态（`workspace-results-empty`），**绝不使用吞错变成虚假空状态**；
3. **不可由 Agent 代办用户专属业务**：
   - 测验作答提交（`QUIZ_SUBMISSION`）、打卡总结提交（`CHECKIN_SUMMARY_SUBMIT`）与成果最终接受（`ACCEPT_ARTIFACT_SUBMISSION`）受 `assertAuthenticityGuards` 保护，前端调度器直接拦截并报错，绝不代用户自动执行。

---

## 6. 面向 H07 / H08 的可执行设计约束

### 6.1 面向 Task H07（全局 Floating Agent Shell）
- **挂载位置**：在 `web/src/components/AppShell.vue` 的 `main.content` 兄弟节点挂载 `<FloatingAgentHost />`；
- **状态常驻**：使用 Pinia `useFloatingAgentStore` 保存浮窗位置、展开状态、未读提醒与活跃会话 ID，避免页面切换时重新挂载或丢失已加载的流式回答；
- **通信通道**：调用独立服务路径 `/agent-api/v1/sessions/**`，当独立 Agent Service 未启动时，悬浮球需展示优雅的离线/连接失败提示，**不影响主业务界面的正常操作**；
- **视口与移动端适配**：桌面端窗口浮动于右下角（带边界吸附），移动端或窄屏（`<768px`）自动切换为全屏抽屉模式。

### 6.2 面向 Task H08（Harness 风格 Workspace 与独立设置）
- **纯 Vue 实现**：窗口内部包含消息流、Tool Call 折叠卡片、Working 状态胶囊、Stop 按钮及历史记录，使用 Vue 原生组件实现，不引入 React 运行时或 iframe；
- **设置域与密钥生命周期**：
  - 从悬浮球右键菜单进入“模型设置”；
  - 表单提供 Provider、Base URL、Model Name、API Key；
  - **API Key 仅在表单提交的函数内存中短暂存在**，提交至 `/agent-api/v1/settings` 后立即清空 `ref`，严禁写入 `localStorage`、`sessionStorage`、Pinia store 或日志；
  - 读取设置时仅展示脱敏后缀（如 `sk-****abcd`）和配置时间；
- **执行过程面板紧凑规范**：继承我们在 Task 33 沉淀的规范，执行过程默认紧凑折叠为单行摘要（~38px 高度），点击展开详细工具树（`max-height: 200px; overflow-y: auto`），并在新轮次开始时自动重置折叠，绝不挤占聊天视口。

---

## 7. TDD 验证命令与测试结果

所有验证逻辑遵循严谨的 TDD 闭环：先写失败测试（RED），验证成功后达成 GREEN。

### 7.1 验证命令 1：独立基线自动化校验脚本
执行命令：
```bash
node scripts/harness/frontend-baseline-verify.mjs
```
输出结果：
```text
=== StudyPilot H01 Frontend Baseline Verification ===

--- 1. Vue Route Inventory & Navigation Audit ---
[PASS] router.ts exists at /Users/moxiao/IdeaProjects/project-harness-h01-zcode/web/src/app/router.ts
[PASS] Found 31 unique named routes in router.ts (found: 31)
[PASS] Found 3 public routes (login, register, not-found)
[PASS] Identified 3 legacy routes (courses, course-detail, lesson)
[PASS] Agent route 'assistant' present in router
[PASS] Agent route 'assistant-health' present in router
[PASS] Agent route 'settings-ai' present in router
[PASS] Agent route 'knowledge' present in router
[PASS] Agent route 'agent-plan' present in router
[PASS] Agent route 'agent-tasks' present in router
[PASS] Agent route 'activity' present in router
[PASS] Agent route 'workspace-artifacts' present in router

--- 2. UI Action Registry & Safety Invariants ---
[PASS] uiActionDispatcher.ts exists at /Users/moxiao/IdeaProjects/project-harness-h01-zcode/web/src/modules/assistant/uiActionDispatcher.ts
[PASS] UI action type 'NAVIGATE' handled in dispatcher
[PASS] UI action type 'OPEN_MODAL' handled in dispatcher
[PASS] UI action type 'PREFILL_FORM' handled in dispatcher
[PASS] UI action type 'REFRESH_RESOURCE' handled in dispatcher
[PASS] UI action type 'FOCUS_ELEMENT' handled in dispatcher
[PASS] ownerId parameter injection strictly rejected
[PASS] autoSubmit in PREFILL_FORM strictly rejected
[PASS] FOCUS_ELEMENT strictly restricted to FROZEN_FOCUS_MATRIX symbolic keys without arbitrary CSS selectors
[PASS] Learning integrity guards present (quiz, check-in, artifact accept cannot be delegated)

--- 3. Legacy SSE Event Stream Protocol Inventory ---
[PASS] assistant.ts exists at /Users/moxiao/IdeaProjects/project-harness-h01-zcode/web/src/services/current/assistant.ts
[PASS] Legacy SSE event type 'HEARTBEAT' present in VALID_ASSISTANT_EVENT_TYPES
[PASS] Legacy SSE event type 'TURN_STARTED' present in VALID_ASSISTANT_EVENT_TYPES
[PASS] Legacy SSE event type 'CONTEXT_LOADED' present in VALID_ASSISTANT_EVENT_TYPES
[PASS] Legacy SSE event type 'PLAN_GENERATED' present in VALID_ASSISTANT_EVENT_TYPES
[PASS] Legacy SSE event type 'TOOL_STARTED' present in VALID_ASSISTANT_EVENT_TYPES
[PASS] Legacy SSE event type 'TOOL_SUCCEEDED' present in VALID_ASSISTANT_EVENT_TYPES
[PASS] Legacy SSE event type 'TOOL_FAILED' present in VALID_ASSISTANT_EVENT_TYPES
[PASS] Legacy SSE event type 'ACTION_PREVIEW' present in VALID_ASSISTANT_EVENT_TYPES
[PASS] Legacy SSE event type 'ASSISTANT_DELTA' present in VALID_ASSISTANT_EVENT_TYPES
[PASS] Legacy SSE event type 'UI_ACTION' present in VALID_ASSISTANT_EVENT_TYPES
[PASS] Legacy SSE event type 'TURN_COMPLETED' present in VALID_ASSISTANT_EVENT_TYPES
[PASS] Legacy SSE event type 'TURN_FAILED' present in VALID_ASSISTANT_EVENT_TYPES
[PASS] Legacy SSE event type 'TURN_CANCELLED' present in VALID_ASSISTANT_EVENT_TYPES
[PASS] Reconnection uses Last-Event-ID with last monotonic sequence
[PASS] Frame ID and payload sequence mismatch verification present

--- 4. Event Samples & Runtime Projection Fixture ---
[PASS] Event samples fixture exists at /Users/moxiao/IdeaProjects/project-harness-h01-zcode/scripts/harness/frontend-baseline-event-samples.json
[PASS] Web test fixture exists at /Users/moxiao/IdeaProjects/project-harness-h01-zcode/web/tests/harness-baseline/event-samples.fixture.json
[PASS] Web test fixture is byte-identical to scripts/harness fixture
[PASS] Fixture matches version 1.0.0 and task H01
[PASS] Legacy SSE samples array defined
[PASS] Contains 13 legacy event samples (1 heartbeat + 12 events)
[PASS] Target runtime event mappings defined
[PASS] All 12 business event types have target runtime projection mappings
[PASS] Finish reason 'completed' defined
[PASS] Finish reason 'cancelled' defined
[PASS] Finish reason 'max_tokens' defined (distinct from completed)
[PASS] Finish reason 'budget_exhausted' defined (distinct from error)
[PASS] At least 6 consumption requirements submitted for MiniMax schema

--- 5. Anti-False-Success & Boundary Enforcement Rules ---
[PASS] Guarded routes strictly require auth.isAuthenticated, bouncing to login
[PASS] Unauthenticated access properly redirected to login with redirect param

===============================================================
   All Frontend Baseline Checks PASSED! (0 failures)
===============================================================
```

### 7.2 验证命令 2：前端离线基线 Vitest 单元测试
执行命令：
```bash
cd web && npx vitest run tests/harness-baseline/frontend-baseline.spec.ts
```
输出结果：
```text
 RUN  v3.2.7 /Users/moxiao/IdeaProjects/project-harness-h01-zcode/web

 ✓ tests/harness-baseline/frontend-baseline.spec.ts (5 tests) 2ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Duration  454ms
```

### 7.3 验证命令 3：前端类型检查
执行命令：
```bash
cd web && npm run typecheck
```
输出结果：
```text
> studypilot-web@0.1.0 typecheck
> vue-tsc --noEmit
# 退出码 0，零警告零错误
```

---

## 8. 本地提交与所有权清单

### 8.1 本地提交文件清单（严格限定所有权范围）
- `scripts/harness/frontend-baseline-verify.mjs`：前端基线全量只读校验自动化脚本
- `scripts/harness/frontend-baseline-event-samples.json`：12 种平台事件样例、运行时映射表与契约需求
- `web/tests/harness-baseline/frontend-baseline.spec.ts`：前端离线兼容性与防假成功测试套件
- `web/tests/harness-baseline/event-samples.fixture.json`：供 Vitest 本地消费的事件样例副本
- `docs/verification/harness/h01-zcode.md`：本专属验证证据文档

### 8.2 限制与未覆盖项
1. **未覆盖项**：H01 不包含新悬浮球生产组件开发，不删除旧界面，不修改现有 `web/src/**` 代码；
2. **公共契约未越权编写**：`contracts/agent-runtime/runtime.schema.json` 保持由 MiniMax Code 编写，ZCode 仅在本报告及样例中提交消费侧需求；
3. **未做真实模型调用**：本轮全量验证均为结构性离线验证（`[OFFLINE_BASELINE]`），未启动付费模型评测。
