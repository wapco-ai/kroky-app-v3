/**
 * steps: string[]
 * active: 0-based index of current step
 */
export default function StepProgress({ steps, active }) {
  return (
    <div className="steps">
      {steps.map((label, i) => {
        const done   = i < active
        const isActive = i === active
        return (
          <div key={i} style={{ display: 'contents' }}>
            <div className={`step${done ? ' done' : ''}${isActive ? ' active' : ''}`}>
              <div className="step-c">{done ? '✓' : i + 1}</div>
              <div className="step-lbl">{label}</div>
            </div>
            {i < steps.length - 1 && (
              <div className={`step-line${done ? ' done' : ''}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
