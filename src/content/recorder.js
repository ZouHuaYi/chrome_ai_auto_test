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

const DEFAULT_SETTINGS = {
  enabled: true,
  events: { click: true, input: true, change: true, scroll: false },
  debounceMs: 300,
  throttleMs: 500
}

let currentSettings = { ...DEFAULT_SETTINGS }

const inputTimers = new Map()
const clickTimers = new Map()
const scrollTimers = new Map()

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

function getCssSelector(element) {
  if (!(element instanceof Element)) return ''
  if (element.id) return `#${element.id}`
  const path = []
  let el = element
  while (el && el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase()
    if (el.className) {
      const classes = String(el.className).trim().split(/\s+/).filter(Boolean)
      if (classes.length) selector += '.' + classes.slice(0, 2).join('.')
    }
    const parent = el.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.nodeName === el.nodeName)
      if (siblings.length > 1) {
        const index = siblings.indexOf(el) + 1
        selector += `:nth-of-type(${index})`
      }
    }
    path.unshift(selector)
    if (el.id) break
    el = parent
  }
  return path.join(' > ')
}

function loadSettings() {
  try {
    chrome.storage.local.get(['settings'], (res) => {
      if (res.settings) currentSettings = { ...DEFAULT_SETTINGS, ...res.settings }
    })
  } catch (e) {
    // ignore
  }
}

loadSettings()

chrome.storage.onChanged.addListener((changes) => {
  if (changes.settings) {
    currentSettings = { ...DEFAULT_SETTINGS, ...(changes.settings.newValue || {}) }
  }
})

function buildTarget(target) {
  const xpath = getXPath(target)
  return {
    xpath: xpath || '',
    css: getCssSelector(target) || ''
  }
}

function handleClick(event) {
  if (!currentSettings.enabled || !currentSettings.events.click) return
  const target = event.target
  if (!(target instanceof Element)) return

  const { xpath, css } = buildTarget(target)
  const key = xpath || css
  if (!key) return

  const now = Date.now()
  const last = clickTimers.get(key) || 0
  if (now - last < currentSettings.throttleMs) return
  clickTimers.set(key, now)

  const step = {
    type: 'click',
    target: xpath || css,
    selector: { xpath, css },
    tag: target.tagName.toLowerCase(),
    text: (target.textContent || '').trim().slice(0, 120),
    timestamp: now,
    url: window.location.href
  }

  sendStep(step)
}

function handleInput(event) {
  if (!currentSettings.enabled || !currentSettings.events.input) return
  const target = event.target
  if (!(target instanceof Element)) return

  if (!target.matches('input, textarea, [contenteditable="true"]')) return

  const { xpath, css } = buildTarget(target)
  const key = xpath || css
  if (!key) return

  const prevTimer = inputTimers.get(key)
  if (prevTimer) clearTimeout(prevTimer)

  const timer = setTimeout(() => {
    const rawValue = getInputValue(target)
    const sensitive = isSensitiveField(target, rawValue)
    const maskedValue = maskValue(rawValue, sensitive)

    const step = {
      type: 'input',
      target: xpath || css,
      selector: { xpath, css },
      tag: target.tagName.toLowerCase(),
      value: maskedValue,
      sensitive,
      timestamp: Date.now(),
      url: window.location.href
    }

    sendStep(step)
    inputTimers.delete(key)
  }, currentSettings.debounceMs)

  inputTimers.set(key, timer)
}

function handleChange(event) {
  if (!currentSettings.enabled || !currentSettings.events.change) return
  const target = event.target
  if (!(target instanceof Element)) return

  const { xpath, css } = buildTarget(target)
  const key = xpath || css
  if (!key) return

  const rawValue = getInputValue(target)
  const sensitive = isSensitiveField(target, rawValue)
  const maskedValue = maskValue(rawValue, sensitive)

  const step = {
    type: 'change',
    target: xpath || css,
    selector: { xpath, css },
    tag: target.tagName.toLowerCase(),
    value: maskedValue,
    sensitive,
    timestamp: Date.now(),
    url: window.location.href
  }

  sendStep(step)
}

function handleScroll() {
  if (!currentSettings.enabled || !currentSettings.events.scroll) return
  const key = 'window'
  const now = Date.now()
  const last = scrollTimers.get(key) || 0
  if (now - last < currentSettings.throttleMs) return
  scrollTimers.set(key, now)

  const step = {
    type: 'scroll',
    target: 'window',
    selector: { xpath: '', css: '' },
    timestamp: now,
    url: window.location.href,
    scroll: { x: window.scrollX, y: window.scrollY }
  }

  sendStep(step)
}

document.addEventListener('click', handleClick, true)
document.addEventListener('input', handleInput, true)
document.addEventListener('change', handleChange, true)
window.addEventListener('scroll', handleScroll, { passive: true })
