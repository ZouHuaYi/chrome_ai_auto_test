/**
 * Executor 最小用例：无 tabId 时返回 mock report
 */
import { describe, it, expect } from 'vitest';
import { executePlan } from '../src/executor/executor.js';

describe('executePlan', () => {
  it('returns mock report when tabId is undefined', async () => {
    const steps = [{ type: 'click', target: '#btn' }];
    const result = await executePlan(steps);
    expect(result.ok).toBe(true);
    expect(result.report).toBeDefined();
    expect(result.report.executed).toBe(1);
    expect(result.report.logs[0].status).toBe('SIMULATED');
    expect(result.validationResult).toBeNull();
  });
});
