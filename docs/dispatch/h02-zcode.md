# H02 任务书：ZCode

仅H02。工作树 `/Users/moxiao/IdeaProjects/project-harness-h02-zcode`，分支 `codex/harness-h02-zcode`，共同基线 `16b37d34c882a17e7bc45c69c84411f28f52bff8`。

先核对真实pwd、branch、HEAD、status并回ACKNOWLEDGED。MiniMax/ZCode应用项目界面可能仍显示旧Task33名称，实际所有文件操作必须显式cwd到新树；应用无法访问新树则BLOCKED，不能旧树顶替。保持模型配置。

读取绝对路径 `/Users/moxiao/IdeaProjects/project/docs/dispatch/h02-shared.md`、本任务书、`docs/verification/harness/h02-baseline-provenance.json`、H01最终报告/冻结指纹，以及共享总设计中的H02。新树保留H01全部验收产物，共享文档以project绝对路径最新版本为准。

## Owner与交付

独占 docs/verification/harness/h02-zcode.md、docs/verification/harness/h02-business-coverage.json、scripts/harness/capability-consumer*、web/tests/harness-capabilities/**。不实现UI、改路由或生产web代码，不改Schema/metadata/编译器。

独立覆盖所有现有公开业务页面/对应控制器能力与已登记工具，列出allowed/disabled/pending、原因、handler/工具真实名与来源路径，不能仅复抄矩阵；登录/设置/学习本人操作也需明确分类，不把未注册业务接口虚构成工具。说明现有页面哪些操作仍由用户执行，以及权威进度/掌握度来源。

实现跨端消费者离线验证及人工手写正反例。读取MiniMax H02树的schema/generated Manifest和DeepSeek H02树的metadata显式输入，绑定commit/hash。对任一缺失输入/未知字段/非法示例/冲突失败，不能跳过。先做覆盖表和独立fixture，再等待编译器产物做消费；输出自己的报告，不修改他人文件。不要求将H01旧SSE消费迁移至新Runtime。

## 验收停点

仅Owner本地提交，引用真实实现提交，证据提交可写本提交避免自引用hash伪造。交付READY_FOR_CODEX后等待Codex独立验收；不进入H03。backend/mvnw.cmd已知CRLF快照工件不修改/暂存/提交。不要修改共享文档或Obsidian。
