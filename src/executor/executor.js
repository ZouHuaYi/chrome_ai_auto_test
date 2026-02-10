function executePlan(steps = []) {
  const logs = (steps || []).map((step, idx) => {
    return {
      index: idx + 1,
      step,
      status: 'SIMULATED',
      note: 'mock replay'
    }
  })

  return {
    ok: true,
    report: {
      executed: logs.length,
      logs
    }
  }
}

export { executePlan }
