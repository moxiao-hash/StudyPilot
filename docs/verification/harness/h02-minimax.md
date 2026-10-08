# H02 证据与接口约定：MiniMax Code（Round 2 审查整改交付）

状态：**READY_FOR_CODEX**（H02 第二轮审查 R-M4 / R-M5 / R-M6 整改已完成，停止等待 Codex 独立验收）。

## 0. ACKNOWLEDGED（环境与核验基准）

| 项目 | 实际值 |
| --- | --- |
| 工作树 / cwd | `/Users/moxiao/IdeaProjects/project-harness-h02-minimax`（显式进入新树，未在原 Task33 目录操作） |
| 分支 | `codex/harness-h02-minimax` |
| 共同基线 HEAD | `16b37d34c882a17e7bc45c69c84411f28f52bff8` |
| 审查基准 (Round 2) | `da3bae15bbc74978b5cff82ef7b26f357bd50837`（实现 `9697dd91b1c7a19fef00396e3c10a68284d00ada`） |
| Codex 审阅意见 | `CHANGES_REQUESTED`（见 `docs/verification/harness/h02-codex-minimax-round2.md` 及 `h02-codex-round2-cross-probes.json/mjs`） |
| 当前 UI 模型标签 | `MiniMax Code`（系统 prompt 声明）；真实 provider model ID：**未知** |
| 边界遵从 | 离线执行，未 push / merge / deploy，未改动模型配置或密钥，未重启服务，未动数据库，未进入 H03 |

---

## 1. Codex 第二轮审查缺陷与 R-M4 / R-M5 / R-M6 整改清单

### 1.1 R-M4: 完整 Schema 深度校验与合法实例约束
- **Schema 约束完整执行**：
  - `validateValueAgainstSchema` 及 verifier 深度执行所有关键字约束：`enum`（枚举包含性检查）、`const`（常量相等性）、`minimum`/`maximum`/`exclusiveMinimum`/`exclusiveMaximum`（数值闭/开区间范围）、`minLength`/`maxLength`/`pattern`（字符串长度与正则匹配）、`minItems`/`maxItems`（数组项数约束）、`additionalProperties: false`（未允许属性拦截）及 `required`（必填属性检测）；
- **占位输出与必填属性强检验**：
  - 移除对 `shape_placeholder` 的整段 output 校验跳过逻辑，所有 `outcome === 'ok'` 的示例 output 必须递归执行完整模式校验；
  - 拦截空对象 `{}` 对有 `required` 约束输出模式的冒充（拦截 `placeholder-empty-required-output`）；
- **对 DeepSeek 非法实例坚决 BLOCKED**：
  - 严格校验输出模式结构，当元数据示例包含未经 Schema 声明的非法属性（例如在 `developer.tests.recommend.output` 根节点出现 `templateType` 属性）时，坚决抛出异常拒绝编译并保持 BLOCKED，不绕过校验；
- **全层级未知字段与类型防护**：
  - 拦截未知嵌套字段：`confirmation`（仅限 `mode`, `waiting_status`, `notes`）、`cost_hint`（仅限 `local`, `external_dependency`, `notes`）、`exposure`（仅限 `state`, `reason`）、`source_provenance`（仅限 `registration`, `handler`, `output_schema`, `unverified_symbols`）、`authoritative_facts`（仅限 `fact`, `meaning`）、`examples`（仅限 `name`, `input`, `output`, `outcome`, `expect`, `fixture_kind`, `error`, `fixture_source`）；
  - `when_to_use` / `when_not_to_use` / `error_contract` 强制校验为非空字符串数组，拦截包含数字等非字符串项（拦截 `non-string-purpose-array`）。

### 1.2 R-M5: 真实源码 Handler 绑定与动态核验（去人工自证）
- **Java 导出端动态解析真实配置**：
  - 重构 `HarnessCapabilityDescriptorExportTest.java`，彻底废除直接读取静态 `tool-bindings.json` 的自证逻辑；
  - 动态读取并解析 `AgentReadToolConfiguration.java`、`AgentWriteToolConfiguration.java` 与 `NavigationToolHandler.java` 源码，提取全部 65 个工具与其调用的服务类及方法（如 `AssistantHealthService.summarize`、`WorkspaceDeveloperService.commitConfirmed` 等），动态生成 `tool-bindings.json` 并附加到导出的 `descriptors.json`；
- **编译器端源码级防伪核验**：
  - 编译器实现 `extractJavaBindings(sourceRoot)`，直接从 Java 源码配置中提取真值绑定映射；
  - 校验描述符必须显式携带 `handler`，当 `d.handler` 缺失时报错拦截（拦截 `missing-exported-binding`）；
  - 校验 `d.handler` 与 `m.source_provenance.handler` 必须在 Java 源码真实绑定表中存在且完全一致，任何虚构绑定（如 `UnregisteredClass.noSuchMethod`）即便描述符与元数据同时伪造也坚决拦截（拦截 `forged-binding-and-metadata-agree`）；
  - 明确证据层级：源码 AST/正则静态语义配对作为契约真值，而非运行时反射调用证明。

### 1.3 R-M6: 严格源码溯源与 CLI 失败关闭
- **显式源码根目录与严禁回退伪造**：
  - 编译器强制检查 Java 源码文件真实存在，缺源码时报错退出（拦截 `missing-java-source-cwd`）；
  - 移除对 Git commit 失败后的硬编码 fallback，非有效 Git 仓库或无法解析 HEAD 时明确报错退出；
  - `manifest.sources` 真实记录当前 Git commit、65 个工具计数、`descriptors_hash`、`metadata_hash` 与核心 Java 配置文件的 `java_source_hash`；
- **CLI 命令行严格解析与跨树隔离**：
  - 支持显式参数 `--descriptors <path>`、`--metadata <path>`、`--output <path>`、`--source-root <path>`；
  - 遇到未知参数或参数缺少对应值时向 stderr 报错并以状态码 1 退出；
  - 移除针对缺失元数据的硬编码跨树 fallback 查找，路径缺失时直接失败关闭。

---

## 2. RED 证据（整改前 9 项测试失败断言）

在 `scripts/compile-agent-capabilities.test.mjs` 中预先添加 9 项针对缺陷场景的断言，整改前全部如期失败：
```
✖ failing tests:
✖ negative: compiler rejects missing exported handler binding in descriptors
✖ negative: compiler rejects forged handler binding not matching Java source truth
✖ negative: compiler enforces enum constraint on example values
✖ negative: compiler enforces minimum constraint on example values
✖ negative: compiler rejects empty object output when required fields are specified
✖ negative: compiler rejects missing cost_hint and exposure
✖ negative: compiler rejects non-string purpose array items
✖ negative: compiler rejects unknown nested fields in confirmation
✖ negative: compiler rejects compilation when Java source files are missing
ℹ tests 26, pass 17, fail 9
```

---

## 3. GREEN 证据（整改后）

### 3.1 编译器单元与负例全量测试套件（26/26 项全部通过）
```bash
$ cd /Users/moxiao/IdeaProjects/project-harness-h02-minimax
$ node --test scripts/compile-agent-capabilities.test.mjs
✔ compiled manifest.json must exist, be deterministically sorted, and contain all 65 tools (2.12ms)
✔ compiler must be deterministic: identical inputs yield identical bytes and hashes (450.72ms)
✔ negative: compiler rejects missing descriptors file (0.22ms)
✔ negative: compiler rejects missing metadata file (0.07ms)
✔ negative: compiler rejects missing tool in metadata (32.67ms)
✔ negative: compiler rejects unknown tool in metadata (33.34ms)
✔ negative: compiler rejects governance conflict (e.g. HIGH risk with confirmation none) (32.01ms)
✔ negative: compiler rejects example input carrying forbidden auth/secret fields (33.01ms)
✔ negative: compiler rejects ok example missing output field (32.82ms)
✔ negative: compiler rejects non-nullable tool having null output for ok example (32.81ms)
✔ negative: compiler rejects missing description (32.59ms)
✔ negative: compiler rejects fictional handler binding (32.51ms)
✔ negative: compiler rejects write tool exposure as allowed (32.61ms)
✔ negative: compiler rejects coding/runner tool exposure as allowed (51.72ms)
✔ negative: compiler rejects fictional authoritative fact (33.88ms)
✔ negative: compiler rejects unknown metadata tool fields (33.82ms)
✔ negative: compiler rejects unknown schema constraint (33.25ms)
✔ negative: compiler rejects missing exported handler binding in descriptors (32.62ms)
✔ negative: compiler rejects forged handler binding not matching Java source truth (32.38ms)
✔ negative: compiler enforces enum constraint on example values (33.43ms)
✔ negative: compiler enforces minimum constraint on example values (33.96ms)
✔ negative: compiler rejects empty object output when required fields are specified (34.59ms)
✔ negative: compiler rejects missing cost_hint and exposure (35.14ms)
✔ negative: compiler rejects non-string purpose array items (34.90ms)
✔ negative: compiler rejects unknown nested fields in confirmation (34.97ms)
✔ negative: compiler rejects compilation when Java source files are missing (0.32ms)
ℹ tests 26, pass 26, fail 0
```

### 3.2 描述符导出与结构验证测试（4/4 项通过）
- `node --test scripts/harness/capability-source-exporter.test.mjs`: `pass 1, fail 0`
- `node --test scripts/harness/capability-source-verifier.test.mjs`: `pass 3, fail 0`（完整递归 Schema 校验、缺失文件拦截、类型/枚举非法拦截）
- `cd backend && ./mvnw -o test -Dtest=HarnessCapabilityDescriptorExportTest`: `BUILD SUCCESS`（从真实 Java 配置源码动态解析出全部 65 项绑定并导出）

### 3.3 H01 存量回归测试（91/91 项全部通过）
- `node --test scripts/harness/runtime-contract.test.mjs`: `pass 91, fail 0`（H01 冻结运行时契约零退化）

### 3.4 Codex 原 13 项独立探针复跑（13/13 全部通过）
运行 `node /Users/moxiao/IdeaProjects/project/docs/verification/harness/h02-codex-minimax-probes.mjs`：13 项探针全绿。

---

## 4. 交付文件清单与提交溯源

- **实现提交 Hash**：`24f4c77646c296a24b35a41924dc8bd07cb3703e`
- **证据提交 Hash**：`<本提交>`
- 分支：`codex/harness-h02-minimax`
- 共同基线：`16b37d34c882a17e7bc45c69c84411f28f52bff8`

交付所有权文件清单（12 项）：
1. `contracts/agent-capabilities/manifest.schema.json`（支持完整多维溯源与 `unverified_symbols` 定义）
2. `contracts/agent-capabilities/README.md`（完整规范与字段说明）
3. `contracts/agent-capabilities/generated/descriptors.json`（带真实源码动态解析 handler 的 65 个 Java 描述符）
4. `contracts/agent-capabilities/generated/tool-bindings.json`（从 Java 源码配置动态提取生成的真值绑定字典）
5. `contracts/agent-capabilities/generated/manifest.json`（确定性编译生成的完整 Manifest，含源码与 commit 真实溯源）
6. `scripts/compile-agent-capabilities.mjs`（确定性编译器，集成 R-M4/R-M5/R-M6 全量校验与真实源码解析）
7. `scripts/compile-agent-capabilities.test.mjs`（编译器单元与正反例测试套件，26 项测试）
8. `scripts/harness/capability-source-exporter.test.mjs`（描述符导出产物测试）
9. `scripts/harness/capability-source-verifier.mjs`（完整递归 Schema 校验器）
10. `scripts/harness/capability-source-verifier.test.mjs`（结构校验器测试套件）
11. `backend/src/test/java/com/moxiao/studypilot/agent/tool/HarnessCapabilityDescriptorExportTest.java`（从 Java 配置源码动态解析并导出测试）
12. `docs/verification/harness/h02-minimax.md`（本证据文档）

工作树保持干净，`backend/mvnw.cmd` 保持基线状态未暂存，未向远端 push，停止等待 Codex 独立验收。
