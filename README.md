# StudyPilot

StudyPilot 是 moxiao 个人使用的 Java + AI 交互式学习平台，不是面向通用学科、
教师端或多人课程市场的泛学习平台。登录并绑定路线后，Roadmap 是主要学习入口：沿
12 阶段、64 节点的 Java + AI 路线查看依赖、状态和完整地图，循序推进传统 Java 后端、
Python Agent 与项目操作能力。计划、任务和 Agent 监督用于辅助学习闭环，而不是产品
本体。

阶段 9 已完成的交互式 Course/Lesson 内容继续保留，可通过直接 URL 阅读黑马程序员
课程来源、站内讲义与 StudyPilot 真实代码，并使用课内 AI 导师和练习；它现在是历史
兼容入口，不再占用侧边栏主导航。完整产品范围见
[产品需求说明](docs/studypilot-product-requirements.md)，前端架构和最新公共契约见
[前端开发对接说明](docs/前端开发对接说明.md)。早期 Java 实现记录仍保留在
[后端开发说明](后端开发说明.md)。

默认学习顺序和首批黑马程序员/官方资料见
[Java + AI 基础学习路线](docs/studypilot-java-ai-starter-syllabus.md)。教程推荐优先
检索黑马程序员，技术版本、兼容性和 API 事实优先采用最新官方文档。

## 仓库结构

```text
backend/     Spring Boot：账户、学习计划、任务、测验、权限与审计
ai-service/  FastAPI：RAG、模型路由、Agent 编排与工具调用
runner-service/ Unix Socket + Docker/Podman：受治理的本地测试执行
web/         Vue 3：学习工作台与 Agent 对话界面
infra/       Docker Compose、环境模板与部署配置
docs/        产品、架构、迭代与开发文档
```

## 当前技术基线

- Java 17 + Spring Boot
- Python 3.12 + FastAPI + LangGraph + DeepSeek API
- Vue 3 + TypeScript + Vite + Pinia
- MySQL 8 + Flyway
- LangGraph + DeepSeek + Tavily
- FastEmbed + Qdrant 本地混合检索
- 加密 SQLite Checkpointer
- Docker Compose + Nginx + 可选 Prometheus

## 开发原则

- Java 服务是业务事实来源与权限边界；Python Agent 不直接写核心业务数据库。
- 每个功能以一个小的垂直切片交付：先写失败测试，再实现，再本地验证。
- Agent 普通聊天不会自动授权写操作；计划、任务与调整都使用结构化预览和专用确认。

## 快速启动

原生开发按 MySQL → Spring Boot → FastAPI → Vue 的顺序启动。三个服务端安全值
`INTERNAL_SERVICE_TOKEN`、`AI_CREDENTIAL_MASTER_KEY`、`LANGGRAPH_AES_KEY`
首次生成后必须稳定保存。详细命令、Docker Compose、演示数据和五分钟演示路线见
[部署与演示指南](docs/部署与演示指南.md)。

生成一组不含秘密输出的最小演示数据：

```bash
DEMO_PASSWORD='临时强密码' scripts/demo-data.sh
```

## 全量验证

```bash
cd backend
./mvnw test

cd ../ai-service
.venv/bin/python -m pytest -q
.venv/bin/python -m ruff check app tests

cd ../web
npm test -- --run
npm run typecheck
npm run build
```

## 文档入口

- [Roadmap 驱动学习与项目 Agent 设计](docs/superpowers/specs/2026-08-09-roadmap-driven-self-learning-and-project-agent-design.md)
- [Roadmap Domain Foundation 实施计划](docs/superpowers/plans/2026-08-09-roadmap-domain-foundation.md)
- [Roadmap Foundation 端到端联调](docs/roadmap-foundation-e2e.http)
- [系统架构](docs/architecture.md)
- [部署与演示指南](docs/部署与演示指南.md)
- [阶段 8 公共 API 联调](docs/stage8-release-e2e.http)
- [阶段 8 真实验收结果](docs/stage8-e2e-result.md)
- [阶段 9 课程学习联调](docs/course-learning-e2e.http)
- [阶段 9 真实教学验收结果](docs/course-learning-e2e-result.md)
- [前端开发对接说明](docs/前端开发对接说明.md)
- [Java + AI 基础学习路线](docs/studypilot-java-ai-starter-syllabus.md)
- [AI 服务说明](ai-service/README.md)
- [Local Runner 说明](runner-service/README.md)
- [项目开发步骤](项目开发步骤.md)
- [协同开发交接说明](docs/协同开发交接说明.md)
- [Docker Compose 说明](infra/README.md)

浏览器只调用 Java `/api/**`。`/internal/**` 只用于 Java 与 Python 服务间通信，不能
暴露内部令牌给前端。

## 日常启动与关闭（本机）

在项目根目录执行：

```bash
./start-project.sh
./stop-project.sh
```

启动脚本明确运行 `../project-minimax-task-33/backend` 的后端和
`../project-zcode-task-33` 的 AI 服务、前端，启动时打印各组件路径与 Git 版本。
根目录 `ai-service/.venv` 为共享运行环境（两版本依赖声明相同），
稳定配置与加密会话数据库继续使用根目录 `ai-service` 的已有文件。默认端口分别为
8080、8000、5173。首次启动或后端源码更新时会构建后端；随后逐项等待健康检查，
全部成功后输出网页地址。重复启动只复用同目录、同 Git 版本且源码摘要一致的受管理实例；切换版本须先关闭再启动；启动失败会关闭本次
新启动的服务。进程状态与日志在 `.studypilot-runtime/`，不提交 Git。

运行前需安装 JDK 17、Node.js 和前端依赖，并准备 `ai-service/.venv`、已有
`ai-service/.env` 稳定密钥及后端数据库配置。MySQL 必须已运行。脚本不会自动
安装依赖、生成或替换密钥，也不会关闭共享 MySQL。

按用户设置，启动时会自动关闭占用目标端口的其他服务及其子进程，先正常退出、
超时后强制结束，再启动 StudyPilot。仅关闭监听进程及其后代，不关闭 IDEA 等父应用。
重复启动会复用已由脚本管理的 StudyPilot 服务。需要不同端口时仍可临时指定，
后端、AI 服务与前端之间的地址会同步调整，例如：

```bash
STUDYPILOT_BACKEND_PORT=8081 ./start-project.sh
```

另可设置 `STUDYPILOT_AI_PORT`、`STUDYPILOT_WEB_PORT`。关闭时无需再传端口；
关闭脚本按记录的进程身份关闭三个服务和子进程，先正常退出，超时后强制结束，
并检查进程及端口。重复关闭可安全执行。业务数据和配置会保留。
