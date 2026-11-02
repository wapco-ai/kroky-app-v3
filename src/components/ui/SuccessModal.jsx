export default function SuccessModal({ trackingNo, onClose }) {
  return (
    <div className="modal-bg">
      <div className="modal">
        <div style={{ fontSize: 52, marginBottom: 12 }}>✅</div>
        <h2 style={{ color: 'var(--success)', marginBottom: 8, fontWeight: 600 }}>
          فرم با موفقیت ثبت شد
        </h2>
        <p style={{ color: 'var(--g500)', fontSize: 13, marginBottom: 4 }}>
          شماره پیگیری در سامانه سیاق:
        </p>
        <div className="track-num">{trackingNo}</div>
        <p style={{ fontSize: 12, color: 'var(--g400)', marginTop: 8 }}>
          این شماره را برای پیگیری در گردش‌کار سیاق حفظ نمایید
        </p>
        <button
          className="btn btn-primary"
          style={{ marginTop: 18, width: '100%' }}
          onClick={onClose}
        >
          بازگشت به داشبورد
        </button>
      </div>
    </div>
  )
}
