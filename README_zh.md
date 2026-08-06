# OSD Workflow 2.0

OSD 是一个全局 CLI，为任意代码仓库提供轻量、native-first 的 AI 交付契约。它编排环境中已经可用的能力，而不是向每个项目复制一套工作流模板。

OSD 优先使用 OpenSpec 与 Superpowers 的原生能力；原生能力不可用时，才使用最小 fallback。任务轻重由运行时 `dynamic_routing` 决定，不通过初始化 preset 决定。

## 项目提供什么

- 两个全局命令别名：`osd` 与 `osd-workflow`。
- 一个基于 `osd.config/v2` 的轻量项目契约 `.osd/`。
- Qoder、Claude、Gemini、Trae、Cursor 的可选原生规则文件。
- 可观测的逐阶段 adapter 选择与 fallback 状态。

OSD 默认不会生成 `AGENTS.md`、`.ai/`、`openspec/`、`knowledge/` 或 `scripts/`，也不会替代 Agent 自身的规则和工具。

## 快速开始

### 1. 全局安装 OSD

当 npm registry 中已发布该包时：

```bash
npm install --global osd-workflow
```

也可以直接从 GitHub 安装当前源码：

```bash
npm install --global github:hpuhsp/OSD-Workflow
```

确认命令可用：

```bash
osd --help
# 等价别名：osd-workflow --help
```

### 2. 初始化项目

进入需要配置的项目根目录后执行：

```bash
cd path/to/your-project
osd init
```

交互终端会显示 Agent 多选。CI、脚本或需要可重复执行时，显式指定目标：

```bash
osd init --agents qoder,cursor --yes
```

默认只创建以下项目文件：

```text
.osd/config.json
.osd/rules/workflow.md
<用户选择的 Agent rule 文件>
```

支持的 Agent target：`qoder`、`claude`、`gemini`、`trae`、`cursor`。还可使用 `all`、`none`、`auto`：

```bash
osd init --agents all --yes
osd init --agents none --yes
osd init --agents qoder,claude --yes --dry-run
```

重复执行 `init` 时，OSD 仅更新 Agent rule 中的 managed block，并保留用户已有内容。

### 3. 检查当前 adapter

```bash
osd doctor
osd adapters list
```

`doctor` 会校验配置、检查所选 Agent rule、检测 OpenSpec 与 Superpowers、识别验证命令，并报告每个阶段最终选择的 adapter。

## Native-First 工作流

`.osd/config.json` 定义六个工作流阶段。每个阶段先选择 preferred 原生 adapter；只有在 `fallback_allowed` 启用时，才会使用对应 fallback。

| 阶段 | Preferred adapter | Fallback |
| --- | --- | --- |
| specification | OpenSpec | OSD markdown specification |
| planning | Superpowers writing-plans | OSD minimal plan |
| implementation | Superpowers TDD | Agent-native execution |
| verification | Superpowers verification | configured command |
| review | Superpowers review | Agent review |
| archive | OpenSpec | OSD markdown archive |

原生 adapter 不可用时，`osd doctor` 会明确显示 fallback 选择，任务证据中也应记录该状态。OSD 不提供 `light`、`standard`、`full` 或 preset 初始化档位。

## 配置

生成的 `.osd/config.json` 使用 `osd.config/v2`，包含：

```text
native_first, dynamic_routing, fallback_allowed,
agents, workflow, governance, commands
```

项目需要固定验证命令时，可设置 `commands.verify`。否则 OSD 在初始化时会尝试识别常见包管理器的测试命令。

## 延伸阅读

- [使用指南](docs/USAGE_zh.md)
- [English usage guide](docs/USAGE.md)
- [OSD 2.0 产品规格](docs/OSD_2_0_IMPROVEMENT_SPEC_zh.md)
