# OSD Workflow

OSD Workflow 是一套面向团队的轻量级、自适应 SDD（规格驱动开发）标准。

OSD Workflow 是顶层编排器，并连接两个必须参与整个工作流的运行时能力：

- **OpenSpec**：在 OSD 规格阶段内作为规格权威来源。
- **Superpowers**：在 OSD 当前阶段内提供执行、验证和评审方法。

OpenSpec 和 Superpowers 必须参与，但都不能替代或重排 OSD Workflow。

OSD 刻意保持为薄编排层：只选择流程深度和最低证据，再把原生规格生命周期委派给 OpenSpec，把执行方法委派给 Superpowers。

项目模板负责提供 `.ai/` 团队契约、`openspec/changes/` 规格资产，以及 `knowledge/archive/` 中的精简交付证据。

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
| `standard` | 中等规模日常任务，默认模式 | OSD 路由 → OpenSpec proposal/spec → 计划 → 实现 → 验证 → 精简评审 |
| `strict` | 复杂、模糊、高风险、跨模块或发布关键任务 | OSD 路由 → 完整 OpenSpec → 规格评审 → 计划 → 实现 → 完整验证 → 评审 → 归档 |

OpenSpec 和 Superpowers 在三种模式中都必须参与。变化的只是过程深度和产物数量。

## 开发策略

工作流模式与开发策略是两个独立决策：

| 策略 | 适用场景 | 精简证据 |
|---|---|---|
| `tdd` | 核心业务、算法、状态机、权限、计费、公共 API | Red、Green、Refactor |
| `test_first` | Bug 修复、已有行为修改、重构 | 修改前失败、修改后通过 |
| `verification_only` | 文档、配置、纯样式、探索性工作、缺少合理测试边界 | 原因和聚焦验证 |

TDD 是条件化开发策略，不是第四种工作流模式。证据写入现有交付记录，不新增独立 TDD 报告。

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
- `knowledge/archive/{feature}/stage-report.md`

`standard` 增加 OpenSpec proposal 和精简实施计划。验证与评审默认合并到 `stage-report.md`，只有在风险控制或交接需要时才单独生成报告；`strict` 保留完整设计、验证、评审和归档证据。

`.ai/workflow-manifest.json` 是唯一机器可读产物契约。不要在多个文件中重复相同内容。仅在另一个 Agent 将继续任务时创建 `handoff-brief.md`。

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

安装器会生成或合并 `AGENTS.md`、`CLAUDE.md`、`GEMINI.md`、`.github/copilot-instructions.md` 和 `.cursor/rules/osd-workflow.mdc`。这些适配器只指向同一个 `.ai` 契约，不重复维护完整流程。

### 完成运行时配置

OSD Workflow 安装到项目后：

1. 全局安装 OpenSpec CLI：

   ```bash
   npm install -g @fission-ai/openspec@latest
   ```

2. 初始化项目 OpenSpec 工作区：

   ```bash
   openspec init
   ```

3. 确保每位开发者使用的 AI Agent 或 Harness 已提供 Superpowers。

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

`update` 只覆盖模板管理的文件，不删除项目自己的 OpenSpec 变更和知识归档。可以先使用 `--dry-run` 预览，更新后建议检查 Git diff。

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

## License

MIT
