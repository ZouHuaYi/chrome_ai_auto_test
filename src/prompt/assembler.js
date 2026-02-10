function formatSteps(steps = []) {
  if (!Array.isArray(steps) || steps.length === 0) return '（无）'
  return steps
    .map((s, i) => {
      const parts = []
      parts.push(`${i + 1}. ${s.type || 'unknown'}`)
      if (s.target) parts.push(`target: ${s.target}`)
      if (s.text) parts.push(`text: ${s.text}`)
      if (s.value) parts.push(`value: ${s.value}`)
      return parts.join(' | ')
    })
    .join('\n')
}

function assemblePrompt({ steps = [], docJson = {} } = {}) {
  const header = '你是自动化测试智能体。请根据以下录制步骤与需求文档结构生成测试指令集。'
  const goal = '【测试目标】\n- 覆盖核心业务流程\n- 发现关键UI/数据/文案问题'
  const stepSection = `\n\n【录制步骤】\n${formatSteps(steps)}`
  const asserts = [
    '【断言占位】',
    '- UI 断言: [在此补充]',
    '- 数据断言: [在此补充]',
    '- 文案断言: [在此补充]'
  ].join('\n')
  const retry = [
    '【失败重试策略】',
    '- 每步失败重试 2 次',
    '- 关键步骤失败则终止并输出错误摘要'
  ].join('\n')
  const llmHint = [
    '【LLM 接口占位】',
    '- model: [placeholder]',
    '- temperature: [placeholder]',
    '- max_tokens: [placeholder]'
  ].join('\n')
  const docSection = `\n\n【需求文档结构(JSON)】\n${JSON.stringify(docJson, null, 2)}`
  return `${header}\n${goal}${stepSection}\n\n${asserts}\n\n${retry}\n\n${llmHint}${docSection}`
}

export { assemblePrompt }
