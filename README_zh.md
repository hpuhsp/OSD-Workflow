# OSD Workflow 2.0

OSD 是面向 AI 辅助研发的原生优先交付编排器。它掌控任务路由、阶段顺序、证据、审查门禁和归档状态；OpenSpec 与 Superpowers 存在时保留其原生优势，缺失时才使用可追踪的最小 fallback。

OSD 全局安装一次，只在需要交付契约的项目中初始化。它不是复制到项目里的工作流模板，也不替代 OpenSpec 或 Superpowers。

```bash
npm install --global osd-workflow
osd init --agents qoder,claude
```

要求：Node.js `>=20.11`。只有需要原生能力时，才安装 OpenSpec 或提供 Superpowers 的 Agent 运行环境。

初始化只写入：

```text
.osd/config.json
.osd/rules/workflow.md
<选中的 Agent 规则>
```

不会创建 `AGENTS.md`、`.ai/`、`openspec/`、`knowledge/` 或项目内运行脚本。包本身持有 OSD 的契约、模板和运行代码；项目只得到必要的配置与 Agent 规则，交付状态在任务启动时按需创建。

初始化后执行 `osd doctor`，检查 Agent 规则、验证命令以及原生/降级 adapter 的实际选择结果。

## 原生优先路由

| 交付阶段 | 优先 adapter | 可追踪 fallback |
| --- | --- | --- |
| 规格与归档 | OpenSpec | OSD Markdown 规格/归档 |
| 计划 | Superpowers `writing-plans` | OSD 最小计划 |
| 实现 | Superpowers TDD | Agent 原生实现 |
| 验证 | Superpowers verification | 配置的验证命令 |
| 审查 | Superpowers review | Agent 审查记录 |

只有 OpenSpec CLI 和目标项目的 `openspec/` 工作区同时存在时才选择 OpenSpec；只有当前 Agent 运行环境暴露 Superpowers 时才选择 Superpowers。缺少任一专业工具都不能跳过规格、验证、审查或归档门禁。

## 交付生命周期

```bash
osd start checkout --type bug_fix --adapter auto
osd approve checkout
osd plan checkout
osd implement checkout
osd verify checkout
osd review checkout --result pass --summary "No regression found"
osd archive checkout
```

`start` 会确定任务模式和实现策略、解析 adapter，并创建任务级状态记录。模式默认自适应选择：任务类型提供基础分，声明的影响范围、风险信号和触达路径会把 `lite` 升级为 `standard` 或 `strict`。最终分数和判定因子会写入 `state.json`。

- OpenSpec 仅在可用时承担规格与原生归档。
- Superpowers 仅在当前 Agent 运行环境提供该能力时承担计划、实现、验证与审查。
- fallback 产物保存在 `.osd/changes/<feature>/`，归档后移动到 `.osd/archive/`。
- 验证会记录 `unit_test` 检查，并执行 `.osd/config.json` 的 `commands.verify`，通常从 `package.json` 推断为 `npm test`。如果存在 `commands.unitTest` 或 `test:unit` 脚本，会作为专用单元测试命令；否则单元测试槽位会记录为由总验证命令覆盖。
- 标准和严格任务需要 proposal 与任务计划；所有归档都要求验证成功，严格任务还要求审查通过和验收标准评估通过。

## Agent 规则

`osd init` 支持 `qoder`、`claude`、`gemini`、`trae` 与 `cursor`。

- Qoder: `.qoder/rules/osd-workflow.md`。在 Qoder Rules UI 中把规则激活方式设为 **Model Decision**；OSD 不伪造未被官方约定的 frontmatter 触发字段。
- Claude Code: `.claude/rules/osd-workflow.md`。
- Gemini CLI: 根目录 `GEMINI.md`，引用 `.osd/rules/workflow.md`。
- Trae: `.trae/rules/osd-workflow.md`，使用 `description` 与 `alwaysApply: false`。
- Cursor: `.cursor/rules/osd-workflow.mdc`，使用 Agent Requested 规则的 `description`、空 `globs` 与 `alwaysApply: false`。

交互式终端通过方向键、空格键和 Enter 多选。非交互式初始化明确可控：`--agents auto` 保留已识别的目标，`--agents none` 不写 Agent 规则，`--agents qoder,cursor --yes` 直接指定目标。

## 诊断与治理

```bash
osd doctor
osd adapters list
osd status checkout
osd config get workflow.verification
osd config set commands.unitTest '"npm run test:unit"'
osd config set commands.verify '"pnpm test"'
osd upgrade
```

团队治理可使用 `osd context`、`osd authorize`、`osd event`、`osd evaluate` 和 `osd summarize` 建立任务上下文、限制可授权命令、记录仅含元数据的事件、评估验收标准覆盖，并生成摘要。该治理层对普通任务可选，但严格模式归档必须满足其验收评估门禁。

详见[使用指南](docs/USAGE_zh.md)、[2.0 架构说明](docs/OSD_2_0_ARCHITECTURE_zh.md)和[改进规格](docs/OSD_2_0_IMPROVEMENT_SPEC_zh.md)。
