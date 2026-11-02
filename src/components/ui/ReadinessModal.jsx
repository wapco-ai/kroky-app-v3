import { useState } from 'react'
import { PLAK_NAMES } from '../../data/store.js'

// مودال «اعلام آمادگی محدوده فعالیت» – نقشه‌بردار پلاک‌های ثبتی را انتخاب می‌کند
export default function ReadinessModal({ current = [], onSave, onClose }) {
  const [sel, setSel] = useState(new Set(current))

  const toggle = (name) => setSel(prev => {
    const n = new Set(prev)
    n.has(name) ? n.delete(name) : n.add(name)
    return n
  })

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h2 style={{ color: 'var(--navy)', fontWeight: 700, fontSize: 18 }}>📍 اعلام آمادگی محدوده فعالیت</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <p style={{ color: 'var(--g500)', fontSize: 13, marginBottom: 16, lineHeight: 1.7 }}>
          پلاک‌های ثبتی‌ای که آمادگی انجام امور نقشه‌برداری در آن‌ها را دارید انتخاب کنید.
          کارشناس مسئول هنگام ارجاع، درخواست‌های همین پلاک‌ها را به شما تخصیص خواهد داد.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 22 }}>
          {PLAK_NAMES.map(name => {
            const on = sel.has(name)
            return (
              <button key={name} onClick={() => toggle(name)}
                className={`chip${on ? ' on' : ''}`}
                style={{ fontSize: 13, padding: '8px 16px' }}>
                {on ? '✓ ' : ''}{name}
              </button>
            )
          })}
        </div>

        <div className="flex-end" style={{ gap: 10 }}>
          <button className="btn btn-outline" onClick={onClose}>انصراف</button>
          <button className="btn btn-primary" onClick={() => onSave([...sel])}>
            💾 ثبت آمادگی ({sel.size})
          </button>
        </div>
      </div>
    </div>
  )
}
