const SENSITIVE_KEYWORDS = [
  'password',
  'passwd',
  'passphrase',
  'secret',
  'token',
  'api',
  'key',
  'auth',
  'jwt',
  'session'
]

const TOKEN_LIKE_PATTERN = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/
const LONG_HEX_PATTERN = /^[a-f0-9]{32,}$/i

const INPUT_DEBOUNCE_MS = 300
const CLICK_THROTTLE_MS = 500

const inputTimers = new Map()
const clickTimers = new Map()

function getAttributeText(element) {
  const attrs = [
    element.getAttribute('name'),
    element.getAttribute('id'),
    element.getAttribute('aria-label'),
    element.getAttribute('placeholder')
  ]
  return attrs.filter(Boolean).join(' ').toLowerCase()
}

function isSensitiveField(element, value) {
  const type = (element.getAttribute('type') || '').toLowerCase()
  if (type === 'password') return true

  const attributeText = getAttributeText(element)
  if (SENSITIVE_KEYWORDS.some((keyword) => attributeText.includes(keyword))) return true

  if (value && value.length >= 20) {
    if (TOKEN_LIKE_PATTERN.test(value)) return true
    if (LONG_HEX_PATTERN.test(value)) return true
  }

  return false
}

function maskValue(value, isSensitive) {
  if (!isSensitive) return value
  if (!value) return '[REDACTED]'
  return `[REDACTED:${value.length}]`
}

function xpathLiteral(value) {
  if (!value.includes("'")) return `'${value}'`
  if (!value.includes('"')) return `"${value}"`
  return null
}

function getXPath(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return ''

  const id = element.getAttribute('id')
  if (id) {
    const literal = xpathLiteral(id)
    if (literal) {
      return `//*[@id=${literal}]`
    }
  }

  const parts = []
  let current = element
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const tagName = current.tagName.toLowerCase()
    if (tagName === 'html') {
      parts.push('html')
      break
    }

    const parent = current.parentElement
    if (!parent) {
      parts.push(tagName)
      break
    }

    const siblings = Array.from(parent.children).filter(
      (child) => child.tagName.toLowerCase() === tagName
    )

    if (siblings.length === 1) {
      parts.push(tagName)
    } else {
      const index = siblings.indexOf(current) + 1
      parts.push(`${tagName}[${index}]`)
    }

    current = parent
  }

  return `/${parts.reverse().join('/')}`
}

function getInputValue(target) {
  if (target.isContentEditable) return target.textContent || ''
  if ('value' in target) return target.value
  return ''
}

function sendStep(step) {
  try {
    chrome.runtime.sendMessage({ action: 'RECORD_STEP', payload: step })
  } catch (error) {
    // Content script can be injected without the extension runtime ready.
  }
}

function handleClick(event) {
  const target = event.target
  if (!(target instanceof Element)) return

  const xpath = getXPath(target)
  if (!xpath) return

  const now = Date.now()
  const last = clickTimers.get(xpath) || 0
  if (now - last < CLICK_THROTTLE_MS) return
  clickTimers.set(xpath, now)

  const step = {
    type: 'click',
    target: xpath,
    tag: target.tagName.toLowerCase(),
    text: (target.textContent || '').trim().slice(0, 120),
    timestamp: now,
    url: window.location.href
  }

  sendStep(step)
}

function handleInput(event) {
  const target = event.target
  if (!(target instanceof Element)) return

  if (!target.matches('input, textarea, [contenteditable="true"]')) return

  const xpath = getXPath(target)
  if (!xpath) return

  // debounce per element
  const prevTimer = inputTimers.get(xpath)
  if (prevTimer) clearTimeout(prevTimer)

  const timer = setTimeout(() => {
    const rawValue = getInputValue(target)
    const sensitive = isSensitiveField(target, rawValue)
    const maskedValue = maskValue(rawValue, sensitive)

    const step = {
      type: 'input',
      target: xpath,
      tag: target.tagName.toLowerCase(),
      value: maskedValue,
      sensitive,
      timestamp: Date.now(),
      url: window.location.href
    }

    sendStep(step)
    inputTimers.delete(xpath)
  }, INPUT_DEBOUNCE_MS)

  inputTimers.set(xpath, timer)
}

document.addEventListener('click', handleClick, true)
document.addEventListener('input', handleInput, true)
