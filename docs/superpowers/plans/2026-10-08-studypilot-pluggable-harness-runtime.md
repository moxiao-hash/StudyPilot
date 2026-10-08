# StudyPilot 可插拔 Harness Runtime Implementation Plan

> **For agentic workers:** Choose inline execution or authorized delegation based on task size and dependencies. Use an available execution skill only when useful. Steps may use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将独立 DeepSeek Harness Runtime 通过稳定接口接入 StudyPilot，以全局悬浮 Agent 提供自主判断和受治理业务操作，模型配置与密钥归独立 Agent 子系统。

**Architecture:** StudyPilot Java 负责身份、业务事实、权限、确认和审计；独立 Agent Service 负责配置、Secret、Runtime Adapter、会话与事件。Harness 保留原推理循环、工具调度、压缩和恢复；Vue 使用悬浮球及 Harness 风格窗口，不直接调用模型。

**Tech Stack:** 现有 Java 17/Spring Boot、Python/FastAPI、Vue 3/TypeScript；锁定版本的 Harness/Cordis/TypeScript；独立 Agent 配置与加密 Secret 存储；现有 Java 业务、用量和审计接口。

---

日期：2026-10-08。状态：H01 首轮派发准备中，H02～H12 未开工。共 **12 个 Task，重新编号 H01～H12**，替代此前未落盘的 H01～H09 拆分建议。旧项目 Task 27～34 保持独立编号及原验收状态，不因这份计划成为已完成。

依据：[更新后的接入设计](../specs/2026-10-08-studypilot-harness-integration-design.md)；用户引用的 ChatGPT 对话“嵌入 Harness Runtime”（`6ac6e84c-b904-83e8-8d7e-5becaf631ee9`），本轮读取 10 个最近 turn 的完整响应。引用内容作为需求背景，不把助手建议、示例接口名、附图或历史对话视为生产操作授权。最初请求仅规划；2026-10-08 用户随后授权 Codex 协同 ZCode、MiniMax Code、本机 DeepSeek Harness 派发开发，当前仅派发 H01。

## 已选定的边界

1. 保留原 Harness loop、模型流、调度、压缩、恢复和适用插件。业务专精进入 profile/context/tool/control 插件，旧固定 Planner 不包裹新 Runtime。
2. 新增独立 `agent-service/`，可独立启动和关闭。现有 `ai-service/` 保留资料检索等功能，逐步转用独立 Config 域；不能改名之后继续依赖 Java 返回模型密钥。
3. 前端 `/agent-api/**` 经同源开发/反向代理进入 Agent Service。Java 只签发短时、可撤销、限定 owner/audience/scope 的 Agent 接入凭据；设置请求不经 Java 业务控制器。最终凭据机制在 H01 定义，H05 实现校验。模型密钥不等于该身份凭据。
4. Agent Config 拥有 provider、base URL、model、支持的 reasoning/runtime 参数与 Secret 引用。Java 可以保留业务预算、用量、审计与工具权限，但不拥有模型 endpoint/API Key/config。
5. 本机初版使用 Agent Service 独立的按 owner 加密 Secret 存储，主加密密钥由服务运行环境提供，不写 Git/业务库。SecretStore 接口允许未来替换系统 Keychain；本次不同时实现多平台系统密钥环。
6. 设置入口在悬浮球。API Key 仅在输入表单提交期间短暂存在，不进入全局 Vue store、localStorage、sessionStorage、历史事件或日志；提交后清空，读取设置只返回已配置标记/脱敏信息。不能把“完全不经过浏览器内存”作为可实现承诺。
7. 能力筛选不代替后端鉴权。页面上下文是定位提示，不是权限来源；模型不得指定 owner 或目标 URL。跨页面意图仍可获得被授权的相关工具，不强制只暴露当前页工具。
8. 移除的是独立 Agent 交互和模型设置入口，不删除学习计划、任务、路线、资料、业务审计或历史数据。退役路由须同步 Java/Python/UI Action 注册表与测试，旧链接提供确定的重定向或迁移说明。

## 文件与职责地图

以下路径相对实施工作树。`agent-service/`、`agent-plugins/` 和 `contracts/agent-runtime/` 为拟新增目录；现有文件路径已检查，新增名是计划而非已存在组件。

| 路径 | 职责 |
| --- | --- |
| `contracts/agent-runtime/runtime.schema.json` | Runtime 请求、事件、结束原因、版本与错误契约 |
| `contracts/agent-capabilities/manifest.schema.json`、`metadata.yaml` | 能力清单规范、用途/例子等人工语义元数据 |
| `contracts/agent-capabilities/generated/manifest.json` | 从 Java 描述符和元数据编译的发布产物，不手工维护重复 Schema |
| `agent-service/app/runtime/{protocol,harness_adapter,manager,events}.py` | 可替换运行时接口、非阻塞传输、生命周期、事件投影 |
| `agent-service/app/config/{models,service,secret_store}.py` | 独立模型配置与秘密存储；版本和变更生效策略 |
| `agent-service/app/integration/{identity,capabilities,business_client,budget}.py` | 可信身份、会话能力、Java 工具调用、业务预算桥 |
| `agent-service/app/api/{sessions,settings,interactions}.py` | Agent API，不暴露原 stdio 或底层 Secret |
| `agent-plugins/studypilot/src/{control,tools,context,usage,interaction}.ts` | 使用 Harness 扩展点；统一 handle 注册表 |
| `agent-plugins/studypilot/cordis.patch.yml` | 完整组合与独立配置，替换 SDK 默认 coding persona/传输入口 |
| `web/src/modules/floating-agent/` | 悬浮壳、Workspace、设置、工具卡片和会话状态 |
| `web/src/components/AppShell.vue`、`web/src/app/router.ts` | 全局挂载与旧入口迁移 |
| `backend/.../agent/tool/`、`backend/.../agent/usage/` | 复用现有工具与治理，不迁入 Harness 推理代码 |
| `ai-service/app/providers/credentials.py`、`model_factory.py` | 迁出 Java 模型凭据来源，接独立配置域；保留原业务功能 |

新代码测试跟随责任目录。下文测试文件均为拟新增，执行时按实际项目测试规范调整一次并记录，不凭空报告存在或通过。

## 任务总览与顺序

| Task | 可验收交付 | 依赖 | 用户可见里程碑 |
| --- | --- | --- | --- |
| H01 | 基线、Runtime 契约和 16 个固定评测场景 | 无 | 确定不改哪些原机制 |
| H02 | 完整 Capability Manifest | H01 | 能查到每项业务能力及限制 |
| H03 | 原 Harness Runtime 与控制适配 | H01 | 隔离运行时可持续对话 |
| H04 | 独立 Agent Config 与 Secret 服务 | H03 | 后端配置域解耦，尚无设置 UI |
| H05 | 身份、Session Capability、预算 | H02～H04 | 隔离及额度边界可验证 |
| H06 | 只读业务工具与 Manifest 编译 | H05 | 可读取真实业务数据 |
| H07 | 全局 Floating Agent Shell | H06 | 各业务页都有悬浮入口和基础对话 |
| H08 | Harness 风格 Workspace 与 Settings | H07、H04 | 完整对话窗口、右键设置和历史 |
| H09 | 页面上下文与自主判断 | H08 | 重点体验判断、补查与追问 |
| H10 | 交互提问、插话与持久恢复 | H09 | 停止、待答和重启可恢复 |
| H11 | 业务写入、确认、幂等及恢复 | H10 | 能安全执行完整业务操作 |
| H12 | 全量评测、迁移与旧入口退役 | H11 | 可替换、可拔除、可回退的集成版本 |

默认逐 Task 推进。依赖图允许 H02/H03 等在未来经授权安排并行，但当前只派发 H01 三个互不重叠的工作包，下一 Task 仍需通过当前验收门禁。H07 是首次网页可试用里程碑，H09 是“回答和判断是否改善”的主要门禁，H11 后才开放正式写工具。

### H01：冻结基线与 Runtime 契约

**Files:** 新建 `contracts/agent-runtime/runtime.schema.json`、`docs/verification/harness/baseline.md`、`agent-service/tests/fixtures/runtime_scenarios.json`；检查实际运行的两个 Task 33 工作树、启动脚本及 Harness commit。

- [ ] 记录当前 commit、未提交修复、依赖锁和完整 profile；隔离实施工作树必须包含已认可的修复，不能只从旧 HEAD 起步，也不覆盖当前运行目录。
- [ ] 定义 `open/create/resume`、`prompt`、`cancel`、`steer`、`respond`、`subscribe`、`close` 及 identity/session/turn/call/request/configVersion 等标识。统一结束原因，不把 max-tokens 当完成。
- [ ] 建立 16 个固定场景及字面预期事实，覆盖通用判断、工具结果后二次判断、追问、空状态、错误、压缩、恢复和治理；评分规则在运行前冻结。
- [ ] 每个场景冻结必要事实、允许动作与禁止动作；治理/伪造事实单独记硬失败，答案质量按理解/依据/建议/表达四项评分。真实成对测量每侧每场景三轮，以中位分比较，记录调用成本；发布要求无关键硬失败、总质量分不低于原生基线，任何个别退化必须解释并经用户验收。生成分数不由被测模型自评。
- [ ] 固定原 Harness+DeepSeek 与接入版的模型版本、reasoning、工具/fixture 和预算。H01先提供 mock/offline 可运行基线；真实模型成对测量在 H05 治理完成后执行并在 H12复测，避免当前运行成本未知。

**验收:** 契约 Schema 校验；未改原核心机制清单；场景覆盖与明确失败条件。原生适配优势仍是待验证假设，不以品牌一致代替证据。

### H02：Capability Manifest 与来源真值

**Files:** 新建 `contracts/agent-capabilities/{manifest.schema.json,metadata.yaml}`、`scripts/compile-agent-capabilities.mjs`、`scripts/compile-agent-capabilities.test.mjs`；读取 Java `AgentToolRegistry`、`AgentToolDescriptor` 及现有能力矩阵。

- [ ] 对所有现有工具与公开业务功能建覆盖表，标注允许/禁用/待补及原因，不给未实现能力编造接口。
- [ ] 清单包含 name/version/description/when_to_use/when_not_to_use/input_schema/output_schema/side_effect/permission/confirmation/idempotency/error_contract/examples/cost_hint。
- [ ] 沿用 Java 已有 wire name/version/schema/治理字段；用途元数据补充语义。编译器遇到重复名称、未覆盖字段、治理冲突或无执行目标时失败。
- [ ] 明确学习进度、掌握度等权威事实由现有业务工具提供；模型可解释这些事实，不能自行重算后伪装为系统真值。

**验收:** 所有已登记工具有明确暴露状态；独立手写边界 fixture 检出遗漏、非法示例和冲突。引用对话中的 `studypilot.*` 名称不用于重命名真实接口。

### H03：完整 Runtime 与控制适配

**Files:** 新建 `agent-service/app/runtime/{protocol,harness_adapter,manager,events}.py`、`agent-plugins/studypilot/src/control.ts`、`agent-plugins/studypilot/cordis.patch.yml`；测试 `agent-service/tests/runtime/test_lifecycle.py`、`agent-plugins/studypilot/tests/control.spec.ts`。

- [ ] 挂载锁定的完整 base 组合，保留 loop/压缩/重试/PTC/子 Agent 等，新增自有控制插件，原 SDK 保持独立可用。
- [ ] 同一注册表拥有 create/resume/prompt/cancel/dispose 的 AgentHandle。不能混用外围 create 与原 SDK 私有 sessions map。
- [ ] 实现非阻塞入队、原 followup、多轮历史、单会话 cancel、原 resume 和退出回收；按业务会话隔离 home/workspace，限制实例数量与空闲回收。
- [ ] 用固定 mock provider 证明模型收到工具结果后能继续另一次调用；测试不经过旧 Planner，也不启动真实模型或未授权 shell 工具。

**验收:** 真实本地原运行时+mock provider 的进程/日志证据，多轮、独立停止、重启 resume、无重复会话创建与无孤儿进程。构建通过不能代替这条运行证据。

### H04：独立配置和 Secret 域

**Files:** 新建 `agent-service/app/config/{models,service,secret_store}.py`、`agent-service/app/api/settings.py`、`agent-service/tests/config/test_settings.py`、`test_secret_store.py`；记录后续迁移涉及的 Java `aicredential` 与 Python credential resolver。

- [ ] 实现独立设置 API，按 owner 保存 provider/endpoint/model/支持的 runtime 参数；凭据与非秘密配置分开，配置版本化。
- [ ] Secret 加密存储、写入后不回读明文、不记录请求体；测试使用虚构密钥。新配置默认新会话生效，活跃会话显式重启/换配置，禁止 mid-turn 偷换模型。
- [ ] H05身份实现之前，设置端点仅用于隔离测试且不接真实用户；H07前真实访问必须具备H05鉴权，不能以本机地址代替用户隔离。
- [ ] 只暴露真实支持的配置选项；用户自定义 endpoint 不能用于业务工具任意 URL。校验地址和 provider 能力，不破坏原模型参数契约。
- [ ] 制定旧密钥迁移流程，默认由用户在新入口重新录入；若后续选择一次性迁移，必须无明文证据、可核对且有回退。当前不删除旧密钥。

**验收:** Agent Config 可独立启动/备份；未通过 Java 模型设置 API 写入；脱敏读取、轮换、错 owner、重启和配置生效策略测试。生产前必须完成 H12 的旧消费者迁移，不能以“新设置已解耦”宣称全部解耦。

### H05：身份、会话能力与预算

**Files:** 新建 `agent-service/app/integration/{identity,capabilities,budget}.py`、`agent-plugins/studypilot/src/usage.ts`、`backend/.../agent/api/AgentRuntimeAccessController.java`；测试 `agent-service/tests/integration/test_identity_budget.py` 与 Java 对应访问凭据测试。

- [ ] Java 签发 Agent 身份凭据；Agent Service 校验 audience/owner/scope/有效期/退出撤销，派生子 Agent scope 不扩权。
- [ ] 从静态 Manifest 得到 Session Capability Set，权限与状态变化刷新。未选择页面不能丢失通用工具；工具筛选与调用时后端校验同时存在。
- [ ] 在原 `llm/stream` 扩展点接现有 Java reserve/usage/release，覆盖主调用、重试、压缩和子任务；不改写原不可变请求。费用规则属于业务预算，不迁入 provider Secret。
- [ ] 工具 schema 在请求中的传输成本照实统计；缓存目录/筛选工具可减少重复处理，不宣称所有模型请求免费复用工具定义。

**验收:** 两用户、过期/撤销、子 Agent、预算拒绝、超时与 usage 去重测试。治理完成后进行 H01 原生基线与接入版成对测量，保存脱敏结果，禁止静默降级关键词答复。

### H06：只读工具桥与生成契约

**Files:** 新建 `agent-service/app/integration/business_client.py`、`agent-plugins/studypilot/src/tools.ts`、`agent-service/tests/integration/test_read_tools.py`、`agent-plugins/studypilot/tests/schema_adapter.spec.ts`；复用 Java 工具目录与已有 Python 资料检索服务。

- [ ] Manifest 编译到 Harness Tool Schema、通用注册 binding 和接口文档；业务 service 不由代码生成或动态反射实现。
- [ ] 全量检查 Schema 子集、nullable→互斥 oneOf、点号名称和 Native/PTC 投影。不能无损转换的工具拒绝暴露并给出原因，不删除约束蒙混通过。
- [ ] 先启用只读/导航；权威事实读取、资料检索有明确来源。尚未启用的写工具在目录覆盖表里保持可追踪的禁用状态。
- [ ] 取消信号传到底层 HTTP；有限读重试、缓存失效、空状态/截断/业务错误结构化反馈模型。导航只有终态回执成功才宣称完成。

**验收:** 全目录投影覆盖，以及有数据、无路线、无任务、截断、实际错误、取消和跨 owner 的独立预期测试；授权本地 fixture 账号只读链路验证。生成产物自测不能替代业务行为测试。

### H07：全局 Floating Agent Shell

**Files:** 新建 `web/src/modules/floating-agent/{FloatingAgentHost,FloatingAgentButton,FloatingAgentMenu}.vue`、`floatingAgentStore.ts`；修改 `web/src/components/AppShell.vue`、`web/src/services/current/assistant.ts`、`web/vite.config.ts`；测试 `FloatingAgentHost.spec.ts`、`web/tests/floating-agent-shell.spec.ts`。

- [ ] 登录后各业务页挂载唯一悬浮入口，左键开窗口、右键菜单含新会话/最近会话/设置/状态；提供键盘和触屏等价入口。
- [ ] 实现基础真实对话、窗口最小化/关闭、位置边界及窄屏适配；跨路由保持会话，退出清除 owner 状态。关闭窗口与停止任务区分。
- [ ] `/agent-api` 接独立 Agent Service；Service 不可用时业务页面正常，窗口给出可恢复状态。
- [ ] 新壳通过验收后隐藏旧 Agent 导航入口；此 Task 不直接删除旧页面或历史，以免 H08 尚未具备完整替代能力。

**验收:** 真实任务/路线/资料页面均可开球；跨页不丢流、不重复挂载；基础追问有效；停服务不影响手工业务。用户第一次产品试用门禁。

### H08：Harness 风格 Workspace 与设置入口

**Files:** 新建 `web/src/modules/floating-agent/{AgentWorkspace,AgentSettings,AgentConversationList,AgentToolCallCard}.vue`；复用原 Harness `packages/client/ui-tool/` 等视觉/交互参考；测试 `AgentWorkspace.spec.ts`、`AgentSettings.spec.ts`、`web/tests/floating-agent-settings.spec.ts`。

- [ ] 根据实际 Harness 组件建立布局参考，交付聊天、Working/Running、折叠工具树、Stop、会话历史和状态。采用 Vue 原生组件，不 iframe 原 Web App、不搬入 React 运行树。
- [ ] 从右键菜单进入独立设置，连接 H04；提交后清空 Secret 输入，不进持久缓存、global store、截图证据或日志。
- [ ] 支持断线续传和事件标识去重；根会话答案与子任务结果分开；thinking/工作状态不能伪造不存在的模型推理块。
- [ ] 设计和验收深浅主题、长回复/长工具输出、键盘焦点、菜单边界及移动端。高级项仅展示实际实现并验证的能力。

**验收:** 模型配置保存及新会话生效、历史打开、工具折叠与真实流式增量；浏览器存储/响应/日志无虚构测试 Secret 明文。邀请用户验收风格与交互后进入 H09。

### H09：页面上下文、项目专精与自主判断

**Files:** 新建 `web/src/modules/floating-agent/pageContext.ts`、`agent-plugins/studypilot/src/context.ts`、`agent-service/tests/evaluation/test_business_reasoning.py`；修改会话接口中的结构化 clientContext 契约。

- [ ] 页面仅提供 route/entity/selectedEntity 等最小定位信息，业务事实经正式工具读取；验证归属，跨页更新并保留“本轮使用哪个上下文”。
- [ ] 项目术语、权威指标、工具用途和学习约束按需加入原 context/prompt 扩展点；长期偏好按 owner 保存，业务状态不由旧记忆覆盖。
- [ ] 根据结果补查、提出具体澄清、解释建议；允许自然回答，不强制固定 plan/8步/模板，也不代用户答题或打卡。
- [ ] 评测“这个任务怎么做”“刚才那个改成两天”“最近学得怎么样”“你建议我先学哪个”等表述、错误后恢复及模糊目标，使用人工冻结事实评分。

**验收:** 同任务同预算对比；工具选择、依据、追问指代和自然表达有证据；零伪造业务指标。用户亲自判定是否改善机械感，反馈在本 Task 修正，不以模型自评宣称改善。

### H10：提问、插话与完整恢复

**Files:** 新建 `agent-plugins/studypilot/src/interaction.ts`、`agent-service/app/api/interactions.py`、`agent-service/tests/runtime/test_recovery.py`、`web/src/modules/floating-agent/AgentQuestionCard.vue`；扩展 H03 控制桥及持久映射。

- [ ] 结构化 question answerer、requestId/respond/steer 接原机制；普通澄清用自然对话，不能所有消息都弹卡。
- [ ] 原 cancel 同步终结 pending promise、订阅和未发出调用，迟到回复拒绝；多实例取消不互相影响。
- [ ] 扩展 H03 基础 resume 到浏览器断线、服务重启、运行时崩溃、工具中断和配置变化；持久化展示状态与真实日志标识，不复活悬空 promise。
- [ ] 恢复未知动作先核对外部状态；此 Task 只验证模拟副作用，正式写工具仍关闭，H11才开启。

**验收:** 故障注入后的确切终态、无重复气泡/请求、pending有效期、停止后无新增调用、会话锁竞争和无孤儿进程；真实网页恢复体验。

### H11：受治理写入与确认续执行

**Files:** 扩展 `agent-plugins/studypilot/src/tools.ts`、`agent-service/app/integration/business_client.py`、交互状态持久化；复用 Java `AgentToolActionService`/治理控制器；测试 `agent-service/tests/integration/test_write_actions.py`、`web/tests/floating-agent-confirmation.spec.ts`。

- [ ] 开启已登记写工具，统一 permission→preview→confirmation→idempotency→Java service，不重复通用许可和业务确认。
- [ ] 模型发起预览后保持对应调用等待，用户确认/拒绝后核对 Java 实际状态，再把结果送回原 loop继续推理。PENDING 不算成功。
- [ ] operation/action/execution/幂等键稳定关联；超时、重启、重复点击、拒绝、过期、写后崩溃及结果未知均不重复写。
- [ ] 数据变更只在明确的本地验收 fixture 中做；分别验证完整任务/计划操作，未支持的删除或外部操作继续明确禁用。

**验收:** DB/业务 API 终态证据与网页确认卡一致；错 owner 拒绝；确认之后能继续判断，而非仅返回固定成功句。用户验收后才进入最终切换。

### H12：整体验收、迁移与退役

**Files:** 新建 `docs/verification/harness/final-acceptance.md`、`scripts/harness-acceptance.py`；修改 `web/src/app/router.ts`、`AppShell.vue`、旧 AI 设置入口、Java/Python/UI 路由矩阵、`start-project.sh`、`infra/` 与 README；按迁移清单更新 `ai-service/app/providers/credentials.py`、`model_factory.py` 及 Java `aicredential` 消费者。

- [ ] 复跑 16 场景成对对照；验证原核心文件无业务补丁、完整组装、工具后二次推理、压缩/子 Agent/预算、取消与恢复。记录质量、成功率、调用/重复次数、Token、延迟及失败原因。
- [ ] 移除独立 Agent 首页/计划聊天/任务聊天/健康与模型设置导航，迁入球内对应能力；旧 URL 明确重定向，业务课程/任务/计划/审计保留。根路径和登录后默认进入业务工作台；注册路由及 UI Action 契约同步，不凭登录页 HTTP 200算通过。
- [ ] 所有保留的 AI 消费者从独立 Config 域解析凭据，取消对 Java 返回模型密钥和业务 application.yml provider设置的依赖。已迁移完成后才退役旧凭据 API；默认不删数据库历史密文或用户数据。
- [ ] 旧完成会话可查看或显式导入；未完成操作先核对终态。新旧引擎固定在会话，不 silently fallback；入口切换支持整体回退，不能把写入过的数据回滚成不存在。
- [ ] 拔除 Agent Service/Harness，验证登录及手工学习业务继续运行；换 fixture runtime 验证同接口重新接入，不需要开发第二套生产运行时。
- [ ] 完成整体验收和用户试用，提供启动关闭、独立配置备份/恢复、成本及限制说明。提交/推送/合并/部署分别报告，不能把验收准备等同上线。

**验收:** 关键治理错误为零，原生固定场景按 H01冻结评分无未解释退化；真实业务路径、配置域彻底迁出、旧路由兼容、停用/替换/回退均有证据。这里只计划发布准备，不自动授权部署或删除旧数据。

## 执行与完成规则

- 当前仅规划；未修改业务代码、安装依赖、调用真实模型、派发执行或改变用户配置。
- 每 Task 开工时再核实 AGENTS、版本和工作区；新业务行为/修复先写有意义的失败测试，纯文档/配置选择相应验证。验收后不增加无关清理。
- 每 Task 交付必须区分自动化、原运行时本地实测、真实模型、真实业务页面、用户验收及 Git/部署状态。前六项给用户可审查的接口/运行证据，H07起每项都给明确操作路线。
- 用户验收是下一 Task 的门禁；技术通过后通知用户并停在当前 Task。当前原 Task33的试用状态不被此计划覆盖。
- 不假定已失效执行端可用；实际派发时再确定执行者，无需为规划创建新聊天。隔离工作树在合入或弃用验收后按既有规范清理。

## 需求覆盖自检

| 需求 | Task |
| --- | --- |
| 原机制与 DeepSeek原生基线 | H01、H03、H05、H12 |
| 可插拔与停用不损害业务 | H01、H03、H07、H12 |
| 完整 Manifest、生成、会话筛选 | H02、H05、H06 |
| 独立设置域、Secret、旧消费者迁移 | H04、H08、H12 |
| 全局悬浮球、Harness风格、入口退役 | H07、H08、H12 |
| 当前页面、项目专精、自主判断 | H06、H09 |
| 提问、停止、插话与恢复 | H03、H08、H10 |
| 写确认、幂等、真实状态 | H11、H12 |
| 预算、身份、子任务隔离 | H05、H06、H10、H11 |

这是同一重构的依赖计划，不把配置/UI当作可随意跳过的附加美化。H01起执行时，可按各 Task 细化当轮实现清单，仍以本文件契约和验收边界为准。
