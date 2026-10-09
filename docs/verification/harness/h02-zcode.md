# H02 验证证据：前端业务能力覆盖、跨端消费与真实性防线 (ZCode) — Round 4

- **执行 Agent**：ZCode
- **驱动模型标签**：`f535ffb7-ab30-473f-bf6a-477b0323d8a8/gemini-3.8-flash-high`（真实 Provider Model ID：未知）
- **测试等级**：`[OFFLINE_BASELINE]` / `[STRUCTURAL_AUDIT]` / `[BEHAVIORAL_NEGATIVE_TESTS]` / `[CROSS_CONTRACT_VALIDATION]`
- **执行时间**：2026-10-09 (Asia/Shanghai)
- **工作树路径**：`/Users/moxiao/IdeaProjects/project-harness-h02-zcode`
- **关联分支**：`codex/harness-h02-zcode`
- **共同基线 HEAD**：`16b37d34c882a17e7bc45c69c84411f28f52bff8`
- **审查结论整改**：`CHANGES_REQUESTED`（四轮整改闭环 R-Z9 描述符真实内容哈希与源提交产物溯源校验，R-Z10 52 个 Controller 183 项全量公开 HTTP 操作扫描与权威事实服务/端点强校验）
- **所有权边界**：独占 `docs/verification/harness/h02-zcode.md`、`docs/verification/harness/h02-business-coverage.json`、`scripts/harness/capability-consumer*`、`web/tests/harness-capabilities/**`；未实现 UI、未修改生产路由或生产 Web 代码，未触碰公共 Schema/metadata/编译器，未合并 `main`，未启动 Task H03。
- **交付状态**：**READY_FOR_CODEX ROUND4**（等待 Codex 第四轮独立技术验收）

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

## 2. 验收意见 (R-Z9 / R-Z10) 深度整改闭环

### 2.1 R-Z9: 描述符内容溯源与提交产物真实性核验
- **拒绝非重复伪造描述符哈希**：
  - 弃用单纯的重复字符格式检查；直接读取实际描述符内容字节（优先读取 `--descriptors` 指定文件或与 manifest 同级的 `descriptors.json`，若不可得则从 Git 对应提交中提取 `git show ${commit}:contracts/agent-capabilities/generated/descriptors.json`），计算真实 SHA-256 并严格比对；
  - 任何非重复但伪造的 64 位描述符哈希（如 `'0123456789abcdef'.repeat(4)`），因与实际字节 SHA-256 不符，被立即拦截抛出 `ERR_DESCRIPTORS_HASH_MISMATCH` 拒绝；
- **源提交产物关联真实性核验**：
  - 不仅通过 `git cat-file -e ${commit}^{commit}` 验证提交存在，还进一步执行 `git cat-file -e ${commit}:contracts/agent-capabilities/generated/descriptors.json`，强行核验该提交中确实包含描述符源工件；
  - 任何虽存在但与当前产物无关的提交（如输入共同基线提交 `16b37d34c882a17e7bc45c69c84411f28f52bff8`，此时描述符文件尚未诞生），被立即判定为无关源提交并抛出 `ERR_UNRELATED_SOURCE_COMMIT` 拒绝。

### 2.2 R-Z10: 全量公开 Controller HTTP 映射与权威事实服务深度核验
- **动态扫描后端全量 Controller (52 个文件，183 个端点)**：
  - 弃用简单的 4 个特定文件存在性检查，实现动态递归扫描器 `extractBackendControllerEndpoints(backendJavaDir)`，解析 `backend/src/main/java` 下全部 52 个 `*Controller.java` 类的 `@RequestMapping` 及各方法级 `@GetMapping`/`@PostMapping`/`@PutMapping`/`@DeleteMapping`/`@PatchMapping` 注解，提取全部 183 个真实公开 HTTP 操作；
- **Controller 审计表强约束**：
  - 覆盖表中的 `backend_controller_audit` 必须非空且必须逐项核对：每个控制器的源码文件必须存在于真实 Controller 集合中，每个声明的 `endpoints` 必须存在于 183 个实际 HTTP 映射中；
  - 删空 Controller 审核直接抛出 `ERR_EMPTY_CONTROLLER_AUDIT` 拒绝；注入虚构端点（如 `POST /api/imaginary-business-action`）直接抛出 `ERR_INVENTED_CONTROLLER_ENDPOINT` 拒绝；
- **权威事实服务与端点配对核验**：
  - 覆盖表中的 `authoritative_facts_sources` 必须非空：所声明的 `endpoint` 必须存在于真实 183 个 HTTP 操作中，所声明的 `javaService` 必须存在于真实 Java 服务类源码中（动态解析并核验类文件物理存在）；
  - 注入虚构服务（如 `ImaginaryService.makeUpProgress`）因其在后端服务类中物理缺失，被立即拦截抛出 `ERR_INVENTED_AUTHORITATIVE_SERVICE` 拒绝。

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
| **roadmap** | `/roadmap` | `RoadmapView.vue` | 核心学习 | `RoadmapController`, `RoadmapUpgradeController`, **RoadmapDiagnosticController** | `roadmap.current.get`, `roadmap.enroll`, `roadmap.upgrade` | 路线诊断 (`POST/GET /api/roadmaps/current/diagnostic`) 为未注册交互评估；enroll/upgrade 禁用 |
| **roadmap-stage**| `/roadmap/stages/:id` | `StageView.vue` | 核心学习 | `RoadmapController`, **RoadmapStageGraduationController** | `roadmap.stage.get` | 阶段结业 (`POST/GET /api/roadmaps/current/stages/{id}/graduation`) 为未注册综合评估 |
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
| **Manifest Schema** | MiniMax | `/Users/moxiao/IdeaProjects/project-harness-h02-minimax/contracts/agent-capabilities/manifest.schema.json` | `6f131ec69ad03cb1df974bc2931a7f05c4819d45` | `73d6b5a3bcefb413f2598db4ec62a39e2357471da00fd83184c7e13fa01159cb` |
| **Compiled Manifest**| MiniMax | `/Users/moxiao/IdeaProjects/project-harness-h02-minimax/contracts/agent-capabilities/generated/manifest.json` | `6f131ec69ad03cb1df974bc2931a7f05c4819d45` | `f1fe25dfdd90f2b9cb8abd93b7d9eacc7a246c8aa1dd9fa9006df2db4c761d1c` |
| **Metadata YAML** | DeepSeek| `/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/contracts/agent-capabilities/metadata.yaml` | `8ad8ea5336bf7b0aa7635d72f10b88939eb74b7d` | `0c5f714d0c28c9788c31cf4ba45d0c945f2c52d91c0610fa8a1a0a6b34d4741a` |
| **Semantics Fixture**| DeepSeek| `/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/agent-service/tests/fixtures/capability-semantics.json` | `8ad8ea5336bf7b0aa7635d72f10b88939eb74b7d` | `7ecfe214eee06342c9ccb17301a9777ebef0a0e5734099cf1bc2a2a78a542020` |

---

## 5. Codex 独立跨端探针全量实测矩阵 (33/33 PASS)

### 5.1 第四轮新增独立探针实测结果 (6/6 PASS)
针对 `/Users/moxiao/IdeaProjects/project/docs/verification/harness/h02-codex-zcode-round4-extra-probes.mjs` 中定义的 6 项新增探针实测结果：

| 探针编号 | 探针名称 | 注入破坏操作 | 预期行为 | 实测行为 | 退出状态 | 判定 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **0** | `current cross-lane baseline` | 当前最新正本 Manifest 与 Metadata | `accept` | `accept` | `exit: 0` | **PASS** |
| **1** | `nonrepeating invented descriptor hash` | 伪造 64 位非重复哈希 `'0123456789abcdef'.repeat(4)` | `reject` | `reject` | `exit: 1` | **PASS** |
| **2** | `existing unrelated baseline commit` | 注入真实存在但无关的共同基线提交 `16b37d34...` | `reject` | `reject` | `exit: 1` | **PASS** |
| **3** | `missing all controller operations` | 覆盖表中删空 `backend_controller_audit` 列表 | `reject` | `reject` | `exit: 1` | **PASS** |
| **4** | `invented controller endpoint` | Controller 审计注入虚构端点 `POST /api/imaginary-business-action` | `reject` | `reject` | `exit: 1` | **PASS** |
| **5** | `invented coverage authoritative service` | 事实来源注入虚构服务 `ImaginaryService.makeUpProgress` | `reject` | `reject` | `exit: 1` | **PASS** |

### 5.2 第三轮独立探针实测结果 (10/10 PASS)
针对 `/Users/moxiao/IdeaProjects/project/docs/verification/harness/h02-codex-zcode-round3-probes.mjs` 中定义的 10 项探针实测结果：

| 探针编号 | 探针名称 | 注入破坏操作 | 预期行为 | 实测行为 | 退出状态 | 判定 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **0** | `aligned immutable baseline` | 合法正本 Manifest 与 Metadata | `accept` | `accept` | `exit: 0` | **PASS** |
| **1** | `known class nonexistent method` | 工具 0 绑定已知类不存在方法 `AssistantHealthService.imaginaryMethod` | `reject` | `reject` | `exit: 1` | **PASS** |
| **2** | `known handler wrong tool receiver` | 将 `governance.health.get` 的 handler 错配赋予 `artifacts.evaluate` | `reject` | `reject` | `exit: 1` | **PASS** |
| **3** | `duplicate registered audit replacing omitted tool` | 覆盖表工具审计表复制项 0 覆盖项 1 (65去重失败) | `reject` | `reject` | `exit: 1` | **PASS** |
| **4** | `forged descriptor hash` | Manifest 注入伪造的全部为 1 的 `descriptors_hash` (`'1'.repeat(64)`) | `reject` | `reject` | `exit: 1` | **PASS** |
| **5** | `forged source commit` | Manifest 注入伪造的全部为 1 的 `commit` (`'1'.repeat(40)`) | `reject` | `reject` | `exit: 1` | **PASS** |
| **6** | `input below minimum` | 输入参数 `n: 0` 违反 `input_schema` 中 `minimum: 1` 约束 | `reject` | `reject` | `exit: 1` | **PASS** |
| **7** | `input violates oneOf` | 输入参数 `n: 'wrong'` 违反 `input_schema` 中 `oneOf: [integer]` | `reject` | `reject` | `exit: 1` | **PASS** |
| **8** | `input violates uniqueItems` | 输入参数 `n: [1, 1]` 违反 `input_schema` 中 `uniqueItems: true` | `reject` | `reject` | `exit: 1` | **PASS** |
| **9** | `aligned hash duplicate metadata with omitted actual tool` | Metadata 重复项 0 替换项 1 (去重失败)，即便同步重新计算文件哈希 | `reject` | `reject` | `exit: 1` | **PASS** |

### 5.3 第二轮原始独立探针实测结果 (17/17 PASS)
针对 `/Users/moxiao/IdeaProjects/project/docs/verification/harness/h02-codex-zcode-round3-original-probes.mjs` 中定义的 17 项原始探针实测结果：全部 17/17 项探针达到预期（1 项合法通过，16 项坏输入全部被非零退出拦截）。

**全量实测结果**：**33/33 项探针全量通过**，零假阳性，零漏判。

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
  MiniMax Manifest SHA-256: f1fe25dfdd90f2b9cb8abd93b7d9eacc7a246c8aa1dd9fa9006df2db4c761d1c
  MiniMax Schema SHA-256:   73d6b5a3bcefb413f2598db4ec62a39e2357471da00fd83184c7e13fa01159cb
  DeepSeek Metadata SHA-256:0c5f714d0c28c9788c31cf4ba45d0c945f2c52d91c0610fa8a1a0a6b34d4741a
  Coverage Audit SHA-256:   304cae4b162601931f67f2bc29b55239e3ec0e3c799a74936dca88c8868ad5d4
  Fixtures SHA-256:         c5c536696b384a73b672b5ce71b1b1ca8bd086e368b5260eee08d13a3a5af144
[STRUCTURAL] MiniMax Manifest SHA-256 is valid 64-char hex string
[STRUCTURAL] MiniMax Schema SHA-256 is valid 64-char hex string
[STRUCTURAL] DeepSeek Metadata SHA-256 is valid 64-char hex string

--- 3. [PARSING_AND_UPSTREAM_INTEGRITY] Parse Schema and Metadata ---
[CROSS_CONTRACT] Schema file parsed as valid JSON object
[CROSS_CONTRACT] Metadata parsed as valid YAML with tools array
[CROSS_CONTRACT] Metadata tools array contains all 65 unique registered tools without duplicates or omissions

--- 4. [COVERAGE_INTEGRITY] Validate Coverage Against Real Router & Controllers ---
[STRUCTURAL] Business coverage encompasses all 31 named routes (found: 31)
[STRUCTURAL] Business coverage audits all 65 registered backend tools (found: 65)
[STRUCTURAL] router.ts exists at /Users/moxiao/IdeaProjects/project-harness-h02-zcode/web/src/app/router.ts
[STRUCTURAL] Extracted 31 named routes from router.ts (found: 31)
[STRUCTURAL] All 31 routes in coverage correspond strictly to real router.ts definitions
[STRUCTURAL] Audit table in coverage contains all 65 unique registered tools without duplicates or omissions
[STRUCTURAL] backend java source dir exists at /Users/moxiao/IdeaProjects/project-harness-h02-zcode/backend/src/main/java
[STRUCTURAL] Extracted real controllers from backend sources (found: 52 controllers, 183 endpoints)
[STRUCTURAL] All controller audit entries correspond to real Controller source files and actual HTTP endpoints
[STRUCTURAL] All authoritative fact sources correspond to real Java services and real Controller endpoints

--- 5. [MANIFEST_INTEGRITY] Validating Actual Input Manifest ---
[CROSS_CONTRACT] Manifest metadata source hash strictly matches current metadata file SHA-256
[CROSS_CONTRACT] Manifest source commit exists and contains descriptors source artifact
[CROSS_CONTRACT] Manifest descriptors_hash matches real content hash (90fa195637ee37c9958d2ccc6d6ab27b6a1dacb22cd8f43c89d014f74502ce9f)
[CROSS_CONTRACT] Exact 65 Java handler bindings loaded for receiver/method pairing
[CROSS_CONTRACT] Actual input Manifest strictly conforms to Draft 2020-12 manifest.schema.json
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
   All H02 Capability Consumer Checks PASSED! (29/29 checks, 0 failures)
===============================================================
```

### 6.2 验证命令 2：前端 Vitest 能力与基线专项测试
执行命令：
```bash
npm --prefix web test -- tests/harness-capabilities/ tests/harness-baseline/ --run
```
实测输出：
```text
 ✓ tests/harness-capabilities/capability-consumer.spec.ts (22 tests) 46ms
 ✓ tests/harness-baseline/frontend-baseline.spec.ts (15 tests) 241ms

 Test Files  2 passed (2)
      Tests  37 passed (37)
   Duration  2.21s
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
   Duration  3.12s

> studypilot-web@0.1.0 typecheck
> vue-tsc --noEmit
# 退出码 0，零错误零警告
```

---

## 7. 本地提交与所有权清单 (Round 4)

### 7.1 本地提交文件清单（严格限定所有权范围）
- `docs/verification/harness/h02-business-coverage.json`：全量审计 31 个路由、52 个 Controller 183 项公开操作映射与 7 个权威事实服务端点强校验
- `scripts/harness/capability-consumer-verify.mjs`：支持描述符真实字节溯源哈希与提交工件校验、Controller 全量端点扫描、真实服务类匹配与 33 项全量独立探针拦截的消费验证引擎
- `scripts/harness/capability-consumer-fixtures.json`：包含真实处理类绑定的正例与 9 项负例边界测试用例
- `web/tests/harness-capabilities/capability-consumer-fixtures.fixture.json`：前端 Vitest 消费用独立副本
- `web/tests/harness-capabilities/capability-validator.ts`：前端消费侧纯逻辑校验引擎（支持结构封闭性、输出实例类型、真实服务精确绑定白名单与确认模式有效性校验）
- `web/tests/harness-capabilities/capability-consumer.spec.ts`：22 项前端行为、负例与 Controller 审计测试套件
- `docs/verification/harness/h02-zcode.md`：本专属 H02 Round 4 技术验证证据报告

### 7.2 限制与未覆盖项声明
1. **未实现 UI 与生产改动**：H02 不包含新悬浮球生产组件开发，未修改 `web/src/**` 生产业务组件，未修改前端路由；
2. **未修改公共 Schema 或元数据**：`contracts/agent-capabilities/**` 归 MiniMax 与 DeepSeek 分管，ZCode 仅做只读跨端消费验证；
3. **未越权开放写操作或代码执行**：21 个写工具与所有开发/Runner 工具严格标记为 `disabled`；
4. **未做真实模型调用**：全部测试均为纯离线测试，零付费模型消耗；
5. **快照工件隔离**：`backend/mvnw.cmd` CRLF 差异保持未暂存状态；
6. **不进入 H03**：已在验收停点停止，等待 Codex 独立第四轮验收。
