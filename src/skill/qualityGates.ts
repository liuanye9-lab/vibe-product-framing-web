export const QUALITY_GATES = [
  '用户与场景必须具体，不能是所有人。',
  'MVP 必须只验证一个最小闭环。',
  'AI 介入必须说明具体输入、处理和输出。',
  '技术方案必须解释为什么 V1 不需要复杂后端、数据库或认证。',
  'Development Prompt 必须包含产品目标、目标用户、需求洞察、MVP 范围、页面结构、技术架构、数据结构、Mock 策略、AI API 规则、验收标准、Out of Scope、风险与盲点、禁止事项。',
];

export const TECH_COMPLEXITY_RULES = [
  '如果 localStorage 足够验证，就不要默认使用数据库。',
  '如果单用户本地流程足够验证，就不要默认加入登录。',
  '如果 mock 足够演示，就不要强制接真实 API。',
  '如果没有文件作为核心输入，就不要默认加入文件上传。',
];
