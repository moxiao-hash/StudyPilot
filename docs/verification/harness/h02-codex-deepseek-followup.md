# H02 DeepSeek 类型化示例续接要求

上一轮接收者配对/缺失output问题已在HEAD e92fc157通过独立54测试、12探针及--check，勿重复该整改。H02仍需要R-D4：当前MiniMax树已交付真实Java descriptors.json及manifest.schema.json，按共享H02要求给每项工具提供实际满足input/output_schema的离线类型化fixture，标明合成fixture来源，禁止把66个shape_placeholder输出算合法正例。不得操作真实业务数据/模型，不得替MiniMax改Schema/生成物。

以当前真实Java描述符核对实例，枚举/required/nullable/嵌套/数组必须满足；无成功路径的工具明确unavailable/rejected和来源，不伪造成功。若描述符真实矛盾明确BLOCKED并给具体字段证据；不要静默跳过校验或编造业务指标。Schema/绑定上游缺陷已另退回MiniMax，仅只读其文件并记录当前commit/hash，不要求改他端。

同步修正h02-deepseek.md第8节“MiniMax尚无Schema/停基线”与3.2矛盾及ROUND2标题，报告真实残余门禁。原Owner仅改本端文件，补测试、本地提交READY_FOR_CODEX停在H02。独立复验报告：/Users/moxiao/IdeaProjects/project/docs/verification/harness/h02-codex-deepseek-round3.md；续接本文。
