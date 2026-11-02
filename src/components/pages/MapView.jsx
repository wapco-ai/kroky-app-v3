import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import { useApp } from '../../store/AppContext.jsx'
import { STATUS_COLORS, wfLabel, wfCls } from '../../data/store.js'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: '', shadowUrl: '' })

const CENTER = [36.2975, 59.5605]

function divIcon(status, num) {
  const c = STATUS_COLORS[status] || '#555'
  return L.divIcon({
    className: '',
    html: `<div style="width:34px;height:34px;background:${c};border:3px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;box-shadow:0 3px 10px rgba(0,0,0,.35);font-family:'Vazirmatn','Tahoma',sans-serif;cursor:pointer;">${num}</div>`,
    iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -22],
  })
}

function MapController({ flyTo }) {
  const map = useMap(); const prev = useRef(null)
  useEffect(() => { if (flyTo && flyTo !== prev.current) { map.flyTo([flyTo.lat, flyTo.lng], 15, { duration: 1.2 }); prev.current = flyTo } }, [flyTo, map])
  return null
}

export default function MapView({ onBack, onSelectRequest }) {
  const { currentUser, requests } = useApp()
  const me = currentUser.username
  const [sel, setSel] = useState(null)
  const [flyTo, setFlyTo] = useState(null)

  const mine = useMemo(() => requests.filter(r => r.assignedTo === me), [requests, me])

  const clickItem = useCallback((r) => { setSel(r.id); if (Number.isFinite(r.lat) && Number.isFinite(r.lng)) setFlyTo({ lat: r.lat, lng: r.lng, _t: Date.now() }) }, [])

  return (
    <>
      <div className="map-page-header">
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--g800)' }}>🗺 نقشه کارتابل من – مشهد مقدس</div>
          <div style={{ fontSize: 12, color: 'var(--g500)', marginTop: 2 }}>درخواست‌های ارجاع‌شده به شما | OpenStreetMap</div>
        </div>
        <div className="flex gap8">
          <button className="btn btn-outline btn-sm" onClick={() => setFlyTo({ lat: CENTER[0], lng: CENTER[1], _t: Date.now() })}>🎯 نمای کل</button>
          {onBack && <button className="btn btn-ghost btn-sm" onClick={onBack}>↩ بازگشت</button>}
        </div>
      </div>

      <div className="map-layout-wide">
        <div className="map-container-wide">
          <MapContainer center={CENTER} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
            {mine.filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng)).map((r, i) => (
              <Marker key={r.id} position={[r.lat, r.lng]} icon={divIcon(r.status, i + 1)}
                eventHandlers={{ click: () => setSel(r.id) }}>
                <Popup maxWidth={270}>
                  <div style={{ minWidth: 220, direction: 'rtl' }}>
                    <div style={{ fontSize: 10, color: '#9AA4B7' }}>{r.requestNo} · {r.regPlak}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#1E2D47', margin: '4px 0 8px' }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: '#6B7A94' }}>مساحت: {r.area} م² · وضعیت: {wfLabel(r.status)}</div>
                    {r.status === 'assigned' && (
                      <button onClick={() => onSelectRequest?.(r)}
                        style={{ width: '100%', marginTop: 10, padding: 7, borderRadius: 6, background: '#2E7D32', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'Vazirmatn,sans-serif' }}>
                        📤 بارگذاری کروکی
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
            <MapController flyTo={flyTo} />
          </MapContainer>
        </div>

        <div className="map-sidebar-wide">
          <div className="legend-card">
            <div className="lg-title">راهنمای وضعیت</div>
            {Object.entries(STATUS_COLORS).map(([s, c]) => (
              <div key={s} className="lg-item"><div className="lg-dot" style={{ background: c }} />{wfLabel(s)}</div>
            ))}
          </div>
          <div className="req-list-card" style={{ flex: 1 }}>
            <div className="rlist-hd">📍 درخواست‌های من ({mine.length})</div>
            {mine.length === 0
              ? <div style={{ padding: 20, fontSize: 13, color: 'var(--g400)', textAlign: 'center' }}>درخواستی ارجاع نشده است</div>
              : mine.map(r => (
                <div key={r.id} className={`ri${sel === r.id ? ' sel' : ''}`}>
                  <div onClick={() => clickItem(r)}>
                    <div className="ri-code">{r.requestNo} · {r.regPlak}</div>
                    <div className="ri-title">{r.title}</div>
                    <div className="ri-meta">
                      <span className={`badge ${wfCls(r.status)}`} style={{ fontSize: 10 }}>{wfLabel(r.status)}</span>
                      <span style={{ fontSize: 11, color: 'var(--g400)' }}>{r.area} م²</span>
                    </div>
                  </div>
                  {r.status === 'assigned' && (
                    <button className="btn btn-sm btn-primary" style={{ width: '100%', marginTop: 8, fontSize: 11, justifyContent: 'center' }}
                      onClick={() => onSelectRequest?.(r)}>📤 بارگذاری کروکی</button>
                  )}
                </div>
              ))}
          </div>
        </div>
      </div>
    </>
  )
}
