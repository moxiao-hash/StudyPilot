# H02 DeepSeek 第四轮独立复验

结论：R-D4_TYPED_EXAMPLES_PASS / AWAITING_CROSS_LANE。HEAD `8ad8ea521493eb0f4e70b8adc628a13646f800cb`，实现 `6f92ce9`。R-D1/R-D2/R-D3既有修复保持；本輪关闭占位输出与个人报告过时缺Schema的缺口，但不代表H02整体或真实业务/模型能力通过。

Codex独立复跑63/63 Node测试、零跳过；来源--check退出0 MATCH。另写独立契约检查器（未调用执行端实例validator）按当前真实Java descriptors递归检查类型、required、additionalProperties和items；未实现关键字直接失败，不略过。77/77独立检查符合期望：65个冻结input/output schema与当前导出逐项相同，当前导出/schema hash及声明来源commit中导出bytes匹配，72个应合法输入和67个成功输出符合真实契约，1个故意非法/rejected输入单列。合成fixture不含业务行为证据。

额外元数据正反例7项：正本接受；实际数值字段错为字符串、整个输出错误类型、必需字段缺失、未知属性、可空工具output缺失、空占位输出均拒绝。完整证据：[round4 probes](h02-codex-deepseek-round4-probes.json)及同名mjs。

新增生成器及其余五个修改文件均属DeepSeek Owner，H01 Runtime指纹未变，工作树仅既有mvnw.cmd快照工件。所有实例均为明确标注synthetic_typed的离线合成数据；不能冒充实际服务返回、系统指标或付费模型结果。无成功路径继续unavailable、显式null空态单列。

剩余：MiniMax第二轮Schema/绑定/来源与ZCode第一轮消费/覆盖缺陷仍整改。等上游真实交付稳定后重编译并核对最新metadata hash，再完成三端治理、业务覆盖和消费交叉验收。DS报告/会话仍有两端“额度受限”的历史句子；当前两端已恢复且原整改正常执行，以本协调状态为准。未复跑旧提交相同测试，不重复派任务，H03未授权。
