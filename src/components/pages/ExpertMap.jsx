import { useState, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Polygon, Polyline, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useApp } from '../../store/AppContext.jsx'
import { pointInPolygon, PLAK_NAMES, plakCenter, tierLabel } from '../../data/store.js'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: '', shadowUrl: '' })

const CENTER = [36.2975, 59.5505]

function dot(selected) {
  const c = selected ? '#1B5E20' : '#E65100'
  const ring = selected ? '#FBC02D' : '#fff'
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;background:${c};border:3px solid ${ring};border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;cursor:pointer;">${selected ? '✓' : ''}</div>`,
    iconSize: [26, 26], iconAnchor: [13, 13],
  })
}

// لایهٔ گرفتن کلیک نقشه هنگام ترسیم پلیگون
function DrawLayer({ drawing, onPoint }) {
  useMapEvents({ click(e) { if (drawing) onPoint([e.latlng.lat, e.latlng.lng]) } })
  return null
}

export default function ExpertMap({ onToast }) {
  const { requests, surveyors, assignRequests } = useApp()
  const unassigned = useMemo(() => requests.filter(r => r.status === 'unassigned' && Number.isFinite(r.lat) && Number.isFinite(r.lng)), [requests])

  const [drawing, setDrawing] = useState(false)
  const [poly, setPoly] = useState([])              // رئوس پلیگون [[lat,lng],...]
  const [selected, setSelected] = useState(new Set())
  const [target, setTarget] = useState('')

  const addVertex = useCallback((pt) => setPoly(p => [...p, pt]), [])

  const startDraw = () => { setDrawing(true); setPoly([]) }
  const finishDraw = () => {
    setDrawing(false)
    if (poly.length < 3) { setPoly([]); return }
    const inside = unassigned.filter(r => pointInPolygon({ lat: r.lat, lng: r.lng }, poly)).map(r => r.id)
    setSelected(prev => new Set([...prev, ...inside]))
    onToast?.(`${inside.length} درخواست داخل پلیگون انتخاب شد`)
    setPoly([])
  }
  const cancelDraw = () => { setDrawing(false); setPoly([]) }

  const toggle = (id) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  const clearSel = () => setSelected(new Set())

  const selectedList = unassigned.filter(r => selected.has(r.id))

  const assign = async () => {
    if (!target || selected.size === 0) return
    const name = surveyors.find(s => s.username === target)?.name || target
    await assignRequests([...selected], target)
    onToast?.(`${selected.size} درخواست به ${name} ارجاع گروهی شد ✓`)
    setSelected(new Set())
  }

  return (
    <>
      <div className="map-page-header">
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--g800)' }}>🗺 ارجاع روی نقشه</div>
          <div style={{ fontSize: 12, color: 'var(--g500)', marginTop: 2 }}>
            تمام درخواست‌های بدون کارشناس ({unassigned.length}) · با ترسیم پلیگون یا کلیک روی مارکر انتخاب کنید
          </div>
        </div>
        <div className="flex gap8" style={{ flexWrap: 'wrap' }}>
          {!drawing
            ? <button className="btn btn-primary btn-sm" onClick={startDraw}>✏️ ترسیم پلیگون انتخاب</button>
            : <>
                <button className="btn btn-success btn-sm" onClick={finishDraw} disabled={poly.length < 3}
                  style={poly.length < 3 ? { opacity: .5 } : {}}>✓ پایان ترسیم ({poly.length})</button>
                <button className="btn btn-ghost btn-sm" onClick={cancelDraw}>انصراف ترسیم</button>
              </>}
        </div>
      </div>

      {drawing && (
        <div className="alert al-info mb16">
          <span className="al-icon">✏️</span>
          <span>روی نقشه کلیک کنید تا رئوس پلیگون افزوده شوند (حداقل ۳ نقطه)، سپس «پایان ترسیم» را بزنید.</span>
        </div>
      )}

      <div className="map-layout-wide">
        <div className="map-container-wide">
          <MapContainer center={CENTER} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom
            doubleClickZoom={!drawing}>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
            <DrawLayer drawing={drawing} onPoint={addVertex} />
            {poly.length > 0 && (poly.length >= 3
              ? <Polygon positions={poly} pathOptions={{ color: '#1B5E20', fillColor: '#2E7D32', fillOpacity: .12, weight: 2 }} />
              : <Polyline positions={poly} pathOptions={{ color: '#1B5E20', weight: 2, dashArray: '5 4' }} />)}
            {unassigned.map(r => (
              <Marker key={r.id} position={[r.lat, r.lng]} icon={dot(selected.has(r.id))}
                eventHandlers={{ click: () => { if (!drawing) toggle(r.id) } }} />
            ))}
          </MapContainer>
        </div>

        <div className="map-sidebar-wide">
          <div className="legend-card">
            <div className="lg-title">ارجاع گروهی</div>
            <div className="fg" style={{ marginBottom: 10 }}>
              <label className="fl" style={{ fontSize: 12 }}>کارشناس مقصد</label>
              <select className="fc" value={target} onChange={e => setTarget(e.target.value)}>
                <option value="">انتخاب کنید...</option>
                {surveyors.map(s => <option key={s.username} value={s.username}>{s.name} ({tierLabel(s.tier)})</option>)}
              </select>
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
              disabled={!target || selected.size === 0}
              onClick={assign}>← ارجاع گروهی ({selected.size})</button>
            {selected.size > 0 && (
              <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                onClick={clearSel}>پاک‌کردن انتخاب</button>
            )}
          </div>

          <div className="req-list-card" style={{ flex: 1 }}>
            <div className="rlist-hd">✅ انتخاب‌شده‌ها ({selectedList.length})</div>
            {selectedList.length === 0
              ? <div style={{ padding: 20, fontSize: 13, color: 'var(--g400)', textAlign: 'center' }}>
                  موردی انتخاب نشده — پلیگون بکشید یا روی مارکرها کلیک کنید
                </div>
              : selectedList.map(r => (
                <div key={r.id} className="ri" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div className="ri-code">{r.requestNo} · {r.regPlak}</div>
                    <div className="ri-title">{r.title}</div>
                  </div>
                  <button className="btn btn-sm btn-ghost" title="حذف از فهرست" onClick={() => toggle(r.id)}>✕</button>
                </div>
              ))}
          </div>
        </div>
      </div>
    </>
  )
}
