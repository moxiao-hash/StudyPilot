# H02 DeepSeek 分包第一轮独立审查

时间：2026-10-08。审查HEAD：f9d481978fbff9ae19364e3220b65c1332770887；共同基线16b37d34c882a17e7bc45c69c84411f28f52bff8。状态：CHANGES_REQUESTED；H02总体未完成。

Owner diff仅六个预期文件，未改生产代码与H01 Runtime契约。独立复跑node --test scripts/harness/capability-semantics.test.mjs：30/30通过、零跳过；语义CLI：65条/29反例通过；--check出口0。静态源码盘点不是运行期注册证明，仍需MiniMax真实描述符导出及ZCode独立覆盖。

独立内存变异见h02-codex-deepseek-probes.mjs/json。正本通过，遗漏与重复拒绝；下面六个变异未拒绝。最初探针误用live提取结果而缺outputFields，已改为与交付CLI一致的fixture.frozenFacts.tools重跑，最终结果以当前JSON为准。

1. R-D1：source_provenance.handler替换为不存在方法AgentGovernanceService.thisMethodDoesNotExist，或错误但实际存在的RoadmapScheduleService.getOrCreate，仍通过。当前只检类存在，没有验证方法与该工具实际执行绑定。需要验证实际注册到handler调用的映射，或明确静态核对边界，不能宣称虚构binding已拒绝。
2. R-D2：navigation.resolve示例routeKey=NOT_A_ROUTE以及params.ownerId=forged仍通过。checkExampleInput仅顶层类型，不检导航白名单、各route所需安全标识参数、嵌套身份注入。需独立正反例并按真实NavigationToolHandler规则检查，递归拒绝身份/凭据字段；不能删Java约束取得通过。
3. R-D3：例子注入output={unexpected:not_schema}或删去所有expect仍通过。现有examples只有input及自然语言expect，缺可按真实输出契约验证的结果实例；shared要求合法输入输出示例。与MiniMax输入约定对齐后补真实契约合规输出fixture、结果/失败语义、fixture来源，并拒绝缺结果/非法输出；服务不可成功的pending工具不得捏造已执行成功。上游Schema缺失可明确BLOCKED，但不把输出验证记为已完成。

整改仅DeepSeek原H02 Owner。不得改生产Java、公共Schema/生成Manifest、他端文件或H01冻结契约。本轮发现的基线业务缺陷D1–D4暂为静态源码推导，尚未运行Java行为复现；标pending的保守处理合理，但报告“独立复现/实测/已核实恒定失败”须准确注明证据层级。H02内仅完善目录与证据，业务修复另行授权。

MiniMax仍限流；ZCode自动重试终止且错误为429 RESOURCE_EXHAUSTED/额度冷却，提示35m8s（相对错误产生时刻，非当前剩余时间保证）。保持模型/密钥，不重复派任务。交付上游恢复后再做跨端复验。H03未授权。
