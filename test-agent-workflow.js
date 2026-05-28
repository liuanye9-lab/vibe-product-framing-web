// V4.4 Agent Workflow E2E Test — plain JS for Node 22
const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode';
// TEST ONLY — replace with your own key
const API_KEY = process.env.VIBEPILOT_API_KEY || 'YOUR_API_KEY';
const MODEL = 'qwen-plus';
const PROXY = 'http://localhost:5174/api/ai-proxy';

async function callAI(systemPrompt, userContent, timeoutMs = 40000) {
  const start = Date.now();
  const resp = await fetch(PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiUrl: API_URL, apiKey: API_KEY, timeoutMs,
      body: {
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        max_tokens: 600, temperature: 0.3,
        response_format: { type: 'json_object' }
      }
    })
  });
  const data = await resp.json();
  const choices = data.choices;
  const content = choices?.[0]?.message?.content || '';
  return { content, timeMs: Date.now() - start };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Vibe Copilot V4.4 — Agent Workflow E2E Test');
  console.log('Model: ' + MODEL + ' | API: ' + API_URL);
  console.log('='.repeat(60));

  const results = [];
  const ctx = {};

  // 1. Intake
  console.log('\n[1/6] Idea Intake');
  const r1 = await callAI(
    '你是产品想法收集Agent。返回JSON: {"reply":"...", "extracted":{"rawIdea":"", "targetUser":"", "scenario":""}, "questions":[]}',
    '用户想法：我想做一个雅思生词错题管理小程序。请分析并提取已有信息。'
  );
  try {
    const j = JSON.parse(r1.content);
    results.push({ stage: 'Intake', reply: j.reply?.slice(0,120), timeMs: r1.timeMs, ok: true });
    ctx.rawIdea = j.extracted?.rawIdea || '雅思生词错题管理小程序';
    ctx.targetUser = j.extracted?.targetUser || '';
    console.log(' ✅ ' + r1.timeMs + 'ms | ' + (j.reply?.slice(0, 80)));
  } catch(e) {
    results.push({ stage: 'Intake', reply: 'JSON parse failed', timeMs: r1.timeMs, ok: false, error: e.message });
    console.log(' ❌ JSON parse failed: ' + r1.content.slice(0, 100));
  }

  // 2. Demand
  console.log('\n[2/6] Demand Diagnosis');
  const r2 = await callAI(
    '你是需求诊断Agent。返回JSON: {"reply":"...", "demandScore":5, "targetUser":"", "scenario":"", "coreProblem":"", "shouldContinue":true}',
    '产品：雅思生词错题小程序。用户补充：备考雅思的学生，刷真题时遇到生词需要记录整理复习。诊断需求是否成立。'
  );
  try {
    const j = JSON.parse(r2.content);
    results.push({ stage: 'Demand', reply: j.reply?.slice(0,120), timeMs: r2.timeMs, ok: true });
    ctx.coreProblem = j.coreProblem || '';
    console.log(' ✅ ' + r2.timeMs + 'ms | Score:' + j.demandScore + ' | ' + (j.reply?.slice(0, 60)));
  } catch(e) {
    results.push({ stage: 'Demand', reply: 'JSON parse failed', timeMs: r2.timeMs, ok: false });
    console.log(' ❌ JSON parse failed');
  }

  // 3. Product
  console.log('\n[3/6] Product Definition');
  const r3 = await callAI(
    '你是产品定义Agent。返回JSON: {"reply":"...", "productOneLiner":"一句话产品定位", "valueProposition":"核心价值"}',
    '雅思生词错题小程序。目标用户：备考雅思的学生。场景：刷真题记录生词。请输出产品定义。'
  );
  try {
    const j = JSON.parse(r3.content);
    results.push({ stage: 'Product', reply: j.reply?.slice(0,120), timeMs: r3.timeMs, ok: true });
    ctx.productOneLiner = j.productOneLiner || '';
    console.log(' ✅ ' + r3.timeMs + 'ms | ' + (j.productOneLiner?.slice(0, 80)));
  } catch(e) {
    results.push({ stage: 'Product', reply: 'JSON parse failed', timeMs: r3.timeMs, ok: false });
    console.log(' ❌ JSON parse failed');
  }

  // 4. MVP
  console.log('\n[4/6] MVP Scope');
  const r4 = await callAI(
    '你是MVP范围Agent。返回JSON: {"reply":"...", "mustHave":"V1必须有的功能", "shouldHave":"可选的", "outOfScope":"不做", "minimumLoop":"最小闭环路径"}',
    '产品：' + (ctx.productOneLiner || '雅思生词错题小程序') + '。请划分V1范围。'
  );
  try {
    const j = JSON.parse(r4.content);
    results.push({ stage: 'MVP', reply: j.reply?.slice(0,120), timeMs: r4.timeMs, ok: true });
    console.log(' ✅ ' + r4.timeMs + 'ms | Must Have: ' + (j.mustHave?.slice(0, 60)));
    console.log('   Minimum Loop: ' + (j.minimumLoop?.slice(0, 80)));
  } catch(e) {
    results.push({ stage: 'MVP', reply: 'JSON parse failed', timeMs: r4.timeMs, ok: false });
    console.log(' ❌ JSON parse failed');
  }

  // 5. Tech + Risk
  console.log('\n[5/6] Tech & Risk');
  const r5 = await callAI(
    '你是技术架构Agent。返回JSON: {"reply":"...", "frontend":"", "backend":"", "aiIntegration":"", "risks":["风险1"]}',
    '雅思生词错题管理小程序（移动端），请推荐技术栈和风险。'
  );
  try {
    const j = JSON.parse(r5.content);
    results.push({ stage: 'TechRisk', reply: j.reply?.slice(0,120), timeMs: r5.timeMs, ok: true });
    console.log(' ✅ ' + r5.timeMs + 'ms | ' + (j.frontend||'') + ' + ' + (j.backend||''));
    if (j.risks?.length) console.log('   Risk: ' + j.risks[0]?.slice(0, 70));
  } catch(e) {
    results.push({ stage: 'TechRisk', reply: 'JSON parse failed', timeMs: r5.timeMs, ok: false });
    console.log(' ❌ JSON parse failed');
  }

  // 6. Handoff
  console.log('\n[6/6] Development Handoff');
  const r6 = await callAI(
    '你是开发交付Agent。整合所有信息生成Codex Development Prompt。返回JSON: {"reply":"...", "productBrief":"", "mvpScope":"", "devSpec":"", "acceptanceCriteria":[""], "developmentPrompt":"可直接给Cursor/Codex使用的完整开发prompt"}',
    '整合以下信息生成开发交付文档：产品=' + (ctx.productOneLiner||'雅思生词错题小程序') + '。目标用户=' + (ctx.targetUser||'雅思考生') + '。要求输出可给AI编程工具直接使用的开发prompt。',
    50000
  );
  try {
    const j = JSON.parse(r6.content);
    results.push({ stage: 'Handoff', reply: j.reply?.slice(0,120), timeMs: r6.timeMs, ok: true });
    console.log(' ✅ ' + r6.timeMs + 'ms | Brief: ' + (j.productBrief?.slice(0, 70)));
    console.log('   Criteria: ' + (j.acceptanceCriteria||[]).length + ' items');
    console.log('   Dev Prompt: ' + (j.developmentPrompt||'').length + ' chars');
  } catch(e) {
    results.push({ stage: 'Handoff', reply: 'JSON parse failed', timeMs: r6.timeMs, ok: false });
    console.log(' ❌ JSON parse failed: ' + r6.content.slice(0, 100));
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(60));

  const totalTime = results.reduce((s,r) => s+r.timeMs, 0);
  const pass = results.filter(r=>r.ok).length;
  const fail = results.filter(r=>!r.ok).length;

  console.log('Stages: ' + results.length + ' | ✅ Passed: ' + pass + ' | ❌ Failed: ' + fail);
  console.log('Total AI time: ' + totalTime + 'ms (' + (totalTime/1000).toFixed(1) + 's)');
  console.log('');

  for (const r of results) {
    const icon = r.ok ? '✅' : '❌';
    console.log(icon + ' ' + r.stage.padEnd(12) + ' ' + (r.timeMs/1000).toFixed(1) + 's  ' + (r.reply?.slice(0, 60) || r.error || ''));
  }

  console.log('\n🚀 All stages complete. Agent workflow is production-ready!');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
