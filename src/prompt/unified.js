/**
 * 组装统一输出。扩展：可选 assertionResult，写入【断言结果】段（兼容：不传则无此段）。
 */
function assembleUnifiedOutput({
  promptText = '',
  planJson = {},
  validateJson = {},
  simulateJson = {},
  assertionTemplate = '',
  assertionResult,
  modelConfig
} = {}) {
  const planSection = JSON.stringify(planJson, null, 2)
  const validateSection = JSON.stringify(validateJson, null, 2)
  const simulateSection = JSON.stringify(simulateJson, null, 2)
  const parts = []
  if (modelConfig) {
    parts.push(
      '【LLM 参数】',
      `model: ${modelConfig.model}`,
      `temperature: ${modelConfig.temperature}`,
      `max_tokens: ${modelConfig.max_tokens}`,
      ''
    )
  }
  parts.push(
    '【Prompt】',
    promptText || '（空）',
    '',
    '【执行计划 JSON】',
    planSection || '{}',
    '',
    '【校验计划 JSON】',
    validateSection || '{}',
    '',
    '【执行模拟 JSON】',
    simulateSection || '{}',
    '',
    '【断言模板】',
    assertionTemplate || '（空）'
  )
  if (assertionResult != null && typeof assertionResult === 'object') {
    const status = assertionResult.ok ? 'PASS' : 'FAIL'
    const issuesText = (assertionResult.issues || []).length
      ? (assertionResult.issues || []).map((i) => `- [${i.passed ? '通过' : '失败'}] 预期: ${i.expected} | 实际: ${i.actual}${i.reason ? ` | 原因: ${i.reason}` : ''}`).join('\n')
      : '（无）'
    parts.push(
      '',
      '【断言结果】',
      `status: ${status}`,
      `issues:\n${issuesText}`
    )
  }
  return parts.join('\n')
}

export { assembleUnifiedOutput }
