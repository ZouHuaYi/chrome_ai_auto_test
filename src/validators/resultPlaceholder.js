function buildValidationResultPlaceholder() {
  return {
    status: 'PENDING',
    summary: {
      total: 0,
      passed: 0,
      failed: 0
    },
    details: []
  }
}

export { buildValidationResultPlaceholder }
