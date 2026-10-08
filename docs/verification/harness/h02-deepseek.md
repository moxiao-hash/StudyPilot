# H02 个人证据报告：业务语义元数据与语义正反例

日期：2026-10-08
执行端：本机 DeepSeek Harness（H02 分包：业务语义元数据及语义正反例）
Owner 文件：`contracts/agent-capabilities/metadata.yaml`、`agent-service/tests/fixtures/capability-semantics.json`、`scripts/harness/capability-semantics*`、本文档

---

## 0. 回执（ACKNOWLEDGED）

| 项 | 实测值 |
| --- | --- |
| 实际 cwd | `/Users/moxiao/IdeaProjects/project-harness-h02-deepseek`（每步文件操作均显式在此树内） |
| 分支 | `codex/harness-h02-deepseek` |
| HEAD | `16b37d34c882a17e7bc45c69c84411f28f52bff8`（与任务书基线一致） |
| 进入时脏状态 | `M backend/mvnw.cmd`（已知 CRLF 快照工件；本端不修改/不暂存/不提交） |
| 上游与冻结 | 父快照 `f7311079a83b84c5e7f3a9076ce4efccb3044c86`；H01 通过 HEAD：minimax `14f6529c…`、zcode `9d6061a1…`、deepseek `70ab2760…`；H01 Runtime 契约冻结 sha256 `df5950c9f9b482b4bea8a21c67e7cad4c5098bd342ce11139199ec9cc6bc5923`（**未修改**） |
| provenance 文件 | 任务书指向的 `docs/verification/harness/h02-baseline-provenance.json` **不在本工作树内**（本树只有 `h01-baseline-provenance.json`）；该文件位于 Codex 维护的 `/Users/moxiao/IdeaProjects/project/docs/verification/harness/h02-baseline-provenance.json`，本端按 shared「共享文档以 project 绝对路径最新版本为准」读取，内容与本端 HEAD/父子提交一致 |
| 状态 | **READY_FOR_CODEX**（见第 12 节） |

未做：push / merge / deploy / 改模型或密钥 / 重启服务 / 真实业务 / 付费评测 / 修改 H01 Runtime 契约 / 修改共享文档或 Obsidian / 写入 MiniMax 树。

---

## 1. 交付物

| 文件 | 说明 |
| --- | --- |
| `contracts/agent-capabilities/metadata.yaml` | 以真实 Java wire name 为键的**语义**元数据（用途/边界/错误契约/成本提示/暴露/确认/权威事实/示例/来源出处）。不重复 Java 事实、不重复 schema。 |
| `agent-service/tests/fixtures/capability-semantics.json` | 人工正反例 fixture + 冻结的 Java 来源事实（含源码摘要）。 |
| `scripts/harness/capability-semantics-extract.mjs` | **只读** Java 来源提取器：工具名/类别/effect/风险/scope/幂等/超时/入参/输出字段/治理规则/路由表。 |
| `scripts/harness/capability-semantics.mjs` | 语义校验器（含受限 YAML 子集加载器）+ 26 条反例执行 + `--check` 漂移检测。 |
| `scripts/harness/capability-semantics.test.mjs` | 离线测试：YAML 子集、提取器事实、策略、示例校验、反例。 |
| `docs/verification/harness/h02-deepseek.md` | 本文档。 |

元数据规模：`metadata.yaml` 2719 行、覆盖 65 个真实 wire name（`contracts/agent-capabilities/metadata.yaml`）。

未编写：公共 Schema、编译器、生成 Manifest、业务源码（`backend/**`、`web/**`、`ai-service/**`）、`contracts/agent-runtime/**`。

---

## 2. 来源真值与盘点口径

**权威来源是运行期注册表，不是文档。** `AgentToolRegistry` 以 Spring 注入的 `List<AgentToolHandler>` 建立 `TreeMap` 索引（`backend/src/main/java/com/moxiao/studypilot/agent/tool/AgentToolRegistry.java:35-42`），`catalog()` 返回按名排序的描述符（`:49-51`），重名即抛 `IllegalStateException("工具名称重复")`（`:38-40`）。因此：

- 名称、版本、类别、effect、风险、scope、幂等、超时、输入/输出 schema 的**唯一事实来源**是 `AgentToolDescriptor` 与 `AgentToolOutputSchemas`；
- 现有 `AgentToolCoverageTest` 已断言目录为 **65 个工具**（43 READ + 21 WRITE + 1 导航），并要求每个工具都有登记的闭合输出契约（`backend/src/test/java/com/moxiao/studypilot/agent/tool/AgentToolCoverageTest.java`）。

本端用只读静态提取交叉核对（`capability-semantics-extract.mjs`），实测：

| 项 | 实测 |
| --- | --- |
| 工具总数 | **65** = 43 READ + 21 WRITE + 1 NAVIGATE |
| `LOCAL` effect | **0 个工具使用**（枚举存在，仅注册表治理分支引用 `AgentToolRegistry.java:61-62`） |
| 输出契约登记 | 65/65，无缺失 |
| 只读工具 | effect READ、风险 NONE、无 scope、不要求幂等、超时 15000ms |
| 写工具 | effect WRITE、要求幂等、声明 scope、超时 120000ms |
| 顶层可空输出 | 仅 `roadmap.current.get`（`type: ["object","null"]`，`AgentToolOutputSchemas.java:370`） |
| scope 覆盖 | 使用 13 个 `AgentScope`，未使用 `LARGE_PLAN_ADJUSTMENT` |
| 导航白名单 | 28 个 routeKey（`NavigationToolHandler.java:12-41`） |
| 入参约束 | 所有入参 schema `additionalProperties:false`；`ownerId` 出现在参数中被硬拒（`AgentToolRegistry.java:106-108`） |

> **口径声明**：静态提取只能证明"冻结的元数据仍与其声称的来源一致"，**不能**证明注册完整性；注册完整性由 MiniMax 从真实描述符导出证明。本端提取器在报告与自身输出中均标注该边界。

### 2.1 治理与确认规则（取自真实代码，不是猜风险等级）

`AgentGovernanceService.createNewExecution`（`agent/application/AgentGovernanceService.java:128-140`）：

```
granted = 存在该 owner 的有效授权且 scope 集合包含 requiredScope
if riskLevel == HIGH        -> WAITING_CONFIRMATION   （必须专用确认）
else if !granted            -> WAITING_AUTHORIZATION  （需先取得该 scope 授权）
else                        -> PENDING                （立即执行）
```

授权有效性：`AgentGrantEntity.includes` = `isActiveAt(now) && scopes.contains(scope)`（`agent/infrastructure/AgentGrantEntity.java:61-67`，未撤销且未过期）。

写工具侧（`agent/tool/AgentToolActionService.java`）：

| 项 | 实测 |
| --- | --- |
| 确认有效期 | `CONFIRMATION_TTL = 15 分钟`（`:37`，`expiresAt` 于 `:153`） |
| 执行租约 | `LEASE_DURATION = 5 分钟`（`:39`）；业务成功与状态写入同事务，租约丢失则**回滚业务事务**避免重复副作用（`:248-258`） |
| 幂等 | 同 owner 同幂等键复用既有动作；若工具名或参数不同则抛 `ConflictException("幂等键已被其他 Agent 工具操作使用")`（`:125-133`） |
| 重复确认 | 已 `SUCCEEDED`/`FAILED`/`RUNNING` 时直接回读，不重复执行（`:171-175`） |
| 过期确认 | `ConflictException("Agent 工具操作确认已过期，请重新发起")`（`:180-182`） |
| 确认/拒绝入口 | `POST /internal/agent-tool-actions/{actionId}/confirm|reject`（`agent/api/InternalAgentToolActionController.java`） |
| 超时护栏 | 读工具超时确定性失败并抛 `AgentToolTimeoutException`；写工具超时先等待事务收束，**绝不在事务仍可能提交时报告终态失败**（`agent/tool/AgentToolTimeoutGuard.java:22-34`） |

因此元数据中的 `confirmation` 由**风险等级 + 授权规则**共同决定：11 个 HIGH 写工具为 `always_user_confirmation`，10 个 LOW 写工具为 `conditional_scope_grant`，其余为 `none`。**不得**用风险等级猜全部确认条件（LOW 工具在无授权时同样会停在 `WAITING_AUTHORIZATION`）。

### 2.2 暴露（exposure）边界

`catalog()` 目前**无过滤**地返回全部 65 个工具（`InternalAgentToolController.java:26-29`）；仓库中不存在按工具开关运行的配置属性。因此 exposure 是**Manifest 层的治理判定**，按 H02 shared 边界给出：

| 规则 | 适用 | state | 依据 |
| --- | --- | --- | --- |
| `writes_disabled_until_h11` | 21 个 WRITE | `disabled` | shared：写操作仍禁用至 H11；目录登记不等于当前开通 |
| `coding_runner_local_disabled` | RUNNER + DEVELOPER 共 12 个 READ + 3 个 WRITE | `disabled` | shared：coding / runner / 本地自动化默认禁用 |
| `navigation_readonly` | `navigation.resolve` | `allowed` | 只解析白名单 route 与安全标识参数 |
| `read_only_business` | 31 个业务 READ | `allowed` | 只读查询，owner 由 Java 注入；**但下面 4 个有缺陷的除外** |

`allowed` 只表示"满足后续权限与实现条件时可进入候选目录"，**不等于当前开通运行**。

---

## 3. 已核实基线缺陷（本端独立复现，非转述）

以下 4 项由本端直接读真实 handler 与校验代码确认。它们不是"元数据写错"，而是**已注册工具当前无法满足其声明契约**，因此不满足 `allowed` 所需的"实现条件"，按 `pending` 暴露并写明真实原因。

### D1 `schedule.today.get` — 恒定失败，且非纯只读

- `AgentReadToolConfiguration.java:123-128` 以 `service.getOrCreate(context.ownerId(), LocalDate.parse(text(arguments,"date")), date)` 调用，即 **start == end**。
- `RoadmapScheduleService.validateWindow`（`:317-320`）要求 `end.equals(start.plusDays(6))`，否则抛 `IllegalArgumentException("路线日程必须是包含首尾日期的连续七天")`。
- 故该工具经注册表调用**必然失败**；且 `getOrCreate` 为 `@Transactional`，成功路径会惰性创建/刷新排期行（`:84` 调 `refresh`），与 `effect=READ` 的"无副作用"描述不符。
- 影响：矩阵 §2 把它列为 `dashboard`/`today` 的读取工具。

### D2 `assessment.wrong_questions.list` — 输出契约类型不符

- `AgentToolOutputSchemas.java:379` 登记为 `array(WRONG_QUESTION)`；
- `WrongQuestionService.list`（`:143`）返回 `WrongQuestionPageResponse{items,totalElements,page,size}`（record 定义 `assessment/api/WrongQuestionPageResponse.java:5-10`）；
- `AgentToolRegistry.invoke`（`:82`）在调用边界强校验输出 → 期望数组、实际对象，**必然失败**。
- 现有 `AgentToolCapabilityBehaviorTest` 只覆盖了 `wrong_questions.summary`，未覆盖本工具（故测试未暴露）。

### D3 `governance.health.get` — 输出字段超出闭合契约

- `AgentToolOutputSchemas.java:132-137` 登记 `HEALTH` 共 12 个字段且闭合；
- `AssistantHealthService.summarize`（`agent/application/AssistantHealthService.java:47`）返回 `AssistantHealthResponse`，含 `modelCalls`、`failedModelCalls`、`modelFailureRate`、`modelPromptTokens`、`modelCachedPromptTokens`、`modelUncachedPromptTokens`、`modelCompletionTokens`、`modelReasoningTokens`、`modelTotalTokens`、`unknownPriceCalls`、`usageEstimatedCost`、`currency`、`priceStatus`、`priceVersion` 等约 29 个组件；
- `AgentToolOutputValidator`（`:83-89`）在 `additionalProperties:false` 下抛"存在未声明的输出字段" → **必然失败**。

### D4 `artifacts.evaluate` — 恒定抛冲突，Agent 路径未接入

- `RoadmapArtifactService.evaluate`（`:278-283`）在属主校验后**无条件**抛 `ConflictException("真实 DeepSeek Rubric 评审尚未接入，不能根据用户填写的测试文字生成验收分数")`；
- 真实 AI Rubric 评审在 REST 侧 `ArtifactReviewService`，Agent 工具触达不到；
- 故该工具无法返回结果，也不调用模型（`cost_hint.local: true`）。

> 这三类缺陷（D1/D2/D3）恰好说明 shared §5 的告警是对的：**能力矩阵与静态字符串不能当作 handler 已实现的证明**。修复归 Java Owner；本端只登记事实、证据与暴露状态，未改任何业务代码。

---

## 4. 能力矩阵漂移（文档 vs 代码）

`docs/agent-capability-matrix-v2.md` 与本端从代码提取的事实存在下列不一致。按 shared「矩阵用于独立覆盖核对，不单独视作 handler 已实现的证明」，本端一律以代码为准：

| # | 矩阵声明 | 代码事实 | 位置 |
| --- | --- | --- | --- |
| M1 | §3 标题"全量 **64** 个已注册工具" | **65** | `AgentToolCoverageTest` 断言 65；`AgentToolOutputSchemas` 注释也仍写"43/20" |
| M2 | §3.2"写入与本地执行工具（**20** 个）" | **21**（矩阵漏 `developer.interface_fallback.execute`） | `AgentWriteToolConfiguration.java` 21 个注册 |
| M3 | §3.1 第 29–40 项标注 `EFFECT: LOCAL` | 代码中这些工具是 **READ**；**没有任何工具** effect 为 LOCAL | `AgentReadToolConfiguration.java:310-463`；`AgentToolEffect.java` |
| M4 | §3.2 `learning.goal.create` / `learning.plan.create` 标 HIGH | 代码为 **LOW**（且 §2 表也写 LOW，矩阵自相矛盾） | `AgentWriteToolConfiguration.java:80`、`:102` |
| M5 | §3.2 `runner.check.run` 标"LOW/HIGH"（不确定） | 描述符为 **LOW**；但模板 `PREPARE_DEPENDENCIES` 为 HIGH 且要求确认 | `AgentWriteToolConfiguration.java:306`；`RunnerTemplateType.java:36-42` |
| M6 | §2 路由矩阵 31 个具名路由 | 白名单 routeKey **28** 个（矩阵含 3 个 NONE 路由：login/register/not-found） | `NavigationToolHandler.java:12-41` |

矩阵 §4 的五条学习真实性红线与代码一致，已作为 `when_not_to_use` 的结构性要求写入元数据（见 §6）。

---

## 5. 其他已核实的语义事实

| 事实 | 证据 |
| --- | --- |
| `assessment.quiz.get` **结构性屏蔽答案** | `QuizResponse.QuestionResponse` 字段为 id/type/difficulty/codingKind/language/knowledgePoint/questionText/options/starterCode/sources，**不含** `correctAnswers`/`referenceAnswer`/`explanation`（`assessment/api/QuizResponse.java:33-43`）。元数据必须声明"不得用于获取答案、不得代用户作答" |
| `assessment.attempt.get` 返回答案与解析 | 仅限**已提交**的 attempt（`QuizService.getAttempt` `:471-474` → `toAttemptResponse`），用于复盘而非代答 |
| `assessment.node_quiz.generate` 与 `.retry` **实现完全相同** | 两者都调用 `service.retryQuiz(...)`（`AgentWriteToolConfiguration.java:169`、`:184`）。两个 wire name、一份实现，无行为差异——消费端不应假定二者行为不同 |
| `materials.web.import` 参数名与 DTO 字段名不同 | Agent 入参为 `sourceUrl`，`CreateWebMaterialRequest` 字段为 `url`（`material/api/CreateWebMaterialRequest.java:11`），按位置传递 |
| `settings.ai_status.get` 有出站调用 | `AiCredentialService` 使用 `DefaultCredentialStatusClient`（`aicredential/application/DefaultCredentialStatusClient.java`）；失败降级为 warning。故 `cost_hint.local: false`（无模型费用，但非纯 JVM 内读）。返回仅含脱敏状态，不含明文 |
| Runner 模板风险/确认表 | `MAVEN_TEST`/`MAVEN_COMPILE`/`NPM_TEST`/`PYTEST` 为 LOW 且不要求确认；`PREPARE_DEPENDENCIES` 为 HIGH 且要求确认（`RunnerTemplateType.java:9-42`）；预览契约含 `confirmationRequired` 字段（`AgentToolOutputSchemas.java:295`） |
| 错误词汇表 | `IllegalArgumentException`（参数/未注册工具/未注册路由/缺幂等键）、`ConflictException`（幂等冲突/不可确认/已过期）、`ResourceNotFoundException`（属主不存在或越权）、`IllegalStateException`（写工具未接治理/Runner 失败/缺输出契约）、`AgentToolTimeoutException`（读超时）、`AgentToolActionLeaseLostException`（租约丢失回滚） |
| 输出裁剪信封 | 超过 65536 字节时返回闭合信封 `{warning, originalBytes, truncated}`（`AgentToolRegistry.java:16`、`:88-96`；`AgentToolOutputSchemas.TRUNCATED_OUTPUT_FIELDS`） |
| **部分写工具的成本发生在请求之外** | `assessment.node_quiz.generate`/`.retry` 只登记 `RoadmapQuizGenerationJobEntity`，实际出题由外部 worker 经 `InternalRoadmapQuizJobController.claimQuizJob` 领取执行；`materials.text.import`/`materials.web.import` 只落库，抓取与分片/向量化由后续 worker 执行。故这 4 个工具与 `settings.ai_status.get`（出站 HTTP）标为 `cost_hint.local: false` + `external_dependency`；其余工具只做 JVM 内校验与数据库读写（`local: true`, `external_dependency: null`）。全后端仅两个文件发起出站 HTTP（`AgentGatewayService`、`DefaultCredentialStatusClient`） |

---

## 6. 元数据契约与校验器

### 6.1 文件格式与字段（已明确记录）

`contracts/agent-capabilities/metadata.yaml` 只承载**补充语义**，键为真实 Java wire name：

每项必需字段：`name`、`description`、`when_to_use`、`when_not_to_use`、`error_contract`、`cost_hint{local,external_dependency,notes}`、`exposure{state,reason}`、`confirmation{mode,waiting_status,notes}`、`authoritative_facts[{fact,meaning}]`、`examples[{name,input,expect}]`、`source_provenance{registration,handler,output_schema}`。

`cost_hint` 是**结构化**的，不靠措辞判断：`local: true` 要求 `external_dependency: null`；`local: false` 要求 `external_dependency` 为非空字符串并写明具体依赖。两者必须严格互斥，因此“非本地”声明必须指名依赖，不能靠含糊文案蒙过。早期版本用关键词判定，已被一次真实反例证伪后改为结构判定。

**禁止出现**（会形成第二事实来源）：`effect`、`riskLevel`、`scope`/`requiredScope`、`input_schema`、`output_schema`、`idempotency`、`timeoutMillis`、`version`、`category`；
**任何位置禁止出现**：`ownerId`、`grant(s)`、`authorization`、`permissions`、`secret`、`apiKey`、`token`。

格式为**受限 YAML 子集**（缩进映射、序列、流式 `{}`/`[]`、引号/纯量、注释、`|`/`>` 块标量；不支持锚点、别名、多文档）。JSON 文档同样被接受，因为它是合法 YAML 子集——这一取舍已在 fixture 与报告记录，便于 MiniMax 用现有解析依赖读取。

### 6.2 校验器做了什么（机器可校验部分）

`scripts/harness/capability-semantics.mjs`，**离线、无网络、无模型、无服务**，错误码稳定：

| 错误码 | 含义 |
| --- | --- |
| `E_COVERAGE_MISSING` | 已注册工具没有元数据（**来源遗漏**） |
| `E_COVERAGE_UNKNOWN` | 元数据出现未注册的工具（**未实现工具 / 伪造 wire name**） |
| `E_DUPLICATE_TOOL` | 重复 wire name |
| `E_REQUIRED_FIELD_MISSING` | 必需字段缺失 |
| `E_JAVA_FACT_OVERRIDE` | 元数据重复/覆盖 Java 事实（含手写 schema） |
| `E_AUTHORIZATION_LEAK` | 出现 owner / 授权 / 凭据类字段（**自我扩权**） |
| `E_FABRICATED_FACT` | `authoritative_facts` 的字段不属于该工具的真实输出 schema（**无依据权威指标**） |
| `E_EXAMPLE_SCHEMA` | 示例入参违反真实 Java 入参 schema（缺必填、未声明键、类型错误） |
| `E_OWNER_INJECTION` | 示例中出现 `ownerId` |
| `E_PROVENANCE` | 来源出处指向不存在的文件、越界行号、行号内未提及该 wire name，或 handler 类在源码树中不存在 |
| `E_EXPOSURE_POLICY` | 暴露状态不符合 H02 边界，或把已核实缺陷工具标为可用 |
| `E_CONFIRMATION_POLICY` | 确认模式不符合实际治理规则（含用风险等级猜确认条件、绕过确认） |
| `E_FABRICATED_COMPLETION` | 文案声称"AI 评分通过即完成""PENDING 即成功""无需确认" |
| `E_REDLINE_CREDENTIAL` | 文案允许读取/注入凭据明文 |
| `E_REDLINE_UNSTATED` | 学习真实性红线未在 `when_not_to_use` 中声明 |
| `E_COST_HINT` | `cost_hint.local` 与 `external_dependency` 不一致，或缺成本说明 |
| `E_MISSING_SEMANTICS` | 描述过短，或两个工具的描述/边界完全相同（**套话代替语义**） |

`source_provenance` 被强制为可验证事实：`registration` 必须是 `path#Lstart-Lend`，该范围必须真实存在且**确实包含该 wire name**；`handler` 中出现的每个 Java 类名必须在 `backend/src/main/java` 下真实存在。这使"看起来合理但编造"的出处无法通过。

### 6.3 机器可校验 vs 人工复核的边界

| 类别 | 归属 |
| --- | --- |
| 覆盖完整性、字段合法性、事实来源字段存在性、示例 schema 合规、暴露/确认策略、出处可验证、红线是否**被声明** | **机器可校验**（本校验器） |
| 描述是否准确、`when_not_to_use` 的表述是否足以约束模型、错错误契约是否覆盖真实失败路径、示例是否代表真实用法 | **人工复核**（Codex 与用户） |

红线检查基于关键词**存在性**，只证明"边界被声明"，**不证明**模型因此不会越界；这一点在 fixture 与本文档中均显式标注为结构性证据。

### 6.4 人工正反例与 RED→GREEN

`agent-service/tests/fixtures/capability-semantics.json` 含 4 条正例与 **29 条反例**，每条反例声明 `ops`（对真实元数据的变异）与 `expectErrorCode`。反例覆盖任务书要求的全部检测面：

- 来源遗漏 N01、重复 wire name N02、未实现工具/伪造 wire name N03（`studypilot.quiz.answer`）
- 写操作错误开放 N04、coding/runner 能力错误开放 N05
- 元数据覆盖 Java 事实 N06/N20
- 无依据权威指标 N07/N19
- 非法示例 N08/N10、owner 注入 N09
- 绕过确认 N11、用风险等级猜确认 N18/N12、写工具缺确认声明 N18
- 用户专属行为边界未声明 N13、允许读取凭据明文 N14、自我扩权字段 N15
- 把 AI 评分当成完成 N16、套话代替语义 N17
- 出处造假 N21/N22/N23/N24、已核实缺陷工具被标为可用 N25、缺陷原因不写真实失败条件 N26
- 成本提示无依据 N27/N28、外部依赖声明为空串 N29

---

## 7. 命令与结果

```
$ node scripts/harness/capability-semantics-extract.mjs --summary
tools          65 (READ 43, WRITE 21, NAVIGATE 1, LOCAL 0)
output schemas 65 registered, 0 missing
scopes used    13 of 14; unused: LARGE_PLAN_ADJUSTMENT
governance     HIGH->WAITING_CONFIRMATION, LOW+ungranted->WAITING_AUTHORIZATION, LOW+granted->PENDING
ttl/lease      15min / 5min
nav routes     28
```

```
$ node scripts/harness/capability-semantics.mjs
PASS  65 metadata entries (allowed 28, disabled 33, pending 4)
      confirmations: 11 always, 10 conditional
      274 authoritative facts, 72 examples
      negative fixtures 29/29 rejected with the expected code

$ node scripts/harness/capability-semantics.mjs --check
MATCH  frozen H02 capability facts still match the Java source

$ node --test scripts/harness/capability-semantics.test.mjs
ℹ tests 30   ℹ pass 30   ℹ fail 0
```

**独立第三方解析器核对**（只作一次性独立验证，未把 Python 引入交付链）：

```
$ python3 -c "import yaml; yaml.safe_load(open('contracts/agent-capabilities/metadata.yaml'))"
PyYAML tools: 65 | equal to source: True
```

该独立核对抓到两个真实格式缺陷（本端自有解析器因过宽松而漏过），均已修复并补测试：

1. 序列项 `- key: value` 的后续兄弟键缩进写成 `indent+4` 而非 `indent+2`，严格 YAML 报 `mapping values are not allowed here`；
2. 示例中的日期字符串（如 `2026-10-09`）被当纯量输出，YAML 1.1 会解析为 **date 对象**而非字符串。现改为所有非字母开头的纯量一律加引号，并新增测试断言“每个示例实参解析后的类型必须与其声明的 Java 类型一致”。

这两点是 shared「静态自测不能替代独立核对」的实例：若无外部解析器，缺陷会以“自测通过”的形式留在交付物里。

---

## 8. 限制与未覆盖项

1. **MiniMax 的 `manifest.schema.json` 在本次盘点时尚未交付**：观测时其工作树 `project-harness-h02-minimax` 仍停在基线 `16b37d34…`，`contracts/` 下只有 H01 的 `agent-runtime/`，无 `agent-capabilities/`。按任务书，本端先完成来源盘点与元数据落盘（格式/字段已记录），未写入该树。Schema 到位后只需做字段名映射的对齐复跑，元数据语义不需要重写。
2. **未做跨端实例消费测试**：shared 的吞吐检查点要求在接口就绪后先用最小离线正例连通跨端输入；因上游 Schema 未到，本端无法完成该连通，属显式未覆盖项（非静默跳过）。
3. **静态提取不等于注册证明**：本端提取器用于漂移与覆盖交叉核对；注册完整性由 MiniMax 从真实描述符导出证明。
4. **输出契约逐字段审计未做全量**：本端对"直接返回服务对象"的只读工具做了重点核对，发现并确认 D2/D3 两处类型/字段不符；其余工具未做 65 个的全字段两两比对，属残余风险（ZCode 负责独立覆盖核对）。
5. **未运行任何 Java 测试、未启动后端、未访问数据库**：D1–D4 全部由源码静态推导得出，并给出 file:line；它们应由 Java Owner 用真实测试复现确认。
6. 红线检查是结构性的，不构成行为保证（见 §6.3）。
7. `cost_hint` 不含任何 token/费用数值；未知即写未知，只记录代码中真实存在的边界（如 64 KiB 输出上限、Runner 模板超时秒数）。延迟 worker 侧的真实开销未实测，只按“成本发生在请求之外”如实标注，未做估值。

---

## 9. READY_FOR_CODEX

| 项 | 值 |
| --- | --- |
| 状态 | **READY_FOR_CODEX** |
| cwd | `/Users/moxiao/IdeaProjects/project-harness-h02-deepseek` |
| 分支 | `codex/harness-h02-deepseek` |
| 基线 | `16b37d34c882a17e7bc45c69c84411f28f52bff8` |
| 交付提交 | 见本节末「提交」行 |
| 测试 | fixtures/元数据：65 条全部通过（allowed 28 / disabled 33 / pending 4）；反例 29/29 以预期错误码被拒；`--check` 无漂移；`node --test` 30/30；PyYAML 严格解析与源事实逐字段相等 |
| 元数据统计 | 65 条 = 43 READ + 21 WRITE + 1 NAVIGATE；`always_user_confirmation` 11、`conditional_scope_grant` 10、`none` 44；`authoritative_facts` 274 条；`examples` 72 条；`cost_hint.local:false` 5 条 |
| 证据层级 | mock/offline（无模型、无服务、无数据库） |
| 未覆盖项 | 见第 8 节 |
| 下一步 | 停在 H02，等 Codex 独立验收；**不进入 H03** |

**提交**：仅本端 Owner 文件；`backend/mvnw.cmd` 未修改/未暂存/未提交。
