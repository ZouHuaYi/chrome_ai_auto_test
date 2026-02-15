/**
 * 断言计划：将断言模板与执行/校验结果绑定，输出预期 vs 实际、通过/失败与原因。
 * context: { steps?, execReport?, validateResult?, assertionTemplate? }
 * 返回: { ok, issues: [{ expected, actual, passed, reason?, source? }] }
 * 兼容：无 execReport 且无 validateResult 时返回 ok: true, issues: []。
 */
function assertPlan(context = {}) {
  const { execReport, validateResult } = context
  const issues = []

  // 1. 执行结果：每步 FAIL 或非 OK 记为一条断言失败
  if (execReport?.report?.logs) {
    for (const log of execReport.report.logs) {
      const passed = log.status === 'OK' || log.status === 'SIMULATED'
      if (!passed) {
        issues.push({
          expected: '步骤执行成功',
          actual: log.note || log.status || '执行失败',
          passed: false,
          reason: `步骤 ${log.index} 执行失败`,
          source: 'exec'
        })
      }
    }
  }

  // 2. 校验结果：每个 issue 对应一条断言失败
  if (validateResult?.issues?.length) {
    for (const v of validateResult.issues) {
      issues.push({
        expected: v.expected ?? '校验通过',
        actual: v.message ?? v.actual ?? String(v),
        passed: false,
        reason: v.message || `[${v.source || v.kind}] 校验未通过`,
        source: v.source || v.kind || 'validate'
      })
    }
  }

  const ok = issues.length === 0
  return {
    ok,
    issues
  }
}

export { assertPlan }
