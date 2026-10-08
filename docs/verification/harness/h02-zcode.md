# H02 验证证据：前端业务能力覆盖、跨端消费与真实性防线 (ZCode)

- **执行 Agent**：ZCode
- **驱动模型标签**：`f535ffb7-ab30-473f-bf6a-477b0323d8a8/gemini-3.8-flash-high`（真实 Provider Model ID：未知）
- **测试等级**：`[OFFLINE_BASELINE]` / `[STRUCTURAL_AUDIT]` / `[BEHAVIORAL_NEGATIVE_TESTS]` / `[CROSS_CONTRACT_VALIDATION]`
- **执行时间**：2026-10-08 (Asia/Shanghai)
- **工作树路径**：`/Users/moxiao/IdeaProjects/project-harness-h02-zcode`
- **关联分支**：`codex/harness-h02-zcode`
- **共同基线 HEAD**：`16b37d34c882a17e7bc45c69c84411f28f52bff8`
- **所有权边界**：独占 `docs/verification/harness/h02-zcode.md`、`docs/verification/harness/h02-business-coverage.json`、`scripts/harness/capability-consumer*`、`web/tests/harness-capabilities/**`；未实现 UI、未修改生产路由或生产 Web 代码，未触碰公共 Schema/metadata/编译器，未合并 `main`，未启动 Task H03。
- **交付状态**：**READY_FOR_CODEX**（等待 Codex 独立技术验收）

---

## 1. 开始前环境与基线核对

1. **实际 Workspace / cwd / Branch**：
   - 实际工作树目录：`/Users/moxiao/IdeaProjects/project-harness-h02-zcode`
   - Git 分支：`codex/harness-h02-zcode`
   - 起始基线提交：`16b37d34c882a17e7bc45c69c84411f28f52bff8`
   - 工作树可访问性：完全可读可写，已通过独立命令测试。
   - 原 Task 33 工作树（`/Users/moxiao/IdeaProjects/project-zcode-task-33`）保持原样，零修改。
2. **基线来源溯源 (`h02-baseline-provenance.json`)**：
   - 本工作树快照继承了共同基线 `16b37d34c882a17e7bc45c69c84411f28f52bff8`，包含 H01 三端验收通过的所有产物（MiniMax `14f6529c`、ZCode `9d6061a1`、DeepSeek `70ab2760`）。
3. **快照工件说明**：
   - `backend/mvnw.cmd` 在 Git 中记录了来源工作文件的 CRLF 原始字节；在检出时被规范化为 LF，导致初始状态显示修改。此为已知快照工件，执行 Agent 未修改、未暂存、未提交该文件。
4. **操作禁令遵守**：
   - 未执行 `git push`、`git merge`、`deploy`；
   - 未更改应用模型配置与任何平台密钥；
   - 未重启现有服务或操作业务数据库；
   - 未调用真实付费模型进行跑分评测；
   - 未提前编写 H07 悬浮球生产代码或删除旧页面；
   - 未修改 H01 Runtime 契约冻结文件。

---

## 2. 业务能力全量覆盖审计 (Business Coverage Inventory)

基于 `web/src/app/router.ts`、后端各业务控制器及 Java `AgentToolRegistry.catalog()`，ZCode 对全系统 **31 个具名前端路由** 与 **65 个注册 Agent 工具** 进行了独立盘点与交叉映射，生成了机器可读审计文件 `docs/verification/harness/h02-business-coverage.json`。

### 2.1 前端 31 路由与能力分类映射表

| 路由名称 | 访问路径 | 页面组件 | 权限要求 | 分类 | 关联控制器 | 关联 Agent 工具 | 用户专属行为 / 未注册能力 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **login** | `/login` | `LoginView.vue` | 公开 | 认证 | `AuthenticationController` | 无 | 用户密码登录 (`AUTH_LOGIN`) |
| **register** | `/register` | `RegisterView.vue` | 公开 | 认证 | `AuthenticationController` | 无 | 用户自主注册 (`AUTH_REGISTER`) |
| **not-found** | `/:pathMatch(.*)*` | `NotFoundView.vue` | 公开 | 门户 | 无 | 无 | 前端 404 兜底 |
| **assistant** | `/` | `AssistantView.vue` | 需认证 | 门户 | `UnifiedAssistantFacadeController` | `navigation.resolve`, `governance.*` | 现有对话入口；H07 悬浮球上线后保留 |
| **dashboard** | `/dashboard` | `DashboardView.vue` | 需认证 | 门户 | `DashboardController` | `learning.context.get`, `schedule.today.get` | 学习者工作台大屏 |
| **roadmap** | `/roadmap` | `RoadmapView.vue` | 需认证 | 核心学习 | `RoadmapController`, `RoadmapUpgradeController` | `roadmap.current.get`, `roadmap.enroll`, `roadmap.upgrade` | 阶段报名与升级写工具禁用 |
| **roadmap-stage**| `/roadmap/stages/:id` | `StageView.vue` | 需认证 | 核心学习 | `RoadmapController` | `roadmap.stage.get` | 只读阶段详情 |
| **roadmap-module**| `/roadmap/modules/:id`| `ModuleView.vue` | 需认证 | 核心学习 | `RoadmapController` | `roadmap.module.get` | 只读模块详情 |
| **roadmap-node** | `/roadmap/nodes/:id` | `NodeView.vue` | 需认证 | 核心学习 | `RoadmapController`, `RoadmapLearningLoopController` | `roadmap.node.get`, `assessment.node_quiz_status.get`, `assessment.node_quiz.*` | **打卡总结提交** (`CHECKIN_SUMMARY_SUBMIT`) 用户专属 |
| **goals** | `/goals` | `GoalsView.vue` | 需认证 | 核心学习 | `LearningGoalController` | `learning.goals.list`, `learning.goal.create` | 目标新建写工具禁用 |
| **plans** | `/plans` | `PlansView.vue` | 需认证 | 核心学习 | `LearningPlanController` | `learning.plans.list`, `learning.plan.create` | 计划新建写工具禁用 |
| **plan-detail** | `/plans/:id` | `PlanDetailView.vue`| 需认证 | 核心学习 | `LearningPlanController` | `learning.plan.get` | 单计划甘特图详情 |
| **today** | `/today` | `TodayView.vue` | 需认证 | 核心学习 | `LearningTaskController`, `RoadmapScheduleController` | `schedule.today.get`, `schedule.unfinished.get`, `schedule.refresh`, `learning.tasks.list`, `learning.task.update` | 任务勾选更新与刷新写工具禁用 |
| **materials** | `/materials` | `MaterialsView.vue` | 需认证 | 资料库 | `MaterialController` | `materials.list`, `materials.text.import`, `materials.web.import` | 资料导入写工具禁用 |
| **material-detail**| `/materials/:id`| `MaterialDetailView.vue`|需认证 | 资料库 | `MaterialController` | `materials.get` | 单项资料正文只读 |
| **quiz** | `/quizzes/:id` | `QuizView.vue` | 需认证 | 评估考核 | `QuizController` | `assessment.quiz.get` | **测验题目作答提交** (`QUIZ_SUBMISSION`) 用户专属 |
| **attempt** | `/attempts/:id` | `AttemptView.vue` | 需认证 | 评估考核 | `QuizAttemptController` | `assessment.attempt.get` | 测验作答记录复盘 |
| **wrong-questions**| `/wrong-questions`| `WrongQuestionsView.vue`|需认证 | 评估考核 | `WrongQuestionController`, `WrongQuestionReviewController`| `assessment.wrong_questions.list`, `assessment.wrong_questions.summary`, `assessment.wrong_question_review.create` | 错题列表缺陷标记 pending；复习批次新建禁用 |
| **mastery** | `/mastery` | `MasteryView.vue` | 需认证 | 评估考核 | `MasteryController` | `assessment.mastery.list` | 掌握度雷达图权威只读数据 |
| **courses** | `/courses` | `CourseCatalogView.vue`|需认证 | 历史兼容 | `CourseController` | 无 | 旧版课程目录（未注册 Agent 工具） |
| **course-detail**| `/courses/:slug` | `CourseDetailView.vue`|需认证 | 历史兼容 | `CourseController` | 无 | 旧版课程详情（未注册 Agent 工具） |
| **lesson** | `/lessons/:lessonId`| `LessonView.vue` | 需认证 | 历史兼容 | `CourseController`, `InternalLessonContextController` | 无 | 旧版课时播放（未注册 Agent 工具） |
| **knowledge** | `/knowledge` | `KnowledgeView.vue` | 需认证 | 前端原型 | 无 | 无 | 旧版单轮问答（Mock 原型，未注册工具） |
| **agent-plan** | `/agent/plan` | `PlanChatView.vue` | 需认证 | 前端原型 | 无 | 无 | 旧版对话生成计划（Mock 原型，未注册工具） |
| **agent-tasks** | `/agent/tasks` | `TaskAgentView.vue` | 需认证 | 前端原型 | 无 | 无 | 旧版任务 Agent 页面（Mock 原型，未注册工具） |
| **activity** | `/activity` | `ActivityView.vue` | 需认证 | 治理审计 | `AuditLogController`, `AgentExecutionController` | `governance.executions.list`, `governance.audit.list` | 审计台账只读；跨范围授权由用户审批 |
| **assistant-health**| `/assistant/health`| `AssistantHealthView.vue`|需认证| 治理审计 | `AssistantHealthController`, `InternalAssistantUsageController`| `governance.health.get` | 输出未声明字段缺陷标记 pending |
| **notifications** | `/notifications` | `NotificationsView.vue`|需认证 | 系统设置 | `NotificationController` | `notifications.list`, `notifications.mark_read` | 标记已读写工具禁用 |
| **settings** | `/settings` | `SettingsView.vue` | 需认证 | 系统设置 | `UserSettingsController`, `AssistantAutomationController` | `settings.learning.get`, `settings.learning.update`, `automation.settings.get`, `automation.rules.list` | 偏好修改 HIGH 风险写工具禁用 |
| **settings-ai** | `/settings/ai` | `AiSettingsView.vue` | 需认证 | 系统设置 | `AiCredentialController` | `settings.ai_status.get` | 模型凭据状态只读；用户私钥输入专属 |
| **workspace-artifacts**| `/workspaces` | `WorkspaceArtifactsView.vue`|需认证| 实战工作区 | `ProjectWorkspaceController`, `RoadmapArtifactController`, `WorkspaceDeveloperController`, `RunnerController` | `workspaces.*`, `artifacts.*`, `runner.*`, `developer.*` (共 24 个工具) | **成果物最终验收** (`ACCEPT_ARTIFACT_SUBMISSION`) 用户专属；本地代码执行/Runner 默认禁用 |

### 2.2 65 个 Java 注册工具状态统计与归因

Java `AgentToolRegistry.catalog()` 冻结注册 65 个工具，按照 H02 协同规则与系统真实状态划分为三类：

1. **Allowed (28 个)**：
   - 包含只读查询工具与路由导航：`learning.context.get`, `learning.goals.list`, `learning.plans.list`, `learning.plan.get`, `learning.tasks.list`, `roadmap.current.get`, `roadmap.stage.get`, `roadmap.module.get`, `roadmap.node.get`, `schedule.unfinished.get`, `assessment.node_quiz_status.get`, `assessment.quiz.get`, `assessment.attempt.get`, `assessment.mastery.list`, `assessment.wrong_questions.summary`, `materials.list`, `materials.get`, `notifications.list`, `governance.executions.list`, `governance.audit.list`, `workspaces.list`, `artifacts.get`, `artifacts.list`, `settings.learning.get`, `settings.ai_status.get`, `automation.settings.get`, `automation.rules.list`, `navigation.resolve`。
   - 规则：副作用为 READ 或 NAVIGATE，`mutates_business_data: false`，不改变数据库业务状态。
2. **Disabled (33 个)**：
   - **21 个写工具（冻结至 H11）**：`roadmap.enroll`, `roadmap.upgrade`, `learning.goal.create`, `learning.plan.create`, `schedule.refresh`, `assessment.node_quiz.generate`, `assessment.node_quiz.retry`, `assessment.wrong_question_review.create`, `learning.task.update`, `materials.text.import`, `materials.web.import`, `notifications.mark_read`, `settings.learning.update`, `workspaces.register`, `artifacts.submit`, `runner.check.run`, `runner.dependencies.prepare`, `developer.patch.apply`, `developer.git.commit`, `developer.git.push`, `developer.interface_fallback.execute`。
   - **12 个开发与本地代码自动化工具**：`runner.execution.preview` 及 11 个 `developer.*` 只读工具（`developer.file_tree.get`, `developer.file.read`, `developer.code.search`, `developer.git.status`, `developer.git.diff`, `developer.git.log`, `developer.patch.preview`, `developer.tests.recommend`, `developer.git.commit.preview`, `developer.git.push.preview`, `developer.interface_fallback.preview`）。为确保沙箱与代码安全，本地自动化默认禁用。
3. **Pending (4 个)**：
   - `governance.health.get`：Java 返回约 29 个字段，而 `AgentToolOutputSchemas` 仅声明 12 个闭合字段，触发输出校验异常；
   - `schedule.today.get`：存在空值处理与任务展开边界缺陷；
   - `assessment.wrong_questions.list`：输出存在类型不匹配边界；
   - `artifacts.evaluate`：`RoadmapArtifactService.evaluate` 在校验属主后直接抛出异常，未接入模型，无法产生评分。

---

## 3. 用户专属操作与权威事实防线

### 3.1 用户专属业务动作（非 Agent 可代办）
系统严格区分“可由 Agent 辅助或代理的行为”与“必须由用户亲身实施的法定/考核行为”：

1. **测验题目作答提交 (`QUIZ_SUBMISSION`)**：
   - 对应接口：`POST /api/quizzes/{id}/submit`；
   - 防护机制：`uiActionDispatcher.ts` 中的 `assertAuthenticityGuards` 拦截对测验提交的代办；禁止 Agent 自动化答题刷分，考核真实反映学员掌握度。
2. **学习打卡总结提交 (`CHECKIN_SUMMARY_SUBMIT`)**：
   - 对应接口：`POST /api/roadmap/nodes/{id}/checkin`；
   - 防护机制：`assertAuthenticityGuards` 直接拦截；学习总结必须由学员反思输入，不可由 Agent 替签。
3. **实战成果物验收接受 (`ACCEPT_ARTIFACT_SUBMISSION`)**：
   - 对应接口：`POST /api/roadmap-artifacts/{id}/accept`；
   - 防护机制：`assertAuthenticityGuards` 拦截；成果物的最终确认属于用户专属主权动作。
4. **用户凭据与身份管理 (`AUTH_LOGIN` / `AUTH_REGISTER`)**：
   - 对应接口：`POST /api/auth/**`；
   - 防护机制：纯用户交互界面，未在 Agent 工具中注册，禁止 Agent 窥探密码或自建账号。
5. **高风险权限审批 (`GOVERNANCE_GRANT_APPROVAL`)**：
   - 对应接口：`POST /api/agent/grants`；
   - 防护机制：后端状态机强制要求 `WAITING_CONFIRMATION` / `WAITING_AUTHORIZATION` 仅能由用户主动发起授权，Agent 无法自我提权。

### 3.2 权威业务指标溯源（防模型虚构指标）
在 Pluggable Harness 运行时中，模型严禁自行推算或在回答中凭空编造业务事实，必须引用权威工具返回的真值：

- **学习进度 (Progress)**：唯一权威源于 `roadmap.current.get`（`enrolled`, `stage_progress`, `overall_progress`）与 `learning.context.get`；
- **今日待办 (Schedule & Tasks)**：唯一权威源于 `schedule.today.get` 与 `learning.tasks.list`；
- **知识掌握度 (Mastery)**：唯一权威源于 `assessment.mastery.list`（`radar_dimensions`, `mastery_levels`, `weak_spots`）；
- **错题统计 (Wrong Questions)**：唯一权威源于 `assessment.wrong_questions.summary`（`total_count`, `unreviewed_count`）；
- **用量与健康 (Health & Cost)**：唯一权威源于 `governance.health.get`（`totalExecutions`, `successRate`, `estimatedCost`）。

---

## 4. 显式跨端契约消费验证与哈希溯源

ZCode 显式读取 MiniMax 与 DeepSeek 的外部工作树交付产物，执行严格的 Fail-Closed 校验，无任何 Warning+Skip 宽容逻辑：

### 4.1 输入契约来源与指纹

| 输入工件 | 交付端 | 绝对路径 | 当前 HEAD Commit | SHA-256 指纹 |
| :--- | :--- | :--- | :--- | :--- |
| **Manifest Schema** | MiniMax | `/Users/moxiao/IdeaProjects/project-harness-h02-minimax/contracts/agent-capabilities/manifest.schema.json` | `ebb6f2b95563d71f6a43ac65b1c56bf3f59b31d5` | `fcce0b3d6e503feb3b598611e0b553247c90338b7feea4d15b96b48b5234cc76` |
| **Compiled Manifest**| MiniMax | `/Users/moxiao/IdeaProjects/project-harness-h02-minimax/contracts/agent-capabilities/generated/manifest.json` | `ebb6f2b95563d71f6a43ac65b1c56bf3f59b31d5` | `f59fbad509ccb5c0abf04d5bfa83ea261eb6a7d3e6906563a4ba9dcf84e4528b` |
| **Metadata YAML** | DeepSeek| `/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/contracts/agent-capabilities/metadata.yaml` | `e92fc157c85f340f6464bc13b0e1c5c7e2207f03` | `8d4460c681833ffccf8485ce901d71029ec72460cd6ea35ad4ebaa37cd62eaf6` |
| **Semantics Fixture**| DeepSeek| `/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/agent-service/tests/fixtures/capability-semantics.json` | `e92fc157c85f340f6464bc13b0e1c5c7e2207f03` | `7be70154260f45a7a810d1df3cbf7738d74dad293564fd98ebc06334f5baad11` |

### 4.2 校验结果
1. **结构合法性**：MiniMax 编译生成的 `manifest.json` 严格符合 `manifest.schema.json`，声明 `manifest_version: "1.0-draft"`；
2. **工具完整性**：清单内包含且仅包含 65 个 Java 注册工具，无重名、无遗漏、无虚构工具；
3. **语义对齐**：DeepSeek 声明的 65 项元数据语义完整映射至 MiniMax 清单，且分类与确认模式完全匹配实际 Java 治理事实。

---

## 5. 人工独立边界负例断言 (Negative Control Invariants)

在 `scripts/harness/capability-consumer-fixtures.json` 中独立构造了 9 项边界反例，验证消费校验器在各类非法输入与越权场景下能够精准拦截并抛出确定性异常：

| 反例编号 | 反例名称 | 注入破坏操作 | 预期错误代码 | 校验器实测捕获信息 | 判定 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **NEG-01** | 遗漏已登记 Java 工具 | 从清单中剔除 `roadmap.current.get` (64/65) | `ERR_MISSING_REGISTERED_TOOL` | `Missing required registered tool: roadmap.current.get` | **PASS (REJECTED)** |
| **NEG-02** | 重复工具名称注入 | 在清单中重复添加两份 `roadmap.current.get` | `ERR_DUPLICATE_WIRE_NAME` | `Duplicate tool wire name detected: roadmap.current.get` | **PASS (REJECTED)** |
| **NEG-03** | 虚构未注册工具目标 | 添加未在 Java 注册的 `studypilot.magic.solve` | `ERR_FICTIONAL_TOOL_TARGET` | `Fictional tool wire name not in Java registry: studypilot.magic.solve` | **PASS (REJECTED)** |
| **NEG-04** | 治理风险与确认冲突 | 将 HIGH 风险写工具 confirmation 设为 `none` | `ERR_GOVERNANCE_CONFLICT` | `Governance conflict: HIGH risk tool cannot have confirmation mode 'none'` | **PASS (REJECTED)** |
| **NEG-05** | H11 前错误开放写工具 | 将 `roadmap.enroll` 标记为 `exposure: allowed` | `ERR_WRITE_TOOL_EXPOSED` | `WRITE tool roadmap.enroll must be disabled prior to Task H11` | **PASS (REJECTED)** |
| **NEG-06** | 示例泄露敏感 ownerId | 在工具示例输入中注入 `ownerId: "attacker-user"` | `ERR_ILLEGAL_EXAMPLE_OWNER` | `Security violation: Example input contains forbidden 'ownerId' parameter` | **PASS (REJECTED)** |
| **NEG-07** | 用户专属操作被暴露 | 清单中尝试将 `assessment.quiz.submit` 暴露为工具 | `ERR_USER_EXCLUSIVE_EXPOSED` | `Boundary breach: User-exclusive operation assessment.quiz.submit cannot be exposed` | **PASS (REJECTED)** |
| **NEG-08** | 错误开放代码执行工具 | 将代码搜索 `developer.code.search` 标记为 `allowed` | `ERR_CODING_RUNNER_EXPOSED` | `Security violation: Coding/Developer tool developer.code.search must be disabled` | **PASS (REJECTED)** |
| **NEG-09** | 虚构权威事实来源 | 声明未在 Java 后端注册的 `fabricated_ai_score` | `ERR_UNVERIFIED_AUTHORITATIVE_FACT` | `Unverified authoritative fact 'fabricated_ai_score' has no registered Java source` | **PASS (REJECTED)** |

实测：9 项负例全部以非零退出/抛出异常被准确拦截，0 项假阳性通过。

---

## 6. 全量验证测试与实测日志

### 6.1 验证命令 1：独立消费侧校验脚本
执行命令：
```bash
node scripts/harness/capability-consumer-verify.mjs
```
实测输出：
```text
=== StudyPilot H02 Capability Consumer Verification (ZCode Owner) ===

--- 1. [DEPENDENCY] Fail-Closed Cross-Contract Input Checks ---
[CROSS_CONTRACT] MiniMax Manifest exists at /Users/moxiao/IdeaProjects/project-harness-h02-minimax/contracts/agent-capabilities/generated/manifest.json (fail-closed, no skip)
[CROSS_CONTRACT] MiniMax Schema exists at /Users/moxiao/IdeaProjects/project-harness-h02-minimax/contracts/agent-capabilities/manifest.schema.json (fail-closed, no skip)
[CROSS_CONTRACT] DeepSeek Metadata exists at /Users/moxiao/IdeaProjects/project-harness-h02-deepseek/contracts/agent-capabilities/metadata.yaml (fail-closed, no skip)
[CROSS_CONTRACT] ZCode Business Coverage exists at /Users/moxiao/IdeaProjects/project-harness-h02-zcode/docs/verification/harness/h02-business-coverage.json (fail-closed, no skip)
[CROSS_CONTRACT] Capability Consumer Fixtures exists at /Users/moxiao/IdeaProjects/project-harness-h02-zcode/scripts/harness/capability-consumer-fixtures.json (fail-closed, no skip)

--- 2. [PROVENANCE] File Hash Fingerprints ---
  MiniMax Manifest SHA-256: f59fbad509ccb5c0abf04d5bfa83ea261eb6a7d3e6906563a4ba9dcf84e4528b
  MiniMax Schema SHA-256:   fcce0b3d6e503feb3b598611e0b553247c90338b7feea4d15b96b48b5234cc76
  DeepSeek Metadata SHA-256:8d4460c681833ffccf8485ce901d71029ec72460cd6ea35ad4ebaa37cd62eaf6
  Coverage Audit SHA-256:   fd806f5b8ebe2e729fc64631de733d7742753570085fa26a1b6d1f3863d3cb59
  Fixtures SHA-256:         56d73ded4bef030bffdbb6892af2643c32698cf6046f45aa5c362bd206e59cee
[STRUCTURAL] MiniMax Manifest SHA-256 is valid 64-char hex string
[STRUCTURAL] MiniMax Schema SHA-256 is valid 64-char hex string
[STRUCTURAL] DeepSeek Metadata SHA-256 is valid 64-char hex string

--- 3. [MANIFEST_INTEGRITY] Validating Manifest Structure ---
[STRUCTURAL] Manifest declares manifest_version '1.0-draft'
[STRUCTURAL] Manifest declares valid ISO-8601 generated_at timestamp
[STRUCTURAL] Manifest contains exactly 65 tools (found: 65)
[STRUCTURAL] Manifest contains zero duplicate tool names (65 unique names)
[CROSS_CONTRACT] Manifest perfectly contains all 65 Java registered tool names without omission or invention

--- 4. [GOVERNANCE_INVARIANTS] Security and Exposure Boundaries ---
  Exposure Breakdown: allowed=28, disabled=33, pending=4
[STRUCTURAL] Exactly 28 safe read/navigate tools marked 'allowed' (found: 28)
[STRUCTURAL] Exactly 33 write/runner/coding tools marked 'disabled' (found: 33)
[STRUCTURAL] Exactly 4 defective tools marked 'pending' (found: 4)
[BEHAVIORAL] All 21 WRITE/LOCAL tools are strictly disabled prior to Task H11
[BEHAVIORAL] All developer.* and runner.* tools are strictly disabled by default
[BEHAVIORAL] All tool examples are clean and free of forbidden ownerId parameters

--- 5. [BUSINESS_COVERAGE] Route and Authoritative Fact Auditing ---
[STRUCTURAL] Business coverage encompasses all 31 named routes (found: 31)
[STRUCTURAL] Business coverage audits all 65 registered backend tools (found: 65)
[STRUCTURAL] Explicitly catalogs 6 user-exclusive operations
[STRUCTURAL] Explicitly catalogs 7 authoritative backend fact sources

--- 7. [BEHAVIORAL] Negative Control Invariant Assertions ---
[STRUCTURAL] At least 9 negative control test cases defined (found: 9)
  [BEHAVIORAL_REJECTED] NEG-01-MISSING-TOOL (missing registered tool coverage): Rejected as expected with 'ERR_MISSING_REGISTERED_TOOL: Missing required registered tool: ro...'
  [BEHAVIORAL_REJECTED] NEG-02-DUPLICATE-WIRE-NAME (duplicate tool wire name in manifest): Rejected as expected with 'ERR_DUPLICATE_WIRE_NAME: Duplicate tool wire name detected: roadm...'
  [BEHAVIORAL_REJECTED] NEG-03-FICTIONAL-TARGET (fictional tool execution target): Rejected as expected with 'ERR_FICTIONAL_TOOL_TARGET: Fictional tool wire name not in Java r...'
  [BEHAVIORAL_REJECTED] NEG-04-GOVERNANCE-CONFLICT (governance risk and confirmation conflict): Rejected as expected with 'ERR_GOVERNANCE_CONFLICT: Governance conflict: HIGH risk tool cann...'
  [BEHAVIORAL_REJECTED] NEG-05-WRITE-ENABLED-PRE-H11 (write tool exposed as allowed before H11): Rejected as expected with 'ERR_WRITE_TOOL_EXPOSED: WRITE tool roadmap.enroll must be disable...'
  [BEHAVIORAL_REJECTED] NEG-06-ILLEGAL-EXAMPLE-OWNER (example leaks or injects ownerId): Rejected as expected with 'ERR_ILLEGAL_EXAMPLE_OWNER: Security violation: Example input cont...'
  [BEHAVIORAL_REJECTED] NEG-07-USER-EXCLUSIVE-EXPOSED (user exclusive operation exposed as agent tool): Rejected as expected with 'ERR_USER_EXCLUSIVE_EXPOSED: Boundary breach: User-exclusive opera...'
  [BEHAVIORAL_REJECTED] NEG-08-CODING-RUNNER-ENABLED (developer or runner tool incorrectly allowed): Rejected as expected with 'ERR_CODING_RUNNER_EXPOSED: Security violation: Coding/Developer t...'
  [BEHAVIORAL_REJECTED] NEG-09-AUTHORITATIVE-FACT-NO-SOURCE (authoritative metric without registered Java source): Rejected as expected with 'ERR_UNVERIFIED_AUTHORITATIVE_FACT: Unverified authoritative fact ...'
[BEHAVIORAL] All 9 negative controls strictly rejected by consumer validator (passed: 9/9)

===============================================================
   All H02 Capability Consumer Checks PASSED! (25/25 checks, 0 failures)
===============================================================
```

### 6.2 验证命令 2：前端 Vitest 能力与边界专项测试
执行命令：
```bash
npm --prefix web test -- tests/harness-capabilities/ tests/harness-baseline/ --run
```
实测输出：
```text
 ✓ tests/harness-capabilities/capability-consumer.spec.ts (15 tests) 7ms
 ✓ tests/harness-baseline/frontend-baseline.spec.ts (15 tests) 219ms

 Test Files  2 passed (2)
      Tests  30 passed (30)
   Duration  756ms
```

### 6.3 验证命令 3：前端全量回归测试与 TypeScript 检查
执行命令：
```bash
npm --prefix web test -- --run && npm --prefix web run typecheck
```
实测输出：
```text
 Test Files  37 passed (37)
      Tests  358 passed (358)
   Duration  2.93s

> studypilot-web@0.1.0 typecheck
> vue-tsc --noEmit
# 退出码 0，零警告零错误
```

---

## 7. 本地提交与所有权清单 (H02)

### 7.1 本地提交文件清单（严格限定所有权范围）
- `docs/verification/harness/h02-business-coverage.json`：全量审计 31 个路由、控制器、65 个工具、用户专属行为与权威事实真值来源
- `scripts/harness/capability-consumer-verify.mjs`：独立跨端消费离线验证脚本（支持 CLI 参数覆写、哈希溯源、Fail-Closed、9 项负例断言）
- `scripts/harness/capability-consumer-fixtures.json`：独立手写正例与 9 项负例边界测试用例
- `web/tests/harness-capabilities/capability-consumer-fixtures.fixture.json`：前端 Vitest 消费用独立副本
- `web/tests/harness-capabilities/capability-validator.ts`：前端消费侧纯逻辑校验引擎
- `web/tests/harness-capabilities/capability-consumer.spec.ts`：15 项前端行为与边界测试套件
- `docs/verification/harness/h02-zcode.md`：本专属 H02 技术验证证据报告

### 7.2 限制与未覆盖项声明
1. **未实现 UI 与生产改动**：H02 不包含新悬浮球生产组件开发，未修改 `web/src/**` 生产业务组件，未修改前端路由；
2. **未修改公共 Schema 或元数据**：`contracts/agent-capabilities/**` 归 MiniMax 与 DeepSeek 分管，ZCode 仅做只读跨端消费验证；
3. **未越权开放写操作或代码执行**：21 个写工具与所有开发/Runner 工具严格标记为 `disabled`；
4. **未做真实模型调用**：全部测试均为纯离线测试，零付费模型消耗；
5. **快照工件隔离**：`backend/mvnw.cmd` CRLF 快照工件未提交、未篡改；
6. **不进入 H03**：本地交付后停止，等待 Codex 独立验收。
