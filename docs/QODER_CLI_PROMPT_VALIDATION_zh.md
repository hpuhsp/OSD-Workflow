# Qoder CLI 提示词有效性验证报告

## 验证结论

本次在测试项目 `C:\Users\HSP\Documents\OSD-Workflow-TestProject` 中，使用 Qoder CLI 按真实开发场景完成了 `loyalty-points` 模拟需求的完整闭环。

结论：

- 强约束两段式提示词有效，可以驱动 Qoder 读取 `.ai/workflows/feature-development.yaml`、各阶段 skill/rule 文件，并产出落盘 artifact。
- `FeishuProjectMcp` 名称明确写入提示词后，Qoder 会尝试调用飞书项目 MCP。模拟 ID `SIM-QODER-001` 因真实 MCP 参数无效失败后，Qoder 能按提示词中的 fallback payload 继续执行。
- `Spec approved. Continue...` 类型续跑提示词有效，但必须继续强调 `required_outputs`、`stage-report.md` 和最终 artifact gate。
- 最终门禁通过：`node scripts/verify-workflow-artifacts.mjs --target . --feature loyalty-points` 输出 `Result: PASS`。
- 测试通过：`node --test` 共 15 个测试全部通过。
- 最小提示词不建议直接用于首次接入或新 Agent，除非该 Agent 已确认加载项目级自定义指令。

## 验证环境

- 日期：2026-07-16
- Agent：Qoder CLI
- 终端：Git Bash 中交互式运行 `qodercli`
- 模型：已切换到 `Qwen3.7-Plus`
- 测试项目：`C:\Users\HSP\Documents\OSD-Workflow-TestProject`
- 被测 Workflow：`.ai/workflows/feature-development.yaml`
- 模拟需求：`loyalty-points`

环境差异：

- 普通 PowerShell/Git Bash 子进程未能直接找到系统 `node`。
- Qoder CLI 交互环境可执行 `node --test`。
- Codex 复核时使用内置 Node 绝对路径完成独立验证：`C:\Users\HSP\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`。

## 实际执行链路

### 1. 推荐日常模式第一段

输入目标：

- 使用 `FeishuProjectMcp` 读取需求。
- 如果 MCP 无法读取，则使用提示词中的模拟需求。
- 只执行 requirement analysis、OpenSpec creation、spec review。
- 停在 spec review 后等待确认，不开始编码。

实际结果：

- Qoder 尝试调用 `FeishuProjectMcp`。
- MCP 能搜索到项目，但模拟 work item ID 参数无效。
- Qoder 使用 fallback payload 继续执行。
- 生成了 OpenSpec 三件套：
  - `openspec/changes/loyalty-points/proposal.md`
  - `openspec/changes/loyalty-points/spec.md`
  - `openspec/changes/loyalty-points/design.md`
- 生成归档上下文：
  - `knowledge/archive/loyalty-points/requirement.md`
  - `knowledge/archive/loyalty-points/spec-review.md`
  - `knowledge/archive/loyalty-points/stage-report.md`
- 符合预期：停在 spec review 后，没有修改代码。

### 2. 推荐日常模式第二段

输入目标：

- 明确 `Spec approved`。
- 继续 implementation plan、coding、test generation、verification、code review、archive。
- 每阶段读取 workflow 引用的 skill/rule。
- 每阶段更新 `stage-report.md`。
- 最终执行 artifact gate。

实际结果：

- Qoder 读取了后续阶段的 skill/rule 文件。
- 生成实施计划：`knowledge/archive/loyalty-points/implementation.md`。
- 修改代码：
  - `src/pricing.mjs` 增加 `loyaltyPoints = Math.floor(total / 10)`。
  - `test/pricing.test.mjs` 更新已有 deepEqual 断言。
- 生成测试计划和测试文件：
  - `knowledge/archive/loyalty-points/test-plan.md`
  - `test/loyalty-points.test.mjs`
- 生成验证报告：
  - `knowledge/archive/loyalty-points/test-report.md`
- 生成评审报告：
  - `knowledge/archive/loyalty-points/review-report.md`
- 完成归档：
  - `knowledge/archive/loyalty-points/spec.md`
  - `knowledge/archive/loyalty-points/design.md`
  - `knowledge/archive/loyalty-points/stage-report.md`

### 3. 最终验证

Qoder 侧结果：

```text
node --test
15 tests passed, 0 failed
```

```text
node scripts/verify-workflow-artifacts.mjs --target . --feature loyalty-points
Result: PASS
```

Codex 独立复核结果：

```text
tests 15
pass 15
fail 0
```

```text
OSD workflow artifact verification
Target: C:\Users\HSP\Documents\OSD-Workflow-TestProject
Features: loyalty-points

Warnings:
  - Skipped optional stage output check for loyalty-points:codegraph-analysis

Result: PASS
```

## 提示词模板有效性矩阵

| USAGE 模板 | 本次验证方式 | 结论 | 使用建议 |
|---|---|---|---|
| 推荐日常模式 Step 1 | Qoder 真实执行 | 有效 | 首次处理需求时推荐使用 |
| 推荐日常模式 Step 2 | Qoder 真实执行 | 有效 | 规格确认后推荐使用 |
| Strict Workflow Execution Prefix | 嵌入 Step 1/Step 2 执行 | 有效 | 对 Qoder、Codex、Cursor、Claude Code 等通用 |
| Create OpenSpec From Feishu Project Requirement | Step 1 覆盖执行 | 有效 | 必须明确写 `FeishuProjectMcp` |
| Continue After Spec Approval | Step 2 覆盖执行 | 有效 | 必须强调最终 gate |
| Feishu Project MCP Integration | Qoder 实际调用 MCP 并 fallback | 有效但依赖本地 MCP 参数 | 真实项目中用真实链接或真实 task/work item ID |
| Minimal Prompt | 未作为独立开发需求执行 | 有条件有效 | 仅在项目级自定义指令已加载时使用 |
| Project Custom Instruction | 本次以长提示词模拟其约束 | 有条件有效 | 应写入项目级 `AGENTS.md` 或 Agent 配置 |
| Handle A Bug Fix | 未作为独立 bug 场景执行 | 待补充专项验证 | 生产建议仍保留 OpenSpec 先行 |
| Small Change With Explicit Skip | 未执行完整变更 | 不建议默认使用 | 只允许用户明确说“跳过完整 OpenSpec”时使用 |

说明：

- 本次没有把每个模板都作为独立需求各跑一轮，否则会产生多组互相干扰的测试项目改动。
- 已真实执行的是主生产路径：FeishuProjectMcp 拉取/降级、OpenSpec 创建、规格确认续跑、实施、测试、验证、评审、归档、最终门禁。
- 其余模板按触发条件和与主路径的等价关系完成有效性判断；`Bug Fix` 和 `Small Change With Explicit Skip` 建议后续单独做专项验证。

## 发现的问题

### 1. Agent 仍可能生成不成立的测试场景

Qoder 初次生成测试时写了 `loyaltyPoints is zero when total is zero`，但当前定价规则下 `subtotal = 0` 仍会加运费 10，因此 `total = 10` 且 `loyaltyPoints = 1`。

处理结果：

- 拒绝错误测试草稿。
- 要求 Qoder 改为 `loyaltyPoints is based on payable total after shipping`。
- 修正后测试通过。

结论：

- 强提示词能约束流程，但不能替代业务审查。
- 生产使用时必须保留人工 review 或自动业务断言 gate。

### 2. `test-generation/SKILL.md` 与 workflow required_outputs 曾不一致

发现：

- workflow 中 `test-generation.required_outputs` 要求 `test-plan.md`。
- 旧版 `test-generation/SKILL.md` 要求输出 `test-report.md`。

处理：

- 已修正 `test-generation/SKILL.md`：test-generation 产出 `test-plan.md`，verification 产出 `test-report.md`。

### 3. 部分 Agent 需要更明确的“落盘产物”约束

Qoder 在本次强提示词下能写入文件，但这依赖提示词明确写了：

- 不要把 TodoWrite 当 artifact。
- 每个 required output 必须真实存在于磁盘。
- 每阶段更新 `stage-report.md`。
- 最终执行 artifact gate。

这些约束应保留在所有生产提示词和项目级自定义指令中。

### 4. Partial flow 与 full gate 的边界需要说清楚

Step 1 只执行到 spec review 时，如果提前运行 full artifact gate，会因为后续阶段产物缺失而失败。

结论：

- Step 1 阶段不应要求 full gate 通过。
- full gate 只在完整交付前运行。
- 如果未来要支持阶段性 gate，需要新增 `--stage` 或 `--until-stage` 参数。

## 跨 Agent 精准触发建议

### 强触发前缀

适用于 Qoder、Codex、Cursor、Claude Code、Cline 等 Agent：

```text
Strictly execute .ai/workflows/feature-development.yaml as the binding workflow contract.
Before each stage, read every skill and rule file referenced by that stage.
Do not treat TodoWrite, internal task lists, chat summaries, or unstored reasoning as workflow artifacts.
Every required_output must exist on disk before the stage is complete.
Update knowledge/archive/{feature}/stage-report.md at every stage.
Before final handoff, run node scripts/verify-workflow-artifacts.mjs --target . --feature {feature}.
```

### 飞书项目 MCP 触发写法

```text
Use Feishu Project MCP (`FeishuProjectMcp`) to pull this requirement first: {真实飞书项目需求链接或 ID}

Then strictly execute .ai/workflows/feature-development.yaml.
Stop after OpenSpec creation and spec review. Do not start coding before I approve the spec.
```

继续开发：

```text
Spec approved. Continue from openspec/changes/{feature}/.
Complete implementation, tests, verification, review, archive, and final workflow artifact gate.
```

### 最小提示词使用条件

只有同时满足以下条件，才建议使用最小提示词：

- 当前 Agent 已确认加载项目级 `AGENTS.md` 或等价自定义指令。
- 项目已存在 `.ai/workflows/feature-development.yaml`。
- 项目已完成 `openspec init`。
- 本地可用 `FeishuProjectMcp`。
- 本地可执行 `node scripts/verify-workflow-artifacts.mjs`。

否则不要只写：

```text
Handle this Feishu project requirement with the project workflow: {link}
```

生产环境更安全的最小写法是：

```text
Handle this Feishu project requirement with the project workflow: {link}
Stop after OpenSpec creation and wait for my confirmation.
Before each stage, read referenced skill/rule files and write required_outputs to disk.
```

## 生产使用建议

1. 默认使用两段式提示词：先 OpenSpec，审批后再实现。
2. 在任何新 Agent 中，先用强触发前缀，不要直接用最小提示词。
3. 所有飞书项目需求都显式写 `FeishuProjectMcp`，不要只写“飞书 MCP”。
4. 每次交付前强制运行 `node scripts/verify-workflow-artifacts.mjs --target . --feature {feature}`。
5. 对 optional 阶段允许跳过，但必须在 `stage-report.md` 写明原因。
6. 对 bug fix 和 small change 建议另建独立测试项目做专项验证后再作为默认推荐。
