# 2026-10-07 回答失败与日常运行版本修复验收

用户明确改为由 Codex 直接修改，本次不再使用 ZCode/MiniMax 执行端。仅修复 Task 33 试用缺陷。业务改动留在既有两个工作树，未提交或推送，未合并 main。

## 改动

- 后端工作树 `project-minimax-task-33`：当前路线工具使用 owned `currentMapIfPresent`，无路线返回 HTTP 200、`data:null`、`truncated:false`；输出 Schema 声明 nullable，校验器仅接受契约允许的 null。公开路线 API 未报名仍 404，真实错误不吞掉。
- 本地配置 `spring.jackson.default-property-inclusion=non_null` 原先省略上下文路线字段。对 `AgentLearningContext.roadmap` 指定 ALWAYS；回归测试使用同一配置，区分明确为空和上下文缺失。
- AI/Web 工作树 `project-zcode-task-33`：复用已有回答逻辑，补完整轮次测试，空路线仍总结其他任务，真正后端 500 仍失败。前端失败文案改为“本轮查询或操作未完成，请重试”。已验收版本的过程面板默认折叠随此次切换生效。
- 根启动脚本明确选择上述两个工作树。稳定配置、加密会话 SQLite、Qdrant 与缓存仍使用根目录已有文件；共享根目录 Python 环境，两版本依赖声明相同且全量测试通过。启动输出组件路径和基线 Git 版本，管理状态核对 cwd、revision、源码摘要，阻止复用旧实例；孤儿进程归属限定配置组件根目录。保留端口清理、父进程保护、关闭及回滚。

## 验证

- 初次 RED：未报名路线工具 `Status expected:<200> but was:<404>`。第二次真实配置 RED：上下文明确 null 断言 `expected:<true> but was:<false>`。修复后同配置通过。
- JDK17 `./mvnw -q clean test` 成功；清空旧报告后 **592 项运行，585 通过，7 跳过，0 失败/错误**。有路线紧凑输出、无路线、跨 Owner、公开 API 404 均覆盖。不声称默认跳过的真实 IDE 握手通过。
- AI 全量 **573 passed**，1 条依赖弃用警告；最终相关文件 **17 passed**、ruff 通过。前端 **35 文件 / 328 测试通过**，类型检查与构建通过。矩阵 **31 路由 / 65 工具**及 4 项自测通过。
- bash 语法、三处 diff 检查通过。旧实例正确拒绝复用；实际关闭三服务、最终重建 JAR 并启动，三个健康检查通过，重复启动复用。新后端验证 **47 个迁移**，MySQL schema 47，无迁移必要。
- 同一真实用户工具实测：路线 HTTP **200**、`data:null`；上下文 HTTP **200**、明确存在 `roadmap:null`。
- 真实页面重问“我当前的学习进度是？”得到“**你尚未加入任何学习路线，暂无学习进度记录。**”，**3 步全部成功**。路线页显示真实未开启状态。截图 `/tmp/studypilot-answer-fixed.png`，旧历史回复未改写。

有路线/无路线数据测试使用隔离夹具。真实账号未新增路线、学习任务、打卡或掌握度记录。日常三服务保持运行，等待用户继续试用；未发布或开发下一 Task。
