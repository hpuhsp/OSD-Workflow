# OSD 2.0 改进计划规格

## 1. 背景

当前 OSD Workflow 更像一个项目模板：安装时复制 `.ai/`、`openspec/`、`knowledge/` 和多个 `scripts/` 到目标项目，再通过 Agent 规则触发工作流。这种方式在严肃治理场景中有价值，但作为默认推广形态过重。

经过讨论，OSD 2.0 的方向应从“复制项目工作流模板”转为“全局 CLI + 项目轻量初始化 + 原生优先 adapter 编排”。

OSD 2.0 不再默认复刻 OpenSpec 或 Superpowers 的能力。OpenSpec 和 Superpowers 存在时，OSD 应优先委托它们的原生能力；不存在时，OSD 提供最低限度 fallback，保证工作流链路可控但不变成另一套 Superpowers。

## 2. 产品定位

OSD 2.0 是一个原生优先的 AI 研发交付工作流编排器。

英文定位：

```text
OSD is a native-first workflow orchestrator for AI-assisted software delivery.
```

中文定位：

```text
OSD 是一个原生优先的 AI 研发交付工作流编排器。
```

职责边界：

- OSD 负责任务路由、阶段顺序、adapter 选择、阶段门禁、产物要求和交付验收。
- OpenSpec 负责规格生命周期、proposal/spec/tasks/validate/archive 和规格知识沉淀。
- Superpowers 负责 brainstorming、writing-plans、TDD、debugging、verification、review 等执行方法。
- Agent 负责执行具体任务，但不能拥有最终流程控制权。

核心原则：

```text
工具灵活，链路可控。
Agent 执行，OSD 编排。
原生优先，fallback 兜底。
缺工具不崩，乱流程不准。
```

## 3. 目标

### 3.1 全局 CLI 模式

OSD 应像 OpenSpec 一样全局安装：

```bash
npm install -g osd-workflow
```

然后在目标项目中执行：

```bash
osd init
```

`osd-workflow` 命令保留为别名，核心短命令为 `osd`。

### 3.2 项目轻量初始化

`osd init` 默认只写入最小项目状态：

```text
.osd/config.json
.osd/rules/workflow.md
<agent-specific-rule>
```

不再默认复制：

```text
.ai/
openspec/
knowledge/
scripts/
```

任务产物应懒创建。比如 `openspec/changes/{feature}`、`.osd/changes/{feature}`、`.osd/archive/{feature}`、`knowledge/delivery/{feature}` 都不应在安装阶段创建。

### 3.3 不设计三档安装或三档 preset

OSD 2.0 第一版不设计 `light / standard / full` 或 `lean / team / governed` 三档。

理由：

- 全局 CLI 后，项目侵入性本身已经降低。
- 安装阶段不应要求用户提前理解治理强度。
- 流程轻重应由 OSD 在任务运行时基于风险动态路由。

严格程度通过 `.osd/config.json` 中的策略开关和任务路由动态决定，而不是安装时固定选择。

### 3.4 Native-first adapter

OSD 应优先使用已存在工具的原生能力：

- OpenSpec 存在时，规格和归档优先使用 OpenSpec。
- Superpowers 存在时，设计、计划、TDD、验证、审查优先使用 Superpowers。
- 可用测试命令存在时，验证阶段可委托 command adapter。
- 缺失能力时，使用 OSD fallback，并在记录中明确标记 fallback。

### 3.5 可插拔但不过度平台化

OSD 2.0 第一版不做复杂插件市场，只做内置 adapter registry 和简单配置。

第一版内置 adapter：

```text
specification:
  openspec
  osd.markdown-spec

planning:
  superpowers.writing-plans
  osd.minimal-plan

implementation:
  superpowers.tdd
  agent-native

verification:
  superpowers.verification
  command
  manual-evidence

review:
  superpowers.review
  agent-review
  manual-review

archive:
  openspec
  osd.markdown-archive
```

## 4. 非目标

OSD 2.0 第一版不做：

- 不复刻 OpenSpec 的完整 proposal/spec/archive 生命周期。
- 不复刻 Superpowers 的 brainstorming、writing-plans、TDD、debugging、review 方法论。
- 不做 IDE 插件。
- 不做桌面安装程序。
- 不做第三方 adapter 市场。
- 不默认写入 `AGENTS.md`。
- 不默认创建任务产物目录。
- 不做三档安装或三档 preset。

IDE 插件、图形化安装器和 adapter 市场可作为后续方向。

## 5. 项目配置

项目配置文件：

```text
.osd/config.json
```

建议 schema：

```json
{
  "schema": "osd.config/v2",
  "native_first": true,
  "dynamic_routing": true,
  "fallback_allowed": true,
  "agents": [],
  "workflow": {
    "specification": {
      "preferred": "openspec",
      "fallback": "osd.markdown-spec"
    },
    "planning": {
      "preferred": "superpowers.writing-plans",
      "fallback": "osd.minimal-plan"
    },
    "implementation": {
      "preferred": "superpowers.tdd",
      "fallback": "agent-native"
    },
    "verification": {
      "preferred": "superpowers.verification",
      "fallback": "command"
    },
    "review": {
      "preferred": "superpowers.review",
      "fallback": "agent-review"
    },
    "archive": {
      "preferred": "openspec",
      "fallback": "osd.markdown-archive"
    }
  },
  "governance": {
    "verification_required": true,
    "archive_required_when_openspec": true,
    "approval_required_for": ["high_risk"],
    "record_fallback_usage": true
  },
  "commands": {
    "verify": null
  }
}
```

## 6. 工作流链路

OSD 控制的阶段链路：

```text
route
→ specification
→ approval / confirmation
→ planning
→ implementation
→ verification
→ review
→ archive / record
```

阶段可以按任务风险裁剪，但裁剪必须由 OSD 路由规则决定，不能由 Agent 随意跳过。

任务路由继续保留动态模式概念，但不作为安装档位：

- `lite`: 简单、局部、低风险任务。
- `standard`: 普通功能、行为变更、常规重构。
- `strict`: 高风险、跨模块、公共 API、数据迁移、发布关键任务。

开发策略：

- `tdd`: 核心业务逻辑、算法、状态机、权限、公共 API。
- `test_first`: bug 修复、行为变更、重构。
- `verification_only`: 文档、配置、样式、探索或缺少合理测试边界的任务。

## 7. Adapter 选择规则

每个阶段选择 adapter 时遵循：

1. 读取 `.osd/config.json`。
2. 检测 preferred adapter 是否可用。
3. 可用则使用 preferred adapter。
4. 不可用且 `fallback_allowed=true` 时使用 fallback adapter。
5. 不可用且 fallback 禁止时，阻断并输出明确错误。
6. 所有 fallback 使用必须记录。

示例：

```text
OpenSpec found:
  specification -> openspec
  archive -> openspec

Superpowers not detected:
  planning -> osd.minimal-plan fallback
  review -> agent-review fallback
```

## 8. OSD fallback 边界

OSD fallback 只提供最低限度交付契约，不实现完整方法论。

允许的 fallback：

- `osd.markdown-spec`: 生成最小规格文档，包含背景、范围、非目标、验收标准。
- `osd.minimal-plan`: 生成原子任务清单。
- `agent-native`: 要求 Agent 基于规格做最小实现。
- `command`: 运行项目检测到的测试命令。
- `agent-review`: 要求 Agent 做风险优先代码审查并输出 pass/fail。
- `manual-review`: 要求人工填写审查结果。
- `osd.markdown-archive`: 写入简要归档记录。

禁止的 fallback：

- 不实现完整 brainstorming 方法论。
- 不实现完整 TDD 教程。
- 不实现完整 debugging 流程。
- 不实现完整 Superpowers review 方法。

## 9. CLI 命令

### 9.1 全局命令

建议命令：

```bash
osd init
osd doctor
osd adapters list
osd verify
osd archive
osd config get
osd config set
osd upgrade
```

`osd-workflow` 保留为同等别名：

```bash
osd-workflow init
```

### 9.2 `osd init`

功能：

- 显示 OSD banner。
- 检测当前项目。
- 交互选择 Agent rule 目标。
- 检测 OpenSpec、Superpowers、测试命令。
- 生成 `.osd/config.json`。
- 生成 `.osd/rules/workflow.md`。
- 生成选中的 Agent 专用 rule。
- 输出 summary 和 next steps。

不做：

- 不初始化 OpenSpec，除非用户显式选择。
- 不复制项目脚本。
- 不创建任务产物。
- 不安装 Superpowers。

### 9.3 `osd doctor`

检查：

- `.osd/config.json` 是否存在且 schema 正确。
- Agent rule 是否存在。
- OpenSpec 是否可用。
- Superpowers 是否可用或可被 Agent harness 识别。
- 测试命令是否可用。
- workflow adapter 是否可解析。
- fallback 是否符合策略。

### 9.4 `osd adapters list`

输出内置 adapter 和当前可用状态。

### 9.5 `osd verify`

第一版可以轻量实现：

- 检查 `.osd/config.json`。
- 检查当前任务记录或指定 feature 的必要 evidence。
- 当 OpenSpec 可用且 archive_required 时，检查归档状态。
- 当 verification_required 时，检查验证记录或执行配置命令。

## 10. 终端交互体验

安装器应使用现代 CLI 交互：

- 单选：上下键 + Enter。
- 多选：上下键 + 空格 + Enter。
- 支持非交互参数。

推荐使用 Node 生态：

```text
@inquirer/prompts
```

启动 banner 建议简洁可靠：

```text
╭──────────────────────────────╮
│ OSD Workflow                 │
│ Native-first AI delivery     │
╰──────────────────────────────╯
```

交互示例：

```text
? Select AI Agents
  ◉ Qoder        .qoder/rules/osd-workflow.md
  ◯ Claude Code .claude/rules/osd-workflow.md
  ◯ Gemini CLI  GEMINI.md
  ◯ Trae         .trae/rules/osd-workflow.md
  ◯ Cursor       .cursor/rules/osd-workflow/RULE.md

? Use OpenSpec when available? Yes
? Use Superpowers when available? Yes
```

非交互示例：

```bash
osd init --agents qoder,claude --yes
osd init --agents auto --yes
```

## 11. Agent rule

不再默认生成 `AGENTS.md`。

支持的 Agent rule 目标：

```text
Qoder        .qoder/rules/osd-workflow.md
Claude Code .claude/rules/osd-workflow.md
Gemini CLI  GEMINI.md
Trae         .trae/rules/osd-workflow.md
Cursor       .cursor/rules/osd-workflow/RULE.md
```

Agent rule 应表达：

- OSD 是顶层交付编排器。
- 读取 `.osd/config.json` 和 `.osd/rules/workflow.md`。
- 原生优先使用 OpenSpec/Superpowers。
- 工具缺失时按配置 fallback。
- Agent 不得跳过或重排 OSD 阶段。
- 每次任务启动时输出：

```text
OSD: <task_type> | <mode> | <strategy> | <stage> | <adapters>
```

## 12. 迁移策略

由于 OSD 尚未真正推广，2.0 不需要兼容旧版本。

允许大改：

- 从 `.ai` 切换到 `.osd`。
- 从项目模板转向全局 CLI。
- 删除默认复制 `openspec`、`knowledge`、`scripts` 的行为。
- 重写 README 和 usage 文档。
- 重写测试。

旧的 0.x 结构可作为参考，但不作为兼容约束。

## 13. 实施计划

建议分阶段实现。

### 阶段 1：CLI 基础重构

- 将 bin 命令收敛为 `osd` 和 `osd-workflow`。
- 新增 `.osd/config.json` 生成逻辑。
- 新增 `.osd/rules/workflow.md` 生成逻辑。
- 删除默认复制 `.ai`、`openspec`、`knowledge`、`scripts` 的行为。
- 保留 Agent rule 多选能力。
- 支持 `--agents`、`--yes`、`--dry-run`。

### 阶段 2：现代交互

- 引入 `@inquirer/prompts`。
- 实现 banner。
- 实现 Agent 多选。
- 实现非交互 fallback。
- 输出 capability summary。

### 阶段 3：能力检测和 adapter registry

- 检测 OpenSpec CLI。
- 检测 Superpowers 可用性。
- 检测常见测试命令。
- 实现内置 adapter registry。
- 在 config 中写入 preferred/fallback adapter。

### 阶段 4：doctor 和 adapters

- 实现 `osd doctor`。
- 实现 `osd adapters list`。
- 增加测试覆盖。

### 阶段 5：轻量 verify/archive

- 实现 `osd verify` 的基础结构检查。
- 实现 `osd archive` 对 OpenSpec 的 native-first 委托。
- 实现 markdown fallback archive。

## 14. 验收标准

### 14.1 初始化

- `osd init --agents qoder --yes` 在空项目中只生成：

```text
.osd/config.json
.osd/rules/workflow.md
.qoder/rules/osd-workflow.md
```

- 不生成：

```text
AGENTS.md
.ai/
openspec/
knowledge/
scripts/
```

### 14.2 配置

- `.osd/config.json` 包含 `schema: osd.config/v2`。
- `native_first` 默认 `true`。
- `fallback_allowed` 默认 `true`。
- workflow 每个阶段都有 preferred/fallback。

### 14.3 Agent rule

- 选中的 Agent rule 包含 OSD managed block。
- 重复 init 不重复写入 managed block。
- 已有用户内容被保留。

### 14.4 交互

- 交互模式支持多选 Agent。
- 非交互模式不会卡住。
- `--yes` 可跳过交互。

### 14.5 doctor

- `osd doctor` 能报告：
  - OSD config 状态
  - Agent rule 状态
  - OpenSpec 状态
  - Superpowers 状态
  - verification command 状态
  - adapter resolution 状态

### 14.6 测试

- Node 测试覆盖 parse args、init、merge、doctor、adapter detection。
- Windows PowerShell 不再是主要安装路径，但如保留脚本，必须与 CLI 行为一致。

## 15. 关键判断

OSD 2.0 不再靠“复制完整目录”体现价值。

OSD 的价值是：

```text
根据任务风险选择流程深度，
根据环境选择原生工具或 fallback，
确保交付链路和验收标准始终受控。
```

最终目标：

```text
全局安装，项目轻量初始化；
工具原生优先，adapter 可替换；
流程动态路由，链路严格受控；
缺工具可降级，乱流程不允许。
```
