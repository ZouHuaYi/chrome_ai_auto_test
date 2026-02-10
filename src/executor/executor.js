function executePlan(steps = []) {
  // mock executor: just echo steps
  return {
    ok: true,
    report: {
      executed: steps.length,
      steps
    }
  }
}

export { executePlan }
