# H02 ZCode 第四轮独立交叉审查

HEAD 748c2056b9c5d4ac2d4dcc9c56f71c89d4443130：CHANGES_REQUESTED。旧R-Z7/R-Z8的10项定向探针及22测试通过；新6项检查仅正本通过，5非法输入真实CLI仍退出0。

证据：h02-codex-zcode-round4-extra-probes.json/mjs，使用当前最新MiniMax Manifest/Schema和DeepSeek metadata的显式路径，临时目录变异，无生产/他端修改。

## R-Z9 内容来源校验

非重复64位假descriptors_hash `0123456789abcdef`重复4次仍接受；实际存在但与当前产物来源无关的共同基线commit 16b37d34仍接受。consumer第793行仅格式/重复字符筛选，第807行仅git对象存在性；不能声称verified non-forged hash。要求显式描述符/source-root输入，对真实内容hash及源commit对应字节/文件溯源进行比较，不以魔术值、长度或存在性替代。合法原输入保持通过；缺来源依赖失败关闭。

## R-Z10 公共业务操作与事实覆盖

删空backend_controller_audit、将真实endpoint换成POST /api/imaginary-business-action、将authoritative_facts_sources.javaService换成ImaginaryService.makeUpProgress均仍接受。consumer第759行只检查4个源文件存在，不检查覆盖行/endpoint内容。独立源码发现backend共有51个Controller文件（此数量仅为检查范围提示，不作为通过标准）。要求按实际公开HTTP映射操作逐项核对来源与覆盖；注册工具、未注册/禁用/用户专属操作明确分类，router匹配不代表全部业务已覆盖。事实工具/字段/Java服务来源须真实且配对一致。不要单纯增加硬编码Controller名称或假endpoint哨兵。

先红测试后修，加合法控制和非哨兵反例，报告期望/实际/来源和限制。只原ZCode Owner文件；不修改生产、MiniMax/DeepSeek、H01或Codex历史日志。交付READY_FOR_CODEX本地提交后停H02。无push/merge/deploy、模型密钥/服务/真实数据/付费评测，H03未授权。
