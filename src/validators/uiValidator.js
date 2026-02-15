/**
 * UI 校验：元素存在性。需在 content 中传入 document。
 * context: { steps, document }
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
  if (step.target) {
    if (typeof step.target === 'string' && (step.target.startsWith('/') || step.target.startsWith('('))) {
      try {
        const result = doc.evaluate(step.target, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
        return result.singleNodeValue
      } catch (_) {
        return null
      }
    }
    try {
      return doc.querySelector(step.target)
    } catch (_) {
      return null
    }
  }
  return null
}

function validate(context = {}) {
  const issues = []
  const doc = context.document
  const steps = Array.isArray(context.steps) ? context.steps : []
  if (!doc) {
    return { ok: true, type: 'ui', issues: [] }
  }
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.type === 'network' || step.type === 'scroll') continue
    const el = resolveElement(doc, step)
    if (!el) {
      issues.push({
        kind: 'ui',
        message: 'element not found',
        selector: step.target || (step.selector?.css || step.selector?.xpath) || '',
        stepIndex: i + 1
      })
    }
  }
  return {
    ok: issues.length === 0,
    type: 'ui',
    issues
  }
}

export { validate }
