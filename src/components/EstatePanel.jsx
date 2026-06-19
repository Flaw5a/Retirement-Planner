import { useState } from 'react'
import { gbp } from '../lib/money.js'
import {
  nilRateBands,
  inheritanceTax,
  giftingImpact,
  pensionIhtImpact,
} from '../lib/iht.js'
import { PEOPLE, BASE_YEAR } from '../lib/projection.js'
import Field from './Field.jsx'

export default function EstatePanel({ plan, trajectory }) {
  const horizon = Math.max(
    0,
    ...PEOPLE.map((who) => {
      const p = plan.people[who]
      return (p.lifeExpectancy || 95) - (p.currentAge || 0)
    }),
  )
  const [annualGift, setAnnualGift] = useState(3000)
  const [years, setYears] = useState(Math.min(10, horizon))

  // Year projection — build a set of sensible year options from the trajectory.
  const series = trajectory?.series || []
  const yearOptions = buildYearOptions(series)
  const [selectedYear, setSelectedYear] = useState(BASE_YEAR)

  // Find the trajectory entry for the selected year (falls back to first entry).
  const entry = series.find((s) => s.year === selectedYear) || series[0]
  const otherEstate = plan.estate?.otherEstate || 0

  // Projected estate = trajectory pot totals at the selected year + static other assets.
  const projectedEstate = entry
    ? entry.pension + entry.isa + entry.cash + entry.property + otherEstate
    : 0

  const opts = {
    married: plan.estate?.married,
    leaveHomeToDescendants: plan.estate?.leaveHomeToDescendants ?? true,
    charityTenPercent: plan.estate?.charityTenPercent || false,
  }

  const bands = nilRateBands(projectedEstate, opts)
  const iht = inheritanceTax(projectedEstate, opts)
  const pensionImpact = pensionIhtImpact(plan)
  const gift = giftingImpact(plan, { annualGift, years })

  const isToday = selectedYear <= BASE_YEAR

  return (
    <section className="estate-panel">
      <p className="section-intro">
        From 6 April 2027 unused pensions count towards your estate for Inheritance Tax, which is why
        a gifting plan can matter. Married couples can pass unused nil-rate bands to each other.
      </p>

      <div className="estate-grid">
        <div className="estate-block">
          <div className="estate-block-head">
            <h3>{isToday ? 'Your estate today' : `Your estate in ${selectedYear}`}</h3>
            {yearOptions.length > 1 && (
              <select
                className="year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {yearOptions.map(({ year, label }) => (
                  <option key={year} value={year}>{label}</option>
                ))}
              </select>
            )}
          </div>
          <Row label="Estate value (incl. pension)" value={gbp(projectedEstate)} />
          <Row label="Nil-rate band" value={gbp(bands.nrb)} />
          <Row label="Residence nil-rate band" value={gbp(bands.rnrb)} />
          <Row label="Taxable above bands" value={gbp(iht.taxable)} />
          <Row label="Inheritance tax (40%)" value={gbp(iht.tax)} strong tone={iht.tax > 0 ? 'warn' : 'good'} />
          {isToday && pensionImpact.extraDueToChange > 0 && (
            <p className="chart-note">
              Of that, <b>{gbp(pensionImpact.extraDueToChange)}</b> is due to pensions being counted
              from April 2027.
            </p>
          )}
        </div>

        <div className="estate-block">
          <h3>Gifting to your children</h3>
          <div className="estate-controls">
            <Field kind="currency" label="Gift per year" value={annualGift} onChange={setAnnualGift} />
            <Field kind="number" label="For how many years" value={years} onChange={(v) => setYears(Math.min(v, horizon))} />
          </div>
          <Row label="Total gifted" value={gbp(gift.giftedTotal)} />
          <Row label="IHT without gifting" value={gbp(gift.ihtBefore)} />
          <Row label="IHT after gifting" value={gbp(gift.ihtAfter)} />
          <Row label="IHT saved" value={gbp(gift.ihtSaved)} strong tone={gift.ihtSaved > 0 ? 'good' : ''} />
          <Row label="Passed to children" value={gbp(gift.netToHeirsAfter)} strong />
          <p className="chart-note">
            Assumes you survive gifts by 7 years. The first {gbp(3000)}/yr is covered by the annual
            exemption; regular gifts out of surplus income are also exempt immediately.
          </p>
        </div>
      </div>
    </section>
  )
}

function Row({ label, value, strong, tone }) {
  return (
    <div className={`estate-row ${strong ? 'strong' : ''} ${tone || ''}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

// Build the year dropdown options: today + every 5-year milestone through end of plan.
function buildYearOptions(series) {
  if (!series.length) return []
  const opts = []
  const first = series[0].year
  const last = series[series.length - 1].year

  for (const s of series) {
    if (s.year === first || s.year % 5 === 0) {
      opts.push({
        year: s.year,
        label: s.year === first ? `${s.year} (today)` : String(s.year),
      })
    }
  }

  // Always include the last year if not already present.
  if (!opts.find((o) => o.year === last)) {
    opts.push({ year: last, label: String(last) })
  }

  return opts
}
