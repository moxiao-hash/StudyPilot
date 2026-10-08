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
| `agent-service/tests/fixtures/capability-semantics.json` | 人工正反例 fixture + 冻结的 Java 来源事实（含源码摘要）+ 冻结的真实 `input_schema`/`output_schema`（65 工具）与描述符来源哈希/commit。 |
| `scripts/harness/capability-semantics-extract.mjs` | **只读** Java 来源提取器：工具名/类别/effect/风险/scope/幂等/超时/入参/输出字段/治理规则/路由表。 |
| `scripts/harness/capability-semantics-instances.mjs` | **只读** MiniMax 真实描述符的类型化 fixture 生成器（`--descriptors <path>`）：递归生成契约合法合成实例，并报告畸形 schema／子集外关键字／生成失败。 |
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

## 3. 基线契约缺陷 D1–D4（静态源码推导，未运行 Java 行为复现）

**证据层级声明**：以下 4 项是本端**静态阅读真实 handler 与校验代码后推导**的结论，**没有**运行 Java 测试、启动后端、访问数据库或调用模型。因此措辞一律是"按代码路径推导必然走到该异常/校验失败"，而**不是**"实测失败""恒定失败"或"已运行复现"。缺陷判定与 `pending` 处理是保守的；真正的行为复现应由 Java Owner 执行，业务修复另行授权。首轮验收正是要求此处措辞准确，本轮已改正。

以下 4 项不是"元数据写错"，而是**已注册工具按其声明契约当前无法成功**，因此不满足 `allowed` 所需的"实现条件"，按 `pending` 暴露并写明推导依据。

### D1 `schedule.today.get` — 推导必然失败，且非纯只读

- `AgentReadToolConfiguration.java:123-128` 以 `service.getOrCreate(context.ownerId(), LocalDate.parse(text(arguments,"date")), date)` 调用，即 **start == end**。
- `RoadmapScheduleService.validateWindow`（`:317-320`）要求 `end.equals(start.plusDays(6))`，否则抛 `IllegalArgumentException("路线日程必须是包含首尾日期的连续七天")`。
- 故该工具经注册表调用时**按代码路径推导必然抛错**；且 `getOrCreate` 为 `@Transactional`，成功路径会惰性创建/刷新排期行（`:84` 调 `refresh`），与 `effect=READ` 的"无副作用"描述不符。
- 影响：矩阵 §2 把它列为 `dashboard`/`today` 的读取工具。

### D2 `assessment.wrong_questions.list` — 输出契约类型不符

- `AgentToolOutputSchemas.java:379` 登记为 `array(WRONG_QUESTION)`；
- `WrongQuestionService.list`（`:143`）返回 `WrongQuestionPageResponse{items,totalElements,page,size}`（record 定义 `assessment/api/WrongQuestionPageResponse.java:5-10`）；
- `AgentToolRegistry.invoke`（`:82`）在调用边界强校验输出 → 期望数组、实际对象，**按代码路径推导必然在调用边界失败**。
- 现有 `AgentToolCapabilityBehaviorTest` 只覆盖了 `wrong_questions.summary`，未覆盖本工具（故测试未暴露）。

### D3 `governance.health.get` — 输出字段超出闭合契约

- `AgentToolOutputSchemas.java:132-137` 登记 `HEALTH` 共 12 个字段且闭合；
- `AssistantHealthService.summarize`（`agent/application/AssistantHealthService.java:47`）返回 `AssistantHealthResponse`，含 `modelCalls`、`failedModelCalls`、`modelFailureRate`、`modelPromptTokens`、`modelCachedPromptTokens`、`modelUncachedPromptTokens`、`modelCompletionTokens`、`modelReasoningTokens`、`modelTotalTokens`、`unknownPriceCalls`、`usageEstimatedCost`、`currency`、`priceStatus`、`priceVersion` 等约 29 个组件；
- `AgentToolOutputValidator`（`:83-89`）在 `additionalProperties:false` 下抛"存在未声明的输出字段" → **按代码路径推导必然在调用边界失败**。

### D4 `artifacts.evaluate` — 推导必然抛冲突，Agent 路径未接入

- `RoadmapArtifactService.evaluate`（`:278-283`）在属主校验后**无条件**抛 `ConflictException("真实 DeepSeek Rubric 评审尚未接入，不能根据用户填写的测试文字生成验收分数")`；
- 真实 AI Rubric 评审在 REST 侧 `ArtifactReviewService`，Agent 工具触达不到；
- 故按代码路径推导该工具无法返回结果，也不调用模型（`cost_hint.local: true`，静态推导）。

> 这三类缺陷（D1/D2/D3）恰好说明 shared §5 的告警是对的：**能力矩阵与静态字符串不能当作 handler 已实现的证明**。修复归 Java Owner；本端只登记事实、证据与暴露状态，未改任何业务代码。

---

## 3.1 二轮与三轮整改（R-D1 / R-D2 / R-D3）

首轮 Codex 独立内存变异发现 6 个漏项，本轮逐条闭环。整改只动本端 Owner 文件，未改生产 Java、公共 Schema、编译器、他端文件或 H01 冻结契约。

### R-D1 真实执行绑定（从"类是否存在"到"接收者/方法配对"）

`source_provenance.handler` 现在必须满足**执行绑定**校验：

1. 提取器为每个工具抽取其**真实登记上下文**的符号集（包含该工具注册所在 bean 方法的完整方法体）：`boundClasses` / `boundMethods`，并把注入的**类型名**（而非参数变量名）记入 `handlerServices`。
2. handler 中的每一个 `Class.method` 必须要么**出现在本工具的注册上下文中**（真实绑定），要么被显式列进 `source_provenance.unverified_symbols`（更深层协作者）。
3. `unverified_symbols` 也不是免检通道：其类必须在源码树中存在，且该方法名必须真的出现在该类的源文件里。因此**虚构方法无法通过 unverified 列表洗白**。
4. 至少存在一个直接绑定配对，否则拒绝。

该规则当场抓出一处**真实元数据错误**：`developer.interface_fallback.execute` 原先声称的 `InterfaceFallbackPolicy.preview` / `LocalAutomationClient.invoke` 并非该工具的直接绑定，已改为真实绑定 `LocalInterfaceFallbackService.validate` / `.execute`，并把那两个更深的协作者列入 `unverified_symbols`（它们确实存在于源码）。

**三轮补强（接收者配对）**：二轮复验指出，仅用"类集合 ∩ 方法集合"的**笛卡尔组合**判断绑定并不成立——上下文里同时存在 `RoadmapArtifactService` 与 `ownerId` 两个符号，并不意味着前者拥有后者。现改为**接收者/类型配对**：

1. 由 bean 方法签名建立 `变量 → 声明类型` 映射（并纳入注册 helper 的 lambda 参数类型，取自同文件 `BiFunction<AgentToolContext, JsonNode, ...>`）；
2. 在方法体内匹配 `receiver.method(` 调用，把**接收者的声明类型**与**被调用的方法**组成 `Class#method` 配对；
3. 只有配对集合中的项才算绑定。

因此 `service.evaluate(...)` 产生 `RoadmapArtifactService#evaluate`，而**不会**产生 `ObjectMapper#evaluate` 或 `RoadmapArtifactService#ownerId`；后两者被拒。同时 `unverified_symbols` 仍要求类存在且方法真的出现在该类源文件中，无法把不存在的方法改标绕过。导航工具本身即 `AgentToolHandler` 实现，其接口方法 `invoke`/`descriptor` 作为入口绑定列入。

**静态检查的能力边界（明确 UNVERIFIED）**：上述配对是**静态**核对——它能证明"声明的绑定确实出现在该工具注册上下文的接收者/方法调用中"，但**不能**证明运行期一定走到该调用（分支、注解处理、代理、反射等静态不可判定）。因此最终注册证明仍以 MiniMax 从真实描述符导出为准；本端不把静态配对等同于运行期证明。

### R-D2 导航白名单、逐 route 安全参数与递归身份注入

- `routeKey` 必须落在 Java 注册的 28 个白名单路由内，否则 `E_NAVIGATION_ROUTE`。
- `params` 必须**恰好**等于该 route 的必需参数集合（多、少、错位都拒绝），否则 `E_NAVIGATION_PARAMS`。
- 每个参数值必须匹配 Java 的 `SAFE_IDENTIFIER = [A-Za-z0-9][A-Za-z0-9._:-]{0,127}`，否则 `E_NAVIGATION_SAFE_IDENTIFIER`。
- **递归**扫描示例入参的任意深度，拒绝 `ownerId`/授权/凭据字段（`E_OWNER_INJECTION` / `E_AUTHORIZATION_LEAK` / `E_CREDENTIAL_INJECTION`）。Java 注册表只拦顶层 `ownerId`，嵌套伪造身份（如 `params.ownerId`）此前会漏过。

该规则同样当场抓出**本端自己的元数据错误**：导航示例里出现过并不在 Java 白名单中的 `ADMIN_CONSOLE` 路由。

### R-D3 合法输入输出实例、结果必需字段与显式可空语义

示例升级为带**结果语义**的三态结构：

| 字段 | 含义 |
| --- | --- |
| `outcome` | `ok`（输入合法且必须给出结果实例）、`rejected`（输入**故意非法**且必须给出错误）、`unavailable`（输入合法但工具当前无法成功，仅限已冻结缺陷工具） |
| `output` | `ok` 时必填的契约形状实例；`rejected`/`unavailable` 时必须为 null |
| `error` | `rejected`/`unavailable` 时必填，代码 + 真实 Java 错误语义 |
| `fixture_kind` | `synthetic_typed`（契约合法合成实例，来源指向生成器）/ `nullable_empty`（唯一可空契约的显式 null）/ `rejection`（故意非法输入）/ `contract_defect`（无成功路径） |
| `fixture_source` | **必须指向真实存在的仓库文件**（输出契约登记文件或注册配置） |

（**此处为三轮时的状态，已被 §3.3 取代**：当时 `ok` 示例的输出只校验容器类型与顶层字段闭包，`shape_placeholder` 的叶子必须是文档化占位符。四轮起改为按真实 `output_schema` 校验类型化实例，`shape_placeholder` 已完全移除。）校验器强制：`rejected` 示例的输入必须**真的**违反某条规则（否则拒绝"假拒绝"）；`unavailable` 必须对应已冻结的缺陷；已判 `pending` 的工具**不得**存在 `ok` 示例。

**三轮补强（缺失字段 ≠ 显式 null）**：二轮复验指出 `checkExampleOutput` 把 `undefined` 与 `null` 并列放行，于是删掉可空工具全部示例的 `output` 字段仍能通过。现改为：

- `output` 字段必须**显式存在**（own property）；缺失一律拒绝，并明确区分"缺失结果字段"与"显式 null 结果"；
- 显式 `null` 仅允许注册输出为可空的那一个工具（`roadmap.current.get`，`type: ["object","null"]`）；
- 新增 `fixture_kind: nullable_empty`，且强制其只能用于可空输出工具、`output` 必须显式为 `null`、`outcome` 必须为 `ok`；
- `contract_defect` 也必须显式 `null`，不能靠删字段蒙过。

并补上正例：`roadmap.current.get` 增加一个"当前没有路线"的显式 null 空状态示例（`nullable_empty`），与该工具唯一的可空契约对应。

（三轮时的分布：73 个示例 = 67 `ok` + 1 `rejected` + 5 `unavailable`，`fixture_kind` 中 66 个为 `shape_placeholder`。四轮已把这 66 个替换为契约合法的 `synthetic_typed` 实例，当前分布见 §3.3。）

> **（三轮时的 BLOCKED，现已解除）** 当时逐字段类型、嵌套 schema 与 `required` 集合的校验依赖上游 `manifest.schema.json`，而该文件尚未交付，故只实现了离线可验证子集并如实标注为 BLOCKED。四轮上游已交付真实描述符与 Schema（§3.2），本端据此完成类型化实例校验（§3.3）；`cost_hint`/结果语义/溯源仍照旧。

## 3.2 与 MiniMax 上游契约的对齐核对（只读，未写他端）

MiniMax 的 H02 契约草案与生成产物本轮已出现，本端**只读**核对，未写入其工作树：

| 项 | 观测 | 结论 |
| --- | --- | --- |
| 位置 | `project-harness-h02-minimax` @ `da3bae15bbc74978b5cff82ef7b26f357bd50837`；`manifest.schema.json`（sha256 `fcce0b3d…`）、`README.md`、`generated/descriptors.json`（sha256 `0e7cf625…`，65 条真实描述符）、`generated/manifest.json` | 契约与真实描述符产物均已产出；本端只读 |
| 元数据字段约定 | README §2 要求的字段与本端 `metadata.yaml` **一致**：`cost_hint{local,external_dependency,notes}`、`exposure{state,reason}`（allowed/disabled/pending 同义）、`confirmation{mode,waiting_status,notes}`、`examples{name,input,expect,outcome,可选 output/error/fixture_kind/fixture_source}`、`source_provenance{registration,handler,output_schema}` | **字段级对齐**；`authoritative_facts` 在其约定中可选，本端更严（必需） |
| schema 必填项 | `manifestToolEntry` 不含 `input_schema`/`output_schema` 之外的 Java 事实重复要求；`side_effect`/`permission`/`idempotency`/`timeout_ms` 由 Java 描述符注入 | 与本端"不重复 Java 事实"的切分一致 |
| wire name 集合 | 其 `generated/manifest.json` 65 条 vs 本端 65 条，**集合完全相等**（无单侧多余） | **名称级对齐**（独立于本端的静态提取） |
| 编译溯源 | 其 `sources.metadata_hash` = `5905c36b…`，与本端当前 `metadata.yaml` sha256 **不一致**；且其 `roadmap.current.get` 只有 1 个示例，本端现为 2 个 | 其 manifest 由较早一版本端元数据编译而来，相对本轮改动**已过期**；需重编译后再做跨端复验 |
| 描述符 schema 健全性（本端独立复核） | 65 个工具 × (input+output) 共 130 个 schema：`type` 关键字**无一畸形**（全为字符串或字符串数组）、`required` **无一项**不在 `properties` 中、**无任何**子集外关键字 | 真实描述符可用于驱动类型化实例，无需 BLOCKED |

> **仍然 PENDING / BLOCKED（不记为已完成）**：完整输出一致性校验（逐字段类型、嵌套 schema、`required` 集合）与跨端消费复验，需要在**本轮提交之后**由 MiniMax 用真实描述符重新编译、ZCode 独立消费，才能成立。当前 MiniMax/ZCode 额度受阻，本端**不重复派任务**，也不把他端的既有产物当作已通过本端校验。名称级对齐已确认，但它不替代类型化实例校验与跨端消费。

## 3.3 R-D4 真实契约驱动的离线类型化 fixtures

代码评审要求：不得再把 66 个 `shape_placeholder` 当作合法正例，必须给出**实际满足真实 `input_schema`/`output_schema`** 的离线类型化 fixture。

**证据来源（只读）**：MiniMax 于 commit `da3bae15bbc74978b5cff82ef7b26f357bd50837` 交付 `generated/descriptors.json`（sha256 `0e7cf625…`，65 条真实描述符，含 `inputSchema`/`outputSchema`）与 `manifest.schema.json`（sha256 `fcce0b3d…`）。本端**只读**，未写入其工作树、未改其 Schema/生成物。该描述符与两个哈希、来源 commit 一并冻结进本端 fixture（`frozenFacts.descriptorProvenance` + `frozenFacts.toolSchemas`），使校验离线自足、可复现、可检测过期。

**生成方式**：`scripts/harness/capability-semantics-instances.mjs`（`--descriptors <path>`，路径由调用方显式给出，不硬编码他端路径）对每个真实 `outputSchema` 递归生成**契约合法**实例：填充全部已声明属性（因此 `required` 必然满足），可空分支取非空形态，数组带一个生成元素。值一律是可自我标识的合成标记（字符串 `synthetic-<field>`、数值 `0`、布尔 `false`），**不含任何真实业务数据、模型输出或数据库读取**。每个 `fixture_source` 指向该生成器，`fixture_kind` 标为 `synthetic_typed`。

**校验方式**：校验器实现 Java 契约实际使用到的 JSON Schema 子集（`type` 含可空类型数组、`properties`、`required`、`additionalProperties`、`items`），对每个 `ok` 示例：
- `output` 必须通过该工具**真实 `outputSchema`** 校验（违规 → `E_SCHEMA_INSTANCE`）；
- `input` 必须通过该工具**真实 `inputSchema`** 校验；`rejected` 示例则必须**真的违反**它（否则 `E_OUTPUT_INSTANCE`）。

若某个 schema 使用了子集之外的关键字，校验器**不会静默跳过**：`schemaUnsupportedKeywords` 会列出它们，并要求显式冻结的 blocker，否则拒绝。实测：65 个工具的两个 schema **均无子集外关键字**；`type` 关键字全部为字符串或字符串数组（0 处畸形）；`required` 无一项不在 `properties` 中（0 处不一致）。

**三态与实例的准确区分**（对应评审"准确区分无成功路径、显式 null 与实例缺陷"）：

| 情形 | 表达 | 数量 |
| --- | --- | --- |
| 有成功路径的合法正例 | `outcome: ok` + `fixture_kind: synthetic_typed` + 契约合法实例 | 66 |
| 唯一可空契约的显式空状态 | `outcome: ok` + `fixture_kind: nullable_empty` + 显式 `null`（仅 `roadmap.current.get`） | 1 |
| 输入故意非法 | `outcome: rejected` + `fixture_kind: rejection` + 真实 Java 错误语义 | 1 |
| **无成功路径**（D1–D4 静态推导的契约缺陷） | `outcome: unavailable` + `fixture_kind: contract_defect` + 显式 `null` + 真实错误 | 5 |

`shape_placeholder` 已从契约与数据中**完全移除**，并有测试断言"占位符时代已结束"（不得出现该 kind、不得残留 `<shape-placeholder>` 值）。

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

## 5. 其他静态核实的语义事实

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

每项必需字段：`name`、`description`、`when_to_use`、`when_not_to_use`、`error_contract`、`cost_hint{local,external_dependency,notes}`、`exposure{state,reason}`、`confirmation{mode,waiting_status,notes}`、`authoritative_facts[{fact,meaning}]`、`examples[{name,outcome,input,output,error,fixture_kind,fixture_source,expect}]`、`source_provenance{registration,handler,output_schema,unverified_symbols?}`。

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
| `E_NAVIGATION_ROUTE` | 导航 `routeKey` 不在 Java 白名单内 |
| `E_NAVIGATION_PARAMS` | 导航 `params` 与该 route 的必需集合不符 |
| `E_NAVIGATION_SAFE_IDENTIFIER` | 导航参数值不符合 Java 安全标识模式 |
| `E_CREDENTIAL_INJECTION` | 示例任意深度出现凭据字段 |
| `E_OUTPUT_INSTANCE` | 缺结果实例、结果语义自相矛盾（outcome/fixture_kind 不符、假拒绝、缺陷工具谎称成功、fixture_source 无效） |
| `E_SCHEMA_INSTANCE` | 实例违反真实 `input_schema`/`output_schema`（类型、必填、闭包、嵌套、数组），或上游来源/契约未冻结、schema 含子集外关键字 |
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

`agent-service/tests/fixtures/capability-semantics.json` 含 5 条正例与 **55 条反例**，每条反例声明 `ops`（对真实元数据的变异）与 `expectErrorCode`。反例覆盖任务书要求的全部检测面：

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
- **R-D1** 虚构方法 N30、真实但错误的执行类 N31、用 `unverified_symbols` 洗白虚构方法 N32
- **R-D2** 非法 routeKey N33、嵌套身份注入 N34、路由参数不符 N35、参数不符合安全标识 N36
- **R-D3** 非法输出实例 N37、删光 `expect` N38、可接受示例缺结果 N39、假拒绝 N40、缺陷工具谎称成功 N41、形状 fixture 塞入伪造业务值 N42、`fixture_source` 指向不存在文件 N43

三轮新增：**R-D1** 笛卡尔配对 N48/N49、把不存在方法改标 unverified 绕过 N50；**R-D3** 可空工具删 `output` N44、全局删 `output` N45、非可空工具用 `nullable_empty` N46、非可空工具返回显式 null N47。

四轮（R-D4）新增：类型化实例字段类型错误 N51、缺必需字段 N52、输入违反登记 `input_schema` N53、合成实例来源未指向生成器 N54、outcome 与 fixture_kind 不一致 N55；N42 改为"合成实例违反必需字段契约"（预期码随真实 schema 校验改为 `E_SCHEMA_INSTANCE`）。

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
      274 authoritative facts, 73 examples
      negative fixtures 55/55 rejected with the expected code

$ node scripts/harness/capability-semantics-instances.mjs \
    --descriptors <minimax>/contracts/agent-capabilities/generated/descriptors.json --summary
descriptors        65
instances          65
malformed schemas  0
generator failures 0
tools using schema keywords outside the validator subset: 0

$ node scripts/harness/capability-semantics.mjs --check
MATCH  frozen H02 capability facts still match the Java source

$ node --test scripts/harness/capability-semantics.test.mjs
ℹ tests 63   ℹ pass 63   ℹ fail 0
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

首轮 9 个 + 二轮 3 个独立变异已全部按预期表现（其中首轮 6 个、二轮 3 个此前被误接受，现全部被拒）：有效元数据接受；缺工具、重复 wire、虚构方法、真实但错误的执行类、非法导航路由、嵌套身份注入、非法输出实例、缺结果期望——全部拒绝。本端用等价内存变异复现（脚本位于 `/tmp`，未写入仓库），未运行 Codex 的探针脚本本身，因为它会把结果写回 Codex 所属目录。

---

## 8. 限制与未覆盖项

1. **上游 Schema 已不再缺失**：MiniMax 已于 commit `da3bae15…` 交付 `manifest.schema.json`、`README.md` 与 `generated/{descriptors,manifest}.json`。此前"上游无 Schema、仍停在基线"的表述**已作废**；本端只读其文件，未写入。（该旧表述与 §3.2、§3.3 矛盾，本轮已修正。）
2. **本端已完成**：类型化 fixtures 依真实描述符生成并逐项对冻结 schema 校验（§3.3）；66 个 `shape_placeholder` 已被 66 个契约合法实例取代，契约与数据中均不再保留占位符正例。
3. **PENDING — 跨端消费复验**：MiniMax 的 `generated/manifest.json` 仍是较早版本（其 `sources.metadata_hash` 与本端当前 `metadata.yaml` sha256 不一致，且其 `roadmap.current.get` 只有 1 个示例、本端为 2 个）。需要其用真实描述符**重新编译**后，由 ZCode 独立消费才能成立。MiniMax/ZCode 额度仍受限，本端**不重试、不重复派任务**。
4. **PENDING — 服务/模型行为证明**：本端未启动后端、未访问数据库、未调用模型。所有证据为离线静态/契约级。
5. **静态提取与配对不等于注册证明**：`boundPairs` 只能证明声明的绑定出现在该工具的注册上下文里，不能证明运行期必然走到该调用；最终注册证明仍以 MiniMax 的描述符导出为准。
6. **D1–D4 是静态源码推导**，未运行 Java 行为复现；它们应由 Java Owner 用真实测试确认，业务修复另行授权。
7. **输出契约一致性**：类型化实例已按真实契约校验类型/必填/闭包/嵌套/数组；但"handler 实际返回值是否等于契约"仍属静态推导（D2/D3）。
8. 红线检查是结构性的，不构成行为保证（见 §6.3）。
9. `cost_hint` 不含任何 token/费用数值；延迟 worker 侧真实开销未实测，只按"成本发生在请求之外"如实标注。

---

## 9. READY_FOR_CODEX

| 项 | 值 |
| --- | --- |
| 状态 | **READY_FOR_CODEX（ROUND 4）** |
| cwd | `/Users/moxiao/IdeaProjects/project-harness-h02-deepseek` |
| 分支 | `codex/harness-h02-deepseek` |
| 基线 | `16b37d34c882a17e7bc45c69c84411f28f52bff8` |
| 交付提交 | 见本节末「提交」行（R-D4 类型化 fixtures） |
| 测试 | 元数据 65 条全部通过（allowed 28 / disabled 33 / pending 4）；反例 **55/55** 以预期错误码被拒；`--check` 无漂移；`node --test` **63/63**；PyYAML 严格解析与源事实逐字段相等；65 个工具的类型化实例全部通过真实 output_schema 校验 |
| 元数据统计 | 65 条 = 43 READ + 21 WRITE + 1 NAVIGATE；`always_user_confirmation` 11、`conditional_scope_grant` 10、`none` 44；`authoritative_facts` 274 条；`examples` 73 条 = 67 `ok` + 1 `rejected` + 5 `unavailable`（`fixture_kind`：66 类型化实例 + 1 可空空态 + 1 拒绝 + 5 缺陷）；`cost_hint.local:false` 5 条 |
| 证据层级 | mock/offline（无模型、无服务、无数据库） |
| 未覆盖项 | 见第 8 节 |
| 下一步 | 停在 H02，等 Codex 独立验收；**不进入 H03** |

**提交内容**：仅本端 Owner 文件（6 个）。一轮交付提交 `c94cbc9`，二轮整改提交 `9b6f9c4`，三轮整改提交 `b7847e1`。

```
A  contracts/agent-capabilities/metadata.yaml
A  agent-service/tests/fixtures/capability-semantics.json
A  scripts/harness/capability-semantics-extract.mjs
A  scripts/harness/capability-semantics.mjs
A  scripts/harness/capability-semantics.test.mjs
A  docs/verification/harness/h02-deepseek.md
```

**未提交也未改动**：`backend/mvnw.cmd`（已知 CRLF 快照工件，按要求不修改/不暂存/不提交）。
**未触碰**：H01 三棵工作树、桌面 Harness 源码、MiniMax 与 ZCode 的 H02 工作树、`contracts/agent-runtime/**`（H01 冻结契约）、共享计划/交接/Obsidian、模型配置与密钥。未 push/merge/deploy、未重启服务、未访问数据库、未做付费评测。
