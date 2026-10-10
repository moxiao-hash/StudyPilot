# H02 ZCode 第一轮独立验收

结论：CHANGES_REQUESTED。HEAD 4067628c8d62f696abc9f69a1bee2342a97f9553。7个提交文件均在Owner，临时generate-coverage.mjs已删除，H01指纹未变。

Codex复跑CLI 25/25自检、Vitest H02/H01专项30/30通过。独立CLI探针12项中合法正本和缺依赖拒绝通过，另外10项坏输入全部返回0并显示25/25通过。详情 h02-codex-round2-cross-probes.mjs/json。

## R-Z1 真正验证当前输入与完整Schema

CLI读取schema/metadata只是计算hash；不解析、不按Schema验证、不核对元数据。validateCapabilityManifest仅在9个变异fixture上调用，未对实际传入Manifest执行；TS侧同样只写少数特殊条件。缺description/未知字段/非法output/嵌套ownerId都被实际CLI接受；schema文件不是JSON、metadata不是YAML仍成功。要求对真实输入先做完整Schema与语义验证，未知字段、完整嵌套实例、缺字段/约束、身份/秘密、治理及disabled边界全部失败关闭。不要只证明固定fixture错误能被拒绝；CLI和TS消费能力应对任意新变异一致。

## R-Z2 来源与事实核对

目前 authoritative_facts 只禁止 fabricated_ai_score/hallucinated_metric 两个字面量，其它虚构made_up_metric_893可通过；假handler、过时metadata_hash也通过。要求按真实注册描述符/handler来源及具体output字段核对，schema/metadata/Manifest来源hash与commit相符，不能只验证hash长度/打印指纹或冻结65名字数量。读取上游缺口须明确BLOCKED而非沿用旧文件成功。上游MiniMax第二轮仍有绑定/Schema缺陷，别替其写生产代码/公共Schema。

## R-Z3 独立业务覆盖

覆盖表检查只有31/65等长度；将真实route改为fictionalRoute及/not-registered仍成功。需要和真实router及公开Controller操作清单比对，拒绝重复/遗漏/虚构映射，给未注册操作pending/disabled和原因。当前覆盖表全文未出现RoadmapStageGraduationController、RoadmapDiagnosticController、AgentFacadeController、WebSearchResultController；按真实公开业务审计确认并补明分类，不能仅盘31导航页面。保留用户本人答题/打卡/验收/扩权、权威事实来源。

完整网页或付费模型未测，H02没有新UI。报告必须更新实际上游commit：当前MiniMax HEAD da3bae15，覆盖表仍写ebb6f2b9。不要改对端文件或H01契约；仅Owner红测试/整改、本地提交READY_FOR_CODEX后停在H02。
