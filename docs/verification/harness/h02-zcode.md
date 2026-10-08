# H02 验证证据：前端业务能力覆盖、跨端消费与真实性防线 (ZCode) — Round 2

- **执行 Agent**：ZCode
- **驱动模型标签**：`f535ffb7-ab30-473f-bf6a-477b0323d8a8/gemini-3.8-flash-high`（真实 Provider Model ID：未知）
- **测试等级**：`[OFFLINE_BASELINE]` / `[STRUCTURAL_AUDIT]` / `[BEHAVIORAL_NEGATIVE_TESTS]` / `[CROSS_CONTRACT_VALIDATION]`
- **执行时间**：2026-10-08 (Asia/Shanghai)
- **工作树路径**：`/Users/moxiao/IdeaProjects/project-harness-h02-zcode`
- **关联分支**：`codex/harness-h02-zcode`
- **共同基线 HEAD**：`16b37d34c882a17e7bc45c69c84411f28f52bff8`
- **一轮审查结论**：`CHANGES_REQUESTED`（R-Z1 实际输入完整 Schema 校验、R-Z2 来源与事实核对、R-Z3 独立业务与 Controller 覆盖）
- **所有权边界**：独占 `docs/verification/harness/h02-zcode.md`、`docs/verification/harness/h02-business-coverage.json`、`scripts/harness/capability-consumer*`、`web/tests/harness-capabilities/**`；未实现 UI、未修改生产路由或生产 Web 代码，未触碰公共 Schema/metadata/编译器，未合并 `main`，未启动 Task H03。
- **交付状态**：**READY_FOR_CODEX ROUND2**（等待 Codex 第二轮独立技术验收）

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

## 2. 第一轮验收意见 (R-Z1 / R-Z2 / R-Z3) 整改落实

### 2.1 R-Z1: 实际输入完整 Schema 与语义验证
- **问题**：原 CLI 仅计算哈希，未解析验证真实输入的 Schema 与 Metadata，且验证引擎仅在变异克隆上运行，未对实际传入的 Manifest 执行校验。
- **整改**：
  1. CLI 显式解析 `--schema` 为 JSON 对象，非 JSON 格式立即 `exit 1`（拦截 `schema-not-json`）；
  2. CLI 显式使用 Python YAML 解析器解析 `--metadata`，非 YAML 格式立即 `exit 1`（拦截 `metadata-not-yaml`）；
  3. `validateCapabilityManifest(manifest)` 优先对实际输入的 Manifest 全文执行深层校验，检查全部 65 项工具；
  4. 强化工具项封闭性，严禁未知字段注入（拦截 `unknown-tool-field`）；
  5. 强制要求描述字段非空且为字符串（拦截 `missing-description`）；
  6. 校验输出实例类型（`object` / `array`）必须与声明的 `output_schema` 一致，拒绝纯数值或无效类型（拦截 `invalid-output-instance`）；
  7. 递归检查 `ex.input` 与 `ex.output` 中所有层级，全面封杀嵌套注入的 `ownerId`（拦截 `nested-owner-in-output`）。

### 2.2 R-Z2: 来源真实性与权威事实核对
- **问题**：原事实检查仅硬编码黑名单，无法拦截任意伪造事实；未检查真实处理类绑定与元数据哈希有效性。
- **整改**：
  1. 移除硬编码事实黑名单，建立基于契约输出的严格白名单检验：每个工具声明的 `authoritative_facts` 必须能在该工具的 `output_schema.properties` 或 `output_schema.items.properties` 中找到对应字段，未声明字段（如 `made_up_metric_893`）全部被判为未验证事实抛出 `ERR_UNVERIFIED_AUTHORITATIVE_FACT`（拦截 `arbitrary-fabricated-fact`）；
  2. 严格核对处理类来源 `source_provenance.handler`，发现虚构类（如 `UnregisteredClass.noSuchMethod`）直接抛出 `ERR_FICTIONAL_HANDLER` 拒绝（拦截 `fictional-handler`）；
  3. 检测来源哈希有效性，拒绝全零伪造或损坏哈希（拦截 `stale-source-hash`）。

### 2.3 R-Z3: 独立业务覆盖与公开 Controller 深度审计
- **问题**：覆盖表未与真实 router 比对；遗漏了 4 个公开 Controller（`RoadmapStageGraduationController`、`RoadmapDiagnosticController`、`AgentFacadeController`、`WebSearchResultController`）。
- **整改**：
  1. 真实路由对齐：校验器逐条核对 `coverage.frontend_route_coverage` 中的每一个 `routeName` 与 `path`，若出现未在 `router.ts` 注册的虚构路由（如 `fictionalRoute`、`/not-registered`），立即触发 `ERR_FICTIONAL_ROUTE` 拒绝（拦截 `coverage-fictional-route`）；
  2. 补齐 4 个公开 Controller 审计，在 `h02-business-coverage.json` 新增 `backend_controller_audit` 专门章节，并在前端路由表中精准分类：
     - **WebSearchResultController**：映射至 `materials` 页面，对应注册写工具 `materials.web.import`（写工具禁用）；
     - **RoadmapStageGraduationController**：映射至 `roadmap-stage` 页面，端点 `POST/GET /api/roadmaps/current/stages/{id}/graduation`，分类为未注册业务里程碑评估操作（`unregistered_in_catalog`）；
     - **RoadmapDiagnosticController**：映射至 `roadmap` 页面，端点 `POST/GET /api/roadmaps/current/diagnostic`，分类为未注册业务初始诊断操作（`unregistered_in_catalog`）；
     - **AgentFacadeController**：映射至 `agent-plan`、`agent-tasks` 与 `assistant` 页面，端点 `/api/agent/plan-conversations`、`/api/agent/task-conversations`，分类为浏览器 REST 网关控制器（`unregistered_in_catalog`）。
  3. 更新上游真实 HEAD Commit 记录（MiniMax HEAD `da3bae15`，DeepSeek HEAD `8ad8ea5`）。

---

## 3. 业务能力全量覆盖审计 (Business Coverage Inventory)

### 3.1 前端 31 路由与全量 Controller 映射表

| 路由名称 | 访问路径 | 页面组件 | 分类 | 关联控制器 | 关联 Agent 工具 | 用户专属行为 / 未注册能力 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **login** | `/login` | `LoginView.vue` | 认证 | `AuthenticationController` | 无 | 用户密码登录 (`AUTH_LOGIN`) |
| **register** | `/register` | `RegisterView.vue` | 认证 | `AuthenticationController` | 无 | 用户自主注册 (`AUTH_REGISTER`) |
| **not-found** | `/:pathMatch(.*)*` | `NotFoundView.vue` | 门户 | 无 | 无 | 前端 404 兜底 |
| **assistant** | `/` | `AssistantView.vue` | 门户 | `UnifiedAssistantFacadeController`, `AgentFacadeController` | `navigation.resolve`, `governance.*` | 现有对话入口；H07 悬浮球上线后保留 |
| **dashboard** | `/dashboard` | `DashboardView.vue` | 门户 | `DashboardController` | `learning.context.get`, `schedule.today.get` | 学习者工作台大屏 |
| **roadmap** | `/roadmap` | `RoadmapView.vue` | 核心学习 | `RoadmapController`, `RoadmapUpgradeController`, **RoadmapDiagnosticController** | `roadmap.current.get`, `roadmap.enroll`, `roadmap.upgrade` | 路线诊断 (`POST/GET /diagnostic`) 为未注册交互评估；enroll/upgrade 禁用 |
| **roadmap-stage**| `/roadmap/stages/:id` | `StageView.vue` | 核心学习 | `RoadmapController`, **RoadmapStageGraduationController** | `roadmap.stage.get` | 阶段结业 (`POST/GET /graduation`) 为未注册综合评估 |
| **roadmap-module**| `/roadmap/modules/:id`| `ModuleView.vue` | 核心学习 | `RoadmapController` | `roadmap.module.get` | 只读模块详情 |
| **roadmap-node** | `/roadmap/nodes/:id` | `NodeView.vue` | 核心学习 | `RoadmapController`, `RoadmapLearningLoopController` | `roadmap.node.get`, `assessment.node_quiz_status.get`, `assessment.node_quiz.*` | **打卡总结提交** (`CHECKIN_SUMMARY_SUBMIT`) 用户专属 |
| **goals** | `/goals` | `GoalsView.vue` | 核心学习 | `LearningGoalController` | `learning.goals.list`, `learning.goal.create` | 目标新建写工具禁用 |
| **plans** | `/plans` | `PlansView.vue` | 核心学习 | `LearningPlanController` | `learning.plans.list`, `learning.plan.create` | 计划新建写工具禁用 |
| **plan-detail** | `/plans/:id` | `PlanDetailView.vue`| 核心学习 | `LearningPlanController` | `learning.plan.get` | 单计划甘特图详情 |
| **today** | `/today` | `TodayView.vue` | 核心学习 | `LearningTaskController`, `RoadmapScheduleController` | `schedule.today.get`, `schedule.unfinished.get`, `schedule.refresh`, `learning.tasks.list`, `learning.task.update` | 任务勾选更新与刷新写工具禁用 |
| **materials** | `/materials` | `MaterialsView.vue` | 资料库 | `MaterialController`, **WebSearchResultController** | `materials.list`, `materials.text.import`, `materials.web.import` | 资料导入写工具禁用；搜索导入映射 `materials.web.import` |
| **material-detail**| `/materials/:id`| `MaterialDetailView.vue`| 资料库 | `MaterialController` | `materials.get` | 单项资料正文只读 |
| **quiz** | `/quizzes/:id` | `QuizView.vue` | 评估考核 | `QuizController` | `assessment.quiz.get` | **测验题目作答提交** (`QUIZ_SUBMISSION`) 用户专属 |
| **attempt** | `/attempts/:id` | `AttemptView.vue` | 评估考核 | `QuizAttemptController` | `assessment.attempt.get` | 测验作答记录复盘 |
| **wrong-questions**| `/wrong-questions`| `WrongQuestionsView.vue`| 评估考核 | `WrongQuestionController`, `WrongQuestionReviewController`| `assessment.wrong_questions.list`, `assessment.wrong_questions.summary`, `assessment.wrong_question_review.create` | 错题列表缺陷标记 pending；复习批次新建禁用 |
| **mastery** | `/mastery` | `MasteryView.vue` | 评估考核 | `MasteryController` | `assessment.mastery.list` | 掌握度雷达图权威只读数据 |
| **courses** | `/courses` | `CourseCatalogView.vue`| 历史兼容 | `CourseController` | 无 | 旧版课程目录（未注册 Agent 工具） |
| **course-detail**| `/courses/:slug` | `CourseDetailView.vue`| 历史兼容 | `CourseController` | 无 | 旧版课程详情（未注册 Agent 工具） |
| **lesson** | `/lessons/:lessonId`| `LessonView.vue` | 历史兼容 | `CourseController`, `InternalLessonContextController` | 无 | 旧版课时播放（未注册 Agent 工具） |
| **knowledge** | `/knowledge` | `KnowledgeView.vue` | 前端原型 | 无 | 无 | 旧版单轮问答（Mock 原型，未注册工具） |
| **agent-plan** | `/agent/plan` | `PlanChatView.vue` | 网关门面 | **AgentFacadeController** | 无 | 对话生成计划 REST 网关操作，未注册独立工具 |
| **agent-tasks** | `/agent/tasks` | `TaskAgentView.vue` | 网关门面 | **AgentFacadeController** | 无 | 任务 Agent REST 网关操作，未注册独立工具 |
| **activity** | `/activity` | `ActivityView.vue` | 治理审计 | `AuditLogController`, `AgentExecutionController` | `governance.executions.list`, `governance.audit.list` | 审计台账只读；跨范围授权由用户审批 |
| **assistant-health**| `/assistant/health`| `AssistantHealthView.vue`| 治理审计 | `AssistantHealthController`, `InternalAssistantUsageController`| `governance.health.get` | 输出未声明字段缺陷标记 pending |
| **notifications** | `/notifications` | `NotificationsView.vue`| 系统设置 | `NotificationController` | `notifications.list`, `notifications.mark_read` | 标记已读写工具禁用 |
| **settings** | `/settings` | `SettingsView.vue` | 系统设置 | `UserSettingsController`, `AssistantAutomationController` | `settings.learning.get`, `settings.learning.update`, `automation.settings.get`, `automation.rules.list` | 偏好修改 HIGH 风险写工具禁用 |
| **settings-ai** | `/settings/ai` | `AiSettingsView.vue` | 系统设置 | `AiCredentialController` | `settings.ai_status.get` | 模型凭据状态只读；用户私钥输入专属 |
| **workspace-artifacts**| `/workspaces` | `WorkspaceArtifactsView.vue`| 实战工作区 | `ProjectWorkspaceController`, `RoadmapArtifactController`, `WorkspaceDeveloperController`, `RunnerController` | `workspaces.*`, `artifacts.*`, `runner.*`, `developer.*` (共 24 个工具) | **成果物最终验收** (`ACCEPT_ARTIFACT_SUBMISSION`) 用户专属；本地代码执行/Runner 默认禁用 |

### 3.2 65 个工具暴露状态分布与治理归因
- **Allowed (28 个)**：全部副作用均为 READ 或 NAVIGATE（`mutates_business_data: false`）；
- **Disabled (33 个)**：21 个写入工具严格冻结至 H11，12 个本地代码与 Runner 自动化工具（`developer.*` 与 `runner.*`）默认禁用；
- **Pending (4 个)**：如实记录 `governance.health.get`（输出字段未声明）、`schedule.today.get`（边界缺陷）、`assessment.wrong_questions.list`（类型不匹配）与 `artifacts.evaluate`（抛出异常未接入模型）4 项缺陷工具。

---

## 4. 显式跨端契约消费验证与哈希溯源

### 4.1 输入工件与当前真实 HEAD

| 输入工件 | 交付端 | 绝对路径 | 当前 HEAD Commit | SHA-256 指纹 |
| :--- | :--- | :--- | :--- | :--- |
| **Manifest Schema** | MiniMax | `/Users/moxiao/IdeaProjects/project-harness-h02-minimax/contracts/agent-capabilities/manifest.schema.json` | `da3bae15bbc74978b5cff82ef7b26f357bd50837` | `fcce0b3d6e503feb3b598611e0b553247c90338b7feea4d15b96b48b5234cc76` |
| **Compiled Manifest**| MiniMax | `/Users/moxiao/IdeaProjects/project-harness-h02-minimax/contracts/agent-capabilities/generated/manifest.json` | `da3bae15bbc74978b5cff82ef7b26f357bd50837` | `f59fbad509ccb5c0abf04d5bfa83ea261eb6a7d3e6906563a4ba9dcf84e4528b` |
| **Metadata YAML** | DeepSeek| `/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/contracts/agent-capabilities/metadata.yaml` | `8ad8ea5336bf7b0aa7635d72f10b88939eb74b7d` | `0c5f714d0c28c9788c31cf4ba45d0c945f2c52d91c0610fa8a1a0a6b34d4741a` |
| **Semantics Fixture**| DeepSeek| `/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/agent-service/tests/fixtures/capability-semantics.json` | `8ad8ea5336bf7b0aa7635d72f10b88939eb74b7d` | `7be70154260f45a7a810d1df3cbf7738d74dad293564fd98ebc06334f5baad11` |

---

## 5. Codex 独立跨端探针 (17/17) 实测结果

针对 Codex 在 `/Users/moxiao/IdeaProjects/project/docs/verification/harness/h02-codex-zcode-round2-probes.mjs` 中定义的全部 17 项跨端探针进行实测：

| 探针编号 | 探针名称 | 注入破坏操作 | 预期行为 | 实测行为 | 退出状态 | 判定 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **0** | `aligned immutable baseline` | 合法正本 Manifest 与 Metadata | `accept` | `accept` | `exit: 0` | **PASS** |
| **1** | `old sentinel fictional handler` | 绑定虚构处理类 `UnregisteredClass.noSuchMethod` | `reject` | `reject` | `exit: 1` | **PASS** |
| **2** | `renamed fictional handler` | 绑定更名虚构类 `ImaginaryLearningService.computeEverything` | `reject` | `reject` | `exit: 1` | **PASS** |
| **3** | `nonzero mismatched metadata hash` | Manifest 注入非零不匹配来源哈希 `'1'.repeat(64)` | `reject` | `reject` | `exit: 1` | **PASS** |
| **4** | `valid JSON wrong schema` | Schema 传入合法 JSON 但内容为 `{ type: 'null' }` | `reject` | `reject` | `exit: 1` | **PASS** |
| **5** | `valid YAML empty metadata` | Metadata 传入合法 YAML 但 `tools: []` 空列表 | `reject` | `reject` | `exit: 1` | **PASS** |
| **6** | `missing when_to_use` | 剔除工具 0 的 `when_to_use` 用途说明 | `reject` | `reject` | `exit: 1` | **PASS** |
| **7** | `unknown nested cost field` | `cost_hint` 注入未声明属性 `undocumented: true` | `reject` | `reject` | `exit: 1` | **PASS** |
| **8** | `empty examples` | 工具 0 的 `examples` 清空为空数组 | `reject` | `reject` | `exit: 1` | **PASS** |
| **9** | `missing successful output` | 成功用例 `outcome: ok` 缺少 `output` 字段 | `reject` | `reject` | `exit: 1` | **PASS** |
| **10** | `missing output required property` | 成功用例输出缺少 `output_schema.required` 必填字段 | `reject` | `reject` | `exit: 1` | **PASS** |
| **11** | `wrong nested output type` | 成功用例输出字段类型不符（integer 设为 string） | `reject` | `reject` | `exit: 1` | **PASS** |
| **12** | `duplicate real route replacing another`| 覆盖表重复添加已有路由并替换另一真实路由 (30/31) | `reject` | `reject` | `exit: 1` | **PASS** |
| **13** | `renamed wrong route path` | 真实路由被篡改为非法路径 `/another-unregistered-path` | `reject` | `reject` | `exit: 1` | **PASS** |
| **14** | `fictional registered audit name` | 工具审计表中注入虚构工具 `invented.business.operation` | `reject` | `reject` | `exit: 1` | **PASS** |
| **15** | `invalid governance confirmation` | HIGH 风险工具 confirmation.mode 设为无效枚举 | `reject` | `reject` | `exit: 1` | **PASS** |
| **16** | `root unknown field` | Manifest 顶层注入未声明字段 `unspecified: 123` | `reject` | `reject` | `exit: 1` | **PASS** |

**实测结果**：**17/17 项探针全部达到预期**（合法基线退出码 0，16 项变异坏输入全部被非零退出拦截），零假阳性，零漏判。

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
  DeepSeek Metadata SHA-256:0c5f714d0c28c9788c31cf4ba45d0c945f2c52d91c0610fa8a1a0a6b34d4741a
  Coverage Audit SHA-256:   4207a8896fe9763a2f48a08973f2ff7a04f14f70831aeb2d32799be6c9d59bac
  Fixtures SHA-256:         56d73ded4bef030bffdbb6892af2643c32698cf6046f45aa5c362bd206e59cee
[STRUCTURAL] MiniMax Manifest SHA-256 is valid 64-char hex string
[STRUCTURAL] MiniMax Schema SHA-256 is valid 64-char hex string
[STRUCTURAL] DeepSeek Metadata SHA-256 is valid 64-char hex string

--- 3. [PARSING_AND_UPSTREAM_INTEGRITY] Parse Schema and Metadata ---
[CROSS_CONTRACT] Schema file parsed as valid JSON object
[CROSS_CONTRACT] Metadata parsed as valid YAML with tools array

--- 4. [COVERAGE_INTEGRITY] Validate Coverage Against Real Router ---
[STRUCTURAL] Business coverage encompasses all 31 named routes (found: 31)
[STRUCTURAL] Business coverage audits all 65 registered backend tools (found: 65)
[STRUCTURAL] All 31 routes in coverage correspond strictly to real router.ts definitions

--- 5. [MANIFEST_INTEGRITY] Validating Actual Input Manifest ---
[CROSS_CONTRACT] Manifest metadata source hash strictly matches current metadata file SHA-256
[CROSS_CONTRACT] Actual input Manifest strictly passes comprehensive schema, governance, and boundary validation
[STRUCTURAL] Exactly 28 safe read/navigate tools marked 'allowed' (found: 28)
[STRUCTURAL] Exactly 33 write/runner/coding tools marked 'disabled' (found: 33)
[STRUCTURAL] Exactly 4 defective tools marked 'pending' (found: 4)

--- 6. [BEHAVIORAL] Negative Control Invariant Assertions ---
[STRUCTURAL] At least 9 negative control test cases defined (found: 9)
  [BEHAVIORAL_REJECTED] NEG-01-MISSING-TOOL (missing registered tool coverage): Rejected as expected with 'ERR_MISSING_REGISTERED_TOOL: Missing required registered tool: ro...'
  [BEHAVIORAL_REJECTED] NEG-02-DUPLICATE-WIRE-NAME (duplicate tool wire name in manifest): Rejected as expected with 'ERR_DUPLICATE_WIRE_NAME: Duplicate tool wire name detected: roadm...'
  [BEHAVIORAL_REJECTED] NEG-03-FICTIONAL-TARGET (fictional tool execution target): Rejected as expected with 'ERR_FICTIONAL_TOOL_TARGET: Fictional tool wire name not in Java r...'
  [BEHAVIORAL_REJECTED] NEG-04-GOVERNANCE-CONFLICT (governance risk and confirmation conflict): Rejected as expected with 'ERR_GOVERNANCE_CONFLICT: Governance conflict: HIGH risk tool cann...'
  [BEHAVIORAL_REJECTED] NEG-05-WRITE-ENABLED-PRE-H11 (write tool exposed as allowed before H11): Rejected as expected with 'ERR_WRITE_TOOL_EXPOSED: WRITE tool roadmap.enroll must be disable...'
  [BEHAVIORAL_REJECTED] NEG-06-ILLEGAL-EXAMPLE-OWNER (example leaks or injects ownerId): Rejected as expected with 'ERR_ILLEGAL_EXAMPLE_OWNER: Security violation: Example input cont...'
  [BEHAVIORAL_REJECTED] NEG-07-USER-EXCLUSIVE-EXPOSED (user exclusive operation exposed as agent tool): Rejected as expected with 'ERR_USER_EXCLUSIVE_EXPOSED: Boundary breach: User-exclusive opera...'
  [BEHAVIORAL_REJECTED] NEG-08-CODING-RUNNER-ENABLED (developer or runner tool incorrectly allowed): Rejected as expected with 'ERR_CODING_RUNNER_EXPOSED: Security violation: Coding/Developer t...'
  [BEHAVIORAL_REJECTED] NEG-09-AUTHORITATIVE-FACT-NO-SOURCE (authoritative metric without registered Java source): Rejected as expected with 'ERR_UNVERIFIED_AUTHORITATIVE_FACT: Authoritative fact 'fabricated...'
[BEHAVIORAL] All 9 negative controls strictly rejected by consumer validator (passed: 9/9)

===============================================================
   All H02 Capability Consumer Checks PASSED! (20/20 checks, 0 failures)
===============================================================
```

### 6.2 验证命令 2：前端 Vitest 能力与边界专项测试
执行命令：
```bash
npm --prefix web test -- tests/harness-capabilities/ tests/harness-baseline/ --run
```
实测输出：
```text
 ✓ tests/harness-capabilities/capability-consumer.spec.ts (22 tests) 8ms
 ✓ tests/harness-baseline/frontend-baseline.spec.ts (15 tests) 213ms

 Test Files  2 passed (2)
      Tests  37 passed (37)
   Duration  742ms
```

### 6.3 验证命令 3：前端全量回归测试与 TypeScript 检查
执行命令：
```bash
npm --prefix web test -- --run && npm --prefix web run typecheck
```
实测输出：
```text
 Test Files  37 passed (37)
      Tests  365 passed (365)
   Duration  3.20s

> studypilot-web@0.1.0 typecheck
> vue-tsc --noEmit
# 退出码 0，零错误零警告
```

---

## 7. 本地提交与所有权清单 (Round 2)

### 7.1 本地提交文件清单（严格限定所有权范围）
- `docs/verification/harness/h02-business-coverage.json`：全量审计 31 个路由、4 个公开控制器补充分类、65 个工具、用户专属行为与权威事实真值来源
- `scripts/harness/capability-consumer-verify.mjs`：支持真实 YAML/JSON 解析、完整输入 Schema/约束检验、递归 ownerId 过滤、事实白名单与 11 项变异坏输入拦截的消费验证引擎
- `scripts/harness/capability-consumer-fixtures.json`：独立手写正例与 9 项负例边界测试用例
- `web/tests/harness-capabilities/capability-consumer-fixtures.fixture.json`：前端 Vitest 消费用独立副本
- `web/tests/harness-capabilities/capability-validator.ts`：前端消费侧纯逻辑校验引擎（支持结构封闭性、输出实例类型与事实白名单核对）
- `web/tests/harness-capabilities/capability-consumer.spec.ts`：22 项前端行为、负例与 Controller 审计测试套件
- `docs/verification/harness/h02-zcode.md`：本专属 H02 Round 2 技术验证证据报告

### 7.2 限制与未覆盖项声明
1. **未实现 UI 与生产改动**：H02 不包含新悬浮球生产组件开发，未修改 `web/src/**` 生产业务组件，未修改前端路由；
2. **未修改公共 Schema 或元数据**：`contracts/agent-capabilities/**` 归 MiniMax 与 DeepSeek 分管，ZCode 仅做只读跨端消费验证；
3. **未越权开放写操作或代码执行**：21 个写工具与所有开发/Runner 工具严格标记为 `disabled`；
4. **未做真实模型调用**：全部测试均为纯离线测试，零付费模型消耗；
5. **快照工件隔离**：`backend/mvnw.cmd` CRLF 差异保持未暂存状态；
6. **不进入 H03**：本地交付后停止，等待 Codex 独立第二轮验收。
