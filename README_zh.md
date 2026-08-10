# OSD Workflow 2.0

OSD 是面向 AI 辅助研发的**原生优先交付编排器**：一个掌控交付契约的全局 CLI——任务路由、阶段顺序、证据、审查门禁与归档状态——让 AI 生成的变更和人工代码一样按纪律交付。

## 为什么需要 OSD

编码 Agent 擅长产出代码，但不会自然地产出流程。没有明确的契约，一次交付就没有公认的工作流、没有"工作确实发生"的证据、没有上线前的门禁，也没有交付记录。OSD 补上这一环：

- **原生优先路由** —— OpenSpec 与 Superpowers 存在时保留其原生优势；缺失时由极简、可追踪的 fallback 覆盖对应阶段。缺少任一专业工具都不会跳过规格、验证、审查或归档门禁。
- **证据治理的阶段** —— 每个阶段都在 `.osd/changes/<feature>/` 下写入文件证据，验证与审查结果决定交付能否推进或归档。
- **风险自适应模式** —— `osd start` 综合任务类型、声明的影响范围、风险信号与触碰路径打分，自动选择 `lite`、`standard` 或 `strict`。
- **可回滚** —— `osd rollback <feature> --to <stage>` 把交付退回到更早阶段，不删除任何产物。
- **侵入性极低** —— 项目只得到一份小配置和一条 Agent 规则；不拷贝模板，不生成 `AGENTS.md`、`.ai/`、`openspec/`、`knowledge/` 等样板文件。

OSD 不是工作流模板，也不替代 OpenSpec 或 Superpowers。它全局安装一次，只在需要交付契约的仓库中初始化。

## 全局安装

**前置要求：** Node.js `>=20.11`。

OSD 未发布到 npm registry，从源码全局安装：

```bash
node -v                        # 先确认 Node.js 版本
git clone https://github.com/hpuhsp/OSD-Workflow.git
cd OSD-Workflow
npm install --global .         # 全局安装 osd CLI
osd --version                  # 验证安装
```

CLI 升级：拉取最新源码后重装；项目契约刷新用 `osd upgrade`（在项目目录内执行）：

```bash
cd OSD-Workflow
git pull
npm install --global .
osd upgrade
```

卸载：

```bash
npm uninstall --global osd-workflow
```

卸载不会动项目里已有的 `.osd/` 目录；不再需要时按项目手动删除即可。

## 项目初始化

在需要交付契约的项目根目录执行：

```bash
cd your-project
osd init
```

交互式提示用方向键、空格和 Enter 选择一个或多个 Agent 规则目标。自动化场景显式传 `--agents`：

```bash
osd init --agents qoder,claude --yes   # 只为这些 Agent 写规则
osd init --agents auto --yes           # 只保留检测到的目标
osd init --agents none --yes           # 只要契约，不写 Agent 规则
```

`init` 只写三个小文件（外加选中的 Agent 规则）：

```text
.osd/config.json               # 交付契约：验证命令、门禁、adapter
.osd/rules/workflow.md         # OSD 工作流规则，供 Agent 读取
.claude/rules/osd-workflow.md  # Agent 规则入口（示例：Claude Code）
```

它刻意不创建 `AGENTS.md`、`.ai/`、`openspec/`、`knowledge/` 或项目内运行脚本：契约、模板与运行代码由全局包持有，项目只得到它需要的配置与 Agent 规则。交付状态在任务启动时按需创建。

初始化完成后先跑 `osd doctor`，确认 Agent 规则、验证命令与原生/降级 adapter 的实际选择结果，再开始交付。

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
- 如果交付到达错误阶段或受阻，`osd rollback <feature> --to <stage>` 可将状态移回更早的工作流阶段，在历史中记录回滚而不删除现有产物。

## Agent 规则

`osd init` 支持 `qoder`、`claude`、`gemini`、`trae` 与 `cursor`。

- Qoder: `.qoder/rules/osd-workflow.md`。在 Qoder Rules UI 中把规则激活方式设为 **Model Decision**；OSD 不伪造未被官方约定的 frontmatter 触发字段。
- Claude Code: `.claude/rules/osd-workflow.md`。
- Gemini CLI: 根目录 `GEMINI.md`，引用 `.osd/rules/workflow.md`。
- Trae: `.trae/rules/osd-workflow.md`，使用 `description` 与 `alwaysApply: false`。
- Cursor: `.cursor/rules/osd-workflow.mdc`，使用 Agent Requested 规则的 `description`、空 `globs` 与 `alwaysApply: false`。

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
