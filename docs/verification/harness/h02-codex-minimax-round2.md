# H02 MiniMax 第二轮独立验收

结论：CHANGES_REQUESTED。交付 HEAD da3bae15bbc74978b5cff82ef7b26f357bd50837，实现 9697dd91b1c7a19fef00396e3c10a68284d00ada。

Codex复跑21/21 Node测试、原13项探针全部符合预期，原缺陷的具体样例已改善。新增10项探针中正本通过、9项非法变异仍接受。证据：h02-codex-round2-cross-probes.mjs/json；原探针本轮结果单列 h02-codex-minimax-round2-original-probes.json。旧 h02-codex-minimax-probes.json 曾被重跑覆盖，已依据一轮报告恢复历史期望/实际并标明重建，原始错误文本不可恢复；不得将重建记录作为原始运行日志。

## R-M4 完整 Schema 校验与合法实例

validateValueAgainstSchema 接受 enum/minimum 等关键字却未执行；shape_placeholder 整段跳过 output 校验，字符串 <shape-placeholder> 也直接返回。空必需对象、枚举 B 不在 A 内、limit=-10 低于 minimum=1 仍成功。缺 cost_hint/exposure、when_to_use=[42]、未知嵌套confirmation字段也成功。当前 verifier 仅用 Schema 的工具 required/properties 并手写少数枚举，并非完整 Schema 校验。要求所有元数据/最终Manifest按真实完整Schema验证、拒绝未实现约束而非静默通过；占位输出不得编译成通过验收的产物。DeepSeek补合法fixture前应明确BLOCKED，不能为跨端正本绕过校验。补全必须字段、数组元素、嵌套未知字段、条件/枚举/范围与合法输入输出正反例。

## R-M5 绑定与来源不能自证

Java测试从本地 generated/tool-bindings.json 读取字符串再附加到 registry.catalog() 导出；该字典没有从实际handler生成/核验的路径。删除描述符handler仍接受假绑定；描述符与元数据同时改为 UnregisteredClass.noSuchMethod 也接受。要求绑定缺失即失败，并由真实注册handler/config提供工具与接收者/类方法配对依据，核验当前源码；不能用手写字典与元数据互相证明。不得修改生产Java；可在Owner导出测试/来源辅助文件内完成。语义来源不等于实际调用验证，明确证据层级。

## R-M6 溯源及显式CLI输入

当前 generated Manifest sources.commit=ebb6f2b9（整改前HEAD）；compiler取运行cwd的git和四个Java文件，缺文件静默跳过，git失败回退硬编码基线。独立临时非仓库cwd下仍编译成功（缺全部Java来源）。要求显式source-root/来源commit、源码清单hash可核对，缺源码/仓库/路径或旧来源不得成功，生成物引用真实实现来源，不伪造fallback commit。显式--metadata缺文件也不能换成硬编码另一树；CLI未知/缺值参数应失败，跨树路径与来源对应。

默认同cwd/同输入确定性已通过，不重复扩大测试。Java本轮只检查导出测试代码与执行端H2成功自述；Codex没有重跑SpringBoot测试，不将其视为独立Java行为证据。12个Owner文件和H01指纹均核对未越界，wrapper基线工件除外。仅H02，不推送/合并/部署，不改公共Runtime契约。先红测试再Owner整改，提交和报告READY_FOR_CODEX后等待复验。
