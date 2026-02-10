function assembleUnifiedOutput({ promptText = '', planJson = {} } = {}) {
  const planSection = JSON.stringify(planJson, null, 2)
  return [
    '【Prompt】',
    promptText || '（空）',
    '',
    '【执行计划 JSON】',
    planSection || '{}'
  ].join('\n')
}

export { assembleUnifiedOutput }
