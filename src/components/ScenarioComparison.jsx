import BarChart from './BarChart.jsx'
import { gbp, gbpCompact } from '../lib/money.js'

const PERSON_LABEL = { male: 'Partner A', female: 'Partner B' }

// Per-scenario presentation: how to format the bar value, the small sub-label
// under each bar, and the plain-English recommendation.
const PRESENTERS = {
  contribution: {
    valueLabel: 'Household income / yr',
    format: (v) => `${gbp(v)}/yr`,
    sublabel: () => null,
    recommend: (s) => {
      const best = s.bars[s.bestIndex]
      return `Best: ${best.label.toLowerCase()} — about ${gbp(best.value)}/yr of household sustainable income. Pension wins when this partner gets higher-rate relief now and pays basic rate in retirement; ISA wins if it's the other way round.`
    },
  },
  retirementAge: {
    valueLabel: 'Household income / yr',
    format: (v) => `${gbp(v)}/yr`,
    sublabel: (b) => `Pot ${gbpCompact(b.meta.pot)}`,
    recommend: (s) => {
      const best = s.bars[s.bestIndex]
      const earliest = s.bars[0]
      const gap = best.value - earliest.value
      return `This partner retiring at ${best.meta.age} supports about ${gbp(best.value)}/yr of household income. Going from ${earliest.meta.age} to ${best.meta.age} adds roughly ${gbp(gap)}/yr — the price of an earlier finish.`
    },
  },
  drawdownOrder: {
    valueLabel: 'Total tax in retirement',
    format: (v) => gbp(v),
    sublabel: (b) => (b.meta.depletionYear ? `pot dry ${b.meta.depletionYear.year}` : 'pot lasts'),
    recommend: (s) => {
      const best = s.bars[s.bestIndex]
      const worst = s.bars.reduce((a, b) => (b.value > a.value ? b : a), s.bars[0])
      const saving = worst.value - best.value
      return `"${best.label}" pays the least income tax — about ${gbp(saving)} less over retirement than "${worst.label}". But remember pensions now count for IHT, so leaving the pension untouched can raise the estate tax even as it cuts income tax.`
    },
  },
  deferStatePension: {
    valueLabel: 'Household income / yr',
    format: (v) => `${gbp(v)}/yr`,
    sublabel: (b) => `SP ${gbp(b.meta.spAnnual)}/yr`,
    recommend: (s) => {
      const best = s.bars[s.bestIndex]
      if (s.bestIndex === 0) return 'Taking this partner’s State Pension on time is best here — deferring only pays off if you expect to live well beyond average.'
      return `Deferring this partner by ${best.meta.deferYears} year(s) lifts their State Pension to ${gbp(best.meta.spAnnual)}/yr and edges household income up to ${gbp(best.value)}/yr, assuming they reach life expectancy.`
    },
  },
  gifting: {
    valueLabel: 'Passed to your children',
    format: (v) => gbpCompact(v),
    sublabel: (b) => `IHT ${gbp(b.meta.ihtAfter)}`,
    recommend: (s) => {
      const best = s.bars[s.bestIndex]
      const base = s.bars[0]
      const extra = best.value - base.value
      if (extra <= 0) return 'Your estate is within the nil-rate bands, so gifting saves no inheritance tax here — though it can still help your children sooner.'
      return `Gifting (${best.label}) passes about ${gbpCompact(extra)} more to your children by cutting the IHT bill — provided you survive gifts by 7 years.`
    },
  },
}

// The three personal scenarios act on the selected partner; the rest are
// household-wide and don't depend on the person selector.
const PERSONAL_KEYS = new Set(['contribution', 'retirementAge', 'deferStatePension'])

const PEOPLE = [
  { key: 'male', label: 'Partner A' },
  { key: 'female', label: 'Partner B' },
]

export default function ScenarioComparison({ scenarios, who, setWho }) {
  return (
    <section className="scenarios">
      <p className="section-intro">
        Each comparison re-runs your whole household plan with one change, so you can see the best
        course of action. The <b>best</b> option in each is highlighted. The personal scenarios
        (contributions, retirement age, deferring the State Pension) apply to the selected partner —
        the other partner is held fixed.
      </p>

      <div className="scenario-person">
        <span className="field-label">Personal scenarios apply to:</span>
        <div className="person-toggle" role="tablist" aria-label="Choose partner">
          {PEOPLE.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={who === p.key}
              className={`person-tab ${who === p.key ? 'active' : ''}`}
              onClick={() => setWho(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {scenarios.map((s) => {
        const p = PRESENTERS[s.key]
        const bars = s.bars.map((b) => ({ ...b, sublabel: p.sublabel(b) }))
        const personal = PERSONAL_KEYS.has(s.key)
        return (
          <article key={s.key} className="scenario-card">
            <header>
              <h3>{s.title}</h3>
              <span className="scenario-metric">
                {personal && <span className="scenario-who">{PERSON_LABEL[who]}</span>}
                {p.valueLabel}
              </span>
            </header>
            <p className="scenario-blurb">{s.blurb}</p>
            <BarChart bars={bars} bestIndex={s.bestIndex} format={p.format} />
            <p className="recommendation">💡 {p.recommend(s)}</p>
          </article>
        )
      })}
    </section>
  )
}
