# 使用指南

本文说明如何在日常多 AI Agent 开发中使用这套 Workflow，包括提示词写法、项目自定义指令、多 Agent 协作和飞书项目 MCP（`FeishuProjectMcp`）集成方式。

## 心智模型

这套模板应作为项目级工作流契约使用。

```text
Agent/Harness 级 Superpowers
-> AI Agent 应该如何执行工作
-> 计划、编排、验证、评审纪律

全局 OpenSpec CLI
-> 通过 npm install -g @fission-ai/openspec@latest 安装
-> 提供 OpenSpec 命令能力

项目级 OpenSpec 工作区
-> 项目为什么要改
-> 需要改什么
-> 如何验收
-> 需要沉淀什么知识

项目级 .ai 模板
-> 团队共享的工作流、规则、Skill 映射和 Agent 上下文契约
```

标准流程是：

```text
飞书项目需求
-> 需求上下文
-> OpenSpec 变更
-> 规格评审
-> 实施计划
-> 编码
-> 测试生成
-> 验证
-> 代码评审
-> 知识归档
```

## 推荐日常模式

默认使用两段式工作流。

第一段：先创建并评审规格，不直接编码。

```text
使用飞书项目 MCP（FeishuProjectMcp）读取这个需求：{飞书项目需求链接或任务 ID}

严格按当前项目 .ai/workflows/feature-development.yaml 执行。
每个阶段开始前，读取该阶段引用的所有 skill 和 rule 文件。

只执行到需求分析、OpenSpec 创建和规格评审阶段。
创建：
- openspec/changes/{feature}/proposal.md
- openspec/changes/{feature}/spec.md
- openspec/changes/{feature}/design.md

完成规格评审点后停止，等待我确认。不要开始编码。
```

第二段：规格确认后继续开发。

```text
openspec/changes/{feature}/ 下的 OpenSpec 变更已确认。

继续按 .ai/workflows/feature-development.yaml 执行：
1. 生成实施计划。
2. 实现代码变更。
3. 生成或更新测试。
4. 执行验证。
5. 完成代码评审。
6. 归档到 knowledge/archive/{feature}/。

每个阶段开始前，读取该阶段引用的所有 skill 和 rule 文件。
不要把 TodoWrite、内部任务列表或对话总结当成工作流产物。
每个必需产物都必须写入磁盘。
```

这种方式能把“需求到规格”的边界显式化，避免 Agent 直接从粗糙需求描述跳到编码。

## CLI 一键接入

当你需要把这套 Workflow 接入已有开发项目时，优先使用安装器。

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

写入前预览：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install.ps1 -Target D:\WorkPlace\demo -WithDocs -DryRun
```

安装器默认复制 `.ai/`、`openspec/`、`knowledge/` 和 `scripts/verify-workflow-artifacts.mjs`。只有指定 `--with-docs` 或 `-WithDocs` 时才复制 `docs/`。已有文件默认跳过，只有指定 `--force` 或 `-Force` 时才覆盖。

## 生产交付门禁

交付前执行生产产物门禁：

```bash
node scripts/verify-workflow-artifacts.mjs --target . --feature {feature}
```

该门禁检查：

- workflow 引用的 skill、rule 和 template 文件
- OpenSpec 变更文件
- 归档文件
- 每阶段 `required_outputs`
- `knowledge/archive/{feature}/stage-report.md`

## 省 Token 执行模式

默认使用 `standard` 模式。它保留生产产物和门禁，但通过 `.ai/workflow-manifest.json`、compact stage report 和 handoff brief 减少重复上下文。

模式：

```text
strict
-> 最高确定性
-> 每阶段重新读取引用文件
-> 使用完整 stage report

standard
-> 默认日常生产模式
-> 引用文件 hash 未变化时复用已读上下文
-> 使用 compact stage report
-> 跨 Agent 交接时使用 handoff brief

lite
-> 低风险且用户明确允许的快捷模式
-> 仅在明确允许时跳过完整 OpenSpec
-> 仍要求验证证据和最终 artifact gate
```

推荐低 token 提示词：

```text
Use FeishuProjectMcp to pull {link}.
Run OSD Workflow standard mode for {feature}.
Stop after OpenSpec creation and spec review.
Use .ai/workflow-manifest.json and write required_outputs to disk.
```

继续开发：

```text
Spec approved. Continue OSD Workflow standard mode for {feature}.
Use handoff-brief.md instead of chat history when context is already summarized.
Run verification, review, archive, and final artifact gate.
```

省 token 规则：

- 不要在提示词里粘贴完整文件，路径和 hash 足够时只引用路径和 hash。
- workflow、skill、rule 文件 hash 未变化时，复用已读上下文。
- 跨 Agent 上下文写入 `knowledge/archive/{feature}/handoff-brief.md`。
- 除 strict 模式或 blocker 外，使用 `.ai/templates/stage-report-compact.md`。
- 飞书项目 MCP 先拉字段摘要，评论、附件、历史按需读取。

## 提示词模板

### 严格执行 Workflow 前缀

当 Agent 容易跳过阶段，或把 workflow 当成参考建议时，先加这段前缀。

```text
严格执行 .ai/workflows/feature-development.yaml，把它作为强制工作流契约。

开始前先读取：
- .ai/workflows/feature-development.yaml
- .ai/rules/workflow-execution-rule.md

每个阶段开始前：
- 读取该阶段引用的所有 skill 文件
- 读取该阶段引用的所有 rules 文件
- 使用 .ai/templates/stage-report.md 更新 knowledge/archive/{feature}/stage-report.md
- 汇报当前阶段 id、已读取文件、已创建或更新文件，以及 required_outputs 状态

除非我明确要求跳过，否则不要跳过非 optional 阶段。
不要把 TodoWrite、内部任务列表、对话总结或未落盘推理当作工作流产物。
只有必需文件或验证证据真实存在于磁盘上，阶段才算完成。
交付前执行 node scripts/verify-workflow-artifacts.mjs --target . --feature {feature}。
```

### 从飞书项目需求创建 OpenSpec

```text
使用飞书项目 MCP（FeishuProjectMcp）读取需求 {飞书项目链接或任务 ID}。

严格执行 .ai/workflows/feature-development.yaml，把它作为强制工作流契约。
每个阶段开始前，读取该阶段引用的所有 skill 和 rule 文件。

提取：
- 标题
- 背景
- 描述
- 验收标准
- 评论和决策
- 附件或截图
- 优先级和期望发布约束

目标项目执行 openspec init 后，在 openspec/changes/{feature}/ 下创建项目级 OpenSpec 变更。

必须生成：
- proposal.md
- spec.md
- design.md

遵循：
- .ai/workflows/feature-development.yaml
- .ai/rules/workflow-execution-rule.md
- .ai/skills/openspec-create/SKILL.md

创建 OpenSpec 变更后停止，等待评审。
```

### 规格确认后继续开发

```text
openspec/changes/{feature}/ 下的 OpenSpec 变更已确认。

继续执行工作流：
- 遵循 .ai/rules/workflow-execution-rule.md
- 使用 .ai/skills/implementation-plan/SKILL.md
- 遵循 .ai/rules/development-rule.md
- 使用 .ai/skills/test-generation/SKILL.md 生成验证
- 遵循 .ai/rules/testing-rule.md
- 使用 .ai/rules/code-review-rule.md 完成评审
- 使用 .ai/skills/knowledge-archive/SKILL.md 完成归档

实现范围必须严格对齐已确认的 OpenSpec 变更。
不要把 TodoWrite 或对话总结当成实施计划、测试报告、评审报告或归档。
每个阶段都更新 knowledge/archive/{feature}/stage-report.md。
交付前执行 node scripts/verify-workflow-artifacts.mjs --target . --feature {feature}。
```

### 处理 Bug 修复

```text
使用当前项目 AI Workflow 处理这个 Bug：{Bug 描述或飞书链接}。

先创建 OpenSpec 变更，捕获：
- 实际行为
- 期望行为
- 复现步骤
- 验收标准
- 回归测试预期

OpenSpec 变更准备好后停止，等待评审。
```

### 小改动并明确跳过完整规格

仅在低风险变更且用户明确要求跳过完整规格流程时使用。

```text
这是一个低风险变更。跳过完整 OpenSpec 创建，但仍遵循项目规则：
- 总结需求
- 识别影响文件
- 实现最小安全变更
- 执行聚焦验证
- 记录剩余风险
```

## 项目自定义指令

建议把下面的短指令放到项目级 Agent 规则中，例如 `.agent/AGENTS.md`、`.agents/AGENTS.md`，或当前 AI Agent 支持的等价项目指令文件。

```text
本项目使用 .ai/workflows/feature-development.yaml 作为默认 AI Coding Workflow。

当用户提供飞书项目需求、任务链接、Bug 报告、功能请求或重构请求时：
1. 行动前先读取 .ai/workflows/feature-development.yaml 和 .ai/rules/workflow-execution-rule.md。
2. 每个 workflow 阶段开始前，读取该阶段引用的所有 skill 和 rule 文件。
3. 先进入需求分析和项目级 OpenSpec 创建。
4. 除非用户明确要求跳过规格流程，否则不要直接编码。
5. OpenSpec 资产存放在 openspec/changes/{feature}/。
6. OpenSpec 是项目级事实来源，负责需求、规格、设计和验收标准。
7. 如果当前 AI Agent 或 Harness 中的 Superpowers 可用且被允许，则用它作为计划、编码、验证、评审和归档的执行纪律。
8. 不要把 TodoWrite、内部任务列表、对话总结或未落盘推理当作工作流产物。
9. 已完成工作按 .ai/skills/knowledge-archive/SKILL.md 要求归档到 knowledge/archive/{feature}/。
10. 每个阶段使用 .ai/templates/stage-report.md 更新 knowledge/archive/{feature}/stage-report.md。
11. 交付前执行 node scripts/verify-workflow-artifacts.mjs --target . --feature {feature}。
```

有了这条项目指令后，日常提示词可以缩短为：

```text
按项目 Workflow 处理这个飞书项目需求：{链接}
```

## 飞书项目 MCP 集成

当本地已配置飞书项目 MCP（`FeishuProjectMcp`）时，Agent 应先通过它拉取需求，再创建 OpenSpec 资产。

推荐 MCP 拉取顺序：

```text
1. 读取飞书项目任务或项目需求。
2. 提取标题、描述、负责人、状态、优先级和截止日期。
3. 提取验收标准。
4. 读取评论和讨论结论。
5. 在必要时下载或总结附件。
6. 标准化为需求上下文。
7. 创建 OpenSpec 变更文件。
```

推荐提示词：

```text
使用飞书项目 MCP（FeishuProjectMcp）拉取这个需求：{飞书项目链接或任务 ID}

然后执行项目 Workflow：
1. 标准化需求上下文。
2. 创建 openspec/changes/{feature}/proposal.md。
3. 创建 openspec/changes/{feature}/spec.md。
4. 创建 openspec/changes/{feature}/design.md。
5. 编码前停在规格评审点。
```

确认后继续：

```text
规格已确认。基于已确认的 OpenSpec 变更继续执行 Workflow。

完成：
- 实施计划
- 代码变更
- 验证
- 评审报告
- 知识归档
- 生产交付门禁
```

## 多 Agent 使用方式

不同 Agent 可以参与同一条需求，只要共享同一套项目级资产。

推荐分工：

```text
需求 / 产品 Agent
-> 拉取飞书上下文
-> 标准化需求
-> 创建 OpenSpec proposal

架构 / 计划 Agent
-> 评审 OpenSpec
-> 产出 design 和 implementation plan
-> 必要时检查 RepoWiki 和 CodeGraph

开发 Agent
-> 实现已确认规格
-> 保持变更范围对齐 OpenSpec

测试 Agent
-> 将验收标准映射到测试
-> 生成或更新验证
-> 记录 test-report.md

评审 Agent
-> 评审正确性、风险和测试缺口
-> 记录 review-report.md

归档 Agent
-> 收集最终产物
-> 写入 knowledge/archive/{feature}/
```

交接规则很简单：每个 Agent 在行动前都应读取当前 OpenSpec 变更。
每个 Agent 还必须在行动前读取当前 workflow 阶段引用的 skill 和 rule 文件。

## Agent 约束

可以在提示词或自定义指令中加入这些约束：

- 除非明确要求，否则不要在 OpenSpec 变更创建前编码。
- OpenSpec 创建后，不要再把飞书原始文本作为唯一事实来源。
- 代码变更范围必须对齐已确认规格。
- 每条验收标准都要映射到验证证据。
- 执行每个阶段前，读取该阶段引用的 skill 和 rule 文件。
- 不要把 TodoWrite、内部任务列表或对话总结当成工作流产物。
- 未经用户明确要求，不要跳过非 optional 阶段。
- 每个阶段更新 `knowledge/archive/{feature}/stage-report.md`。
- 交付前执行 `node scripts/verify-workflow-artifacts.mjs --target . --feature {feature}`。
- 归档需求、规格、设计、实现、测试和评审产物。
- Superpowers 按 AI Agent 或 Harness 安装。
- OpenSpec CLI 全局安装，然后在每个项目内初始化并维护 OpenSpec 资产。

## Qoder CLI 验证说明

推荐的两段式提示词已在 2026-07-16 使用 Qoder CLI 和 `Qwen3.7-Plus` 模型验证，模拟功能为 `loyalty-points`。

已验证链路：

```text
FeishuProjectMcp 拉取或 fallback
-> requirement-analysis
-> openspec-create
-> spec-review
-> 用户确认
-> implementation-plan
-> coding
-> test-generation
-> verification
-> code-review
-> archive
-> production artifact gate
```

验证结果：

```text
node --test
15 tests passed, 0 failed

node scripts/verify-workflow-artifacts.mjs --target . --feature loyalty-points
Result: PASS
```

实用结论：

- 新 Agent 或首次接入项目时，优先使用两段式长提示词。
- 明确写 `FeishuProjectMcp`，不要只写“飞书 MCP”。
- 保留“每阶段开始前读取引用的 skill/rule 文件”。
- 保留“TodoWrite 和对话总结不是 workflow artifact”。
- 每个 `required_output` 必须真实写入磁盘后，阶段才算完成。
- 只有确认 Agent 已加载项目级指令后，才使用最小提示词。
- full artifact gate 只用于最终交付；如果故意停在 spec review，提前运行 full gate 失败是预期行为。

详细验证报告：

```text
docs/QODER_CLI_PROMPT_VALIDATION_zh.md
```

## 最小提示词

配置好项目自定义指令后，日常使用可以简化为：

```text
按项目 Workflow 处理这个飞书项目需求：{链接}
```

更稳妥的写法：

```text
按项目 Workflow 处理这个飞书项目需求：{链接}
完成 OpenSpec 创建后停止，等待我确认。
```

继续开发时：

```text
规格已确认。继续完成实现、验证、评审和归档。
```
