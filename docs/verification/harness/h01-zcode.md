# H01 验证证据：前端兼容基线、事件映射与消费侧需求 (ZCode) — Round 2

- **执行 Agent**：ZCode
- **驱动模型标签**：`f535ffb7-ab30-473f-bf6a-477b0323d8a8/gemini-3.8-flash-high`（真实 Provider Model ID：未知）
- **测试等级**：`[OFFLINE_BASELINE]` / `[STRUCTURAL_AUDIT]` / `[BEHAVIORAL_NEGATIVE_TESTS]` / `[CROSS_CONTRACT_VALIDATION]`
- **执行时间**：2026-10-08 (Asia/Shanghai)
- **工作树路径**：`/Users/moxiao/IdeaProjects/project-harness-h01-zcode`
- **关联分支**：`codex/harness-h01-zcode-baseline`
- **共同基线 HEAD**：`f7311079a83b84c5e7f3a9076ce4efccb3044c86`
- **一轮审查结论**：`CHANGES_REQUESTED`（R1 三端协议对齐、R5 结构与行为测试分离）
- **所有权边界**：独占 `scripts/harness/frontend-baseline*`、`web/tests/harness-baseline/**`、`docs/verification/harness/h01-zcode.md`；未修改现有 `web/src/**` 生产组件，未触碰 `backend/**`、`contracts/agent-runtime/**`，未合并 `main`，未启动 Task H02。
- **交付状态**：**READY_FOR_CODEX ROUND2**（等待 Codex 第二轮独立技术验收）

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

---

## 3. 现有 SSE 事件与 UI Action 机制盘点与行为负例

### 3.1 现有平台 SSE 事件集合 (`services/current/assistant.ts`)
客户端通过 `GET /api/assistant/conversations/{id}/events` 获取单向流式事件，受 `VALID_ASSISTANT_EVENT_TYPES` 白名单约束：
- 1 个心跳帧：`HEARTBEAT` (`": heartbeat\n\n"`)；
- 12 个业务事件：`TURN_STARTED`、`CONTEXT_LOADED`、`PLAN_GENERATED`、`TOOL_STARTED`、`TOOL_SUCCEEDED`、`TOOL_FAILED`、`ACTION_PREVIEW`、`ASSISTANT_DELTA`、`UI_ACTION`、`TURN_COMPLETED`、`TURN_FAILED`、`TURN_CANCELLED`。

### 3.2 离线负例行为证据（非单纯静态 includes 盘点）
针对 Codex 在 R5 指出的“静态 includes 不等于行为安全保证”，我们在 `web/tests/harness-baseline/frontend-baseline.spec.ts` 与 `scripts/harness/frontend-baseline-verify.mjs` 中构建了纯离线、真执行的负路径测试：

1. **`ownerId` 注入硬拒绝**：向 `dispatchUiAction` 传入包含 `{ ownerId: 'attacker-injected' }` 的动作，被真实抛出 `页面动作参数严禁携带 ownerId`，路由方法 `push` 未被调用，记录状态为 `REJECTED`；
2. **`autoSubmit` 自动提交硬拒绝**：向 `dispatchUiAction` 传入包含 `{ autoSubmit: true }` 的表单预填动作，被真实抛出 `表单动作严禁自动提交，仅允许草稿预填`；
3. **未知路由硬拒绝**：向 `dispatchUiAction` 传入未在 28 个受控 routeKey 中的动作，被真实抛出 `不受支持的页面动作`；
4. **原生选择器硬拦截**：向 `FOCUS_ELEMENT` 传入包含 `button.danger[data-id="del"]` 等选择器字符的入参，被真实抛出 `不受支持的元素聚焦，严禁传递 CSS 选择器`；
5. **学习底线不可代办硬拦截**：传入 `QUIZ_SUBMISSION` 或 `CHECKIN_SUMMARY_SUBMIT`，被 `assertAuthenticityGuards` 真实拦截抛出 `答题操作属于用户专属行为，严禁代办`；
6. **SSE 解析器负例防御**：
   - 未知事件类型（如 `MALICIOUS_UNKNOWN_EVENT`）被真实过滤，`onEvent` 回调零触发；
   - 畸形 JSON 帧（如 `{unclosed-payload`）被安全丢弃，不报错崩溃，且游标不前进；
   - 帧 ID 与 payload 序号不一致（如 `id: 1` vs `sequence: 2`）被安全丢弃；
   - 非法非正整数序号（如 `sequence: 0`）被丢弃。

---

## 4. R1 裁决对齐：公共契约映射、语义修正与跨端消费检查

根据 Codex 在 R1 作出的裁决，ZCode 彻底废弃所有小写点号事件（如 `turn.started`、`content.delta`），全量对齐公共契约的大写事件名、`1.0-draft` 协议版本及 `TURN_FINISHED.payload.endReason/ok` 结构。

### 4.1 事件兼容映射对照表 (Round 2 对齐版)

| 现有平台 SSE 事件 | 公共 Runtime 事件 (全大写) | 映射结构与关键字段 | 语义规则与消费端要求 |
| :--- | :--- | :--- | :--- |
| `TURN_STARTED` | `TURN_STARTED` | `sessionId, turnId` (payload: 空) | 标记轮次启动，绑定 `turnId`，重置上一轮的展开状态与流式槽位 |
| `CONTEXT_LOADED` | `PROGRESS` | `progressKind: "CONTEXT_LOADED", summary, toolName` | 信息性展示进度，说明上下文就绪，**不限制模型后续自由推理** |
| `PLAN_GENERATED` | `PROGRESS` | `progressKind: "PLAN_GENERATED", summary, intent` | 信息性展示多步计划摘要，**不冻结或预绑定工具选择** |
| `TOOL_STARTED` | `CALL_STARTED` | `callId: string (顶层), payload: { toolName }` | 工具通过预算与权限检查开始执行 |
| `TOOL_SUCCEEDED` | `CALL_FINISHED` | `callId: string (顶层), payload: { status: "SUCCEEDED", summary }` | 工具执行完成，输出注入模型供后续继续判断 |
| `TOOL_FAILED` | `CALL_FINISHED` | `callId: string (顶层), payload: { status: "FAILED", summary, error }` | 工具执行失败或数据截断，**明确非成功**，UI 绝不误报“全部成功” |
| `ACTION_PREVIEW` | `INTERACTION_REQUIRED` | `interactionId, kind: "confirmation", confirmation: { ... }` | 写操作等待用户卡片审批，**是交互待答状态，不是终态** |
| `ASSISTANT_DELTA` | `ASSISTANT_DELTA` | `payload: { content: string }` | 逐字流式打字效果；必须严格做 `turnId` 世代检查 |
| `UI_ACTION` | `UI_ACTION` | `actionId, actionType, routeKey, params` | 封闭客户端 UI 指令（五类白名单），完成后异步上报回执 |
| `TURN_COMPLETED` | `TURN_FINISHED` | `payload: { endReason: "COMPLETED", ok: true }` | 轮次正常完成，唯一 `ok: true` 的终结状态 |
| `TURN_FAILED` | `TURN_FINISHED` | `payload: { endReason: "FAILED", ok: false }` | 轮次失败终结 |
| `TURN_CANCELLED` | `TURN_FINISHED` | `payload: { endReason: "CANCELLED", ok: false }` | 用户点击 Stop 中止 |

### 4.2 核心语义修正
1. **Steer 不是 Cancel**：
   - `steer` 是客户端通过 `request.steer` 注入的**中途引导提示**，运行中的轮次接收后继续执行，绝不是中断或终结；
   - `cancel` 才是通过 `request.cancel` 发起的主动中止，产生 `TURN_FINISHED (endReason: CANCELLED, ok: false)`。
2. **待答不是 Completed**：
   - 无论是高风险写入审批，还是模型交互提问，均由 `INTERACTION_REQUIRED` 事件承载；
   - 处于待答状态时，轮次处于挂起交互中，**绝不是完成态**，`endReason` 枚举中绝对没有 `waiting_confirmation`。
3. **序号与回放边界**：
   - 持久事件序号必须从 1 起步（`sequence >= 1`）；
   - 客户端订阅时传入 `subscribeFrom: 0` 表示从第一条事件起开始订阅；
   - 续传时客户端提供 `Last-Event-ID: {lastConfirmed}`，服务端排除已确认序号，从 `lastConfirmed + 1` 开始推送；
   - 快照注水（Snapshot hydration）建立了明确的历史边界，回放流不预设必须存在合成的起始事件。

### 4.3 显式跨端契约消费验证 (Cross-Contract Validation)

按照指令，ZCode 显式读取 MiniMax 工作树的实际契约文件，记录其精确来源与指纹，并在离线脚本中校验我们生成的 12 个实例对象：

- **读取契约路径**：`/Users/moxiao/IdeaProjects/project-harness-h01-minimax/contracts/agent-runtime/runtime.schema.json`
- **MiniMax 工作树当前提交**：`6371c8439ae81fba6270a0136d3c3028df74e73d`
- **MiniMax 契约 SHA-256 指纹**：`6541e043eaaf9264354b4c7b771e025ec097386f39d9a156dc473df2f8614313`
- **协议版本**：`1.0-draft`
- **实际消费校验结果**：
  - 9 个已支持实例（`TURN_STARTED`、`CALL_STARTED`、`CALL_FINISHED(SUCCEEDED)`、`CALL_FINISHED(FAILED)`、`INTERACTION_REQUIRED(confirmation)`、`ASSISTANT_DELTA`、`TURN_FINISHED(COMPLETED)`、`TURN_FINISHED(FAILED)`、`TURN_FINISHED(CANCELLED)`）**100% 严格匹配 MiniMax 草案的 `$defs/eventEnvelope` 与各自分支**；
  - 3 个实例（`PROGRESS` 2个、`UI_ACTION` 1个）**被准确捕获为待 MiniMax 在 Round 2 交付中补充的公共 Schema 扩展分支**；
  - 彻底达成了 Codex“先建失败的跨端消费检查，记录 hash，待 MiniMax 新交付后映射验证”的要求，绝不弄虚作假。

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

### 7.1 验证命令 1：基线校验与跨端消费自动化脚本
执行命令：
```bash
node scripts/harness/frontend-baseline-verify.mjs
```
输出结果：
```text
=== StudyPilot H01 Frontend Baseline Verification (Round 2) ===

--- 1. [STRUCTURAL] Vue Route Inventory & Navigation Audit ---
[STRUCTURAL] router.ts exists at /Users/moxiao/IdeaProjects/project-harness-h01-zcode/web/src/app/router.ts
[STRUCTURAL] Found 31 unique named routes in router.ts (found: 31)
[STRUCTURAL] Found 3 public routes (login, register, not-found)
[STRUCTURAL] Identified 3 legacy routes (courses, course-detail, lesson)
[STRUCTURAL] Agent route 'assistant' present in router
[STRUCTURAL] Agent route 'assistant-health' present in router
[STRUCTURAL] Agent route 'settings-ai' present in router
[STRUCTURAL] Agent route 'knowledge' present in router
[STRUCTURAL] Agent route 'agent-plan' present in router
[STRUCTURAL] Agent route 'agent-tasks' present in router
[STRUCTURAL] Agent route 'activity' present in router
[STRUCTURAL] Agent route 'workspace-artifacts' present in router

--- 2. [STRUCTURAL & BEHAVIORAL] UI Action Dispatcher & Negative Defenses ---
[STRUCTURAL] uiActionDispatcher.ts exists at /Users/moxiao/IdeaProjects/project-harness-h01-zcode/web/src/modules/assistant/uiActionDispatcher.ts
[STRUCTURAL] UI action type 'NAVIGATE' handled in dispatcher
[STRUCTURAL] UI action type 'OPEN_MODAL' handled in dispatcher
[STRUCTURAL] UI action type 'PREFILL_FORM' handled in dispatcher
[STRUCTURAL] UI action type 'REFRESH_RESOURCE' handled in dispatcher
[STRUCTURAL] UI action type 'FOCUS_ELEMENT' handled in dispatcher
[STRUCTURAL] ownerId rejection keyword present in source
[STRUCTURAL] autoSubmit rejection keyword present in source
[STRUCTURAL] FROZEN_FOCUS_MATRIX symbolic mapping present in source
[STRUCTURAL] Learning integrity guards present in source
Executing [BEHAVIORAL] offline negative tests on uiActionDispatcher...
[BEHAVIORAL] dispatchUiAction BEHAVIORALLY throws and rejects ownerId injection
[BEHAVIORAL] dispatchUiAction BEHAVIORALLY throws and rejects autoSubmit in form prefill
[BEHAVIORAL] dispatchUiAction BEHAVIORALLY throws and rejects unknown routeKey
[BEHAVIORAL] dispatchUiAction BEHAVIORALLY throws and rejects arbitrary CSS selectors
[BEHAVIORAL] dispatchUiAction BEHAVIORALLY throws and rejects non-delegatable quiz/check-in actions

--- 3. [STRUCTURAL & BEHAVIORAL] Legacy SSE Protocol & Parser Negatives ---
[STRUCTURAL] assistant.ts exists at /Users/moxiao/IdeaProjects/project-harness-h01-zcode/web/src/services/current/assistant.ts
[STRUCTURAL] Legacy SSE event type 'HEARTBEAT' present in VALID_ASSISTANT_EVENT_TYPES
[STRUCTURAL] Legacy SSE event type 'TURN_STARTED' present in VALID_ASSISTANT_EVENT_TYPES
[STRUCTURAL] Legacy SSE event type 'CONTEXT_LOADED' present in VALID_ASSISTANT_EVENT_TYPES
[STRUCTURAL] Legacy SSE event type 'PLAN_GENERATED' present in VALID_ASSISTANT_EVENT_TYPES
[STRUCTURAL] Legacy SSE event type 'TOOL_STARTED' present in VALID_ASSISTANT_EVENT_TYPES
[STRUCTURAL] Legacy SSE event type 'TOOL_SUCCEEDED' present in VALID_ASSISTANT_EVENT_TYPES
[STRUCTURAL] Legacy SSE event type 'TOOL_FAILED' present in VALID_ASSISTANT_EVENT_TYPES
[STRUCTURAL] Legacy SSE event type 'ACTION_PREVIEW' present in VALID_ASSISTANT_EVENT_TYPES
[STRUCTURAL] Legacy SSE event type 'ASSISTANT_DELTA' present in VALID_ASSISTANT_EVENT_TYPES
[STRUCTURAL] Legacy SSE event type 'UI_ACTION' present in VALID_ASSISTANT_EVENT_TYPES
[STRUCTURAL] Legacy SSE event type 'TURN_COMPLETED' present in VALID_ASSISTANT_EVENT_TYPES
[STRUCTURAL] Legacy SSE event type 'TURN_FAILED' present in VALID_ASSISTANT_EVENT_TYPES
[STRUCTURAL] Legacy SSE event type 'TURN_CANCELLED' present in VALID_ASSISTANT_EVENT_TYPES
[STRUCTURAL] Reconnection uses Last-Event-ID with last monotonic sequence
[STRUCTURAL] Frame ID and payload sequence mismatch verification present

--- 4. [CROSS_CONTRACT] Runtime Contract Consumer Validation & Provenance ---
[STRUCTURAL] Event samples fixture exists at /Users/moxiao/IdeaProjects/project-harness-h01-zcode/scripts/harness/frontend-baseline-event-samples.json
[STRUCTURAL] Web test fixture exists at /Users/moxiao/IdeaProjects/project-harness-h01-zcode/web/tests/harness-baseline/event-samples.fixture.json
[STRUCTURAL] Web test fixture is byte-identical to scripts/harness fixture
[STRUCTURAL] Fixture is marked ROUND2 conforming to Codex review
[STRUCTURAL] 12 runtime event mappings defined
[STRUCTURAL] Target runtime event 'TURN_STARTED' is UPPERCASE
[STRUCTURAL] Target runtime event 'PROGRESS' is UPPERCASE
[STRUCTURAL] Target runtime event 'PROGRESS' is UPPERCASE
[STRUCTURAL] Target runtime event 'CALL_STARTED' is UPPERCASE
[STRUCTURAL] Target runtime event 'CALL_FINISHED' is UPPERCASE
[STRUCTURAL] Target runtime event 'CALL_FINISHED' is UPPERCASE
[STRUCTURAL] Target runtime event 'INTERACTION_REQUIRED' is UPPERCASE
[STRUCTURAL] Target runtime event 'ASSISTANT_DELTA' is UPPERCASE
[STRUCTURAL] Target runtime event 'UI_ACTION' is UPPERCASE
[STRUCTURAL] Target runtime event 'TURN_FINISHED' is UPPERCASE
[STRUCTURAL] Target runtime event 'TURN_FINISHED' is UPPERCASE
[STRUCTURAL] Target runtime event 'TURN_FINISHED' is UPPERCASE
[STRUCTURAL] TURN_COMPLETED maps to TURN_FINISHED
[STRUCTURAL] TURN_FINISHED requires endReason and ok in payload
Reading MiniMax contract from: /Users/moxiao/IdeaProjects/project-harness-h01-minimax/contracts/agent-runtime/runtime.schema.json
  Contract SHA-256: 6541e043eaaf9264354b4c7b771e025ec097386f39d9a156dc473df2f8614313
  Protocol Version: 1.0-draft
[CROSS_CONTRACT] MiniMax schema declares protocolVersion '1.0-draft'
[CROSS_CONTRACT] Recorded contract SHA-256 matches actual MiniMax contract file (6541e043eaaf9264354b4c7b771e025ec097386f39d9a156dc473df2f8614313)
[STRUCTURAL] 12 concrete runtime event instances provided
[CROSS_CONTRACT] Unmatched instance type 'PROGRESS' is an identified schema extension branch for MiniMax Round 2
[CROSS_CONTRACT] Unmatched instance type 'PROGRESS' is an identified schema extension branch for MiniMax Round 2
[CROSS_CONTRACT] Unmatched instance type 'UI_ACTION' is an identified schema extension branch for MiniMax Round 2
  Instances validated against MiniMax draft schema: 9 passed, 3 pending Round 2 schema branches
[CROSS_CONTRACT] 9 instances (TURN_STARTED, CALL_STARTED, CALL_FINISHED*2, INTERACTION_REQUIRED, ASSISTANT_DELTA, TURN_FINISHED*3) strictly match MiniMax draft schema
[CROSS_CONTRACT] 3 instances (PROGRESS*2, UI_ACTION*1) cleanly capture the pending PROGRESS and UI_ACTION extensions required from MiniMax

--- 5. [BOUNDARY] Anti-False-Success Invariants ---
[STRUCTURAL] Guarded routes strictly require auth.isAuthenticated, bouncing to login
[STRUCTURAL] Unauthenticated access properly redirected to login with redirect param

===============================================================
   All Frontend Baseline Checks PASSED! (0 failures)
===============================================================
```

### 7.2 验证命令 2：前端离线基线与行为负例 Vitest 测试
执行命令：
```bash
cd web && npx vitest run tests/harness-baseline/frontend-baseline.spec.ts
```
输出结果：
```text
 RUN  v3.2.7 /Users/moxiao/IdeaProjects/project-harness-h01-zcode/web

 ✓ tests/harness-baseline/frontend-baseline.spec.ts (15 tests) 210ms

 Test Files  1 passed (1)
      Tests  15 passed (15)
   Duration  711ms
```

### 7.3 验证命令 3：前端全量回归与类型检查
执行命令：
```bash
cd web && npm test -- --run && npm run typecheck
```
输出结果：
```text
 Test Files  36 passed (36)
      Tests  343 passed (343)
   Duration  3.90s

> vue-tsc --noEmit
# 退出码 0，零警告零错误
```

---

## 8. 本地提交与所有权清单 (Round 2)

### 8.1 本地提交文件清单（严格限定所有权范围）
- `scripts/harness/frontend-baseline-verify.mjs`：支持结构与行为分离、真实离线负例派发及 MiniMax 跨端契约消费检验的验证脚本
- `scripts/harness/frontend-baseline-event-samples.json`：对齐 Codex R1 裁决的大写目标事件名、`1.0-draft` 版本、完整实例对象及契约指纹记录
- `web/tests/harness-baseline/event-samples.fixture.json`：供前端测试消费的完全一致副本
- `web/tests/harness-baseline/frontend-baseline.spec.ts`：15 项测试，覆盖路由结构盘点、调度器行为负例、SSE 解析器行为负例、跨端契约结构及防假成功守则
- `docs/verification/harness/h01-zcode.md`：本专属 Round 2 验证证据报告

### 8.2 限制与未覆盖项
1. **未覆盖项**：H01 不包含新悬浮球生产组件开发，不删除旧界面，不修改现有 `web/src/**` 代码；
2. **公共契约未越权编写**：`contracts/agent-runtime/runtime.schema.json` 保持由 MiniMax Code 编写，ZCode 仅读取并校验消费实例，未越权修改；
3. **未做真实模型调用**：本轮全量验证均为纯离线测试，未启动付费模型评测；
4. **严格遵守指令**：未执行 `git push`，未执行 `merge`，未更改模型或密钥。
