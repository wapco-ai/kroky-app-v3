import { useState, useMemo } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { wfLabel, wfCls, tierLabel, normDigits } from '../../data/store.js'
import ReadinessModal from '../ui/ReadinessModal.jsx'

export default function Dashboard({ onNewRequest, onOpenMap, onSelectRequest, onToast }) {
  const { currentUser, requests, readiness, setSurveyorReadiness } = useApp()
  const [query, setQuery] = useState('')
  const [showReady, setShowReady] = useState(false)

  const me = currentUser.username
  const myReadiness = readiness[me] || []

  // فقط درخواست‌های ارجاع‌شده به این نقشه‌بردار
  const mine = useMemo(
    () => requests.filter(r => r.assignedTo === me),
    [requests, me])

  const stats = useMemo(() => {
    const c = { assigned: 0, submitted: 0, approved: 0, returned: 0 }
    mine.forEach(r => {
      if (r.status === 'assigned' && r.rejectReason) c.returned++
      else if (r.status === 'assigned') c.assigned++
      else if (r.status === 'submitted') c.submitted++
      else if (r.status === 'approved') c.approved++
    })
    return c
  }, [mine])

  const STATS = [
    { icon: '📥', cls: 'si-amber', val: stats.assigned + stats.returned, label: 'منتظر بارگذاری' },
    { icon: '📤', cls: 'si-blue',  val: stats.submitted, label: 'ارسال به کارشناس مسئول' },
    { icon: '✅', cls: 'si-green', val: stats.approved,  label: 'تأییدشده؛ آماده انتقال' },
    { icon: '↩️', cls: 'si-red',   val: stats.returned,  label: 'عودت‌شده برای اصلاح' },
  ]

  const filtered = useMemo(() => {
    const q = normDigits(query).trim().toLowerCase()
    if (!q) return mine
    return mine.filter(r => {
      const haystack = normDigits([
        r.requestNo, r.requestDate, r.auditCode, r.title, r.address,
        r.parcel, r.regPlak, r.landUse, wfLabel(r.status), r.trackingNo,
      ].filter(Boolean).join(' ')).toLowerCase()
      return haystack.includes(q)
    })
  }, [mine, query])

  const saveReadiness = async (plaks) => {
    try {
      await setSurveyorReadiness(me, plaks)
      setShowReady(false)
      onToast?.(`آمادگی برای ${plaks.length} پلاک ثبتی ثبت شد ✓`)
    } catch (error) { onToast?.(error.message) }
  }

  return (
    <>
      <div className="dash-banner">
        <div className="dash-banner-left">
          <img src="/logo.png" alt="آستان قدس رضوی" className="dash-logo"
            onError={e => { e.target.style.display = 'none' }} />
          <div>
            <div className="dash-banner-title">
              کارتابل مهندس {currentUser.name} <span style={{ opacity: .85 }}>({tierLabel(currentUser.tier)})</span>
            </div>
            <div className="dash-banner-sub">
              درخواست‌های ارجاع‌شده به شما را بارگذاری و به کارشناس مسئول ارسال کنید
            </div>
          </div>
        </div>
        <div className="flex gap8" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-outline btn-sm dash-btn-map" onClick={() => setShowReady(true)}>
            📍 اعلام آمادگی محدوده فعالیت
          </button>
          <button className="btn btn-outline btn-sm dash-btn-map" onClick={onOpenMap}>🗺 نقشه کارتابل</button>
        </div>
      </div>

      {/* محدوده‌های اعلام‌شده */}
      <div className="card mb20" style={{ borderRight: '4px solid var(--navy)' }}>
        <div className="card-bd" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 20px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--g700)' }}>📍 محدوده‌های فعالیت اعلام‌شده:</span>
          {myReadiness.length === 0
            ? <span style={{ fontSize: 13, color: 'var(--g400)' }}>هنوز محدوده‌ای اعلام نکرده‌اید — روی «اعلام آمادگی» بزنید.</span>
            : myReadiness.map(p => (
                <span key={p} className="badge b-approved" style={{ fontSize: 12 }}>{p}</span>
              ))}
        </div>
      </div>

      <div className="stats mb20">
        {STATS.map(s => (
          <div key={s.label} className="scard">
            <div className={`scard-icon ${s.cls}`}>{s.icon}</div>
            <div><div className="scard-val">{s.val}</div><div className="scard-lbl">{s.label}</div></div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-hd">
          <div className="card-title">📋 درخواست‌های ارجاع‌شده به من</div>
          <div className="flex gap8">
            <input className="fc" placeholder="🔍 جستجو بر اساس شماره درخواست، تاریخ، کد ممیزی، آدرس..." style={{ width: 340, maxWidth: '100%' }}
              value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>شماره درخواست</th><th>تاریخ</th><th>کد ممیزی</th>
              <th>آدرس قطعه</th><th>پلاک ثبتی</th><th>مساحت (م²)</th>
              <th>وضعیت</th><th>عملیات</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--g400)' }}>
                  درخواستی به شما ارجاع نشده است
                </td></tr>
              ) : filtered.map(r => {
                const isReturned = r.status === 'assigned' && r.rejectReason
                const canUpload  = r.status === 'assigned'
                return (
                  <tr key={r.id} className={canUpload ? 'tbl-row-clickable' : ''}
                    onClick={() => canUpload && onSelectRequest(r)}
                    title={canUpload ? 'کلیک برای بارگذاری کروکی' : ''}>
                    <td><span className="req-no-badge">{r.requestNo}</span></td>
                    <td style={{ direction: 'ltr', textAlign: 'right' }}>{r.requestDate}</td>
                    <td><code className="audit-code">{r.auditCode}</code></td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.title}>
                      {r.title}
                      {isReturned && <span className="badge b-rejected" style={{ marginRight: 6, fontSize: 10 }}>↩ عودت‌شده</span>}
                    </td>
                    <td><span className="badge b-approved" style={{ fontSize: 11 }}>{r.regPlak}</span></td>
                    <td>{r.area.toFixed(1)}</td>
                    <td><span className={`badge ${wfCls(r.status)}`}>{isReturned ? 'نیازمند اصلاح' : wfLabel(r.status)}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      {canUpload
                        ? <button className="btn btn-sm btn-primary" style={{ fontSize: 11 }}
                            onClick={() => onSelectRequest(r)}>📤 بارگذاری کروکی</button>
                        : r.status === 'submitted'
                          ? <span style={{ fontSize: 11, color: 'var(--g400)' }}>در انتظار تأیید کارشناس</span>
                          : <span style={{ fontSize: 11, color: 'var(--success)' }}>✓ آماده دریافت سرویس</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="tbl-footer">
          <span>{filtered.length} درخواست</span>
          <span style={{ fontSize: 11, color: 'var(--g400)' }}>برای بارگذاری کروکی روی ردیف «ارجاع‌شده» کلیک کنید</span>
        </div>
      </div>

      {showReady && (
        <ReadinessModal current={myReadiness} onSave={saveReadiness} onClose={() => setShowReady(false)} />
      )}
    </>
  )
}
