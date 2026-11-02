export default function SuccessPage({ trackingNo, submittedAt, surveyorName, onDone, onNew }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', paddingTop: 40 }}>
      <div className="card" style={{ maxWidth: 520, width: '100%', textAlign: 'center', overflow: 'visible' }}>

        {/* Success icon */}
        <div style={{ marginTop: -28, display: 'flex', justifyContent: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'var(--success)', border: '4px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, boxShadow: '0 4px 16px rgba(37,109,68,.3)'
          }}>✓</div>
        </div>

        <div className="card-bd" style={{ padding: '24px 32px 32px' }}>
          <h2 style={{ color: 'var(--success)', fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
            کروکی با موفقیت ارسال شد
          </h2>
          <p style={{ color: 'var(--g500)', fontSize: 13, marginBottom: 20 }}>
            کروکی به کارتابل کارشناس مسئول ارسال شد و در انتظار بررسی و تأیید است.
          </p>

          {/* Tracking number */}
          <div style={{ background: 'var(--navy)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginBottom: 8 }}>شماره درخواست</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#fff', letterSpacing: 3, direction: 'ltr' }}>
              {trackingNo}
            </div>
          </div>

          <div className="alert al-info" style={{ textAlign: 'right' }}>
            <span className="al-icon">ℹ️</span>
            <span>وضعیت این درخواست را می‌توانید در کارتابل خود پیگیری کنید.</span>
          </div>

          {/* Details */}
          <div style={{ background: 'var(--g50)', borderRadius: 8, padding: '14px 16px', marginBottom: 24, textAlign: 'right' }}>
            {[
              ['زمان ثبت محلی', submittedAt ? new Date(submittedAt.endsWith('Z') || /[+-]\d\d:\d\d$/.test(submittedAt) ? submittedAt : `${submittedAt}Z`).toLocaleString('fa-IR') : '—'],
              ['وضعیت اولیه', 'در انتظار تأیید کارشناس مسئول'],
              ['نقشه‌بردار', surveyorName],
            ].map(([k, v]) => (
              <div key={k} className="a-item">
                <span className="a-key">{k}</span>
                <span className="a-val">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex-end" style={{ justifyContent: 'center', gap: 12 }}>
            <button className="btn btn-outline" onClick={onNew}>
              انتخاب درخواست بعدی
            </button>
            <button className="btn btn-primary" onClick={onDone}>
              📋 بازگشت به کارتابل
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
