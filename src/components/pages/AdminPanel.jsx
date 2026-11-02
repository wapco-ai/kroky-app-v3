import { useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { TIERS, TIER_ORDER, tierFromPoints, tierLabel } from '../../data/store.js'

const blank = { kind: 'surveyor', name: '', username: '', password: '', points: '' }

function TierBadge({ tier }) {
  const t = TIERS[tier] || TIERS.regular
  return <span className="badge" style={{ background: t.bg, color: t.color }}>{t.label}</span>
}

export default function AdminPanel({ onToast }) {
  const { surveyors, experts, readiness, addSurveyor, updateSurveyor, removeSurveyor, addExpert } = useApp()
  const [form, setForm] = useState(blank)
  const [error, setError] = useState('')
  const [reveal, setReveal] = useState({})   // نمایش/مخفی رمز هر ردیف

  const isExpert = form.kind === 'expert'
  const suggested = tierFromPoints(Number(form.points) || 0)

  const create = async () => {
    setError('')
    const name = form.name.trim(), username = form.username.trim(), password = form.password.trim()
    if (!name)     { setError('نام و نام خانوادگی الزامی است.'); return }
    if (!username) { setError('نام کاربری الزامی است.'); return }
    if (!password) { setError('رمز عبور الزامی است.'); return }
    if ([...surveyors, ...experts].some(u => u.username === username)) {
      setError('این نام کاربری قبلاً ثبت شده است.'); return
    }
    try {
      if (isExpert) {
        await addExpert({ name, username, password })
        onToast?.(`کارتابل کارشناس مسئول «${name}» ایجاد شد ✓`)
      } else {
        await addSurveyor({ name, username, password, points: Number(form.points) || 0 })
        onToast?.(`نقشه‌بردار «${name}» با رده ${tierLabel(suggested)} ایجاد شد ✓`)
      }
    } catch (err) {
      setError(err.message || 'ایجاد کاربر ناموفق بود.')
      return
    }
    setForm(blank)
  }

  const counts = TIER_ORDER.map(k => ({
    key: k, label: TIERS[k].label, n: surveyors.filter(s => s.tier === k).length, color: TIERS[k].color,
  }))

  return (
    <>
      <div className="dash-banner">
        <div className="dash-banner-left">
          <div>
            <div className="dash-banner-title">پنل مدیریت سامانه</div>
            <div className="dash-banner-sub">ایجاد و مدیریت کارتابل نقشه‌برداران و کارشناسان مسئول · رده‌بندی نقشه‌برداران بر اساس امتیاز</div>
          </div>
        </div>
      </div>

      {/* آمار رده‌ها */}
      <div className="stats mb20">
        <div className="scard">
          <div className="scard-icon si-blue">👷</div>
          <div><div className="scard-val">{surveyors.length}</div><div className="scard-lbl">کل نقشه‌برداران</div></div>
        </div>
        <div className="scard">
          <div className="scard-icon si-green">🧭</div>
          <div><div className="scard-val">{experts.length}</div><div className="scard-lbl">کارشناسان مسئول</div></div>
        </div>
        {counts.map(c => (
          <div key={c.key} className="scard">
            <div className="scard-icon" style={{ background: TIERS[c.key].bg, color: c.color }}>★</div>
            <div><div className="scard-val">{c.n}</div><div className="scard-lbl">کاربر {c.label}</div></div>
          </div>
        ))}
      </div>

      {/* فرم ایجاد کاربر */}
      <div className="form-section-title"><span className="form-section-num">+</span> ایجاد کارتابل جدید</div>
      <div className="card mb20">
        <div className="card-bd">
          {error && <div className="login-error" style={{ marginBottom: 14 }}><span>⚠️</span> {error}</div>}

          {/* انتخاب نوع کارتابل */}
          <div className="fg">
            <label className="fl">نوع کارتابل <span className="req">*</span></label>
            <div className="filter-row" style={{ marginBottom: 0 }}>
              <button type="button" className={`chip${form.kind === 'surveyor' ? ' on' : ''}`}
                onClick={() => { setForm(f => ({ ...f, kind: 'surveyor' })); setError('') }}>👷 نقشه‌بردار</button>
              <button type="button" className={`chip${form.kind === 'expert' ? ' on' : ''}`}
                onClick={() => { setForm(f => ({ ...f, kind: 'expert' })); setError('') }}>🧭 کارشناس مسئول</button>
            </div>
          </div>

          <div className="g2">
            <div>
              <div className="fg">
                <label className="fl">نام و نام خانوادگی <span className="req">*</span></label>
                <input className="fc" placeholder="مثال: مهدی کریمی" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="fg">
                <label className="fl">نام کاربری <span className="req">*</span></label>
                <input className="fc" placeholder="مثال: karimi" style={{ direction: 'ltr', textAlign: 'right' }}
                  value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
              </div>
            </div>
            <div>
              <div className="fg">
                <label className="fl">رمز عبور <span className="req">*</span></label>
                <input className="fc" placeholder="رمز عبور اولیه" style={{ direction: 'ltr', textAlign: 'right' }}
                  value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              {isExpert ? (
                <div className="fg">
                  <label className="fl">نقش</label>
                  <div className="alert al-info" style={{ marginTop: 4 }}>
                    <span className="al-icon">🧭</span>
                    <span>کارشناس مسئول رده‌بندی و امتیاز ندارد؛ به پنل بررسی/تأیید و ارجاع درخواست‌ها دسترسی دارد.</span>
                  </div>
                </div>
              ) : (
                <div className="fg">
                  <label className="fl">امتیاز کاربر</label>
                  <input className="fc" type="number" min="0" placeholder="مثال: 450"
                    value={form.points} onChange={e => setForm(f => ({ ...f, points: e.target.value }))} />
                  <div style={{ fontSize: 12, color: 'var(--g500)', marginTop: 8 }}>
                    رده پیشنهادی بر اساس امتیاز: <TierBadge tier={suggested} />
                    <span style={{ marginRight: 8, color: 'var(--g400)' }}>
                      (عادی: ۰–۲۹۹ · حرفه‌ای: ۳۰۰–۶۹۹ · ارشد: ۷۰۰+)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex-end" style={{ marginTop: 4 }}>
            <button className="btn btn-primary" onClick={create}>
              + ایجاد کارتابل {isExpert ? 'کارشناس مسئول' : 'نقشه‌بردار'}
            </button>
          </div>
        </div>
      </div>

      {/* جدول کاربران */}
      <div className="card">
        <div className="card-hd"><div className="card-title">👷 نقشه‌برداران ثبت‌شده</div></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>نام</th><th>نام کاربری</th><th>رمز عبور</th><th>امتیاز</th>
              <th>رده کاربری</th><th>محدوده‌های آماده</th><th>عملیات</th>
            </tr></thead>
            <tbody>
              {surveyors.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: 'var(--g400)' }}>هنوز نقشه‌برداری ثبت نشده است</td></tr>
              ) : surveyors.map(s => (
                <tr key={s.username}>
                  <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{s.name}</td>
                  <td><code className="audit-code">{s.username}</code></td>
                  <td>
                    <div className="flex gap8">
                      <input className="fc" style={{ width: 110, padding: '5px 8px', fontSize: 12, direction: 'ltr', textAlign: 'right' }}
                        type={reveal[s.username] ? 'text' : 'password'} value={s.password}
                        onChange={e => updateSurveyor(s.username, { password: e.target.value })} />
                      <button className="btn btn-sm btn-ghost" style={{ fontSize: 11 }}
                        onClick={() => setReveal(r => ({ ...r, [s.username]: !r[s.username] }))}>
                        {reveal[s.username] ? '🙈' : '👁'}
                      </button>
                    </div>
                  </td>
                  <td>
                    <input className="fc" type="number" min="0" style={{ width: 90, padding: '5px 8px', fontSize: 12 }}
                      value={s.points ?? 0}
                      onChange={e => updateSurveyor(s.username, { points: e.target.value })} />
                  </td>
                  <td>
                    <select className="fc" style={{ width: 110, padding: '5px 8px', fontSize: 12 }}
                      value={s.tier} onChange={e => updateSurveyor(s.username, { tier: e.target.value })}>
                      {TIER_ORDER.map(k => <option key={k} value={k}>{TIERS[k].label}</option>)}
                    </select>
                  </td>
                  <td style={{ maxWidth: 180 }}>
                    {(readiness[s.username] || []).length === 0
                      ? <span style={{ fontSize: 12, color: 'var(--g400)' }}>—</span>
                      : <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {(readiness[s.username] || []).map(p => <span key={p} className="badge b-approved" style={{ fontSize: 10 }}>{p}</span>)}
                        </div>}
                  </td>
                  <td>
                    <button className="btn btn-sm btn-danger" style={{ fontSize: 11 }}
                      onClick={() => { if (confirm(`حساب «${s.name}» حذف شود؟`)) { removeSurveyor(s.username); onToast?.('کاربر حذف شد') } }}>
                      🗑 حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-footer">
          <span>{surveyors.length} نقشه‌بردار</span>
          <span style={{ fontSize: 11, color: 'var(--g400)' }}>تغییر امتیاز، رده پیشنهادی را به‌روزرسانی می‌کند؛ رده را می‌توانید دستی نیز تغییر دهید</span>
        </div>
      </div>

      {/* جدول کارشناسان مسئول */}
      <div className="card mt20">
        <div className="card-hd"><div className="card-title">🧭 کارشناسان مسئول</div></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr>
              <th>نام</th><th>نام کاربری</th><th>رمز عبور</th><th>نقش</th><th>عملیات</th>
            </tr></thead>
            <tbody>
              {experts.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--g400)' }}>هنوز کارشناس مسئولی ثبت نشده است</td></tr>
              ) : experts.map(s => (
                <tr key={s.username}>
                  <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{s.name}</td>
                  <td><code className="audit-code">{s.username}</code></td>
                  <td>
                    <div className="flex gap8">
                      <input className="fc" style={{ width: 110, padding: '5px 8px', fontSize: 12, direction: 'ltr', textAlign: 'right' }}
                        type={reveal[s.username] ? 'text' : 'password'} value={s.password}
                        onChange={e => updateSurveyor(s.username, { password: e.target.value })} />
                      <button className="btn btn-sm btn-ghost" style={{ fontSize: 11 }}
                        onClick={() => setReveal(r => ({ ...r, [s.username]: !r[s.username] }))}>
                        {reveal[s.username] ? '🙈' : '👁'}
                      </button>
                    </div>
                  </td>
                  <td><span className="badge b-reviewing">کارشناس مسئول</span></td>
                  <td>
                    <button className="btn btn-sm btn-danger" style={{ fontSize: 11 }}
                      onClick={() => { if (confirm(`کارتابل «${s.name}» حذف شود؟`)) { removeSurveyor(s.username); onToast?.('کارتابل کارشناس حذف شد') } }}>
                      🗑 حذف
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="tbl-footer">
          <span>{experts.length} کارشناس مسئول</span>
          <span style={{ fontSize: 11, color: 'var(--g400)' }}>کارشناس مسئول به پنل بررسی/تأیید و ارجاع درخواست‌ها دسترسی دارد</span>
        </div>
      </div>
    </>
  )
}
