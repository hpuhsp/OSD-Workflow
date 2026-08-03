# OSD Workflow 使用指南

## 1. 使用原则

OSD Workflow 控制所有会修改仓库的任务，OpenSpec 和 Superpowers 在其编排下参与：

- OSD 负责任务分类、模式、开发策略、阶段顺序和必需产物。
- OpenSpec 在 OSD 规格阶段内定义预期行为与验收标准。
- Superpowers 在 OSD 当前阶段内提供执行、验证和评审方法。
- 两者都不能替代、前置或重排 OSD 阶段。
- 任务复杂度只决定流程深度和产物数量，不决定是否使用这两项能力。

团队只需要统一三条 SDD 底线：先规格、按规格实现、用证据验证。

OSD 只负责路由和最低结果治理。OpenSpec 负责自身原生规格生命周期，Superpowers 负责其内部计划、实施、TDD、调试、验证和评审方法。

## 2. 六步动态编排

### 第一步：判断任务类型

- `new_feature`：新增能力或用户行为。
- `bug_fix`：修复偏离预期的行为。
- `existing_change`：修改已有功能或历史任务。
- `refactor`：保持外部行为不变的结构调整。
- `maintenance`：文档、配置、依赖或日常维护。

### 第二步：评估复杂度和风险

重点判断：

- 是否跨模块或影响公共接口。
- 期望行为和验收标准是否明确。
- 是否涉及数据迁移、安全、权限、兼容性或发布风险。
- 是否需要多人或多 Agent 协作。

### 第三步：选择模式

#### Lite

用于简单、局部、低风险且预期明确的任务。

流程：OSD 路由 → 精简 OpenSpec spec → 实现 → 聚焦验证。

最小产物：

```text
openspec/changes/{feature}/spec.md
knowledge/archive/{feature}/stage-report.md
```

`lite` 不要求 proposal、实施计划、测试报告或评审报告；只有在它们能改善风险控制或交接时才增加。

#### Standard

用于中等规模日常任务，也是无法确定时的默认模式。

流程：OSD 路由 → OpenSpec proposal/spec → 批准 → 原子任务 → 简短计划 → 实现 → 验证 → 精简评审。

必需产物由 `.ai/workflow-manifest.json` 定义，包括 proposal、spec、implementation 和一份简短交付记录。验证与评审默认写入交付记录，只有风险或交接需要时才生成独立报告。

具体必需文件是 `proposal.md`、`spec.md`、`approval.md`、`osd-state.json`、`tasks.md`、`verification.json`、`knowledge/archive/{feature}/implementation.md` 和 `stage-report.md`。

#### Strict

用于复杂、高风险、跨模块、模糊、合规或发布关键任务。

流程：OSD 路由 → 完整 OpenSpec → 规格评审 → 批准 → 原子任务 → 计划 → 实现 → 完整验证 → 评审 → 归档。

具体必需文件是 `proposal.md`、`spec.md`、`design.md`、`approval.md`、`osd-state.json`、`tasks.md`、`verification.json`、`archive-result.json`、`implementation.md`、`test-report.md`、`review-report.md` 和 `stage-report.md`，分别位于对应的 OpenSpec 与知识归档目录。

### 第四步：选择开发策略

- `tdd`：用于核心业务逻辑、算法、状态机、权限、计费、公共 API 等可执行行为。执行 Red → Green → Refactor。
- `test_first`：用于 Bug、已有行为修改和重构。先建立失败复现或特征测试，再实现到通过。
- `verification_only`：用于文档、配置、纯样式、探索性工作，或不存在合理测试先行边界的任务。必须说明原因。

模式决定流程深度，开发策略决定编码方式。例如，简单核心规则可以是 `lite + tdd`，复杂配置迁移也可能是 `strict + verification_only`。

### 第五步：执行并动态升级

任务开始后发现以下情况，应升级模式：

- 实际影响范围超过预期。
- 规格存在关键歧义。
- 出现兼容性、数据、安全或发布风险。
- 聚焦验证不足以证明结果。

不要因为任务进展顺利而自动降级。需要降级时，由用户确认并记录剩余风险。

### 第六步：运行轻量门禁

```bash
node scripts/verify-workflow-artifacts.mjs --feature {feature} --mode {mode}
```

在目标项目外执行时，可增加 `--target <project>`。省略 `--mode` 时，校验器优先从 `stage-report.md` 读取模式，否则使用 `standard`。交付校验成功输出 `Result: DELIVERY PASS`，仅校验契约成功输出 `STRUCTURAL PASS`。

跨 Agent 交接时增加：

```bash
node scripts/verify-workflow-artifacts.mjs --feature {feature} --mode {mode} --handoff
```

门禁检查必需文件为普通非空文件、批准状态、`AC-*` 验收标准、`T-*` 任务覆盖、结构化验证证据、交付记录字段完整，以及策略对应的证据。它不会执行产物中的任意命令、不审计聊天过程，也不证明外部 Harness 确实被调用。`lite` 默认不受这些较重门禁约束。

## 3. 场景编排

### 简单 Bug

建议模式：`lite`

规格重点：复现、实际行为、预期行为、验收标准、回归验证。

```text
按 OSD 执行：修复 {bug}。
```

### 中等 Bug 或跨模块问题

建议模式：`standard`；涉及数据、安全或发布风险时升级 `strict`。

除简单 Bug 内容外，还要记录根因、影响范围、实施计划和回归风险。

### 小型已有功能修改

建议模式：`lite` 或 `standard`。

规格重点：当前行为、目标差异、不变行为、受影响方。

```text
按 OSD 执行：修改已有功能 {feature}。
```

### 新功能

建议模式：默认 `standard`，跨模块或高风险时使用 `strict`。

规格重点：用户价值、范围、非目标、用户场景、验收标准、兼容性。

```text
按 OSD 执行：实现新功能 {feature}。
```

### 重构

建议模式：局部重构可 `lite`，普通重构用 `standard`，架构重构用 `strict`。

规格重点：必须保持的外部行为、影响边界、回滚方式、回归覆盖。

### 文档、配置、依赖维护

建议模式：通常 `lite`。

仍需精简 OpenSpec spec，但不要创建独立计划和评审报告，除非存在运行或兼容性风险。

## 4. FeishuProjectMcp

需求来自飞书项目时，使用可用的 `FeishuProjectMcp` 集成只拉取路由和规格所需字段，再由 OSD 完成分类和模式选择，随后委派 OpenSpec 建立规格，并由 Superpowers 在选定阶段内执行。若集成不可用，只有在已有需求上下文足够时才继续，并应明确记录来源；不要把猜测或模拟数据当作真实飞书读取结果。

```text
按 OSD 执行：基于飞书需求 {链接或 ID} 完成开发。
```

只读取当前决策需要的评论、附件和历史，避免无差别加载全部上下文。

## 5. 一键更新 Workflow

```bash
osd-workflow update .
```

直接获取并应用 GitHub 最新版本：

```bash
npx --yes github:hpuhsp/OSD-Workflow update .
```

增加 `--with-docs` 可同步更新使用指南，增加 `--dry-run` 可先预览。更新只覆盖模板管理文件，不删除项目自己的 OpenSpec 变更和知识归档。

把活跃交付从 manifest v3 升级时，需要按照迁移说明增加批准、状态、任务和结构化证据产物。遗留 v3 校验必须显式报告，不能静默宣称已具备 v4 保证。

## 6. 交付记录

standard/lite 使用 `.ai/templates/stage-report-compact.md`，只记录：

- 任务类型和模式。
- OSD、OpenSpec、Superpowers 参与证据。
- 规格路径。
- 修改文件。
- 验证命令、退出码和简短结果。
- 评审结果或 N/A。
- 剩余风险。

strict 才使用完整模板。`handoff-brief.md` 仅在另一个 Agent 继续任务时生成。

## 7. Agent 自动发现与最简提示

安装器默认只把 OSD 受控区块安全加入根目录 `AGENTS.md`。新建 Agent 会话后，通常只需直接描述任务：

```text
修复登录超时问题。
```

如果 Agent 没有加载项目指令，使用：

```text
按 OSD 执行：{任务}
```

正确的启动响应示例：

```text
OSD: bug_fix | lite | test_first | specification
```

“Superpowers 已加载，接下来头脑风暴、计划、实现……”属于错误启动方式，因为它绕过了 OSD 路由和阶段所有权。

Qoder 通过原生 `AGENTS.md` 兼容能力支持 OSD。请保留项目根目录生成的 `AGENTS.md`，不要再创建 `.qoder/rules` 副本。如果项目使用其他 Agent，再按需将托管区块复制到 `CLAUDE.md`、`GEMINI.md`、`.github/copilot-instructions.md` 或 `.cursor/rules/osd-workflow.mdc`；Cursor 还需要 `alwaysApply: true` frontmatter。
