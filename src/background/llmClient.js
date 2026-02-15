const DEFAULTS = {
  baseUrl: 'https://api.openai.com/v1',
  timeoutMs: 30000,
  retry: 2,
  retryBaseMs: 500,
  retryMaxMs: 8000,
  rateLimitPerMin: 60
};

let queue = Promise.resolve();
let nextAllowedAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBaseUrl(baseUrl) {
  const base = String(baseUrl || DEFAULTS.baseUrl).replace(/\/+$/, '');
  if (base.endsWith('/v1')) return base;
  return `${base}/v1`;
}

function classifyHttpError(status, bodyText) {
  if (status === 401 || status === 403) {
    return { type: 'auth', retryable: false, message: bodyText || 'Unauthorized' };
  }
  if (status === 429) {
    return { type: 'rate_limit', retryable: true, message: bodyText || 'Rate limited' };
  }
  if (status >= 500) {
    return { type: 'server', retryable: true, message: bodyText || `Server error ${status}` };
  }
  if (status >= 400) {
    return { type: 'invalid_request', retryable: false, message: bodyText || `Request error ${status}` };
  }
  return { type: 'unknown', retryable: false, message: bodyText || `HTTP ${status}` };
}

function classifyError(err) {
  if (err?.name === 'AbortError') {
    return { type: 'timeout', retryable: true, message: 'Request timed out' };
  }
  return { type: 'network', retryable: true, message: err?.message || String(err) };
}

async function applyRateLimit(rateLimitPerMin) {
  const rpm = Number(rateLimitPerMin) || 0;
  if (rpm <= 0) return;
  const minInterval = Math.max(1, Math.floor(60000 / rpm));
  const now = Date.now();
  if (now < nextAllowedAt) {
    await sleep(nextAllowedAt - now);
  }
  nextAllowedAt = Date.now() + minInterval;
}

async function callOnce({ baseUrl, apiKey, modelConfig, prompt, timeoutMs }) {
  if (!apiKey) {
    return { ok: false, error: { type: 'auth', retryable: false, message: 'Missing API key' } };
  }
  const endpoint = `${normalizeBaseUrl(baseUrl)}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs || DEFAULTS.timeoutMs);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelConfig?.model || 'gpt-4o',
        temperature: modelConfig?.temperature ?? 0.2,
        max_tokens: modelConfig?.max_tokens ?? 2048,
        messages: [{ role: 'user', content: prompt || '' }]
      }),
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, error: { ...classifyHttpError(res.status, text), status: res.status } };
    }
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    const content =
      json?.choices?.[0]?.message?.content ??
      json?.choices?.[0]?.text ??
      text;
    return { ok: true, data: json, content };
  } catch (err) {
    return { ok: false, error: classifyError(err) };
  } finally {
    clearTimeout(timeout);
  }
}

async function callWithRetry(config) {
  const retries = Number(config.retry ?? DEFAULTS.retry) || 0;
  const retryBaseMs = Number(config.retryBaseMs ?? DEFAULTS.retryBaseMs) || DEFAULTS.retryBaseMs;
  const retryMaxMs = Number(config.retryMaxMs ?? DEFAULTS.retryMaxMs) || DEFAULTS.retryMaxMs;
  let attempt = 0;
  let lastError = null;
  while (attempt <= retries) {
    if (attempt > 0) {
      const backoff = Math.min(retryMaxMs, retryBaseMs * 2 ** (attempt - 1));
      const jitter = Math.floor(Math.random() * 200);
      await sleep(backoff + jitter);
    }
    const res = await callOnce(config);
    if (res.ok) return res;
    lastError = res.error;
    if (!res.error?.retryable) break;
    attempt += 1;
  }
  return { ok: false, error: lastError || { type: 'unknown', retryable: false, message: 'Unknown error' } };
}

async function callLLM(config) {
  const task = async () => {
    await applyRateLimit(config.rateLimitPerMin ?? DEFAULTS.rateLimitPerMin);
    return callWithRetry(config);
  };
  queue = queue.then(task, task);
  return queue;
}

export { callLLM, DEFAULTS };
