import { useRef, useState } from 'react'
import { useApp } from '../../store/AppContext.jsx'
import { ACTUAL_USES, AUDIT_FIELDS, DIRECTIONS, FIELD_GROUPS, LAND_USES, PROPERTY_TYPES, SURVEY_METHODS, auditCode, validateDraft } from '../../data/krokyForm.js'
import StepProgress from '../ui/StepProgress.jsx'
export const STEPS = ['تکمیل فرم و انتخاب فایل', 'تحلیل نمایشی', 'بازبینی اطلاعات', 'ارسال به کارشناس مسئول']

export default function UploadForm({ request, draft, onChange, onCancel, onAnalyze }) {
  const { currentUser } = useApp()
  const [tab, setTab] = useState('information'), [error, setError] = useState('')
  const inputRef = useRef(), galleryRef = useRef(), cameraRef = useRef()
  const update = (section, key, value) => onChange(prev => ({...prev, [section]: {...prev[section], [key]: value}}))
  const updateRow = (section, i, key, value) => onChange(prev => ({...prev, [section]: prev[section].map((row, j) => j === i ? {...row, [key]: value} : row)}))
  const processFile = file => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.dxf')) return setError('فایل باید با پسوند DXF باشد.')
    if (file.size > 50 * 1024 * 1024 || !file.size) return setError('فایل DXF باید غیرخالی و حداکثر ۵۰ مگابایت باشد.')
    // No API call, geometry extraction, or change to any information table.
    onChange(prev => ({...prev, file: {name: file.name, size: (file.size / 1024).toFixed(1), _raw: file}}))
    setError('')
  }
  const addPhotos = list => {
    const files = Array.from(list || [])
    if (draft.photos.length + files.length > 30) return setError('حداکثر ۳۰ عکس قابل ثبت است.')
    const accepted = files.filter(file => file.type.startsWith('image/') && file.size > 0 && file.size <= 15 * 1024 * 1024)
    if (accepted.length !== files.length) setError('هر عکس باید تصویر غیرخالی و حداکثر ۱۵ مگابایت باشد.')
    accepted.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => onChange(prev => prev.photos.length < 30 ? ({...prev, photos: [...prev.photos, {name: file.name, url: reader.result, _raw: file, title: 'عکس محل', description: ''}]}) : prev)
      reader.readAsDataURL(file)
    })
  }
  const analyze = () => { const message = validateDraft(draft); setError(message); if (!message) onAnalyze(draft) }
  return <section className="desktop-form" aria-label="فرم اطلاعات کروکی">
    <StepProgress steps={STEPS} active={0} />
    <div className="request-context"><div><span>شماره درخواست</span><strong>{request?.requestNo}</strong></div><div><span>کد ممیزی</span><strong dir="ltr">{auditCode(draft.information, request?.auditCode)}</strong></div><div><span>نقشه‌بردار</span><strong>{currentUser.name}</strong></div><span className="context-status">پیش‌نویس محلی</span></div>
    <div className="filter-row form-tabs" role="tablist" aria-label="بخش‌های فرم">{[['information', 'اطلاعات کروکی'], ['boundaries', 'اطلاعات حدود'], ['land_uses', 'وضعیت زمین و بهره‌برداری'], ['files', 'فایل‌ها و بازدید']].map(([id, title]) =>
      <button key={id} role="tab" aria-selected={tab === id} className={`chip${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>{title}</button>)}</div>
    {tab === 'information' && <>
      <div className="card mb20 form-reserved"><div className="card-bd form-meta-grid">
        <div className="fg"><label className="fl" htmlFor="form-kind">نوع</label><select id="form-kind" className="fc" value={draft.information.kind} onChange={e => update('information', 'kind', e.target.value)}><option value="kroky">کروکی</option><option value="map">نقشه</option></select></div>
        <div className="a-item"><span>وضعیت کروکی</span><span>پیش‌نویس محلی</span></div>
        {['شماره کروکی', 'تاریخ کروکی', 'شماره موقت', 'تاریخ موقت'].map(label => <div className="fg" key={label}><label className="fl">{label}</label><input className="fc" value="توسط سیاق اختصاص داده می‌شود" readOnly /></div>)}
      </div></div>
      {FIELD_GROUPS.map(([title, fields], groupIndex) => <div className="card mb20 information-card" key={title}><div className="card-hd"><div className="card-title"><span className="section-index">{groupIndex + 1}</span>{title}</div></div>
        <div className="card-bd desktop-field-grid">{fields.filter(([key]) => !AUDIT_FIELDS.some(([part]) => part === key)).map(([key, label, type = 'text', required]) => <div className={`fg${type === 'textarea' ? ' field-wide' : ''}`} key={key}>
          <label className="fl" htmlFor={`info-${key}`}>{label}{required && <span className="req"> *</span>}</label>
          {type === 'textarea' ? <textarea className="fc" id={`info-${key}`} rows={3} maxLength={key === 'description' ? 8000 : key === 'land_information' ? 4000 : 2000} value={draft.information[key]} onChange={e => update('information', key, e.target.value)} /> :
            <input className="fc" id={`info-${key}`} type="text" inputMode={type === 'number' ? 'decimal' : 'text'}
              list={key === 'legal_land_use' ? 'legal-uses' : key === 'property_type' ? 'property-types' : undefined}
              placeholder={key.includes('date') ? '1405/07/25' : ''} maxLength={type === 'number' ? 24 : 200}
              value={draft.information[key] ?? ''} onChange={e => update('information', key, e.target.value)} />}
        </div>)}{groupIndex === 0 && <fieldset className="audit-code-field"><legend>کد ممیزی</legend><div className="audit-code-parts" dir="ltr">{AUDIT_FIELDS.map(([key,label],i) => <div className="audit-code-part" key={key}><label htmlFor={`info-${key}`}>{label}</label><input id={`info-${key}`} className="fc" aria-label={`کد ممیزی؛ ${label}`} inputMode="numeric" maxLength={40} value={draft.information[key]} onChange={e => update('information',key,e.target.value)} />{i < 5 && <span className="audit-part-separator" aria-hidden="true">/</span>}</div>)}</div></fieldset>}</div>
      </div>)}
      <label className="form-check"><input type="checkbox" checked={draft.information.legal_reprint} onChange={e => update('information', 'legal_reprint', e.target.checked)} /> چاپ پرینت حقوقی</label>
    </>}
    {tab === 'boundaries' && <div className="card mb20">
      <div className="card-hd"><div className="card-title">حدود اربعه زمین</div><button className="btn btn-sm btn-outline" onClick={() => onChange(prev => ({...prev, boundaries: [...prev.boundaries, {direction: 'N', neighbor: '', length: '', road_width: ''}]}))}>افزودن ردیف</button></div>
      <div className="card-bd"><p className="form-help">برای هر جهت حداقل یک ردیف وارد کنید. انتخاب DXF این جدول را تغییر نمی‌دهد.</p><div className="tbl-wrap"><table><thead><tr><th>جهت</th><th>مجاور</th><th>طول (متر)</th><th>عرض معبر (متر)</th><th>عملیات</th></tr></thead>
        <tbody>{draft.boundaries.map((row, i) => <tr key={i}>
          <td><select className="fc" aria-label={`جهت ردیف ${i + 1}`} value={row.direction} onChange={e => updateRow('boundaries', i, 'direction', e.target.value)}>{Object.entries(DIRECTIONS).map(([key, title]) => <option key={key} value={key}>{title}</option>)}</select></td>
          {['neighbor', 'length', 'road_width'].map(key => <td key={key}><input className="fc" aria-label={`${key} ردیف ${i + 1}`} inputMode={key === 'neighbor' ? 'text' : 'decimal'} value={row[key] ?? ''} onChange={e => updateRow('boundaries', i, key, e.target.value)} /></td>)}
          <td><button className="btn btn-sm btn-danger" disabled={draft.boundaries.length <= 4} onClick={() => onChange(prev => ({...prev, boundaries: prev.boundaries.filter((_, index) => index !== i)}))}>حذف</button></td>
        </tr>)}</tbody></table></div></div>
    </div>}
    {tab === 'land_uses' && <div className="card mb20">
      <div className="card-hd"><div className="card-title">اطلاعات وضعیت زمین و بهره‌برداری</div><button className="btn btn-sm btn-outline" onClick={() => onChange(prev => ({...prev, land_uses: [...prev.land_uses, {use: '', area: '', description: ''}]}))}>افزودن ردیف</button></div>
      <div className="card-bd"><div className="tbl-wrap"><table><thead><tr><th>بهره‌برداری</th><th>مساحت (مترمربع)</th><th>توضیحات</th><th>عملیات</th></tr></thead><tbody>
        {draft.land_uses.map((row, i) => <tr key={i}>
          {['use', 'area', 'description'].map(key => <td key={key}><input className="fc" list={key === 'use' ? 'actual-uses' : undefined} inputMode={key === 'area' ? 'decimal' : 'text'} aria-label={`${key} بهره‌برداری ${i + 1}`} value={row[key] ?? ''} onChange={e => updateRow('land_uses', i, key, e.target.value)} /></td>)}
          <td><button className="btn btn-sm btn-danger" onClick={() => onChange(prev => ({...prev, land_uses: prev.land_uses.filter((_, index) => index !== i)}))}>حذف</button></td>
        </tr>)}{!draft.land_uses.length && <tr><td colSpan={4}>هنوز ردیفی ثبت نشده است.</td></tr>}
      </tbody></table></div></div>
    </div>}
    {tab === 'files' && <>
      <div className="card mb20"><div className="card-hd"><div className="card-title">فایل اتوکد و تنظیمات برداشت</div></div><div className="card-bd"><div className="g2">
        <div className="fg"><label className="fl" htmlFor="survey-method">روش نقشه‌برداری <span className="req">*</span></label><select id="survey-method" className="fc" value={draft.upload_options.survey_method} onChange={e => update('upload_options', 'survey_method', e.target.value)}><option value="">روش نقشه‌برداری را انتخاب کنید</option>{draft.upload_options.survey_method && !SURVEY_METHODS.includes(draft.upload_options.survey_method) && <option value={draft.upload_options.survey_method} disabled hidden>مقدار قبلی: {draft.upload_options.survey_method}</option>}{SURVEY_METHODS.map(method => <option key={method} value={method}>{method}</option>)}</select></div>
        <div className="fg"><label className="fl" htmlFor="utm-zone">Zone UTM</label><input id="utm-zone" className="fc" inputMode="numeric" value={draft.upload_options.utm_zone} onChange={e => update('upload_options', 'utm_zone', e.target.value)} /></div>
        <div className="fg"><label className="fl" htmlFor="hemisphere">نیمکره</label><select id="hemisphere" className="fc" value={draft.upload_options.hemisphere} onChange={e => update('upload_options', 'hemisphere', e.target.value)}><option value="N">شمالی</option><option value="S">جنوبی</option></select></div>
        <div className="fg"><label className="fl" htmlFor="north-deviation">انحراف از شمال (۹۰- تا ۹۰ درجه)</label><input id="north-deviation" className="fc" inputMode="decimal" value={draft.upload_options.north_deviation} onChange={e => update('upload_options', 'north_deviation', e.target.value)} /></div>
      </div><div className="alert al-info mb16">تحلیل مکانی نمایشی است. حدود، مساحت‌ها و اطلاعات فرم از روی DXF به‌روزرسانی نمی‌شوند.</div>
        <div className="fua" onDragOver={e => e.preventDefault()} onDrop={e => {e.preventDefault(); processFile(e.dataTransfer.files[0])}}><button className="btn btn-outline" onClick={() => inputRef.current?.click()}>انتخاب یا جایگزینی فایل DXF</button><p>{draft.file ? `${draft.file.name}${draft.file.size ? ` · ${draft.file.size} KB` : ''}` : 'فایل را اینجا رها کنید؛ حداکثر ۵۰ مگابایت'}</p></div>
        <input ref={inputRef} type="file" accept=".dxf" hidden onChange={e => {processFile(e.target.files[0]); e.target.value = ''}} />
      </div></div>
      <div className="card mb20"><div className="card-hd"><div className="card-title">عکس‌های محل</div></div><div className="card-bd">
        <div className="flex gap8"><button className="btn btn-outline" onClick={() => galleryRef.current?.click()}>انتخاب عکس</button><button className="btn btn-outline" onClick={() => cameraRef.current?.click()}>گرفتن عکس</button></div>
        <input ref={galleryRef} type="file" accept="image/*" multiple hidden onChange={e => {addPhotos(e.target.files); e.target.value = ''}} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={e => {addPhotos(e.target.files); e.target.value = ''}} />
        <div className="photo-editor-grid">{draft.photos.map((photo, i) => <div className="photo-editor" key={`${photo.id || photo.name}-${i}`}>
          <img src={photo.url} alt={photo.name} /><p>{photo.name}</p>
          <label className="fl">عنوان<input className="fc" aria-label={`عنوان عکس ${i + 1}`} value={photo.title} onChange={e => updateRow('photos', i, 'title', e.target.value)} /></label>
          <label className="fl">توضیحات<input className="fc" aria-label={`توضیحات عکس ${i + 1}`} value={photo.description} onChange={e => updateRow('photos', i, 'description', e.target.value)} /></label>
          <button className="btn btn-sm btn-danger" onClick={() => onChange(prev => ({...prev, photos: prev.photos.filter((_, index) => index !== i)}))}>حذف عکس</button>
        </div>)}</div>
      </div></div>
      <div className="card mb20"><div className="card-hd"><div className="card-title">اطلاعات بازدید</div></div><div className="card-bd">
        <label className="form-check"><input type="checkbox" checked={draft.visit.is_done} onChange={e => onChange(prev => ({...prev, visit: {...prev.visit, is_done: e.target.checked, done_date: e.target.checked ? prev.visit.done_date : ''}}))} /> بازدید انجام شده است</label>
        <div className="fg"><label className="fl" htmlFor="visit-date">تاریخ انجام بازدید (شمسی)</label><input id="visit-date" className="fc" disabled={!draft.visit.is_done} placeholder="1405/07/25" value={draft.visit.done_date} onChange={e => update('visit', 'done_date', e.target.value)} /></div>
        <div className="fg"><label className="fl" htmlFor="visit-description">شرح بازدید</label><textarea id="visit-description" className="fc" rows={3} value={draft.visit.description} onChange={e => update('visit', 'description', e.target.value)} /></div>
      </div></div>
    </>}
    <datalist id="legal-uses">{LAND_USES.map(v => <option key={v} value={v} />)}</datalist><datalist id="property-types">{PROPERTY_TYPES.map(v => <option key={v} value={v} />)}</datalist><datalist id="actual-uses">{ACTUAL_USES.map(v => <option key={v} value={v} />)}</datalist>
    {error && <div className="alert al-warn mb16" role="alert">{error}</div>}
    <div className="form-actions"><button className="btn btn-outline" onClick={onCancel}>بازگشت به کارتابل</button><button className="btn btn-primary" onClick={analyze}>تحلیل نمایشی و بازبینی ←</button></div>
  </section>
}
