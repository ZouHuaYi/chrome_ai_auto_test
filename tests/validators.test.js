/**
 * Validators 最小用例：engine run 无 issues 返回 PASS
 */
import { describe, it, expect } from 'vitest';
import { run } from '../src/validators/engine.js';

describe('validators/engine', () => {
  it('aggregates ui/text/data and returns PASS when no issues', () => {
    const context = { steps: [], document: null };
    const result = run(context);
    expect(result.ok).toBe(true);
    expect(result.result.status).toBe('PASS');
    expect(result.result.issues).toEqual([]);
  });
});
