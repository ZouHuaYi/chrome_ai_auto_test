// MV3 service worker
// 1) Receives steps from content script
// 2) Broadcasts to sidepanel (runtime.onMessage)
// 3) Persists to chrome.storage.local

const STORAGE_KEY = 'recorded_steps';

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
