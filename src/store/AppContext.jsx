import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { api, hasToken, setToken } from '../api/client.js'
import { tierFromPoints } from '../data/store.js'

const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)

export function AppProvider({ children }) {
  const [users, setUsers] = useState([])
  const [requests, setRequests] = useState([])
  const [readiness, setReadiness] = useState({})
  const [plaks, setPlaks] = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [booting, setBooting] = useState(hasToken())
  const updateTimers = useRef(new Map())

  const loadBootstrap = useCallback(async () => {
    const data = await api('/bootstrap')
    setUsers(data.users || [])
    setRequests(data.requests || [])
    setReadiness(data.readiness || {})
    setPlaks(data.plaks || [])
    return data
  }, [])

  useEffect(() => {
    if (!hasToken()) return
    Promise.all([api('/auth/me'), loadBootstrap()])
      .then(([me]) => setCurrentUser(me.user))
      .catch(() => setToken(''))
      .finally(() => setBooting(false))
  }, [loadBootstrap])

  // ── احراز هویت ──
  // بررسی اعتبار بدون ثبت ورود (برای مرحلهٔ OTP)
  const validate = useCallback(async (username, password) => {
    try {
      const data = await api('/auth/validate', {
        method: 'POST', body: JSON.stringify({ username, password }),
      })
      return data.user
    } catch {
      return null
    }
  }, [])

  const login = useCallback(async (username, password, otp) => {
    const data = await api('/auth/login', {
      method: 'POST', body: JSON.stringify({ username, password, otp }),
    })
    setToken(data.accessToken)
    setCurrentUser(data.user)
    await loadBootstrap()
    return data.user
  }, [loadBootstrap])

  const logout = useCallback(() => {
    setToken('')
    setCurrentUser(null)
    setUsers([])
    setRequests([])
    setReadiness({})
  }, [])

  // ── مدیریت کاربران (پنل ادمین) ──
  const surveyors = useMemo(
    () => users.filter(u => u.role === 'surveyor'), [users])

  // کارشناسان مسئول
  const experts = useMemo(
    () => users.filter(u => u.role === 'expert'), [users])

  // ایجاد کارتابل کارشناس مسئول
  const addExpert = useCallback(async ({ username, password, name }) => {
    await api('/users', { method: 'POST', body: JSON.stringify({ username, password, name, role: 'expert' }) })
    await loadBootstrap()
  }, [loadBootstrap])

  const addSurveyor = useCallback(async ({ username, password, name, points }) => {
    await api('/users', { method: 'POST', body: JSON.stringify({ username, password, name, role: 'surveyor', points }) })
    await loadBootstrap()
  }, [loadBootstrap])

  const updateSurveyor = useCallback((username, patch) => {
    setUsers(prev => prev.map(u => {
      if (u.username !== username) return u
      const next = { ...u, ...patch }
      if (patch.points != null) next.tier = tierFromPoints(Number(patch.points) || 0)
      return next
    }))
    const previous = updateTimers.current.get(username)
    if (previous) clearTimeout(previous.timer)
    const merged = { ...(previous?.patch || {}), ...patch }
    const timer = setTimeout(async () => {
      updateTimers.current.delete(username)
      try {
        await api(`/users/${encodeURIComponent(username)}`, { method: 'PATCH', body: JSON.stringify(merged) })
      } catch (error) {
        console.error(error)
        await loadBootstrap()
      }
    }, 500)
    updateTimers.current.set(username, { timer, patch: merged })
  }, [loadBootstrap])

  const removeSurveyor = useCallback(async (username) => {
    await api(`/users/${encodeURIComponent(username)}`, { method: 'DELETE' })
    await loadBootstrap()
  }, [loadBootstrap])

  // ── اعلام آمادگی محدوده فعالیت ──
  const setSurveyorReadiness = useCallback(async (username, selectedPlaks) => {
    await api(`/readiness/${encodeURIComponent(username)}`, {
      method: 'PUT', body: JSON.stringify({ plaks: selectedPlaks }),
    })
    setReadiness(prev => ({ ...prev, [username]: selectedPlaks }))
  }, [])

  // نقشه‌بردارانی که برای یک پلاک ثبتی اعلام آمادگی کرده‌اند
  const readySurveyorsFor = useCallback((plak) =>
    surveyors.filter(s => (readiness[s.username] || []).includes(plak)),
  [surveyors, readiness])

  // ── ارجاع درخواست‌ها به نقشه‌بردار ──
  const assignRequests = useCallback(async (ids, surveyorUsername) => {
    await api('/requests/assign', { method: 'POST', body: JSON.stringify({ ids, surveyorUsername }) })
    await loadBootstrap()
  }, [loadBootstrap])

  // ارجاع هوشمند یک پلاک ثبتی بین کارشناسانِ آماده (تقسیم فضایی بدون هم‌پوشانی)
  // خروجی: طرح تخصیص برای پیش‌نمایش؛ اعمال با applyPlan انجام می‌شود.
  const planAutoAssign = useCallback(async (plak) =>
    api(`/requests/auto-plan/${encodeURIComponent(plak)}`), [])

  const applyPlan = useCallback(async (plan) => {
    const payload = plan.map(item => ({ surveyorUsername: item.surveyor.username, ids: item.items.map(r => r.id) }))
    await api('/requests/apply-plan', { method: 'POST', body: JSON.stringify({ plan: payload }) })
    await loadBootstrap()
  }, [loadBootstrap])

  // ── بارگذاری و ارسال کروکی توسط نقشه‌بردار → کارتابل کارشناس مسئول ──
  const submitKroky = useCallback(async (id, kroky) => {
    const form = new FormData()
    const {file, photos = [], ...fields} = kroky
    const photoInfo = photo => ({id: photo.id ?? null, title: photo.title || 'عکس محل', description: photo.description || ''})
    const metadata = {...fields, kept_photos: photos.filter(p => !p._raw).map(photoInfo), new_photos: photos.filter(p => p._raw).map(photoInfo)}
    form.append('metadata', JSON.stringify(metadata))
    if (file?._raw) form.append('dxf', file._raw, file.name)
    photos.forEach(photo => {
      if (photo._raw) form.append('photos', photo._raw, photo.name)
    })
    const updated = await api(`/requests/${id}/submit`, { method: 'POST', body: form })
    setRequests(prev => prev.map(r => r.id === id ? updated : r))
    return updated
  }, [])

  // ── تأیید محلی → آماده دریافت سرویس مستقل انتقال ──
  const approveRequest = useCallback(async (id) => {
    const result = await api(`/requests/${id}/approve`, { method: 'POST' })
    await loadBootstrap()
    return result
  }, [loadBootstrap])

  // ── عدم تأیید → عودت به کارتابل نقشه‌بردار ──
  const rejectRequest = useCallback(async (id, reason) => {
    await api(`/requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason: reason || 'نیازمند اصلاح' }) })
    await loadBootstrap()
  }, [loadBootstrap])

  const value = {
    users, surveyors, experts, requests, readiness, plaks, currentUser, booting,
    loadBootstrap,
    validate, login, logout,
    addSurveyor, updateSurveyor, removeSurveyor, addExpert,
    setSurveyorReadiness, readySurveyorsFor,
    assignRequests, planAutoAssign, applyPlan,
    submitKroky, approveRequest, rejectRequest,
  }
  if (booting) return <div className="login-bg"><div className="login-card" style={{ textAlign: 'center' }}>در حال اتصال به پایگاه داده…</div></div>
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}
