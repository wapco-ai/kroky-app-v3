import { tierLabel } from '../data/store.js'

const META = {home: 'کارتابل درخواست‌ها', upload: 'ثبت اطلاعات کروکی', draft: 'پیش‌نمایش و بازبینی کروکی', success: 'ثبت موفق اطلاعات', map: 'نقشه درخواست‌ها', assign: 'ارجاع درخواست‌ها'}
function Icon({name}) {
  const paths = {home:'M4 4h16v16H4z M8 8h8 M8 12h8 M8 16h5',map:'m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',assign:'M8 7h12m-4-4 4 4-4 4M16 17H4m4-4-4 4 4 4',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm9 1a4 4 0 0 1 0 7m4 10v-2a4 4 0 0 0-3-3.9'}
  return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.home} /></svg>
}

export default function AppShell({user, onLogout, activePage, onNav, children}) {
  const role = user.role
  const roleTitle = role === 'surveyor' ? `نقشه‌بردار ${tierLabel(user.tier)}` : role === 'expert' ? 'کارشناس مسئول' : 'مدیر سامانه'
  const links = role === 'surveyor' ? [['home','کارتابل درخواست‌ها','home'],['map','نقشه درخواست‌ها','map']] : role === 'expert' ? [['home','بررسی کروکی‌ها','home'],['assign','ارجاع درخواست‌ها','assign'],['map','ارجاع روی نقشه','map']] : [['home','مدیریت کاربران','users']]
  const selected = ['upload','draft','success'].includes(activePage) ? 'home' : activePage
  return <div className="desktop-app">
    <aside className="desktop-sidebar" aria-label="منوی اصلی">
      <div className="sidebar-brand"><div className="sidebar-logo"><img src="/logo.png" alt="آستان قدس رضوی" /></div><div><strong>سامانه کروکی</strong><span>اداره نقشه‌برداری آستان قدس رضوی</span></div></div>
      <div className="sidebar-user"><div className="sidebar-avatar">{user.name?.slice(0,1)}</div><div><strong>{user.name}</strong><span>{roleTitle}</span></div></div>
      <div className="sidebar-section-title">میز کار</div>
      <nav className="sidebar-nav">{links.map(([page,label,icon]) => <button key={page} className={`sidebar-link${selected === page ? ' selected' : ''}`} aria-current={selected === page ? 'page' : undefined} onClick={() => onNav(page)}><Icon name={icon}/><span>{label}</span><span className="sidebar-chevron">‹</span></button>)}</nav>
      <div className="sidebar-workflow"><span>گردش‌کار پرونده</span><p>تکمیل اطلاعات، بازبینی کروکی و بررسی کارشناس مسئول</p><div>ثبت محلی · نسخه ۸</div></div>
      <button className="sidebar-logout" onClick={onLogout}>⇥ خروج</button>
      <div className="sidebar-credit">وب اطلس پویا</div>
    </aside>
    <div className="desktop-workspace">
      <header className="desktop-topbar"><div><div className="desktop-breadcrumb">سامانه نقشه‌برداری <span>/</span> {roleTitle}</div><h1>{role === 'admin' ? 'مدیریت کاربران و دسترسی‌ها' : role === 'expert' ? ({home:'بررسی و تأیید کروکی‌ها',assign:'ارجاع درخواست‌ها',map:'ارجاع روی نقشه'}[activePage] || 'بررسی و تأیید کروکی‌ها') : META[activePage] || META.home}</h1></div><div className="desktop-topbar-meta"><span className="local-status"><i/> محیط محلی</span><time>{new Date().toLocaleDateString('fa-IR',{year:'numeric',month:'long',day:'numeric'})}</time></div></header>
      <main className={`content desktop-content page-${activePage}`} id="main-content">{children}</main>
      <footer className="desktop-footer"><span>سامانه ثبت و بررسی کروکی · آستان قدس رضوی</span><span>نسخه دسکتاپ ۸.۰</span></footer>
    </div>
  </div>
}
