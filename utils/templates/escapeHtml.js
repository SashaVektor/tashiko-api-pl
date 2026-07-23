export function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return char
    }
  })
}

export function sanitizeHeaderValue(value = '') {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').trim()
}

const SAFE_URL_SCHEMES = ['http:', 'https:']

export function sanitizeUrl(value = '') {
  const trimmed = String(value ?? '').trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    return SAFE_URL_SCHEMES.includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}
