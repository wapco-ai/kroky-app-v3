// Actual React components and events; HTTP is stubbed here. Real HTTP/ORM is
// covered separately by pytest. This does not assert browser pixel layout.
const {JSDOM} = require('jsdom')
const assert = require('node:assert/strict')
const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url:'http://localhost:3000', pretendToBeVisual:true})
for (const key of ['window','document','navigator','sessionStorage','FormData','FileReader','File','HTMLElement','Event','MouseEvent']) {
  Object.defineProperty(globalThis, key, {value:dom.window[key], configurable:true, writable:true})
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
dom.window.scrollTo = () => {}
const React = require('react')
const {createRoot} = require('react-dom/client')
const act = React.act || require('react-dom/test-utils').act
const App = require('../src/App.jsx').default

const surveyor = {username:'tamizi',name:'نقشه‌بردار آزمایشی',role:'surveyor',points:920,tier:'senior'}
const expert = {username:'masoul',name:'کارشناس آزمایشی',role:'expert'}
let active = surveyor
let mutations = 0
const request = {id:901,requestNo:'1001',auditCode:'1/2/3/4/5/6',address:'نشانی اولیه',title:'نشانی اولیه',regPlak:'طرق',parcel:'1',area:0,landUse:'',status:'assigned',assignedTo:'tamizi',submitted:false,kroky:null}
globalThis.fetch = async (url, options = {}) => {
  let data
  if (url === '/api/auth/validate') data = {user:JSON.parse(options.body).username === 'masoul' ? expert : surveyor}
  else if (url === '/api/auth/login') {active = JSON.parse(options.body).username === 'masoul' ? expert : surveyor; data = {user:active,accessToken:'test-token'}}
  else if (url === '/api/auth/me') data = {user:active}
  else if (url === '/api/bootstrap') data = {users:[surveyor,expert],requests:[request],readiness:{},plaks:['طرق']}
  else if (url === '/api/requests/901/submit') {
    mutations++
    const payload = JSON.parse(options.body.get('metadata'))
    assert.equal(payload.information.total_area,'۲۰۰')
    assert.equal(payload.boundaries.length,4)
    assert.equal(payload.land_uses[0].use,'ساختمان')
    assert.equal(payload.upload_options.update_boundaries,false)
    assert.equal(options.body.get('dxf').name,'replacement.dxf')
    request.kroky = {...payload,file:{name:'replacement.dxf'},photos:[],sentAt:new Date().toISOString()}
    request.status = 'submitted'; request.submitted = true; data = request
  } else if (url === '/api/requests/901/approve') {request.status='approved';data={readyForTransfer:true,trackingNo:null}}
  else throw new Error('Unexpected request '+url)
  return {status:200,ok:true,json:async()=>JSON.parse(JSON.stringify(data))}
}
const tick = ms => new Promise(resolve => setTimeout(resolve,ms))
const button = label => {
  const match = [...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label)
  assert.ok(match, 'Missing button: '+label); return match
}
const click = async label => {await act(async()=>{button(label).dispatchEvent(new MouseEvent('click',{bubbles:true}));await tick(0)})}
const fill = async (selector, value) => {
  const node = document.querySelector(selector); assert.ok(node, 'Missing input '+selector)
  const proto = node.tagName === 'SELECT' ? dom.window.HTMLSelectElement.prototype : node.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype
  await act(async()=>{Object.getOwnPropertyDescriptor(proto,'value').set.call(node,value);node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input',{bubbles:true}));await tick(0)})
}
const login = async name => {
  await fill('input[placeholder="مثال: tamizi"]',name)
  await fill('input[type="password"]','1234')
  await act(async()=>{document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await tick(0)})
  await fill('input[maxlength="6"]','123456')
  await act(async()=>{document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await tick(0)})
}
;(async()=>{
  const root = createRoot(document.querySelector('#root'))
  await act(async()=>{root.render(React.createElement(App));await tick(0)})
  await login('tamizi')
  await click('📤 بارگذاری کروکی')
  assert.equal(document.querySelectorAll('.audit-code-field input').length,6)
  assert.equal(document.querySelectorAll('.desktop-sidebar').length,1)
  for(const [key,value] of Object.entries({city:'مشهد',land_name:'ملک‌آباد',main_registration:'۲۳۴',property_type:'قطعه اصلی',legal_land_use:'مسکونی',total_area:'۲۰۰',land_share_area:'۶۲٫۹۱',description:'شرح آزمون رابط'})) await fill('#info-'+key,value)
  await click('اطلاعات حدود')
  for(let i=1;i<=4;i++) {await fill(`[aria-label="neighbor ردیف ${i}"]`,'مجاور '+i);await fill(`[aria-label="length ردیف ${i}"]`,'۸')}
  await click('وضعیت زمین و بهره‌برداری')
  await click('افزودن ردیف')
  await fill('[aria-label="use بهره‌برداری 1"]','ساختمان')
  await fill('[aria-label="area بهره‌برداری 1"]','۲۰۰')
  await click('فایل‌ها و بازدید')
  assert.equal(document.querySelector('#survey-method').tagName,'SELECT')
  assert.deepEqual([...document.querySelector('#survey-method').options].filter(o=>o.value).map(o=>o.value),['مستقیم زمینی(مساحی)','برداشت GPS-RTK','gps دستی','دوربین نقشه برداری','تصاویر پهپادی','تصاویر هوایی','تصاویر ماهواره ای'])
  await fill('#survey-method','برداشت GPS-RTK')
  const input = document.querySelector('input[accept=".dxf"]')
  for(const name of ['first.dxf','replacement.dxf']) {
    Object.defineProperty(input,'files',{value:[new File(['DXF demo'],name,{type:'application/dxf'})],configurable:true})
    await act(async()=>{input.dispatchEvent(new Event('change',{bubbles:true}));await tick(0)})
  }
  assert.equal(mutations,0,'File selection must not submit data')
  await click('اطلاعات کروکی')
  assert.equal(document.querySelector('#info-total_area').value,'۲۰۰')
  assert.equal(document.querySelector('#info-land_share_area').value,'۶۲٫۹۱')
  await click('تحلیل نمایشی و بازبینی ←')
  await act(async()=>{await tick(1600)})
  assert.ok(document.body.textContent.includes('شرح آزمون رابط'))
  assert.ok(document.querySelector('[data-testid="kroky-sheet"]'))
  assert.ok(document.querySelector('.sheet-boundaries').textContent.includes('مجاور ۱'))
  assert.ok(document.querySelector('.sheet-disclaimer').textContent.includes('تحلیل DXF نمایشی است'))
  assert.ok(document.querySelector('.sheet-sketch-caption').textContent.includes('نمای شماتیک'))
  await click('ویرایش اطلاعات')
  assert.equal(document.querySelector('#info-description').value,'شرح آزمون رابط')
  await click('اطلاعات حدود')
  assert.equal(document.querySelector('[aria-label="neighbor ردیف 1"]').value,'مجاور 1')
  await click('تحلیل نمایشی و بازبینی ←')
  await act(async()=>{await tick(1600)})
  await click('ثبت اطلاعات و ارسال به کارشناس مسئول ←')
  assert.equal(mutations,1)
  assert.ok(document.body.textContent.includes('کروکی با موفقیت ارسال شد'))
  await click('⇥ خروج')
  await login('masoul')
  await click('👁 مشاهده فرم')
  assert.ok(document.body.textContent.includes('شرح آزمون رابط'))
  assert.ok(!document.querySelector('img[src="/1.jpg"]'))
  await click('✓ تأیید و آماده‌سازی برای انتقال')
  assert.equal(request.status,'approved')
  await act(async()=>root.unmount())
  console.log('React DOM smoke passed: unchanged tables on DXF selection, retained edits, real review, submit payload, approval.')
  process.exit(0)
})().catch(error=>{console.error(error);process.exit(1)})
