# H02 任务书：MiniMax Code

仅H02。工作树 `/Users/moxiao/IdeaProjects/project-harness-h02-minimax`，分支 `codex/harness-h02-minimax`，共同基线 `16b37d34c882a17e7bc45c69c84411f28f52bff8`。

先核对真实pwd、branch、HEAD、status并回ACKNOWLEDGED。MiniMax/ZCode应用项目界面可能仍显示旧Task33名称，实际所有文件操作必须显式cwd到新树；应用无法访问新树则BLOCKED，不能旧树顶替。保持模型配置。

读取绝对路径 `/Users/moxiao/IdeaProjects/project/docs/dispatch/h02-shared.md`、本任务书、`docs/verification/harness/h02-baseline-provenance.json`、H01最终报告/冻结指纹，以及共享总设计中的H02。新树保留H01全部验收产物，共享文档以project绝对路径最新版本为准。

## Owner与交付

独占 contracts/agent-capabilities/manifest.schema.json、contracts/agent-capabilities/README.md、contracts/agent-capabilities/generated/**、scripts/compile-agent-capabilities*、scripts/harness/capability-source*、backend/src/test/java/com/moxiao/studypilot/agent/tool/HarnessCapability*、docs/verification/harness/h02-minimax.md。不修改metadata.yaml、业务生产Java、公共Runtime schema或ZCode/DeepSeek文件。

交付完整Manifest Schema、输入约定、离线真实Java描述符导出和来源binding、确定性编译器与正反例。若需要已有测试classpath/dependency缓存，只用现有本机依赖，不启动业务服务。跨端语义元数据默认从DeepSeek H02树显式输入，生成物归你树；覆盖表可只读ZCode树。先把Schema/输入字段约定写入个人报告让另两端读取。

## 验收停点

仅Owner本地提交，引用真实实现提交，证据提交可写本提交避免自引用hash伪造。交付READY_FOR_CODEX后等待Codex独立验收；不进入H03。backend/mvnw.cmd已知CRLF快照工件不修改/暂存/提交。不要修改共享文档或Obsidian。
