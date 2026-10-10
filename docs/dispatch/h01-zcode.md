# H01 首轮任务书：ZCode

日期：2026-10-08。仅 H01，不进入后续 Task。用户指定你编码，Codex 设计协调并验收。

## 开始前

你的工作树：`/Users/moxiao/IdeaProjects/project-harness-h01-zcode`；分支：`codex/harness-h01-zcode-baseline`。先核对 pwd、git status、branch；只能在这棵树新增/修改任务所有权文件。原 Task33 工作树不得修改。请先回 ACKNOWLEDGED（实际 workspace/cwd/branch、可访问性、当前 UI 模型标签；真实 provider model ID 未知则写未知）。不更改应用模型配置。

阅读 `docs/协同开发交接说明.md`、`docs/superpowers/specs/2026-10-08-studypilot-harness-integration-design.md`、`docs/superpowers/plans/2026-10-08-studypilot-pluggable-harness-runtime.md` 及 `docs/verification/harness/h01-baseline-provenance.json`。

## 总目标与边界

独立可替换 Agent Runtime；保留原 Harness loop、流、调度、压缩与恢复。专精通过插件/能力清单/业务上下文；产品使用可信业务 API，不开放任意终端/DB。Java 管业务/身份/权限/预算/确认/审计；Agent Service 管 Runtime/Config/Secret；Vue 全局悬浮球与 Harness 风格窗口。设置入口在球中，模型地址/API Key 不归 Java、不入浏览器持久存储。自然判断由模型作出，避免关键词规则代替推理。

## 本轮交付

- 独占 `scripts/harness/frontend-baseline*`、`docs/verification/harness/h01-zcode.md`，需要消费侧离线测试可用 `web/tests/harness-baseline/**`，不改现有生产组件。
- 只读盘点实际 Vue 路由、导航、Agent/设置页面、SSE 与 UIAction 类型及消费者；列出未来悬浮壳挂载、旧 URL 与动作注册表迁移点。
- 建前端事件兼容样例与离线验证，列清现有事件到新 Runtime 事件的映射/未知事件/终态/断流恢复差异；公共 schema 由 MiniMax 编写，你仅提交消费需求，不抢写。
- 建基线清单，明确当前 UI 来源及不可将登录重定向/页面打开当真实业务通过。H01 不做新悬浮球或移除旧页；给 H07/H08 记录可执行设计约束。


## 交付规范

范围外修改先报告，其他端负责的公共文件只能在自己的报告建议。不抢写共享计划/交接/Obsidian。不得 push/merge/deploy、改 Secret、重启现有服务、真实模型评测、操作业务数据库或进入 H02。允许离线测试及本地提交；测试依赖不齐请报告，不擅自下载运行未知软件。

有新增可执行逻辑先 RED 后 GREEN。报告期望/实际、文件、命令/结果、mock/offline 层级与限制。提交仅你的所有权文件，最终回 READY_FOR_CODEX + cwd/branch/基线/commit/测试/未覆盖项，并停止等 Codex 独立验收。无法进入指定工作树则 BLOCKED，不在旧目录顶替执行。
