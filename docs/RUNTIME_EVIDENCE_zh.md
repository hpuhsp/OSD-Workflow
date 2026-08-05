# OSD 受控验证与试点评估

本项目不会执行变更文档、任务文档或聊天记录中提供的任意命令。可执行命令只能来自 `.ai/runtime-governance/governance.json` 中由项目维护者定义的 `commands[].argv`。

## 本地闭环

1. 为每个原子任务生成 context。
2. 先通过 `authorize` 获得策略允许结果。
3. 使用 `run-verified-command.mjs` 运行固定命令并写入带 provenance 的 `verification.json`。
4. 使用 `evaluate` 从成功的结构化验证步骤生成确定性评估。
5. 汇总事件，并在团队完成迁移后使用 `--require-trusted-evidence` 执行最终门禁。

```bash
node scripts/runtime-governance.mjs authorize --feature {feature} --action '{"command_id":"node-test","role":"test_verifier","paths":["test/example.test.mjs"]}'
node scripts/run-verified-command.mjs --feature {feature} --command-id node-test --step focused --criteria AC-01
node scripts/runtime-governance.mjs evaluate --feature {feature}
node scripts/verify-workflow-artifacts.mjs --feature {feature} --mode standard --require-trusted-evidence
```

历史交付可以继续使用普通 verifier。不要把没有 runner provenance 的人工证据描述为已受信证明。

## 试点

`.ai/evals/routing-cases.json` 提供五类典型任务；`.ai/evals/pilot-scorecard.template.json` 定义试点记录。每个试点至少记录模式选择、升级次数、门禁失败、策略拒绝、重试、交付时长和人工介入原因。完成一个周期后再决定是否调整规则或引入新的基础设施。
