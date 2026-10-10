# H02 ZCode 第六轮独立验收（2026-10-09）

结论：CHANGES_REQUESTED，原R-Z9/R-Z10仅定向关闭，完整要求仍未通过。HEAD `4aec808f382522dbb30168b99bc029095d3b948a`。原会话已READY，输入为空、发送禁用。Owner本轮4文件合规，仅既有wrapper工件dirty；MiniMax/DeepSeek无变化，原证据可复用。定时任务PAUSED，H03未授权。

## 已验证通过

本轮独立Vitest 42/42，0失败；旧10项CLI复验全部符合预期（真实正本接受，9非法例拒绝）。最新输入为MiniMax6f131ec6/DeepSeek82ec83b0当前字节，历史日志未覆盖。新证据h02-codex-zcode-round6-recheck.json/mjs。

## 原要求仍未完整实现

追加最终关系检查，6项中正本接受符合预期，5非法例仍CLI退出0：证据h02-codex-zcode-round6-final-controls.json/mjs。

1. 保留全部Controller，仅删某Controller一个端点仍接受。当前只检查Controller集合齐全、每个已列端点存在，不核对每个Controller真实端点集合双向相等。不能宣称全部公开操作覆盖。
2. 同一Controller重复端点仍接受，未检测操作重复。覆盖应按Controller+HTTP method+path唯一键核对遗漏/重复/虚构，并逐操作分类映射与禁用原因。
3. roadmap_progress的javaService换为真实AgentLearningContextService.get仍接受。类和方法存在不证明该事实由该服务产生。
4. roadmap_progress的endpoint换为真实GET /api/mastery仍接受。全局端点存在不证明工具/事实/Controller/服务调用配对关系成立。要验证权威事实真实调用链与字段；不能仅存在性、人工列表或关键词自证。
5. 真实旧da3bae15 sourceCommit配当前--descriptors输入仍接受。当前有显式输入或邻接文件时不读取声明commit内容；只存在性检查commit工件后，hash比较改用外部文件。必须无条件比较声明commit的descriptor实际字节与声明hash，也核对显式文件与其一致；不得用选择输入分支绕过来源证明，显式缺失失败关闭。

上述仍属于原R-Z9/R-Z10验收要求，不是新增业务范围。应原Owner把关系约束实现完整：精确来源字节三方一致、公开操作完整去重集合、事实/端点/服务真实配对；正本接受，旧10检查与新增5非法控制全部拒绝。通过真实实现和独立复验后才进入H02整体验收。不要修改他端schema/metadata或生产代码，不重跑覆盖历史日志，交付真实本地提交与报告READY后停止。

H02没有新产品页面；合成fixture是离线契约证据。H03、push/merge/deploy、模型/密钥变更、服务重启、真实数据/付费模型均未执行。
