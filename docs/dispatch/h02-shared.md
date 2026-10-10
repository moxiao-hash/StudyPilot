# H02 协同任务与输入契约

用户于2026-10-08确认H01验收通过并授权下一个Task。只实施H02 Capability Manifest，H03及之后不启动。没有新Runtime或产品UI。

数据形状是以真实Java wire name为键的完整能力目录。Java AgentToolRegistry.catalog()/AgentToolDescriptor及实际handler是name、version、schema、effect、riskLevel、requiredScope、idempotencyRequired、timeoutMillis和执行绑定的来源。元数据补用途语义，不能覆盖Java事实。能力矩阵、Vue路由与控制器用于独立覆盖核对，不单独视作handler已实现的证明。

每项最终Manifest包含name/version/description/when_to_use/when_not_to_use/input_schema/output_schema/side_effect/permission/confirmation/idempotency/error_contract/examples/cost_hint，另有exposure与source_provenance。exposure至少明确allowed/disabled/pending及reason；allowed仅指满足后续权限和实现条件时允许纳入候选目录，不等于当前开通运行。写操作仍禁用至H11，coding/runner/local automation默认禁用，用户答题、打卡事实、验收及扩权由用户本人处理。可导航不代表操作执行成功。

确认规则来自实际治理代码；后端保留判断真值。不能用风险等级猜全部确认条件。scope、schema、版本、效果、幂等信息均不得从用途文字反向推导。业务没有登记工具时写入覆盖表pending/disabled，不伪造可调用工具或studypilot.*新wire name。业务真值包括掌握度、进度、任务状态等，引用现有工具及响应字段，禁止模型自行计算后冒充系统指标。

## 三端协作接口与顺序

1. MiniMax先交manifest.schema.json与metadata输入约定，写个人报告中的接口说明；DeepSeek/ZCode只读该文件。元数据文件默认metadata.yaml，允许JSON子集作为合法YAML以复用现有解析依赖，但格式/字段须清楚记录。
2. DeepSeek先按实际handler/矩阵盘点完整语义与例子，再按MiniMax Schema落盘元数据。不得手写重复input/output schema。示例输入/输出需实际符合各自Java schema并标注fixture来源，不含ownerId或秘密。
3. MiniMax从实际注册的真实handler描述符导出目录并编译。允许新增离线Java测试/导出辅助类，只读取descriptor，不invoke handler，不访问DB或真实服务。不能只靠源码正则、人工工具列表或stub模拟的目录宣称完整注册来源。未能离线构造某个handler须BLOCKED/明确缺口，不能编造来源。产物绑定源码/导出/元数据hash及commit，不从实际时间生成不稳定diff。
4. ZCode独立核对真实业务路由、Java工具矩阵、控制器和handler，先交覆盖表，再对另两端明确路径输入作跨端检查。不假设单树中他人未提交文件存在。记录当前输入commit/hash，依赖缺失/无效不能warning+skip取得成功。不能将静态出现字符串当行为证据。

## 编译与验收

MiniMax编译器拒绝重复工具、登记工具元数据遗漏、未知元数据工具、字段缺失、缺执行目标、治理冲突、额外秘密/owner授权字段、非法输入/输出示例及未知schema约束。不能只检工具数量。缺失/错误输入退出非零，不写成功产物。输出稳定排序；相同输入重复运行字节一致；任何source变更可检测过期。

ZCode使用人工独立边界fixture验证消费结果，至少实际遗漏一项工具/业务覆盖、重复wire name、虚构执行目标、治理冲突、非法示例、用户专属操作错误暴露、coding能力错误开放、权威指标无来源和不存在依赖时拒绝。正例需包含READ/导航及已登记但禁用WRITE/LOCAL分类。H06处理Harness schema投影，这轮不删除Java schema约束让投影假通过。

所有测试离线。先RED再GREEN，报告期望/实际、命令/退出码、fixture与真实源码证据区别。仅本地Owner提交，READY_FOR_CODEX回真实cwd/branch/base/实现commit/报告/限制，然后停止。原Task33/H01工作树只读；不能push/merge/deploy、改模型/密钥、重启服务、操作真实业务或付费模型。公共Runtime schema及H01指纹冻结不能改。共享协调/计划/Obsidian由Codex维护。

吞吐检查点：各端完成来源盘点与接口后先用最小离线正例连通跨端输入，再补全目录和独立反例，避免末尾才发现格式不兼容。Codex验收完整目录、来源与失败路径，用户审阅后才派H03。
