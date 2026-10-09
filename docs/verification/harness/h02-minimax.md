# H02 证据与接口约定：MiniMax Code（Round 3 审查整改交付）

状态：**READY_FOR_CODEX**（H02 第三轮审查 R-M7 / R-M8 整改已完成，停止等待 Codex 独立验收）。

## 0. ACKNOWLEDGED（环境与核验基准）

| 项目 | 实际值 |
| --- | --- |
| 工作树 / cwd | `/Users/moxiao/IdeaProjects/project-harness-h02-minimax`（显式进入新树，未在原 Task33 目录操作） |
| 分支 | `codex/harness-h02-minimax` |
| 共同基线 HEAD | `16b37d34c882a17e7bc45c69c84411f28f52bff8` |
| 审查基准 (Round 3) | `a34f65f9a033abba571344b27437bec140750f6b`（实现 `24f4c77646c296a24b35a41924dc8bd07cb3703e`） |
| Codex 审阅意见 | `CHANGES_REQUESTED`（见 `docs/verification/harness/h02-codex-minimax-round3.md` 及 `h02-codex-minimax-round3-probes.json/mjs`） |
| 当前 UI 模型标签 | `MiniMax Code`（系统 prompt 声明）；真实 provider model ID：**未知** |
| 边界遵从 | 离线执行，未 push / merge / deploy，未改动模型配置或密钥，未重启服务，未动数据库，未进入 H03 |

---

## 1. Codex 第三轮审查缺陷与 R-M7 / R-M8 整改清单

### 1.1 R-M7: 真实注册集合防伪与导航精确方法（失败关闭）
- **严格基于真实 Java 注册集合校验工具**：
  - 编译器严格比对工具名称是否属于真实 Java 源码配置解析提取的集合，任何未在 Java 源码注册的工具（如双方共同虚构的 `imaginary.query.get` 与 `ImaginaryLearningService.computeEverything`）在合并时坚决失败关闭抛出异常，不再仅依赖字面量黑名单；
- **消除类名模糊匹配，绑定精确到服务方法**：
  - `navigation.resolve` 绑定精确定义为 `NavigationToolHandler.invoke`，移除类名 `NavigationToolHandler` 模糊宽容逻辑；
  - 描述符与元数据若伪造不存在的方法（如 `NavigationToolHandler.imaginaryMethod`），编译立即失败关闭；
- **Java Exporter 源码解析与证据层级**：
  - `HarnessCapabilityDescriptorExportTest.java` 直接解析 3 个 Java 源码配置文件的 AST/方法体，提取所有 65 个工具的准确类与方法；
  - 明确证据层级：源码静态解析映射作为技术真值来源，不依赖生产代码修改。

### 1.2 R-M8: 完整 Schema 深度约束与产物写入前全量验证
- **彻底删除 `<shape-placeholder>` 任何免检特权**：
  - 移除对标量或任意位置 `<shape-placeholder>` 字符串的无条件返回例外，字符串必须符合其所在 Schema 字段的类型（如 integer、number、boolean、object）与约束（如 minimum=1）；
- **完整实现关键字约束并拒绝未实现约束**：
  - `validateValueAgainstSchema` 与 `capability-source-verifier.mjs` 完整实现并执行：`oneOf`（精确匹配 1 个分支）、`anyOf`（至少匹配 1 个分支）、`allOf`（匹配所有分支）、`uniqueItems`（数组元素不重复检查）；
  - 严格校验 `KNOWN_KEYWORDS` 白名单，遇到任何未知或未实现的约束关键字直接抛出异常；
- **元数据必填属性与嵌套类型严格校验**：
  - 严格校验示例必须包含合法的 `outcome`（仅限 `ok` | `rejected` | `unavailable`）；
  - 严格校验 `cost_hint.external_dependency` 必须为 `string` 或 `null`，拦截非法对象/数字；
- **编译产物写入前递归 Schema 全量校验**：
  - 编译器在序列化写入 `manifest.json` 前，先加载并递归校验完整的 `manifest.schema.json`，确保产物完全合规后再写入磁盘。

---

## 2. RED 证据（整改前 7 项探针与单元测试失败记录）

在整改前运行 Codex 第三轮探针 `h02-codex-minimax-round3-probes.mjs`，7 项非法变异探针被接受：
```
✖ unknown jointly added tool
✖ navigation fake method
✖ scalar placeholder bypass
✖ ignored oneOf
✖ ignored uniqueItems
✖ missing example outcome
✖ invalid cost nested type
```
在 `scripts/compile-agent-capabilities.test.mjs` 中预先添加 7 项单元测试，整改前同样全部失败：
```
✖ failing tests:
✖ negative: compiler rejects unknown jointly added tool not in Java real registration set
✖ negative: compiler rejects fake method on navigation.resolve even if class matches
✖ negative: compiler rejects scalar placeholder string violating type or constraint
✖ negative: compiler enforces oneOf constraint on examples
✖ negative: compiler enforces uniqueItems constraint on examples
✖ negative: compiler rejects example missing outcome field
✖ negative: compiler rejects invalid external_dependency type in cost_hint
ℹ tests 33, pass 26, fail 7
```

---

## 3. GREEN 证据（整改后）

### 3.1 Codex 第三轮独立探针全量通过（15/15 PASS）
运行 `cd /Users/moxiao/IdeaProjects/project && node docs/verification/harness/h02-codex-minimax-round3-probes.mjs`：
```json
[
  { "name": "latest typed baseline", "expect": "accept", "actual": "accept", "pass": true },
  { "name": "missing binding", "expect": "reject", "actual": "reject", "pass": true, "error": "工具 governance.health.get 缺少描述符 handler 绑定" },
  { "name": "joint forged known binding", "expect": "reject", "actual": "reject", "pass": true, "error": "工具 governance.health.get 描述符声明了未在 Java 源码中注册的非法 handler: 源码真实绑定为 AssistantHealthService.summarize，实际声明 \"ImaginaryLearningService.computeEverything\"" },
  { "name": "enum", "expect": "reject", "actual": "reject", "pass": true, "error": "值不在枚举允许列表中: governance.health.get.examples[overall assistant health].input.level 值 \"B\" 不在枚举 [A] 中" },
  { "name": "minimum", "expect": "reject", "actual": "reject", "pass": true, "error": "数值低于最小值: governance.health.get.examples[overall assistant health].input.limit 最小值 1，实际 -10" },
  { "name": "cost exposure missing", "expect": "reject", "actual": "reject", "pass": true, "error": "工具 governance.health.get 缺少 cost_hint 定义" },
  { "name": "non-string purpose", "expect": "reject", "actual": "reject", "pass": true, "error": "工具 governance.health.get when_to_use 必须是非空字符串数组" },
  { "name": "nested unknown confirmation", "expect": "reject", "actual": "reject", "pass": true, "error": "工具 governance.health.get confirmation 包含未知字段: unrecognized" },
  { "name": "unknown jointly added tool", "expect": "reject", "actual": "reject", "pass": true, "error": "工具 imaginary.query.get 未在 Java 源码配置中注册，属于非法/虚构工具" },
  { "name": "navigation fake method", "expect": "reject", "actual": "reject", "pass": true, "error": "工具 navigation.resolve 描述符声明了未在 Java 源码中注册的非法 handler: 源码真实绑定为 NavigationToolHandler.invoke，实际声明 \"NavigationToolHandler.imaginaryMethod\"" },
  { "name": "scalar placeholder bypass", "expect": "reject", "actual": "reject", "pass": true, "error": "值类型不匹配: governance.health.get.examples[overall assistant health].input.limit 期望 integer，实际 string" },
  { "name": "ignored oneOf", "expect": "reject", "actual": "reject", "pass": true, "error": "值不满足 oneOf 约束: governance.health.get.examples[overall assistant health].input.limit 匹配分支数 0 (期望 1)" },
  { "name": "ignored uniqueItems", "expect": "reject", "actual": "reject", "pass": true, "error": "数组元素重复，不满足 uniqueItems 约束: governance.health.get.examples[overall assistant health].input.tags 重复项 \"a\"" },
  { "name": "missing example outcome", "expect": "reject", "actual": "reject", "pass": true, "error": "工具 governance.health.get 示例缺少或包含非法的 outcome: undefined" },
  { "name": "invalid cost nested type", "expect": "reject", "actual": "reject", "pass": true, "error": "工具 governance.health.get cost_hint.external_dependency 必须是字符串或 null" }
]
```

### 3.2 编译器单元与负例全量测试套件（33/33 PASS）
```bash
$ cd /Users/moxiao/IdeaProjects/project-harness-h02-minimax
$ node --test scripts/compile-agent-capabilities.test.mjs
ℹ tests 33, pass 33, fail 0
```

### 3.3 描述符导出与结构验证测试（4/4 PASS）
- `node --test scripts/harness/capability-source-exporter.test.mjs`: `pass 1, fail 0`
- `node --test scripts/harness/capability-source-verifier.test.mjs`: `pass 3, fail 0`
- `cd backend && ./mvnw -o test -Dtest=HarnessCapabilityDescriptorExportTest`: `BUILD SUCCESS`

### 3.4 H01 存量回归测试（91/91 PASS）
- `node --test scripts/harness/runtime-contract.test.mjs`: `pass 91, fail 0`（H01 冻结运行时契约零退化）

### 3.5 Codex 原第一轮 13 项探针复跑（13/13 PASS）
- `node /Users/moxiao/IdeaProjects/project/docs/verification/harness/h02-codex-minimax-probes.mjs`: 13 项探针全绿。

---

## 4. 交付文件清单与提交溯源

- **实现提交 Hash**：`727b7b815193759310c3405cc92f050561c42bcb`
- **证据提交 Hash**：`<本提交>`
- 分支：`codex/harness-h02-minimax`
- 共同基线：`16b37d34c882a17e7bc45c69c84411f28f52bff8`

交付所有权文件清单（12 项）：
1. `contracts/agent-capabilities/manifest.schema.json`
2. `contracts/agent-capabilities/README.md`
3. `contracts/agent-capabilities/generated/descriptors.json`
4. `contracts/agent-capabilities/generated/tool-bindings.json`
5. `contracts/agent-capabilities/generated/manifest.json`
6. `scripts/compile-agent-capabilities.mjs`
7. `scripts/compile-agent-capabilities.test.mjs`
8. `scripts/harness/capability-source-exporter.test.mjs`
9. `scripts/harness/capability-source-verifier.mjs`
10. `scripts/harness/capability-source-verifier.test.mjs`
11. `backend/src/test/java/com/moxiao/studypilot/agent/tool/HarnessCapabilityDescriptorExportTest.java`
12. `docs/verification/harness/h02-minimax.md`

工作树保持干净，`backend/mvnw.cmd` 保持基线未修改状态不暂存，未向远端 push，停止等待 Codex 独立验收。
