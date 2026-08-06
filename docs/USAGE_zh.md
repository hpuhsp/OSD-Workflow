# OSD 2.0 使用指南

## 安装与初始化

```bash
npm install --global osd-workflow
cd your-project
osd init
```

OSD 要求 Node.js `>=20.11`。交互式终端使用方向键、空格键和 Enter 多选 Agent；自动化场景可明确指定：

```bash
osd init --agents qoder,cursor --yes
osd init --agents auto --yes
osd init --agents none --yes
```

`auto` 保留已识别的规则目标；`none` 仅创建 OSD 项目契约而不写入 Agent 专用规则。Qoder 的模型决定触发方式需要在 Qoder Rules UI 中将生成的规则设为 **Model Decision**。该设置没有可靠的规则文件 frontmatter 约定，因此 OSD 不会写入虚构的 `trigger` 字段。

初始化只创建 `.osd/config.json`、`.osd/rules/workflow.md` 和选定 Agent 的规则。工作流产物是按任务创建的状态，而不是复制一套项目样板：全局安装包持有契约、模板和运行代码，初始化不会创建历史 `.ai/`、`knowledge/`、项目内 `scripts/` 或 OpenSpec 工作区。

任务启动前运行 `osd doctor`，它会报告配置健康度、Agent 规则、验证命令以及每个阶段实际选择的 adapter。

## 启动交付任务

```bash
osd start account-lockout --type bug_fix
```

任务类型决定默认模式和开发策略：

| 类型 | 默认模式 | 默认策略 |
| --- | --- | --- |
| `new_feature` | `standard` | `tdd` |
| `bug_fix` | `lite` | `test_first` |
| `existing_change` | `standard` | `test_first` |
| `refactor` | `standard` | `test_first` |
| `maintenance` | `lite` | `verification_only` |

需要时可显式覆盖：

```bash
osd start account-lockout --mode strict --strategy test_first --adapter fallback
```

`--adapter auto` 仅在 OpenSpec 全局命令与项目 `openspec/` 工作区都可用时选择 OpenSpec。`--adapter fallback` 在 `.osd/changes/<feature>/artifacts/` 创建最小的 proposal、spec 与 tasks；`--adapter openspec` 在条件不满足时直接失败，不会伪装调用了原生能力。Superpowers 对计划、实现、验证与审查独立解析，只有当前 Agent 运行环境暴露该 Skill 时才选用。

## 推进与交付

```bash
osd approve account-lockout
osd plan account-lockout
osd implement account-lockout
osd verify account-lockout
osd review account-lockout --result pass --summary "Focused tests and diff review passed"
osd archive account-lockout
```

状态机为 `specification -> planning -> implementation -> verification -> review -> archive -> complete`。标准和严格任务需要 proposal 与任务计划；所有归档都要求验证通过；严格任务还要求审查通过和验收标准评估通过。

选择 OpenSpec 后，Agent 应先用其原生 `/opsx:propose` 工作流完成 proposal/spec，再执行 `osd approve`。`osd archive` 调用官方 `openspec archive <feature> --yes`，并且只有确认变更目录已移动到 `openspec/changes/archive/` 后才写入原生归档记录。Superpowers 存在时，Agent 在当前 OSD 阶段中使用其计划、TDD、验证和审查能力；OSD 不重写这两个工具的方法论。

## 诊断与配置

```bash
osd doctor
osd adapters list
osd status account-lockout
osd config get
osd config get governance.require_review_for
osd config set commands.verify '"pnpm test"'
osd upgrade
```

`doctor` 会报告配置、Agent 规则、OpenSpec 工作区、Superpowers 能力、验证命令和每个阶段的 adapter 选择结果。

## 证据与归档

fallback 证据保存在活跃任务目录：

```text
.osd/changes/<feature>/state.json
.osd/changes/<feature>/verification.json
.osd/changes/<feature>/review.json
.osd/changes/<feature>/delivery.md
```

`osd archive` 将这些证据移动到 `.osd/archive/YYYY-MM-DD-<feature>/`。对于 OpenSpec 支撑的变更，OSD 会先运行 `openspec archive <feature> --yes`，再归档自己的状态记录。

## 运行时治理

运行时治理对普通任务可选，但 `strict` 模式的归档必须满足其验收评估门禁。

```bash
osd context account-lockout --task T-01 --role executor --owned-area src/auth.js --isolated
osd authorize account-lockout --command-id verify --role executor --path src/auth.js
osd event account-lockout --event '{"event_type":"implementation_started","status":"running"}'
osd evaluate account-lockout
osd summarize account-lockout
```

上下文记录任务所有权和当前契约；授权只允许配置中的命令；事件拒绝保存提示词、凭据、token、源代码和原始工具 I/O；评估检查 spec 中每个 `AC-*` 是否映射到任务，并确认验证已经通过。
