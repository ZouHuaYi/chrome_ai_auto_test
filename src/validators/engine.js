function run(context = {}) {
  // Placeholder for real validator engine
  return {
    ok: true,
    context,
    result: {
      status: 'PENDING',
      issues: []
    }
  }
}

export { run }
