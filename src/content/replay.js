/**
 * 回放执行器：在页面中真实执行 click/input/change/scroll，复用 recorder 的 step 结构。
 * 供 content script 在收到 REPLAY 时调用。
 */

function resolveElement(doc, step) {
  if (!doc || !step) return null
  const sel = step.selector || {}
  if (sel.xpath) {
    try {
      const result = doc.evaluate(sel.xpath, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
      return result.singleNodeValue
    } catch (_) {
      return null
    }
  }
  if (sel.css) {
    try {
      return doc.querySelector(sel.css)
    } catch (_) {
      return null
    }
  }
  if (step.target && (step.target.startsWith('/') || step.target.startsWith('('))) {
    try {
      const result = doc.evaluate(step.target, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
      return result.singleNodeValue
    } catch (_) {
      return null
    }
  }
  if (step.target) {
    try {
      return doc.querySelector(step.target)
    } catch (_) {
      return null
    }
  }
  return null
}

function executeOneStep(doc, step, index) {
  const log = { index: index + 1, step, status: 'FAIL', note: '' }
  if (step.type === 'network') {
    log.status = 'SKIP'
    log.note = 'network step skipped in replay'
    return log
  }

  if (step.type === 'scroll') {
    try {
      const x = step.scroll?.x ?? 0
      const y = step.scroll?.y ?? 0
      window.scrollTo(x, y)
      log.status = 'OK'
      log.note = `scrollTo(${x}, ${y})`
    } catch (e) {
      log.note = String(e?.message || e)
    }
    return log
  }

  const el = resolveElement(doc, step)
  if (!el) {
    log.note = 'element not found'
    return log
  }

  try {
    if (step.type === 'click') {
      el.click()
      log.status = 'OK'
      log.note = 'clicked'
    } else if (step.type === 'input' || step.type === 'change') {
      const value = step.value != null ? String(step.value) : ''
      if (el.isContentEditable) {
        el.textContent = value
        el.dispatchEvent(new Event('input', { bubbles: true }))
      } else if ('value' in el) {
        el.value = value
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      }
      log.status = 'OK'
      log.note = 'value set'
    } else {
      log.status = 'SKIP'
      log.note = `unknown type: ${step.type}`
    }
  } catch (e) {
    log.note = String(e?.message || e)
  }
  return log
}

/**
 * 在当前页面执行步骤列表，返回每步状态。
 * @param {Document} doc - 页面 document（默认为当前 document）
 * @param {Array} steps - 与 recorder 一致的 step 数组
 * @returns {{ ok: boolean, report: { executed: number, logs: Array } }}
 */
function runReplay(doc, steps = []) {
  const docRef = doc || (typeof document !== 'undefined' ? document : null)
  if (!docRef) {
    return {
      ok: false,
      report: { executed: 0, logs: [] }
    }
  }
  const logs = []
  const list = Array.isArray(steps) ? steps : []
  for (let i = 0; i < list.length; i++) {
    const log = executeOneStep(docRef, list[i], i)
    logs.push(log)
  }
  const ok = logs.every((l) => l.status !== 'FAIL')
  return {
    ok,
    report: {
      executed: logs.length,
      logs
    }
  }
}

export { runReplay, resolveElement }
