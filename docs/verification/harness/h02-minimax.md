# H02 证据与接口约定：MiniMax Code（Round 4 审查整改交付）

状态：**READY_FOR_CODEX**（H02 第四轮审查 R-M9 / R-M10 整改已完成，停止等待 Codex 独立验收）。

## 0. ACKNOWLEDGED（环境与核验基准）

| 项目 | 实际值 |
| --- | --- |
| 工作树 / cwd | `/Users/moxiao/IdeaProjects/project-harness-h02-minimax`（显式进入新树，未在原 Task33 目录操作） |
| 分支 | `codex/harness-h02-minimax` |
| 共同基线 HEAD | `16b37d34c882a17e7bc45c69c84411f28f52bff8` |
| 审查基准 (Round 4) | `6c2b7e90e33c6a877b7d4464da3c1f455997307a`（实现 `727b7b815193759310c3405cc92f050561c42bcb`） |
| Codex 审阅意见 | `CHANGES_REQUESTED`（见 `docs/verification/harness/h02-codex-minimax-round4.md` 及 `h02-codex-minimax-round4-extra-probes.json/mjs`） |
| 当前 UI 模型标签 | `MiniMax Code`（系统 prompt 声明）；真实 provider model ID：**未知** |
| 边界遵从 | 离线执行，未 push / merge / deploy，未改动模型配置或密钥，未重启服务，未动数据库，未进入 H03 |

---

## 1. Codex 第四轮审查缺陷与 R-M9 / R-M10 整改清单

### 1.1 R-M9: 真实注册集合与描述符/元数据双向完全相等（防协同删除）
- **严格双向相等核对**：
  - 编译器不仅检查输入条目是否都在已注册集合中，还强制检查描述符集合与元数据集合必须与 Java 源码真实注册的 65 个工具集合完全双向一致；
  - 任何试图同时从描述符与元数据中删除真实工具（如双方协同删除 `governance.health.get`）的行为均被捕获并失败关闭，报错 `描述符遗漏了 Java 源码中已注册的工具`（彻底拦截 `descriptor omission`）；
  - 双方共同添加未注册工具的行为同样被双向拦截，报错 `未在 Java 源码配置中注册`。

### 1.2 R-M10: 完整 Schema 深度约束（not / if-then / boolean schema）与产物校验失败关闭
- **执行 not / if-then / boolean false 约束**：
  - `validateValueAgainstSchema` 与 `capability-source-verifier.mjs` 完整实现并执行：
    - `not`: 匹配成功即抛出 `值违反 not 约束`（拦截 `not constraint`）；
    - `if` / `then` / `else`: 条件匹配成功时递归应用 `then`，失败时递归应用 `else`（拦截 `conditional then constraint`）；
    - 布尔 Schema `false`: 明确拒绝任何提供的属性值（拦截 `false property schema`）；
  - 绝不因关键字在 allowlist 中而静默忽略，所有已声明的约束必须真实执行；
- **缺失 manifest.schema.json 失败关闭**：
  - 移除对模式文件缺失时的静默跳过 `existsSync` 逻辑，若 `manifest.schema.json` 契约定义文件不存在，编译器直接报错退出；
  - 在写入磁盘前对最终生成的单体 Manifest 进行完整递归 Schema 校验。

---

## 2. RED 证据（整改前 4 项额外探针与单元测试失败记录）

在整改前运行 Codex 第四轮额外探针 `h02-codex-minimax-round4-extra-probes.mjs`，4 项非法变异探针被接受：
```
✖ not constraint: actual accept (expected reject)
✖ conditional then constraint: actual accept (expected reject)
✖ false property schema: actual accept (expected reject)
✖ descriptor omission: actual accept (expected reject)
```
在 `scripts/compile-agent-capabilities.test.mjs` 中预先添加对应单元测试，整改前同样全部失败：
```
✖ negative: compiler rejects not constraint violation in example input
✖ negative: compiler rejects conditional if-then constraint violation in example input
✖ negative: compiler rejects boolean schema false for property when provided
✖ negative: compiler rejects omission of registered tool even if descriptors and metadata both omit it
✖ negative: compiler fails closed when manifest.schema.json is missing
ℹ tests 38, pass 33, fail 5
```

---

## 3. GREEN 证据（整改后）

### 3.1 Codex 第四轮独立探针全量通过（15/15 + 5/5 全绿）
1. **第四轮额外探针（5/5 PASS）**：
   运行 `cd /Users/moxiao/IdeaProjects/project && node docs/verification/harness/h02-codex-minimax-round4-extra-probes.mjs`：
   ```json
   [
     { "name": "latest typed baseline", "expect": "accept", "actual": "accept", "pass": true },
     { "name": "not constraint", "expect": "reject", "actual": "reject", "pass": true, "error": "值违反 not 约束: governance.health.get.examples[overall assistant health].input.n 不应满足 not 模式" },
     { "name": "conditional then constraint", "expect": "reject", "actual": "reject", "pass": true, "error": "数值低于最小值: governance.health.get.examples[overall assistant health].input.n.then 最小值 2，实际 1" },
     { "name": "false property schema", "expect": "reject", "actual": "reject", "pass": true, "error": "Schema 为 false，任何值均不允许: governance.health.get.examples[overall assistant health].input.n" },
     { "name": "descriptor omission", "expect": "reject", "actual": "reject", "pass": true, "error": "描述符遗漏了 Java 源码中已注册的工具 (1): governance.health.get" }
   ]
   ```
2. **第四轮全量探针（15/15 PASS）**：
   运行 `cd /Users/moxiao/IdeaProjects/project && node docs/verification/harness/h02-codex-minimax-round4-probes.mjs`：15 项探针全绿。

### 3.2 编译器单元与负例全量测试套件（38/38 PASS）
```bash
$ cd /Users/moxiao/IdeaProjects/project-harness-h02-minimax
$ node --test scripts/compile-agent-capabilities.test.mjs
ℹ tests 38, pass 38, fail 0
```

### 3.3 描述符导出与结构验证测试（4/4 PASS）
- `node --test scripts/harness/capability-source-exporter.test.mjs`: `pass 1, fail 0`
- `node --test scripts/harness/capability-source-verifier.test.mjs`: `pass 3, fail 0`
- `cd backend && ./mvnw -o test -Dtest=HarnessCapabilityDescriptorExportTest`: `BUILD SUCCESS`

### 3.4 H01 存量回归测试（91/91 PASS）
- `node --test scripts/harness/runtime-contract.test.mjs`: `pass 91, fail 0`（H01 冻结运行时契约零退化）

---

## 4. 交付文件清单与提交溯源

- **实现提交 Hash**：`50544d505cefd30fc5550f6247c8175aa0ccb57b`
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
