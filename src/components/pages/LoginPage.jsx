import { useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'

export default function LoginPage() {
  const { validate, login } = useApp()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [otp,      setOtp]      = useState('')
  const [showOtp,  setShowOtp]  = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [pendingUser, setPendingUser] = useState(null)
  const [vpnOk] = useState(true)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!vpnOk) { setError('اتصال VPN برقرار نیست. ابتدا به VPN آستان قدس متصل شوید.'); return }
    if (!username || !password) { setError('نام کاربری و رمز عبور الزامی است.'); return }

    // مرحلهٔ ۱: تطبیق اعتبار (بدون ثبت ورود) و نمایش فیلد OTP
    if (!showOtp) {
      setLoading(true)
      const ok = await validate(username, password)
      setLoading(false)
      if (!ok) { setError('نام کاربری یا رمز عبور اشتباه است.'); return }
      setPendingUser(ok)
      setShowOtp(true)
      return
    }

    // مرحلهٔ ۲: تأیید OTP و ورود نهایی
    if (!otp) { setError('رمز یکبارمصرف الزامی است.'); return }
    setLoading(true)
    try {
      const normalizedOtp = otp.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
      await login(username, password, normalizedOtp)
    } catch (err) {
      setError(err.message || 'ورود به سامانه ناموفق بود.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-bg">
      <div className="login-shape login-shape-1" />
      <div className="login-shape login-shape-2" />

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-wrap">
            <img src="/logo.png" alt="آستان قدس رضوی" className="login-logo"
              onError={e => { e.target.style.display="none"; e.target.parentNode.innerHTML="<div style=\"width:76px;height:76px;background:linear-gradient(135deg,#0A3310,#2E7D32);border-radius:20px;display:flex;align-items:center;justify-content:center;font-size:36px;margin:0 auto;\">🗺</div>"; }} />
          </div>
          <h1 className="login-title">سامانه بارگذاری کروکی</h1>
          <p className="login-subtitle">نقشه‌برداری آستان قدس رضوی</p>
          <p className="login-version">وب اطلس پویا · نسخه ۸.۰ دسکتاپ</p>
        </div>

        <div className={`login-vpn ${vpnOk ? 'vpn-ok' : 'vpn-fail'}`}>
          <span className="login-vpn-dot" />
          <span>{vpnOk ? 'محیط محلی Docker آماده اتصال است' : 'ارتباط محلی برقرار نیست'}</span>
        </div>

        <div className="login-cert">
          <span style={{ fontSize: 14 }}>🔒</span>
          <span>ورود محلی · کد آزمایشی ۱۲۳۴۵۶</span>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && (<div className="login-error"><span>⚠️</span> {error}</div>)}

          <div className="fg">
            <label className="fl">نام کاربری (کد پرسنلی) <span className="req">*</span></label>
            <div className="login-input-wrap">
              <span className="login-inp-icon">👤</span>
              <input className="fc login-input" type="text" placeholder="مثال: tamizi"
                value={username} onChange={e => setUsername(e.target.value)} autoFocus />
            </div>
          </div>

          <div className="fg">
            <label className="fl">رمز عبور <span className="req">*</span></label>
            <div className="login-input-wrap">
              <span className="login-inp-icon">🔑</span>
              <input className="fc login-input" type="password" placeholder="رمز عبور"
                value={password} onChange={e => setPassword(e.target.value)} />
            </div>
          </div>

          {showOtp && (
            <div className="fg">
              <label className="fl">رمز یکبارمصرف (TOTP) <span className="req">*</span></label>
              <div className="login-input-wrap">
                <span className="login-inp-icon">📱</span>
                <input className="fc login-input" type="text"
                  placeholder="کد ۶ رقمی (نمونه: ۱۲۳۴۵۶)" value={otp}
                  onChange={e => setOtp(e.target.value)} maxLength={6} autoFocus
                  style={{ letterSpacing: 4, textAlign: 'center', direction: 'ltr' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--g400)', marginTop: 5 }}>
                📱 رمز را از اپ Google Authenticator یا Microsoft Authenticator دریافت کنید
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary"
            style={{ width: '100%', padding: '11px', fontSize: 14, marginTop: 8, justifyContent: 'center' }}
            disabled={loading || !vpnOk}>
            {loading ? (<><div className="login-spin" /> در حال ورود...</>)
              : showOtp ? '✓ تأیید و ورود به سامانه' : '← ورود به سامانه'}
          </button>
        </form>

        <div className="login-hint">
          <strong>حساب‌های نمونه:</strong>{' '}
          <code>tamizi</code> (نقشه‌بردار ارشد) · <code>masoul</code> (کارشناس مسئول) · <code>admin</code> (سرپرست)
          {' '}· رمز همه: <code>1234</code> / <code>admin</code>
          {showOtp && <> · TOTP: <code>123456</code></>}
        </div>

        <div className="login-footer">
          نسخه محلی توسعه و آزمایش؛ برای استقرار سازمانی، HTTPS و mTLS در درگاه شبکه فعال شود
        </div>
      </div>
    </div>
  )
}
