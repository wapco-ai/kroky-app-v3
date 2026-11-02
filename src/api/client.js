const API_ROOT = import.meta.env.VITE_API_URL || '/api'

let token = sessionStorage.getItem('kroky_token') || ''

export function setToken(value) {
  token = value || ''
  if (token) sessionStorage.setItem('kroky_token', token)
  else sessionStorage.removeItem('kroky_token')
}

export function hasToken() {
  return Boolean(token)
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {})
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(`${API_ROOT}${path}`, { ...options, headers })
  if (response.status === 204) return null
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = Array.isArray(payload.detail) ? payload.detail.map(item => item.msg || String(item)).join('؛ ') : payload.detail
    const error = new Error(detail || 'خطا در ارتباط با سرور')
    error.status = response.status
    throw error
  }
  return payload
}

