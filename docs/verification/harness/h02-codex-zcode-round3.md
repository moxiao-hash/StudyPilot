# H02 ZCode 第三轮独立验收

结论：CHANGES_REQUESTED。提交 b20b673a98427423ce1022532d9e133ee387f82b。22/22 H02 Vitest通过；上一轮17项固定输入探针全部符合预期，保留改进。新增10项CLI检查：正本成功，9项非法变异仍返回0。证据为h02-codex-zcode-round3-original-probes.json/mjs、h02-codex-zcode-round3-probes.json/mjs，使用git-show MiniMax da3bae15、DeepSeek e92fc157的冻结输入，避免上游正在整改文件。合成离线证据，不代表真实业务或模型效果。

## R-Z7 实际来源及完整集合

已知类 AssistantHealthService.imaginaryMethod 和将另一个工具真实handler配给当前工具均成功：includes类名不是注册接收者/精确方法/工具配对核对。descriptors_hash改64个1、commit改40个1仍成功。metadata保留65行但把第二工具替换第一工具，并同步真实文件hash，仍成功；审核表同样重复一工具遗漏另一工具仍成功。必须从显式可验证注册/描述符/源码及commit依据核对真实集合、绑定、描述符字段和治理；元数据与审核完整去重集合及内容一致，不以数量、硬编码服务类名单或相互伪造的输入自证。公开router/Controller覆盖应读取实际源码，而非另一手写字典。缺权威来源明确BLOCKED，不打印验证成功。

## R-Z8 完整Schema约束及证据报告

input_schema对象内整数minimum=1却输入0、对象内oneOf要求integer却输入string、对象内数组uniqueItems=true却输入[1,1]均成功。原最外层object限制拒绝标量不能证明这些约束被执行；本轮探针保持对象外形只变内部合法性。实现适用完整约束或不支持约束失败关闭，CLI/TS实际消费一致，并校验原始描述符真实性，不能只补这些例子的字符串。新交付个人报告仍标ROUND2且来源commit/hash陈旧，须按新版本与实际输入回写，区分定向修复、跨端、完整通过及BLOCKED。

由原Owner先红测试再修改。禁止改他端公共Schema、metadata、生产代码、H01冻结契约。READY_FOR_CODEX本地提交后停止H02，不push/merge/deploy、不改模型密钥、重启服务或操作真实业务数据。H03未授权。
