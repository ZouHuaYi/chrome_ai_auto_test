/**
 * 执行计划：无 tabId 时返回 mock；有 tabId 时向 content 发送 REPLAY 真实执行并带回校验结果。
 * 保持与现有 step 结构兼容。
 */
function mockReport(steps = []) {
  const logs = (steps || []).map((step, idx) => ({
    index: idx + 1,
    step,
    status: 'SIMULATED',
    note: 'mock replay (no tab)'
  }))
  return {
    ok: true,
    report: { executed: logs.length, logs },
    validationResult: null
  }
}

/**
 * @param {Array} steps - 与 recorder 一致的 step 数组
 * @param {number} [tabId] - 当前页 tab id；无则 mock
 * @returns {Promise<{ ok: boolean, report: { executed: number, logs: Array }, validationResult: object|null }>}
 */
function executePlan(steps = [], tabId) {
  if (tabId == null || typeof tabId !== 'number') {
    return Promise.resolve(mockReport(steps))
  }
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: 'REPLAY', steps }, (response) => {
      if (chrome.runtime.lastError || !response) {
        resolve({
          ok: false,
          report: { executed: 0, logs: [{ status: 'FAIL', note: chrome.runtime.lastError?.message || 'no response' }] },
          validationResult: null
        })
        return
      }
      resolve({
        ok: response.ok,
        report: response.report || { executed: 0, logs: [] },
        validationResult: response.validationResult ?? null
      })
    })
  })
}

export { executePlan }
