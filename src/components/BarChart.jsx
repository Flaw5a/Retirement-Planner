// Simple vertical bar chart for side-by-side scenario comparisons. The best
// option is highlighted. `format` turns a raw value into a display string.
export default function BarChart({ bars, bestIndex, format }) {
  const max = Math.max(1, ...bars.map((b) => Math.abs(b.value)))
  return (
    <div className="barchart" role="img" aria-label="Scenario comparison">
      {bars.map((b, i) => {
        const height = Math.max(3, (Math.abs(b.value) / max) * 100)
        const best = i === bestIndex
        return (
          <div key={i} className={`bar-col ${best ? 'best' : ''}`}>
            <div className="bar-value">{format(b.value)}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ height: `${height}%` }} />
            </div>
            <div className="bar-label">
              {b.label}
              {best && <span className="best-tag">best</span>}
            </div>
            {b.sublabel && <div className="bar-sub">{b.sublabel}</div>}
          </div>
        )
      })}
    </div>
  )
}
