/**
 * 思维导图解析：一种常见 JSON 或 Markdown 大纲 → docJson 兼容结构（树压平为 children）
 * 支持：{ name/title, children } 树形 JSON；Markdown 大纲（- / * 缩进）
 */

/**
 * 从常见思维导图 JSON 节点取标题
 * @param {object} node
 * @returns {string}
 */
function getNodeTitle(node) {
  if (!node) return '';
  const t = node.title ?? node.name ?? node.text ?? node.label ?? '';
  return typeof t === 'string' ? t.trim() : String(t);
}

/**
 * 递归压平树为 docJson.children：每节点转为 heading（按层级）或 node（兼容 assembler）
 * @param {object[]} children
 * @param {number} level
 * @param {Array} out
 */
function flattenTree(children, level, out) {
  if (!Array.isArray(children)) return;
  for (const node of children) {
    const text = getNodeTitle(node);
    const nodeLevel = Math.min(6, Math.max(1, level));
    out.push({ type: 'heading', level: nodeLevel, text: text || '（无标题）' });
    const sub = node.children ?? node.subnodes ?? node.nodes;
    if (Array.isArray(sub) && sub.length > 0) {
      flattenTree(sub, nodeLevel + 1, out);
    }
  }
}

/**
 * 解析 JSON 格式思维导图（根为 { name/title, children } 或数组）
 * @param {string} raw
 * @returns {{ type: 'document', children: Array }|null}
 */
function parseMindmapJson(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (data == null) return null;

  const doc = { type: 'document', children: [] };
  const roots = Array.isArray(data) ? data : (data.root ? [data.root] : [data]);

  for (const root of roots) {
    const text = getNodeTitle(root);
    if (text) doc.children.push({ type: 'heading', level: 1, text });
    const sub = root.children ?? root.subnodes ?? root.nodes;
    if (Array.isArray(sub)) flattenTree(sub, 2, doc.children);
  }

  return doc.children.length > 0 ? doc : null;
}

/**
 * 解析 Markdown 大纲：以 - 或 * 开头的行，缩进表示层级（2 空格或 1 tab = 1 级）
 * @param {string} raw
 * @returns {{ type: 'document', children: Array }}
 */
function parseMindmapOutline(raw) {
  const doc = { type: 'document', children: [] };
  const lines = (raw || '').replace(/\r\n/g, '\n').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = line.match(/^(\s*)[-*]\s+(.*)$/) || line.match(/^(\s*)(\d+\.)\s+(.*)$/);
    if (!match) continue;
    const indent = match[1];
    const text = (match[2] || match[3] || '').trim();
    const depth = indent ? (indent.includes('\t') ? indent.length : Math.floor(indent.length / 2)) : 0;
    const level = Math.min(6, Math.max(1, depth + 1));
    doc.children.push({ type: 'heading', level, text: text || '' });
  }

  return doc;
}

/**
 * 思维导图解析入口：先尝试 JSON，否则按 Markdown 大纲解析
 * @param {string} input
 * @returns {{ ok: boolean, docJson?: object, error?: string }}
 */
function parseMindmap(input) {
  if (input == null) input = '';
  const raw = typeof input === 'string' ? input.trim() : String(input);
  if (!raw) return { ok: true, docJson: { type: 'document', children: [] } };

  const jsonResult = parseMindmapJson(raw);
  if (jsonResult) return { ok: true, docJson: jsonResult };

  const outlineResult = parseMindmapOutline(raw);
  return { ok: true, docJson: outlineResult };
}

export { parseMindmap, parseMindmapJson, parseMindmapOutline };
