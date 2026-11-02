// Optional real-browser QA. Uses disposable test storage and starts its own servers.
// npm install --no-save playwright; npx playwright install chromium
// node tests/browser_smoke.cjs
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const {spawn} = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const root=path.resolve(__dirname,'..'), children=[], logs=[]
let browser
const wait=ms=>new Promise(r=>setTimeout(r,ms))
function start(command,args) {
  const child=spawn(command,args,{cwd:root,stdio:['ignore','pipe','pipe']});children.push(child)
  child.stdout.on('data',d=>logs.push(d.toString()));child.stderr.on('data',d=>logs.push(d.toString()))
  return child
}
async function ready(url) {for(let i=0;i<100;i++){try{if((await fetch(url)).ok)return}catch{}await wait(100)}throw Error('Server not ready: '+url+'\n'+logs.join('').slice(-3000))}
;(async()=>{
  start(process.env.PYTHON || 'python3',['tests/serve_fixture.py'])
  start(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','3000','--strictPort'])
  await Promise.all([ready('http://127.0.0.1:8000/api/health'),ready('http://127.0.0.1:3000')])
  browser=await chromium.launch({headless:true,...(process.env.KROKY_CHROMIUM_EXECUTABLE?{executablePath:process.env.KROKY_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})})
  const context=await browser.newContext({viewport:{width:1366,height:900}})
  // Exercise the offline map fallback; source geometry and form data still render.
  await context.route('**/*',route=>route.request().url().startsWith('http://127.0.0.1:3000')?route.continue():route.abort())
  const page=await context.newPage(), errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  let saves=0
  page.on('request',r=>{if(r.method()==='POST' && /\/submit$/.test(r.url()))saves++})
  const login=async username=>{
    await page.getByPlaceholder('مثال: tamizi').fill(username)
    await page.getByPlaceholder('رمز عبور',{exact:true}).fill('1234')
    await page.getByRole('button',{name:'← ورود به سامانه',exact:true}).click()
    await page.getByPlaceholder('کد ۶ رقمی (نمونه: ۱۲۳۴۵۶)').fill('123456')
    await page.getByRole('button',{name:'✓ تأیید و ورود به سامانه',exact:true}).click()
    await page.getByRole('button',{name:'⇥ خروج',exact:true}).waitFor()
  }
  const screenshot=async(name,locator)=>{
    if(!process.env.KROKY_QA_DIR)return
    fs.mkdirSync(process.env.KROKY_QA_DIR,{recursive:true})
    const hideChrome = locator ? await page.addStyleTag({content:'.desktop-topbar,.form-actions{visibility:hidden!important}'}) : null
    await (locator||page).screenshot({path:path.join(process.env.KROKY_QA_DIR,name+'.png'),fullPage:false})
    if (hideChrome) await hideChrome.evaluate(node=>node.remove())
  }
  await page.goto('http://127.0.0.1:3000')
  await login('tamizi')
  await page.getByRole('button',{name:'📤 بارگذاری کروکی',exact:true}).first().waitFor()
  assert.equal(await page.locator('.desktop-sidebar').count(),1)
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
  await screenshot('dashboard-desktop')
  await page.getByRole('button',{name:'📤 بارگذاری کروکی',exact:true}).first().click()
  for(const [key,v] of Object.entries({city:'مشهد',land_name:'ملک‌آباد',main_registration:'۲۳۴',property_type:'آپارتمان',legal_land_use:'مسکونی',total_area:'۲۰۰',land_share_area:'۶۲٫۹۱',address:'مشهد، رضاشهر، رضوی ۴۲',description:'دارای یک واحد آپارتمان مسکونی واقع در طبقه سوم؛ حدود و مساحت مطابق سند اعیان وارد شد.',floor_number:'۳',municipal_number:'۳۴',density:'متوسط',land_status:'آپارتمان مسکونی',survey_date:'1405/07/25'})) await page.locator('#info-'+key).fill(v)
  for(const [key,v] of Object.entries({region:'۹',district:'۳',block:'۲۰۸',main_parcel:'۲۸',sub_parcel:'۰',unit:'۴'}))await page.locator('#info-'+key).fill(v)
  const positions=await page.locator('.audit-code-parts input').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().top))
  assert.equal(new Set(positions.map(Math.round)).size,1,'Audit code parts must share one desktop row')
  await screenshot('form-desktop')
  await page.setViewportSize({width:1920,height:1080})
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
  await page.setViewportSize({width:1366,height:900})
  await page.getByRole('tab',{name:'اطلاعات حدود',exact:true}).click()
  const neighbors=['قطعه ۱۴','قطعه ۲۹','خیابان ۱۰ متری','قطعه ۲۷']
  for(let i=1;i<=4;i++){await page.getByLabel(`neighbor ردیف ${i}`,{exact:true}).fill(neighbors[i-1]);await page.getByLabel(`length ردیف ${i}`,{exact:true}).fill(i%2?'۸':'۲۵')}
  await page.getByRole('tab',{name:'وضعیت زمین و بهره‌برداری',exact:true}).click()
  await page.getByRole('button',{name:'افزودن ردیف',exact:true}).click()
  await page.getByLabel('use بهره‌برداری 1',{exact:true}).fill('آپارتمان مسکونی')
  await page.getByLabel('area بهره‌برداری 1',{exact:true}).fill('۲۰۰')
  await page.getByLabel('description بهره‌برداری 1',{exact:true}).fill('طبقه سوم')
  await page.getByRole('tab',{name:'فایل‌ها و بازدید',exact:true}).click()
  const methods=await page.locator('#survey-method option').evaluateAll(nodes=>nodes.filter(n=>n.value).map(n=>n.value))
  assert.deepEqual(methods,['مستقیم زمینی(مساحی)','برداشت GPS-RTK','gps دستی','دوربین نقشه برداری','تصاویر پهپادی','تصاویر هوایی','تصاویر ماهواره ای'])
  await page.locator('#survey-method').selectOption('برداشت GPS-RTK')
  const dxf=Buffer.from('0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n')
  await page.locator('input[accept=".dxf"]').setInputFiles({name:'parcel.dxf',mimeType:'application/dxf',buffer:dxf})
  assert.equal(saves,0)
  await page.getByRole('tab',{name:'اطلاعات کروکی',exact:true}).click()
  assert.equal(await page.locator('#info-total_area').inputValue(),'۲۰۰')
  await page.getByRole('button',{name:'تحلیل نمایشی و بازبینی ←',exact:true}).click()
  await page.locator('[data-testid="kroky-sheet"]').waitFor()
  assert.equal(await page.evaluate(()=>scrollY),0,'The report must open from the top')
  assert.ok((await page.locator('.kroky-sheet').textContent()).includes('۹/۳/۲۰۸/۲۸/۰/۴'))
  assert.ok((await page.locator('.kroky-sheet').textContent()).includes('۶۲٫۹۱'))
  assert.ok((await page.locator('.kroky-sheet').textContent()).includes('برداشت GPS-RTK'))
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false)
  await screenshot('preview-desktop')
  await screenshot('kroky-sheet',page.locator('.kroky-sheet'))
  await page.getByRole('button',{name:'ویرایش اطلاعات',exact:true}).click()
  assert.equal(await page.locator('#info-total_area').inputValue(),'۲۰۰')
  assert.equal(await page.locator('#info-block').inputValue(),'۲۰۸')
  await page.getByRole('button',{name:'تحلیل نمایشی و بازبینی ←',exact:true}).click()
  await page.getByRole('button',{name:'ثبت اطلاعات و ارسال به کارشناس مسئول ←',exact:true}).click()
  await page.getByText('کروکی با موفقیت ارسال شد',{exact:true}).waitFor()
  assert.equal(saves,1)
  await page.getByRole('button',{name:'⇥ خروج',exact:true}).click()
  await login('masoul')
  await page.getByRole('button',{name:'👁 مشاهده فرم',exact:true}).first().click()
  await page.locator('.review-modal .kroky-sheet').waitFor()
  assert.ok((await page.locator('.review-modal .kroky-sheet').textContent()).includes('۶۲٫۹۱'))
  await screenshot('expert-preview')
  await page.getByRole('button',{name:'✓ تأیید و آماده‌سازی برای انتقال',exact:true}).click()
  const response=await context.request.get('http://127.0.0.1:3000/api/integration/kroky',{headers:{'X-Integration-Key':'test-service-key'}})
  const record=(await response.json()).records[0]
  assert.equal(record.information.block,'۲۰۸')
  assert.equal(record.upload_options.survey_method,'برداشت GPS-RTK')
  assert.equal(record.ready_for_transfer,true)
  assert.equal(record.siagh.kroky_number,null)
  assert.deepEqual(errors,[])
  await browser.close()
  console.log('Browser QA passed: desktop widths 1366/1920, grouped code, seven options, live report, edit preservation, save/review/approval/API.')
})().catch(error=>{console.error(error);console.error(logs.join('').slice(-3000));process.exitCode=1}).finally(async()=>{await browser?.close().catch(()=>{});for(const child of children)child.kill('SIGTERM')})
