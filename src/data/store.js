// ════════════════════════════════════════════════════════════════════
//  توابع نمایشی و ثابت‌های رابط؛ داده عملیاتی از API دریافت می‌شود.
//  شامل: پلاک‌های ثبتی، رده‌بندی کاربران، کاربران اولیه، درخواست‌ها و
//  توابع کمکی مکانی (point-in-polygon و تقسیم فضایی هوشمند).
// ════════════════════════════════════════════════════════════════════

// ── تبدیل اعداد لاتین به فارسی ──
const FA = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹']
export const toFa = (v) => String(v).replace(/\d/g, d => FA[+d])

// ── یکسان‌سازی ارقام فارسی/عربی به لاتین (برای جستجوی مقاوم) ──
// تا کاربر بتواند چه با ارقام فارسی و چه لاتین جستجو کند.
export const normDigits = (v) => String(v ?? '')
  .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))

// ── پلاک‌های ثبتی (با مرکز تقریبی در مشهد مقدس) ──
export const PLAKS = [
  { name: 'طرق',       lat: 36.2745, lng: 59.4905 },
  { name: 'آبکوه',     lat: 36.3155, lng: 59.5750 },
  { name: 'احمدآباد',  lat: 36.2985, lng: 59.5955 },
  { name: 'سمزقند',    lat: 36.3450, lng: 59.5205 },
  { name: 'ملک‌آباد',  lat: 36.3105, lng: 59.5555 },
]
export const PLAK_NAMES = PLAKS.map(p => p.name)
export const plakCenter = (name) => PLAKS.find(p => p.name === name) || PLAKS[0]

// ── رده‌بندی نقشه‌بردار بر اساس امتیاز ──
export const TIERS = {
  regular: { key: 'regular', label: 'عادی',    min: 0,   color: '#5A7A5A', bg: '#EDF3ED' },
  pro:     { key: 'pro',     label: 'حرفه‌ای', min: 300, color: '#1565C0', bg: '#E3F2FD' },
  senior:  { key: 'senior',  label: 'ارشد',    min: 700, color: '#E65100', bg: '#FFF3E0' },
}
export const TIER_ORDER = ['regular', 'pro', 'senior']
export const tierFromPoints = (p) => (p >= 700 ? 'senior' : p >= 300 ? 'pro' : 'regular')
export const tierLabel = (key) => (TIERS[key]?.label || 'عادی')

// ── وضعیت گردش‌کار درخواست ──
// unassigned : در کارتابل کارشناس مسئول، هنوز نقشه‌بردار تعیین نشده
// assigned   : ارجاع‌شده به نقشه‌بردار، منتظر بارگذاری کروکی
// submitted  : نقشه‌بردار کروکی را به کارتابل کارشناس مسئول ارسال کرده
// approved   : تأیید محلی؛ آماده دریافت توسط سرویس انتقال
export const WF = {
  unassigned: { key: 'unassigned', label: 'بدون کارشناس', cls: 'b-pending'   },
  assigned:   { key: 'assigned',   label: 'ارجاع‌شده',     cls: 'b-reviewing' },
  submitted:  { key: 'submitted',  label: 'در انتظار تأیید', cls: 'b-reviewing' },
  approved:   { key: 'approved',   label: 'آماده انتقال',  cls: 'b-approved'  },
}
export const wfLabel = (k) => (WF[k]?.label || k)
export const wfCls   = (k) => (WF[k]?.cls   || 'b-reviewing')

// رنگ مارکر نقشه بر اساس وضعیت گردش‌کار
export const STATUS_COLORS = {
  unassigned: '#E65100', assigned: '#1565C0', submitted: '#7B1FA2', approved: '#2E7D32',
}
export const BADGE_CLASS = {
  reviewing: 'b-reviewing', approved: 'b-approved', pending: 'b-pending', rejected: 'b-rejected',
}

// ── کاربران اولیه ──
export const SEED_USERS = [
  { username: 'admin',     password: 'admin', name: 'مدیر سامانه',  role: 'admin',
    roleLabel: 'سرپرست فنی' },
  { username: 'masoul',    password: '1234',  name: 'حسین رحیمی',   role: 'expert',
    roleLabel: 'کارشناس مسئول' },
  { username: 'tamizi',    password: '1234',  name: 'ابراهیم تمیزی', role: 'surveyor',
    points: 920, tier: 'senior' },
  { username: 'nikzad',    password: '1234',  name: 'رضا نیک‌زاد',   role: 'surveyor',
    points: 760, tier: 'senior' },
  { username: 'ahmadi',    password: '1234',  name: 'محمد احمدی',    role: 'surveyor',
    points: 540, tier: 'pro' },
  { username: 'mohammadi', password: '1234',  name: 'علی محمدی',     role: 'surveyor',
    points: 120, tier: 'regular' },
]

// ── اعلام آمادگی اولیه (نقشه‌بردار → پلاک‌های ثبتی) ──
export const SEED_READINESS = {
  tamizi: ['طرق', 'آبکوه'],
  nikzad: ['طرق', 'سمزقند'],
  ahmadi: ['احمدآباد', 'ملک‌آباد'],
}

// ════════════════════════════════════════════════════════════════════
//  تولید درخواست‌های نمونه (به‌صورت قطعی/seeded تا با هر بارگذاری ثابت بماند)
// ════════════════════════════════════════════════════════════════════
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20405)

const LAND_USES = ['مسکونی', 'تجاری', 'اداری', 'مختلط', 'باغ']
const STREETS = ['امام رضا', 'وکیل‌آباد', 'احمدآباد', 'شریعتی', 'کوهسنگی',
                 'ملک‌الشعرا', 'سناباد', 'هفت‌تیر', 'نخریسی', 'دانشگاه']

let _seq = 14523
function makeRequest({ plak, status = 'unassigned', assignedTo = null, submitted = false }) {
  const c = plakCenter(plak)
  const lat = c.lat + (rnd() - 0.5) * 0.018
  const lng = c.lng + (rnd() - 0.5) * 0.024
  const no  = _seq++
  const area = Math.round((rnd() * 480 + 150) * 10) / 10
  const street = STREETS[Math.floor(rnd() * STREETS.length)]
  const pelak  = Math.floor(rnd() * 220) + 1
  const audit  = Array.from({ length: 5 }, () => Math.floor(rnd() * 9) + 1).join('-')
  const day    = Math.floor(rnd() * 28) + 1
  return {
    id: no,
    requestNo:   toFa(no),
    requestDate: `۱۴۰۵/۰۲/${toFa(String(day).padStart(2, '0'))}`,
    auditCode:   toFa(audit),
    title:   `خیابان ${street}، پلاک ${toFa(pelak)}`,
    address: `خیابان ${street}، پلاک ${toFa(pelak)}، ${plak}، مشهد مقدس`,
    regPlak: plak,
    parcel:  `${toFa(Math.floor(rnd() * 800) + 100)}/${toFa(Math.floor(rnd() * 40) + 1)}`,
    area,
    landUse: LAND_USES[Math.floor(rnd() * LAND_USES.length)],
    status,            // وضعیت گردش‌کار
    assignedTo,        // username نقشه‌بردار
    submitted,         // آیا کروکی ارسال شده؟
    kroky: null,       // داده‌های کروکی پس از بارگذاری
    trackingNo: null,  // شماره پیگیری سیاق پس از تأیید
    rejectReason: null,
    lat, lng,
  }
}

function buildSeed() {
  const list = []
  // طرق: ۲۰ درخواست بدون کارشناس (برای دموی ارجاع هوشمند)
  for (let i = 0; i < 20; i++) list.push(makeRequest({ plak: 'طرق' }))
  // آبکوه: ترکیبی
  list.push(makeRequest({ plak: 'آبکوه', status: 'assigned',  assignedTo: 'tamizi' }))
  list.push(makeRequest({ plak: 'آبکوه', status: 'assigned',  assignedTo: 'tamizi' }))
  list.push(makeRequest({ plak: 'آبکوه', status: 'submitted', assignedTo: 'tamizi', submitted: true }))
  list.push(makeRequest({ plak: 'آبکوه' }))
  list.push(makeRequest({ plak: 'آبکوه' }))
  // احمدآباد
  for (let i = 0; i < 4; i++) list.push(makeRequest({ plak: 'احمدآباد' }))
  list.push(makeRequest({ plak: 'احمدآباد', status: 'assigned', assignedTo: 'ahmadi' }))
  // سمزقند
  for (let i = 0; i < 3; i++) list.push(makeRequest({ plak: 'سمزقند' }))
  // ملک‌آباد
  list.push(makeRequest({ plak: 'ملک‌آباد', status: 'submitted', assignedTo: 'ahmadi', submitted: true }))
  list.push(makeRequest({ plak: 'ملک‌آباد' }))
  list.push(makeRequest({ plak: 'ملک‌آباد' }))
  list.push(makeRequest({ plak: 'ملک‌آباد' }))
  return list
}
export const SEED_REQUESTS = buildSeed()

// ════════════════════════════════════════════════════════════════════
//  توابع کمکی مکانی
// ════════════════════════════════════════════════════════════════════

// آزمون نقطه‌در‌چندضلعی (ray-casting). poly: آرایه [[lat,lng], ...]
export function pointInPolygon(pt, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const yi = poly[i][0], xi = poly[i][1]
    const yj = poly[j][0], xj = poly[j][1]
    const intersect = (yi > pt.lat) !== (yj > pt.lat) &&
      pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

// تقسیم فضایی هوشمند:
// درخواست‌ها را در راستای محور با بیشترین گستردگی مرتب و به k دستهٔ
// «پیوسته» تقسیم می‌کند. چون برش روی یک محور انجام می‌شود، محدودهٔ
// مکانی دسته‌ها هم‌پوشانی ندارد. مازاد به دسته‌های نخست اضافه می‌شود
// تا اختلاف حجم حداکثر یک واحد باشد (۲۰ ← ۱۰ و ۱۰).
export function spatialSplit(requests, k) {
  if (k <= 1) return [requests.slice()]
  if (requests.length === 0) return Array.from({ length: k }, () => [])
  const lons = requests.map(r => r.lng)
  const lats = requests.map(r => r.lat)
  const spreadLon = Math.max(...lons) - Math.min(...lons)
  const spreadLat = Math.max(...lats) - Math.min(...lats)
  const axis = spreadLon >= spreadLat ? 'lng' : 'lat'
  const sorted = [...requests].sort((a, b) => a[axis] - b[axis])
  const groups = Array.from({ length: k }, () => [])
  const per = Math.floor(sorted.length / k)
  const rem = sorted.length % k
  let idx = 0
  for (let g = 0; g < k; g++) {
    const count = per + (g < rem ? 1 : 0)
    for (let i = 0; i < count && idx < sorted.length; i++) groups[g].push(sorted[idx++])
  }
  return { groups, axis }
}
