# OSD Workflow

## 面向 AI 辅助交付的 Native-First 工作流编排器

OSD 是一个全局 CLI，为已有软件项目增加轻量、明确的工作流契约。它优先编排开发环境中已经可用且能力更强的原生工具；只有原生能力不可用时，才使用最小 fallback。

OSD 不是项目模板，不替代 Agent，也不是另一套执行框架。它为开发者和编码 Agent 提供一致的方式来判断任务需要哪些环节、由哪个 adapter 执行，以及交付后应留下哪些证据。

## 为什么需要 OSD

AI 辅助交付通常会走向两个极端：所有修改都被迫遵循过重的流程，或有实际风险的工作完全跳过规格、验证和评审。OSD 通过四条原则解决这个问题：

1. **全局 CLI，项目轻量**：全局安装一次，每个项目只维护一个 `.osd` 契约。
2. **Native-first**：优先使用 OpenSpec、Superpowers 和 Agent 自身的原生能力，不重复造轮子。
3. **运行时路由**：根据实际工作中的范围、风险和不确定性决定任务深度，而不是通过初始化 preset 固化流程。
4. **可观测 fallback**：原生 adapter 不可用时，使用配置允许的 fallback，并在诊断和交付证据中明确显示该选择。

## 工作模型

每项非平凡任务都经过相同的六个阶段。adapter 可以变化，但交付目标不变。

```text
Specification -> Planning -> Implementation -> Verification -> Review -> Archive
```

| 阶段 | Native-first adapter | 最小 fallback |
| --- | --- | --- |
| Specification | OpenSpec | OSD markdown specification |
| Planning | Superpowers writing-plans | OSD minimal plan |
| Implementation | Superpowers TDD | Agent-native execution |
| Verification | Superpowers verification | 项目验证命令 |
| Review | Superpowers review | Agent review |
| Archive | OpenSpec | OSD markdown archive |

adapter、治理规则、已选择的 Agent rule 与验证命令都保存在 `.osd/config.json`，schema 为 `osd.config/v2`。

## 快速开始

### 1. 全局安装

当 npm registry 中已发布 `osd-workflow` 时：

```bash
npm install --global osd-workflow
```

也可以直接从 GitHub 安装当前源码：

```bash
npm install --global github:hpuhsp/OSD-Workflow
```

OSD 提供两个等价命令：

```bash
osd --help
osd-workflow --help
```

### 2. 初始化项目

进入待配置项目的根目录：

```bash
cd path/to/project
osd init
```

交互模式会显示 banner 并让你选择 Agent target。CI、脚本和可重复执行的环境应显式传入全部选项：

```bash
osd init --agents qoder,cursor --yes
```

初始化只创建：

```text
.osd/config.json
.osd/rules/workflow.md
<用户选择的 Agent rule 文件>
```

支持的 Agent target：`qoder`、`claude`、`gemini`、`trae`、`cursor`。

```bash
osd init --agents all --yes
osd init --agents none --yes
osd init --agents qoder,claude --yes --dry-run
```

重复初始化仅更新 Agent rule 中 OSD 的 managed block，不会删除用户内容，也不会重复插入该 block。

### 3. 检查环境

```bash
osd doctor
osd adapters list
```

`doctor` 会检查 OSD 配置、已选 Agent rule、OpenSpec、Superpowers、项目验证命令，以及每个阶段最终选择的 adapter。`adapters list` 仅展示 adapter 的可用性，不提供项目健康汇总。

## 项目契约

OSD 在 `.osd/config.json` 中写入以下配置键：

```text
schema: osd.config/v2
native_first
dynamic_routing
fallback_allowed
agents
workflow
governance
commands
```

项目需要固定验证命令时设置 `commands.verify`。未设置时，OSD 会在初始化期间识别常见包管理器的测试命令。

## OSD 不做什么

- 不向项目复制 `.ai/`、`openspec/`、`knowledge/`、`scripts/` 或 `AGENTS.md`。
- 不设计 `light`、`standard`、`full` 或 preset 初始化档位。
- 不替代 OpenSpec、Superpowers 或 Agent 自身的原生工作流。
- 不要求托管服务、调度器、RAG 存储或控制平面。

## 产品规格

[OSD 2.0 产品规格](docs/OSD_2_0_IMPROVEMENT_SPEC_zh.md)以中文维护。
