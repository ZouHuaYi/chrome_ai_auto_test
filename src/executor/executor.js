/**
 * 执行计划：无 tabId 时返回 mock；有 tabId 时向 content 发送 REPLAY 真实执行并带回校验结果。
 * 保持与现有 step 结构兼容。
 */
function mockReport(steps = []) {
  const logs = (steps || []).map((step, idx) => ({
    id: `mock_${Date.now()}_${idx + 1}`,
    index: idx + 1,
    step,
    status: 'SIMULATED',
    note: 'mock replay (no tab)',
    timestamp: Date.now()
  }))
  const replay = { ok: true, report: { executed: logs.length, logs }, screenshots: {} }
  return {
    ok: true,
    report: replay.report,
    validationResult: null,
    assertionResult: { ok: true, issues: [] },
    result: {
      ok: true,
      replay,
      validation: { status: 'PASS', issues: [] },
      assertion: { ok: true, issues: [] },
      screenshots: {},
      meta: { startedAt: Date.now(), finishedAt: Date.now(), durationMs: 0 }
    }
  }
}

/**
 * @param {Array} steps - 与 recorder 一致的 step 数组
 * @param {number} [tabId] - 当前页 tab id；无则 mock
 * @param {object} [options] - replay options (e.g. captureScreenshots)
 * @returns {Promise<{ ok: boolean, report: { executed: number, logs: Array }, validationResult: object|null, assertionResult: object|null, result: object|null }>}
 */
function executePlan(steps = [], tabId, options = {}) {
  if (tabId == null || typeof tabId !== 'number') {
    return Promise.resolve(mockReport(steps))
  }
  return new Promise((resolve) => {
    const { assertionTemplate, ...replayOptions } = options || {}
    chrome.tabs.sendMessage(tabId, { action: 'REPLAY', steps, options: replayOptions, assertionTemplate }, (response) => {
      if (chrome.runtime.lastError || !response) {
        resolve({
          ok: false,
          report: { executed: 0, logs: [{ status: 'FAIL', note: chrome.runtime.lastError?.message || 'no response' }] },
          validationResult: null,
          assertionResult: null,
          result: null
        })
        return
      }
      resolve({
        ok: response.ok,
        report: response.report || { executed: 0, logs: [] },
        validationResult: response.validationResult ?? null,
        assertionResult: response.assertionResult ?? null,
        result: response.result ?? null
      })
    })
  })
}

export { executePlan }
