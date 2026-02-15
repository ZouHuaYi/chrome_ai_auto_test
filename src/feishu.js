import { parseMarkdown } from './parser/markdown.js';

const DEFAULT_API_BASE = 'https://open.feishu.cn/open-apis';
const PUBLIC_CACHE_KEY = 'feishuPublicCache';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

const memoryCache = {
  [PUBLIC_CACHE_KEY]: {}
};

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && chrome.storage?.local;
}

function storageGet(key) {
  if (hasChromeStorage()) {
    return chrome.storage.local.get([key]).then((res) => res[key]);
  }
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  }
  return Promise.resolve(memoryCache[key] || null);
}

function storageSet(key, value) {
  if (hasChromeStorage()) {
    return chrome.storage.local.set({ [key]: value });
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(key, JSON.stringify(value));
    return Promise.resolve();
  }
  memoryCache[key] = value;
  return Promise.resolve();
}

export function getDocIdFromInput(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const urlMatch = trimmed.match(/\/docx?\/([a-zA-Z0-9_-]+)(?:\?|$|\/|#)/);
  if (urlMatch) return urlMatch[1];
  const wikiMatch = trimmed.match(/\/wiki\/([a-zA-Z0-9_-]+)(?:\?|$|\/|#)/);
  if (wikiMatch) return wikiMatch[1];
  const queryMatch = trimmed.match(/[?&](docId|doc_id|docToken|doc_token)=([a-zA-Z0-9_-]+)/i);
  if (queryMatch) return queryMatch[2];
  return trimmed;
}

export function normalizePublicDocUrl(input, apiBase = DEFAULT_API_BASE) {
  const docId = getDocIdFromInput(input);
  if (!docId) return null;
  const base = (apiBase || DEFAULT_API_BASE).replace(/\/$/, '');
  return `${base}/docx/v1/documents/${encodeURIComponent(docId)}/raw_content`;
}

function getBlockText(block) {
  if (!block) return '';
  const type = block.block_type;
  const container = block[type];
  if (!container || !Array.isArray(container.elements)) return '';
  return container.elements
    .map((el) => (el.text_run && el.text_run.text ? el.text_run.text : ''))
    .join('')
    .trim();
}

export function feishuBlocksToDocJson(blocks) {
  const doc = { type: 'document', children: [] };
  if (!Array.isArray(blocks) || blocks.length === 0) return doc;

  let listBuffer = null;

  function flushList() {
    if (listBuffer && listBuffer.items.length > 0) {
      doc.children.push(listBuffer);
    }
    listBuffer = null;
  }

  for (const block of blocks) {
    const blockType = block.block_type || '';
    const text = getBlockText(block);

    const headingMatch = blockType.match(/^heading(\d)$/);
    if (headingMatch) {
      flushList();
      const level = Math.min(6, parseInt(headingMatch[1], 10));
      doc.children.push({ type: 'heading', level, text: text || '' });
      continue;
    }

    if (blockType === 'bullet' || blockType === 'unordered') {
      if (!listBuffer || listBuffer.ordered) {
        flushList();
        listBuffer = { type: 'list', ordered: false, items: [] };
      }
      listBuffer.items.push(text || '');
      continue;
    }

    if (blockType === 'ordered') {
      if (!listBuffer || !listBuffer.ordered) {
        flushList();
        listBuffer = { type: 'list', ordered: true, items: [] };
      }
      listBuffer.items.push(text || '');
      continue;
    }

    if (blockType === 'paragraph' || blockType === 'text' || blockType === 'code' || blockType === 'quote') {
      flushList();
      if (text) doc.children.push({ type: 'paragraph', text });
      continue;
    }

    if (text) {
      flushList();
      doc.children.push({ type: 'paragraph', text });
    }
  }

  flushList();
  return doc;
}

export async function fetchDoc(config) {
  const { accessToken, docId, apiBase = DEFAULT_API_BASE } = config || {};
  if (!accessToken || !docId) {
    return { ok: false, error: 'Missing Access Token or document ID' };
  }

  const base = (apiBase || '').replace(/\/$/, '');
  const url = `${base}/docx/v1/documents/${encodeURIComponent(docId)}/blocks?document_revision_id=-1&page_size=500`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.msg || data.error_description || data.message || res.statusText;
      return { ok: false, error: `Fetch failed ${res.status}: ${msg}` };
    }

    if (data.code !== undefined && data.code !== 0) {
      return { ok: false, error: data.msg || data.message || `code: ${data.code}` };
    }

    const items = data.data?.items || [];
    const docJson = feishuBlocksToDocJson(items);
    return { ok: true, docJson };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    return { ok: false, error: `Network error: ${msg}` };
  }
}

async function getPublicCache(docId) {
  const cache = (await storageGet(PUBLIC_CACHE_KEY)) || {};
  const entry = cache[docId] || null;
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > (entry.ttlMs || DEFAULT_CACHE_TTL_MS)) {
    return { ...entry, expired: true };
  }
  return entry;
}

async function setPublicCache(docId, entry) {
  const cache = (await storageGet(PUBLIC_CACHE_KEY)) || {};
  cache[docId] = entry;
  await storageSet(PUBLIC_CACHE_KEY, cache);
}

function buildDocJsonFromText(text) {
  if (!text) return { type: 'document', children: [] };
  try {
    return parseMarkdown(text);
  } catch (_) {
    return {
      type: 'document',
      children: [{ type: 'paragraph', text: String(text) }]
    };
  }
}

export async function fetchPublicDoc(config) {
  const { input, apiBase = DEFAULT_API_BASE, cacheTtlMs = DEFAULT_CACHE_TTL_MS } = config || {};
  const docId = getDocIdFromInput(input || '');
  if (!docId) {
    return { ok: false, error: 'Missing document ID or public link' };
  }

  const cached = await getPublicCache(docId);
  if (cached && !cached.expired) {
    return { ok: true, docJson: cached.docJson, text: cached.text, cached: true };
  }

  const url = normalizePublicDocUrl(docId, apiBase);
  const headers = {};
  if (cached?.etag) headers['If-None-Match'] = cached.etag;

  try {
    const res = await fetch(url, { method: 'GET', headers });
    if (res.status === 304 && cached) {
      await setPublicCache(docId, { ...cached, fetchedAt: Date.now(), ttlMs: cacheTtlMs });
      return { ok: true, docJson: cached.docJson, text: cached.text, cached: true };
    }
    const etag = res.headers.get('etag') || '';
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = data?.msg || data?.message || res.statusText;
      return { ok: false, error: `Public fetch failed ${res.status}: ${msg}` };
    }
    const rawText =
      data?.data?.content ||
      data?.data?.markdown ||
      data?.data?.raw_content ||
      '';
    const docJson = buildDocJsonFromText(rawText);
    await setPublicCache(docId, {
      docJson,
      text: rawText,
      etag,
      fetchedAt: Date.now(),
      ttlMs: cacheTtlMs
    });
    return { ok: true, docJson, text: rawText };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    return { ok: false, error: `Public fetch error: ${msg}` };
  }
}
