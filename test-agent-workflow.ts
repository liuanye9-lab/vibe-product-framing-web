/**
 * V4.4 End-to-End Agent Workflow Test
 * Simulates a real user going through the complete flow.
 * Uses Aliyun DashScope qwen-plus API.
 */
const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode';
const API_KEY = '__YOUR_ALIYUN_API_KEY__';
const MODEL = 'qwen-plus';
const PROXY = 'http://localhost:5174/api/ai-proxy';

interface StageResult {
  stage: string;
  reply: string;
  commands: string[];
  timeMs: number;
  ok: boolean;
  error?: string;
}

async function callAI(systemPrompt: string, userContent: string, timeoutMs = 40000): Promise<{ content: string; timeMs: number }> {
  const start = Date.now();
  const resp = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiUrl: API_URL,
      apiKey: API_KEY,
      timeoutMs,
      body: {
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 600,
        temperature: 0.3,
        response_format: { type: 'json_object' }
      }
    })
  });
  const data = await resp.json() as Record<string, unknown>;
  const choices = data.choices as Array<{ message: { content: string } }>;
  const content = choices?.[0]?.message?.content || '';
  return { content, timeMs: Date.now() - start };
}

async function runTest() {
  console.log('=' .repeat(60));
  console.log('Vibe Copilot V4.4 — Agent Workflow E2E Test');
  console.log('Model:', MODEL, '| API:', API_URL);
  console.log('=' .repeat(60));

  const results: StageResult[] = [];
  const accumulatedContext: Record<string, string> = {};

  // --- Stage 1: Idea Intake ---
  console.log('\n[1/6] Idea Intake — 想法收集');
  const intakePrompt = `你是产品想法收集 Agent。分析用户输入，提取关键信息并追问缺失部分。
返回 JSON: {"reply": "给用户的回复", "commands": [{"type": "ASK_USER|MOVE_NODE", "reason": "...", "payload": {}}], "questions": [], "extracted": {"targetUser": "", "scenario": "", "coreProblem": ""}}`;

  const intakeResult = await callAI(intakePrompt,
    '用户想法：我想做一个雅思生词错题管理小程序\n请分析这个想法并提取已有信息。');
  
  accumulatedContext.rawIdea = '雅思生词错题管理小程序';
  try {
    const j = JSON.parse(intakeResult.content);
    results.push({ stage: 'Intake', reply: j.reply?.slice(0, 150) || '', commands: (j.commands||[]).map((c:{type:string})=>c.type), timeMs: intakeResult.timeMs, ok: true });
    console.log('  ✅', intakeResult.timeMs + 'ms', '| Reply:', j.reply?.slice(0, 80));
    if (j.questions?.length) console.log('  📋 Questions:', j.questions);
  } catch {
    results.push({ stage: 'Intake', reply: '', commands: [], timeMs: intakeResult.timeMs, ok: false, error: 'JSON parse failed' });
    console.log('  ❌ JSON parse failed');
  }

  // --- Stage 2: Demand Diagnosis ---
  console.log('\n[2/6] Demand Diagnosis — 需求诊断');
  const demandPrompt = `你是需求诊断 Agent。根据用户的产品想法，判断需求是否成立。
分析目标用户、使用场景、核心问题。不要输出模板套话。
返回 JSON: {"reply": "...", "targetUser": "...", "scenario": "...", "coreProblem": "...", "demandScore": 1-10, "shouldContinue": true/false, "commands": []}`;

  const demandResult = await callAI(demandPrompt,
    `产品想法：雅思生词错题管理小程序
用户补充：目标用户是正在备考雅思的学生，他们在刷真题时遇到生词需要记录，但用本子或备忘录很难整理和定期复习。

请做需求诊断。`);

  accumulatedContext.targetUser = '备考雅思的学生';
  accumulatedContext.scenario = '刷真题时记录生词';
  try {
    const j = JSON.parse(demandResult.content);
    results.push({ stage: 'Demand', reply: j.reply?.slice(0, 150) || '', commands: [], timeMs: demandResult.timeMs, ok: true });
    console.log('  ✅', demandResult.timeMs + 'ms', '| Score:', j.demandScore, '|', j.reply?.slice(0, 80));
    accumulatedContext.coreProblem = j.coreProblem;
  } catch {
    results.push({ stage: 'Demand', reply: '', commands: [], timeMs: demandResult.timeMs, ok: false, error: 'JSON parse failed' });
    console.log('  ❌ JSON parse failed');
  }

  // --- Stage 3: Product Definition ---
  console.log('\n[3/6] Product Definition — 产品定义');
  const productPrompt = `你是产品定义 Agent。基于需求诊断结果，输出产品核心定义。
返回 JSON: {"reply": "...", "productOneLiner": "...", "valueProposition": "...", "commands": [{"type": "MOVE_NODE|UPDATE_BRIEF", "payload": {}}]}`;

  const productResult = await callAI(productPrompt,
    `产品想法：雅思生词错题管理小程序
目标用户：备考雅思的学生
场景：刷剑桥真题时遇到生词需要记录
核心问题：生词散乱、复习无规律、同义替换和拼写错误难以跟踪

请输出产品定义。`);

  try {
    const j = JSON.parse(productResult.content);
    results.push({ stage: 'Product', reply: j.reply?.slice(0, 150) || '', commands: (j.commands||[]).map((c:{type:string})=>c.type), timeMs: productResult.timeMs, ok: true });
    console.log('  ✅', productResult.timeMs + 'ms', '| One-liner:', j.productOneLiner?.slice(0, 80));
    accumulatedContext.productOneLiner = j.productOneLiner;
  } catch {
    results.push({ stage: 'Product', reply: '', commands: [], timeMs: productResult.timeMs, ok: false, error: 'JSON parse failed' });
    console.log('  ❌ JSON parse failed');
  }

  // --- Stage 4: MVP Scope ---
  console.log('\n[4/6] MVP Scope — 第一版范围');
  const mvpPrompt = `你是 MVP 范围决策 Agent。基于产品定义，划分 Must Have / Should Have / Out of Scope。
返回 JSON: {"reply": "...", "mustHave": "...", "shouldHave": "...", "outOfScope": "...", "minimumLoop": "用户从打开到获得价值的最短路径", "commands": []}`;

  const mvpResult = await callAI(mvpPrompt,
    `产品One-liner：${accumulatedContext.productOneLiner || '雅思生词错题管理小程序'}
请划分第一版范围。`;

  try {
    const j = JSON.parse(mvpResult.content);
    results.push({ stage: 'MVP', reply: j.reply?.slice(0, 150) || '', commands: [], timeMs: mvpResult.timeMs, ok: true });
    console.log('  ✅', mvpResult.timeMs + 'ms', '| Must Have:', j.mustHave?.slice(0, 60));
    console.log('  📋 Minimum Loop:', j.minimumLoop?.slice(0, 100));
  } catch {
    results.push({ stage: 'MVP', reply: '', commands: [], timeMs: mvpResult.timeMs, ok: false, error: 'JSON parse failed' });
    console.log('  ❌ JSON parse failed');
  }

  // --- Stage 5: Tech & Risk ---
  console.log('\n[5/6] Tech & Risk — 技术方案 + 风险审查');
  const techPrompt = `你是技术架构 Agent。基于 MVP 范围推荐技术栈。
返回 JSON: {"reply": "...", "frontend": "...", "backend": "...", "aiIntegration": "...", "risks": ["..."], "commands": []}`;

  const techResult = await callAI(techPrompt,
    '产品是第一版雅思生词错题管理小程序，请推荐技术栈。');

  try {
    const j = JSON.parse(techResult.content);
    results.push({ stage: 'TechRisk', reply: j.reply?.slice(0, 150) || '', commands: [], timeMs: techResult.timeMs, ok: true });
    console.log('  ✅', techResult.timeMs + 'ms', '| Stack:', [j.frontend, j.backend, j.aiIntegration].filter(Boolean).join(' + '));
    if (j.risks?.length) console.log('  ⚠️  Risks:', j.risks[0]?.slice(0, 80));
  } catch {
    results.push({ stage: 'TechRisk', reply: '', commands: [], timeMs: techResult.timeMs, ok: false, error: 'JSON parse failed' });
    console.log('  ❌ JSON parse failed');
  }

  // --- Stage 6: Handoff / Dev Spec ---
  console.log('\n[6/6] Handoff — 开发交付文档');
  const handoffPrompt = `你是开发交付 Agent。整合所有前序阶段的产出，生成开发交付文档。
包含：Product Brief、MVP Scope、DEV_SPEC、Acceptance Criteria、Codex Development Prompt。
返回 JSON: {"reply": "...", "productBrief": "...", "mvpScope": "...", "devSpec": "...", "acceptanceCriteria": ["..."], "developmentPrompt": "..."}`;

  const handoffResult = await callAI(handoffPrompt,
    `请整合以下信息生成开发交付文档：
产品：雅思生词错题管理小程序
目标用户：备考雅思的学生
场景：刷真题时记录生词
One-liner：${accumulatedContext.productOneLiner || '一款帮助雅思考生系统性管理生词和错题的移动学习工具'}
要求输出可交给 AI 编程工具（Cursor/Codex）直接使用的开发 Prompt。`, 50000);

  try {
    const j = JSON.parse(handoffResult.content);
    results.push({ stage: 'Handoff', reply: j.reply?.slice(0, 150) || '', commands: [], timeMs: handoffResult.timeMs, ok: true });
    console.log('  ✅', handoffResult.timeMs + 'ms', '| Brief:', j.productBrief?.slice(0, 80));
    console.log('  📋 Acceptance Criteria:', (j.acceptanceCriteria || []).length + ' items');
    console.log('  📋 Dev Prompt length:', (j.developmentPrompt || '').length + ' chars');
  } catch {
    results.push({ stage: 'Handoff', reply: '', commands: [], timeMs: handoffResult.timeMs, ok: false, error: 'JSON parse failed' });
    console.log('  ❌ JSON parse failed');
  }

  // --- Results Summary ---
  console.log('\n' + '=' .repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('=' .repeat(60));

  const totalTime = results.reduce((s, r) => s + r.timeMs, 0);
  const passCount = results.filter(r => r.ok).length;
  const failCount = results.filter(r => !r.ok).length;

  console.log(`Total stages: ${results.length} | Passed: ${passCount} | Failed: ${failCount}`);
  console.log(`Total AI time: ${totalTime}ms (${(totalTime/1000).toFixed(1)}s)`);
  console.log('');

  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon} ${r.stage.padEnd(12)} ${(r.timeMs/1000).toFixed(1)}s`.padEnd(24) + (r.reply?.slice(0, 60) || r.error || ''));
  }

  return { results, totalTime, passCount, failCount };
}

runTest().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
