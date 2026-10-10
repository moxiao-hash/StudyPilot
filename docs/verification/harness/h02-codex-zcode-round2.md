# H02 ZCode 第二轮独立验收

结论：CHANGES_REQUESTED。HEAD 1c52a3bd0e693708ef14b1234b5d21ea59f9297c。Codex独立运行22/22 H02 Vitest通过、实际CLI20/20自检通过；7个Owner交付路径及H01 Runtime指纹保持。MiniMax仍有未提交整改，未替其做验收。

新增独立17项CLI探针：合法正本及旧名字假handler拒绝通过，15项非法输入仍返回0。为避免移动上游干扰，探针从git show读取MiniMax da3bae15与DeepSeek e92fc157已提交字节，在临时目录传入显式路径；输入commit/hash与结果保存于 h02-codex-zcode-round2-probes.json，同名mjs可复跑。没有改执行端文件。

## R-Z4 按完整Schema验证实际数据

Schema解析成功后从未应用到Manifest；可解析的 {"type":"null"} 仍让整个Manifest通过。元数据tools: []也通过。缺when_to_use、空examples、未知nested cost字段/root字段、缺成功output、缺output必需字段、实际submissionVersion字段错为string仍全部通过。要求运行实际提供的Schema（全部必需字段、嵌套additionalProperties、类型、约束、枚举/组合等）；对工具input/output实例按真实Java描述符校验；缺依赖或不支持的约束必须失败关闭。CLI与TS引擎一致，合法基线和任意非法变异都要有效。不得仅补本报告的字段if条件。

## R-Z5 实际来源比较，不用特定字面量代替验证

handler仅当包含UnregisteredClass/noSuchMethod时拒绝；同样虚构的ImaginaryLearningService.computeEverything被接受。metadata_hash仅拒绝缺失/全0，改为64个1仍成功，同时打印“strictly matches current metadata”。当前真实metadata文件已被DeepSeek四轮更新，CLI依然接受过时Manifest。应实际比较hash、元数据工具集合/内容、描述符/真实注册及绑定依据、来源commit，缺权威上游明确BLOCKED。不预先认可MiniMax未完成绑定修复，不能从未验证输入互相自证。

## R-Z6 实际覆盖与治理

冻结router名称集合加特定/not-registered/fictionalRoute检查不能证明当前router覆盖：同一个真实route替换另一行（重复及遗漏同时发生）、真实name配另一个假path、65审核工具表中的name改成假工具都仍通过。必须读取实际router和公开Controller操作来源，按名称/path/映射集合比对及去重，缺公开能力明确pending/disabled。HIGH确认mode改为automatically_assumed也通过，完整治理字段以真实规则核对，不能只拒绝none。

原R-Z1/R-Z2/R-Z3没有完全关闭。已有递归敏感字段及解析改进保留，但不能依赖前次反例的特定字符串作为来源事实。只在原ZCode Owner范围先失败测试再修复，README/证据与源码一致；上游真正不合法则报告BLOCKED而非通过。本地提交READY_FOR_CODEX停H02，不修改公共Schema/他端文件/生产web/H01契约，不push/merge/deploy或改变模型/密钥/业务数据。H03未授权。
