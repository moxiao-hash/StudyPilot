# H02 MiniMax 第四轮独立验收

CHANGES_REQUESTED，HEAD6c2b7e90e33c6a877b7d4464da3c1f455997307a，实现727b7b8。独立37/37 Node测试、上一轮15/15探针通过（新round4文件，未覆盖历史）。最新DeepSeek类型化正本编译成功。原7项定向缺陷关闭，但额外5检查仅正本通过，4非法例仍接受。

R-M9：必须把真实注册工具集合与描述符/metadata集合双向相等核对。两端同时删除governance.health.get仍成功，不能仅验证输入每项是已注册。

R-M10：input属性not:{const:1}且输入1、if:{const:1}/then:{minimum:2}且输入1、false布尔属性Schema且仍提供该属性，均接受。完整Schema执行或不支持立即拒绝；禁止allowlist接受后静默忽略。最终Manifest Schema不存在时当前existsSync跳过校验也需失败关闭，不能缺依赖成功。新增完整反例及合法基线，CLI/API/验证器一致，保留原改进。

证据h02-codex-minimax-round4-probes.json/mjs、round4-extra-probes.json/mjs。合成离线，非业务执行/模型证据。等待稳定Schema后需更新DeepSeek来源冻结并三端交叉，不能现在整体验收通过。原Owner范围修复，先红测试、本地提交READY后停H02。禁止生产/他端/H01修改、push merge deploy、模型密钥服务/真实数据操作，H03未授权。
