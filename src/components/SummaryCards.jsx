import { gbp } from '../lib/money.js'
import { BASE_YEAR, PEOPLE } from '../lib/projection.js'

export default function SummaryCards({ summary, plan }) {
  const incomeMet = summary.sustainableIncome >= summary.targetIncome
  const dep = summary.depletionYear // null | { t, year }

  // The later of the two life-expectancy years — the end of the plan horizon.
  const planEndYear =
    BASE_YEAR +
    Math.max(
      ...PEOPLE.map((who) => {
        const p = plan.people[who]
        return Math.max(0, (p.lifeExpectancy || 0) - (p.currentAge || 0))
      }),
    )

  // Older partner's age in a given calendar year (for the depletion note).
  const olderAgeIn = (year) =>
    Math.max(...PEOPLE.map((who) => (plan.people[who].currentAge || 0) + (year - BASE_YEAR)))

  return (
    <div className="summary-cards">
      <Card
        title="Pot at retirement"
        value={gbp(summary.potAtRetirement)}
        note="Household investable pots at the second retirement"
      />
      <Card
        title="Sustainable income"
        value={`${gbp(summary.sustainableIncome)}/yr`}
        note={
          incomeMet
            ? `Meets your ${gbp(summary.targetIncome)} target ✓`
            : `Below your ${gbp(summary.targetIncome)} target`
        }
        tone={incomeMet ? 'good' : 'warn'}
      />
      <Card
        title="Money lasts until"
        value={dep ? `${dep.year}` : `${planEndYear}+`}
        note={
          dep
            ? `Pots run dry at the target income (older partner ~${olderAgeIn(dep.year)})`
            : 'Pots last to the end of the plan'
        }
        tone={dep ? 'warn' : 'good'}
      />
      <Card
        title="Inheritance tax"
        value={gbp(summary.ihtDue)}
        note={
          summary.pensionIht.extraDueToChange > 0
            ? `Incl. ${gbp(summary.pensionIht.extraDueToChange)} from pensions (Apr 2027)`
            : 'On the current estate'
        }
        tone={summary.ihtDue > 0 ? 'warn' : 'good'}
      />
    </div>
  )
}

function Card({ title, value, note, tone }) {
  return (
    <div className={`summary-card ${tone || ''}`}>
      <span className="summary-title">{title}</span>
      <span className="summary-value">{value}</span>
      <span className="summary-note">{note}</span>
    </div>
  )
}
