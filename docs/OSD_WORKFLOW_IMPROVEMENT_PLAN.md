# OSD Workflow 改进实施计划

对应 OpenSpec 变更：

- `openspec/changes/osd-workflow-governance-hardening/proposal.md`
- `openspec/changes/osd-workflow-governance-hardening/spec.md`

本文是实施路线图，不代表改进已经完成。完成每个阶段后，应补充真实的验证结果和交付记录。

## 一、目标状态

将 OSD 从“文档约定 + 交付物存在性校验”提升为：

```text
需求路由
  → OpenSpec 提案/规格
  → 人工批准闸门
  → 验收标准与原子任务映射
  → Superpowers 执行
  → 结构化验证证据
  → 风险比例评审
  → OpenSpec 归档与知识同步
```

核心原则保持不变：

- OSD 决定任务类型、模式、策略、阶段顺序和最低证据；
- OpenSpec 是规格权威，不由 OSD 复制其生命周期；
- Superpowers 是执行方法，不由 OSD 复制其 brainstorming、planning、TDD 和 review 细节；
- `lite` 继续保持轻量，不被高风险流程污染。

## 二、分阶段路线图

### Phase 0：冻结现状并补充基线

目标：在修改契约前，确保当前 v3 行为有可回归基线。

任务：

1. 固化当前 manifest v3 的结构校验结果。
2. 记录现有 23 个测试的通过基线。
3. 增加一组 fixture，覆盖当前 lite、standard、strict 的合法交付物。
4. 明确 v3 交付记录的迁移策略：兼容、警告、不冒充新保证。

完成条件：

- 现有测试和结构校验均通过；
- 有可重复的 v3 fixture；
- 文档中明确“当前保证”和“改进后保证”的边界。

### Phase 1：增加状态和人工批准闸门

目标：解决“规格看过了但没有明确批准”的问题。

建议变更：

- 新增 `openspec/changes/{feature}/osd-state.json`；
- 新增 `approval.md`；
- standard/strict 在 implementation 前必须为 `approved`；
- strict 保留详细 `spec-review.md`；
- verifier 校验批准人、时间、决策、规格路径和残余风险。

建议状态：

```text
draft → proposed → approved → planned → in_progress
      → verified → reviewed → archived → complete
```

异常状态：

```text
rejected / changes_requested / blocked
```

注意：不建议通过读取自然语言中的“已批准”来判断状态，应优先读取结构化状态文件。

完成条件：

- 未批准的 standard/strict fixture 无法通过；
- approved fixture 可以进入 planning；
- lite 不被强制要求 approval.md；
- 迁移中的 v3 fixture 显示 legacy warning。

### Phase 2：增加验收标准和原子任务追踪

目标：把“规格 → 任务 → 实现 → 测试”连接起来。

任务：

1. 规定 `spec.md` 使用 `AC-01`、`AC-02` 等稳定验收标准 ID。
2. 优先探测 OpenSpec 原生任务产物；只有不存在时才使用兼容性 `tasks.md`。
3. 每个任务必须声明：
   - `T-01` 任务 ID；
   - 对应 `AC-*`；
   - 影响文件或模块；
   - owner/agent；
   - 依赖任务；
   - 验证方法；
   - 状态。
4. verifier 检查重复 ID、悬空引用、未覆盖验收标准和循环依赖。
5. developer-agent 和 test-agent 上下文中增加 feature、task ID 和 AC ID。

完成条件：

- 每个非平凡 AC 至少关联一个任务；
- 未定义 AC 或任务依赖会失败；
- handoff 中的任务 ID 必须存在于任务计划；
- 任务计划不能改变已批准 spec 的范围。

### Phase 3：结构化验证证据

目标：减少“报告写了 Red/Green，但无法追溯实际验证”的问题。

任务：

1. 定义 `verification.json` 结构。
2. 每个验证步骤写入 command ID、exit code、时间、覆盖的 AC 和摘要。
3. 为仓库命令建立 allowlist，例如：
   - `npm test`；
   - `node scripts/verify-workflow-artifacts.mjs --structural-only`；
   - OpenSpec 官方 validation 命令。
4. 由验证 runner 生成结构化证据，markdown 交付记录只负责摘要和链接。
5. verifier 检查策略特有步骤：
   - `tdd`：red、green、refactor；
   - `test_first`：failing-before、passing-after；
   - `verification_only`：strategy reason、focused verification。
6. 禁止 verifier 直接执行用户在 markdown 中填写的任意命令。

完成条件：

- 缺少策略步骤会失败；
- 非零 exit code 只能出现在预期的 Red/失败复现步骤；
- 每个 AC 都有验证覆盖；
- 报告文本为 `pass` 但结构化证据不完整时仍然失败。

### Phase 4：交付、评审和归档闭环

目标：解决“交付记录存在，但 OpenSpec archive 或知识同步未发生”的问题。

任务：

1. delivery record 增加 approval、task、verification、archive 链接。
2. strict 模式要求 native OpenSpec archive 结果。
3. archive 结果记录：
   - 执行的 OpenSpec 原生命令；
   - exit code；
   - archived change location；
   - knowledge-sync hook 结果；
   - 最终 state。
4. 对已有项目提供可选 knowledge-sync hook。
5. 不默认创建第二份 `specs/` 目录；如果目标项目确实维护规格索引，则由目标项目 hook 负责同步。
6. 增加 active、archived、blocked 三种 archive fixture。

完成条件：

- strict 未完成 native archive 不能通过；
- standard 可以明确声明 active 或 archived；
- archive 状态与 delivery record 不一致时失败；
- 知识同步失败时至少产生明确 warning 或失败结果，不得静默成功。

### Phase 5：版本迁移和文档更新

目标：让现有项目可以渐进迁移，不破坏已有交付记录。

任务：

1. manifest 从 v3 升级到 v4。
2. 增加迁移说明和 dry-run 迁移命令。
3. v3 项目在迁移完成前可以执行 legacy verification。
4. 所有文档增加：
   - 六阶段目标流程；
   - lite/standard/strict 对照；
   - approval 示例；
   - AC 与任务映射示例；
   - 三种开发策略示例；
   - archive 与知识同步边界。
5. 明确标注：哪些是 verifier 硬校验，哪些由 OpenSpec/Superpowers 委派执行。

完成条件：

- 新用户能按照文档完成一个 standard fixture；
- 旧 v3 fixture 能迁移或明确报告阻塞点；
- 文档不再把 `specs/` 当作所有项目的统一规范目录。

## 三、建议的变更文件

优先修改：

- `.ai/workflow-manifest.json`：升级 schema 和新增契约；
- `.ai/workflows/feature-development.yaml`：补充 approval、task、archive 阶段语义；
- `.ai/rules/workflow-execution-rule.md`：补充状态闸门和迁移规则；
- `.ai/agents/developer-agent.yaml`：增加 task-aware context；
- `.ai/agents/test-agent.yaml`：增加 AC/task/evidence context；
- `.ai/templates/agent-entry.md`：增加变更上下文要求；
- `.ai/templates/stage-report-compact.md`：增加 approval、task、evidence、archive 链接；
- `scripts/verify-workflow-artifacts.mjs`：增加结构化状态、任务和证据校验；
- `test/workflow-verifier.test.mjs`：增加正反例 fixture；
- `README.md`、`README_zh.md`、`docs/USAGE.md`、`docs/USAGE_zh.md`：更新使用说明。

可选新增：

- `scripts/run-verified-command.mjs`：只执行仓库 allowlist 命令并生成证据；
- `.ai/templates/approval.md`；
- `.ai/templates/tasks.md`；
- `.ai/templates/verification.json`；
- `.ai/templates/osd-state.json`；
- `scripts/migrate-manifest-v3.mjs`；
- `scripts/sync-knowledge.mjs` 或目标项目提供的 hook 接口。

## 四、优先级建议

### P0：必须先做

- approval gate；
- AC ID 和任务映射；
- verifier 负例测试；
- v3 迁移兼容策略。

### P1：紧接着做

- 结构化 verification evidence；
- task-aware agent/handoff context；
- delivery record traceability。

### P2：最后做

- native archive 结果绑定；
- knowledge-sync hook；
- allowlisted verification runner；
- 可视化任务/验收追踪。

## 五、发布前验收清单

- [ ] standard 未批准变更不能进入 implementation。
- [ ] strict 规格评审、设计、任务、验证、review、archive 均有证据。
- [ ] 每个 AC 都有任务和验证覆盖。
- [ ] 不存在重复、悬空或循环任务引用。
- [ ] TDD、test-first、verification-only 分别执行正确的证据规则。
- [ ] Agent/handoff 能定位到 feature、task 和 AC。
- [ ] archive 状态与 OpenSpec 原生结果一致。
- [ ] v3 迁移不会静默宣称已经具备 v4 保证。
- [ ] `node --test` 通过。
- [ ] structural verifier 通过。
- [ ] 文档和模板与 manifest 保持一致。
