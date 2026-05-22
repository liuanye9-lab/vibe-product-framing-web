export const config = {
  runtime: 'edge',
};

interface EvaluateRequest {
  stepKey: string;
  stepTitle: string;
  stepQuestion: string;
  userAnswer: string;
  rawIdea: string;
  allSteps: Record<string, { userAnswer: string; aiQuality: string }>;
  mode: 'evaluate' | 'hint' | 'followup';
  previousEvaluation?: string;
}

interface EvaluateResponse {
  evaluation: string;
  quality: 'specific' | 'ok' | 'vague';
  followUp: string;
}

function buildSystemPrompt(req: EvaluateRequest): string {
  const { stepKey, stepTitle, stepQuestion, userAnswer, rawIdea, allSteps, mode, previousEvaluation } = req;

  const prevSteps = Object.entries(allSteps || {})
    .filter(([key, val]) => key !== stepKey && val.userAnswer)
    .map(([key, val]) => `- ${key}: ${val.userAnswer.slice(0, 200)}`)
    .join('\n');

  if (mode === 'hint') {
    return `你是一位资深产品经理，正在指导一个 vibe coding 新手完成产品思考练习。

当前步骤：${stepTitle}
问题描述：${stepQuestion}
用户的原始想法：${rawIdea}

用户说"我不知道怎么写"，请给他一个具体的思考方向提示。
要求：
1. 不要直接给出答案，而是给出思考路径
2. 用 2-3 个具体问题引导用户自己思考
3. 语气友好、鼓励，像一个耐心的高手带徒弟
4. 控制在 100 字以内
5. 用中文回答`;
  }

  if (mode === 'followup') {
    return `你是一位资深产品经理。用户刚刚收到了你的评价，现在在追问环节想继续深入。

当前步骤：${stepTitle}
用户之前的答案：${userAnswer}
你之前的评价：${previousEvaluation}

用户想要继续追问，请给他一个有价值的追问或思考方向。
要求：
1. 基于之前的评价，提出更深一层的问题
2. 不要重复之前的内容
3. 控制在 80 字以内
4. 用中文回答`;
  }

  // mode === 'evaluate'
  return `你是一位资深产品经理，正在评价一个 vibe coding 新手的产品思考练习答案。

## 当前步骤
步骤名：${stepTitle}
问题描述：${stepQuestion}

## 用户的原始想法（产品方向）
${rawIdea}

${prevSteps ? `## 用户之前完成的步骤\n${prevSteps}\n` : ''}

## 用户的当前答案
${userAnswer}

## 评价要求

请严格按以下 JSON 格式返回，不要输出任何其他内容：
{
  "quality": "specific" | "ok" | "vague",
  "evaluation": "评价文本",
  "followUp": "追问文本"
}

### quality 判断标准
- specific：答案包含具体的数字、场景细节、特定人群描述、可量化指标，或者结构清晰（使用了列表/编号）
- ok：方向正确但缺少具体细节，只有定性描述没有定量数据，或者覆盖面不够全
- vague：答案过于宽泛（如"所有人""提高效率""智能化"），没有具体信息，或者字数太少（< 20 字）

### evaluation 评价要求
1. 先说结论（好/还行/太模糊），再说原因
2. 引用用户答案中的具体内容（如果有的话），让用户感觉你真的看了他写的东西
3. ${prevSteps ? '检查是否和之前步骤矛盾（比如之前说不需要后端，这里却写了注册登录），如果有矛盾要指出来。' : ''}
4. 给出具体的改进方向，不要空话
5. 控制在 100-150 字
6. 用中文

### followUp 追问要求
1. 提一个具体的、可回答的问题
2. 问题应该引导用户把答案从"ok"提升到"specific"
3. 如果是 vague 答级，追问应该帮用户找到切入点
4. 控制在 50 字以内
5. 用中文`;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body: EvaluateRequest = await request.json();
    const { stepKey, userAnswer, mode } = body;

    const apiKey = process.env.AI_API_KEY;
    const apiUrl = process.env.AI_API_URL || 'https://twofishai.com';
    const model = process.env.AI_MODEL || 'gpt-5.5';

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500 }
      );
    }

    const systemPrompt = buildSystemPrompt(body);

    const userMessage = mode === 'evaluate'
      ? userAnswer
      : mode === 'hint'
        ? '我不知道怎么回答这个问题，请给我一些提示方向。'
        : '我想继续追问，请帮我深入思考。';

    const response = await fetch(`${apiUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: mode === 'evaluate' ? 500 : 200,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      return new Response(
        JSON.stringify({ error: 'AI service unavailable' }),
        { status: 502 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    if (mode === 'hint') {
      return new Response(JSON.stringify({ hint: content }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (mode === 'followup') {
      return new Response(JSON.stringify({ followUp: content }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Parse JSON from AI response
    let result: EvaluateResponse;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
        // Validate quality field
        if (!['specific', 'ok', 'vague'].includes(result.quality)) {
          result.quality = 'ok';
        }
      } else {
        throw new Error('No JSON found');
      }
    } catch {
      // Fallback: parse quality from text
      const lowerContent = content.toLowerCase();
      let quality: 'specific' | 'ok' | 'vague' = 'ok';
      if (lowerContent.includes('具体') || lowerContent.includes('清晰') || lowerContent.includes('很好')) {
        quality = 'specific';
      } else if (lowerContent.includes('模糊') || lowerContent.includes('宽泛') || lowerContent.includes('太笼统')) {
        quality = 'vague';
      }
      result = {
        quality,
        evaluation: content.replace(/\{[\s\S]*\}/, '').trim() || '评价生成失败，请重试。',
        followUp: '',
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Edge function error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500 }
    );
  }
}
