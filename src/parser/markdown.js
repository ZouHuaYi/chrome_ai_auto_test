// 基础 Markdown 解析器（行级）
// 支持：标题、段落、无序/有序列表

function parseMarkdown(input = '') {
  const lines = input.replace(/\r\n/g, '\n').split('\n')
  const doc = { type: 'document', children: [] }

  let paragraphBuffer = []
  let listBuffer = null

  function flushParagraph() {
    if (paragraphBuffer.length === 0) return
    const text = paragraphBuffer.join(' ').trim()
    if (text) doc.children.push({ type: 'paragraph', text })
    paragraphBuffer = []
  }

  function flushList() {
    if (!listBuffer) return
    if (listBuffer.items.length > 0) {
      doc.children.push(listBuffer)
    }
    listBuffer = null
  }

  for (const raw of lines) {
    const line = raw.trim()

    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    // heading
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()
      doc.children.push({ type: 'heading', level, text })
      continue
    }

    // list item (ordered/unordered)
    const unorderedMatch = line.match(/^[-*+]\s+(.*)$/)
    const orderedMatch = line.match(/^\d+\.\s+(.*)$/)
    if (unorderedMatch || orderedMatch) {
      flushParagraph()
      const ordered = Boolean(orderedMatch)
      const itemText = (unorderedMatch ? unorderedMatch[1] : orderedMatch[1]).trim()

      if (!listBuffer || listBuffer.ordered !== ordered) {
        flushList()
        listBuffer = { type: 'list', ordered, items: [] }
      }

      listBuffer.items.push(itemText)
      continue
    }

    // paragraph (merge consecutive lines)
    paragraphBuffer.push(line)
  }

  flushParagraph()
  flushList()

  return doc
}

export { parseMarkdown }
