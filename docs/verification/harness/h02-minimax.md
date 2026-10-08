# H02 证据与接口约定：MiniMax Code（Round 2 整改交付）

状态：**READY_FOR_CODEX**（H02 首轮验收整改已完成，停止等待 Codex 独立验收）。

## 0. ACKNOWLEDGED（环境与核验基准）

| 项目 | 实际值 |
| --- | --- |
| 工作树 / cwd | `/Users/moxiao/IdeaProjects/project-harness-h02-minimax`（显式进入新树，未在原 Task33 目录操作） |
| 分支 | `codex/harness-h02-minimax` |
| 共同基线 HEAD | `16b37d34c882a17e7bc45c69c84411f28f52bff8` |
| 审查基准 (Round 1) | `ebb6f2b95563d71f6a43ac65b1c56bf3f59b31d5`（实现 `d3d20440ba5035245f7c8835226e077b2605483e`） |
| Codex 审阅意见 | `CHANGES_REQUESTED`（见 `docs/verification/harness/h02-codex-minimax-round1.md` 及 `h02-codex-minimax-probes.json`） |
| 当前 UI 模型标签 | `MiniMax Code`（系统 prompt 声明）；真实 provider model ID：**未知** |
| 边界遵从 | 离线执行，未 push / merge / deploy，未改动模型配置或密钥，未重启服务，未动数据库，未进入 H03 |

---

## 1. Codex 首轮审查缺口与 R-M1 / R-M2 / R-M3 整改清单

Codex 独立验收在 `docs/verification/harness/h02-codex-minimax-round1.md` 中指出了第一轮交付的 3 大类阻塞问题（共 12 项失败探针），现已全部整改：

### 1.1 R-M1: 完整 Schema 与示例校验
- **缺失字段与类型检查**：校验器严格要求所有必填字段（包括 `description`、`when_to_use`、`when_not_to_use`、`error_contract` 等），拒绝空字符串、空数组或缺失项；
- **元数据未知字段拦截**：元数据工具项仅允许 11 个标准字段，拦截任何未声明属性（如 `inventedField`）；
- **未知 Schema 约束拦截**：递归检查 `d.inputSchema` 与 `d.outputSchema` 的所有约束关键字，拦截任何非法或非标准关键字（如 `inventedConstraint`）；
- **示例输入/输出强类型校验**：
  - `example.input` 依据 `d.inputSchema` 进行严格类型校验与 `additionalProperties: false` 拦截（拦截非法参数如 `illegalUnknownParameter: 42`）；
  - `example.output` 依据 `d.outputSchema` 校验类型（当模式期望对象/数组时，拦截非法基础类型如数字 `42`）；
  - 递归深度扫描 `example.input` 与 `example.output`，拦截任何嵌套的私有/鉴权字段（如 `params: { ownerId: 123 }`）；
- **结构校验器类型与枚举断言**：`capability-source-verifier.mjs` 增补深度校验，严格验证 `version`（必须为 `>= 1` 整数）、`exposure.state`（枚举）、`side_effect`、`confirmation` 等字段类型与枚举。

### 1.2 R-M2: 来源绑定与治理/业务边界
- **真实 Handler 绑定校验**：
  - Java 离线测试 `HarnessCapabilityDescriptorExportTest` 读取真实工具绑定并将其作为 `handler` 属性导出到 `descriptors.json`；
  - 编译器严格校验元数据中的 `source_provenance.handler` 必须精确匹配真实绑定的服务类与方法（如 `AssistantHealthService.summarize`），坚决拦截虚构绑定（如 `NonexistentService.nonexistent`）；
- **治理与曝光红线拦截**：
  - H02 阶段严格禁止写工具开放：当 `effect === 'WRITE'` 且 `exposure.state === 'allowed'` 时抛出异常拦截；
  - H02 阶段默认禁用 coding/runner 工具：当工具名匹配 `^(developer|runner)\.` 且 `exposure.state === 'allowed'` 时抛出异常拦截；
- **权威事实真实性校验**：
  - 递归提取 `d.outputSchema` 中定义的所有合法属性名称；
  - 严格校验 `authoritative_facts[].fact` 必须存在于该工具输出契约中，拦截虚构事实（如 `inventedField`）。

### 1.3 R-M3: 确定性、溯源与 CLI
- **默认确定性时间戳**：
  - 移除运行时时钟 `new Date().toISOString()` 对编译结果的不稳定性影响；
  - 默认未传固定时间戳时，根据 `descriptorsHash` 与 `metadataHash` 计算确定性时间偏移，保证同一输入默认编译两次产物字节 100% 相同；
- **多维溯源绑定**：
  - `manifest.sources` 绑定 `descriptor_count` (65)、`descriptors_hash`、`metadata_hash`、`java_source_hash`（4 个 Java 工具配置核心文件的 SHA-256）与 `commit`（当前 Git HEAD Hash）；
  - `manifest.schema.json` 同步扩充 `sources` 契约定义；
- **CLI 命令行参数与错误退出**：
  - `compile-agent-capabilities.mjs` 接收显式参数 `--descriptors <path>`、`--metadata <path>`、`--output <path>`；
  - 缺失或非法输入时向 stderr 输出错误并以非零状态码（exit 1）退出。

---

## 2. RED 证据（首轮验收独立探针失败记录）

Codex 独立探针 `h02-codex-minimax-probes.mjs` 在首轮审查（`ebb6f2b9`）运行结果呈现 12 项失败：
```json
[
  { "name": "baseline", "expected": "accept", "actual": "accept", "pass": true },
  { "name": "missing-description", "expected": "reject", "actual": "accept", "pass": false },
  { "name": "fictional-binding", "expected": "reject", "actual": "accept", "pass": false },
  { "name": "invalid-input", "expected": "reject", "actual": "accept", "pass": false },
  { "name": "invalid-output", "expected": "reject", "actual": "accept", "pass": false },
  { "name": "nested-owner", "expected": "reject", "actual": "accept", "pass": false },
  { "name": "write-enabled", "expected": "reject", "actual": "accept", "pass": false },
  { "name": "coding-enabled", "expected": "reject", "actual": "accept", "pass": false },
  { "name": "fictional-fact", "expected": "reject", "actual": "accept", "pass": false },
  { "name": "unknown-metadata-field", "expected": "reject", "actual": "accept", "pass": false },
  { "name": "unknown-schema-constraint", "expected": "reject", "actual": "accept", "pass": false },
  { "name": "default-determinism", "expected": "identical", "actual": "different", "pass": false },
  { "name": "verifier-types-and-enums", "expected": "reject", "actual": "accept", "pass": false }
]
```

---

## 3. GREEN 证据（整改后）

### 3.1 Codex 独立探针复跑全量通过（13/13 PASS）
运行 `node /Users/moxiao/IdeaProjects/project/docs/verification/harness/h02-codex-minimax-probes.mjs`：
```json
[
  { "name": "baseline", "expected": "accept", "actual": "accept", "pass": true },
  { "name": "missing-description", "expected": "reject", "actual": "reject", "pass": true, "error": "工具 governance.health.get 缺少非空 description" },
  { "name": "fictional-binding", "expected": "reject", "actual": "reject", "pass": true, "error": "工具 governance.health.get 来源绑定错误: 期望绑定 AssistantHealthService.summarize，实际声明 \"NonexistentService.nonexistent\"" },
  { "name": "invalid-input", "expected": "reject", "actual": "reject", "pass": true, "error": "对象包含未允许属性: governance.health.get.examples[overall assistant health].input.illegalUnknownParameter" },
  { "name": "invalid-output", "expected": "reject", "actual": "reject", "pass": true, "error": "工具 learning.context.get 示例输出类型错误: 期望 object，实际 number" },
  { "name": "nested-owner", "expected": "reject", "actual": "reject", "pass": true, "error": "示例数据包含被禁止的鉴权/隐私字段: governance.health.get.examples[overall assistant health].input.params.ownerId" },
  { "name": "write-enabled", "expected": "reject", "actual": "reject", "pass": true, "error": "工具 artifacts.submit (effect=WRITE) 在 H02 阶段必须禁用，禁止 exposure.state=allowed" },
  { "name": "coding-enabled", "expected": "reject", "actual": "reject", "pass": true, "error": "工具 runner.check.run (effect=WRITE) 在 H02 阶段必须禁用，禁止 exposure.state=allowed" },
  { "name": "fictional-fact", "expected": "reject", "actual": "reject", "pass": true, "error": "工具 governance.health.get 声明了未在 outputSchema 中存在的权威事实: inventedField" },
  { "name": "unknown-metadata-field", "expected": "reject", "actual": "reject", "pass": true, "error": "元数据工具 governance.health.get 包含未知字段: inventedField" },
  { "name": "unknown-schema-constraint", "expected": "reject", "actual": "reject", "pass": true, "error": "Schema 包含未知约束关键字: artifacts.evaluate.inputSchema.inventedConstraint" },
  { "name": "default-determinism", "expected": "identical", "actual": "identical", "pass": true },
  { "name": "verifier-types-and-enums", "expected": "reject", "actual": "reject", "pass": true }
]
```

### 3.2 编译器单元与正反例测试套件（17/17 项全部通过）
```bash
$ cd /Users/moxiao/IdeaProjects/project-harness-h02-minimax
$ node --test scripts/compile-agent-capabilities.test.mjs
✔ compiled manifest.json must exist, be deterministically sorted, and contain all 65 tools (2.00ms)
✔ compiler must be deterministic: identical inputs yield identical bytes and hashes (453.15ms)
✔ negative: compiler rejects missing descriptors file (0.24ms)
✔ negative: compiler rejects missing metadata file (0.06ms)
✔ negative: compiler rejects missing tool in metadata (27.32ms)
✔ negative: compiler rejects unknown tool in metadata (27.91ms)
✔ negative: compiler rejects governance conflict (e.g. HIGH risk with confirmation none) (26.95ms)
✔ negative: compiler rejects example input carrying forbidden auth/secret fields (28.74ms)
✔ negative: compiler rejects ok example missing output field (28.19ms)
✔ negative: compiler rejects non-nullable tool having null output for ok example (27.52ms)
✔ negative: compiler rejects missing description (27.86ms)
✔ negative: compiler rejects fictional handler binding (28.44ms)
✔ negative: compiler rejects write tool exposure as allowed (27.15ms)
✔ negative: compiler rejects coding/runner tool exposure as allowed (27.74ms)
✔ negative: compiler rejects fictional authoritative fact (27.44ms)
✔ negative: compiler rejects unknown metadata tool fields (26.99ms)
✔ negative: compiler rejects unknown schema constraint (27.52ms)
ℹ tests 17
ℹ suites 0
ℹ pass 17
ℹ fail 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 858.65ms
```

### 3.3 描述符导出与结构验证测试（4/4 项通过）
- `node --test scripts/harness/capability-source-exporter.test.mjs`: `pass 1, fail 0`
- `node --test scripts/harness/capability-source-verifier.test.mjs`: `pass 3, fail 0`（覆盖合法结构校验、缺失文件拦截、非整型版本拦截、非法状态枚举拦截）
- `node --test scripts/harness/runtime-contract.test.mjs`: `pass 91, fail 0`（H01 冻结契约零退化）
- `cd backend && ./mvnw -o test -Dtest=HarnessCapabilityDescriptorExportTest`: `BUILD SUCCESS`（成功导出 65 个工具带真实绑定描述符）

---

## 4. 交付文件清单与提交溯源

- **实现提交 Hash**：`9697dd91b1c7a19fef00396e3c10a68284d00ada`
- **证据提交 Hash**：`<本提交>`
- 分支：`codex/harness-h02-minimax`
- 共同基线：`16b37d34c882a17e7bc45c69c84411f28f52bff8`

交付所有权文件：
1. `contracts/agent-capabilities/manifest.schema.json`（支持完整多维溯源来源字段）
2. `contracts/agent-capabilities/README.md`（能力目录规范与契约约定）
3. `contracts/agent-capabilities/generated/descriptors.json`（带真实 handler 绑定的 65 个 Java 描述符）
4. `contracts/agent-capabilities/generated/tool-bindings.json`（Java 真实绑定事实字典）
5. `contracts/agent-capabilities/generated/manifest.json`（确定性编译生成的完整 Manifest，含源码与 commit 溯源）
6. `scripts/compile-agent-capabilities.mjs`（确定性编译器，含完整 R-M1/R-M2/R-M3 校验）
7. `scripts/compile-agent-capabilities.test.mjs`（编译器单元与正反例测试套件，17 项测试）
8. `scripts/harness/capability-source-exporter.test.mjs`（描述符导出产物测试）
9. `scripts/harness/capability-source-verifier.mjs` / `capability-source-verifier.test.mjs`（结构与类型枚举校验脚本及测试）
10. `backend/src/test/java/com/moxiao/studypilot/agent/tool/HarnessCapabilityDescriptorExportTest.java`（离线描述符导出测试类）
11. `docs/verification/harness/h02-minimax.md`（本证据文档）

工作树保持干净，`backend/mvnw.cmd` 未触碰未暂存，未向远端 push，停止等待 Codex 独立验收。
