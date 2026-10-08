# H01 首轮任务书：MiniMax Code

日期：2026-10-08。仅 H01，不进入后续 Task。用户指定你编码，Codex 设计协调并验收。

## 开始前

你的工作树：`/Users/moxiao/IdeaProjects/project-harness-h01-minimax`；分支：`codex/harness-h01-minimax-contract`。先核对 pwd、git status、branch；只能在这棵树新增/修改任务所有权文件。原 Task33 工作树不得修改。请先回 ACKNOWLEDGED（实际 workspace/cwd/branch、可访问性、当前 UI 模型标签；真实 provider model ID 未知则写未知）。不更改应用模型配置。

阅读 `docs/协同开发交接说明.md`、`docs/superpowers/specs/2026-10-08-studypilot-harness-integration-design.md`、`docs/superpowers/plans/2026-10-08-studypilot-pluggable-harness-runtime.md` 及 `docs/verification/harness/h01-baseline-provenance.json`。

## 总目标与边界

独立可替换 Agent Runtime；保留原 Harness loop、流、调度、压缩与恢复。专精通过插件/能力清单/业务上下文；产品使用可信业务 API，不开放任意终端/DB。Java 管业务/身份/权限/预算/确认/审计；Agent Service 管 Runtime/Config/Secret；Vue 全局悬浮球与 Harness 风格窗口。设置入口在球中，模型地址/API Key 不归 Java、不入浏览器持久存储。自然判断由模型作出，避免关键词规则代替推理。

## 本轮交付

- 独占 `contracts/agent-runtime/**`、`scripts/harness/runtime-contract*`、`docs/verification/harness/h01-minimax.md`。
- 写 Runtime JSON Schema 草案（版本、identity/session/turn/call/request/configVersion；open/create/resume/prompt/cancel/steer/respond/subscribe/close；事件序号、结束原因、错误与恢复语义）。区分 capability denied、budget exhausted、max tokens、cancelled、failed 与 completed；不把 token 耗尽当成功。字段不包含 Secret 或客户端 owner 授权。
- 用离线有效/无效实例验证 schema，覆盖额外字段拒绝、标识一致性、终态与重连边界；schema 无法表达的跨事件约束列清楚。明确草案待 Codex 冻结，不实现完整 Agent Service。
- 只读盘点当前 Java/Python 凭据消费者、身份/预算/治理入口，报告后续迁移依赖和兼容风险。保持原工具名称；不得提前实现 H02 的 Manifest。


## 交付规范

范围外修改先报告，其他端负责的公共文件只能在自己的报告建议。不抢写共享计划/交接/Obsidian。不得 push/merge/deploy、改 Secret、重启现有服务、真实模型评测、操作业务数据库或进入 H02。允许离线测试及本地提交；测试依赖不齐请报告，不擅自下载运行未知软件。

有新增可执行逻辑先 RED 后 GREEN。报告期望/实际、文件、命令/结果、mock/offline 层级与限制。提交仅你的所有权文件，最终回 READY_FOR_CODEX + cwd/branch/基线/commit/测试/未覆盖项，并停止等 Codex 独立验收。无法进入指定工作树则 BLOCKED，不在旧目录顶替执行。
