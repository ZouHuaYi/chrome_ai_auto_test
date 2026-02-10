function assembleUnifiedOutput({ promptText = '', planJson = {}, validateJson = {} } = {}) {
  const planSection = JSON.stringify(planJson, null, 2)
  const validateSection = JSON.stringify(validateJson, null, 2)
  return [
    '【Prompt】',
    promptText || '（空）',
    '',
    '【执行计划 JSON】',
    planSection || '{}',
    '',
    '【校验计划 JSON】',
    validateSection || '{}'
  ].join('\n')
}

export { assembleUnifiedOutput }
