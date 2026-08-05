# OSD 运行时治理（Manifest v5）

本阶段采用“本地优先、策略先行”的方式：不新增 OSD 自有调度器、MCP 服务、RAG 存储或托管控制平面。统一资源、角色权限、命令标识和评估规则只维护在 `.ai/runtime-governance/governance.json`；每个变更的上下文、事件和评估记录保留在对应的 `openspec/changes/{feature}/` 下。

## 本地执行示例

对 standard / strict 变更，为每个原子任务生成上下文包：

```bash
node scripts/runtime-governance.mjs context --feature {feature} --task T-01 --owned-area src/example.js --isolated true
```

上下文包只引用已批准状态、规格路径、任务 ID、AC、依赖和验证方式，不复制完整规格。任务未批准、任务不存在、AC 不一致或依赖未满足时，结果必须为 `blocked`，不能交由执行代理继续执行。

记录不含敏感内容的运行事件并汇总：

```bash
node scripts/runtime-governance.mjs record-event --feature {feature} --event '{...}'
node scripts/runtime-governance.mjs summarize --feature {feature}
```

事件和评估记录不得保存 prompt、源码、密钥、凭据、原始输入或原始工具输出。确定性测试必须覆盖 AC；模型辅助评分可选，但必须明确记录为 `pass`、`fail` 或 `not_run`。

## 角色边界与触发

- 协调代理：路由、拆解、分派、汇总；不直接修改业务代码。
- 执行代理：一个原子任务仅有一个活跃写入者，并声明文件/区域所有权和隔离执行条件。
- 测试代理：默认只读，运行约定的测试、覆盖率和验证命令。
- 审查代理：默认只读，依据规格、任务、diff 和证据审查；不自行合并。
- 监控代理：只订阅或检查事件，反馈超时、重试、越权、验证遗漏和阻塞；无权放行交付、批准或自动修改代码。

`lite` 默认只使用执行代理；`standard` 根据风险、范围或显式策略按需增加测试、审查、监控；`strict` 必须具备执行、测试、审查、监控四类完成证据。并行只允许用于无依赖关系、拥有不同写入区域且由 Harness 提供隔离 worktree/sandbox 的任务。

## MCP 与调度边界

未来可以通过适配器把统一目录暴露为只读 MCP resources，把获策略批准的动作暴露为窄工具；但 MCP 传输、鉴权、调度、队列、worktree、sandbox 和守护进程均不在本阶段范围内。Harness 可以选择串行或并行执行这些角色，只要保持同一份上下文、策略和证据契约。

## 迁移与回退

manifest v4 项目仍可通过既有验证器，并会收到“未应用运行时治理”的兼容性警告。升级到 v5 前可先在分支上执行结构校验和一条 standard 变更试点；若需要回退，只需恢复 manifest v4，既有 OpenSpec 变更和知识归档不会被删除。
