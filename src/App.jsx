import { useState, useCallback, useEffect, useRef } from 'react'
import { AppProvider, useApp } from './store/AppContext.jsx'
import LoginPage      from './components/pages/LoginPage.jsx'
import AppShell       from './components/AppShell.jsx'
import Dashboard      from './components/pages/Dashboard.jsx'
import UploadForm     from './components/pages/UploadForm.jsx'
import DraftReview    from './components/pages/DraftReview.jsx'
import MapView        from './components/pages/MapView.jsx'
import SuccessPage    from './components/pages/SuccessPage.jsx'
import AdminPanel     from './components/pages/AdminPanel.jsx'
import ExpertPanel    from './components/pages/ExpertPanel.jsx'
import LoadingOverlay from './components/ui/LoadingOverlay.jsx'
import Toast          from './components/ui/Toast.jsx'
import { emptyDraft } from './data/krokyForm.js'

function Shell() {
  const app = useApp()
  const { currentUser, logout, submitKroky } = app

  const [page,            setPage]            = useState('home')
  const [loading,         setLoading]         = useState(null)
  const [toast,           setToast]           = useState(null)
  const [trackingNo,      setTrackingNo]      = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [krokyDraft,      setKrokyDraft]      = useState(null)
  const [submittedAt, setSubmittedAt] = useState(null)
  const analysisTimer = useRef(null)
  const submitting = useRef(false)
  useEffect(() => () => clearInterval(analysisTimer.current), [])
  useEffect(() => { window.scrollTo(0, 0) }, [page])

  const showToast = useCallback((msg) => {
    setToast(msg); setTimeout(() => setToast(null), 6500)
  }, [])

  const handleLogout = useCallback(() => { logout(); setPage('home') }, [logout])

  const openUpload = useCallback((req = null) => {
    if (!req || req.status !== 'assigned') { showToast('ابتدا یک درخواست ارجاع‌شده از کارتابل انتخاب کنید.'); setPage('home'); return }
    setSelectedRequest(req); setKrokyDraft(emptyDraft(req)); setPage('upload')
  }, [showToast])

  const handleAnalyze = useCallback((draft) => {
    setKrokyDraft(draft)
    const steps = [
      'در حال اجرای تحلیل نمایشی...',
      'اطلاعات فرم و جدول‌ها بدون تغییر حفظ می‌شوند...',
      'آماده‌سازی بازبینی اطلاعات واردشده...',
    ]
    setLoading({ message: steps[0], steps })
    let i = 0
    clearInterval(analysisTimer.current)
    analysisTimer.current = setInterval(() => {
      i++
      if (i < steps.length) setLoading({ message: steps[i], steps })
      else { clearInterval(analysisTimer.current); setLoading(null); setPage('draft') }
    }, 450)
  }, [showToast])

  // ارسال کروکی به کارتابل کارشناس مسئول (به‌جای ارسال مستقیم به سیاق)
  const handleSubmitToExpert = useCallback(async () => {
    if (submitting.current || !selectedRequest || !krokyDraft) return
    submitting.current = true
    setLoading({ message: 'در حال ارسال به کارتابل کارشناس مسئول...', steps: [] })
    try {
      const updated = await submitKroky(selectedRequest.id, krokyDraft)
      setSubmittedAt(updated.kroky.sentAt)
      setTrackingNo(selectedRequest.requestNo)
      setPage('success')
    } catch (error) {
      showToast(error.message || 'ثبت اطلاعات ناموفق بود؛ دوباره تلاش کنید.')
    } finally { submitting.current = false; setLoading(null) }
  }, [selectedRequest, krokyDraft, submitKroky, showToast])

  if (!currentUser) return <LoginPage />

  const role = currentUser.role

  return (
    <AppShell user={currentUser} onLogout={handleLogout} activePage={page} onNav={next => next === 'upload' ? openUpload(null) : setPage(next)}>
      {/* ── نقش: نقشه‌بردار ── */}
      {role === 'surveyor' && page === 'home' &&
        <Dashboard onNewRequest={() => openUpload(null)} onOpenMap={() => setPage('map')}
          onSelectRequest={openUpload} onToast={showToast} />}
      {role === 'surveyor' && page === 'upload' && selectedRequest && krokyDraft &&
        <UploadForm request={selectedRequest} draft={krokyDraft} onChange={setKrokyDraft} onCancel={() => setPage('home')} onAnalyze={handleAnalyze} />}
      {role === 'surveyor' && page === 'draft' &&
        <DraftReview request={selectedRequest} draft={krokyDraft} surveyorName={currentUser.name} onBack={() => setPage('upload')} onSubmit={handleSubmitToExpert} />}
      {role === 'surveyor' && page === 'map' &&
        <MapView onBack={() => setPage('home')} onSelectRequest={openUpload} />}
      {role === 'surveyor' && page === 'success' &&
        <SuccessPage trackingNo={trackingNo} submittedAt={submittedAt} surveyorName={currentUser.name} onDone={() => setPage('home')} onNew={() => setPage('home')} />}

      {/* ── نقش: کارشناس مسئول ── */}
      {role === 'expert' && <ExpertPanel onToast={showToast} activeTab={page === 'assign' ? 'assign' : page === 'map' ? 'map' : 'review'} onTabChange={tab => setPage(tab === 'review' ? 'home' : tab)} />}

      {/* ── نقش: ادمین ── */}
      {role === 'admin' && <AdminPanel onToast={showToast} />}

      {loading && <LoadingOverlay message={loading.message} steps={loading.steps} />}
      {toast   && <Toast message={toast} />}
    </AppShell>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
