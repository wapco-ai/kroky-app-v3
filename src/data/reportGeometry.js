// Read-only drawing helpers. No geometry is extracted from an uploaded DXF.
export function parseParcelWkt(value) {
  if (typeof value !== 'string' || value.length > 500000) return []
  const wkt = value.trim().replace(/^SRID=4326;/i, '')
  if (!/^(MULTI)?POLYGON\s*\(/i.test(wkt)) return []
  return (wkt.match(/\([^()]+\)/g) || []).map(ring => ring.slice(1,-1).split(',').map(tuple => tuple.trim().split(/\s+/).map(Number).slice(0,2)))
    .filter(ring => ring.length >= 4 && ring.length <= 5000 && ring.every(([x,y]) => Number.isFinite(x) && Number.isFinite(y) && Math.abs(x) <= 180 && Math.abs(y) <= 90))
}
export function reportGeometry(request = {}) {
  const rings = parseParcelWkt(request.source?.parcelWkt)
  const points = rings.flat()
  const hasPosition = Number.isFinite(request.lat) && Number.isFinite(request.lng) && Math.abs(request.lat) <= 90 && Math.abs(request.lng) <= 180
  const center = hasPosition ? [request.lat, request.lng] : points.length ? [(Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2,(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2] : null
  let path = ''
  if (points.length && center) {
    const scaleX = Math.cos(center[0] * Math.PI / 180)
    const projected = rings.map(ring => ring.map(([x,y]) => [(x-center[1])*scaleX, -(y-center[0])]))
    const all = projected.flat(), xs = all.map(p=>p[0]), ys = all.map(p=>p[1])
    const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys)
    const dx=maxX-minX, dy=maxY-minY
    if (dx > 0 && dy > 0) {
      const scale = Math.min(280 / dx, 260 / dy)
      const tx=230-(minX+maxX)/2*scale, ty=205-(minY+maxY)/2*scale
      path = projected.map(ring => ring.map(([x,y],i)=>`${i ? 'L' : 'M'}${(x*scale+tx).toFixed(2)},${(y*scale+ty).toFixed(2)}`).join(' ')+' Z').join(' ')
    }
  }
  return {rings, center, path, hasSourceGeometry: Boolean(path)}
}
