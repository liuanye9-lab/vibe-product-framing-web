const apiUrl = process.env.VIBE_API_URL;
const apiKey = process.env.VIBE_API_KEY;
const model = process.env.VIBE_API_MODEL;
const timeoutMs = Number(process.env.VIBE_API_TIMEOUT_MS || 30000);

function normalizeEndpoint(input) {
  const clean = input.trim().replace(/\/+$/, '');
  if (/\/v1\/chat\/completions$/i.test(clean)) return clean;
  if (/\/v1\/chat$/i.test(clean)) return `${clean}/completions`;
  if (/\/v1$/i.test(clean)) return `${clean}/chat/completions`;
  return `${clean}/v1/chat/completions`;
}

function extractContent(data) {
  return data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.content ?? '';
}

async function runCase(label, body) {
  const endpoint = normalizeEndpoint(apiUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    const rawText = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // leave parsed null
    }

    const result = {
      label,
      ok: response.ok,
      status: response.status,
      durationMs: Date.now() - startedAt,
      endpoint,
      responseIsJson: Boolean(parsed),
      topLevelKeys: parsed && typeof parsed === 'object' ? Object.keys(parsed) : [],
      contentPreview: String(extractContent(parsed)).slice(0, 240),
      errorPreview: response.ok ? undefined : rawText.slice(0, 800),
    };

    console.log(JSON.stringify(result, null, 2));
    return response.ok;
  } catch (error) {
    console.log(JSON.stringify({
      label,
      ok: false,
      durationMs: Date.now() - startedAt,
      endpoint,
      errorName: error?.name,
      errorMessage: error?.message,
    }, null, 2));
    return false;
  } finally {
    clearTimeout(timer);
  }
}

if (!apiUrl || !apiKey || !model) {
  console.error('Missing VIBE_API_URL, VIBE_API_KEY, or VIBE_API_MODEL.');
  process.exit(2);
}

const quickOk = await runCase('quick_ping_minimal', {
  model,
  messages: [{ role: 'user', content: 'ping' }],
});

const jsonOk = await runCase('json_test_minimal', {
  model,
  messages: [{ role: 'user', content: 'Return only JSON: {"ok":true,"provider":"mimo"}' }],
});

process.exit(quickOk && jsonOk ? 0 : 1);
