# OSD 2.0 架构与 1.x 迁移

## 结论

2.0 不再把 1.x 的 `.ai/` 目录整体复制到每个项目，但没有删除其工作流价值。1.x 的规则、manifest、模板、状态、证据和归档思想被收敛为全局 CLI 的交付契约，并在任务启动时写入 `.osd/changes/<feature>/`。因此项目轻量化不等于治理能力消失。

## 资产映射

| 1.x 资产 | 2.0 归属 | 使用时机 |
| --- | --- | --- |
| `.ai/AI_WORKFLOW.md`、执行规则 | `assets/workflow-rule.md`，初始化时写入 `.osd/rules/workflow.md` | 项目初始化 |
| workflow manifest | `assets/osd-contract-v2.json` 与 `.osd/config.json` | 初始化与 CLI 路由 |
| proposal/spec/tasks 模板 | CLI 的 fallback 资产模板 | `osd start --adapter fallback` |
| `osd-state.json` | `.osd/changes/<feature>/state.json` | `osd start` 及每次阶段转换 |
| verification/evaluation | `.osd/changes/<feature>/verification.json` | `osd verify` |
| review/delivery record | `.osd/changes/<feature>/review.json`、`delivery.md` | `osd review` |
| runtime governance | `assets/runtime-governance-policy.json` 和 `.osd/changes/<feature>/context/`、`events.jsonl`、`evaluation.json`、`summary.md` | `osd context/authorize/event/evaluate/summarize` |
| OpenSpec archive record | `openspec archive` 原生结果 + `.osd/archive/.../archive.json` | `osd archive` |

## 职责边界

OSD 控制链路，OpenSpec 控制其原生规格生命周期，Superpowers 控制其原生执行方法，Agent 执行实际变更。规则只用于让 Agent 取得正确上下文；能否交付由 OSD 的状态、文件证据和命令退出码决定。

## 为什么不用恢复完整 `.ai` 复制

完整复制让每个项目携带大量并不总会使用的模板、schema 和运行脚本，也造成升级困难。2.0 让全局包保存标准定义，项目只保存属于该项目、该 feature 的事实。需要严格交付时，`.osd/changes` 会自然增长；不需要时，项目不会被无关模板污染。
