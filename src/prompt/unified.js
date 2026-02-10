function assembleUnifiedOutput({
  promptText = '',
  planJson = {},
  validateJson = {},
  simulateJson = {},
  assertionTemplate = ''
} = {}) {
  const planSection = JSON.stringify(planJson, null, 2)
  const validateSection = JSON.stringify(validateJson, null, 2)
  const simulateSection = JSON.stringify(simulateJson, null, 2)
  return [
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
  ].join('\n')
}

export { assembleUnifiedOutput }
