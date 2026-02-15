function generateAssertionTemplate(docJson = {}) {
  const lines = []
  lines.push('【断言模板】')
  lines.push('- UI: [填写UI断言]')
  lines.push('- 数据: [填写数据断言]')
  lines.push('- 文案: [填写文案断言]')

  const children = Array.isArray(docJson.children) ? docJson.children : []
  children.forEach((node) => {
    if (node.type === 'heading' || node.type === 'node') {
      const text = node.text ?? node.title ?? ''
      if (text) lines.push(`- 针对功能点“${text}”补充断言`)
    }
    if (node.type === 'list' && Array.isArray(node.items)) {
      node.items.forEach((item) => lines.push(`- 断言建议：${item}`))
    }
  })

  return lines.join('\n')
}

export { generateAssertionTemplate }
