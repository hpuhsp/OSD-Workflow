# OSD Rollback — 规格文档

**日期:** 2026-08-07  
**分支:** `feature/osd-improvements`  
**状态:** 待批准

## 问题陈述

OSD 2.0 的阶段状态机是单向阀。`requireStage()` (`osd-core.mjs:567`) 在每个命令入口检查 `state.stage` 是否匹配——`approve` 只接受 `specification`，`plan` 只接受 `planning`，`implement` 只接受 `implementation`。

一旦阶段前进，就没有合法路径退回。实际开发中这是常态：

- 走到 `implementation` 发现规格有误 → 需要退回 `specification` 改 spec.md
- 走到 `verification` 发现任务拆分有问题 → 需要退回 `planning` 改 tasks.md
- strict 模式 `review` 未通过、状态变 `blocked` → 需要退回 `implementation` 改代码

当前唯一的恢复方式是手动编辑 `.osd/changes/<feature>/state.json`——脆弱、无审计记录、容易改错。

## 目标

新增 `osd rollback <feature> --to <stage>` 命令，提供合法的阶段回退路径。

## 非目标

- 不删除或修改任何已生成的 artifact 文件
- 不引入回滚后的自动重执行（用户手动重跑阶段命令）
- 不支持 `complete` 状态的回退（已归档交付不可变）
- 不实现重试、指数退避、事务回滚等运行时编排能力

## 设计

### 命令接口

```
osd rollback <feature> --to <stage> [--target <path>]
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `<feature>` | 是 | feature 名称，须匹配 `[a-z0-9-]+` |
| `--to <stage>` | 是 | 目标阶段，须为合法阶段名且早于当前阶段 |
| `--target <path>` | 否 | 项目目录，默认 `.` |

### 合法阶段名

取自 `WORKFLOW_STAGES` (`osd-core.mjs:27-34`) 加 `complete`：

```
specification, planning, implementation, verification, review, archive, complete
```

### 回退规则

1. **只能退到更早的阶段** — 目标阶段的 `WORKFLOW_STAGES` 索引必须小于当前阶段索引
2. **`complete` 不可回退** — 已归档的交付是 immutable 的
3. **同阶段回退不允许** — 目标必须严格早于当前
4. **`blocked` 状态可回退** — 这是回滚的主要使用场景之一

### 行为

1. 调用 `loadState(target, feature)` 读取当前状态
2. 验证目标阶段合法且早于当前阶段
3. 调用 `transition(state, targetStage, "rolled_back")` — 复用现有 history 机制，追加 `{ stage: targetStage, status: "rolled_back", at: <timestamp> }`
4. 调用 `saveState(target, state)` — 复用现有写入逻辑
5. 输出确认信息

### 不做的事

- 不触碰 `spec.md`、`tasks.md`、`verification.json`、`review.json` 等任何 artifact
- 不修改 `state.mode`、`state.strategy`、`state.adapters` 等配置字段
- 不清理 `state.history` — 回滚本身也是 history 的一部分

重跑阶段时，现有 `writeJson`/`writeText` 会自然覆盖旧 artifact。例如回退到 `specification` 后改完 spec.md，`osd approve` 会正常推进；回退到 `implementation` 后改完代码，`osd implement` → `osd verify` 会自然覆盖旧的 `verification.json`。

## 典型场景

| 当前阶段 | 状态 | 回退到 | 场景 |
|----------|------|--------|------|
| `verification` | `blocked` | `implementation` | 测试挂了，改代码重测 |
| `implementation` | `implemented` | `planning` | 任务拆分不对，重做计划 |
| `planning` | `planned` | `specification` | 规格要改，重写 spec.md |
| `review` | `blocked` | `implementation` | strict 审查没过，改代码 |
| `review` | `partial` | `verification` | 审查要求补验证证据 |
| `archive` | `archived` | `review` | 审查记录有问题，补审 |

## 代码改动点

| 位置 | 改动 |
|------|------|
| `parseArgs()` `osd-core.mjs:187` | 新增 `--to` flag 解析；`commands` Set 加入 `"rollback"` |
| `usage()` `osd-core.mjs:123` | 新增 `osd rollback <feature> --to <stage>` 行 |
| `run()` `osd-core.mjs:728` | 新增 `rollback` 分发 |
| 新增 `export function rollbackDelivery()` | 核心逻辑：loadState → 校验 → transition → saveState |

## 测试策略

TDD — 先写失败测试，再实现。

### 测试用例

1. **回滚正常工作：** start → approve → plan → implement → rollback --to planning → 断言 `state.stage === "planning"`，history 末尾 `{ stage: "planning", status: "rolled_back" }`

2. **blocked 状态可回滚：** start → approve → plan → implement → verify (失败) → state 变 `verification/blocked` → rollback --to implementation → 断言 `state.stage === "implementation"`

3. **拒绝同阶段回退：** 在 `planning` 阶段执行 `rollback --to planning` → 抛错

4. **拒绝向后回退（到更晚阶段）：** 在 `specification` 阶段执行 `rollback --to planning` → 抛错

5. **拒绝 complete 回退：** 归档后执行 `rollback --to archive` → 抛错

6. **拒绝非法阶段名：** `rollback --to design` → 抛错

## 文件影响

| 文件 | 改动类型 |
|------|----------|
| `lib/osd-core.mjs` | 修改：parseArgs + usage + run + 新增 rollbackDelivery |
| `test/initializer.test.mjs` | 修改：新增 6 个测试用例 |
| `docs/USAGE.md` | 修改：新增 rollback 命令说明 |
| `docs/USAGE_zh.md` | 修改：新增 rollback 命令说明 |
| `assets/osd-contract-v2.json` | 修改：guarantees 加入 `"stage rollback is supported for recovery"` |

## 依赖

无新增依赖。全部使用现有的 `loadState`、`transition`、`saveState`、`WORKFLOW_STAGES` 基础设施。
