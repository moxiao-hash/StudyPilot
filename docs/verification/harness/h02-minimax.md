# H02 证据与接口约定：MiniMax Code（Round 5 审查整改交付）

状态：**READY_FOR_CODEX**（H02 第五轮审查 R-M11 整改已完成，停止等待 Codex 独立验收）。

## 0. ACKNOWLEDGED（环境与核验基准）

| 项目 | 实际值 |
| --- | --- |
| 工作树 / cwd | `/Users/moxiao/IdeaProjects/project-harness-h02-minimax`（显式进入新树，未在原 Task33 目录操作） |
| 分支 | `codex/harness-h02-minimax` |
| 共同基线 HEAD | `16b37d34c882a17e7bc45c69c84411f28f52bff8` |
| 审查基准 (Round 5) | `a354f5a7f64cf12e795c3482387c7c1d38056386`（实现 `50544d505cefd30fc5550f6247c8175aa0ccb57b`） |
| Codex 审阅意见 | `CHANGES_REQUESTED`（见 `docs/verification/harness/h02-codex-minimax-round5.md` 及 `h02-codex-minimax-round5-extra-probes.json/mjs`） |
| 当前 UI 模型标签 | `MiniMax Code`（系统 prompt 声明）；真实 provider model ID：**未知** |
| 边界遵从 | 离线执行，未 push / merge / deploy，未改动模型配置或密钥，未重启服务，未动数据库，未进入 H03 |

---

## 1. Codex 第五轮审查缺陷与 R-M11 整改清单

### 1.1 R-M11: 正确 root 上下文解析本地 $ref，执行 Schema 形式 additionalProperties，对齐关键字执行与声明
- **本地 $ref 解析与失败关闭**：
  - 在 `validateValueAgainstSchema` 及 `capability-source-verifier.mjs` 中实现 `resolveRef(ref, rootSchema)`：
    - 正确在根模式（如当前工具的 `inputSchema` 或 `outputSchema`）上下文中解析形如 `#/$defs/N` 的本地引用；
    - 严格校验引用格式：必须是以 `#/` 开头的内部路径，对未解析路径（如 `#/$defs/missing`）或非标准格式直接抛出异常拒绝（拦截 `unresolved ref`）；
    - 对引用解析后的目标 Schema 递归执行完整类型与约束校验（拦截 `local ref invalid value`）；
- **执行 Schema 形式的 additionalProperties**：
  - 当 `additionalProperties` 为对象（子 Schema）时，对未在 `properties` 中显式声明的额外字段值递归执行该子 Schema 校验（拦截 `schema additionalProperties` 非法字符串传给 integer 属性）；
  - 当 `additionalProperties` 为布尔值时：`false` 拒绝任何未允许属性，`true` 允许通过；
  - 对任何非法类型（非布尔且非对象）的 `additionalProperties` 在模式检查阶段直接报错失败关闭；
- **编译器与结构验证器行为及关键字盘点完全对齐**：
  - `compile-agent-capabilities.mjs` 与 `capability-source-verifier.mjs` 逻辑完全对齐，白名单内所有 assertion 关键字（`$ref`, `type`, `properties`, `required`, `additionalProperties`, `items`, `enum`, `const`, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `minLength`, `maxLength`, `pattern`, `format`, `minItems`, `maxItems`, `uniqueItems`, `anyOf`, `oneOf`, `allOf`, `not`, `if`, `then`, `else`）均具备真实执行语义，遇到不支持关键字直接拒绝；
  - 修正过往陈述：精准描述当前实现的白名单校验集合，声明与执行严格一致；
  - 增补合法控制用例与非法语义用例，不依赖魔术命名或哨兵硬编码。

---

## 2. RED 证据（整改前 3 项额外探针失败记录）

在整改前运行 Codex 第五轮额外探针 `h02-codex-minimax-round5-extra-probes.mjs`，3 项非法变异探针被接受：
```
✖ local ref invalid value: actual accept (expected reject)
✖ unresolved ref: actual accept (expected reject)
✖ schema additional properties: actual accept (expected reject)
```
在 `scripts/compile-agent-capabilities.test.mjs` 中预先添加对应负例及合法控制断言：
```
✖ negative: compiler rejects local $ref invalid value
✖ negative: compiler rejects unresolved $ref
✖ negative: compiler rejects schema additionalProperties invalid value
✔ control: compiler accepts valid value resolved through local $ref
✔ control: compiler accepts valid value conforming to schema additionalProperties
```

---

## 3. GREEN 证据（整改后）

### 3.1 Codex 第五轮独立探针全量通过（4/4 + 4/4 全绿）
1. **第五轮额外探针（4/4 PASS）**：
   运行 `cd /Users/moxiao/IdeaProjects/project && node docs/verification/harness/h02-codex-minimax-round5-extra-probes.mjs`：
   ```json
   [
     { "name": "latest typed baseline", "expect": "accept", "actual": "accept", "pass": true },
     { "name": "local ref invalid value", "expect": "reject", "actual": "reject", "pass": true, "error": "值类型不匹配: governance.health.get.examples[overall assistant health].input.n->$ref(#/$defs/N) 期望 integer，实际 string" },
     { "name": "unresolved ref", "expect": "reject", "actual": "reject", "pass": true, "error": "未解析的 Schema 引用: #/$defs/missing (在路径 \"$defs\" 无法解析)" },
     { "name": "schema additional properties", "expect": "reject", "actual": "reject", "pass": true, "error": "值类型不匹配: governance.health.get.examples[overall assistant health].input.extra 期望 integer，实际 string" }
   ]
   ```
2. **第五轮基准探针（4/4 PASS）**：
   运行 `cd /Users/moxiao/IdeaProjects/project && node docs/verification/harness/h02-codex-minimax-round5-probes.mjs`：4 项探针全绿。

### 3.2 编译器单元与负例全量测试套件（43/43 PASS）
```bash
$ cd /Users/moxiao/IdeaProjects/project-harness-h02-minimax
$ node --test scripts/compile-agent-capabilities.test.mjs
ℹ tests 43, pass 43, fail 0
```

### 3.3 描述符导出与结构验证测试（6/6 PASS）
- `node --test scripts/harness/capability-source-exporter.test.mjs`: `pass 1, fail 0`
- `node --test scripts/harness/capability-source-verifier.test.mjs`: `pass 5, fail 0`（包含完整结构校验、缺失文件拦截、枚举类型非法拦截、子模式 additionalProperties 违规拦截、本地 $ref 违规拦截）
- `cd backend && ./mvnw -o test -Dtest=HarnessCapabilityDescriptorExportTest`: `BUILD SUCCESS`

### 3.4 H01 存量回归测试（91/91 PASS）
- `node --test scripts/harness/runtime-contract.test.mjs`: `pass 91, fail 0`（H01 冻结运行时契约零退化）

---

## 4. 交付文件清单与提交溯源

- **实现提交 Hash**：`4cc217692e4436abc3c7433ce941efc703fd5368`
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
