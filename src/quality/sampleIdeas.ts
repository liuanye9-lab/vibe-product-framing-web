export const SAMPLE_IDEAS = [
  {
    input: '我想做一个雅思生词和错题管理工具',
    expectedDocs: ['case-ielts-reading-webapp'],
  },
  {
    input: '我想做一个提示词评测系统，给设计学生比较不同 prompt 的生图效果',
    expectedDocs: ['case-prompteval-lab'],
  },
  {
    input: '我想做一个 AI 客服回复质量评估工具，判断回复是否准确和有同理心',
    expectedDocs: ['case-ai-customer-service-evaluation'],
  },
  {
    input: '我想做一个股票投资复盘工具',
    expectedDocs: ['template-product-brief', 'template-mvp-scope'],
    shouldNotPrefer: ['case-ielts-reading-webapp', 'case-ai-customer-service-evaluation'],
  },
];
