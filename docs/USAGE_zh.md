# OSD Workflow 使用指南

## 1. 使用原则

OSD Workflow 要求 OpenSpec 和 Superpowers 在所有任务中参与：

- OpenSpec 始终负责定义预期行为与验收标准。
- Superpowers 始终负责任务路由、执行编排、验证和评审纪律。
- 任务复杂度只决定流程深度和产物数量，不决定是否使用这两项能力。

团队只需要统一三条 SDD 底线：先规格、按规格实现、用证据验证。

## 2. 五步动态编排

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

流程：Superpowers 路由 → 精简 OpenSpec spec → 实现 → 聚焦验证。

最小产物：

```text
openspec/changes/{feature}/spec.md
knowledge/archive/{feature}/test-report.md
knowledge/archive/{feature}/stage-report.md
```

#### Standard

用于中等规模日常任务，也是无法确定时的默认模式。

流程：Superpowers 路由 → OpenSpec proposal/spec → 简短计划 → 实现 → 验证 → 精简评审。

必需产物由 `.ai/workflow-manifest.json` 定义，通常包括 proposal、spec、implementation、test-report、review-report 和一份简短交付记录。

#### Strict

用于复杂、高风险、跨模块、模糊、合规或发布关键任务。

流程：Superpowers 路由 → 完整 OpenSpec → 规格评审 → 计划 → 实现 → 完整验证 → 评审 → 归档。

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

跨 Agent 交接时增加：

```bash
node scripts/verify-workflow-artifacts.mjs --feature {feature} --mode {mode} --handoff
```

门禁只检查最小必要事实：文件有效、规格包含验收标准、验证有结果、交付记录完整。它不审计聊天过程，也不要求每阶段单独报告。

## 3. 场景编排

### 简单 Bug

建议模式：`lite`

规格重点：复现、实际行为、预期行为、验收标准、回归验证。

```text
使用 Superpowers 和 OpenSpec，按 OSD Workflow lite 模式修复 {bug}。
先在 OpenSpec spec 中记录复现、实际/预期行为和验收标准。
选择 test_first，先建立失败回归证据，再实现最小修复到测试通过，并写入精简交付记录。
```

### 中等 Bug 或跨模块问题

建议模式：`standard`；涉及数据、安全或发布风险时升级 `strict`。

除简单 Bug 内容外，还要记录根因、影响范围、实施计划和回归风险。

### 小型已有功能修改

建议模式：`lite` 或 `standard`。

规格重点：当前行为、目标差异、不变行为、受影响方。

```text
使用 Superpowers 和 OpenSpec 修改已有功能 {feature}。
先判断影响范围并选择 lite 或 standard。
OpenSpec 必须明确当前行为、目标差异、不变行为和验收标准。
```

### 新功能

建议模式：默认 `standard`，跨模块或高风险时使用 `strict`。

规格重点：用户价值、范围、非目标、用户场景、验收标准、兼容性。

```text
使用 Superpowers 和 OpenSpec，按 OSD Workflow 处理新功能 {feature}。
先完成任务分类与模式选择。
在编码前确认 OpenSpec proposal/spec；只有 strict 或设计复杂时才要求完整 design。
核心可执行行为默认选择 tdd，并记录 Red、Green、Refactor 精简证据。
```

### 重构

建议模式：局部重构可 `lite`，普通重构用 `standard`，架构重构用 `strict`。

规格重点：必须保持的外部行为、影响边界、回滚方式、回归覆盖。

### 文档、配置、依赖维护

建议模式：通常 `lite`。

仍需精简 OpenSpec spec，但不要创建独立计划和评审报告，除非存在运行或兼容性风险。

## 4. FeishuProjectMcp

需求来自飞书项目时，先用 `FeishuProjectMcp` 拉取必要字段，再由 Superpowers 完成分类和模式选择，最后写入 OpenSpec。

```text
使用 FeishuProjectMcp 拉取 {链接或 ID}。
使用 Superpowers 判断任务类型、复杂度、风险和影响范围。
选择 OSD Workflow 模式，并通过 OpenSpec 建立对应深度的规格后继续开发。
```

只读取当前决策需要的评论、附件和历史，避免无差别加载全部上下文。

## 5. 交付记录

standard/lite 使用 `.ai/templates/stage-report-compact.md`，只记录：

- 任务类型和模式。
- 规格路径。
- 修改文件。
- 验证命令、退出码和简短结果。
- 评审结果或 N/A。
- 剩余风险。

strict 才使用完整模板。`handoff-brief.md` 仅在另一个 Agent 继续任务时生成。

## 6. 项目自定义指令

推荐写入项目级 Agent 指令：

```text
This project uses OSD Workflow adaptive SDD.
Superpowers and OpenSpec must participate in every development task.
First classify task type, complexity, risk, scope, and uncertainty.
Select lite, standard, or strict from .ai/workflows/feature-development.yaml.
Select tdd, test_first, or verification_only as the development strategy.
Follow only the selected mode's required flow and outputs from .ai/workflow-manifest.json.
Always specify before coding and record focused verification evidence.
For tdd/test_first, record concise failing-before and passing-after evidence.
Do not add process documents that are not required by the selected mode.
```
