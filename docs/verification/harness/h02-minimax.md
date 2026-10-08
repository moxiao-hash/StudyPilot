# H02 证据与接口约定：MiniMax Code

状态：**READY_FOR_CODEX**（交付完成，停止等待 Codex 独立验收）。

## 0. ACKNOWLEDGED（开工状态）

| 项目 | 实际值 |
| --- | --- |
| 工作树 / cwd | `/Users/moxiao/IdeaProjects/project-harness-h02-minimax`（显式进入，未在原 Task33 目录操作） |
| 分支 | `codex/harness-h02-minimax` |
| 共同基线 HEAD | `16b37d34c882a17e7bc45c69c84411f28f52bff8` |
| 任务书与共享约定 | 已读 `/Users/moxiao/IdeaProjects/project/docs/dispatch/h02-minimax.md`、`h02-shared.md` |
| 当前 UI 模型标签 | `MiniMax Code`（真实 provider model ID：未知） |
| 边界遵从 | 离线执行，未 push / merge / deploy，未改动模型配置或密钥，未重启服务，未动数据库，未进入 H03 |

---

## 1. 供另两端读取的 Manifest Schema 与输入字段约定

MiniMax Code 已创建并独占发布：
- `contracts/agent-capabilities/manifest.schema.json`（遵循 JSON Schema Draft 2020-12，严格封闭，无类型数组）
- `contracts/agent-capabilities/README.md`（约定与架构分工）

### 1.1 输入元数据 `metadata.yaml` 约定（供 DeepSeek 落盘核对）

DeepSeek Harness 提供的 `contracts/agent-capabilities/metadata.yaml` 包含顶层 `tools: [...]`，每个工具提供：
1. `name`: string，必须完全匹配 Java wire name（共 65 个）。
2. `description`: string，功能描述。
3. `when_to_use`: string[]，适用场景说明（至少 1 条）。
4. `when_not_to_use`: string[]，避免使用场景（至少 1 条）。
5. `error_contract`: string[]，错误契约与边界说明（至少 1 条）。
6. `cost_hint`: object，包含 `local` (boolean), `external_dependency` (string|null), `notes` (string)。
7. `exposure`: object，包含 `state` (`allowed` | `disabled` | `pending`) 与 `reason` (string)。
8. `authoritative_facts`: object[]（可选），包含 `fact` 与 `meaning`。
9. `examples`: object[]（至少 1 条），包含 `name`, `input` (object), `expect` (string), `outcome` (`ok` | `rejected` | `unavailable`)。对于 `outcome: "ok"` 的示例，必须显式提供 `output` 字段；仅声明为可空的工具允许输出 `output: null`。
10. `source_provenance`: object，包含 `registration`, `handler`, `output_schema`。
11. `confirmation`: object，包含 `mode` (`none` | `always_user_confirmation` | `conditional_scope_grant`), `waiting_status` (`WAITING_CONFIRMATION` | `WAITING_AUTHORIZATION` | null), `notes` (string)。

严禁在 `metadata.yaml` 中手写重复 `input_schema` 或 `output_schema`，技术真值全部由编译器从 Java 真实描述符注入。

### 1.2 编译输出 `generated/manifest.json` 结构约定（供 ZCode 独立消费核对）

单体 JSON 文档结构：
- `manifest_version`: `"1.0-draft"`
- `generated_at`: ISO-8601 UTC 瞬时字符串
- `sources`: `{ descriptor_count: 65, descriptors_hash, metadata_hash }`
- `tools`: 包含 65 个条目的数组（按 `name` 严格升序排序），每项合并 Java 事实与元数据，包含：
  - `name`, `version`, `category`, `description`
  - `when_to_use`, `when_not_to_use`
  - `input_schema`, `output_schema`（完全来自 Java 真实描述符，闭合且无损）
  - `side_effect`: `{ effect, risk_level, mutates_business_data }`
  - `permission`: `{ required_scope, scope_required }`
  - `confirmation`: `{ mode, waiting_status, notes }`
  - `idempotency`: `{ required }`
  - `timeout_ms`
  - `error_contract`, `cost_hint`, `exposure`, `authoritative_facts`, `examples`, `source_provenance`

---

## 2. Java 真实描述符离线导出

- 实施类：`backend/src/test/java/com/moxiao/studypilot/agent/tool/HarnessCapabilityDescriptorExportTest.java`
- 机制：注入 Spring 上下文中的 `AgentToolRegistry`，读取真实 `catalog()` 导出的 65 个工具描述符，按工具名称升序确定性排序，序列化输出至 `contracts/agent-capabilities/generated/descriptors.json`。
- 纯离线执行：不调用任何 handler，不启动网络端口，不操作生产数据库。
- 产物 SHA-256：`96bdb19adbe689deace5ff7f1311ef73ae5b836bbc79be22878673e4432cc0e2`

---

## 3. 确定性编译器与正反例测试

- 编译器脚本：`scripts/compile-agent-capabilities.mjs`
  - 依赖仅限于 Node.js 内置模块（利用本机 Python 解析 YAML，零 npm 第三方依赖）。
  - 双向完整性检查：确保描述符与元数据中的 65 个工具 1:1 严格对齐，任何多余未知工具或遗漏工具均抛出异常退出。
  - 治理规则一致性强校验：
    - HIGH 风险必须对应 `always_user_confirmation` 与 `WAITING_CONFIRMATION`；
    - READ / NAVIGATE 必须对应 `none` 与 `null`；
    - LOW 风险带 scope 必须对应 `conditional_scope_grant` 与 `WAITING_AUTHORIZATION`。
  - 鉴权防泄漏检查：示例 `input` 严禁出现 `ownerId`, `apiKey`, `secret` 等敏感鉴权字段。
  - 输出字段存在性检查：`outcome: "ok"` 的示例必须显式提供 `output` 字段，且仅可空工具才允许输出 `null`。
  - 确定性排序输出：工具按 `name` 严格排序，输出标准 JSON 格式。
- 测试套件：
  1. `scripts/harness/capability-source-exporter.test.mjs`（1 项测试通过）
  2. `scripts/compile-agent-capabilities.test.mjs`（10 项测试通过，包含确定性哈希一致性测试与 8 项负例拦截测试）
  3. `scripts/harness/capability-source-verifier.mjs` / `.test.mjs`（2 项结构合规校验通过）
  4. H01 存量回归：`scripts/harness/runtime-contract.test.mjs`（91 项全绿无破坏）

---

## 4. 验证命令与结果汇总

```bash
# 1. 导出真实 Java 描述符
cd backend && ./mvnw -o test -Dtest=HarnessCapabilityDescriptorExportTest
# 结果: BUILD SUCCESS (1/1 passed)

# 2. 描述符导出有效性测试
node --test scripts/harness/capability-source-exporter.test.mjs
# 结果: pass 1, fail 0

# 3. 编译器及正反例全量测试
node --test scripts/compile-agent-capabilities.test.mjs
# 结果: pass 10, fail 0

# 4. 结构合规与 Schema 验证
node --test scripts/harness/capability-source-verifier.test.mjs
# 结果: pass 2, fail 0

# 5. H01 Runtime 契约回归
node --test scripts/harness/runtime-contract.test.mjs
# 结果: pass 91, fail 0
```

---

## 5. 交付文件清单与提交溯源

- **实现提交 Hash**：`d3d20440ba5035245f7c8835226e077b2605483e`
- **证据提交 Hash**：`<本提交>`
- 分支：`codex/harness-h02-minimax`
- 基线：`16b37d34c882a17e7bc45c69c84411f28f52bff8`

交付所有权文件：
1. `contracts/agent-capabilities/manifest.schema.json`
2. `contracts/agent-capabilities/README.md`
3. `contracts/agent-capabilities/generated/descriptors.json`
4. `contracts/agent-capabilities/generated/manifest.json`
5. `scripts/compile-agent-capabilities.mjs`
6. `scripts/compile-agent-capabilities.test.mjs`
7. `scripts/harness/capability-source-exporter.test.mjs`
8. `scripts/harness/capability-source-verifier.mjs`
9. `scripts/harness/capability-source-verifier.test.mjs`
10. `backend/src/test/java/com/moxiao/studypilot/agent/tool/HarnessCapabilityDescriptorExportTest.java`
11. `docs/verification/harness/h02-minimax.md`

`backend/mvnw.cmd` 保持基线未修改状态不提交，无未跟踪文件污染。未向远端 push，停止等待 Codex 独立验收。
