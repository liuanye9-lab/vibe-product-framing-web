# Idea Validation Agent — V6.0

## 产品定位

Vibe Decision Copilot 从"AI Coding 前的提示词 / DEV_SPEC 生成工具"升级为"引导式想法验证 Agent"。

用户有一个模糊产品想法，但不知道：
- 这个想法是否有价值
- 是否已经有人做过
- 是否有开源项目可借鉴
- 是否有论文方向支撑
- 是否有公司在商业化
- 自己该不该继续做

本系统通过对话式 Agent 引导用户完成完整的想法验证流程。

## 用户问题

1. **想法模糊**：用户只有"我想做一个 XX"的模糊描述，缺乏结构化思考
2. **信息不足**：不知道市场上已有什么、竞品如何、技术方向如何
3. **决策困难**：不知道该继续做还是放弃，缺乏客观评估依据
4. **时间浪费**：可能花几周做一个已经有成熟竞品或没有市场需求的产品

## 工作流节点

```
Raw Idea
  ↓
Clarification（澄清需求）
  ↓
Research Query Planning（规划搜索）
  ↓
GitHub Research（开源项目研究）
  ↓
Paper Research（论文研究）
  ↓
Company / Competitor Research（竞品研究）
  ↓
Opportunity Evaluation（机会评估）
  ↓
Decision Recommendation（决策建议）
  ↓
DEV_SPEC / CODEX_TASK_PACK（开发交接）
```

### 节点详情

| 节点 | 输入 | 输出 | 工具 |
|------|------|------|------|
| Idea Intake | 模糊想法 + 目标类型 | 结构化想法描述 | LLM |
| Clarification | 用户补充信息 | 目标用户、场景、成功标准 | LLM |
| Query Planning | 想法描述 | GitHub/Paper/Company 查询 | LLM |
| GitHub Research | 查询列表 | 开源项目列表 + 评分 | GitHub API |
| Paper Research | 查询列表 | 论文列表 + 评分 | Semantic Scholar / arXiv |
| Competitor Research | 查询列表 | 竞品列表 + 评分 | Tavily / Brave / SerpAPI |
| Opportunity Evaluation | 研究结果 | 8 维评分 + 理由 + 风险 | LLM + 本地规则 |
| Decision | 评估结果 | do/do_not_do/validate_first/pivot | LLM + 本地规则 |
| Handoff | 决策结果 | DEV_SPEC / CODEX_TASK_PACK | 现有流程 |

## Agent 工具

### 研究工具

1. **GitHub Research**
   - 调用 `/api/research-proxy` 代理
   - 搜索 GitHub 开源项目
   - 评分维度：stars、recency、keyword relevance

2. **Paper Research**
   - 优先 Semantic Scholar API
   - 备选 arXiv API
   - 评分维度：year、keyword relevance

3. **Competitor Research**
   - 支持 Tavily / Brave / SerpAPI / Bing
   - 需要 SEARCH_API_KEY 配置
   - 评分维度：keyword relevance、URL 可信度

### DEV_SPEC / CODEX_TASK_PACK 桥接

Idea Validation 的数据单独存储在 `IdeaValidationTask` 中，不改变旧的 `ProductBrief` 结构。

当用户点击“生成 DEV_SPEC”时，系统会把当前验证结果整理成一条兼容旧输出页的本地 `ProductBrief`：

- 保留原始想法、目标用户、使用场景、成功标准。
- 写入真实研究引用；没有结果时保持为空或写明缺失证据。
- 不新增数据库，不改变历史数据结构。
- 不伪造 GitHub 项目、论文或公司。
- 然后进入现有 `DecisionOutputPage` 生成 DEV_SPEC / CODEX_TASK_PACK。

### 搜索失败策略

- GitHub 搜索失败：写入结构化错误，不编造 repo。
- Paper 搜索失败：写入结构化错误，不编造 paper。
- Company / Competitor 搜索缺少 `SEARCH_API_KEY`：节点标记为 `skipped`，报告中明确显示不可用。
- Research query planning 失败：停止本轮研究并提示检查 AI API，不使用本地伪查询替代。

### 评估工具

4. **Opportunity Evaluator**
   - 本地规则评估（不依赖 LLM）
   - 8 个维度：需求强度、用户清晰度、竞品成熟度、差异化空间、技术可行性、商业化潜力、作品集价值、Agent 工作流价值
   - 加权平均计算总分

## 数据结构

### IdeaValidationTask

```typescript
interface IdeaValidationTask {
  id: string;
  rawIdea: string;
  clarifiedIdea?: string;
  goalType: IdeaGoalType;
  targetUser?: string;
  useCase?: string;
  successDefinition?: string;
  status: ValidationNodeStatus;
  progressPercent: number;
  currentNodeId?: string;
  nodes: IdeaValidationNode[];
  research: ResearchBundle;
  evaluation?: OpportunityEvaluation;
  decision?: FinalValidationDecision;
  createdAt: string;
  updatedAt: string;
}
```

### ResearchBundle

```typescript
interface ResearchBundle {
  queryPlan?: ResearchQueryPlan;
  githubRepos: GitHubReference[];
  papers: PaperReference[];
  competitors: CompetitorReference[];
  evidenceItems: EvidenceItem[];
}
```

### OpportunityEvaluation

```typescript
interface OpportunityEvaluation {
  demandStrength: number;
  userClarity: number;
  competitorMaturity: number;
  differentiationSpace: number;
  technicalFeasibility: number;
  commercializationPotential: number;
  portfolioValue: number;
  agentWorkflowValue: number;
  overallScore: number;
  keyReasons: string[];
  keyRisks: string[];
  missingEvidence: string[];
}
```

## 技术难点

1. **搜索结果质量**
   - 依赖外部 API（GitHub、Semantic Scholar、Tavily 等）
   - API 限流、不可用时需要优雅降级
   - 搜索结果可能不相关，需要评分和过滤

2. **LLM 解析可靠性**
   - 要求 LLM 输出 JSON，但可能格式错误
   - 需要 robust 的 JSON 提取和错误处理
   - 备选方案：本地规则评估

3. **证据不编造**
   - 没有搜索结果时不能编造公司、论文、项目
   - 需要在 prompt 中明确约束
   - 缺失证据必须在 missingEvidence 中说明

4. **评估客观性**
   - 不能无依据地鼓励做项目
   - 需要基于证据的客观评分
   - 风险和缺失证据必须明确列出

## 风险与限制

1. **搜索结果质量依赖 provider**
   - 没有 SEARCH_API_KEY 时，竞品搜索不可用
   - GitHub 限流时可能返回不完整结果
   - 论文搜索可能找不到最新论文

2. **不做商业结论保证**
   - 评估结果仅供参考
   - 不替代真实用户访谈
   - 不保证商业化成功

3. **当前版本限制**
   - 不做深度竞品分析（仅搜索和基础评分）
   - 不做用户访谈模拟
   - 不做财务模型预测
   - 不做技术架构详细设计

## 后续 Roadmap

### V6.1
- [ ] 深度竞品分析（自动访问竞品网站、提取关键信息）
- [ ] 用户访谈模拟（LLM 扮演目标用户）
- [ ] 技术可行性详细评估（基于 GitHub 项目分析）

### V6.2
- [ ] 财务模型生成（成本、收入、ROI 预测）
- [ ] 市场规模估算（TAM/SAM/SOM）
- [ ] 竞品对比矩阵可视化

### V6.3
- [ ] 多轮对话优化（支持用户追问、调整方向）
- [ ] 历史对比（与之前验证的想法对比）
- [ ] 团队协作（多人参与验证过程）

### V7.0
- [ ] 自动 MVP 生成（基于验证结果自动生成代码）
- [ ] 用户反馈收集（集成问卷、访谈工具）
- [ ] 持续监控（竞品更新、市场变化提醒）
