/**
 * 数据校验：简单 JSON 比对。context: { expectedData, actualData }
 * 两者均为可选；缺省时不报 issue。
 */
function deepEqual(a, b) {
  if (a === b) return true
  if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const k of keysA) {
    if (!keysB.includes(k) || !deepEqual(a[k], b[k])) return false
  }
  return true
}

function validate(context = {}) {
  const issues = []
  const expected = context.expectedData
  const actual = context.actualData
  if (expected == null && actual == null) {
    return { ok: true, type: 'data', issues: [] }
  }
  if (expected != null && actual != null && !deepEqual(expected, actual)) {
    issues.push({
      kind: 'data',
      message: 'JSON mismatch',
      summary: 'expectedData !== actualData'
    })
  }
  return {
    ok: issues.length === 0,
    type: 'data',
    issues
  }
}

export { validate }
