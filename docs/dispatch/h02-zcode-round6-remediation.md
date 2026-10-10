继续原H02 R-Z9/R-Z10剩余整改，仅ZCode Owner，不进入H03。最新4aec808的42项测试和旧10项控制已通过，但最终5非法例仍被接受。先完整读取 /Users/moxiao/IdeaProjects/project/docs/verification/harness/h02-codex-zcode-round6.md 与同目录h02-codex-zcode-round6-final-controls.json/mjs、round6-recheck.json/mjs。

在 /Users/moxiao/IdeaProjects/project-harness-h02-zcode，codex/harness-h02-zcode，先核对pwd/branch/HEAD，再以失败测试推动完整关系整改：
1. 每个公开Controller的HTTP操作集合双向相等，拒绝遗漏与重复，逐操作分类、工具映射、禁用或用户专属原因可追踪；仅Controller名单完整不够。
2. 无条件读取声明sourceCommit的descriptor实际字节并比对声明hash；显式--descriptors/邻接文件同时必须与该commit一致，不能选择输入绕过来源commit。显式缺失失败关闭，禁止硬编码候选回退。旧da3bae15配当前显式文件应拒绝。
3. 权威事实的工具/字段/HTTP操作/Controller调用/服务方法核对真实关系，不能仅确认端点与类方法分别存在。roadmap_progress换AgentLearningContextService.get或GET /api/mastery应拒绝。以真实Java调用与描述符结构为依据，不以人工列表或关键词自证。

保留正本接受、旧10控制和新增5非法例全部拒绝，测试一般关系、不得sentinel。检查同类缺漏，不只修字面变异。MiniMax6f131ec6/DeepSeek82ec83b0只读消费；缺依赖明确BLOCKED。不得改生产/他端Owner/H01，不提前启用写LOCAL/coding；wrapper工件不提交。禁止push/merge/deploy、模型密钥更改、重启服务、真实业务数据或付费模型评测。不得覆盖Codex历史日志，新执行记录另存新文件。仅Owner本地提交，更新h02-zcode.md真实证据与限制，READY_FOR_CODEX后停止。定时任务保持暂停。
