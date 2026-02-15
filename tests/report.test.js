import { describe, it, expect } from 'vitest';
import { diffReports, formatReportMarkdown } from '../src/report/report.js';

describe('report helpers', () => {
  it('builds markdown summary and diff', () => {
    const prev = {
      ok: false,
      replay: { report: { logs: [{ index: 1, status: 'FAIL', note: 'missing' }] } },
      validation: { issues: [{ message: 'bad', source: 'ui' }] },
      assertion: { issues: [{ expected: 'ok', actual: 'fail' }] }
    };
    const next = {
      ok: true,
      replay: { report: { logs: [{ index: 1, status: 'OK', note: 'done' }] } },
      validation: { issues: [] },
      assertion: { issues: [] }
    };
    const diff = diffReports(prev, next);
    const md = formatReportMarkdown(next, diff);
    expect(diff.okChanged).toBe(true);
    expect(md).toContain('Replay Report');
  });
});
