# OSD 2.0 使用指南

OSD 2.0 是项目轻量化、native-first 的编排器。全局安装一次，再在每个项目初始化 `.osd` 契约：

```bash
npm install --global osd-workflow
osd init
```

`osd-workflow` 是等价别名。

## 初始化

```bash
osd init [target] [--agents qoder,claude] [--yes] [--dry-run]
```

交互终端会显示 banner，并提供 Agent 多选输入。CI 或脚本应提供 `--agents` 与 `--yes`；非交互调用不会卡住。

支持的 Agent 为 `qoder`、`claude`、`gemini`、`trae`、`cursor`。可用 `all`、`none`、`auto`。未选择 Agent 时不会生成 `AGENTS.md`。

默认输出严格限制为：

```text
.osd/config.json
.osd/rules/workflow.md
<用户选择的 Agent rule>
```

OSD 不复制 `.ai/`、`openspec/`、`knowledge/`、`scripts/` 等模板目录。重复 `init` 不会重复 managed block，并保留 Agent rule 中的用户内容。

## 运行时编排

配置 schema 是 `osd.config/v2`。阶段为 `specification`、`planning`、`implementation`、`verification`、`review`、`archive`。

每个阶段都有 preferred 与 fallback adapter。OpenSpec 优先用于 specification 和 archive；Superpowers 优先用于 planning、implementation、verification、review。原生能力不可用时，只有 `fallback_allowed` 打开才使用 fallback，并记录 fallback 状态。

`dynamic_routing` 在运行时决定任务深度；初始化没有 light、standard、full 或 preset 档位。

## 检查

```bash
osd doctor [target]
osd adapters list [target]
```

`doctor` 校验配置、Agent rule、OpenSpec、Superpowers、验证命令和逐阶段 adapter resolution。`adapters list` 展示原生与 fallback adapter 的可用性。

## PowerShell 兼容入口

仓库保留 `scripts/install.ps1`，其仅代理到相同 CLI：

```powershell
./scripts/install.ps1 -Target . -Agents qoder,cursor -Yes
```

它不会下载或复制项目模板。
