export default function LoadingOverlay({ message, steps = [] }) {
  return (
    <div className="loading-overlay">
      <div className="load-circle" />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>{message}</div>
        <div className="load-steps">
          {steps.map((s, i) => (
            <div key={i} className={`load-step${s === message ? ' cur' : ''}`}>
              {s === message ? '▶ ' : '✓ '}{s}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
