import { AUDIT_FIELDS, DIRECTIONS, FIELD_GROUPS, auditCode } from '../../data/krokyForm.js'
const text = value => value === null || value === undefined || value === '' ? '—' : String(value)

export default function KrokyDetails({ kroky }) {
  if (!kroky?.information) return <div className="alert al-warn">این ثبت از نسخه قدیمی است؛ برای تکمیل فرم جدید به نقشه‌بردار عودت دهید.</div>
  const info = kroky.information
  return <>
    <div className="alert al-info mb16">تحلیل DXF نمایشی است. اطلاعات زیر توسط کاربر وارد شده است. شماره و تاریخ کروکی پس از ثبت در سیاق اختصاص داده می‌شود.</div>
    <div className="card mb20"><div className="card-bd g2">
      <div className="a-item"><span>نوع</span><span>{info.kind === 'map' ? 'نقشه' : 'کروکی'}</span></div>
      <div className="a-item"><span>چاپ پرینت حقوقی</span><span>{info.legal_reprint ? 'بله' : 'خیر'}</span></div>
    </div></div>
    <div className="card mb20"><div className="card-bd"><div className="a-item"><span className="a-key">کد ممیزی</span><bdi className="a-val" dir="ltr">{auditCode(info)}</bdi></div></div></div>
    {FIELD_GROUPS.map(([title, fields]) => <div className="card mb20" key={title}><div className="card-hd"><div className="card-title">{title}</div></div>
      <div className="card-bd g2">{fields.filter(([key]) => !AUDIT_FIELDS.some(([part]) => part === key)).map(([key, label]) => <div className="a-item form-detail" key={key}><span className="a-key">{label}</span><span className="a-val">{text(info[key])}</span></div>)}</div>
    </div>)}
    <div className="card mb20"><div className="card-hd"><div className="card-title">اطلاعات حدود</div></div><div className="tbl-wrap"><table><thead><tr><th>جهت</th><th>مجاور</th><th>طول (متر)</th><th>عرض معبر (متر)</th></tr></thead><tbody>
      {(kroky.boundaries || []).map((b, i) => <tr key={i}><td>{DIRECTIONS[b.direction]}</td><td>{b.neighbor}</td><td>{text(b.length)}</td><td>{text(b.road_width)}</td></tr>)}
    </tbody></table></div></div>
    <div className="card mb20"><div className="card-hd"><div className="card-title">وضعیت زمین و بهره‌برداری</div></div><div className="tbl-wrap"><table><thead><tr><th>بهره‌برداری</th><th>مساحت (مترمربع)</th><th>توضیحات</th></tr></thead><tbody>
      {(kroky.land_uses || []).map((u, i) => <tr key={i}><td>{u.use}</td><td>{text(u.area)}</td><td>{text(u.description)}</td></tr>)}
      {!kroky.land_uses?.length && <tr><td colSpan={3}>ردیفی وارد نشده است.</td></tr>}
    </tbody></table></div></div>
    <div className="card mb20"><div className="card-hd"><div className="card-title">فایل‌ها و اطلاعات برداشت</div></div><div className="card-bd">
      <div className="g2">{[
        ['روش نقشه‌برداری', kroky.upload_options?.survey_method], ['Zone UTM', kroky.upload_options?.utm_zone],
        ['نیمکره', kroky.upload_options?.hemisphere === 'S' ? 'جنوبی' : 'شمالی'], ['انحراف از شمال', kroky.upload_options?.north_deviation],
        ['شرح بازدید', kroky.visit?.description], ['بازدید انجام شده', kroky.visit?.is_done ? 'بله' : 'خیر'], ['تاریخ بازدید', kroky.visit?.done_date],
      ].map(([label, value]) => <div className="a-item form-detail" key={label}><span className="a-key">{label}</span><span className="a-val">{text(value)}</span></div>)}</div>
      {kroky.file && <p>فایل DXF: {kroky.file.url ? <a href={kroky.file.url} download>{kroky.file.name}</a> : kroky.file.name}</p>}
      <div className="photo-editor-grid">{(kroky.photos || []).map((p, i) => <div className="photo-editor" key={p.id || i}><a href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt={p.title || p.name} /></a><strong>{p.title || p.name}</strong><p>{p.description}</p></div>)}</div>
    </div></div>
  </>
}
