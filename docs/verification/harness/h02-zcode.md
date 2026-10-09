# H02 验证证据：前端业务能力覆盖、跨端消费与真实性防线 (ZCode) — Round 5

- **执行 Agent**：ZCode
- **驱动模型标签**：`f535ffb7-ab30-473f-bf6a-477b0323d8a8/gemini-3.8-flash-high`（真实 Provider Model ID：未知）
- **测试等级**：`[OFFLINE_BASELINE]` / `[STRUCTURAL_AUDIT]` / `[BEHAVIORAL_NEGATIVE_TESTS]` / `[CROSS_CONTRACT_VALIDATION]`
- **执行时间**：2026-10-09 (Asia/Shanghai)
- **工作树路径**：`/Users/moxiao/IdeaProjects/project-harness-h02-zcode`
- **关联分支**：`codex/harness-h02-zcode`
- **共同基线 HEAD**：`16b37d34c882a17e7bc45c69c84411f28f52bff8`
- **审查结论整改**：`CHANGES_REQUESTED`（五轮整改闭环 R-Z9 描述符与声明提交精确字节绑定无硬编码回退，R-Z10 33 个公开 Controller 全部 130 个端点双向完整性、Controller 端点精确配对与权威事实真实服务方法核验）
- **所有权边界**：独占 `docs/verification/harness/h02-zcode.md`、`docs/verification/harness/h02-business-coverage.json`、`scripts/harness/capability-consumer*`、`web/tests/harness-capabilities/**`；未实现 UI、未修改生产路由或生产 Web 代码，未触碰公共 Schema/metadata/编译器，未合并 `main`，未启动 Task H03。
- **交付状态**：**READY_FOR_CODEX ROUND5**（等待 Codex 第五轮独立技术验收）

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

## 2. 第五轮验收意见 (R-Z9 / R-Z10) 深度整改闭环

### 2.1 R-Z9: 声明提交与描述符真实字节精确绑定（彻底移除硬编码候选回退）
- **严格绑定声明提交**：
  - 移除了所有 `HEAD`、`da3bae15`、`4cc21769` 等硬编码候选 commit 回退循环；
  - 校验器严格且仅从所声明的 `manifest.sources.commit` 中通过 Git 读取描述符字节：`git show ${sourceCommit}:contracts/agent-capabilities/generated/descriptors.json`；
  - 计算其真实 SHA-256 并与 `manifest.sources.descriptors_hash` 强行比对；
  - 任何篡改所声明提交为旧提交的操作（如篡改为 `da3bae15`，其描述符 SHA-256 为 `0e7cf625...`，而当前清单声明哈希为 `90fa1956...`），即使该旧提交真实存在且包含描述符文件，也因哈希不一致被直接判定为 `ERR_DESCRIPTORS_HASH_MISMATCH` 退出。

### 2.2 R-Z10: 33 个公开 Controller 130 个操作全量逐项清单与双向完整性核对
- **全量公开 Controller 逐项分类清单**：
  - 在 `h02-business-coverage.json` 中将 `backend_controller_audit` 从此前的 4 项补充为涵盖全部 33 个公开 Controller 及其 130 个公开端点的完整清单；
  - 对每个公开 Controller 逐项分类（已登记只读/写工具、禁用开发/Runner 工具、用户专属考核/凭据行为、网关门面、未注册里程碑业务操作）并详细说明原因；
- **双向集合完整性核对**：
  - 校验器动态扫描 `backend/src/main/java` 中全部 52 个 Controller 类，提取出 33 个公开业务 Controller 集合；
  - 强制核验 `backend_controller_audit` 必须包含全部 33 个公开 Controller，拒绝任何遗漏或去重失败（如切片删至 1 项直接抛出 `ERR_MISSING_CONTROLLER_AUDIT` 退出）；
- **Controller 与端点精确真实配对**：
  - 校验器为每个 Controller 建立端点映射集合，严格核查审计条目中的每一个端点是否真实声明在该 Controller 自身中；
  - 即使端点在全局存在（如 `GET /api/mastery` 真实存在于 `MasteryController`），若错配给其他 Controller（如 `WebSearchResultController`），立即抛出 `ERR_CONTROLLER_ENDPOINT_MISMATCH` 退出。

### 2.3 R-Z10: 权威事实真实服务方法物理存在性及端点配对核验
- **服务类与具体方法物理存在性核查**：
  - 解析 `authoritative_facts_sources` 中声明的 `javaService`（格式 `ClassName.methodName`）；
  - 动态定位 `backend/src/main/java` 下对应的 Java 源码文件，并通过正则检验该服务类中真实声明了该方法（`\bmethodName\s*\(`）；
  - 任何虚构方法（如 `RoadmapQueryService.noSuchFactMethod`）或虚构服务（如 `ImaginaryService.makeUpProgress`），因方法或类物理缺失，被立即拦截抛出 `ERR_NONEXISTENT_SERVICE_METHOD` / `ERR_INVENTED_AUTHORITATIVE_SERVICE` 退出；
- **权威端点一致性**：
  - 修正了此前审计表中的简写端点，统一对齐 Spring Controller 的真实路由前缀（`GET /api/roadmaps/current`, `GET /internal/users/{ownerId}/learning-context`, `GET /api/roadmaps/current/schedule`, `GET /api/learning-tasks`），并严格核验证实其真实存在。

---

## 3. 业务能力全量覆盖审计 (Business Coverage Inventory)

### 3.1 前端 31 路由与 33 个公开 Controller 覆盖映射表

前端 31 个具名路由与后端 33 个公开业务 Controller、130 个 HTTP 操作建立清晰双向映射，并在 `h02-business-coverage.json` 中完整入账：
- **认证域**：`AuthenticationController`（4 操作，登录/注册/登出/用户信息，严格用户专属 `AUTH_LOGIN` / `AUTH_REGISTER`）；
- **主门户**：`DashboardController`（1 操作）、`AssistantHealthController`（1 操作）、`UnifiedAssistantFacadeController`（8 操作）、`AgentFacadeController`（18 操作，规划/任务/问答网关门面）；
- **路线核心**：`RoadmapController`（6 操作）、`RoadmapStageGraduationController`（2 操作，阶段结业综合评估）、`RoadmapDiagnosticController`（2 操作，初始路线诊断）、`RoadmapLearningLoopController`（5 操作，打卡总结专属 `CHECKIN_SUMMARY_SUBMIT`）、`RoadmapScheduleController`（2 操作）、`RoadmapUpgradeController`（2 操作）；
- **学习管理**：`LearningGoalController`（3 操作）、`LearningPlanController`（5 操作）、`LearningTaskController`（3 操作）；
- **资料库**：`MaterialController`（6 操作）、`WebSearchResultController`（1 操作）；
- **考核评估**：`QuizController`（2 操作，答题作答专属 `QUIZ_SUBMISSION`）、`QuizAttemptController`（2 操作）、`WrongQuestionController`（2 操作）、`WrongQuestionReviewController`（2 操作）、`MasteryController`（1 操作）；
- **实战工作区**：`ProjectWorkspaceController`（2 操作）、`RoadmapArtifactController`（8 操作，成果验收专属 `ACCEPT_ARTIFACT_SUBMISSION`）、`WorkspaceDeveloperController`（10 操作，本地自动化禁用）、`RunnerController`（5 操作，Runner 禁用）；
- **治理与设置**：`AuditLogController`（1 操作）、`AgentExecutionController`（2 操作）、`AgentGrantController`（2 操作，提权审批专属 `GOVERNANCE_GRANT_APPROVAL`）、`AssistantAutomationController`（7 操作）、`AiCredentialController`（5 操作，凭据录入专属 `AI_CREDENTIAL_CONFIG`）、`UserSettingsController`（2 操作）；
- **历史课程**：`CourseController`（6 操作，未注册 Agent 工具的历史兼容业务）。

### 3.2 65 个工具暴露状态分布与治理归因
- **Allowed (28 个)**：全部副作用均为 READ 或 NAVIGATE（`mutates_business_data: false`）；
- **Disabled (33 个)**：21 个写入工具严格冻结至 H11，12 个本地代码与 Runner 自动化工具（`developer.*` 与 `runner.*`）默认禁用；
- **Pending (4 个)**：如实记录 `governance.health.get`（输出字段未声明）、`schedule.today.get`（边界缺陷）、`assessment.wrong_questions.list`（类型不匹配）与 `artifacts.evaluate`（抛出异常未接入模型）4 项缺陷工具。

---

## 4. 显式跨端契约消费验证与哈希溯源

### 4.1 输入工件与当前真实 HEAD

| 输入工件 | 交付端 | 绝对路径 | 当前 HEAD Commit | SHA-256 指纹 |
| :--- | :--- | :--- | :--- | :--- |
| **Manifest Schema** | MiniMax | `/Users/moxiao/IdeaProjects/project-harness-h02-minimax/contracts/agent-capabilities/manifest.schema.json` | `6f131ec6ca1859031478ad659e5e1fb5d325d1eb` | `73d6b5a3bcefb413f2598db4ec62a39e2357471da00fd83184c7e13fa01159cb` |
| **Compiled Manifest**| MiniMax | `/Users/moxiao/IdeaProjects/project-harness-h02-minimax/contracts/agent-capabilities/generated/manifest.json` | `6f131ec6ca1859031478ad659e5e1fb5d325d1eb` | `f1fe25dfdd90f2b9cb8abd93b7d9eacc7a246c8aa1dd9fa9006df2db4c761d1c` |
| **Metadata YAML** | DeepSeek| `/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/contracts/agent-capabilities/metadata.yaml` | `82ec83b0f94a09448b68b5b45c67db59ad7bc9d0` | `0c5f714d0c28c9788c31cf4ba45d0c945f2c52d91c0610fa8a1a0a6b34d4741a` |
| **Semantics Fixture**| DeepSeek| `/Users/moxiao/IdeaProjects/project-harness-h02-deepseek/agent-service/tests/fixtures/capability-semantics.json` | `82ec83b0f94a09448b68b5b45c67db59ad7bc9d0` | `06010a9bfb84f7f848e092816086b39eef3dba7d19add7e388cf7eed34d55a61` |

---

## 5. Codex 独立跨端探针全量实测矩阵 (全量通过)

### 5.1 第五轮 Recheck 10 项探针实测结果 (10/10 PASS)
直接复跑 `/Users/moxiao/IdeaProjects/project/docs/verification/harness/h02-codex-zcode-round5-recheck.mjs` 中定义的 10 项探针：

| 探针编号 | 探针名称 | 注入破坏操作 | 预期行为 | 实测行为 | 退出状态 | 判定 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **0** | `current cross-lane baseline` | 当前最新三端正本输入 | `accept` | `accept` | `exit: 0` | **PASS** |
| **1** | `nonrepeating invented descriptor hash` | 伪造 64 位非重复哈希 `'0123456789abcdef'.repeat(4)` | `reject` | `reject` | `exit: 1` | **PASS** |
| **2** | `existing unrelated baseline commit` | 注入存在但无关的共同基线提交 `16b37d34...` | `reject` | `reject` | `exit: 1` | **PASS** |
| **3** | `missing all controller operations` | 覆盖表中删空 `backend_controller_audit` 列表 | `reject` | `reject` | `exit: 1` | **PASS** |
| **4** | `invented controller endpoint` | Controller 审计注入虚构端点 `POST /api/imaginary-business-action` | `reject` | `reject` | `exit: 1` | **PASS** |
| **5** | `invented coverage authoritative service` | 事实来源注入虚构服务 `ImaginaryService.makeUpProgress` | `reject` | `reject` | `exit: 1` | **PASS** |
| **6** | `omit three real audited controllers` | 审计表切片删至 1 项（遗漏 32 个公开控制器） | `reject` | `reject` | `exit: 1` | **PASS** |
| **7** | `existing class with nonexistent fact method` | 真实服务注入虚构方法 `RoadmapQueryService.noSuchFactMethod` | `reject` | `reject` | `exit: 1` | **PASS** |
| **8** | `real endpoint paired to wrong controller` | 真实端点 `GET /api/mastery` 错配给 `WebSearchResultController` | `reject` | `reject` | `exit: 1` | **PASS** |
| **9** | `older commit containing different descriptors` | 注入旧提交 `da3bae15...`（其描述符哈希与清单声明不符） | `reject` | `reject` | `exit: 1` | **PASS** |

### 5.2 历史所有变异探针回归实测结果
对第四轮、第三轮及第二轮定义的全部 27 项负例变异进行回归实测：全部 27/27 项变异坏输入均被非零退出拦截，零假阳性，零漏判。

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
  Coverage Audit SHA-256:   ab5df0cdf173ece18b1e55950cb779a0ed7a3a9b12b469c117a61d3df5e4acf2
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
[STRUCTURAL] All controller audit entries correspond to real Controller source files, exact endpoint pairing, and bidirectional completeness
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
   All H02 Capability Consumer Checks PASSED! (32/32 checks, 0 failures)
===============================================================
```

### 6.2 验证命令 2：前端 Vitest 能力与基线专项测试
执行命令：
```bash
npm --prefix web test -- tests/harness-capabilities/ tests/harness-baseline/ --run
```
实测输出：
```text
 ✓ tests/harness-capabilities/capability-consumer.spec.ts (27 tests) 38ms
 ✓ tests/harness-baseline/frontend-baseline.spec.ts (15 tests) 231ms

 Test Files  2 passed (2)
      Tests  42 passed (42)
   Duration  2.00s
```

### 6.3 验证命令 3：前端全量回归测试与 TypeScript 检查
执行命令：
```bash
npm --prefix web test -- --run && npm --prefix web run typecheck
```
实测输出：
```text
 Test Files  37 passed (37)
      Tests  370 passed (370)
   Duration  3.70s

> studypilot-web@0.1.0 typecheck
> vue-tsc --noEmit
# 退出码 0，零错误零警告
```

---

## 7. 本地提交与所有权清单 (Round 5)

### 7.1 本地提交文件清单（严格限定所有权范围）
- `docs/verification/harness/h02-business-coverage.json`：全量审计 31 个路由、33 个公开 Controller 130 项公开操作映射与 7 个权威事实服务真实方法强校验
- `scripts/harness/capability-consumer-verify.mjs`：支持声明提交与描述符真实字节精确绑定（无候选回退）、Controller 全量 33 类端点双向完整性与精确配对校验、服务类真实方法物理存在性检验及全量独立探针拦截的消费验证引擎
- `scripts/harness/capability-consumer-fixtures.json`：包含真实处理类绑定的正例与 9 项负例边界测试用例
- `web/tests/harness-capabilities/capability-consumer-fixtures.fixture.json`：前端 Vitest 消费用独立副本
- `web/tests/harness-capabilities/capability-validator.ts`：前端消费侧纯逻辑校验引擎（支持结构封闭性、输出实例类型、真实服务精确绑定白名单与确认模式有效性校验）
- `web/tests/harness-capabilities/capability-consumer.spec.ts`：27 项前端行为、负例与 Controller 审计测试套件
- `docs/verification/harness/h02-zcode.md`：本专属 H02 Round 5 技术验证证据报告

### 7.2 限制与未覆盖项声明
1. **未实现 UI 与生产改动**：H02 不包含新悬浮球生产组件开发，未修改 `web/src/**` 生产业务组件，未修改前端路由；
2. **未修改公共 Schema 或元数据**：`contracts/agent-capabilities/**` 归 MiniMax 与 DeepSeek 分管，ZCode 仅做只读跨端消费验证；
3. **未越权开放写操作或代码执行**：21 个写工具与所有开发/Runner 工具严格标记为 `disabled`；
4. **未做真实模型调用**：全部测试均为纯离线测试，零付费模型消耗；
5. **快照工件隔离**：`backend/mvnw.cmd` CRLF 差异保持未暂存状态；
6. **不进入 H03**：已在验收停点停止，等待 Codex 独立第五轮验收。
