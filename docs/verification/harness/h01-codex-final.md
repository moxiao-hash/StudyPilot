# H01 最终独立技术验收：PASS，等待用户审阅

验收时间：2026-10-08T11:00:00.583492+08:00。本次是契约、原机制盘点和离线基线验收。没有新产品页面，也不表示 Harness 已运行于 StudyPilot 或真实模型推理能力已通过评测。

## 绑定交付

共同基线：`f7311079a83b84c5e7f3a9076ce4efccb3044c86`。

| Owner | 当前审查 HEAD | 独立验证 |
|---|---|---|
| MiniMax | `14f6529c08ebe21fcdb0b6b2cbf76679f2a38823` | 91/91 Runtime 契约测试通过 |
| ZCode | `9d6061a1254939380759e10395c766cbdacbe022` | 15/15 前端基线测试；跨端脚本 exit 0，12/12 具体事件实例匹配 |
| DeepSeek | `70ab27605de448382ee483ecb329fe3a33f08eeb` | 100/100 离线测试已独立验证且源码未再变化，复用结果；16 场景/101断言/33硬失败规则及实时内容锁检查 exit 0 |

三端提交文件均限定 Owner 范围，`git diff f7311079 HEAD --check` 均通过。工作树仅有已知 backend/mvnw.cmd CRLF基线工件及Codex未跟踪说明，不计执行端修改。没有改生产业务源码或桌面 Harness 核心。

## 缺陷闭环与独立正反例

| 项目 | 期望 | 实际 / 证据 |
|---|---|---|
| R1 公共事件与消费 | 大写事件；具体载荷严格通过；不靠待扩展分支兜底 | 12/12实例与当前schema一致；schema hash相符；3个非法实例拒绝；额外ownerId的PROGRESS在临时树导致脚本exit1 |
| R2 可往返交互 | questionId必填；确认actionId/expectedVersion/decision必填；省略可选confirmed合法，矛盾值拒绝 | CONFIRM及REJECT省略confirmed正例通过；缺questionId、矛盾REJECT/true拒绝；此前缺版本与无类型文本反例已有回归覆盖 |
| R3 生命周期 | 无启动终态、孤立调用、重复启动、终态后内容、无快照或错误快照回放拒绝 | 独立探针均拒绝；有效快照回放测试通过；等待交互不伪装完成，steer不冒充cancel |
| R4 原机制/profile内容漂移 | 即使HEAD/组合不变，也检测核心和采用profile内容变化 | 未改基线正例通过；同HEAD核心hash修改、同组合profile hash修改均拒绝；当前桌面源码锁复查无漂移 |
| R5 证据层级 | 字符串盘点仅作结构证据；真实执行旧dispatcher/parser负例 | 结构与行为标签分开；owner注入、自动提交、未知路由、任意选择器、不可代办学习动作拒绝；解析器离线负例通过 |

独立探针源/结果：`h01-final-probes.mjs`、`h01-final-probes.json`。进度事件非法载荷退出证据：`h01-final-cross-negative.json`。缺失外部schema独立实测exit1（ENOENT），无warning+skip假成功。12个事件实例为各分支消费样例，不把含多个替代终态的样例列表当作一条合法完整运行轨迹。

## 契约冻结

冻结内容为当前 `1.0-draft` 设计基线，SHA-256：`df5950c9f9b482b4bea8a21c67e7cad4c5098bd342ce11139199ec9cc6bc5923`；实施提交`d3a491db26811461ba692a1fc85a92b4522a4daf`。详见`h01-contract-freeze.json`。冻结以字节指纹绑定；不为验收修改公共schema版本，否则将使已验证消费者指纹失效。这里的draft表示尚未上线的协议，后续版本发布由原Owner实施并重验消费者。

业务专精通过独立Adapter、Manifest、Profile/Context及治理工具实现，Java管业务身份/权限/确认/预算，Runtime管推理循环；Agent配置/Secret独立归属，不混入Java业务配置或浏览器持久存储。当前没有业务逻辑侵入Harness核心，但未来运行时接入需另证持续推理、压缩恢复及错误路径保持。

## 残余限制与用户门禁

- 全部证据为本机离线schema/fixture/旧前端模块行为。16场景验证场景规格与mock断言，未运行模型，不能宣称DeepSeek原生组合更强或能力不退化已获实测证明。
- H03才能证明可运行Runtime；H04/H05实现独立配置与身份治理；H07等阶段提供悬浮窗口；写操作治理与真实paired评测按后续Task执行。
- H01交付仍分处三个隔离工作树，没有merge/push/deploy，也不更改现有服务、密钥或真实业务数据。
- 当前门禁：请用户审阅公共契约、16场景与架构边界。用户验收后才派H02。自动检查应暂停，不能自行推进。
