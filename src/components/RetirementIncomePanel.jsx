import { gbp } from '../lib/money.js'
import { deflator } from '../lib/projection.js'

// Year-by-year household retirement income: where the money comes from, the tax
// paid (summed across both partners), and the net income against the joint
// target.
export default function RetirementIncomePanel({ drawdown, plan }) {
  const { rows, depletionYear, totalTaxPaid } = drawdown
  const real = plan.realTerms
  // Deflate by years-from-now (row.t), not by age.
  const f = (t, v) => (real ? v / deflator(t, plan.inflation) : v)

  const ageTag = (ages) => {
    const m = ages.male == null ? '—' : `M${ages.male}`
    const fem = ages.female == null ? '—' : `F${ages.female}`
    return `${m}·${fem}`
  }

  return (
    <section className="income-panel">
      <p className="section-intro">
        Drawing pooled pots in the default tax-efficient order (cash, then ISA, then pension), on top
        of both partners’ LGPS and State Pensions. Pension withdrawals are 25% tax-free, 75% taxable,
        taxed at each owner’s own marginal rate.
        {real ? ' Figures in today’s money.' : ''}
      </p>
      <div className="table-scroll">
        <table className="income-table">
          <thead>
            <tr>
              <th>Year</th>
              <th>Ages</th>
              <th>Target</th>
              <th>State Pension</th>
              <th>LGPS</th>
              <th>From pots</th>
              <th>Tax</th>
              <th>Net income</th>
              <th>Pots left</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const fromPots = r.cashDrawn + r.isaDrawn + r.pensionGross.total
              const short = r.shortfall > 1
              return (
                <tr key={r.t} className={short ? 'shortfall' : ''}>
                  <td>{r.year}</td>
                  <td>{ageTag(r.ages)}</td>
                  <td>{gbp(f(r.t, r.target))}</td>
                  <td>{r.spIncome.total ? gbp(f(r.t, r.spIncome.total)) : '—'}</td>
                  <td>{r.lgpsIncome.total ? gbp(f(r.t, r.lgpsIncome.total)) : '—'}</td>
                  <td>{fromPots ? gbp(f(r.t, fromPots)) : '—'}</td>
                  <td>{r.tax.total ? gbp(f(r.t, r.tax.total)) : '—'}</td>
                  <td>
                    {gbp(f(r.t, r.netIncome))}
                    {short && <span className="short-flag"> short</span>}
                  </td>
                  <td>{gbp(f(r.t, r.potTotal))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="chart-note">
        Total income tax across retirement: <b>{gbp(totalTaxPaid)}</b>.{' '}
        {depletionYear
          ? `Pots run out in ${depletionYear.year}.`
          : 'Pots last to the end of the plan.'}
      </p>
    </section>
  )
}
