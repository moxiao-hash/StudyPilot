# H02 DeepSeek 分包二轮独立复验

审查HEAD：9dd7ab12d6baa28e9839394e465d0db0e28dc95a，2026-10-08。状态CHANGES_REQUESTED；原Owner修正，H03未授权。

独立复跑45/45测试、零跳过；语义CLI 65条与43反例通过；--check出口0。原9个独立探针全部符合预期：R-D2非法导航与嵌套身份已拒绝，原两个绑定变异及缺期望/非法输出亦拒绝。测试/静态证据不能替代MiniMax真实注册描述符与ZCode独立消费。

新增三个变异仍接受，见h02-codex-deepseek-round2-probes.mjs/json：

- R-D1仍未闭环：artifacts.evaluate.handler=RoadmapArtifactService.ownerId 或 ObjectMapper.evaluate 通过。代码以boundClasses.has(class)&&boundMethods.has(method)组成任意配对；上下文里存在类名和方法名，不证明该方法属于该类或绑定到该工具。需要按真实接收者/注入类型与调用配对核对，不可把符号集合的笛卡尔组合视为绑定；不能把相关不存在的方法改标unverified绕过。静态不确定链明确UNVERIFIED，报告准确限定静态检查能力，最终注册证明仍由MiniMax完成。
- R-D3补漏：删roadmap.current.get全部examples[].output仍通过。checkExampleOutput把undefined与null并列放行；合法的显式null和缺失结果字段不同。校验output字段实际存在，仅真实可空工具允许显式null。补删除字段反例及显式null正例。

二轮新增shape_placeholder只检容器/顶层字段并以字符串占位，不是满足完整Java schema的输出值。Owner已准确标完整字段类型/嵌套/required及跨端检查BLOCKED；本次接受这个证据范围声明，不将R-D3总体关闭。上游到位后必须补契约合规的类型化人工实例，并通过真实schema验证，禁止将占位符直接视为完成产物。

Owner六文件/H01冻结契约边界保持；MiniMax/ZCode额度阻塞未变，本次不重试或重复派任务。没有真实服务/模型/数据库行为证明。
