# StudyPilot Agent Capability Manifest & Metadata Specification (H02)

本目录定义 StudyPilot Agent Capability Manifest 规范及元数据输入契约。

## 1. 架构定位与职责分工

- **Java 后端事实来源** (`AgentToolRegistry.catalog()` / `AgentToolDescriptor` / `AgentToolOutputSchemas`)：
  - 唯一技术事实真值：`name`, `version`, `category`, `effect` (`side_effect.effect`), `riskLevel` (`side_effect.risk_level`), `requiredScope` (`permission.required_scope`), `idempotencyRequired` (`idempotency.required`), `timeoutMillis` (`timeout_ms`), `inputSchema` (`input_schema`), `outputSchema` (`output_schema`)。
  - 绝不从元数据文字反向推导上述技术事实。
- **元数据来源** (`contracts/agent-capabilities/metadata.yaml`，Owner: DeepSeek Harness)：
  - 补充人类与 Agent 用途语义：`description`, `when_to_use`, `when_not_to_use`, `error_contract`, `cost_hint`, `exposure`, `authoritative_facts`, `examples`, `source_provenance`, `confirmation`。
  - 严禁手写重复输入/输出 Schema。
- **编译器** (`scripts/compile-agent-capabilities.mjs`，Owner: MiniMax Code)：
  - 读取导出的真实 Java 描述符与 `metadata.yaml`。
  - 执行强类型校验、治理冲突检查、孤立工具检查。
  - 确定性编译输出至 `contracts/agent-capabilities/generated/manifest.json`。

## 2. 元数据输入契约 (`metadata.yaml`) 约定

`metadata.yaml` 必须包含顶层 `tools` 列表（每个工具项包含以下字段）：

1. `name`: 必须与 Java 注册的 wire name 完全一致（例如 `governance.health.get`）。
2. `description`: 工具人类可读描述。
3. `when_to_use`: 字符串列表（最少 1 项），说明何时使用。
4. `when_not_to_use`: 字符串列表（最少 1 项），说明何时避免使用。
5. `error_contract`: 字符串列表（最少 1 项），明确已知边界条件或错误返回语义。
6. `cost_hint`: 对象，包含 `local` (boolean), `external_dependency` (string 或 null), `notes` (string)。
7. `exposure`: 对象，包含 `state` (`allowed` | `disabled` | `pending`) 与 `reason` (string)。
   - `allowed`: 满足后续权限和实现条件时允许纳入候选目录。
   - `disabled`: 21 个写工具未到 H11 默认禁用，或 coding/runner/local automation 默认禁用。
   - `pending`: 已注册但当前无法满足声明契约的缺陷工具。
8. `authoritative_facts`: 权威业务事实数组（可选），包含 `fact` 与 `meaning`。
9. `examples`: 数组（最少 1 项），包含 `name`, `input`, `expect`, `outcome` (`ok` | `rejected` | `unavailable`), 可选 `output`, `error`, `fixture_kind`, `fixture_source`。
10. `source_provenance`: 对象，包含 `registration` (代码位置), `handler` (实际处理类与方法描述), `output_schema` (Java schema 类位置)。
11. `confirmation`: 对象，包含 `mode` (`none` | `always_user_confirmation` | `conditional_scope_grant`), `waiting_status` (`WAITING_CONFIRMATION` | `WAITING_AUTHORIZATION` | null), `notes` (string)。

## 3. 编译产物 (`contracts/agent-capabilities/generated/manifest.json`)

编译生成的单体 JSON 文档遵循 `manifest.schema.json`：
- `manifest_version`: `"1.0-draft"`
- `generated_at`: ISO-8601 UTC 瞬时字符串
- `sources`: 包含 `descriptor_count`, `descriptors_hash`, `metadata_hash` 溯源摘要
- `tools`: 排序稳定的完整工具条目数组（共 65 个工具）
