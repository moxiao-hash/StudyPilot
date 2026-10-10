# H01 首轮任务书：本机 DeepSeek Harness

日期：2026-10-08。仅 H01，不进入后续 Task。用户指定你编码，Codex 设计协调并验收。

## 开始前

你的工作树：`/Users/moxiao/IdeaProjects/project-harness-h01-deepseek`；分支：`codex/harness-h01-deepseek-baseline`。先核对 pwd、git status、branch；只能在这棵树新增/修改任务所有权文件。原 Task33 工作树不得修改。请先回 ACKNOWLEDGED（实际 workspace/cwd/branch、可访问性、当前 UI 模型标签；真实 provider model ID 未知则写未知）。不更改应用模型配置。

阅读 `docs/协同开发交接说明.md`、`docs/superpowers/specs/2026-10-08-studypilot-harness-integration-design.md`、`docs/superpowers/plans/2026-10-08-studypilot-pluggable-harness-runtime.md` 及 `docs/verification/harness/h01-baseline-provenance.json`。

## 总目标与边界

独立可替换 Agent Runtime；保留原 Harness loop、流、调度、压缩与恢复。专精通过插件/能力清单/业务上下文；产品使用可信业务 API，不开放任意终端/DB。Java 管业务/身份/权限/预算/确认/审计；Agent Service 管 Runtime/Config/Secret；Vue 全局悬浮球与 Harness 风格窗口。设置入口在球中，模型地址/API Key 不归 Java、不入浏览器持久存储。自然判断由模型作出，避免关键词规则代替推理。

## 本轮交付

- 独占 `agent-service/tests/fixtures/runtime_scenarios.json`、`scripts/harness/baseline-*`、`docs/verification/harness/h01-deepseek.md`。
- `/Users/moxiao/Desktop/Deepseek Harness` 只读。锁定 HEAD、依赖锁和完整 profile；盘点 loop/压缩/恢复/工具/事件/插件/approve/question/预算扩展点，列“保留、插件替换、SDK缺口”。特别核查完整 profile 与最小 SDK 差异；create/resume/control 必须共用 handle 注册表。
- 建 16 个固定场景及离线校验器，覆盖一般判断、明确执行意图、无需工具、需补查、工具结果后继续判断、追问、空状态、失败、取消/插话、压缩/恢复、权限/预算/写确认/幂等。每项有输入事实、允许/禁止动作、预期结果与硬失败，四项质量 rubric（理解/依据/建议/表达）。
- 原生 vs 接入版未来同模型/工具/预算每场景3次，以中位数比较；当前仅 mock/offline fixture验证，不能伪造模型跑分。提供可执行验证命令与以后实际评测缺口。
- 不修改桌面 Harness 核心，不提前编写 H03 插件实现。记录 API/JSON Schema 与原 loop兼容风险，公共协议仅在报告提出建议。


## 交付规范

范围外修改先报告，其他端负责的公共文件只能在自己的报告建议。不抢写共享计划/交接/Obsidian。不得 push/merge/deploy、改 Secret、重启现有服务、真实模型评测、操作业务数据库或进入 H02。允许离线测试及本地提交；测试依赖不齐请报告，不擅自下载运行未知软件。

有新增可执行逻辑先 RED 后 GREEN。报告期望/实际、文件、命令/结果、mock/offline 层级与限制。提交仅你的所有权文件，最终回 READY_FOR_CODEX + cwd/branch/基线/commit/测试/未覆盖项，并停止等 Codex 独立验收。无法进入指定工作树则 BLOCKED，不在旧目录顶替执行。
