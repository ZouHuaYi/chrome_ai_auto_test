/**
 * 飞书文档拉取（无额外依赖，仅 fetch）
 * 可配置：accessToken、docId/链接、apiBase
 */

const DEFAULT_API_BASE = 'https://open.feishu.cn/open-apis';

/**
 * 从输入中解析文档 ID：支持完整链接或纯 Token（如 doccnXXX）
 * @param {string} input - 飞书文档链接或 document_id
 * @returns {string|null}
 */
export function getDocIdFromInput(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  // 链接形式: https://xxx.feishu.cn/docx/XXXXX 或 https://xxx.feishu.cn/doc/XXXXX
  const urlMatch = trimmed.match(/\/docx?\/([a-zA-Z0-9]+)(?:\?|$|\/)/);
  if (urlMatch) return urlMatch[1];
  // 纯 Token
  return trimmed;
}

/**
 * 从飞书 block 中提取单行文本（paragraph/heading/bullet/ordered 的 elements[].text_run.text）
 * @param {object} block - 飞书 API 返回的 block 对象
 * @returns {string}
 */
function getBlockText(block) {
  if (!block) return '';
  const type = block.block_type;
  const container = block[type];
  if (!container || !Array.isArray(container.elements)) return '';
  return container.elements
    .map((el) => (el.text_run && el.text_run.text ? el.text_run.text : ''))
    .join('')
    .trim();
}

/**
 * 将飞书 blocks 转为与 Markdown 解析一致的 docJson（heading/paragraph/list）
 * @param {Array} blocks - 飞书 /blocks 接口返回的 block 列表
 * @returns {{ type: 'document', children: Array }}
 */
export function feishuBlocksToDocJson(blocks) {
  const doc = { type: 'document', children: [] };
  if (!Array.isArray(blocks) || blocks.length === 0) return doc;

  let listBuffer = null; // { type: 'list', ordered: boolean, items: string[] }

  function flushList() {
    if (listBuffer && listBuffer.items.length > 0) {
      doc.children.push(listBuffer);
    }
    listBuffer = null;
  }

  for (const block of blocks) {
    const blockType = block.block_type || '';
    const text = getBlockText(block);

    // 标题 heading1 ~ heading9
    const headingMatch = blockType.match(/^heading(\d)$/);
    if (headingMatch) {
      flushList();
      const level = Math.min(6, parseInt(headingMatch[1], 10));
      doc.children.push({ type: 'heading', level, text: text || '' });
      continue;
    }

    // 无序列表
    if (blockType === 'bullet' || blockType === 'unordered') {
      if (!listBuffer || listBuffer.ordered) {
        flushList();
        listBuffer = { type: 'list', ordered: false, items: [] };
      }
      listBuffer.items.push(text || '');
      continue;
    }

    // 有序列表
    if (blockType === 'ordered') {
      if (!listBuffer || !listBuffer.ordered) {
        flushList();
        listBuffer = { type: 'list', ordered: true, items: [] };
      }
      listBuffer.items.push(text || '');
      continue;
    }

    // 段落、代码块、引用等按段落
    if (blockType === 'paragraph' || blockType === 'text' || blockType === 'code' || blockType === 'quote') {
      flushList();
      if (text) doc.children.push({ type: 'paragraph', text });
      continue;
    }

    // 其他类型忽略或当段落
    if (text) {
      flushList();
      doc.children.push({ type: 'paragraph', text });
    }
  }

  flushList();
  return doc;
}

/**
 * 拉取飞书文档并返回 docJson
 * @param {{ accessToken: string, docId: string, apiBase?: string }} config
 * @returns {Promise<{ ok: boolean, docJson?: object, error?: string }>}
 */
export async function fetchDoc(config) {
  const { accessToken, docId, apiBase = DEFAULT_API_BASE } = config || {};
  if (!accessToken || !docId) {
    return { ok: false, error: '请配置 Access Token 与文档 ID/链接' };
  }

  const base = (apiBase || '').replace(/\/$/, '');
  const url = `${base}/docx/v1/documents/${encodeURIComponent(docId)}/blocks?document_revision_id=-1&page_size=500`;

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.msg || data.error_description || data.message || res.statusText;
      return { ok: false, error: `请求失败 ${res.status}: ${msg}` };
    }

    if (data.code !== undefined && data.code !== 0) {
      return { ok: false, error: data.msg || data.message || `code: ${data.code}` };
    }

    const items = data.data?.items || [];
    const docJson = feishuBlocksToDocJson(items);
    return { ok: true, docJson };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    return { ok: false, error: `网络或解析错误: ${msg}` };
  }
}
