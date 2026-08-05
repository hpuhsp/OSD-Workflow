# OSD Workflow

OSD Workflow 是一套面向团队的轻量级、自适应 SDD（规格驱动开发）标准。

OSD Workflow 是顶层编排器，并连接两个必须参与整个工作流的运行时能力：

- **OpenSpec**：在 OSD 规格阶段内作为规格权威来源。
- **Superpowers**：在 OSD 当前阶段内提供执行、验证和评审方法。

OpenSpec 和 Superpowers 必须参与，但都不能替代或重排 OSD Workflow。

OSD 刻意保持为薄编排层：只选择流程深度和最低证据，再把原生规格生命周期委派给 OpenSpec，把执行方法委派给 Superpowers。

项目模板负责提供 `.ai/` 团队契约、`openspec/changes/` 中的活动规格、`openspec/changes/archive/` 中的原生归档，以及 `knowledge/delivery/` 中的精简交付证据。

本仓库是可安装的模板源，不是一个提供业务运行时的应用。请先将它安装到目标项目，再在目标项目中初始化 OpenSpec 工作区。

## 项目概览

![自适应 OSD 交付路由](docs/assets/readme/workflow-loop.png)

![运行时职责契约](docs/assets/readme/runtime-contract.png)

![安装后的项目结构](docs/assets/readme/project-structure.png)

## 设计目标

统一 SDD 结果，不要求所有任务执行同样复杂的流程。

所有任务都必须：

1. 编码前通过 OpenSpec 明确期望行为和验收标准。
2. 通过 Superpowers 编排执行，并保持实现符合已接受规格。
3. 形成聚焦且可验证的结果证据。

## 自适应模式

| 模式 | 适用任务 | 必需流程 |
|---|---|---|
| `lite` | 简单、局部、低风险任务 | OSD 路由 → 精简 OpenSpec → 实现 → 聚焦验证 |
| `standard` | 中等规模日常任务，默认模式 | OSD 路由 → OpenSpec proposal/spec → 批准 → 原子任务 → 实现 → 验证 → 精简评审 |
| `strict` | 复杂、模糊、高风险、跨模块或发布关键任务 | OSD 路由 → 完整 OpenSpec → 规格评审 → 批准 → 原子任务 → 实现 → 完整验证 → 评审 → 归档 |

OpenSpec 和 Superpowers 在三种模式中都必须参与。变化的只是过程深度和产物数量。

## 开发策略

工作流模式与开发策略是两个独立决策：

| 策略 | 适用场景 | 精简证据 |
|---|---|---|
| `tdd` | 核心业务、算法、状态机、权限、计费、公共 API | Red、Green、Refactor |
| `test_first` | Bug 修复、已有行为修改、重构 | 修改前失败、修改后通过 |
| `verification_only` | 文档、配置、纯样式、探索性工作、缺少合理测试边界 | 原因和聚焦验证 |

TDD 是条件化开发策略，不是第四种工作流模式。摘要证据写入现有交付记录；standard 和 strict 另外写入 `verification.json` 结构化证据，不新增独立 TDD 报告。

## 按任务类型路由

| 任务类型 | 规格关注点 | 起始模式 | 默认开发策略 |
|---|---|---|---|
| 新功能 | 用户价值、范围、非目标、验收、兼容性 | `standard` | 可执行行为使用 `tdd` |
| 修 Bug | 复现、实际/预期行为、根因、回归证据 | `lite` | `test_first` |
| 修改已有功能 | 当前行为、目标差异、兼容性、受影响方 | `standard` | `test_first` |
| 重构 | 行为不变量、影响边界、回滚、回归覆盖 | `standard` | `test_first` 特征测试 |
| 维护/文档/配置 | 精确变更、运行影响、聚焦验证 | `lite` | `verification_only` |

当范围、不确定性或风险增大时升级模式。用户也可以明确指定更轻或更严格的模式，但需要记录剩余风险。

## 最小必要产物

`lite` 只要求：

- `openspec/changes/{feature}/spec.md`
- `openspec/changes/{feature}/archive-result.json`
- `knowledge/delivery/{feature}/stage-report.md`

`standard` 增加 OpenSpec proposal、明确批准、机器可读状态、原子任务、结构化验证证据和精简实施计划。所有已验收完成的变更均通过原生 OpenSpec CLI 归档。验证与评审默认合并到 `stage-report.md`，只有在风险控制或交接需要时才单独生成报告；`strict` 额外保留完整设计、验证和评审证据。

`.ai/workflow-manifest.json` 是唯一机器可读产物契约。不要在多个文件中重复相同内容。仅在另一个 Agent 将继续任务时创建 `handoff-brief.md`。

各模式的必需交付文件如下（完整路径和可选产物以 `.ai/workflow-manifest.json` 为准）：

| 模式 | 必需文件 |
|---|---|
| `lite` | `spec.md`、`archive-result.json`、`knowledge/delivery/{feature}/stage-report.md` |
| `standard` | `proposal.md`、`spec.md`、`approval.md`、`osd-state.json`、`tasks.md`、`verification.json`、`archive-result.json`、`knowledge/delivery/{feature}/implementation.md`、`stage-report.md` |
| `strict` | `proposal.md`、`spec.md`、`design.md`、`approval.md`、`osd-state.json`、`tasks.md`、`verification.json`、`archive-result.json`、`implementation.md`、`test-report.md`、`review-report.md`、`stage-report.md` |

## 安装 OSD Workflow

选择一种安装方式。安装器会复制 OSD 契约，并把受控发现区块安全合并到常见 Agent 指令文件中，不覆盖项目已有指令。

使用 Node.js / npx：

```bash
npx --yes github:hpuhsp/OSD-Workflow init --target . --with-docs
```

从克隆的 OSD Workflow 仓库使用 PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -Target D:\WorkPlace\demo -WithDocs
```

模板文件默认跳过已有内容，使用 `--force` / `-Force` 覆盖。Agent 指令文件是例外：安装器只合并或刷新带标记的 OSD 区块。使用 `--dry-run` / `-DryRun` 预览。

安装器默认只生成或合并根目录 `AGENTS.md`。Qoder 通过原生兼容 `AGENTS.md` 接入。如果项目使用 Claude、Gemini、GitHub Copilot 或 Cursor，再按需将同一托管入口复制到对应原生路径：`CLAUDE.md`、`GEMINI.md`、`.github/copilot-instructions.md` 或 `.cursor/rules/osd-workflow.mdc`。安装器不会创建未使用的重复适配器。

### 完成运行时配置

OSD Workflow 安装到项目后：

1. 全局安装 OpenSpec CLI（安装器不会代为安装）：

   ```bash
   npm install -g @fission-ai/openspec@latest
   ```

2. 初始化项目 OpenSpec 工作区：

   ```bash
   openspec init
   ```

3. 确保每位开发者使用的 AI Agent 或 Harness 已提供 Superpowers。它由 Agent/Harness 提供，不会由本仓库复制到目标项目。

## 一键更新

使用当前已安装 CLI 更新现有项目：

```bash
osd-workflow update .
```

直接获取仓库最新版并一键更新：

```bash
npx --yes github:hpuhsp/OSD-Workflow update .
```

同时更新使用文档：

```bash
osd-workflow update . --with-docs
```

PowerShell：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -Target . -Update -WithDocs
```

`update` 只覆盖模板管理的文件，不删除项目自己的活动变更、原生 OpenSpec 归档和交付记录。可以先使用 `--dry-run` 预览，更新后建议检查 Git diff。`--with-docs` 需要显式指定，避免意外更新已安装的使用指南。

Manifest v3 迁移：旧版本创建的活跃交付记录需要补充 `OSD controller: osd_workflow`、非空 `OpenSpec participation` 和非空 `Superpowers participation` 三个字段后再执行校验。

## 日常使用

启动任务：

```text
{任务}
```

Agent 正确加载项目指令后，任何会修改仓库的普通请求都会自动触发 OSD。未加载时使用最短兜底提示：

```text
按 OSD 执行：{任务}
```

Agent 应以 `OSD: <任务类型> | <模式> | <策略> | <当前阶段>` 开始，而不是先宣布 OpenSpec 或 Superpowers 的通用流程。

验证交付：

```bash
node scripts/verify-workflow-artifacts.mjs --feature {feature} --mode {mode}
```

省略 `--mode` 时，校验器优先从 `stage-report.md` 读取模式，否则回退到 manifest 默认值 `standard`。交付校验成功时会输出 `Result: DELIVERY PASS`。

只检查工作流契约：

```bash
node scripts/verify-workflow-artifacts.mjs --structural-only
```

任务场景和提示词示例见 [docs/USAGE_zh.md](docs/USAGE_zh.md)。

## 核心文件

- `.ai/workflows/feature-development.yaml`：面向人的动态路由契约
- `.ai/workflow-manifest.json`：机器可读产物契约
- `.ai/rules/workflow-execution-rule.md`：自适应 SDD 规则
- `.ai/templates/`：精简交付与交接模板
- `AGENTS.md` 等 Agent 适配器：自动发现 OSD，同时保留项目已有指令
- `scripts/verify-workflow-artifacts.mjs`：轻量交付校验器
- `bin/osd-workflow-init.mjs`：Node.js 初始化器
- `scripts/install.ps1`：PowerShell 初始化器

完整使用说明见 [docs/USAGE_zh.md](docs/USAGE_zh.md) 和 [docs/USAGE.md](docs/USAGE.md)。

## License

MIT
