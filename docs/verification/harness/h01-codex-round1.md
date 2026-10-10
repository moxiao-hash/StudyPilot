# H01 第一轮 Codex 独立验收

日期：2026-10-08。结论：**CHANGES_REQUESTED，H01 不通过，不冻结协议，不进入 H02。**

## 审查的提交与实际复跑

| 执行端 | HEAD | 已提交文件所有权 | 独立复跑 |
| --- | --- | --- | --- |
| MiniMax | `6371c8439ae81fba6270a0136d3c3028df74e73d`（交付实现 `7930399`） | 6 个 Owner 文件，无业务生产改动 | Node 55/55 通过 |
| ZCode | `4bf3841c82041e351661b76729485b5758a435fe` | 5 个 Owner 文件，无业务生产改动 | 静态清单脚本通过；Vitest 5/5 通过 |
| DeepSeek Harness | `61e097f56af72f1b98d13f2cc46fbee7298aa6ed`（交付实现 `b63184b`） | 6 个 Owner 文件，无业务生产改动 | Node 57/57（41 fixtures + 16 inventory）通过；16场景/99断言/33硬失败；现状 --check 通过 |

三端 committed diff-check 均通过。`backend/mvnw.cmd` 为已知基线 CRLF 工件，不在三端提交中；共享 baseline-note 未纳入交付。测试均 offline/static，未启动产品服务/模型、未更改凭据/数据库。首次前端静态脚本复跑误在 web cwd 调用导致 MODULE_NOT_FOUND，已从正确根目录复跑成功，该错误归 Codex 命令路径，不记作交付缺陷。

已有测试通过，但独立反例揭示下列门禁缺口。可复跑 `node docs/verification/harness/h01-round1-probes.mjs`，输出见 [独立反例结果](h01-round1-probes.json)。该脚本按本机三个工作树读取，当前记录绑定上述提交；二轮执行须另外记录，不能覆盖一轮历史证据。

## 必须整改

### R1 [P1] 三端协议未对齐（MiniMax + ZCode，Codex裁决）

ZCode 12项映射中的 `turn.started`、`tool.call.started`、`content.delta` 等 **全部不属于** MiniMax schema；后者使用 `TURN_STARTED`、`CALL_STARTED`、`ASSISTANT_DELTA`。前端 `finishReason` 小写与公共 `endReason` 大写也未对齐，`context.loaded`、`reasoning.plan`、`client.ui_directive` 无对应schema分支。前端测试只断言映射数量/名单，另一端完全不读取。它们是双方尚未协商的草案，不是已兼容共同契约。

裁决：以公共 schema 的 uppercase 事件名、`protocolVersion:1.0-draft`、`TURN_FINISHED.payload.endReason` / `ok` 为唯一线上草案形状。待二轮过门再冻结1.0。序号明确为持久事件从1开始，subscribeFrom=0表示从首事件订阅，续传排除已确认序号；需要快照/回放边界时必须注明，不凭空要求每次回放都有起始事件。等待问题/确认属于交互待答状态，不是 completed。steer是下一步注入，不等于cancel或终结。新增展示进度采用明确 `PROGRESS` 分支及种类，旧UI指令采用封闭 `UI_ACTION` 分支，不得模型生成任意URL/selector。

MiniMax补充这两个缺失展示事件的草案与有效/拒绝样例，明确如何承载裁剪标志/净化摘要/稳定错误码而非吞掉事实。ZCode把建议映射改成可被公共schema校验的实际实例；旧context/plan可投影PROGRESS，但不得让显示进度重新约束原推理循环。增加跨端消费测试，允许显式传入另一工作树契约路径，固定提交/文件hash，不能改另一端文件或暗中依赖不明版本。

### R2 [P1] 交互事件不能展示问题/确认，答复退化为文本（MiniMax）

`runtime.schema.json` 的 `event.interactionRequired` payload封闭且仅允许interactionId/kind；添加问题正文/选项立即被独立probe拒绝。`request.respond` 仅 `answer:string`。没有正文、选项、确认预览/expiry/version，客户端无法用该契约渲染可判断的交互卡片；纯文本answer也不能表达与具体问题绑定的多选答复/结构化业务确认。不是要求当前实现H10界面，而是H01不能冻结一份必须破坏性扩展才能保留原提问/审批机制的协议。

补充分支明确question字段（稳定questionId、正文、可选选项与选择约束）、confirmation字段（Java execution/action关联、预览摘要、expectedVersion/expiry），typed respond区分问题答复与确认决策并关联interactionId。Java治理仍是实际写入权限真值；自然语言不是确认权限。验证缺少正文、未知选项、缺少确认版本、类型错配被拒，离线无法校验的关联/一次性/过期服务语义明确列H05/H10/H11，不假装schema已鉴权。传输schema与Harness工具schema是不同域；README不得因不使用type数组就声称全schema适合Harness支持子集。

### R3 [P1] 全量轨迹校验接受不可能的生命周期（MiniMax）

独立probe实际得到 accepted=true：只有TURN_FINISHED却没有开始；CALL_FINISHED的callId从未开始；同turnId重复TURN_STARTED。schema单消息形状可合法，问题在 `runtime-contract.mjs:398–423` 的场景状态只记录turn集合，没有call生命周期且终态未核对开始。无启动就完成的样例会削弱避免伪成功的门禁。

在全量轨迹模式补轮次与调用状态机的RED→GREEN，覆盖未开始终态、重复start/finish、孤立/跨turn call、会话close后活动；部分回放必须以显式恢复快照/模式为前提，避免误拒合法续传。PENDING/暂停不能当最终成功，说明跨轮业务execution状态与当前tool call状态差别。所有旧55项回归仍应过，已有终态后content拒绝probe是通过的控制组。

### R4 [P1] 原机制与profile改动未被基线漂移检测捕获（DeepSeek Harness）

`baseline-inventory.mjs:207–242`采集extensionPoints/profileFiles的sha256，却不存入fixture基线比较。独立probe仅修改内存inventory：HEAD/锁文件不变，loop-main hash变化并加入dirty核心路径，仍ok=true；profile hash变化且bundles不变，同样ok=true。未修改原桌面源码或真实profile。当前“LOCKED baseline matches”无法支持核心机制/profile内容已锁定的结论。

将必要核心机制/组合/preset文件和采用的profile层哈希写入冻结基线并比较，缺失/增删/内容变化都应被拒或明确UNVERIFIED；不保存任何secret内容。避免只把dirty列表全等当机制保护，有无关未跟踪工件不代表核心漂移。新增核心变化、preset变化、profile变化/不可读的负测试与现状正例，不必安装/运行桌面Harness。

补充证据措辞：磁盘存在session.v4文件只能证明存在v4产物，不能单凭此证明当前运行binary必然来自新源码。用户交给本轮的源码目标已定为桌面commit `ddefc45…`；本H01按该源码验收，安装GUI与该源码等价性未证实。无需为此改变模型/安装版本或要求用户先选版本。

### R5 [P2] 结构存在性被表述成行为安全保证（ZCode）

`frontend-baseline-verify.mjs:61–66`通过源码includes错误文案/符号即可输出“strictly rejected”；`frontend-baseline.spec.ts`的5测试没有消费新契约或执行owner/自动提交/任意selector拒绝。这是可用的静态盘点，不是负路径行为证据。

保留静态清单但准确标为STRUCTURAL，不宣称行为已验证。用现有真实dispatcher/parser执行离线负例（owner注入、自动提交、未知路由/selector、未知事件、终态后delta与乱序/重复回放），无网络/无产品生产改动，区分旧消费行为与新协议fixture模型。增加R1跨端实例消费，并修正steer/cancel语义、待答/终态、数字序号。不得复制一份自洽fixture后仅数数量就声称三端兼容。

## 当前通过项与门禁

角色所有权、独立树、无生产代码改动、16固定场景结构/真实模型未运行标识、原loop控制扩展点盘点得到认可。未冻结schema、未确认能力保持的真实评测、未合并/推送/部署。H01本轮总验收不通过，三端只整改各自Owner文件并本地提交；等二轮Codex复验与用户审阅，H02不派发。

调度沿用 `studypilot-h01` 等新交付，不能对上述旧HEAD重复通知或将一轮已过的自测当最终验收。

## 整改派发回执

本轮已在三个本机应用原StudyPilot会话发送以上整改：MiniMax负责R1/R2/R3，ZCode负责R1/R5，DeepSeek Harness负责R4及术语/证据措辞。发送后已回读消息进入对话与进行中/停止生成状态。未替执行端修改生产代码，等待二轮本地提交；调度仍ACTIVE。
