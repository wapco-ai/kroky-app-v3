import { normDigits } from './store.js'

export const DIRECTIONS = { N: 'شمال', E: 'شرق', S: 'جنوب', W: 'غرب' }
export const AUDIT_FIELDS = [['region','منطقه'],['district','حوزه'],['block','بلوک'],['main_parcel','قطعه اصلی'],['sub_parcel','قطعه فرعی'],['unit','واحد']]
export const SURVEY_METHODS = ['مستقیم زمینی(مساحی)', 'برداشت GPS-RTK', 'gps دستی', 'دوربین نقشه برداری', 'تصاویر پهپادی', 'تصاویر هوایی', 'تصاویر ماهواره ای']
export function auditCode(information = {}, fallback = '') {
  const parts = AUDIT_FIELDS.map(([key]) => normDigits(information[key]).trim())
  return parts.some(Boolean) ? parts.map(v => v || '—').join('/') : fallback || '—'
}
export const FIELD_GROUPS = [
  ['اطلاعات برداشت و موقعیت', [
    ['survey_date', 'تاریخ نقشه‌برداری (شمسی)'], ['management_area', 'حوزه مدیریت'],
    ['city', 'شهر', 'text', true], ['land_name', 'نام اراضی / بازار', 'text', true], ['alley', 'نام کوی'],
    ['region', 'منطقه'], ['district', 'حوزه'], ['block', 'بلوک'],
    ['main_parcel', 'قطعه اصلی'], ['sub_parcel', 'قطعه فرعی'], ['unit', 'واحد'],
  ]],
  ['مشخصات ثبتی ملک', [
    ['legal_land_use', 'کاربری قانونی', 'text', true], ['density', 'تراکم'],
    ['main_registration', 'پلاک ثبتی اصلی', 'text', true], ['sub_registration_1', 'پلاک ثبتی فرعی ۱'],
    ['sub_registration_2', 'پلاک ثبتی فرعی ۲'], ['sub_registration_3', 'پلاک ثبتی فرعی ۳'],
    ['sub_registration_4', 'پلاک ثبتی فرعی ۴'], ['class_file', 'کد کلاسه'],
    ['property_type', 'نوع ملک', 'text', true], ['property_location', 'موقعیت ملک'],
    ['land_status', 'وضعیت زمین'],
    ['old_parcel', 'قطعه قدیم'], ['old_block', 'بلوک قدیم'],
  ]],
  ['مساحت‌ها و مشخصات تکمیلی', [
    ['total_area', 'مساحت کل (مترمربع)', 'number'], ['in_road_area', 'مساحت در مسیر (مترمربع)', 'number'],
    ['land_share_area', 'مساحت سهم عرصه (مترمربع)', 'number', true], ['common_share_area', 'مساحت سهم مشاع (مترمربع)', 'number'],
    ['common_share', 'سهم مشاع'], ['building_area', 'مساحت اعیانی (مترمربع)', 'number'],
    ['useful_area', 'مساحت مفید (مترمربع)', 'number'], ['floor_number', 'شماره طبقه'],
    ['address', 'آدرس', 'textarea', true], ['municipal_number', 'پلاک شهرداری'],
    ['frontage', 'جهت ملک'], ['gis_area', 'منطقه GIS'],
    ['letter_number', 'شماره درخواست / نامه'], ['letter_date', 'تاریخ درخواست / نامه (شمسی)'],
    ['correction_land', 'اصلاحات اراضی / مازاد'], ['description', 'شرح', 'textarea'],
    ['land_information', 'اطلاعات اراضی', 'textarea'],
    ['cartographer', 'کارتوگراف'], ['controller', 'کنترل‌کننده'], ['department_head', 'رئیس اداره'],
  ]],
]
export const LAND_USES = ['مسکونی', 'تجاری', 'اداری', 'صنعتی', 'باغ', 'زراعی', 'مختلط', 'آموزشی', 'درمانی', 'سایر']
export const PROPERTY_TYPES = ['قطعه اصلی', 'قطعه تفکیکی', 'آپارتمان', 'واحد تجاری', 'زمین']
export const ACTUAL_USES = ['ساختمان', 'زمین بایر', 'آپارتمان مسکونی', 'باغ', 'زراعت', 'تجاری', 'صنعتی']

export function emptyDraft(request) {
  const existing = request?.kroky || {}
  const information = Object.fromEntries(FIELD_GROUPS.flatMap(([, fields]) => fields.map(([key]) => [key, ''])))
  const codeParts = String(request?.auditCode || '').split('/')
  if (codeParts.length === 6) ['region', 'district', 'block', 'main_parcel', 'sub_parcel', 'unit'].forEach((key, i) => { information[key] = codeParts[i] })
  Object.assign(information, {kind: 'kroky', legal_reprint: false, address: request?.address || '',
    class_file: request?.source?.classFile || '', letter_number: request?.requestNo || '',
    legal_land_use: LAND_USES.includes(request?.landUse) ? request.landUse : ''}, existing.information || {})
  if (!existing.information) {
    information.address = existing.address || information.address
    information.legal_land_use = existing.landUse || information.legal_land_use
    information.description = existing.notes || ''
  }
  return {schema_version: '1.0', information,
    boundaries: existing.boundaries || Object.keys(DIRECTIONS).map(direction => ({direction, neighbor: '', length: '', road_width: ''})),
    land_uses: existing.land_uses || [],
    upload_options: {survey_method: '', utm_zone: 40, hemisphere: 'N', north_deviation: 0, ...(existing.upload_options || {}), update_boundaries: false, analysis_mode: 'demo'},
    visit: {description: '', is_done: false, done_date: '', ...(existing.visit || {})},
    file: existing.file || null, photos: (existing.photos || []).map(p => ({...p, title: p.title || 'عکس محل', description: p.description || ''})),
  }
}

export const parseNumber = value => Number(normDigits(value).replace(/[,٬]/g, '').replace(/[٫/]/g, '.'))
const validNumber = value => value !== '' && value != null && Number.isFinite(parseNumber(value)) && parseNumber(value) >= 0
export function validateDraft(draft) {
  for (const [, fields] of FIELD_GROUPS) for (const [key, label, type, required] of fields) {
    const value = draft.information[key]
    if (required && !String(value ?? '').trim()) return `فیلد «${label}» را تکمیل کنید.`
    if (type === 'number' && value !== '' && value != null && !validNumber(value)) return `مقدار «${label}» باید عدد غیرمنفی باشد.`
  }
  if (!draft.file) return 'فایل DXF را انتخاب کنید.'
  if (!SURVEY_METHODS.includes(draft.upload_options.survey_method)) return 'روش نقشه‌برداری را از فهرست انتخاب کنید.'
  if (new Set(draft.boundaries.map(b => b.direction)).size !== 4) return 'اطلاعات هر چهار جهت حدود اربعه الزامی است.'
  for (const b of draft.boundaries) {
    if (!b.neighbor.trim() || !validNumber(b.length) || parseNumber(b.length) <= 0) return 'مجاور و طول مثبت را برای تمام ردیف‌های حدود وارد کنید.'
    if (b.road_width !== '' && b.road_width != null && !validNumber(b.road_width)) return 'عرض معبر باید عدد غیرمنفی باشد.'
  }
  for (const use of draft.land_uses) if (!use.use.trim() || !validNumber(use.area)) return 'نوع بهره‌برداری و مساحت هر ردیف را تکمیل کنید.'
  if (draft.visit.is_done && !draft.visit.done_date) return 'تاریخ انجام بازدید را وارد کنید.'
  return ''
}
