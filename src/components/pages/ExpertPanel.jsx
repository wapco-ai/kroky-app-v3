import { useState, useMemo, useEffect } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { PLAK_NAMES, TIERS, tierLabel, wfLabel, wfCls } from '../../data/store.js'
import ExpertMap from './ExpertMap.jsx'
import KrokyDetails from '../ui/KrokyDetails.jsx'
import KrokySheet from '../ui/KrokySheet.jsx'

function RejectModal({ request, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const presets = ['تداخل حل‌نشده با قطعه مجاور', 'مغایرت مساحت با سند', 'کیفیت پایین فایل DXF', 'نقص عکس محل']
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
        <h2 style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 18, marginBottom: 6 }}>↩ عودت برای اصلاح</h2>
        <p style={{ color: 'var(--g500)', fontSize: 13, marginBottom: 14 }}>
          درخواست {request.requestNo} به کارتابل نقشه‌بردار عودت داده می‌شود. دلیل عدم تأیید را بنویسید:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {presets.map(p => (
            <button key={p} className="chip" style={{ fontSize: 11 }} onClick={() => setReason(p)}>{p}</button>
          ))}
        </div>
        <textarea className="fc" rows={3} placeholder="دلیل عدم تأیید..." value={reason} onChange={e => setReason(e.target.value)} />
        <div className="flex-end" style={{ gap: 10, marginTop: 16 }}>
          <button className="btn btn-outline" onClick={onClose}>انصراف</button>
          <button className="btn btn-danger" onClick={() => onConfirm(reason)}>↩ عودت به نقشه‌بردار</button>
        </div>
      </div>
    </div>
  )
}

function FormViewModal({ request, surveyorName, onApprove, onReject, onClose }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal review-modal" style={{ maxWidth: 1120, width: '94%', textAlign: 'right', maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="flex-between" style={{ marginBottom: 12 }}>
          <h2 style={{ color: 'var(--g800)', fontWeight: 700, fontSize: 18 }}>📄 فرم کروکی · {request.requestNo}</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* اطلاعات خلاصه درخواست */}
        <div className="g2" style={{ marginBottom: 14 }}>
          <div className="a-item"><span className="a-key">نقشه‌بردار</span><span className="a-val">{surveyorName(request.assignedTo)}</span></div>
          <div className="a-item"><span className="a-key">پلاک ثبتی</span><span className="a-val">{request.regPlak}</span></div>
          <div className="a-item"><span className="a-key">آدرس قطعه</span><span className="a-val">{request.title}</span></div>
          <div className="a-item"><span className="a-key">کد ممیزی</span><span className="a-val"><code className="audit-code">{request.auditCode}</code></span></div>
        </div>

        {request.kroky?.information && <div className="kroky-preview-stage"><KrokySheet request={request} draft={request.kroky} surveyorName={surveyorName(request.assignedTo)} /></div>}
        <details className="review-details"><summary>نمایش همه اطلاعات و پیوست‌ها</summary><KrokyDetails kroky={request.kroky} /></details>

        {/* اقدامات: تأیید / عودت */}
        <div className="flex gap8" style={{ marginTop: 20 }}>
          <button className="btn btn-success" disabled={!request.kroky?.information} style={{ flex: 1, justifyContent: 'center' }} onClick={() => onApprove(request)}>✓ تأیید و آماده‌سازی برای انتقال</button>
          <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onReject(request)}>↩ عودت به کارشناس</button>
        </div>
      </div>
    </div>
  )
}

export default function ExpertPanel({ onToast, activeTab = 'review', onTabChange }) {
  const {
    requests, surveyors, readiness, readySurveyorsFor,
    assignRequests, planAutoAssign, applyPlan, approveRequest, rejectRequest,
  } = useApp()

  const [tab, setTab] = useState(activeTab)
  useEffect(() => { setTab(activeTab) }, [activeTab])
  const selectTab = tab => { setTab(tab); onTabChange?.(tab) }
  const [rejecting, setRejecting] = useState(null)
  const [viewing, setViewing] = useState(null)   // درخواستی که فرم آن مشاهده می‌شود

  // ── ارجاع هوشمند ──
  const [autoPlak, setAutoPlak] = useState('طرق')
  const [preview, setPreview] = useState(null)

  // ── ارجاع دستی ──
  const [picked, setPicked] = useState(new Set())
  const [manualSurveyor, setManualSurveyor] = useState('')

  const surveyorName = (u) => surveyors.find(s => s.username === u)?.name || u

  const submitted  = useMemo(() => requests.filter(r => r.status === 'submitted'), [requests])
  const unassigned = useMemo(() => requests.filter(r => r.status === 'unassigned'), [requests])

  const plaksWithPending = useMemo(() => {
    const m = {}
    unassigned.forEach(r => { m[r.regPlak] = (m[r.regPlak] || 0) + 1 })
    return m
  }, [unassigned])

  // ── اکشن‌های تأیید/عودت ──
  const doApprove = async (r) => {
    try { await approveRequest(r.id); setViewing(null); onToast?.(`درخواست ${r.requestNo} تأیید شد؛ اطلاعات برای دریافت سرویس انتقال آماده است.`) }
    catch (error) { onToast?.(error.message) }
  }
  const askReject = (r) => { setViewing(null); setRejecting(r) }   // باز کردن مودال دلیل عودت
  const doReject = async (reason) => {
    try { await rejectRequest(rejecting.id, reason); onToast?.(`درخواست ${rejecting.requestNo} برای اصلاح عودت داده شد`); setRejecting(null) }
    catch (error) { onToast?.(error.message) }
  }

  // ── ارجاع هوشمند ──
  const buildPreview = async () => { try { setPreview(await planAutoAssign(autoPlak)) } catch (error) { onToast?.(error.message) } }
  const applyAuto = async () => {
    try {
    await applyPlan(preview.plan)
    const total = preview.plan.reduce((a, p) => a + p.items.length, 0)
    onToast?.(`${total} درخواست به‌صورت هوشمند بین ${preview.plan.length} کارشناس تقسیم شد ✓`)
    setPreview(null)
    } catch (error) { onToast?.(error.message) }
  }

  // ── ارجاع دستی ──
  const toggle = (id) => setPicked(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const togglePlak = (plak) => {
    const ids = unassigned.filter(r => r.regPlak === plak).map(r => r.id)
    setPicked(prev => {
      const n = new Set(prev)
      const allIn = ids.every(i => n.has(i))
      ids.forEach(i => allIn ? n.delete(i) : n.add(i))
      return n
    })
  }
  const assignManual = async () => {
    if (!manualSurveyor || picked.size === 0) return
    try {
    await assignRequests([...picked], manualSurveyor)
    onToast?.(`${picked.size} درخواست به ${surveyorName(manualSurveyor)} ارجاع شد ✓`)
    setPicked(new Set())
    } catch (error) { onToast?.(error.message) }
  }

  return (
    <>
      <div className="dash-banner">
        <div className="dash-banner-left">
          <div>
            <div className="dash-banner-title">کارتابل کارشناس مسئول</div>
            <div className="dash-banner-sub">بررسی و تأیید کروکی‌ها · ارجاع هوشمند و گروهی درخواست‌ها به کارشناسان نقشه‌بردار</div>
          </div>
        </div>
        <div className="flex gap8">
          <span className="badge b-reviewing" style={{ fontSize: 12, padding: '6px 12px' }}>{submitted.length} در انتظار تأیید</span>
          <span className="badge b-pending" style={{ fontSize: 12, padding: '6px 12px' }}>{unassigned.length} بدون کارشناس</span>
        </div>
      </div>

      {/* تب‌ها */}
      <div className="filter-row">
        <button className={`chip${tab === 'review' ? ' on' : ''}`} onClick={() => selectTab('review')}>📨 بررسی و تأیید ({submitted.length})</button>
        <button className={`chip${tab === 'assign' ? ' on' : ''}`} onClick={() => selectTab('assign')}>🧭 ارجاع به کارشناسان ({unassigned.length})</button>
        <button className={`chip${tab === 'map' ? ' on' : ''}`} onClick={() => selectTab('map')}>🗺 ارجاع روی نقشه</button>
      </div>

      {/* ════════ تب ۱: بررسی و تأیید ════════ */}
      {tab === 'review' && (
        submitted.length === 0 ? (
          <div className="card"><div className="card-bd" style={{ textAlign: 'center', color: 'var(--g400)', padding: 40 }}>
            درخواستی در انتظار تأیید نیست
          </div></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(360px,1fr))', gap: 16 }}>
            {submitted.map(r => (
              <div key={r.id} className="card">
                <div className="card-hd">
                  <div className="card-title">📄 {r.title}</div>
                  <span className="req-no-badge">{r.requestNo}</span>
                </div>
                <div className="card-bd">
                  <div className="a-item"><span className="a-key">نقشه‌بردار</span><span className="a-val">{surveyorName(r.assignedTo)}</span></div>
                  <div className="a-item"><span className="a-key">پلاک ثبتی</span><span className="a-val">{r.regPlak}</span></div>
                  <div className="a-item"><span className="a-key">مساحت</span><span className="a-val">{r.area} م²</span></div>
                  <div className="a-item"><span className="a-key">کد ممیزی</span><span className="a-val"><code className="audit-code">{r.auditCode}</code></span></div>
                  {r.kroky?.photos?.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      {r.kroky.photos.map((p, i) => (
                        <img key={i} src={p.url} alt="عکس محل"
                          style={{ width: 84, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--g200)' }} />
                      ))}
                    </div>
                  )}
                  <div className="flex gap8" style={{ marginTop: 16 }}>
                    <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setViewing(r)}>👁 مشاهده فرم</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ════════ تب ۲: ارجاع به کارشناسان ════════ */}
      {tab === 'assign' && (
        <>
          {/* ارجاع هوشمند */}
          <div className="form-section-title"><span className="form-section-num">۱</span> ارجاع هوشمند یک پلاک ثبتی</div>
          <div className="card mb20">
            <div className="card-bd">
              <p style={{ fontSize: 13, color: 'var(--g500)', marginBottom: 14, lineHeight: 1.7 }}>
                سیستم درخواست‌های بدون کارشناسِ یک پلاک ثبتی را میان کارشناسانی که برای همان پلاک اعلام آمادگی کرده‌اند،
                به‌صورت <strong>مکانیِ بدون هم‌پوشانی</strong> تقسیم می‌کند (برش در راستای محور با بیشترین گستردگی).
              </p>
              <div className="flex gap12" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="fg" style={{ marginBottom: 0, minWidth: 200 }}>
                  <label className="fl">پلاک ثبتی</label>
                  <select className="fc" value={autoPlak} onChange={e => { setAutoPlak(e.target.value); setPreview(null) }}>
                    {PLAK_NAMES.map(p => (
                      <option key={p} value={p}>{p} {plaksWithPending[p] ? `(${plaksWithPending[p]} بدون کارشناس)` : '(۰)'}</option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-primary" onClick={buildPreview}>🧠 پیش‌نمایش ارجاع هوشمند</button>
              </div>

              {/* وضعیت آمادگی کارشناسان این پلاک */}
              <div style={{ marginTop: 14, fontSize: 13, color: 'var(--g600)' }}>
                کارشناسانِ آمادهٔ «{autoPlak}»:{' '}
                {readySurveyorsFor(autoPlak).length === 0
                  ? <span style={{ color: 'var(--danger)' }}>هیچ کارشناسی اعلام آمادگی نکرده است</span>
                  : readySurveyorsFor(autoPlak).map(s => (
                      <span key={s.username} className="badge" style={{ background: TIERS[s.tier].bg, color: TIERS[s.tier].color, marginLeft: 6 }}>
                        {s.name} ({tierLabel(s.tier)})
                      </span>
                    ))}
              </div>

              {/* پیش‌نمایش طرح */}
              {preview && (
                preview.plan.length === 0 ? (
                  <div className="alert al-warn" style={{ marginTop: 16 }}>
                    <span className="al-icon">⚠️</span>
                    <span>ارجاع ممکن نیست: یا کارشناسِ آماده‌ای وجود ندارد یا درخواست بدون کارشناسی در این پلاک نیست.</span>
                  </div>
                ) : (
                  <div style={{ marginTop: 18 }}>
                    <div className="alert al-info" style={{ marginBottom: 12 }}>
                      <span className="al-icon">🧭</span>
                      <span>{preview.pending.length} درخواست در «{preview.plak}» میان {preview.plan.length} کارشناس تقسیم شد · محور برش: {preview.axis === 'lng' ? 'شرقی‑غربی (طول)' : 'شمالی‑جنوبی (عرض)'}</span>
                    </div>
                    <div className="g2">
                      {preview.plan.map(({ surveyor, items }) => (
                        <div key={surveyor.username} className="card" style={{ borderRight: `4px solid ${TIERS[surveyor.tier].color}` }}>
                          <div className="card-hd">
                            <div className="card-title">{surveyor.name} <span className="badge" style={{ background: TIERS[surveyor.tier].bg, color: TIERS[surveyor.tier].color, marginRight: 6 }}>{tierLabel(surveyor.tier)}</span></div>
                            <span className="req-no-badge">{items.length} درخواست</span>
                          </div>
                          <div className="card-bd" style={{ maxHeight: 200, overflowY: 'auto', padding: '8px 16px' }}>
                            {items.map(it => (
                              <div key={it.id} style={{ fontSize: 12, color: 'var(--g600)', padding: '4px 0', borderBottom: '1px solid var(--g100)' }}>
                                {it.requestNo} · {it.title}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex-end" style={{ marginTop: 14 }}>
                      <button className="btn btn-outline" onClick={() => setPreview(null)}>انصراف</button>
                      <button className="btn btn-success" onClick={applyAuto}>✓ اعمال ارجاع هوشمند</button>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* ارجاع دستی */}
          <div className="form-section-title"><span className="form-section-num">۲</span> ارجاع دستی / گروهی</div>
          <div className="card">
            <div className="card-hd">
              <div className="card-title">درخواست‌های بدون کارشناس ({unassigned.length})</div>
              <div className="flex gap8" style={{ flexWrap: 'wrap' }}>
                <select className="fc" style={{ width: 200 }} value={manualSurveyor} onChange={e => setManualSurveyor(e.target.value)}>
                  <option value="">انتخاب کارشناس مقصد...</option>
                  {surveyors.map(s => <option key={s.username} value={s.username}>{s.name} ({tierLabel(s.tier)})</option>)}
                </select>
                <button className="btn btn-primary btn-sm" disabled={!manualSurveyor || picked.size === 0}
                  style={(!manualSurveyor || picked.size === 0) ? { opacity: .5, cursor: 'not-allowed' } : {}}
                  onClick={assignManual}>← ارجاع {picked.size} مورد انتخاب‌شده</button>
              </div>
            </div>

            {/* انتخاب سریع بر اساس پلاک */}
            <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--g100)', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--g500)' }}>انتخاب سریع پلاک:</span>
              {PLAK_NAMES.filter(p => plaksWithPending[p]).map(p => (
                <button key={p} className="chip" style={{ fontSize: 11 }} onClick={() => togglePlak(p)}>{p} ({plaksWithPending[p]})</button>
              ))}
            </div>

            <div className="tbl-wrap">
              <table>
                <thead><tr>
                  <th style={{ width: 40 }}></th><th>شماره</th><th>آدرس قطعه</th>
                  <th>پلاک ثبتی</th><th>مساحت</th><th>وضعیت</th>
                </tr></thead>
                <tbody>
                  {unassigned.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: 'var(--g400)' }}>درخواست بدون کارشناسی وجود ندارد</td></tr>
                  ) : unassigned.map(r => (
                    <tr key={r.id} className="tbl-row-clickable" onClick={() => toggle(r.id)}>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={picked.has(r.id)} onChange={() => toggle(r.id)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                      </td>
                      <td><span className="req-no-badge">{r.requestNo}</span></td>
                      <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.title}>{r.title}</td>
                      <td><span className="badge b-approved" style={{ fontSize: 11 }}>{r.regPlak}</span></td>
                      <td>{r.area.toFixed(1)} م²</td>
                      <td><span className={`badge ${wfCls(r.status)}`}>{wfLabel(r.status)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="tbl-footer">
              <span>{picked.size} مورد انتخاب شده از {unassigned.length}</span>
              <span style={{ fontSize: 11, color: 'var(--g400)' }}>روی ردیف کلیک کنید تا انتخاب شود</span>
            </div>
          </div>
        </>
      )}

      {/* ════════ تب ۳: ارجاع روی نقشه ════════ */}
      {tab === 'map' && <ExpertMap onToast={onToast} />}

      {viewing && <FormViewModal request={viewing} surveyorName={surveyorName} onApprove={doApprove} onReject={askReject} onClose={() => setViewing(null)} />}
      {rejecting && <RejectModal request={rejecting} onConfirm={doReject} onClose={() => setRejecting(null)} />}
    </>
  )
}
