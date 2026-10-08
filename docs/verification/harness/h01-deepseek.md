# H01 个人证据报告：原 Harness 只读盘点、16 场景 fixtures 与离线校验器

日期：2026-10-08
执行端：本机 DeepSeek Harness（H01 三端分包中的「原机制盘点、固定场景与离线基线」分包）
Owner 文件：`agent-service/tests/fixtures/runtime_scenarios.json`、`scripts/harness/baseline-*`、本文档

---

## 0. 回执（ACKNOWLEDGED）

| 项 | 实测值 |
| --- | --- |
| 实际 workspace / cwd | `/Users/moxiao/IdeaProjects/project-harness-h01-deepseek`（`pwd` 实测；会话初始 cwd 为 `/Users/moxiao/IdeaProjects/project`，本任务全部读写仅在上表工作树内） |
| 分支 | `codex/harness-h01-deepseek-baseline`（`git rev-parse --abbrev-ref HEAD`） |
| 基线 commit | `f7311079a83b84c5e7f3a9076ce4efccb3044c86`（`git rev-parse HEAD`，与任务书一致） |
| 可访问性 | 目标工作树可访问；`/Users/moxiao/Desktop/Deepseek Harness` 只读可访问；原 Task33 工作树、桌面 Harness 核心、其他 H01 工作树均未改动 |
| 工作树初始脏状态 | `M backend/mvnw.cmd`（**进入时已存在，非本端改动**；本端未修改、未纳入提交） |
| 当前 UI 模型标签 | provider `deepseek-official`，model `deepseek-flash`，reasoningEffort `high`（来源：`~/.dsh/profiles/desktop/cordis.patch.yml` 的 `agent-default-model` 行 + `$DSH_HOME/settings.yaml.imported`） |
| 真实 provider model ID | **未知**。未通过额外调用探测（任务书禁止）。上述为 UI/配置标签，不代表 wire 侧真实模型 ID |
| 会话内 DSH runtime 标签 | `deepseek-flash`（DSH system prompt 自述），与 UI 标签一致；仍不等于已核实的 provider wire ID |
| 兄弟工作树 | `project-harness-h01-minimax`（`codex/harness-h01-minimax-contract`）、`project-harness-h01-zcode`（`codex/harness-h01-zcode-baseline`）均为独立工作树，未触碰 |
| 状态 | **READY_FOR_CODEX**（见第 12 节） |

未做：push / merge / deploy / 改模型或密钥 / 重启服务 / 真实模型评测 / 操作业务数据库 / 进入 H02 / 修改桌面 Harness 核心 / 修改原 Task33 工作树。

---

## 1. 交付物清单

| 文件 | 类型 | 说明 |
| --- | --- | --- |
| `agent-service/tests/fixtures/runtime_scenarios.json` | 新增（Owner） | 16 个固定场景 + 冻结基线锁 + 成对评测协议 + 禁止伪造模型的约束 |
| `scripts/harness/baseline-fixtures.mjs` | 新增（Owner） | 离线校验器：结构、覆盖、逐场景契约、断言求解；无模型、无网络 |
| `scripts/harness/baseline-fixtures.test.mjs` | 新增（Owner） | 41 个测试；1 个 GREEN 对照 + 40 个负向控制（RED 证据） |
| `scripts/harness/baseline-inventory.mjs` | 新增（Owner） | 原 Harness **只读**盘点与基线漂移检测（32 个扩展点 + 锁文件 + profile 层） |
| `scripts/harness/baseline-inventory.test.mjs` | 新增（Owner） | 16 个测试；活树锁定校验 + 漂移检测负向控制 |
| `docs/verification/harness/h01-deepseek.md` | 新增（Owner） | 本文档 |

未新增/修改：`contracts/**`（公共 schema 本轮归 MiniMax，本端仅在本文档提建议）、共享计划、交接说明、Obsidian、`backend/**`、`web/**`、`ai-service/**`。

---

## 2. 基线锁定（只读实测）

盘点对象：`/Users/moxiao/Desktop/Deepseek Harness`，只读。

| 项 | 实测值 |
| --- | --- |
| HEAD | `ddefc45fbc7f8e46dd73185e68295696d1297887`（分支 `master`）——与 `h01-baseline-provenance.json` 一致 |
| 版本 | `0.1.6-alpha.2`（`package.json`） |
| 未跟踪路径 | `?? .dsh-artifacts/`、`?? _dsh_v4.ts`、`?? workspaces/`——与 provenance 一致；无已跟踪文件改动 |
| `pnpm-lock.yaml` sha256 | `72523ca50bd34e3e21d07c82e1cedfdb91b17e1bcd83006c645e8dc6e0786fe0` |
| `pnpm-workspace.yaml` sha256 | `4aa5f70b1c0be1e3d517fd56a19842e09b6c7b9f1833d4f2c9b04d02052a7dd2` |
| `package.json` sha256 | `a9cc164c4d922d74571e09c04be4e0f85a318685d410bb1c56072258a19a6f1d` |
| 包管理器 | `pnpm@11.7.0`；Node `^22.19.0 \|\| >=24.0.0`（本机实测 `node v26.5.0`） |
| workflow 根 | `pnpm-workspace.yaml`：`vendor/*`、`packages/*/*`、`native/system`、`apps/*`、`website` |

### 2.1 完整 profile 组合（实际生效，实测）

web 与 desktop 两个 profile 的 `dsh.profile.bundles` 相同：

```json
["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app"]
```

profile 层摘要（只读读取 `$DSH_HOME/profiles/**`）：

| profile 层 | web sha256（前 16） | desktop sha256（前 16） |
| --- | --- | --- |
| `cordis.yml`（空根） | `c300dcf2ebc5f020` | `c300dcf2ebc5f020` |
| `cordis.patch.yml` | `46abab791f5adb81` | `fc904e34cf138b6d` |
| `package.json` | `b07f71cba5c341f6` | `eafc5b4ebc3e702e` |

关键差异：desktop 层额外固定 `agent-default-model` 为 `provider: deepseek-official / model: deepseek-flash / reasoningEffort: high`，并启用 `ui-chat`、`ui-settings` 等 UI 行；两层都把 `clawd-on-desk` 与本机 hooks 插件作为 `insert` 追加。web 层 `patchReload: live`，desktop 层无（默认）。

### 2.2 架构分层（由组合文件证实，不是推断）

- **宿主平面（host plane）**：`packages/bundle/base/cordis.patch.yml`（512 行）单独提供。含 `llm`、`session`、`session-persistence-jsonl`、`storage*`、`session-projection*`、`credentials`、`settings-file`、`sandbox`/`sandbox-policy`/`bash-sandbox`、`approval`、`permission`（presets）、`tools`、`system-prompt`、`agent-loop`、`jobs`、`subprocess`、`spill*`、`session-checkpoint-policy`、`mcp-resources`、`token-meter`、`subagent` 注册表、`ptc-runtime`、`web`/`web-search-deepseek`/`web-fetch-http`。
- **Web 表面**：`packages/bundle/web-app/cordis.patch.yml`（516 行）提供 UI/API 行，并**显式 `disabled: true` 掉一批 agent 平面行**（`tool-bash`、`tool-fs`、`tool-fs-search`、`tool-jobs`、`skill-filesystem`、`tool-skill`、`command-goal`、`tool-goal`、`plan-mode`、`compaction-basic`、`command-compact`、`tool-result-pruner`、`tool-subagent*`、`workflow-ptc`、`tool-workflow`、`agent-instructions`、`tool-todo`、`tool-web` …），并 `insert` 一行 `agent-presets`（`config.default: standard`）。文件内注释明确：这些行"由每个会话挂载 preset 提供"，且"禁用而非删除"是为了防止日后静默复活。
- **Agent 平面**：`packages/preset/agent-presets/presets/standard/agent.cordis.yml`（266 行）为默认 preset，提供 persona、`agent-instructions`、`tool-bash`/`tool-pwsh`、`tool-fs`、`tool-fs-search`、`tool-jobs`、`skill-filesystem`/`tool-skill`、`command-goal`/`tool-goal`、`plan-mode`（隔离 realm）、`compaction-basic`+`command-compact`+`tool-result-pruner`（隔离 realm）、`tool-subagent*`/`workflow-ptc`/`tool-workflow`（隔离 realm）、`tool-ask-user`、`tool-todo`、`tool-web`、`present`。
- preset 文件头部约束（第 12–18 行）：preset 内**任何发布 service 的行必须位于带 `isolate` realm 的 group 内**，否则与根 realm 冲突，`dsh-agent-presets` 在挂载时拒绝。

> 结论：**接入点不是"再往宿主平面塞工具行"，而是"新增一个 StudyPilot agent preset / 或加入 preset realm"**。这与设计文档 `agent-plugins/studypilot/cordis.patch.yml` 的意图一致，但需要在 H03 明确选择"新增 preset"还是"扩展 standard preset"。

### 2.3 冻结的机制/组合/preset 与 profile 层摘要（一轮 R4 整改）

一轮验收指出：`baseline-inventory.mjs` 采集了 `extensionPoints`/`profileFiles` 的 sha256，却**没有存进 fixture 基线参与比较**，因此"LOCKED baseline matches"无法支撑"核心机制/profile 内容已锁定"的结论。二轮已整改：

**冻结进 fixture 的内容**（`agent-service/tests/fixtures/runtime_scenarios.json` 的 `baseline`）：

| 块 | 条目数 | 内容 |
| --- | --- | --- |
| `baseline.lockedHashes` | 3 | `pnpm-lock.yaml`、`pnpm-workspace.yaml`、`package.json` |
| `baseline.extensionPoints` | 33 | 必要核心机制 + 组合 patch + agent preset 的 sha256（**仅摘要，无文件内容**） |
| `baseline.profileFiles` | 6 | 实际采用的 web/desktop profile 层（`cordis.yml`、`cordis.patch.yml`、`package.json`）sha256 |
| `baseline.profileBundles` | 2 | `@deepseek-ai/dsh-base`、`@deepseek-ai/dsh-web-app` |
| `baseline.mechanismLockNote` | — | 声明"只保存摘要、不保存文件内容、因此不含 secret" |

生成方式（可复现）：`node scripts/harness/baseline-inventory.mjs --lock` 输出仅含摘要的锁定子集。

**`checkAgainstFixture` 现在拒绝的情形**（`{ok:false}`）：

1. HEAD 变化；锁文件摘要变化。
2. **必要机制/组合/preset 摘要变化**（如 `loop-main` 内容变化 → 一轮反例，现为 `accepted=false`）。
3. **机制缺失**（磁盘缺失，或从 inventory 中被移除/改名）。
4. **profile 层摘要变化**（bundles 不变也拒绝 → 一轮反例，现为 `accepted=false`）。
5. **profile 层缺失或不可读**。
6. 锁定的核心机制路径出现在 working tree 修改项中（**仅**锁定核心路径算漂移；无关未跟踪工件不算——避免"dirty 列表全等"冒充机制保护）。
7. `baseline` 未冻结机制或 profile 摘要（显式判为 UNVERIFIED，不再静默通过）。

**明确判为 UNVERIFIED（同样使 `ok:false`，不静默变干净）**：live inventory 出现冻结锁之外的机制；profile 层整体不可读；profile bundles 不可读；锁定的 preset 名无法解析。返回值因此为 `{ok, drift, unverified}`——`checkAgainstFixture` 的任何调用方都能区分"内容变化"与"无法比较"。

**不存 secret**：锁定块只含 sha256 摘要；生成器只输出摘要；fixture 校验器额外做全文档敏感键扫描（`apiKey`/`secret`/`password`/`token`/`credential` 等键名一律拒绝）。profile 层中仅有一个 `apiKeyEnv: ANTIGRAVITY_TOOLS_API_KEY` 这类**环境变量名**，其值从未被读取、也从未进入 fixture。

---

## 3. 原 Harness 只读盘点：loop / 压缩 / 恢复 / 工具 / 事件 / 插件 / approve / question / 预算

以下每条均带 `路径:行号`。未核实项显式标注 `UNVERIFIED`。

### 3.1 推理 loop 与模型流

| 机制 | 证据 |
| --- | --- |
| 主循环 | `while (await this.turn()) {}` @ `packages/core/agent-loop/src/agent.ts:228`（驱动入口 `kick()` `:226`） |
| turn | `turn()` @ `agent.ts:270`；`turn/start` `:279`、`turn/end` `:340` |
| step 内循环 | `while (true)` @ `agent.ts:287`；`step()` @ `:353`；`step/start` `:303`、`step/end` `:313` |
| 模型请求 | `preparedCall?.stream(request) ?? this.loopCtx.llm.stream(request)` @ `agent.ts:391`，消费 `for await (const chunk of stream)` @ `:395` |
| 工具执行 | `await executeToolCalls(...)` @ `agent.ts:489` |
| 工具结果回灌模型 | `tool/result` 落盘 @ `packages/core/agent-loop/src/tool-calls.ts:282`；下一请求由 `session.deriveMessages()` 派生 @ `agent.ts:604`；`tool/result` 映射为 model role `user` @ `packages/core/session/src/index.ts:324` |
| **真实多步推理** | 带工具调用的 step 返回 `null`（非 concluded）@ `agent.ts:493`，turn 循环再迭代→新的 `llm.stream` @ `:391`。**不是预生成固定计划** |
| 无 max-steps 上限 | 扫描 `maxStep\|maxIteration\|MAX_STEP\|MAX_ITER\|maxTurns\|stepLimit` 于 `packages/`（排除 `lib/`、`node_modules`）**零命中**。唯一限流为并发上限 `DEFAULT_MAX_PARALLEL_TOOL_CALLS = 10` @ `packages/core/agent-loop/src/constants.ts:6` |
| 结束分支 | 无工具调用 → `{kind:'completed'}` @ `agent.ts:488`；`max-tokens` @ `:485`；工具 `concludesTurn` @ `:493` |
| 请求不可变 | loop 构造请求即 `Object.freeze` @ `agent.ts:611`（`deepFreeze(header)` `:603`、`deepFreeze(message)` `:607`、`Object.freeze(boundaryMessages)` `:610`）；`deepFreeze` 遍历冻结 @ `packages/util/values/src/index.ts:210`；`llm/stream` 契约明写"listeners read it, never rewrite it" @ `packages/llm/llm/src/index.ts:65-67`；运行时由不变式监听强制，违者 `'a loop-built request must be frozen'` @ `packages/core/agent-loop/src/invariant.ts:21-23` |

### 3.2 对外控制 API（embedder 视角）

| 操作 | 证据 |
| --- | --- |
| `followup(message)` | 实现 `agent.ts:137`；契约 `packages/core/agent/src/runtime-types.ts:222` |
| `steer(message)` | `agent.ts:141`；契约 `runtime-types.ts:231` |
| `inject(message)` | `agent.ts:145`；契约 `runtime-types.ts:241` |
| `send(message, target, wakeup)` | `agent.ts:128`；契约 `runtime-types.ts:215` |
| `cancel(cause, options?)` | `agent.ts:149`；契约 `runtime-types.ts:183`；`CancelOptions` `:38`。**无 `abort()` 方法** |
| `whenIdle()` | `agent.ts:211`；契约 `runtime-types.ts:191` |
| `create` | `AgentRegistry.create` @ `packages/core/agent/src/index.ts:388`；factory `:190`；loop 实现 `packages/core/agent-loop/src/index.ts:766` |
| **`resume`** | `AgentRegistry.resume` @ `packages/core/agent/src/index.ts:407`；接口 `:202`；loop 实现 `packages/core/agent-loop/src/index.ts:859`；`resumeSessionId` @ `:127` |
| 释放 | `AgentHandle { agent; dispose() }` @ `packages/core/agent/src/index.ts:160-162`；loop 侧 `machine.cancel({kind:'disposed'})` → `await machine.whenIdle()` → `scope.dispose()` @ `packages/core/agent-loop/src/index.ts:596-598`。**`Agent` 接口自身没有 `dispose`**（`runtime-types.ts:163-242`） |

### 3.3 取消与插话（steer）语义

- 阶段级 `AbortController`：驱动创建 @ `agent.ts:203`，每 turn 替换 @ `:346`。
- `cancel()` 清空 inbox 并以调用方 cause 中止 @ `agent.ts:149-155`。
- 中止时工具调度：排空已启动调用（`Promise.allSettled(inFlight.values())` @ `tool-calls.ts:234`），已启动结果照常提交，未启动调用写入合成 `ABORTED_BEFORE_DISPATCH` @ `tool-calls.ts:241`、`:250-260`；被跳过的调用 @ `:97`。
- 中断的 assistant 流写入 `interrupted: true` 的 `assistant/message` 或 `assistant/attempt` @ `agent.ts:403-426`；turn 结束变为 `{kind:'aborted', reason}` @ `:324-327`。
- **steer 注入边界**：`steer` = `send(input, 'next-step', true)` @ `agent.ts:141-143`；inbox 批次在 `preStep` 每个候选 step **只领一次**：`this.inbox.claim(target, position.turn)` @ `agent.ts:245`（claim 实现 `packages/core/agent-loop/src/inbox.ts:109`）。turn 循环在第一步后把 target 由 `'next-turn'`（`:285`）切到 `'next-step'`（`:321`），故运行中插话只落在**下一个 step 的请求**，绝不进入在飞请求。
- `agent/turn-stopping` 串行钩子 @ `agent.ts:316-319`（声明 `runtime-types.ts:381`）允许监听者插话以继续一步。

> 对 H10 的意义：`cancel`/`steer` 机制在原 loop 内**已存在且可复用**，控制桥应薄封装，不需要改 loop。设计文档所说"SDK 缺口"准确含义是"SDK 传输层未暴露"，而非"原机制缺失"。

### 3.4 工具注册与 JSON Schema 子集

| 项 | 证据 |
| --- | --- |
| 服务与 ctx key | `class ToolRuntime` @ `packages/core/tools/src/index.ts:789`；key `tools` @ `:130-133`；服务发布 @ `:829` |
| 注册 API | `register(definition): () => void` @ `index.ts:1043` |
| 注册校验顺序 | 输出声明形状 `:1046-1050` → `assertSupportedJsonSchema(output.schema)` `:1051` → `timeoutMs` `:1052-1056` → 保留名拒绝 `:1060-1062` |
| 输出 schema 必填 | `ToolOutputDefinition { schema, render, presentationMeta? }` @ `index.ts:206-213`；注册时强制 `:1046-1051`；运行时值校验失败抛 `ToolOutputError` @ `:512` |
| 作者接口 | `defineTool(options)` @ `packages/core/tools/src/schema.ts:545`；`DefineToolOptions` @ `:483`（`name` `:485`、`description` `:487`、`parameters` `:489`、`output` `:491-498`、`execute` `:513`） |
| **支持的关键字** | `CONSTRAINT_KEYWORDS = {type, oneOf, properties, required, additionalProperties, items, enum, const}` @ `json-schema.ts:76-85`；注解 `{description, title, default, examples}` @ `:86`；`SCHEMA_TYPES = [object, array, string, number, integer, boolean, null]` @ `:87`。**其他关键字一律拒绝** @ `:267` |
| **类型数组不支持** | `type` 必须是单个字符串 @ `json-schema.ts:303-307`，报文 `"...type must be a single type string (type arrays are not supported)"` @ `:304-305`。**已在本机实测命中**（交付物外的只读实验，见 9.1） |
| `oneOf` 支持 | ≥2 分支 @ `:289-300`；`type` 与 `oneOf` 并存被拒 @ `:278-281`；`oneOf` 旁挂约束兄弟键被拒 @ `ONE_OF_SIBLING_KEYWORDS :200`、`:283-285`。**object/null 互斥 `oneOf` 被接受**（null 分支 `:351-370`） |
| 对象根限制 | `assertObjectJsonSchema` 要求根 `type: 'object'` @ `:397-403`——影响子 Agent/workflow 的结构化输出，**不影响工具输出 schema**（后者只用 `assertSupportedJsonSchema`，`index.ts:1051`） |
| 工具名校验 | 注册表只校验 (a) 同层唯一 @ `index.ts:728-730`，(b) 保留名 `run_code` @ `packages/core/tools/src/ptc.ts:23`、拒绝 @ `index.ts:1060-1062`。**无字符/点号/长度校验**，`studypilot.foo` 可注册 |
| 点号名的真实约束 | provider wire 层：MCP 客户端按"DeepSeek function-name contract" `[A-Za-z0-9_-]`、≤64 归一化 @ `packages/mcp/mcp-client/src/tools.ts:48-51`、`publicToolName` `:81-87`；DeepSeek adapter 则**原样序列化** `tool.name` @ `packages/llm/llm-deepseek/src/protocols/chat-completions/serialize.ts:344`。**DeepSeek API 本身是否拒绝点号名：UNVERIFIED**（仓库内无强制） |
| 事件扩展点 | `tools/pre-execute` @ `index.ts:146`、`tools/execute` `:157`、`tools/post-execute` `:169`、`tools/result` `:191`、`tools/change` `:201` |
| 其他面 | `restrict(filter)` `:1077`（仅 agent 作用域）、`guard()` `:1116`、`presentAs()` `:954`、`executionMode` `:1282`、`schemas()` `:1240` |

### 3.5 压缩（compaction）

| 机制 | 证据 |
| --- | --- |
| 扩展点（抽象服务） | `class CompactionEngine extends Service` → `super(ctx,'compaction')` @ `packages/compaction/compaction/src/index.ts:112-115`；契约方法 `compactIfNeeded` `:129`、`compactNow` `:155`、`compactRegion` `:180`；触发词表 `'pressure' \| 'context-overflow'` `:24-25`；日志事件 `compaction/start\|summary\|prune\|end` @ `packages/compaction/compaction/src/types.ts:17-90` |
| 后端 | `BasicCompactionEngine` @ `packages/compaction/compaction-basic/src/index.ts:100`；`static inject = ['llm','tokenMeter','sessions']` @ `:101`；唯一子类定制钩子为 `summarize()`（注释 `:96-97`） |
| 配置字段与默认值 | `thresholdRatio` 默认 **0.8** @ `packages/compaction/compaction-basic/src/config.ts:20`/`:74`；`retainRatio` 默认 **0.16** @ `:23`/`:75`；`maxTokens` 8192、`compactionRetries` 1、`maxOverflowRetries` 1、`auto` true @ `:91-95`；`retainTokens`/`summarizationProvider`/`summarizationModel`/`modelPolicies[]` @ `index.ts:70-113`；按路由覆盖 `modelPolicies` @ `config.ts:105-125`/`:194-212`；预算随 contextWindow 缩放 @ `:133-167`；装载期 fail-fast @ `:180-191`/`:240-249` |
| 触发点 | 串行 `agent/pre-step` → `compactIfNeeded(agent,'pressure')` @ `compaction-basic/src/index.ts:141-150`；`agent/request-error` 且 `CONTEXT_WINDOW_EXCEEDED_CODE` → `'context-overflow'`，受 `maxOverflowRetries` 约束 @ `:165-196` |
| 触发判定/重试耗尽 | `measurement.totalTokens < spec.thresholdTokens` 比较 @ `:301`/`:309`/`:322`；`compaction still above threshold after ${spec.compactionRetries + 1} compaction attempts ...` @ `:326-327` |
| **压缩是真实计费模型调用** | 摘要器发起一次真实 `ctx.llm.stream()`，带 `purpose: 'compaction'` @ `packages/compaction/compaction-basic/src/summarizer.ts:151-161`（`purpose` `:158`、`stream` `:161`）；路由解析顺序为配置→上一次路由请求→AgentOptions @ `:126-141`；provider 侧标记头 `x-deepseek-harness-compact: 1` @ `packages/llm/llm-deepseek/src/protocols/chat-completions/adapter.ts:266-268` |
| **压缩绕过 `agent/request`** | 该调用**不经过 loop 专有的 `agent/request` waterfall** @ `packages/compaction/compaction-basic/README.md:118` ⇒ 只挂 `agent/request` 的预算插件**看不到压缩调用** |
| **压缩不计入会话轮次用量** | 轮次用量只折叠 in-turn `assistant/message` @ `packages/llm/token-meter/src/turn-usage.ts:213-246`；压缩调用的 usage 记在 `compaction/summary` @ `packages/compaction/compaction/src/types.ts:52-53`，仅作为 surface 替换的 shadow price 使用 @ `packages/llm/token-meter/src/surface-projection.ts:68-90` |
| 工具结果裁剪（免模型） | `ctx.toolResultPruner` 服务 @ `packages/compaction/compaction-tool-result-pruner/src/index.ts:44`/`:59`；`thresholdChars: 8192`、`headChars: 4096`、`tailChars: 1024` @ `src/config.ts:10-14`、schema `src/index.ts:49-53` |
| 图片卸载（错误恢复执行器） | 插件 `name='compaction-image-offload'`，挂 `agent/request-error` + `compaction/summary-error` @ `packages/compaction/compaction-image-offload/src/index.ts:18-40`（**不是** `CompactionEngine`） |
| 手动入口 | `/compact` → `ctx.compaction.compactNow(...)` @ `packages/compaction/command-compact/src/index.ts:67` |
| 组合归属 | base 挂载 3 个压缩后端；**web-app 将 `compaction-basic`/`command-compact`/`tool-result-pruner` 置 `disabled: true`**，改由 standard preset 在隔离 realm 内挂载 @ `packages/preset/agent-presets/presets/standard/agent.cordis.yml:138-156`；`token-meter` 有意留在宿主平面（preset 文件注释 `:132-137`） |

### 3.6 恢复（resume）

| 机制 | 证据 |
| --- | --- |
| 会话格式当前版本 | `export const SESSION_FORMAT_VERSION = 3` @ `packages/core/session/src/types.ts:88`；header 必须匹配 @ `packages/core/session/src/index.ts:100-101`；生成表 `currentVersion: 3` @ `packages/session/session-format-catalog/src/generated.ts:15` |
| 持久化位置与布局 | base 行 `session-persistence-jsonl`，`root: dshHomePath('sessions')` @ `packages/bundle/base/cordis.patch.yml:117-120`；每项目一目录再每会话一目录 @ `packages/session/session-persistence-jsonl/src/format.ts:253-268`；产物 `session.v<version>.jsonl[.zstd]` @ `format.ts:57-59`/`:279-304`；`root` 必填无默认 @ `README.md:44-48` |
| 持久化时机 | `create()` 不写盘，首次 append 才落盘并 fsync；崩溃尾部保留，由恢复读取方补合成结束事件 @ `packages/session/session-persistence-jsonl/README.md:76` |
| 检查点 | `@deepseek-ai/dsh-session-checkpoint-policy`：在 `llm/stream` 适配器派发前、顶层 `tools/execute` 工具体前、`agent/pre-step` 做语义 flush @ `packages/session/session-checkpoint-policy/src/index.ts:63-82`（fail-closed 说明 `:20-22`/`:58-59`） |
| 投影 seam | `ctx.sessionProjections` 注册表驱动 `ProjectionDefinition` 折叠 @ `packages/session/session-projection/src/index.ts:1-35` |
| **真正的恢复入口** | `ctx.agents.resume(options)` @ `packages/core/agent/src/index.ts:407-413`；选项（持久 id、parent、agentOptions、signal、setup）@ `:125-144` |
| 恢复实现 | `AgentLoop.resume` 在未组合持久化时抛 `cannot resume: session persistence is not configured (load a dsh-session-persistence backend)` @ `packages/core/agent-loop/src/index.ts:859-865`；实际工作在 `resumeWith` @ `:868-942`：**先**取写所有权 `persistence.open(id,'write')` @ `:894-899`，冷读日志 @ `:904`，追加 `interruptedTurnClosers` @ `:907-908`，播种会话 @ `:909-914`，以 source `'resume'` 发布 @ `:924-934` |
| 正确用法先例 | headless `--session-id`（不存在时报错而非静默新建）@ `packages/bundle/headless/src/index.ts:279`/`:286-289`；ACP `session/load` @ `packages/acp/acp/src/session.ts:149-152` |
| **只重传旧 ID 的失败形态** | 抛 `session "<id>" already exists`：会话层 `packages/core/session/src/index.ts:1009`（第二个边界 `SessionStore.enter` `:1073`）、agent 注册表 `agent "<id>" is already registered` @ `packages/core/agent/src/index.ts:464`、持久化层 `SessionAlreadyExistsError` @ `packages/session/session-persistence-jsonl/src/index.ts:318` → `packages/session/session-persistence/src/errors.ts:22-28`；测试 @ `packages/core/agent-loop/tests/resume.spec.ts:150` |
| **恢复能修复什么（重要正面证据）** | 崩溃修复把丢失结果的**已记录**工具调用收尾为合成错误 `TOOL_OUTCOME_UNKNOWN`（明确告知模型"结果未知"），把**从未记录**的调用收尾为 `TOOL_NOT_STARTED` @ `packages/core/session/src/repair.ts:14-18`/`:93-126`（文案 `:106-107`），并补 `step/end` + `turn/end{reason:'interrupted'}` @ `:130-133`；文档 @ `packages/session/session-persistence-jsonl/README.md:137-139`。⇒ 原机制**不会**把未知写入伪装成成功，与设计文档"恢复未知动作先核对外部状态"一致，H10 可直接复用该事实 |
| 恢复**不**包含 | 在飞工具 promise 不重新挂接（见上）；待答 approval 不会被重新提问（`approval/asked`/`decided` 必须成对且位于未关闭 turn 内 @ `packages/interaction/user-approval/src/invariant.ts:32-44`，而崩溃修复会关闭 turn @ `repair.ts:133`）⇒ 未答复的 `asked` 在 resume 后被丢弃（**由代码推导，无散文档，部分 UNVERIFIED**）；进程内 provider 缓存仅当重建历史+envelope+路由都吻合才可能复用 @ `README.md:143`/`:147`；子 Agent 冷恢复**不**恢复原每次激活预算（`maxTokens`/`outputSchema` 不在持久描述符内）@ `packages/subagent/subagent/src/descriptor.ts:13-18` |

### 3.7 事件与流

- Agent 作用域事件（声明于 `packages/core/agent/src/runtime-types.ts`，发射行见 agent-loop）：`agent/created` `:261`、`agent/disposed` `:270`、`agent/status` `:280`、`agent/inbox/inserted` `:288`、`agent/inbox/claimed` `:299`、`agent/inbox/discarded` `:307`、`agent/pre-step`（waterfall）`:320`、`agent/request`（waterfall）`:337`、`agent/request-error`（waterfall）`:353`、`agent/assistant-stream` `:363`、`agent/turn-stopping`（serial）`:381`、`agent/error` `:393`。
- 流帧联合 `runtime-types.ts:128-161`；帧构造 `packages/core/agent-loop/src/assistant-stream.ts`。`AssistantStreamFrame.attemptId = ${sessionId}:${attempt}` @ `assistant-stream.ts:45`。
- 持久会话事件（loop 落盘）：`turn/start` `agent.ts:279`、`step/start` `:303`、`step/end` `:313`、`turn/end` `:340`、`system/message` `:372`、`user/message` `:376`、`assistant/message` `:406`/`:477`、`assistant/attempt` `:424`/`:430`/`:447`、`request/header` `:572`/`:575`/`:581`、`request/context` `:598`、`tool/call` `tool-calls.ts:264`、`tool/result` `tool-calls.ts:282`。
- 根 vs 子 Agent：派发器为每个 agent 作用域负载注入 `agent` 字段 @ `packages/core/agent/src/dispatch.ts:113-118`，并按 scope 过滤（`:142`、`:146`）。**事件本身不带 root/subagent 标志**；判别靠运行时 `ctx.agents.roots()` / `isOwnedBy()` @ `packages/core/agent/src/index.ts:593`/`:575`，或持久 `session.header.origin === 'subagent'` @ `packages/core/session/src/types.ts:116`、`parentSession` `:106`、`delegationDepth` `:122`（子 Agent 设置 @ `packages/subagent/subagent/src/child-agent.ts:153`/`:155`）。

### 3.8 approve 与 question

| 项 | 证据 |
| --- | --- |
| approval 服务 | `super(ctx, 'approval')` @ `packages/interaction/user-approval/src/index.ts:149`；`request()` @ `:208` |
| approval 扩展点 | `approval/request` **waterfall**，声明 @ `packages/interaction/user-approval/src/types.ts:85`，派发 @ `index.ts:275` |
| answerer 签名 | `(req: ApprovalRequestEvent, next) => Promise<ApprovalOutcome>` @ `types.ts:85-89`；请求负载 `{agent, toolName, callId?, reason?, signal?}` @ `types.ts:63-74` |
| 取值集合 | `ApprovalOutcome = 'allowed-once' \| 'rejected' \| 'cancelled' \| 'unavailable'` @ `types.ts:32`；运行时归一表 @ `index.ts:48` |
| **无 answerer** | waterfall 终点返回 fail-closed `'unavailable'` @ `index.ts:276`；非词表返回值归一为 `'unavailable'` @ `:281`；answerer 抛错被围堵为 `'unavailable'` @ `:284` |
| `never` 策略 | 派发前直接 `'rejected'` @ `index.ts:268`；策略联合 `'ask' \| 'never'` @ `:60`；部署值 @ `packages/bundle/base/cordis.patch.yml`（`approval` 行） |
| 审计对 | `approval/asked` @ `index.ts:218`、`approval/decided` @ `:225`——**强制成对** |
| approval requestId | 服务侧签发 `ApprovalRequestId(randomUUID())` @ `index.ts:217`，类型 @ `types.ts:17` |
| 无 open turn 时拒绝 | `index.ts:208`、`:210` |
| question 服务 | `super(ctx, 'userQuestions')` @ `packages/interaction/user-questions/src/index.ts:67`；`ask()` @ `:86` |
| question 扩展点 | `user-questions/request` **waterfall**，声明 @ `packages/interaction/user-questions/src/types.ts:88`，派发 @ `index.ts:136`/`:137` |
| **无 provider** | `new UserQuestionError('no user-questions answerer accepted the request', 'NO_PROVIDER')` @ `index.ts:130-133` |
| **requestId 缺口** | 该 seam **不签发 requestId**；关联 ID 是调用方提供的 `AskUserQuestionItem.id` @ `types.ts:38`（"Stable caller-provided question id, echoed in the answer"），回显为 `AskUserQuestionAnswerItem.id` @ `types.ts:56`。对比 approval 确实自签 UUID |
| 取消与清理 | approval：`signal?.aborted` → `'cancelled'` @ `index.ts:262`；`onAbort` 在两条 settle 路径均移除 @ `:287-294`；"迟到答复被丢弃"（`index.ts:120-124`）。question：早退抛 `abortedQuestion()` @ `index.ts:87`；中止后拒绝转 `ASK_ABORTED` @ `:146` |
| 超时 | 两个 seam **都不定义超时**（对两个 `src/index.ts` grep `timeout` 零命中）；生命周期仅由调用方 `AbortSignal` 决定 |

### 3.9 预算 / 用量扩展点

| 项 | 证据 |
| --- | --- |
| 模型边界 | `llm.stream()` → `ctx.waterfall(this, 'llm/stream', options, …)` @ `packages/llm/llm/src/index.ts:1110-1118`；waterfall 声明 @ `:72` |
| 可拦截性 | `llm/stream` 是唯一原始模型调用拦截设施。监听者可 `next()` 取真实流，或**自行 yield 分片短路**（文档 @ `:62-63`）——这是可用的预占闸门 |
| **请求不可改写** | loop 构造的请求深度冻结 @ `agent.ts:611` + `deepFreeze` @ `packages/util/values/src/index.ts:210`；契约 @ `llm/src/index.ts:65-67`；不变式强制 @ `packages/core/agent-loop/src/invariant.ts:21-23`。**监听器只能读与短路，不能改写出站内容** |
| 模型选择改写点 | `agent/request` waterfall（声明 `runtime-types.ts:337`、派发 `agent.ts:531`）**可以**替换 provider/model/reasoningEffort/maxTokens；仓内先例 `installModelSelection` @ `packages/core/agent/src/model-selection.ts:76`，监听器实现 @ `:91-92` |
| 重试 | `llm-retry` 只监听 `agent/request-error` @ `packages/llm/llm-retry/src/index.ts:243`，返回决策 `{ kind: 'retry' }` @ `:191`；loop 收到后 `continue` @ `agent.ts:461`、`:464`，**重新走 `prepareRequest`→`llm.stream`** @ `:363`/`:380`/`:391` ⇒ 每次重试都是**独立的 llm/stream 调用**，并落 `llm/retry` 事件 @ `index.ts:188` |
| 用量上报 | 流级 `{type:'usage', usage}` @ `packages/llm/llm/src/types.ts:432`；持久 `assistant/message.usage` @ `packages/core/session/src/types.ts:327`，落盘 @ `agent.ts:481` |
| token 计量 | 服务 `super(ctx,'tokenMeter')` @ `packages/llm/token-meter/src/index.ts:111`；`measure(session)` @ `:146`；`estimateMessage()` @ `:214`；仅测量、无写入/预占方法（无 config @ `:104`） |
| **计量不累计重试** | 失败尝试落 `assistant/attempt`，**不带 usage** @ `packages/core/session/src/types.ts:335`，且不在 `SurfaceEventType`（`:416-420`），token-meter 忽略；成功 `assistant/message` 的锚点被**覆盖而非累加** @ `packages/llm/token-meter/src/index.ts:306-320` ⇒ `measure()` 反映最近一次成功调用，不是重试总成本 |
| **无预算/预占 API** | 对 `packages/llm/**` 与 `packages/core/agent-loop/**` grep `reserve`/`reservation`/`budgetMs`/`costBudget`/`tokenBudget`：唯一 `budget` 命中是无关的图片请求预算（`packages/llm/llm/src/types.ts:337`）与 provider 错误文本匹配（`packages/llm/llm/src/error.ts:92`）⇒ **预算预占/闸门必须由插件在 `llm/stream` + `agent/request-error` 上自建** |
| 其他可观测面 | 任意插件可经 `session/event` 观察全部持久事件 @ `packages/core/session/src/index.ts:72`（token-meter 自身即如此用 @ `packages/llm/token-meter/src/index.ts:120`） |

### 3.10 插件模型与上下文/persona 扩展点

| 项 | 证据 |
| --- | --- |
| 插件形状 | ESM 导出 `name`、可选 `inject`、可选 `Config`（schemastery）、`apply(ctx, config)`；service 插件改默认导出 `class X extends Service` + `super(ctx,'name')` + `static Config` |
| 最小实例 | `@deepseek-ai/dsh-tool-ask-user`（101 行）：`name` @ `packages/interaction/tool-ask-user/src/index.ts:13`、`inject = ['tools','userQuestions']` @ `:14`、`apply` @ `:19`、`ctx.tools.register(defineTool({...}))` @ `:21`/`:80`、调用 `ctx.userQuestions.ask({..., signal: exec.signal})` @ `:81`/`:90` |
| 行形状 | `{ id, name, config?, disabled?, group?, isolate?, insert? }`；`insert` 块 vs 覆写行由 `item.has('insert')` 区分 @ `packages/boot/plugin-manager/src/patch.ts:31` |
| 覆写语义 | patch **整体替换**目标行的 `config`（不深合并）@ `packages/bundle/base/cordis.patch.yml:5-7` |
| profile 位置 | `$DSH_HOME/profiles/<name>`，含 `package.json`（`dsh.profile.bundles` 有序列表）+ 自己的 `cordis.patch.yml`；`PROFILES_DIR` @ `packages/boot/app-boot/src/profile.ts:47`、`PROFILE_PATCH_FILENAME = 'cordis.patch.yml'` @ `:53` |
| system prompt 段落 | `systemPrompt.section({name, order, text, complete?})` @ `packages/core/system-prompt/src/index.ts:455`；服务 @ `:423`；命名为有序、按层遮蔽的注册表（同层重名抛错）@ `:448-453` |
| 动态上下文 | `systemPrompt.context({name, order, text})` @ `packages/core/system-prompt/src/index.ts:490` |
| 整段装配 waterfall | `system-prompt/assemble` @ `packages/core/system-prompt/src/index.ts:33`（派发 `:625`），返回值权威；**但 `complete` 段会在 waterfall 之后被恢复覆盖** @ `:629-633` |
| 默认 coding persona | 由 `system-prompt` 自身 config 提供：`personaPrefix`/`personaSuffix` @ `packages/core/system-prompt/src/index.ts:409-411`，注册为 `deployment:persona-prefix`/`-suffix` @ `:430`/`:434`/`:438`；**shipped 文本** `You are a coding agent powered by the {{model}} model.` + `Your working directory is {{cwd}}.` @ `packages/bundle/web-app/cordis.patch.yml:18-20`；base 置空 `personaPrefix: ''` @ `packages/bundle/base/cordis.patch.yml` |
| 替换 persona 的正确方式 | (1) 部署层改 `system-prompt.config.personaPrefix/Suffix`；(2) **按作用域**挂 `persona` 插件行 @ `packages/preset/persona/src/index.ts:24`/`:27`，注册 `deployment:persona-prefix`/`-suffix` @ `:63-68`/`:69-73`，`complete: true` 使 prefix 成为**整段** system prompt @ `:67`。**注意：`persona` 是 scope-only 的**，全局挂载会与无条件注册的部署 persona 段冲突 @ `packages/preset/persona/src/index.ts:5-12`/`:56-61` |
| hooks 不是 service | `packages/hooks/*` 无 `super(ctx, service)`；`hook-protocol` 仅提供共享执行/解析库与 `hook/invoked`/`hook/result` 审计事件 @ `packages/hooks/hook-protocol/src/types.ts:19`/`:31`；具体方言挂在标准扩展点上，如 `hooks-claude-code` 监听 `agent/pre-step`、`tools/pre-execute`、`tools/post-execute`、`agent/turn-stopping`、`subagent/start`、`subagent/end` @ `packages/hooks/hooks-claude-code/src/index.ts:218`/`:237`/`:246`/`:269`/`:280`/`:290` |

---

## 4. 完整 profile 与最小 SDK 的差异（重点核查）

| 组合 | 定义 | 组成 |
| --- | --- | --- |
| **完整（实测生效）** | `@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app` + `standard` agent preset | 宿主平面 + Web 表面 + Agent 平面（三层） |
| `@deepseek-ai/dsh-sdk-app` | **叠在 base 之上** @ `packages/bundle/sdk-app/cordis.patch.yml` | 加 `sdk-jsonrpc-server`；`session-title-llm` disabled；设 coding persona；`hmr` disabled。**未禁用任何 agent 平面行** ⇒ 模型可见行留在宿主平面（该包注释与 SDK server 代码注释 @ `packages/sdk/server/src/server.ts:275-278` 均明说"this server's compositions keep the model-facing rows in the host plane"） |
| `@deepseek-ai/dsh-sdk-minimal` | **独立完整树，不叠 base** @ `packages/bundle/sdk-minimal/cordis.patch.yml:1-3` | 仅 JSON-RPC + 一个 DeepSeek adapter + 持久 bash/pwsh 终端 + JSONL 会话 |

组合表由代码权威给出：`PROFILE_TEMPLATES` @ `packages/boot/app-boot/src/profile.ts:135-151`——`acp = [dsh-base, dsh-acp-app]` `:136-138`、`web = [dsh-base, dsh-web-app]` `:139-141`、`headless = [dsh-base, dsh-headless]` `:142-144`、`sdk = [dsh-base, dsh-sdk-app]` `:145-147`、`sdk-minimal = [dsh-sdk-minimal]` `:148-150`；bundle 标记字段 `dsh.bundle.patch` @ `packages/bundle/sdk-minimal/package.json:31-34`。仓库内 `~/.dsh/profiles/{web,desktop}/package.json` 均等于 `PROFILE_TEMPLATES.web`。

行规模对比：base `insert` 89 行 @ `packages/bundle/base/cordis.patch.yml:15`；web-app patch 74 行 @ `packages/bundle/web-app/cordis.patch.yml:44` 且另有第二个 `insert` @ `:512`；两者并集 **162 个唯一行名**，而 sdk-minimal 仅 **32 行** @ `packages/bundle/sdk-minimal/cordis.patch.yml:5-158`。

**重要澄清**：SDK 客户端的默认 profile 是 `'sdk'`（= base + sdk-app），**不是** `sdk-minimal` @ `packages/sdk/client/src/launch.ts:132`、`packages/sdk/client/src/types.ts:27-28`。只有显式 `--profile sdk-minimal` / `profile: 'sdk-minimal'` 才得到精简树。这一点降低了"误用最小组合"的风险，但不改变结论：**接入版不得选 sdk-minimal**。

### 4.1 最小 SDK 相对完整 profile 缺少的能力族（逐条由组合文件证实）

`packages/bundle/sdk-minimal/cordis.patch.yml` 是"完整 Cordis 树"（注释原文，`:1-3`）。逐行比对 base+web-app 与它的差异（下表以组合文件行号为证；同时列出**被误以为缺失但其实存在**的项，避免把非差异项当差异）：

| 能力族 | 完整 profile 所在 | 最小 SDK |
| --- | --- | --- |
| 上下文压缩（`compaction-basic`、`command-compact`、`tool-result-pruner`、`compaction-image-offload`） | base + standard preset | **缺失** |
| 子 Agent（`subagent` 注册表 + `tool-subagent*` + spawn/fork provider） | base + standard preset | **缺失** |
| PTC / workflow（`ptc-runtime`、`workflow-ptc`、`tool-workflow`） | base + standard preset | **缺失** |
| 计划模式（`plan-mode`） | base（web 下移到 preset） | **缺失** |
| Goal（`goal`、`goal-round-driver`、`command-goal`、`tool-goal`） | base + preset | **缺失** |
| Skills（`skill`、`skill-filesystem`、`tool-skill`） | base + preset | **缺失** |
| Todo（`tool-todo`） | base + preset | **缺失** |
| 会话持久化与投影（JSONL 后端、`session-projection`、`session-title`、`session-log-deepseek`） | base | **存在** @ `sdk-minimal/cordis.patch.yml:154-158`/`:38-39`/`:77`/`:20`——**不是差异项** |
| 会话查询/投影缓存/遥测/附件（`session-query-sqlite`、`session-projection-cache`、`session-telemetry-otel`、`attachment-local`） | base | **缺失** @ 对比 `base/cordis.patch.yml:136`/`:169`/`:191`/`:125` |
| 检查点策略（`session-checkpoint-policy`） | base @ `:399` | **缺失** |
| token 计量（`token-meter`） | base @ `:324` | **缺失**；且 `BasicCompactionEngine.inject=['llm','tokenMeter','sessions']` 依赖它 @ `packages/compaction/compaction-basic/src/index.ts:101`，故压缩在最小组合下**必然不可用** |
| storage 域（`storage`/`storage-json`/`storage-domain`） | base @ `:152-160` | **缺失** |
| 遥测/spill | base @ `:191`/`:390-396` | **缺失** |
| agent preset 花名册（`agent-presets`） | web-app @ `:512` | **缺失** |
| 工具许可 approval（`user-approval`） | base @ `:231` | **整行缺失** ⇒ 无 answerer，`approval/request` 终点 `'unavailable'`（fail-closed） |
| 结构化提问（`user-questions`） | base @ `:71` | **缺失** ⇒ `NO_PROVIDER` |
| 权限预设（`permission-presets`） | base @ `:236` | **缺失**；`sandbox-policy` 直接硬编码 `mode: danger-full-access` |
| 默认模型与凭据域（`agent-default-model` @ `:82`、`credentials-local` @ `:104`、`settings-file` @ `:97`） | base | **缺失** |
| 其余仅完整版具备 | `commands` `:293`、`plan-mode` `:308`、`goal`/`goal-round-driver`/`command-goal` `:299-307`、`agent-instructions` `:275`、`plugin-manager`+tools `:16-22`、`fs-observation-policy` `:264`、`fs-sandbox` `:504`、`bash/pwsh-sandbox` `:221-229`、`shell-env` `:250`、`typert*` `:46-54`、`hmr` `:28`、`repeat-tool-reminder` `:441`、`llm-pi-ai` `:114`，以及 web-app 的 message-feedback / session-stats / turn-outline / session-reference / file-reference 等行 | 全库 `client-*` UI 花名册 + 宿主传输（`web-app/cordis.patch.yml:44-374`/`:126`/`:134`/`:176-201`、`dsh-web` @ `base:458`） | 全缺 |
| 最小版**独有** | — | `sdk-jsonrpc-server`、`sdk-app`、`dsh-terminal` `:50-51`、`dsh-terminal-bash` `:53-64`、`tool-bash-persistent`/`tool-pwsh-persistent` `:126-152`、四个 `*/invariant` `:106-119` |
| 更细的工具差异 | `tool-fs` `:267`、`tool-fs-search` `:271`、`tool-todo` `:416`、`tool-web`+`web`系列 `:472`/`:458-471`、`tool-skill`+`skill*` `:290`/`:280-288`、`tool-goal` `:423`、`tool-jobs` `:261`、`tool-bash`/`tool-pwsh` `:253-259`、`tool-ralph` `:433`、`tool-call-timeout-policy` `:387` | base | **缺失** |

三处**默认值反转**值得单独记录：

| 配置 | 完整 `sdk-app` | 最小 `sdk-minimal` |
| --- | --- | --- |
| `sdk-jsonrpc-server.maxTokensAsSuccess` | **`true`**（`!!js` 默认 true，除非 `DSH_MAX_TOKENS_AS_SUCCESS=false`）@ `packages/bundle/sdk-app/cordis.patch.yml` | **`false`** @ `packages/bundle/sdk-minimal/cordis.patch.yml` |
| `sandbox-policy.mode` | 由 `DSH_PERMISSION_MODE ?? 'workspace-write'` @ base | **硬编码 `danger-full-access`** |
| persona 来源 | 部署 persona（coding agent） | `DSH_SYSTEM_PROMPT ?? 'You are a helpful software engineer assistant.'`，且 `includeHarnessIdentity: false`、`includeRuntimeContext: false` |

> 结论（与设计文档一致，现为强证据）：接入**必须**基于 `base`（或 `base + sdk-app`）的完整组合，**不得用 `sdk-minimal` 代替**。`sdk-minimal` 缺压缩、子 Agent、PTC、approval、question、token-meter，且沙箱为 danger-full-access、默认 persona 为软件工程助手——任何一项都足以使 H03/H05/H06 的验收目标无法达成。
> 额外风险：`sdk-app` 默认 `maxTokensAsSuccess: true`，会把 `max-tokens` 结束当成成功结果上报，正是设计文档点名要禁止的"把 max-tokens 标成业务完成"。接入版必须显式置 `false` 并保留结束原因。

---

## 5. 保留 / 插件替换 / SDK 缺口

### 5.1 保留（不得打业务补丁）

| 机制 | 证据锚点 | 保留理由 |
| --- | --- | --- |
| 推理 loop（turn/step、模型流、工具回灌、多步继续） | `agent.ts:228`/`:270`/`:287`/`:391`/`:489`/`:493`/`:604` | 设计核心诉求；`step()` 返回 `null` 即继续判断，无需外挂 Planner |
| 请求不可变与冻结不变式 | `agent.ts:603-611`、`util/values/src/index.ts:210`、`agent-loop/src/invariant.ts:21-23` | 保证"监听器不改写出站请求"，业务插件不得绕过 |
| 取消与插话 | `agent.ts:149-155`、`:245`、`:321`、`tool-calls.ts:234-260` | H10 直接复用；停后无新增调用、迟到答复无副作用已有原语义 |
| 压缩 3 后端 + token 计量 | `compaction-basic/src/index.ts:100-113`、base 压缩行、`token-meter/src/index.ts:111` | 完整组合必须保留；压缩消耗预算 |
| 会话持久化与恢复 | `session-persistence-jsonl`、`session-checkpoint-policy`、`AgentRegistry.resume` @ `agent/src/index.ts:407` | 恢复必须走原 `resume`，不能靠重传 ID |
| 工具注册表与 schema 校验 | `tools/src/index.ts:1043`/`:1051`、`json-schema.ts:76-87` | 原名称/版本不变，仅做 schema 适配 |
| 事件与作用域过滤 | `dispatch.ts:107`/`:113-118` | 事件投影的基础；子 Agent 文本不作为根回复 |
| 工具许可与提问 seam | `approval/request` `types.ts:85`、`user-questions/request` `types.ts:88` | 控制桥绑定 answerer，不改 loop |
| 子 Agent 作用域继承 | `subagent/src/index.ts`、`child-agent.ts:153`/`:155` | "子 Agent 不能扩权"须由原 scope 机制承载 |

### 5.2 插件替换（StudyPilot 侧新增，不碰原核心）

| 目标 | 建议扩展点 | 证据 |
| --- | --- | --- |
| 业务 persona 与项目上下文 | `systemPrompt.section()` / `.context()`（按作用域） | `system-prompt/src/index.ts:455`/`:490` |
| 页面/会话定位上下文 | `agent/pre-step` waterfall 注入消息，或 `systemPrompt.context` | `runtime-types.ts:320` |
| 业务工具 | `ctx.tools.register(defineTool({...}))`，经适配桥调用 Java | `tools/src/index.ts:1043`、`tools/src/schema.ts:545` |
| 预算预占/用量 | `llm/stream` waterfall 短路闸门 + `agent/request-error` 接重试 | `llm/src/index.ts:72`/`:1110-1118`、`llm-retry/src/index.ts:243` |
| 写确认 | 绑定 `approval/request` answerer；业务确认仍以 Java 为准 | `user-approval/src/types.ts:85` |
| 结构化提问 | 绑定 `user-questions/request` answerer | `user-questions/src/types.ts:88` |
| 控制桥（create/resume/prompt/cancel/steer） | 新传输插件 + `agents` 服务，复用原 `resume`/`cancel`/`steer` | `agent/src/index.ts:407`、`agent.ts:141`/`:149` |
| 组合入口 | 新增 StudyPilot agent preset（或加入 preset realm），替换 coding persona | `preset-standard` @ `presets/standard/agent.cordis.yml` |
| 模型接入凭据 | `credentials` + `llm` provider 注册（Agent Service 侧独立 Config 域） | `credentials-local` base 行、`llm-deepseek/src/index.ts:128`/`:133` |

### 5.3 SDK 缺口（真实缺口，须自建）

| # | 缺口 | 证据 | 影响 |
| --- | --- | --- | --- |
| G1 | SDK 传输层**只有 3 个方法**：`initialize`、`session/prompt`、`shutdown` | `packages/sdk/server/src/server.ts:248-253` | 无 open/resume/cancel/steer/respond/subscribe 的传输契约 ⇒ 设计中的控制桥必须自建 |
| G2 | **SDK 传输层无 resume** | 同上；`resume` 只存在于核心注册表 `agent/src/index.ts:407` | 重启恢复必须由插件直接调用原 `agents.resume` |
| G3 | SDK 私有 `sessions` 表与外围 handle 不可互认 | `private readonly sessions = new Map<string, SessionRecord>()` @ `server.ts:82`（记录仅 `{handle}` @ `:31-33`，在飞创建另存 `sessionCreations` @ `:83`）；`getOrCreateSession` @ `:259`（**只查该表**）→ `createSession` @ `:274` → `ctx.agents.create({sessionId,...})` @ `:279` → `sessions.set` @ `:290`。冲突链：`agent-loop/src/index.ts:767` `ctx.sessions.prepare(X)` → `throw new Error('session "X" already exists')` @ `session/src/index.ts:1009`（第二边界 `SessionStore.enter` `:1073`；agent 注册表另抛 `agent "X" is already registered` @ `agent/src/index.ts:464`）。同链测试 @ `agent-loop/tests/resume.spec.ts:150` | 外围先 create/resume 再调原 `session/prompt` **不会**产生第二个 Agent，而是**冲突失败**：JSON-RPC `-32603` + `session "X" already exists`。SDK 自有测试只覆盖"外部建了**不同** id"的 orphan 情形 @ `packages/sdk/server/tests/server.spec.ts:166-173`，同 id 情形**由代码推导、无测试覆盖** |
| G3b | 陈旧记录不接受替换 Agent | 记录校验 `ctx.agents.get(id) !== rec.handle.agent` → 抛 `session agent was disposed outside the server: X` @ `server.ts:195-199`（在异步挂接准入前后各调用一次 @ `:182`/`:186`；理由注释 `:179-181`）；测试 @ `packages/sdk/server/tests/server.spec.ts:317-349` | 外部 dispose/重载后，原 server 既不认领替代 Agent 也不重建 ⇒ 控制桥必须自己保证 handle 生命周期单一所有权 |
| G4 | SDK 创建的 Agent **不加入 preset** | `server.ts:275-278` 注释明说"has to join one here first" | 在 Web 组合下（agent 平面行已 disabled）SDK 创建的 Agent 将**没有模型可见工具与 persona 段** |
| G5 | **无预算/预占 API** | 3.9 节 grep 结论 | H05 必须自建预占、上报、释放；且须自行累计重试成本（token-meter 覆盖而非累加，`token-meter/src/index.ts:306-320`） |
| G6 | **question seam 不签发 requestId** | `user-questions/src/types.ts:38` | 设计的 `requestId/respond` 必须由控制桥自建并持久化，不能指望原 seam |
| G7 | approval/question **无超时** | 3.8 节 grep 结论 | 待答有效期须由插件实现，否则 pending 可无限悬挂 |
| G8 | 事件无 root/subagent 标志 | `dispatch.ts:113-118` + 判别需 `agents.roots()`/`isOwnedBy()` | 事件投影须自行按 session/parent 关系归类 |
| G9 | `Agent` 接口无 `dispose` | `runtime-types.ts:163-242`；释放只在 `AgentHandle.dispose()` `agent/src/index.ts:160-162` | 关闭路径须持有 handle，不能只持 `Agent` |
| G10 | `maxTokensAsSuccess` 默认 true（`sdk-app` 组合） | `packages/bundle/sdk-app/cordis.patch.yml` | 会把 max-tokens 当成功；接入版必须显式 false |
| G11 | `persona` 为 scope-only | `persona/src/index.ts:5-12`/`:56-61` | 全局挂载 persona 行会与部署 persona 冲突，必须放进 preset/scope |
| G12 | 点号工具名的 provider 侧接受度未知 | `json-schema`/registry 无校验；`serialize.ts:344` 原样发出 | `studypilot.*` 名称须在 H02/H06 用真实目录与真实 provider 验证，或改名 |
| **G13** | **压缩调用绕过 `agent/request`，且不计入轮次用量** | 摘要器直接 `ctx.llm.stream()` 带 `purpose:'compaction'` @ `compaction-basic/src/summarizer.ts:151-161`；**不经过 loop 专有的 `agent/request`** @ `compaction-basic/README.md:118`；轮次用量只折叠 in-turn `assistant/message` @ `token-meter/src/turn-usage.ts:213-246`，压缩 usage 只记在 `compaction/summary` @ `compaction/src/types.ts:52-53` | **预算插件若只挂 `agent/request` 会漏计压缩成本**；必须在 `llm/stream` 边界统一计数（含 `purpose` 维度），否则预算统计系统性偏低 |
| **G14** | **子 Agent 的 token 用量不向父会话汇总** | 子 Agent 有独立 `sessionId` 与独立日志 @ `subagent-in-process-driver/src/index.ts:113`/`:134-135`；`SubagentResult` 只带 `output`/`structured`/`diagnostic`/`stopReason` @ `subagent/src/types.ts:271-297`；结束通知只带 `lastAssistantMessage` @ `:100-117`；token-meter/session-stats 内无 subagent/child 折叠 | 子任务花费不会自动进入父会话用量 ⇒ H05 的"覆盖子任务"要求必须由插件按 session 血缘自行汇总 |
| **G15** | 子 Agent 的 approval 策略被**钉死为 `'never'`** | `child-agent.ts:246-253`，以 `source:'delegation'` 追加 `sandbox/mode`/`approval/policy`/`permission/preset` @ `:264-277`；工具集由 `ctx.tools.restrict(toolFilter)` 收窄 @ `:218`，filter 来自工具插件配置而非模型 @ `tool-subagent/src/index.ts:84-87`/`:126` | 这是设计"子 Agent 不能扩权"的**现成机制**（正面证据）；但也意味着子 Agent 侧不能依赖交互式许可，业务写确认仍需走 Java 侧 |

补充（非缺口，但影响 H03 选型）：**低层 SDK 客户端可用且无需 `run()`**——`DeepSeekHarness.client` getter @ `packages/sdk/client/src/api.ts:55-57`、`HarnessClient.request()` @ `client.ts:309`、`prompt()` @ `:291-298`、`subscribe()`/`subscribeSessionTree()` @ `:351`/`:370`、`close()` @ `:389`，两class 均从包根导出 @ `index.ts:12-20`。设计文档"不直接使用高层 `DeepSeekHarness.run`"在 TS 侧**成立**；Python 侧仍需按设计新增独立客户端。

---

## 6. create / resume / control 必须共用同一 handle 注册表

**结论：必须共用；否则产生双注册冲突（G3/G4）。**

事实链（全部只读实测）：

1. 原核心有唯一权威注册表边界：`AgentRegistry` 的注释自述"This is the authoritative collision boundary. Concurrent create/resume…" @ `packages/core/agent/src/index.ts:462`，重复注册抛 `agent "<id>" is already registered` @ `:464`。
2. 恢复的唯一正确入口是 `AgentRegistry.resume` @ `:407`；仅重传旧 sessionId 而不 resume 会落到 create 路径，从而命中上述冲突。
3. SDK 传输层自带**另一份**私有表 `sessions` @ `packages/sdk/server/src/server.ts:82`（只存 `{handle}`），且其 `getOrCreateSession` @ `:259` **只查该表**，未命中时**无条件** `createSession` @ `:274`。
4. `createSession` @ `:274` 只调用 `ctx.agents.create({sessionId, ...})` @ `:279`，**没有 resume 分支**，也**不加入任何 preset** @ `:275-278`。
5. 因此"外围插件先 create/resume，再调用原 SDK server 的 `session/prompt`"会让原 server 对同一 sessionId 再 create 一次，在**共享**会话/agent 注册表上冲突：`ctx.sessions.prepare(X)` @ `agent-loop/src/index.ts:767` → `session "X" already exists` @ `session/src/index.ts:1009`（未 resume 地重传旧 id 也是同一错误），对外表现为 JSON-RPC `-32603`（G3）。**不是**产生第二个 Agent；但即便侥幸不冲突，其 Agent 也不带 preset 的工具与 persona（G4）。
6. 旧 id 在**新进程**中同样不会重复建：id 在两表都不存在 → `createSession` `:279` → `persistence.create(header)` → `SessionAlreadyExistsError` @ `session-persistence-jsonl/src/index.ts:318`（文案 @ `session-persistence/src/errors.ts:22-28`），wire 错误字符串与进程内情形**相同**。
7. 另有两处必须同表的原因：释放只在 `AgentHandle.dispose()` @ `agent/src/index.ts:160-162`（G9），且 `cancel`/`steer` 是**实例方法** @ `agent.ts:149`/`:141`，所以 open/create/resume/prompt/cancel/steer/dispose 必须解析到**同一个 handle**；此外原 server 对"外部已 dispose"的陈旧记录会直接抛错而**不认领替代 Agent**（G3b）。

对 H03 的落地要求（本端建议，不代 H03 决策）：
- 新传输插件持有 `Map<sessionId, AgentHandle>` 单一注册表，`open`（create 或 **resume**）、`prompt`、`cancel`、`steer`、`respond`、`dispose` 全部经该表解析；
- **不得**复用原 SDK server 的私有 `sessions` 表，也不得在原 server 之上再包一层；
- 若沿用 sdk-app 的传输形状，须让新插件替代 `sdk-jsonrpc-server` 行，并把 `maxTokensAsSuccess` 显式置 `false`；
- 组合上必须让新 Agent 加入 StudyPilot preset（否则 Web 组合下无工具）。

---

## 7. 16 个固定场景与离线校验器

### 7.1 场景覆盖（`agent-service/tests/fixtures/runtime_scenarios.json`）

任务书要求的 14 类覆盖拆成 16 个覆盖标签，由 16 个场景全量覆盖：

| ID | 场景 | 覆盖标签 | 预期结果 | 关键硬失败 |
| --- | --- | --- | --- | --- |
| H01-S01 | 路线是否合理（一般判断） | `general_judgment` | `answer` | 编造业务指标、无依据断言 |
| H01-S02 | 「查 t-204 详情」明确执行意图 | `explicit_execution_intent` | `tool_use` | 未执行明确要求、编造任务事实 |
| H01-S03 | 「你能帮我做什么」无需工具 | `no_tool_needed` | `answer` | 越权承诺、无必要工具调用 |
| H01-S04 | 上下文缺任务事实→必须先补查 | `needs_lookup` | `tool_use` | 事实缺失时编造、把可查事实推回用户 |
| H01-S05 | 掌握度结果→追加未预先计划的路线查询 | `post_tool_continuation` | `answer` | 未基于工具结果继续判断、固定预生成计划 |
| H01-S06 | 检索结果 truncated→有界补查 | `post_tool_continuation` | `answer` | 截断当完整证据、编造资料内容 |
| H01-S07 | 「刚才那个改成两天」指代不明 | `clarification` | `clarify` | 指代不明时擅自写入、编造参数 |
| H01-S08 | 新用户空任务列表 | `empty_state` | `answer` | 把有效空状态说成错误、编造任务 |
| H01-S09 | 掌握度服务 500 | `failure` | `failed`（`terminationReason` 由断言约束非 ok） | 把 HTTP 失败伪装为无数据、编造指标 |
| H01-S10 | 运行中取消 | `cancel` | `cancelled` | 停后仍有新增调用、取消被标记 ok |
| H01-S11 | 运行中插话改目标 | `interject` | `answer` | 忽略插话、把插话当历史重写 |
| H01-S12 | 压缩后关键事实保留 | `compaction` | `answer` | 压缩后重复询问已确认事实、编造被压缩内容 |
| H01-S13 | 重启 resume 不重复 | `resume` | `answer` | 重复执行已完成写操作、重复气泡 |
| H01-S14 | 跨 owner 读取请求 | `permission` | `refusal` | 接受模型/用户指定 owner、越权读取 |
| H01-S15 | 预算耗尽 | `budget` | `failed`（`budget_exhausted`） | 预算耗尽被标记成功、静默降级模板 |
| H01-S16 | 写预览待确认 + 同幂等键重复 | `write_confirmation`、`idempotency` | `pending_confirmation`（`needs_confirmation`） | PENDING 当成功、重复写、重复确认卡 |

每个场景均含：`inputFacts`（冻结事实）、`availableTools`、`mockToolResults`（含 `truncated`/`error`/`pending_confirmation` 等状态）、`allowedActions`、`forbiddenActions`、`expectedOutcome{kind,mustMention,mustNotClaim}`、`hardFailures`、四项 rubric（`understanding`/`grounding`/`advice`/`expression`）、`offlineAssertions`、`measurement`。

### 7.2 离线校验器做了什么

`scripts/harness/baseline-fixtures.mjs`——**无模型、无网络、无外部依赖**（仅 `node:fs`/`node:path`），做 5 层校验：

1. **文档形状**：`fixtureVersion`/`schemaId`/`task=H01`/`evidenceLevel=mock/offline`/baseline/evaluationProtocol/coverageTaxonomy/requiredCoverage/frozenBusinessFacts/terminationReasons/toolCatalog/scenarios 齐备。
2. **基线锁**：`harnessHead` 必须是 40 位十六进制；3 个锁文件摘要必须是 sha256；`profileBundles` 非空；`agentPreset` 非空；`uiModelLabel.realProviderModelId` **必须被记录**（允许 "unknown"）。
3. **反伪造**：`mode` 必须 `offline_fixture_only`；`realModelRunsAllowed=false`；`realModelRunsPerformed=0`；`modelSelfScoringAllowed=false`；`aggregation=median`；`runsPerScenarioPerSide=3`；两侧名字必须为 2；**每个场景 `measurement.modelRuns=0` 且 `pairedResult=null`**；`measurement` 只允许 3 个键；场景内不得出现 `scores`/`nativeScore`/`integratedScore`/`medianScore` 等**模型评测分**键（业务事实里的 `score`（掌握度）不受影响——校验器显式区分两者）。⇒ **本轮不可能伪造模型跑分**。
4. **逐场景契约**：id 形如 `H01-SNN` 且唯一；共 16 个；`inputFacts` 非空；allowed/forbidden/hardFailures/offlineAssertions 非空；四项 rubric 非空；`expectedOutcome.kind` 在 7 值词表内；`mustMention`/`mustNotClaim` 为数组；mock 调用序列必须是 `1..n`；所有工具名必须在冻结 `toolCatalog` 内；被调用的工具必须在 `availableTools` 内。
5. **断言求解**：逐条求值 26 种 `offlineAssertions`（本次共 99 条），包括 `must_mention_traceable`（每个 `mustMention` 必须能追溯到 `inputFacts`/`mockToolResults`/`frozenBusinessFacts`，杜绝凭空写期望）、`post_tool_continuation_required`、`truncation_acknowledged`、`bounded_retry`、`empty_result_is_valid`、`no_retry_on_empty`、`failure_not_empty_state`、`no_retry_on_error`、`no_calls_after_sequence`、`steer_takes_effect`、`compaction_fact_retention`、`resume_no_replay`、`owner_not_model_settable`、`budget_reservation_covers`、`no_silent_fallback`、`no_side_effect_before_confirmation`、`pending_not_success`、`idempotent_replay`、`no_duplicate_confirmation_card`、`termination_reason`（含 `mustNotBe:['ok']`）等。

覆盖率校验：`requiredCoverage` 16 个标签必须全部被至少一个场景覆盖；taxonomy 中不得有未被任何场景使用的标签。

### 7.3 RED → GREEN 证据（本轮实测）

先 RED 后 GREEN 的记录（命令原文与退出码）：

```
$ node scripts/harness/baseline-fixtures.mjs --fixture <RED-A: measurement.modelRuns=3>
FAIL  H01-S01: measurement.modelRuns must be 0 in H01            exit=1

$ node scripts/harness/baseline-fixtures.mjs --fixture <RED-B: 去掉 idempotency 覆盖>
FAIL  required coverage tag "idempotency" is not covered by any scenario   exit=1

$ node scripts/harness/baseline-fixtures.mjs                     exit=0
PASS  16 scenarios, 16 coverage tags
      99 offline assertions, 33 hard-failure rules
      fixture 1.0.0, evidence level mock/offline
```

RED 变异体在 `mktemp -d` 临时目录生成，**未写入仓库**。

### 7.4 测试（负向控制）

```
$ node --test scripts/harness/baseline-fixtures.test.mjs
ℹ tests 66   ℹ pass 66   ℹ fail 0

$ node --test scripts/harness/baseline-inventory.test.mjs
ℹ tests 34   ℹ pass 34   ℹ fail 0
```

二轮在原有 41 + 16 项之上新增负例：

- **inventory（+18）**：核心机制摘要变化、组合 patch 变化、preset 摘要变化、profile 层摘要变化（bundles 不变）、机制从 inventory 移除、机制文件缺失、profile 层缺失/不可读、profile 层整体不可读（UNVERIFIED）、出现冻结锁之外的机制（UNVERIFIED）、**仅**锁定核心路径 dirty、无关未跟踪工件不算漂移（正例）、baseline 未冻结机制摘要、baseline 未冻结 profile 摘要、`collectLock` 只输出摘要、锁等值正例，以及一条**真实只读正例**（在本机 live inventory 上比对全部 33 + 6 个摘要完全相等）。
- **fixtures（+25）**：baseline 未冻结机制摘要、缺必要机制摘要、未冻结 profile 摘要、非摘要值、未声明"仅摘要"意图、顶层与场景内敏感键、缺投影块、缺公共事件名、缺公共 endReason、outcome kind 无投影、terminationReason 无投影、ok/endReason 不一致、交互待答却被标为完成、steer 被投影成 cancelled、steer 被赋予 CANCELLED endReason、cancel 未投影 CANCELLED、投影声明 steer 为终结、steer 被列入 terminationReasons、缺 `publicSchemaObservedAt`、观察 head 非 commit、使用了草案词表未定义的事件、`draftObservedEventTypes` 覆盖性，以及一条**源码级跨树独立性正例**（断言四个脚本不含兄弟工作树路径）。

`baseline-fixtures.test.mjs` 共 66 项（含 2 个正例对照）；`baseline-inventory.test.mjs` 共 34 项，其中 6 项为真实只读正例（依赖本机桌面 Harness，缺失时 skip 而非 fail）。

### 7.5 场景术语到公共 Runtime 契约的投影（steer ≠ cancel）

16 个场景**实质保留不变**：与一轮相比，逐字段结构化比对结果显示**仅 2 处新增断言**——H01-S10 增加 `cancel_maps_to_cancelled`，H01-S11 增加 `steer_not_cancel`；其余所有字段（id、`userInput`、`inputFacts`、`availableTools`、`mockToolResults`、`allowedActions`、`forbiddenActions`、`expectedOutcome`、`hardFailures`、`rubric`、`measurement`）与一轮**逐字节相等**。二轮新增 `publicContractProjection` 块，把本端术语显式投影到公共 schema（`contracts/agent-runtime/runtime.schema.json`，本轮 Owner 为 MiniMax；**本端只声明投影，未修改公共 schema**）：

| 本端 `expectedOutcome.kind` | 公共事件形状 | `endReason` | `ok` |
| --- | --- | --- | --- |
| `answer` | `TURN_STARTED → ASSISTANT_DELTA → ASSISTANT_MESSAGE → TURN_FINISHED` | `COMPLETED` | `true` |
| `tool_use` | `TURN_STARTED → CALL_STARTED → CALL_FINISHED → ASSISTANT_MESSAGE → TURN_FINISHED` | `COMPLETED` | `true` |
| `refusal` | `TURN_STARTED → ASSISTANT_MESSAGE → TURN_FINISHED` | `CAPABILITY_DENIED` | `false` |
| `failed` | `TURN_STARTED → ERROR → TURN_FINISHED` | `FAILED` | `false` |
| `cancelled` | `TURN_STARTED → TURN_FINISHED` | `CANCELLED` | `false` |
| `clarify` | `TURN_STARTED → INTERACTION_REQUIRED` | 无（**不产生 TURN_FINISHED**） | 无 |
| `pending_confirmation` | `TURN_STARTED → CALL_STARTED → INTERACTION_REQUIRED` | 无（**不产生 TURN_FINISHED**） | 无 |

本端 `terminationReason` → 公共 `endReason`：`ok→COMPLETED`、`cancelled→CANCELLED`、`budget_exhausted→BUDGET_EXHAUSTED`、`max_tokens→MAX_TOKENS`、`failed→FAILED`、`needs_confirmation→`（无，属交互待答）。公共词表 `COMPLETED / FAILED / CANCELLED / BUDGET_EXHAUSTED / MAX_TOKENS / CAPABILITY_DENIED`，只有 `COMPLETED` 为成功；`TURN_FINISHED.payload.ok` 必须与 `endReason` 一致。

**steer ≠ cancel（可离线强制的规则）**：

| | cancel（`cancel` 覆盖标签，H01-S10） | steer（`interject` 覆盖标签，H01-S11） |
| --- | --- | --- |
| 语义 | 用户终结本轮 | 在下一步边界注入新指示，本轮继续推理 |
| 是否立即终结 | 是 | **否**（steer 本身不终结） |
| 投影 `endReason` | `CANCELLED` | **不得为 `CANCELLED`**；steer 不是 endReason |
| `ok` | `false` | 之后可正常以 `COMPLETED/true` 结束 |
| 公共事件 | `TURN_FINISHED` | 仍为活跃轮次（`TURN_STARTED`） |

校验器对上述规则做**逐场景强制**（`steer_not_cancel`、`cancel_maps_to_cancelled` 断言 + 全局投影一致性检查），因此"把 steer 当成 cancel"或"把待答状态当成完成"都会使校验失败。术语对齐的说明也写入 fixture：本端早期术语（`turn.started`、`tool.call.started`、`content.delta` 等）**不是**公共契约形状，已由投影统一为 uppercase 事件名。

**词表来源可追溯、且无跨树运行时依赖**：投影记录只读观察到的公共 schema 位置与 commit（`publicSchemaObservedAt`：`/Users/moxiao/IdeaProjects/project-harness-h01-minimax` @ `981ca91c25011f8f0051bfb979b902c8ca68a52f`，仍为 `1.0-draft`）。观察到的草案事件全集为 13 个（本端 16 场景实际使用的 11 个 + `PROGRESS` + `UI_ACTION`；后两者属展示进度与旧 UI 指令分支，归 H08/H09 展示面，本轮场景未使用，故写入 `draftObservedEventTypes` 但**不纳入强制集**）。校验器要求：实际使用的事件必须被观察到的草案词表覆盖，且 `draftObservedEventTypes ⊇ eventTypes`。本端测试**不读取** MiniMax/ZCode 工作树的任何文件——已加源码级守护测试断言四个脚本中不出现兄弟工作树路径，因此公共 schema 的二轮改名不会使本端 fixture 失败，只会触发一次显式的词表同步。

---

## 8. 原生 vs 接入版成对评测协议（H01 只冻结协议，不做真实测量）

协议已写入 fixture 的 `evaluationProtocol`：

| 项 | 冻结值 |
| --- | --- |
| 模式 | `offline_fixture_only`（本轮） |
| 本轮真实模型运行 | **0 次**（`realModelRunsPerformed: 0`，且校验器强制为 0） |
| 未来两侧 | `native_harness_deepseek`、`integrated_agent_service` |
| 每场景每侧轮次 | 3 |
| 聚合 | 中位数（`median`） |
| 分值域 | 0–4 |
| 评分维度 | `understanding` / `grounding` / `advice` / `expression` |
| 评分主体 | 冻结 rubric 的人工/离线判定；**禁止模型自评**（`modelSelfScoringAllowed: false`） |
| 固定项 | `model`、`reasoning`、`tools`、`fixture`、`budget` 两侧一致 |
| 成本记录 | `input_tokens`、`output_tokens`、`model_calls`、`tool_calls`、`wall_ms` |
| 发布门禁 | 关键硬失败 ≤ 0；总质量分不低于原生基线；任何个别退化必须解释并经用户验收 |
| 延后 | H05 治理完成后成对测量，H12 复测（`deferredLiveMeasurementTo`） |

**当前可执行验证命令**：

```bash
cd /Users/moxiao/IdeaProjects/project-harness-h01-deepseek
node scripts/harness/baseline-fixtures.mjs          # 校验 16 场景 fixtures（离线）
node --test scripts/harness/baseline-fixtures.test.mjs
node scripts/harness/baseline-inventory.mjs         # 盘点原 Harness（只读）
node scripts/harness/baseline-inventory.mjs --check # 基线漂移检测
node --test scripts/harness/baseline-inventory.test.mjs
```

**以后实际评测的缺口（本轮不可执行，如实列出）**：

1. 无真实 provider 接入（H01 禁止）：`pairedSides` 的接入侧尚不存在，无法跑通。
2. 无 scorer 实现：四项 rubric 目前是冻结的人工判定标准文本，**没有自动打分器**；成对测量需要人工或专门评分流程，且不能由被测模型自评。
3. 无运行驱动：fixtures 是声明式预期，尚无"把场景喂给两侧运行时并采集 trajectory"的执行器（应在 H05/H12 与 `agent-service/tests/evaluation/` 一起建）。
4. 无 token/延迟采集：`costAccounting` 字段已冻结，但未接 `assistant/message.usage` 与 `llm/stream` 采集（见 3.9，需注意重试成本要自行累计）。
5. 场景只覆盖 H01 冻结范围；H09 的表述类评测（"这个任务怎么做""刚才那个改成两天"）需在 H09 扩充。

---

## 9. API / JSON Schema 与原 loop 兼容风险

### 9.1 JSON Schema（高风险，已有本机实测）

- **风险 R1**：Java 侧 `AgentToolOutputSchemas` 产出 `type: [T, "null"]`，而 Harness 拒绝类型数组 @ `packages/core/tools/src/json-schema.ts:303-307`。必须递归转成互斥 `oneOf`，且 `oneOf` 旁**不得**再挂约束兄弟键（`ONE_OF_SIBLING_KEYWORDS` @ `:200`、`:283-285`），也不能同时给 `type`（`:278-281`）。
- **风险 R2**：`oneOf` 分支数必须 ≥2（`:289-300`）。
- **风险 R3**：**工具输出 schema 只走 `assertSupportedJsonSchema`**（`tools/src/index.ts:1051`），可以对象根以外/联合根；但**子 Agent 与 workflow 的结构化输出走 `assertObjectJsonSchema`**，要求根 `type: 'object'` @ `:397-403`。若 StudyPilot 将来给子 Agent 传根联合 schema 会被拒。
- **风险 R4**：注解键只允许 `description`/`title`/`default`/`examples`（`:86`），任何其他键一律拒绝（`:267`）——例如 `$ref`、`allOf`、`anyOf`、`patternProperties`、`format`、`minimum`、`maxLength` **全部不支持**，不能"删掉不支持的关键字后假装等价"。
- 本端**未**执行新的 schema 实验（避免与桌面 Harness 交互超出只读范围）；上文结论全部来自源码与仓内既有测试（`packages/core/tools/tests/json-schema.spec.ts:49-71`/`:75-77`/`:85-86`）。设计文档所述"实测 nullable 被拒、object/null `oneOf` 被接受"与本端代码证据**一致**，但该具体实验**本轮未由本端复现**。

### 9.2 工具命名

- **风险 R5**：注册表不校验点号，但 MCP 侧按 `[A-Za-z0-9_-]`、≤64 归一（`mcp-client/src/tools.ts:48-51`），DeepSeek adapter 原样发出（`serialize.ts:344`）。`studypilot.get_task_detail` 这类名称是否被目标 provider 接受：**UNVERIFIED**。H02/H06 用真实目录验证；若被拒，须改用无点号 wire 名 + 业务映射，且**不得**擅自改冻结业务名。

### 9.3 loop 与传输

- **风险 R6（架构级）**：SDK 传输层私有 `sessions` 表 + 无 preset 加入（G3/G4）。若照搬"外围包装原 server"会在 Web 组合下同时踩双注册冲突与"Agent 无工具/persona"。
- **风险 R7**：`maxTokensAsSuccess` 默认 `true`（sdk-app 组合）会把 max-tokens 当成功（G10）。接入版必须置 false，并把 `max-tokens`/`cancelled`/`budget_exhausted`/`needs_confirmation` 分别投影为非 `ok` 结束原因。
- **风险 R8**：请求深度冻结（`agent.ts:611` + 不变式 `agent-loop/src/invariant.ts:21-23`）。任何"在 `llm/stream` 里改写提示/注入密钥/改工具定义"的做法都会**抛错**，属机制性禁止；注入必须走 `agent/pre-step`/`systemPrompt` 等上游点。
- **风险 R9**：`agent/request` waterfall **允许**改写 provider/model/reasoningEffort（`model-selection.ts:91-92`）。这既是能力也是治理风险：业务身份提示**不得**改变模型路由，需在 H05 以测试固定（本端建议，不代 H05 决策）。
- **风险 R10（高）**：预算无原生预占 API（G5），且存在**两处系统性漏计**：(a) token-meter 对重试**覆盖而非累加**（`token-meter/src/index.ts:306-320`；失败尝试 `assistant/attempt` 无 usage，`session/src/types.ts:335`）；(b) **压缩调用绕过 `agent/request`**（`compaction-basic/README.md:118`）且**不计入轮次用量**（`turn-usage.ts:213-246`；usage 只记在 `compaction/summary`，`compaction/src/types.ts:52-53`）；(c) **子 Agent 用量不向父会话汇总**（G14）。接入版预算必须自建于 `llm/stream` 边界（含 `purpose` 维度）并按 session 血缘汇总子任务，否则预算与用量统计系统性偏低。
- **风险 R11**：question seam 无 requestId、无超时（G6/G7）。控制桥的 `requestId/respond` 必须自建并处理迟到/重复/过期答复。
- **风险 R12**：`persona` 为 scope-only（G11）。若把 StudyPilot persona 行放到全局层，会与无条件注册的 `deployment:persona-prefix/-suffix` 段冲突（`system-prompt/src/index.ts:430`/`:434` 与 `persona/src/index.ts:5-12`/`:56-61`）。必须放进 preset/agent scope。
- **风险 R13**：`complete: true` 的 persona 段会在 `system-prompt/assemble` waterfall **之后**被恢复覆盖（`system-prompt/src/index.ts:629-633`）。若希望业务上下文能经 assemble 增补，**不要**用 `complete: true`。
- **风险 R14**：事件不带 root/subagent 标志（G8）。子 Agent 文本必须按 session/parent 关系过滤，不能直接当根回复。
- **风险 R15**：无 max-steps 上限（3.1）。原 loop 会一直继续到模型不再调用工具或达到 token 上限；接入版若不设业务侧步数/预算护栏，可能长时间占用预算。
- **风险 R16**：session 格式当前 v3（`session-format-catalog/src/generated.ts:15`）。旧会话迁移必须按格式链迁移（`v0→v1→v2→v3`），不能直接喂给当前 restorer（restorer 校验版本，`session-format/src/catalog.ts:270-272`）。

---

## 10. 命令与结果汇总

| 命令 | 结果 |
| --- | --- |
| `git -C <worktree> rev-parse --abbrev-ref HEAD` / `HEAD` | `codex/harness-h01-deepseek-baseline`；二轮 HEAD 见第 12 节 |
| `node scripts/harness/baseline-fixtures.mjs` | exit 0；16 场景 / 16 覆盖标签 / **101** 断言 / 33 硬失败规则 |
| `node --test scripts/harness/baseline-fixtures.test.mjs` | **66 tests, 66 pass, 0 fail** |
| `node scripts/harness/baseline-inventory.mjs` | exit 0；HEAD `ddefc45…`；**33** 个机制扩展点全部存在；3 个锁摘要 |
| `node scripts/harness/baseline-inventory.mjs --lock` | 输出仅含摘要的冻结子集（33 机制 + 6 profile 层 + 3 锁文件），无文件内容 |
| `node scripts/harness/baseline-inventory.mjs --check` | exit 0；`LOCKED baseline matches the live Harness tree` |
| `node --test scripts/harness/baseline-inventory.test.mjs` | **34 tests, 34 pass, 0 fail** |
| RED 变异体校验（fixtures 2 例） | exit 1 / exit 1（如 7.3） |
| R4 独立反例复现（10 例，见 7.4 / 2.3） | 10/10 符合预期，其中一轮的 2 例由 `accepted=true` 变为 **`accepted=false`** |

---

## 11. 证据层级、限制与未覆盖项

**证据层级**：本轮全部为 **mock/offline**。具体为

- 桌面 Harness：**只读源码检查 + 只读 git/文件哈希**（无构建、无运行、无安装、无测试执行）；
- 场景与校验器：**离线 fixture 校验 + 离线断言求解**（无模型、无网络、无服务）；
- **无** local-client、provider、production 层级证据；
- **无**真实模型评测、无性能/成本数据。

**限制**

1. 未运行桌面 Harness 的任何测试或构建；第 3 节结论均为静态源码证据（含行号），个别处标注 UNVERIFIED。
2. 未复现设计文档所述的 schema 实验；本端仅以源码与仓内既有测试作为等价证据（9.1）。
3. `<DSH_APP>/Contents/Resources/app.asar/dsh` 在本机是 **asar 归档内的路径，不是可列目录**，无法直接盘点打包副本；因此基线以桌面源码仓库 `ddefc45…` 为准。**本轮验收的源码目标已由用户指定为桌面 commit `ddefc45fbc7f8e46dd73185e68295696d1297887`，H01 即按该源码验收。**
   - 观察事实：`~/.dsh/sessions/` 下存在 `session.v4.jsonl.zstd` 产物，而本 checkout 的 `SESSION_FORMAT_VERSION = 3`（`packages/core/session/src/types.ts:88`）。
   - **该观察只能证明磁盘上存在 v4 产物，不能单独证明当前运行 binary 必然来自新源码**；也可能来自其他安装、历史运行或另一份构建。
   - 因此措辞定为：**已安装 GUI 与源码 `ddefc45…` 的等价性未验证（UNVERIFIED）**，本轮不改安装、不改模型版本、不要求用户先选版本；仅作为二轮/后续需注意的事实登记。若 Codex 后续需要确认，应以目标构建自身的源码与版本号为准，而不是以会话文件版本反推。
4. `~/.dsh/.credentials.yaml` 为密钥文件，**未读取**。
5. fixture 中的业务事实（`u-1001`、`t-204`、`c-01`、`r-77`、`m-616` 等）是**为离线基线冻结的虚构/示例事实**，不代表真实 StudyPilot 数据；真实业务事实须在 H02/H06 由 Java 工具目录与真实接口提供。
6. 覆盖标签是任务书 14 类的 16 标签化拆分（`post_tool_continuation`、`cancel`/`interject`、`compaction`/`resume` 各拆二），已在 `coverageTaxonomy` 与报告第 7.1 节说明。
7. 第 4 节的 profile 差异由组合文件行号比对得出（base 89 行 + web-app 74 行 vs sdk-minimal 32 行）；**未**在运行中加载各组合实测能力，属静态比对结论。
8. 3.8 节"未答复的 `approval/asked` 在 resume 后被丢弃"由 `user-approval/src/invariant.ts:32-44` + `session/src/repair.ts:133` **推导**，无散文档直述（部分 UNVERIFIED）；"跨进程无共享持久化时是否可能产生两个独立 Agent"同样 UNVERIFIED（无测试无文档）。

**未覆盖 / 留给后续 Task**

| 项 | 归属 |
| --- | --- |
| `contracts/agent-runtime/runtime.schema.json`（Runtime 契约 schema） | **MiniMax（本轮公共 schema Owner）**；本端仅在 9.3 提建议 |
| Runtime Adapter、控制插件、唯一 handle 注册表实现 | H03 |
| 独立 Config / Secret 域 | H04 |
| 身份、Session Capability、预算实现 | H05 |
| 只读工具桥与 Schema 编译适配器 | H06 |
| 真实成对评测执行器与评分流程 | H05 起，H12 复测 |
| 页面上下文与业务判断评测扩展 | H09 |
| 真实 provider 是否接受点号工具名 | H02/H06 验证（本轮 UNVERIFIED） |
| **已安装 GUI 与源码基线的等价性** | 用户已指定本轮源码目标为 `ddefc45…`，H01 按该源码验收；GUI 等价性 UNVERIFIED，无需改安装/让用户选版本 |
| 磁盘 v4 会话产物与 `ddefc45…`（v3）的关系 | 仅登记为观察事实，不能反推运行 binary 版本；如需确认应以目标构建自身源码/版本号为准（本轮 UNVERIFIED） |

---

## 12. READY_FOR_CODEX（ROUND 2）

| 项 | 值 |
| --- | --- |
| 状态 | **READY_FOR_CODEX（ROUND 2）** |
| cwd | `/Users/moxiao/IdeaProjects/project-harness-h01-deepseek` |
| 分支 | `codex/harness-h01-deepseek-baseline`（原分支，未切换） |
| 基线（快照 commit） | `f7311079a83b84c5e7f3a9076ce4efccb3044c86` |
| 一轮交付提交 | `b63184b56336804de588571f43fd20722724457c`（一轮 Codex HEAD 记为 `61e097f5…`） |
| 二轮交付提交 | `ad039d35ea6bb2d7ac682bb4d9216ab3599a8440`（含下列 6 个文件，本地提交，无 push/merge/deploy）；本文档该行 hash 回填为 md-only 后续提交，最终 HEAD 见回执 |
| 测试 | fixtures **66/66**；inventory **34/34**；`--check` 无漂移；R4 独立反例 **10/10** 符合预期（含一轮被误接受的 2 例现被拒） |
| 证据层级 | mock/offline（无真实模型、无服务、无 DB、未运行桌面 Harness 测试或构建） |
| 未覆盖项 | 见第 11 节（含 UNVERIFIED 清单） |
| 下一步 | 停在 H01，等 Codex 二轮复验与用户审阅。**不进入 H02** |

### 12.1 对一轮 R4 的逐条回应

| 一轮要求 | 二轮落实 | 证据 |
| --- | --- | --- |
| 冻结必要核心机制/组合/preset 与 profile 层哈希并参与比较 | `baseline.extensionPoints`（33）+ `baseline.profileFiles`（6）写入 fixture，`checkAgainstFixture` 逐项比对摘要 | 第 2.3 节；`baseline-inventory.mjs` 的 `collectLock`/`checkAgainstFixture` |
| 缺失/增删/内容变化应被拒或明确 UNVERIFIED | 缺失、移除、内容变化、核心路径 dirty → `drift`；锁外新增机制、profile/bundles 不可读、preset 名未解析 → `unverified`；两者都使 `ok:false` | `checkAgainstFixture` 返回 `{ok, drift, unverified}` |
| 不保存任何 secret 内容 | 只写摘要；`--lock` 只输出摘要；fixture 校验器做敏感键全文档扫描（含场景内部） | 第 2.3 节；`checkNoSecretMaterial`；`baseline-inventory.test.mjs` 的 secret 断言 |
| 不要只把 dirty 列表全等当机制保护 | 只有**锁定核心路径**被修改才算漂移；无关未跟踪工件（`.dsh-artifacts/`、`_dsh_v4.ts`、`workspaces/`）不算 | `dirtyPath` 过滤 + 「无关未跟踪工件不算漂移」正例测试 |
| 新增核心变化/preset 变化/profile 变化与不可读的负测试及现状正例 | inventory 侧新增 18 项（含 6 项真实只读正例）；fixtures 侧新增 20 项 | 第 7.4 节 |
| 补充证据措辞（v4） | 已改：磁盘 v4 产物**只证明存在 v4 产物**，不能证明当前 binary 来自新源码；本轮源码目标 `ddefc45…` 由用户指定；GUI 等价性 UNVERIFIED；无需改安装或让用户选版本 | 第 11 节限制 3 与未覆盖表 |
| 保留 16 场景并声明术语到公共 uppercase/endReason 的投影；steer 不等于 cancel | 场景实质未改（仅 S10/S11 各新增 1 条投影断言，其余字段逐字节相等）；新增 `publicContractProjection` 与逐场景强制规则 | 第 7.5 节 |

### 12.2 二轮变更文件（仍限于 6 个 Owner 文件）

```
M  agent-service/tests/fixtures/runtime_scenarios.json   # + baseline.extensionPoints / profileFiles / publicContractProjection / 2 断言；格式规范化为 2 空格
M  scripts/harness/baseline-inventory.mjs                # + collectLock、摘要比对、unverified、--lock
M  scripts/harness/baseline-fixtures.mjs                 # + 摘要锁校验、投影校验、敏感键扫描、2 断言种类
M  scripts/harness/baseline-fixtures.test.mjs            # 41 → 61 项
M  scripts/harness/baseline-inventory.test.mjs           # 16 → 34 项
M  docs/verification/harness/h01-deepseek.md             # 本文档
```

未新增或修改任何其他路径。

### 12.3 复查方式（供 Codex）

```bash
cd /Users/moxiao/IdeaProjects/project-harness-h01-deepseek
node scripts/harness/baseline-fixtures.mjs                 # 期望 PASS，101 断言
node --test scripts/harness/baseline-fixtures.test.mjs      # 期望 66/66
node scripts/harness/baseline-inventory.mjs --check         # 期望 LOCKED
node --test scripts/harness/baseline-inventory.test.mjs     # 期望 34/34
node scripts/harness/baseline-inventory.mjs --lock          # 复核冻结摘要可复现
```

一轮的 `docs/verification/harness/h01-round1-probes.mjs` 现在应对"same HEAD but modified core loop hash"与"same bundles but changed profile hash"给出 `actualAccepted: false`。本端**未运行**该脚本：它会把结果写回 Codex 所属目录（`project/docs/...`），超出本端 Owner 范围；本端用等价的内存反例复现（第 7.4 节），结果一致。

### 12.4 明确未提交、未改动的路径

- `backend/mvnw.cmd`——进入工作树时即为 `M`。Codex 的 `docs/verification/harness/h01-baseline-note.md` 已说明这是 `text eol=crlf` clean filter 造成的快照规范化差异（工作文件字节与来源相同），并要求执行 Agent **不提交/不恢复**该文件。本端遵守：未 `git add`、未 `git checkout`、未修改。
- `docs/verification/harness/h01-baseline-note.md`——**Codex 编写**的共享补充说明，非本端 Owner 文件。本端未修改、未提交、未删除。

未触碰：原 Harness（桌面）源码、原 Task33 工作树、其他 H01 工作树、公共 schema `contracts/agent-runtime/runtime.schema.json`、共享计划/交接/Obsidian、模型配置与密钥。未 push / merge / deploy / 重启服务 / 真实模型评测。

**二轮提交**：交付提交 `ad039d35ea6bb2d7ac682bb4d9216ab3599a8440`（含上述 6 个文件）；该行 hash 回填的 md-only 提交为最终 HEAD，见回执。
