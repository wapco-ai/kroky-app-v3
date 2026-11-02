import { useState } from 'react'
import { CircleMarker, MapContainer, Polygon, TileLayer } from 'react-leaflet'
import { auditCode, DIRECTIONS } from '../../data/krokyForm.js'
import { toFa } from '../../data/store.js'
import { reportGeometry } from '../../data/reportGeometry.js'

const value = v => v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? new Intl.NumberFormat('fa-IR',{useGrouping:false,maximumFractionDigits:9}).format(v) : toFa(v)
function Fact({label, children, wide = false}) { return <div className={`sheet-fact${wide ? ' sheet-fact-wide' : ''}`}><span>{label}:</span><strong>{children === '' || children == null ? '—' : children}</strong></div> }

function LocationMap({geometry}) {
  const [failed, setFailed] = useState(false)
  if (!geometry.center) return <div className="sheet-map-placeholder"><svg viewBox="0 0 80 80" width="50" aria-hidden="true"><path d="M10 18 30 10l20 8 20-8v52l-20 8-20-8-20 8Z M30 10v52 M50 18v52" fill="none" stroke="currentColor" strokeWidth="2"/></svg><span>موقعیت مکانی در پرونده ثبت نشده است</span></div>
  return <div className="sheet-map">
    <MapContainer center={geometry.center} zoom={17} zoomControl={false} scrollWheelZoom={false} dragging={false} doubleClickZoom={false} touchZoom={false} keyboard={false} style={{height:'100%',width:'100%'}}>
      <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" eventHandlers={{tileerror:()=>setFailed(true), tileload:()=>setFailed(false)}} />
      {geometry.rings.length > 0 && <Polygon positions={geometry.rings.map(ring=>ring.map(([x,y])=>[y,x]))} pathOptions={{color:'#b44e26',weight:2,fillColor:'#f7c740',fillOpacity:.65}} />}
      <CircleMarker center={geometry.center} radius={5} pathOptions={{color:'#fff',weight:2,fillColor:'#bc4b2a',fillOpacity:1}} />
    </MapContainer>
    <div className="sheet-map-caption">موقعیت پرونده مبدأ</div>
    {failed && <div className="sheet-map-unavailable">نقشه زمینه در دسترس نیست؛ موقعیت پرونده حفظ شده است</div>}
  </div>
}

function ParcelSketch({draft, geometry}) {
  const info=draft.information
  return <div className="sheet-sketch">
    <div className="sheet-sketch-caption">{geometry.hasSourceGeometry ? 'هندسه پرونده مبدأ' : 'نمای شماتیک · بدون مقیاس'}</div>
    <svg viewBox="0 0 460 410" role="img" aria-label={geometry.hasSourceGeometry ? 'ترسیم قطعه بر اساس هندسه پرونده مبدأ' : 'نمای شماتیک حدود؛ شکل واقعی ملک نیست'}>
      <path d={geometry.path || 'M215 75 L335 145 L225 335 L105 265 Z'} fill="#a6c4ec" fillRule="evenodd" stroke="#223851" strokeWidth="1.7" />
      <g transform="translate(414 62)"><path d="M0 22V-16M-7-4 0-18 7-4" fill="none" stroke="#344b47" strokeWidth="1.5"/><text y="-25" textAnchor="middle" fontSize="12">N</text></g>
      <text x="230" y="198" textAnchor="middle" fontSize="20" fill="#142a3a">{value(info.total_area)}</text>
      <text x="230" y="223" textAnchor="middle" fontSize="13" fill="#344e60">متر مربع</text>
    </svg>
    {Object.entries(DIRECTIONS).map(([direction,title])=>{
      const rows=(draft.boundaries || []).filter(row=>row.direction===direction)
      const row=rows[0]
      return <div className={`sheet-edge sheet-edge-${direction}`} key={direction}><span>{title}</span><strong title={row?.neighbor}>{row?.neighbor || '—'}{rows.length>1 && ` و ${toFa(rows.length-1)} ضلع دیگر`}</strong>{row && <small>{value(row.length)} متر</small>}</div>
    })}
    <div className="sheet-sketch-footnote">{geometry.hasSourceGeometry ? 'هندسه از پرونده مبدأ؛ متن و ابعاد از فرم کاربر' : 'این شکل صرفاً جانمایی حدود را نشان می‌دهد'}</div>
  </div>
}

export default function KrokySheet({request, draft, surveyorName, approverName}) {
  if (!draft?.information) return null
  const info=draft.information, options=draft.upload_options || {}, visit=draft.visit || {}
  const geometry=reportGeometry(request)
  const registration=[info.main_registration,...[1,2,3,4].map(i=>info[`sub_registration_${i}`])].filter(v=>v!=='' && v!=null).map(value).join(' / ') || '—'
  const identity=surveyorName || info.cartographer || '—'
  return <article className="kroky-sheet" aria-label="پیش‌نمایش کروکی" data-testid="kroky-sheet" dir="rtl">
    <header className="sheet-header"><img src="/logo.png" alt="آستان قدس رضوی"/><div><h2>آستان قدس رضوی</h2><p>اداره نقشه‌برداری</p></div><div className="sheet-draft-stamp">پیش‌نمایش محلی<span>{info.kind==='map' ? 'نقشه' : 'کروکی'} · درخواست {value(request?.requestNo)}</span></div></header>
    <div className="sheet-top">
      <div className="sheet-drawing"><ParcelSketch draft={draft} geometry={geometry}/></div>
      <div className="sheet-location"><LocationMap geometry={geometry}/><div className="sheet-location-facts">
        <div className="sheet-coordinates"><span>طول جغرافیایی: {geometry.center ? value(geometry.center[1].toFixed(6)) : '—'}</span><span>عرض جغرافیایی: {geometry.center ? value(geometry.center[0].toFixed(6)) : '—'}</span></div>
        <Fact label="Zone UTM">{value(options.utm_zone)} {options.hemisphere || ''}</Fact>
        <Fact label="آدرس">{value(info.address)}</Fact><Fact label="پلاک شهرداری">{value(info.municipal_number)}</Fact>
        <Fact label="شماره نامه">{value(info.letter_number)}</Fact><Fact label="تاریخ نامه">{value(info.letter_date)}</Fact>
        <Fact label="جهت ملک">{value(info.frontage)}</Fact><Fact label="منطقه GIS">{value(info.gis_area)}</Fact>
      </div></div>
    </div>
    <section className="sheet-section sheet-usage"><h3>نوع بهره‌برداری</h3>{draft.land_uses?.length ? draft.land_uses.map((row,i)=><p key={i}><b>{value(row.use)}</b>؛ مساحت {value(row.area)} متر مربع{row.description ? ` — ${row.description}` : ''}</p>) : <p>—</p>}</section>
    <section className="sheet-section sheet-facts-grid">
      <Fact label="کد ممیزی" wide><bdi dir="ltr">{value(auditCode(info,request?.auditCode))}</bdi></Fact>
      {[['کاربری قانونی',info.legal_land_use],['تراکم',info.density],['وضعیت زمین',info.land_status],['نوع ملک',info.property_type],['کلاسه',info.class_file],['موقعیت ملک',info.property_location],['قطعه قدیم',info.old_parcel],['بلوک قدیم',info.old_block]].map(([label,v])=><Fact key={label} label={label}>{value(v)}</Fact>)}
    </section>
    <section className="sheet-section sheet-facts-grid">
      <Fact label="شهر">{value(info.city)}</Fact><Fact label="نام اراضی / بازار">{value(info.land_name)}</Fact><Fact label="نام کوی">{value(info.alley)}</Fact>
      <Fact label="پلاک ثبتی" wide><bdi dir="ltr">{registration}</bdi></Fact><Fact label="حوزه مدیریت">{value(info.management_area)}</Fact>
      {[['مساحت کل (م²)',info.total_area],['مساحت سهم عرصه (م²)',info.land_share_area],['مساحت سهم مشاع (م²)',info.common_share_area],['سهم مشاع',info.common_share],['مساحت اعیانی (م²)',info.building_area],['مساحت مفید (م²)',info.useful_area],['مساحت در مسیر (م²)',info.in_road_area],['شماره طبقه',info.floor_number],['اصلاحات اراضی / مازاد',info.correction_land],['پرینت حقوقی',info.legal_reprint ? 'بله' : 'خیر']].map(([label,v])=><Fact key={label} label={label}>{value(v)}</Fact>)}
    </section>
    <section className="sheet-section sheet-boundaries"><h3>حدود اربعه زمین</h3><table><thead><tr><th>جهت</th><th>مجاور</th><th>به طول (متر)</th><th>عرض معبر (متر)</th></tr></thead><tbody>{(draft.boundaries || []).map((row,i)=><tr key={i}><td>{DIRECTIONS[row.direction]}</td><td>{value(row.neighbor)}</td><td>{value(row.length)}</td><td>{value(row.road_width)}</td></tr>)}</tbody></table></section>
    {(info.description || info.land_information) && <section className="sheet-section sheet-notes">{info.description && <Fact label="شرح" wide>{info.description}</Fact>}{info.land_information && <Fact label="اطلاعات اراضی" wide>{info.land_information}</Fact>}</section>}
    <section className="sheet-section sheet-facts-grid sheet-survey"><Fact label="روش نقشه‌برداری" wide>{value(options.survey_method)}</Fact><Fact label="تاریخ برداشت">{value(info.survey_date)}</Fact><Fact label="انحراف از شمال">{value(options.north_deviation)} درجه</Fact><Fact label="وضعیت بازدید">{visit.is_done ? 'انجام شده' : 'انجام نشده'}</Fact><Fact label="تاریخ بازدید">{value(visit.done_date)}</Fact>{visit.description && <Fact label="شرح بازدید" wide>{visit.description}</Fact>}</section>
    <footer className="sheet-signatures"><div><span>تهیه‌کننده</span><strong>{identity}</strong><small>کارتوگراف: {value(info.cartographer)}</small></div><div><span>تأییدکننده</span><strong>{approverName || 'در انتظار بررسی'}</strong><small>کنترل‌کننده: {value(info.controller)}<br/>رئیس اداره: {value(info.department_head)}</small></div><div className="sheet-siagh-numbers"><Fact label="تاریخ کروکی">تخصیص توسط سیاق</Fact><Fact label="شماره کروکی">تخصیص توسط سیاق</Fact><Fact label="شماره موقت">تخصیص توسط سیاق</Fact></div></footer>
    <div className="sheet-disclaimer">پیش‌نمایش اطلاعات واردشده؛ تحلیل DXF نمایشی است و این صفحه کروکی نهایی صادرشده توسط سیاق نیست.</div>
  </article>
}
