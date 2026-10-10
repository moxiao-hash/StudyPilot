# H01 二轮部分交付验收（2026-10-08 10:20，Asia/Taipei）

尚未齐备，不是H01最终验收。MiniMax HEAD `8d031fb`、DeepSeek HEAD `f4c0a8b` 已有二轮提交；ZCode仍修改中，暂不复验其未提交工作。

MiniMax独立Node79/79通过；DeepSeek95/95（61fixture+34inventory）通过，16场景/101断言/33硬失败及现状--check通过。DeepSeek原R4核心/profile变异已独立验证拒绝，R4当前关闭；后续三端词汇投影还须最终交叉检查。

MiniMax原R2/R3仍有以下具体遗漏，结果见 `h01-round2-partial-probes.json`：

1. `validateScenario(...,{isPartialReplay:true})` 不带snapshot仍接受仅TURN_FINISHED。当前flag跳过生命周期防线，快照并未成为必要前提。必须拒绝无快照的部分回放，验证snapshot sessionId/configVersion/lastSequence/activeTurnId/activeCalls绑定；只认可快照中实际活跃的turn/call，不能仅因partial flag就接受任意孤立终态。保留合法有快照的正例。
2. confirmation `expectedVersion`仅properties非required，缺少版本仍接受；typed确认答复也不携带expectedVersion。questionId/actionId均非required，而且typedRespondTo仍保留未标kind的answer:string旧分支。请删未标型兼容分支，强制稳定问题/动作ID及版本关联；Java仍做最终权限/expiry/幂等验证，不要求H01实现服务。
3. `decision:CONFIRM, confirmed:false`矛盾实例仍accepted。建议去掉重复confirmed字段，只保留唯一决策；或明确强制两者一致。补负例，防止不同消费者作出相反判断。
4. 个人报告提交记录写f34dfb7，但Git实际HEAD8d031fb；以git为真，改为交付提交+后续md-only记录，避免自引用hash漂移。

这几项属于一轮R2/R3既有要求的漏项，仍限MiniMax原Owner；先RED→GREEN、本地提交后待复验，不改他端文件或生产服务。公共schema尚未冻结，H02不派发。
