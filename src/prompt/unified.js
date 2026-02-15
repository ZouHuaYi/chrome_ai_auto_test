function assembleUnifiedOutput({
  promptText = '',
  planJson = {},
  validateJson = {},
  simulateJson = {},
  assertionTemplate = '',
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
  return parts.join('\n')
}

export { assembleUnifiedOutput }
