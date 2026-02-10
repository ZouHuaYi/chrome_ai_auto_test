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
  const stepSection = `\n\n【录制步骤】\n${formatSteps(steps)}`
  const docSection = `\n\n【需求文档结构(JSON)】\n${JSON.stringify(docJson, null, 2)}`
  return `${header}${stepSection}${docSection}`
}

export { assemblePrompt }
