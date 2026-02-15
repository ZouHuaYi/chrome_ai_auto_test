function toIssueKey(issue) {
  if (!issue) return ''
  const expected = issue.expected ?? ''
  const actual = issue.actual ?? issue.message ?? ''
  const reason = issue.reason ?? ''
  const source = issue.source ?? issue.kind ?? ''
  return `${source}\0${expected}\0${actual}\0${reason}`
}

function toLogKey(log) {
  if (!log) return ''
  return `${log.index}\0${log.status}\0${log.note ?? ''}`
}

function getFailedLogs(report) {
  return (report?.replay?.report?.logs || []).filter((l) => l.status === 'FAIL')
}

function getIssues(result, key) {
  return result?.[key]?.issues || []
}

function diffReports(prev, next) {
  if (!prev || !next) return null
  const prevFailures = new Set(getFailedLogs(prev).map(toLogKey))
  const nextFailures = new Set(getFailedLogs(next).map(toLogKey))

  const prevValidation = new Set(getIssues(prev, 'validation').map(toIssueKey))
  const nextValidation = new Set(getIssues(next, 'validation').map(toIssueKey))

  const prevAssertion = new Set(getIssues(prev, 'assertion').map(toIssueKey))
  const nextAssertion = new Set(getIssues(next, 'assertion').map(toIssueKey))

  const addedFailures = [...nextFailures].filter((k) => !prevFailures.has(k))
  const resolvedFailures = [...prevFailures].filter((k) => !nextFailures.has(k))

  const addedValidation = [...nextValidation].filter((k) => !prevValidation.has(k))
  const resolvedValidation = [...prevValidation].filter((k) => !nextValidation.has(k))

  const addedAssertion = [...nextAssertion].filter((k) => !prevAssertion.has(k))
  const resolvedAssertion = [...prevAssertion].filter((k) => !nextAssertion.has(k))

  return {
    okChanged: prev.ok !== next.ok,
    okFrom: prev.ok,
    okTo: next.ok,
    replay: {
      addedFailures,
      resolvedFailures
    },
    validation: {
      addedIssues: addedValidation,
      resolvedIssues: resolvedValidation
    },
    assertion: {
      addedIssues: addedAssertion,
      resolvedIssues: resolvedAssertion
    }
  }
}

function summarizeReport(result) {
  const logs = result?.replay?.report?.logs || []
  const failCount = logs.filter((l) => l.status === 'FAIL').length
  const passCount = logs.filter((l) => l.status === 'OK' || l.status === 'SIMULATED').length
  const skipCount = logs.filter((l) => l.status === 'SKIP').length
  const validationIssues = result?.validation?.issues?.length || 0
  const assertionIssues = result?.assertion?.issues?.length || 0
  return {
    ok: Boolean(result?.ok),
    steps: logs.length,
    passCount,
    failCount,
    skipCount,
    validationIssues,
    assertionIssues
  }
}

function formatReportMarkdown(result, diff) {
  const summary = summarizeReport(result)
  const lines = []
  lines.push(`# Replay Report`)
  lines.push(``)
  lines.push(`- Status: ${summary.ok ? 'PASS' : 'FAIL'}`)
  lines.push(`- Steps: ${summary.steps}`)
  lines.push(`- Step Results: ${summary.passCount} ok / ${summary.failCount} fail / ${summary.skipCount} skip`)
  lines.push(`- Validation Issues: ${summary.validationIssues}`)
  lines.push(`- Assertion Issues: ${summary.assertionIssues}`)
  lines.push(``)

  if (diff) {
    lines.push(`## Diff vs Last`)
    lines.push(`- Overall: ${diff.okChanged ? `${diff.okFrom ? 'PASS' : 'FAIL'} -> ${diff.okTo ? 'PASS' : 'FAIL'}` : 'No change'}`)
    lines.push(`- Replay Failures: +${diff.replay.addedFailures.length} / -${diff.replay.resolvedFailures.length}`)
    lines.push(`- Validation Issues: +${diff.validation.addedIssues.length} / -${diff.validation.resolvedIssues.length}`)
    lines.push(`- Assertion Issues: +${diff.assertion.addedIssues.length} / -${diff.assertion.resolvedIssues.length}`)
    lines.push(``)
  }

  lines.push(`## Replay Logs`)
  for (const log of result?.replay?.report?.logs || []) {
    lines.push(`- [${log.status}] #${log.index} ${log.note || ''}`.trim())
  }
  lines.push(``)

  lines.push(`## Validation Issues`)
  if ((result?.validation?.issues || []).length === 0) {
    lines.push(`- None`)
  } else {
    for (const issue of result.validation.issues) {
      lines.push(`- ${issue.source || issue.kind || 'issue'}: ${issue.message || issue.actual || ''}`)
    }
  }
  lines.push(``)

  lines.push(`## Assertion Issues`)
  if ((result?.assertion?.issues || []).length === 0) {
    lines.push(`- None`)
  } else {
    for (const issue of result.assertion.issues) {
      lines.push(`- ${issue.expected || 'Expected'} | ${issue.actual || 'Actual'}${issue.reason ? ` | ${issue.reason}` : ''}`)
    }
  }
  lines.push(``)
  return lines.join('\n')
}

export { diffReports, formatReportMarkdown, summarizeReport }
