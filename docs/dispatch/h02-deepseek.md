# H02 任务书：DeepSeek Harness

仅H02。工作树 `/Users/moxiao/IdeaProjects/project-harness-h02-deepseek`，分支 `codex/harness-h02-deepseek`，共同基线 `16b37d34c882a17e7bc45c69c84411f28f52bff8`。

先核对真实pwd、branch、HEAD、status并回ACKNOWLEDGED。MiniMax/ZCode应用项目界面可能仍显示旧Task33名称，实际所有文件操作必须显式cwd到新树；应用无法访问新树则BLOCKED，不能旧树顶替。保持模型配置。

读取绝对路径 `/Users/moxiao/IdeaProjects/project/docs/dispatch/h02-shared.md`、本任务书、`docs/verification/harness/h02-baseline-provenance.json`、H01最终报告/冻结指纹，以及共享总设计中的H02。新树保留H01全部验收产物，共享文档以project绝对路径最新版本为准。

## Owner与交付

独占 contracts/agent-capabilities/metadata.yaml、docs/verification/harness/h02-deepseek.md、agent-service/tests/fixtures/capability-semantics.json、scripts/harness/capability-semantics*。不编写公共Schema/编译器/生成Manifest或业务源码。

盘点全部实际Java handler与能力矩阵，编写每项description/when_to_use/when_not_to_use、error_contract、合法输入输出examples、cost_hint、exposure和权威事实来源。成本不可捏造token/费用数值，可记录真实超时和未知成本。治理声明以实际代码为准，当前运行启用须按shared边界禁用WRITE/LOCAL/coding工具。按MiniMax接口约定组织metadata；若schema尚未就绪先完成来源盘点，随后读取MiniMax树的manifest.schema.json/个人报告，不越权写入该树。

提供独立语义校验器与人工fixture，检来源遗漏、无依据权威指标、伪造已完成、用户专属行为错误授权及未实现工具。不要以关键词包含代替语义事实来源，明确机器可校验与人工复核边界。保留原Harness能力但产品业务能力默认边界按shared执行。

## 验收停点

仅Owner本地提交，引用真实实现提交，证据提交可写本提交避免自引用hash伪造。交付READY_FOR_CODEX后等待Codex独立验收；不进入H03。backend/mvnw.cmd已知CRLF快照工件不修改/暂存/提交。不要修改共享文档或Obsidian。
