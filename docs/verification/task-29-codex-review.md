# Task 29 Codex 首轮验收（2026-09-09）

结论：**暂不通过，已通过 Computer Use 向两个执行 Agent 下发整改。尚未合并 main。**

## 本轮检查对象与实测

- 后端：`agent/deepseek-task-29-sse-backend@ebc27fd`。
- 前端：独立工作树 `project-zcode-task-29`，`agent/zcode-task-29-sse-frontend@19fafa3`。
- Codex 本轮重新运行：Python pytest **395 passed**；Java Maven **374 passed**、0 failures/errors/skipped；Vue Vitest **136 passed**。
- 这些是自动化测试结果，不构成真实模型、浏览器断网恢复或全栈 E2E。整改中的代码需要再次验证。
- Computer Use 已查看两应用的交付报告，并实际发送整改要求；ZCode 界面显示正在工作，DeepSeek 工作树已出现对应后端整改。

## 阻断项

1. **跨域续传失败**：`SecurityConfig` 允许头只有 Authorization、Content-Type，缺少 Last-Event-ID。5173→8080 的浏览器重连预检会被拒绝。后端需补 OPTIONS 回归测试。
2. **刷新重放旧动作**：前端加载完整会话后从 sequence 0 订阅，会重放历史导航和消息。需一致的快照游标及进行中轮次恢复状态，保证既不重放旧 UI Action，也不跳过尚未体现在快照中的增量。
3. **多轮消息串接**：ASSISTANT_DELTA 未按 turnId 定位，只追加到末尾 assistant 消息；发送时也未立即加入 user 消息。第二轮会污染第一轮回答。需回归多轮及 POST/SSE 竞态。
4. **失败/取消语义**：未完成增量仍作为普通回答留在页面；旧终态和 POST 返回可覆盖新轮次状态。需轮次隔离及明确的不完整状态处理。
5. **导航去重范围错误**：按路由永久去重会阻止后续轮次合法地再次打开同一页面。需按事件/轮次去重。
6. **连接与认证恢复**：心跳回调无可见状态；401 只删 storage，没有走统一认证回调；读取会话任何错误都创建新会话。需区分业务不存在、认证失败及临时网络错误。
7. **SSE 解析与资源释放**：前端解析失败仍制造事件并可能推进游标；后端非 2xx 响应体未关闭，无界 cached workers 缺少销毁。需验证协议字段、限制资源并测试释放。

## 整改分工

- DeepSeek Harness：CORS、Java 连接资源生命周期、Python 一致快照恢复契约与回归测试；仅修改后端及后端验证报告。
- ZCode：轮次状态、消息恢复、导航去重、连接状态、认证回调及解析校验；仅修改 web 与前端验证报告。
- Codex：审查两端恢复契约，重新测试并执行跨端验证后才决定合并。Task 30 尚未放行。

当前两边均被要求追加提交，不 amend 已审查提交，不修改共享总计划或交接文档。原测试数量只能说明原提交的测试通过，不能据此批准整改版本。

## 第二轮验收（2026-09-09）

- 对象：后端 `245089a`、前端 `01f85ad`。本轮 fresh pytest 398、Maven 379、Vitest 138 通过。
- CORS 头、资源池限制、前端基本轮次隔离已有修改；整体仍不通过。
- 实际异步探针：暂停知识服务于第一次 `on_delta('PREFIX_ALREADY_STREAMED')` 后读取快照，得到 `cursor=6 active=turn-probe`，但 `partial_in_snapshot=False`、`partial_in_replay=False`。证明快照游标越过未包含在快照内的文字；不能声称刷新恢复完整。
- 前端 onMounted 未恢复 activeTurnId/sending；旧 POST 的条件 `activeTurnId === turnId || !activeTurnId` 仍允许 A 的迟到结果在 B 完成后覆盖 B 的状态。TURN_COMPLETED 没有现存消息槽时不显示最终回答。
- 已通过 Computer Use 分别发送第三轮修正指令。Codex 明确新增恢复契约：`activeTurn: null | {turnId, userMessage, assistantText, lastDeltaIndex}`，必须与 `lastEventSequence` 一致；前端先恢复槽位和进行中状态再订阅。进程重启中断要留下终态证据。
- DeepSeek 第二轮报告承认未先运行失败测试；第三轮已明确要求先复现失败再修改，不能用通过的基础测试替代竞态回归。
- 尚未合并或批准进入 Task 30。

## 第三轮进度检查（2026-09-09）

- 后端已追加 `37ac851`，恢复对象 activeTurn、快照深拷贝及重启中断终态已有实现；Codex 本轮重跑持续流测试 12 项通过。
- 前端检查时仍有 4 个未提交文件，HEAD 仍为 `01f85ad`；已实现恢复状态初始化、请求代际与终态增量拦截。Codex 本轮重跑组件与 SSE 测试 21 项通过。
- 这是局部进度核实，尚未完成合并版本的全量及跨端验收，不批准 Task 29 完成。
