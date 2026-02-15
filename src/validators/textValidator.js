/**
 * 文本校验：页面是否包含步骤中的文本/值。需在 content 中传入 document。
 * context: { steps, document }
 * 若 value 为 [REDACTED] 等占位则跳过该校验项。
 */
function validate(context = {}) {
  const issues = []
  const doc = context.document
  const steps = Array.isArray(context.steps) ? context.steps : []
  if (!doc || !doc.body) {
    return { ok: true, type: 'text', issues: [] }
  }
  const bodyText = (doc.body.innerText || doc.body.textContent || '').trim()
  const isRedacted = (v) => !v || /^\[REDACTED/.test(String(v))
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    if (step.type === 'network' || step.type === 'scroll') continue
    const str = step.text != null ? String(step.text).trim() : (step.value != null ? String(step.value).trim() : '')
    if (!str || isRedacted(step.value)) continue
    if (!bodyText.includes(str)) {
      issues.push({
        kind: 'text',
        message: 'page text does not contain expected',
        expected: str.slice(0, 80),
        stepIndex: i + 1
      })
    }
  }
  return {
    ok: issues.length === 0,
    type: 'text',
    issues
  }
}

export { validate }