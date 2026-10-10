# H01 二轮交叉复验：CHANGES_REQUESTED

2026-10-08 10:45（Asia/Taipei）。独立读取当前源码与提交，未以执行端自述代替验收。

| 工作包 | 审查 HEAD | 当前独立结果 |
|---|---|---|
| MiniMax | d9b57273ec84bcccc22aa8e27de55c291a2ad55c | 85/85 离线测试；快照无绑定与无关活跃轮次反例均拒绝；R2 仍需修正 |
| ZCode | 2d9f5e967fd5b50b3dc1a7ca118e59d82eb44150 | 15/15 Vitest；跨端脚本 exit 1，4 项失败；R1 未关闭 |
| DeepSeek | 70ab27605de448382ee483ecb329fe3a33f08eeb | 100/100 离线测试；原机制内容漂移防护 R4 已关闭 |

## 当前可复现缺陷及预期

1. MiniMax typedRespondTo.confirmation 的 confirmed 声明可选，但删去有效响应的 confirmed 后，validateMessage 报命中 not 分支。预期 decision=CONFIRM/REJECT 可单独决定，省略可选字段合法；矛盾双字段仍拒绝。根因为 not.properties 在属性缺失时仍匹配。
2. MiniMax interactionQuestion.questionId 可缺失并通过，而 typed question respond 要求 questionId。预期卡片必须提供稳定 questionId，支持原样关联答复。独立删除卡片 questionId 实测仍接受。
3. ZCode 当前12具体实例仅8通过最新MiniMax schema，PROGRESS两项、UI_ACTION一项、INTERACTION_REQUIRED一项不匹配；记录旧 schema hash 与当前 68d19dadc37d6fc93ff085bbd2cf04e62c014b1d5118a6d6571bbefed54c2f2c 不符。验证脚本还把不合法 PROGRESS/UI_ACTION 当作 pending extension 放行，缺外部 schema/validator 或加载异常可 warning+skip。预期12/12严格合法，非法/缺依赖/加载失败均非零；提交指纹必须来自真实Git，不能自引用编造。

## 已关闭及证据边界

无 snapshot 的 partial replay、无关 activeTurnId 的终态均拒绝；矛盾 CONFIRM/confirmed=false 拒绝。DeepSeek本轮新增词表来源检查，66 fixture +34 inventory测试通过。ZCode行为负例与结构证据已分开，15项测试通过，但不等于跨端契约通过。

10:45 已在原 MiniMax Code、ZCode 的对应 StudyPilot 会话发送上述范围内整改；回读消息存在且应用显示执行中。由原 Owner 修改，Codex未写生产代码或公共契约。DeepSeek无需重复整改。

当前仅离线规格/校验器/旧前端行为证据；未接入新Runtime、无新产品页面、未测真实模型能力。H01仍CHANGES_REQUESTED，heartbeat ACTIVE，H02未派发，未push/merge/deploy、改密钥/模型、重启服务或操作真实业务数据。backend/mvnw.cmd CRLF差异按已知基线噪声排除。
