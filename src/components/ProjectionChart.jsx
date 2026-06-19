import { ASSET_STACK } from './chartMeta.js'
import { gbp, gbpCompact } from '../lib/money.js'
import { deflator } from '../lib/projection.js'
import Field from './Field.jsx'

// Stacked bar chart of the household fund trajectory across the whole plan: pots
// grow to each partner's retirement, then deplete through drawdown. Dashed
// markers flag each partner's retirement year and State Pension year. A scrubber
// lets you highlight any year and read off the fund value and breakdown.
export default function ProjectionChart({ trajectory, plan, selectedYear, setSelectedYear }) {
  const { series, retirementMarkers, spMarkers, depletionYear } = trajectory
  const real = plan.realTerms
  // Deflate by years-from-now (the series index t), not by age.
  const factorAt = (t) => (real ? deflator(t, plan.inflation) : 1)

  const ageTag = (ages) => {
    const m = ages.male == null ? '—' : `M${ages.male}`
    const f = ages.female == null ? '—' : `F${ages.female}`
    return `${m}·${f}`
  }

  // Deflate to today's money if requested.
  const data = series.map((s) => {
    const f = factorAt(s.t)
    return {
      t: s.t,
      year: s.year,
      ages: s.ages,
      phase: s.phase,
      pension: s.pension / f,
      isa: s.isa / f,
      cash: s.cash / f,
      property: s.property / f,
      total: s.total / f,
    }
  })

  const maxTotal = Math.max(1, ...data.map((d) => d.total))

  const firstYear = series.length ? series[0].year : 0
  const lastYear = series.length ? series[series.length - 1].year : 0
  const selectedIdx = data.findIndex((d) => d.year === selectedYear)
  const selected = selectedIdx >= 0 ? data[selectedIdx] : null

  // Geometry
  const PAD = { top: 16, right: 14, bottom: 42, left: 54 }
  const step = 16
  const barW = 11
  const chartH = 300
  const W = PAD.left + data.length * step + PAD.right
  const H = chartH + PAD.top + PAD.bottom
  const plotBottom = PAD.top + chartH

  const yOf = (v) => PAD.top + chartH * (1 - v / maxTotal)
  const xOf = (i) => PAD.left + i * step + (step - barW) / 2
  const xCentre = (year) => {
    const i = data.findIndex((d) => d.year === year)
    return i < 0 ? null : PAD.left + i * step + step / 2
  }

  // Gridlines: 4 evenly spaced levels.
  const gridLevels = [0, 0.25, 0.5, 0.75, 1].map((p) => p * maxTotal)

  const markers = [
    { x: xCentre(retirementMarkers.male.year), label: `A retires ${retirementMarkers.male.age}`, cls: 'retire' },
    { x: xCentre(retirementMarkers.female.year), label: `B retires ${retirementMarkers.female.age}`, cls: 'retire' },
    { x: xCentre(spMarkers.male.year), label: `A SP ${spMarkers.male.age}`, cls: 'sp' },
    { x: xCentre(spMarkers.female.year), label: `B SP ${spMarkers.female.age}`, cls: 'sp' },
  ]

  return (
    <div className="chart-card">
      <div className="chart-head">
        <h3>Fund trajectory{real ? ' (today’s money)' : ''}</h3>
        <Legend />
      </div>

      <div className="scrubber">
        <Field
          kind="range"
          label={`Scrub to year — ${selectedYear ?? firstYear}`}
          value={selectedYear ?? firstYear}
          min={firstYear}
          max={lastYear}
          step={1}
          onChange={setSelectedYear}
        />
        {selected && (
          <div className="scrubber-readout">
            <div className="readout-head">
              <span className="readout-year">{selected.year}</span>
              <span className="readout-ages">{ageTag(selected.ages)}</span>
            </div>
            <div className="readout-total">{gbp(selected.total)}</div>
            <ul className="readout-breakdown">
              {ASSET_STACK.map((a) => (
                <li key={a.key}>
                  <span className="legend-swatch" style={{ background: a.color }} />
                  {a.label}
                  <b>{gbp(selected[a.key])}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="chart-scroll">
        <svg className="projection-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projected household fund value by year">
          {/* gridlines + y labels */}
          {gridLevels.map((lvl, i) => (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yOf(lvl)} y2={yOf(lvl)} className="grid" />
              <text x={PAD.left - 6} y={yOf(lvl) + 4} className="axis-label y">
                {gbpCompact(lvl)}
              </text>
            </g>
          ))}

          {/* markers */}
          {markers.map((m, i) =>
            m.x == null ? null : (
              <g key={i}>
                <line x1={m.x} x2={m.x} y1={PAD.top} y2={plotBottom} className={`marker ${m.cls}`} />
                <text x={m.x} y={PAD.top - 4} className="marker-label">{m.label}</text>
              </g>
            ),
          )}

          {/* bars */}
          {data.map((d, i) => {
            let yCursor = plotBottom
            const isSel = d.year === selectedYear
            return (
              <g key={d.year}>
                {ASSET_STACK.map((a) => {
                  const val = d[a.key]
                  if (val <= 0) return null
                  const h = (val / maxTotal) * chartH
                  yCursor -= h
                  return (
                    <rect
                      key={a.key}
                      x={xOf(i)}
                      y={yCursor}
                      width={barW}
                      height={h}
                      fill={a.color}
                      opacity={selectedYear != null && !isSel ? 0.45 : 1}
                    />
                  )
                })}
                {isSel && (
                  <rect
                    className="bar-highlight"
                    x={xOf(i) - 1.5}
                    y={yOf(d.total) - 1.5}
                    width={barW + 3}
                    height={plotBottom - yOf(d.total) + 1.5}
                  />
                )}
                <title>
                  {`${d.year} (${ageTag(d.ages)}) — ${gbp(d.total)}\nPension ${gbp(d.pension)} · ISA ${gbp(d.isa)} · Cash ${gbp(d.cash)} · Property ${gbp(d.property)}`}
                </title>
                {d.year % 5 === 0 && (
                  <g>
                    <text x={xOf(i) + barW / 2} y={plotBottom + 14} className="axis-label x">
                      {d.year}
                    </text>
                    <text x={xOf(i) + barW / 2} y={plotBottom + 26} className="axis-label x sub">
                      {ageTag(d.ages)}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      {depletionYear != null && (
        <p className="chart-note warn">
          ⚠ Investable pots run out in <b>{depletionYear.year}</b> at the target income. After that
          the household relies on the State Pension, LGPS and property.
        </p>
      )}
    </div>
  )
}

function Legend() {
  return (
    <ul className="legend">
      {ASSET_STACK.map((a) => (
        <li key={a.key}>
          <span className="legend-swatch" style={{ background: a.color }} />
          {a.label}
        </li>
      ))}
    </ul>
  )
}
