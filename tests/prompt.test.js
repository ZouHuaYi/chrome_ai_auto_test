/**
 * Prompt 最小用例：assemblePrompt 空参包含 header 与占位
 */
import { describe, it, expect } from 'vitest';
import { assemblePrompt } from '../src/prompt/assembler.js';

describe('assemblePrompt', () => {
  it('includes header and default placeholders when no steps', () => {
    const text = assemblePrompt({});
    expect(text).toContain('自动化测试智能体');
    expect(text).toContain('【录制步骤】');
    expect(text).toContain('（无）');
    expect(text).toContain('[placeholder]');
  });
});
