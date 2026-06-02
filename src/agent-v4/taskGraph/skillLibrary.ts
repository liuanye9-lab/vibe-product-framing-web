/**
 * V5.2 Skill Library — Decision workflow skills that the Agent can reference
 *
 * Skills are reusable patterns for common decision tasks.
 * The planner receives relevant skills to avoid starting from scratch.
 */

const SKILL_STORAGE_KEY = 'vibepilot_agent_taskgraph_skills_v1';
const MAX_SKILLS = 50;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AgentSkill {
  id: string;
  title: string;
  triggerTags: string[];
  applicableWhen: string;
  recommendedSteps: string[];
  requiredTools: string[];
  qualityChecks: string[];
  badCases: string[];
  createdAt: string;
  updatedAt: string;
}

// ─── Preset Skills ──────────────────────────────────────────────────────────

const PRESET_SKILLS: AgentSkill[] = [
  {
    id: 'skill-mvp-scope-control',
    title: 'MVP Scope Control',
    triggerTags: ['mvp', 'scope', '范围', '功能', 'p0', 'p1'],
    applicableWhen: '用户需要定义 MVP 范围或控制功能膨胀时',
    recommendedSteps: [
      '从 rawIdea 提取核心功能',
      '使用 deriveScopeControl 分类 P0/P1/P2/Out of Scope',
      '检查范围膨胀关键词（登录/注册/支付/后台管理等）',
      '生成范围风险提示',
      '请求用户确认 MVP 范围',
    ],
    requiredTools: ['deriveScopeControlTool', 'inspectBriefContext'],
    qualityChecks: ['P0 不超过 5 个', '有明确 Out of Scope', '有范围风险提示'],
    badCases: ['P0 包含 10+ 功能导致范围过大', '没有 Out of Scope 导致无限膨胀'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'skill-risk-counterargument',
    title: 'Risk Counterargument',
    triggerTags: ['risk', '风险', '反证', '失败', '问题'],
    applicableWhen: '用户需要分析产品风险或进行反证思考时',
    recommendedSteps: [
      '分析需求风险（用户不存在、需求不真实）',
      '分析技术风险（实现复杂度、依赖风险）',
      '分析商业风险（变现、竞争）',
      '分析范围风险（功能过多、工期过长）',
      '为每个风险提供缓解策略',
    ],
    requiredTools: ['inspectBriefContext', 'evaluateRequirementQualityTool'],
    qualityChecks: ['至少 3 个风险点', '每个风险有缓解策略', '有反证论点'],
    badCases: ['只列出正面因素没有风险', '风险过于笼统没有具体场景'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'skill-ears-acceptance',
    title: 'EARS Acceptance Criteria',
    triggerTags: ['ears', '验收', '标准', '测试', 'acceptance'],
    applicableWhen: '用户需要生成可测试的验收标准时',
    recommendedSteps: [
      '收集 P0 功能列表',
      '收集用户场景',
      '生成 ubiquitous 需求（系统始终满足）',
      '生成 event_driven 需求（基于功能触发）',
      '生成 state_driven 需求（基于状态变化）',
      '生成 unwanted 需求（Out of Scope）',
    ],
    requiredTools: ['generateEarsCriteriaTool', 'inspectBriefContext'],
    qualityChecks: ['至少 3 条验收标准', '每条可测试', '覆盖 P0 核心功能'],
    badCases: ['验收标准不可测试（如"用户体验好"）', '标准过于笼统无法验证'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'skill-codex-task-pack',
    title: 'Codex Task Pack Builder',
    triggerTags: ['codex', 'task', '任务包', '开发', 'handoff'],
    applicableWhen: '用户需要生成可执行的开发任务包时',
    recommendedSteps: [
      '确认 DEV_SPEC 存在且完整',
      '确认 Acceptance Criteria 存在',
      '调用 buildCodexTaskPack 生成任务包',
      '调用 validateCodexTaskPack 校验',
      '检查 forbiddenChanges',
      '检查 npm run lint / build 验收',
    ],
    requiredTools: ['buildDevSpecTool', 'buildCodexTaskPackTool', 'validateCodexTaskPackTool'],
    qualityChecks: ['包含 objective', '包含 filePlan', '包含 acceptanceTests', '包含 forbiddenChanges'],
    badCases: ['缺少 filePlan 导致开发无方向', '没有 forbiddenChanges 导致过度开发'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'skill-api-diagnosis',
    title: 'API Connection Diagnosis',
    triggerTags: ['api', '连接', '错误', '500', 'timeout', '诊断'],
    applicableWhen: 'API 调用失败需要诊断时',
    recommendedSteps: [
      '检查 API Health 状态',
      '检查 API 配置（URL/Key/Model）',
      '测试基础连接',
      '测试 JSON 解析',
      '分析错误类型（auth/timeout/http/parse）',
    ],
    requiredTools: ['inspectBriefContext'],
    qualityChecks: ['明确错误类型', '有具体修复建议'],
    badCases: ['误判为网络问题实际是配置错误', '没有检查 API Key 有效性'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'skill-frontend-visual',
    title: 'Frontend Visual Cleanup',
    triggerTags: ['ui', '视觉', '样式', 'css', '设计', '清理'],
    applicableWhen: '用户需要优化前端视觉或清理 UI 时',
    recommendedSteps: [
      '检查当前视觉风格',
      '识别不一致的元素',
      '应用设计规范（留白、层级、色彩）',
      '验证响应式布局',
    ],
    requiredTools: [],
    qualityChecks: ['视觉一致性', '信息层级清晰', '留白合理'],
    badCases: ['过度设计导致信息过载', '忽视移动端适配'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ─── Storage ────────────────────────────────────────────────────────────────

function loadSkills(): AgentSkill[] {
  try {
    const raw = localStorage.getItem(SKILL_STORAGE_KEY);
    if (!raw) return [...PRESET_SKILLS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...PRESET_SKILLS];

    // Merge presets with user skills (presets first, then user additions)
    const presetIds = new Set(PRESET_SKILLS.map(s => s.id));
    const userSkills = (parsed as AgentSkill[]).filter(s => !presetIds.has(s.id));
    return [...PRESET_SKILLS, ...userSkills].slice(0, MAX_SKILLS);
  } catch {
    return [...PRESET_SKILLS];
  }
}

function saveSkills(skills: AgentSkill[]): void {
  try {
    localStorage.setItem(SKILL_STORAGE_KEY, JSON.stringify(skills));
  } catch {
    // Storage full — silently fail
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function listSkills(): AgentSkill[] {
  return loadSkills();
}

export function findRelevantSkills(input: {
  userMessage: string;
  currentTaskTitle: string;
  tags: string[];
}): AgentSkill[] {
  const skills = loadSkills();
  const query = `${input.userMessage} ${input.currentTaskTitle} ${input.tags.join(' ')}`.toLowerCase();

  return skills
    .map(skill => {
      let score = 0;

      // Tag match
      for (const tag of skill.triggerTags) {
        if (query.includes(tag.toLowerCase())) {
          score += 2;
        }
      }

      // Title match
      if (query.includes(skill.title.toLowerCase())) {
        score += 3;
      }

      // Applicable when match
      const applicableWords = skill.applicableWhen.toLowerCase().split(/[，,、\s]+/);
      for (const word of applicableWords) {
        if (word.length > 1 && query.includes(word)) {
          score += 1;
        }
      }

      return { skill, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(item => item.skill);
}

export function saveSkill(skill: AgentSkill): void {
  const skills = loadSkills();
  const existing = skills.findIndex(s => s.id === skill.id);
  if (existing >= 0) {
    skills[existing] = { ...skill, updatedAt: new Date().toISOString() };
  } else {
    skills.push({ ...skill, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  saveSkills(skills);
}

export function getSkill(id: string): AgentSkill | undefined {
  return loadSkills().find(s => s.id === id);
}

export function deleteSkill(id: string): void {
  // Don't delete presets
  if (PRESET_SKILLS.some(s => s.id === id)) return;
  const skills = loadSkills().filter(s => s.id !== id);
  saveSkills(skills);
}
