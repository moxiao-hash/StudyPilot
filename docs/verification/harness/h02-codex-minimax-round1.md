# H02 MiniMax 首轮独立验收：CHANGES_REQUESTED

审查HEAD：ebb6f2b95563d71f6a43ac65b1c56bf3f59b31d5；实现d3d20440ba5035245f7c8835226e077b2605483e；共同基线16b37d34。Owner十一文件符合范围，生产源码及H01冻结契约未变，runtime SHA256仍df5950c9f9b482b4bea8a21c67e7cad4c5098bd342ce11139199ec9cc6bc5923。仅mvnw.cmd已知工件脏状态。

Codex复跑三组Node测试13/13通过、无跳过。但独立13探针仅正本通过，12项坏输入或确定性要求失败，见同目录h02-codex-minimax-probes.mjs/json；探针仅临时文件/内存，无生成物改写。

## R-M1 完整Schema与示例校验（阻塞）

编译器接受缺description、未知元数据字段/未知Java schema约束、非法输入/数字输出、嵌套ownerId；结构校验器接受version字符串与非法exposure enum。必须逐层真实校验schema、输入/输出实例及三态失败语义，拒绝未知约束和字段。不可通过Boolean转换、默认pending/空数组掩盖缺字段。shape_placeholder并不符合Java类型，须与DeepSeek原Owner协同提供合法typed fixtures，不替其改metadata。缺依赖应失败退出，不宣称生成成功。

## R-M2 来源绑定与治理/业务边界（阻塞）

虚构NonexistentService.nonexistent、WRITE/coding曝光allowed、虚构权威fact均被接受。descriptors只包含catalog字段，没有真实handler执行binding；source_provenance照抄元数据，不能证明绑定。按实际注册handler及调用来源校验；确认条件来自实际治理代码，不能仅按HIGH/LOW猜规则。独立反例应覆盖实际配对、遗漏/重复、用户专属行为错误开放、权威响应字段来源等。

## R-M3 确定性与溯源/CLI（阻塞）

同一输入默认编译两次generated_at不同，测试固定时间掩盖默认路径失败。移除运行时钟或用输入内容确定值；绑定Java源码/导出/元数据hash及commit，检测变更过期。当前仅描述符/元数据hash，不含源码/commit；CLI硬编码本机DeepSeek路径且不接显式输入参数，应提供明确可覆写路径并缺失/非法输入非零退出。不得使用固定工具数量替代完整性证明。

## 证据限制和整改停点

Java导出代码确实读取注入registry.catalog()。执行端surefire日志显示H2内存fixture启动，不能当成Codex独立复跑；本轮没有重新启动Spring/数据库/服务，也未调用handler。上述静态与独立Node反例已足够拒绝本包；整改后再做所需Java离线导出复验及跨端。DeepSeek HEAD9dd7ab12仍有自身二轮缺口；ZCode未交付，整体H02未通过。

仅原MiniMax H02 Owner整改，先失败测试后实现；不可改公共Runtime/生产代码/metadata/他端/共享文档/Obsidian/模型密钥。仅本地提交READY_FOR_CODEX后停止，不push/merge/deploy，不启动H03。
