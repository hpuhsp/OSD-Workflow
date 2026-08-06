# OSD Workflow 2.0

OSD 是全局 CLI，为已有项目添加轻量、native-first 的工作流契约；它不再复制项目模板。

全局安装后，在项目中使用任一命令别名：

```bash
npm install --global osd-workflow
osd init
# 或 osd-workflow init
```

默认只生成：

```text
.osd/config.json
.osd/rules/workflow.md
```

Agent rule 按需生成，支持 `qoder`、`claude`、`gemini`、`trae`、`cursor`：

```bash
osd init --agents qoder,cursor --yes
osd init --agents all --yes
```

不会默认生成 `AGENTS.md`、`.ai/`、`openspec/`、`knowledge/` 或 `scripts/`。重复执行 `init` 只更新 Agent 文件中的 OSD managed block，并保留用户内容。

## Native-First Adapter

`.osd/config.json` 的 schema 为 `osd.config/v2`，包含 `native_first`、`dynamic_routing`、`fallback_allowed`、Agent、workflow、governance 与 commands。

工作流依次经过 `specification`、`planning`、`implementation`、`verification`、`review`、`archive`。OpenSpec 和 Superpowers 可用时优先使用原生能力；不可用时按阶段使用最小 fallback，并在诊断中标记 fallback 使用。

任务轻重由运行时 `dynamic_routing` 决定，不存在 light/standard/full 或 preset 初始化档位。

## 诊断

```bash
osd doctor
osd adapters list
```

`doctor` 报告配置、Agent rule、OpenSpec、Superpowers、验证命令和每个阶段的 adapter resolution。自动化场景使用 `--agents`、`--yes`、`--dry-run`，不会等待交互输入。

详细说明见 [使用指南](docs/USAGE_zh.md) 与 [OSD 2.0 产品规格](docs/OSD_2_0_IMPROVEMENT_SPEC_zh.md)。
