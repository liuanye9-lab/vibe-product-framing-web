export const TECH_TRANSLATION_EXAMPLE = {
  userNeed: '用户需要保存历史项目',
  requiredCapability: '数据持久化',
  v1Implementation: 'localStorage',
  whyThisIsEnough: 'V1 只验证个人本地使用，不需要跨设备同步',
  upgradeCondition: '当用户需要账号、跨设备同步、多项目管理时，再接 Supabase',
};

export const MOCK_STRATEGY_EXAMPLE = {
  value: 'V1 使用 localStorage 保存历史项目',
  reason: '先验证个人本地使用',
  risks: ['清缓存会丢失'],
};
