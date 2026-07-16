# OSD Workflow

OSD Workflow 是一个轻量级项目初始化模板，用于在真实软件项目中验证 OpenSpec + Superpowers 的 AI Coding Workflow。

它不实现 OpenSpec，也不实现 Superpowers。它提供的是项目级工作流契约、规则、Skill 映射和知识归档结构，用来连接：

- 用户级 Superpowers：负责 AI Agent 执行编排、流程纪律和验证门禁。
- 项目级 OpenSpec：负责需求规格、设计决策、验收标准、变更历史和知识归档。

## 项目定位

该模板用于帮助团队从直接 Prompt 到代码的方式，转向可追溯的软件工程闭环：

![可追溯研发闭环](docs/assets/readme/workflow-loop.png)

目标是在建设更重的平台、市场、网关或 CI 自动化体系之前，先验证一套可复制、可落地的 AI 研发工作流。

## 本地环境约定

推荐配置方式：

- Superpowers 安装并配置在用户级。
- OpenSpec 安装并配置在项目级。
- 本仓库提供项目级 `.ai` 工作流资产。
- OpenSpec 变更资产存放在 `openspec/changes/{feature}/`。
- 已完成需求的知识归档存放在 `knowledge/archive/{feature}/`。

职责分层：

![运行时职责分层](docs/assets/readme/runtime-contract.png)

Superpowers 回答“Agent 应该如何执行工作”。

OpenSpec 回答“项目为什么改、改什么、如何验收”。

## 目录结构

![项目模板目录结构](docs/assets/readme/project-structure.png)

## 工作流

默认工作流定义在 `.ai/workflows/feature-development.yaml`。

阶段包括：

1. 需求分析
2. OpenSpec 创建
3. 规格评审
4. 实施计划
5. AI 编码
6. CodeGraph 影响分析
7. 测试生成
8. 验证
9. 代码评审
10. 知识归档

## 核心文件

- `.ai/AI_WORKFLOW.md`：工作流总览和本地环境约定。
- `.ai/workflows/feature-development.yaml`：阶段定义和运行时职责映射。
- `.ai/rules/development-rule.md`：开发实施规则。
- `.ai/rules/testing-rule.md`：测试生成与验证规则。
- `.ai/rules/code-review-rule.md`：代码评审优先级和输出要求。
- `.ai/skills/openspec-create/SKILL.md`：OpenSpec 变更创建映射。
- `.ai/skills/implementation-plan/SKILL.md`：编码前实施计划。
- `.ai/skills/test-generation/SKILL.md`：测试与验证生成。
- `.ai/skills/knowledge-archive/SKILL.md`：知识归档结构和完成标准。
- `.ai/agents/developer-agent.yaml`：开发 Agent 上下文契约。
- `.ai/agents/test-agent.yaml`：测试 Agent 上下文契约。
- `bin/osd-workflow-init.mjs`：Node.js CLI 安装器。
- `scripts/install.ps1`：PowerShell CLI 安装器。

## 使用方式

1. 将 `.ai/`、`openspec/` 和 `knowledge/` 复制到真实项目。
2. 在目标项目中配置 OpenSpec。
3. 确保团队成员本地用户级环境已安装并配置 Superpowers。
4. 每个需求在 `openspec/changes/{feature}/` 下创建 OpenSpec 变更。
5. 使用 `.ai/workflows/feature-development.yaml` 作为工作流契约。
6. 需求完成后归档到 `knowledge/archive/{feature}/`。

提示词模板、项目自定义指令、多 Agent 使用方式和飞书 MCP 集成说明见 `docs/USAGE.md` 和 `docs/USAGE_zh.md`。

## 一键接入开发项目

可以使用 CLI 安装器将这套 Workflow 接入已有开发项目。

PowerShell，推荐 Windows 使用：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Join-Path $env:TEMP 'osd-workflow-install.ps1'; iwr https://raw.githubusercontent.com/hpuhsp/OSD-Workflow/main/scripts/install.ps1 -OutFile $p; & $p -Target . -WithDocs"
```

从本仓库克隆目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -Target D:\WorkPlace\demo -WithDocs
```

Node.js / npx：

```bash
npx --yes github:hpuhsp/OSD-Workflow --target . --with-docs
```

常用参数：

- `--target` / `-Target`：目标项目目录。
- `--with-docs` / `-WithDocs`：同时复制 `docs/` 使用指南。
- `--dry-run` / `-DryRun`：只预览变更，不写入文件。
- `--force` / `-Force`：覆盖已有 Workflow 文件。

安装器默认不会覆盖已有文件。

## 开发使用说明：从飞书需求到代码

本节描述当需求来自飞书时，团队应如何按该模板完成一条研发闭环。

### 1. 收集需求上下文

编码前至少收集以下信息：

- 飞书项目或任务链接。
- 需求标题。
- 业务背景和用户问题。
- 验收标准。
- 评论、决策、截图或附件。
- 期望发布时间或优先级约束。

建议归档位置：

```text
knowledge/archive/{feature}/requirement.md
```

### 2. 创建项目级 OpenSpec 变更

为该需求创建独立 OpenSpec 变更：

![OpenSpec 变更包](docs/assets/readme/openspec-change.png)

使用 `.ai/skills/openspec-create/SKILL.md` 作为映射指南。

OpenSpec 变更应说明：

- 为什么需要改。
- 需要改变什么行为。
- 哪些内容明确不在范围内。
- 如何验收。
- 可能影响哪些模块、接口或数据流。

### 3. 编码前完成规格评审

实施前应评审：

- `openspec/changes/{feature}/proposal.md`
- `openspec/changes/{feature}/spec.md`
- `openspec/changes/{feature}/design.md`
- `.qoder/repowiki`，如果项目已提供
- `.codegraph`，如果项目已提供

OpenSpec 创建后，不再只把飞书原始描述作为唯一事实来源。已确认的 OpenSpec 变更应成为项目级事实来源。

### 4. 生成实施计划

使用 `.ai/skills/implementation-plan/SKILL.md` 和 `.ai/rules/development-rule.md` 形成实施计划：

- 影响模块和文件。
- 必要实施步骤。
- 数据模型、API 或兼容性影响。
- 测试与验证范围。
- 已知风险和假设。

建议归档位置：

```text
knowledge/archive/{feature}/implementation.md
```

### 5. 通过用户级 Superpowers 执行实现

使用用户级 Superpowers 编排本地 AI Agent 执行流程。

项目级资产提供上下文和约束：

- `.ai/workflows/feature-development.yaml`
- `.ai/rules/development-rule.md`
- `.ai/rules/testing-rule.md`
- `.ai/rules/code-review-rule.md`
- `openspec/changes/{feature}/`

实现范围应严格对齐已确认的 OpenSpec 变更。

### 6. 生成并执行验证

使用 `.ai/skills/test-generation/SKILL.md` 和 `.ai/rules/testing-rule.md`。

每条验收标准至少应映射到一种验证方式：

- 自动化测试。
- 手工验证步骤。
- 静态检查。
- 评审证据。

建议归档位置：

```text
knowledge/archive/{feature}/test-report.md
```

### 7. 评审并归档

使用 `.ai/rules/code-review-rule.md` 作为代码评审优先级。

需求完成后归档为可复用研发知识单元：

![知识归档单元](docs/assets/readme/knowledge-archive.png)

归档内容应说明为什么改、改了什么、如何验证，以及还有哪些后续事项。

## 预期产物

每个真实需求至少应形成：

- `openspec/changes/{feature}/proposal.md`
- `openspec/changes/{feature}/spec.md`
- `openspec/changes/{feature}/design.md`
- `knowledge/archive/{feature}/requirement.md`
- `knowledge/archive/{feature}/implementation.md`
- `knowledge/archive/{feature}/test-report.md`
- `knowledge/archive/{feature}/review-report.md`

## 非目标

该模板不提供：

- Harness 平台。
- SkillsHub 平台化管理。
- MCP Marketplace。
- GitLab AI 自动化体系。
- LLM Gateway。
- OpenSpec 或 Superpowers 的替代实现。

## License

本项目采用 MIT 开源许可证。详情见 `LICENSE`。
