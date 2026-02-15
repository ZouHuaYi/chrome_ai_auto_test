/**
 * 校验引擎：汇总 ui/text/data 校验，输出 status 与 issues 列表。
 * context: { steps, document?, expectedData?, actualData? }
 * 在 content script 中调用时传入 document 可执行 ui/text 校验。
 */
import { validate as uiValidate } from './uiValidator.js'
import { validate as textValidate } from './textValidator.js'
import { validate as dataValidate } from './dataValidator.js'

function run(context = {}) {
  const ui = uiValidate(context)
  const text = textValidate(context)
  const data = dataValidate(context)
  const issues = [
    ...(ui.issues || []).map((i) => ({ ...i, source: 'ui' })),
    ...(text.issues || []).map((i) => ({ ...i, source: 'text' })),
    ...(data.issues || []).map((i) => ({ ...i, source: 'data' }))
  ]
  const status = issues.length > 0 ? 'FAIL' : 'PASS'
  return {
    ok: issues.length === 0,
    context,
    result: {
      status,
      issues
    }
  }
}

export { run }
