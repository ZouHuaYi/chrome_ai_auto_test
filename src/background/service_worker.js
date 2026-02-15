// MV3 service worker
// 1) Receives steps from content script
// 2) Broadcasts to sidepanel (runtime.onMessage)
// 3) Persists to chrome.storage.local

import { callLLM, DEFAULTS as LLM_DEFAULTS } from './llmClient.js';

const STORAGE_KEY = 'recorded_steps';
const SETTINGS_KEY = 'settings';
const MODEL_CONFIG_KEY = 'modelConfig';
const LLM_SETTINGS_KEY = 'llmSettings';
const DEFAULT_SETTINGS = {
  enabled: true,
  events: { click: true, input: true, change: true, scroll: false },
  debounceMs: 300,
  throttleMs: 500,
  networkCapture: false
};

let currentSettings = { ...DEFAULT_SETTINGS };

function loadSettings() {
  chrome.storage.local.get([SETTINGS_KEY]).then((data) => {
    if (data[SETTINGS_KEY]) {
      currentSettings = { ...DEFAULT_SETTINGS, ...data[SETTINGS_KEY] };
    }
  });
}

loadSettings();

chrome.storage.onChanged.addListener((changes) => {
  if (changes[SETTINGS_KEY]) {
    currentSettings = { ...DEFAULT_SETTINGS, ...(changes[SETTINGS_KEY].newValue || {}) };
  }
});

chrome.runtime.onInstalled.addListener(() => {
  // no-op for now
});

async function appendStep(step) {
  const data = await chrome.storage.local.get([STORAGE_KEY]);
  const arr = Array.isArray(data[STORAGE_KEY]) ? data[STORAGE_KEY] : [];
  arr.push(step);
  await chrome.storage.local.set({ [STORAGE_KEY]: arr });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.action === 'RECORD_STEP' && message.payload) {
    const step = {
      ...message.payload,
      sender: {
        tabId: sender?.tab?.id,
        frameId: sender?.frameId,
      },
    };

    // Persist best-effort
    appendStep(step).catch(() => {});

    // Broadcast to extension pages (sidepanel)
    chrome.runtime.sendMessage({ action: 'RECORD_STEP', payload: step }).catch?.(() => {});

    sendResponse?.({ ok: true });
    return true;
  }

  if (message?.action === 'CAPTURE_SCREENSHOT') {
    const windowId = sender?.tab?.windowId;
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse?.({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse?.({ ok: true, dataUrl });
    });
    return true;
  }

  if (message?.action === 'LLM_CALL') {
    chrome.storage.local.get([MODEL_CONFIG_KEY, LLM_SETTINGS_KEY]).then((data) => {
      const modelConfig = data[MODEL_CONFIG_KEY] || {};
      const llmSettings = { ...LLM_DEFAULTS, ...(data[LLM_SETTINGS_KEY] || {}) };
      const prompt = message?.prompt || '';
      callLLM({
        baseUrl: llmSettings.baseUrl,
        apiKey: llmSettings.apiKey,
        timeoutMs: llmSettings.timeoutMs,
        retry: llmSettings.retry,
        retryBaseMs: llmSettings.retryBaseMs,
        retryMaxMs: llmSettings.retryMaxMs,
        rateLimitPerMin: llmSettings.rateLimitPerMin,
        modelConfig,
        prompt
      }).then((res) => {
        sendResponse?.(res);
      });
    });
    return true;
  }

  if (message?.action === 'GET_RECORDED_STEPS') {
    chrome.storage.local.get([STORAGE_KEY]).then((data) => {
      sendResponse?.({ ok: true, steps: data[STORAGE_KEY] || [] });
    });
    return true;
  }

  if (message?.action === 'CLEAR_RECORDED_STEPS') {
    chrome.storage.local.set({ [STORAGE_KEY]: [] }).then(() => {
      sendResponse?.({ ok: true });
    });
    return true;
  }

  return false;
});

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (!currentSettings.networkCapture) return;
    const step = {
      type: 'network',
      target: details.url,
      url: details.url,
      method: details.method,
      statusCode: details.statusCode,
      timestamp: Date.now()
    };
    appendStep(step).catch(() => {});
    chrome.runtime.sendMessage({ action: 'RECORD_STEP', payload: step }).catch?.(() => {});
  },
  { urls: ['<all_urls>'] }
);
