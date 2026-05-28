/**
 * Tech Node — determine minimal tech path.
 */

import type { ProductBrief } from '../../types';
import type {
  AgentGraphSession,
  AgentGraphNodeResult,
  AgentGraphCommand,
} from '../types';
import { generateGraphId } from '../types';
import { getDefaultNextNode } from '../graph';

export async function runTechNode(input: {
  brief: ProductBrief;
  session: AgentGraphSession;
  userMessage: string;
}): Promise<AgentGraphNodeResult> {
  const { brief } = input;
  const projectType = brief.ideaInput?.projectType || 'Web App';

  const commands: AgentGraphCommand[] = [];

  commands.push({
    id: generateGraphId('cmd'),
    type: 'UPDATE_BRIEF',
    reason: '生成技术方案',
    payload: {
      targetStage: 'technical',
      patch: {
        frontend: {
          value: 'V1 推荐 React + Vite + TypeScript + CSS/Tailwind，单页应用足够验证核心闭环。',
          reason: '当前主流、轻量、适合快速构建',
        },
        backend: {
          value: 'V1 不需要后端，只需同源 API Proxy 转发 AI 请求。',
          reason: '产品本身是构思工具，不需要业务后端',
        },
        database: {
          value: 'V1 使用 localStorage 持久化项目历史和配置。',
          reason: '单用户本地使用，不需要数据库',
        },
        aiApi: {
          value: '需要 AI API，通过同源 /api/ai-proxy 转发。',
          reason: '避免 CORS 和安全问题',
        },
        auth: {
          value: 'V1 不需要认证。',
          reason: '单用户本地工具，账号系统会增加范围',
        },
        fileUpload: {
          value: 'V1 不需要文件上传。',
          reason: '当前输入主要是文字想法',
        },
        mockStrategy: {
          value: 'Mock 策略：先用假 AI 返回结果验证流程，再接入真实 API。',
          reason: '先验证产品流程，再增加模型成本',
        },
        architectureUpgrade: {
          value: '当需要跨设备历史、账号、团队协作时再升级到 Supabase/PostgreSQL。',
          reason: '明确升级条件，避免 V1 过度工程化',
        },
      },
      source: 'local-rule',
    },
  });

  commands.push({
    id: generateGraphId('cmd'),
    type: 'CREATE_FINDING',
    reason: '技术可行性判断',
    payload: {
      title: '技术路径判断',
      summary: `V1 推荐纯前端方案（React + Vite + TypeScript），使用 localStorage 持久化，AI API 通过同源代理转发。不需要后端、数据库、认证。`,
      nodeId: 'tech',
      evidence: [`产品类型: ${projectType}`, '核心功能是构思和文档生成'],
      risks: ['浏览器清缓存会丢失数据', '不同 AI API 响应格式可能不统一'],
      suggestions: ['保持技术栈简单', '将升级条件写入文档'],
      confidence: 0.85,
    },
  });

  const reply = `技术方案分析：

前端：React + Vite + TypeScript + CSS/Tailwind（单页应用）
后端：不需要（通过 /api/ai-proxy 转发 AI 请求）
数据库：不需要（localStorage 持久化）
认证：不需要（单用户本地工具）
AI API：通过同源代理转发

Mock 策略：先用本地规则验证流程，再接入真实 AI API。
升级条件：当需要账号、跨设备、团队协作时再考虑 Supabase。

接下来审查项目风险。`;

  const nextNodeId = getDefaultNextNode('tech');

  commands.push({
    id: generateGraphId('cmd'),
    type: 'MOVE_NODE',
    reason: '技术方案完成',
    payload: { targetNodeId: nextNodeId },
  });

  return {
    nodeId: 'tech',
    reply,
    commands,
    nextNodeId,
    shouldInterrupt: false,
    confidence: 0.85,
  };
}
