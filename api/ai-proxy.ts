export const config = {
  runtime: 'edge',
};

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(init?.headers || {}),
    },
  });
}

function normalizeChatCompletionsEndpoint(rawApiUrl: string): string {
  const cleanUrl = rawApiUrl.trim().replace(/\/+$/, '');

  if (/\/chat\/completions$/i.test(cleanUrl)) {
    return cleanUrl;
  }

  if (/\/v1$/i.test(cleanUrl)) {
    return `${cleanUrl}/chat/completions`;
  }

  if (/\/v1\/chat$/i.test(cleanUrl)) {
    return `${cleanUrl}/completions`;
  }

  return `${cleanUrl}/v1/chat/completions`;
}

function getAbortSignal(timeoutMs: number): AbortSignal {
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
    return AbortSignal.timeout(timeoutMs);
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

function getUpstreamErrorMessage(error: unknown, endpoint: string): string {
  if (error instanceof Error) {
    return `代理无法连接到上游 API：${error.message}。已尝试请求：${endpoint}`;
  }

  return `代理无法连接到上游 API。已尝试请求：${endpoint}`;
}

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  let payload: {
    apiUrl?: string;
    apiKey?: string;
    body?: unknown;
  };

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const apiUrl = payload.apiUrl?.trim().replace(/\/+$/, '');
  const apiKey = payload.apiKey?.trim();

  if (!apiUrl || !apiKey || !payload.body) {
    return jsonResponse({ error: 'Missing apiUrl, apiKey, or body' }, { status: 400 });
  }

  if (!/^https?:\/\//i.test(apiUrl)) {
    return jsonResponse({ error: 'apiUrl must start with http:// or https://' }, { status: 400 });
  }

  const endpoint = normalizeChatCompletionsEndpoint(apiUrl);

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: getAbortSignal(90000),
      body: JSON.stringify(payload.body),
    });

    const text = await upstream.text();

    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        error: getUpstreamErrorMessage(error, endpoint),
      },
      { status: 502 }
    );
  }
}
