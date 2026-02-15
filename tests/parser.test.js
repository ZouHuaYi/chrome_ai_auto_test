/**
 * Parser 最小用例：markdown 解析空输入
 */
import { describe, it, expect } from 'vitest';
import { parseMarkdown } from '../src/parser/markdown.js';

describe('parseMarkdown', () => {
  it('returns document with empty children for empty input', () => {
    const doc = parseMarkdown('');
    expect(doc).toEqual({ type: 'document', children: [] });
  });
});
