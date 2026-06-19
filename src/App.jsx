import { useMemo, useState } from 'react'
import { usePlan } from './hooks/usePlan.js'
import { TAX_YEAR, REVIEWED_ON } from './lib/hmrc.js'
import { buildTrajectory, buildSummary, buildScenarios } from './lib/scenarios.js'
import { simulateHouseholdDrawdown } from './lib/drawdown.js'
import Disclaimer from './components/Disclaimer.jsx'
import SummaryCards from './components/SummaryCards.jsx'
import InputsPanel from './components/InputsPanel.jsx'
import ProjectionChart from './components/ProjectionChart.jsx'
import RetirementIncomePanel from './components/RetirementIncomePanel.jsx'
import ScenarioComparison from './components/ScenarioComparison.jsx'
import EstatePanel from './components/EstatePanel.jsx'

const TABS = [
  { key: 'inputs', label: 'Inputs' },
  { key: 'projection', label: 'Projection' },
  { key: 'income', label: 'Retirement income' },
  { key: 'actions', label: 'Best actions' },
  { key: 'estate', label: 'Estate & gifting' },
]

export default function App() {
  const planState = usePlan()
  const { plan, setHousehold } = planState
  const [tab, setTab] = useState('projection')
  // Person selected for the personal scenarios on the Best actions tab.
  const [who, setWho] = useState('male')
  // Selected calendar year for the projection scrubber (null = use the default).
  const [selectedYear, setSelectedYear] = useState(null)

  const summary = useMemo(() => buildSummary(plan), [plan])
  const trajectory = useMemo(() => buildTrajectory(plan), [plan])
  const drawdown = useMemo(
    () => simulateHouseholdDrawdown(plan, { targetIncome: plan.targetIncome }),
    [plan],
  )
  // Heaviest computation — only when the Best actions tab is showing.
  const scenarios = useMemo(
    () => (tab === 'actions' ? buildScenarios(plan, { who }) : null),
    [plan, tab, who],
  )

  // Effective scrubber year: default to the EARLIER partner's retirement year,
  // clamped into the current series. Derived in render (no effect) so it tracks
  // the trajectory automatically; the explicit selection wins while it's valid.
  const { series, retirementMarkers } = trajectory
  let effectiveYear = selectedYear
  if (series.length) {
    const first = series[0].year
    const last = series[series.length - 1].year
    const fallback = Math.min(
      Math.max(first, Math.min(retirementMarkers.male.year, retirementMarkers.female.year)),
      last,
    )
    if (effectiveYear == null || effectiveYear < first || effectiveYear > last) {
      effectiveYear = fallback
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <div>
            <h1>Retirement Cash Flow Planner</h1>
            <p className="subtitle">
              Pensions · ISAs · Cash · LGPS · Property · Gifts — projected against {TAX_YEAR} HMRC rules
            </p>
          </div>
          <label className="real-toggle">
            <input
              type="checkbox"
              checked={plan.realTerms}
              onChange={(e) => setHousehold('realTerms', e.target.checked)}
            />
            Today's money
          </label>
        </div>
      </header>
      <div className="app">
      <Disclaimer />

      <SummaryCards summary={summary} plan={plan} />

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="panel">
        {tab === 'inputs' && <InputsPanel {...planState} />}
        {tab === 'projection' && (
          <ProjectionChart
            trajectory={trajectory}
            plan={plan}
            selectedYear={effectiveYear}
            setSelectedYear={setSelectedYear}
          />
        )}
        {tab === 'income' && <RetirementIncomePanel drawdown={drawdown} plan={plan} />}
        {tab === 'actions' && scenarios && (
          <ScenarioComparison scenarios={scenarios} who={who} setWho={setWho} />
        )}
        {tab === 'estate' && <EstatePanel plan={plan} trajectory={trajectory} />}
      </main>

      <footer className="app-footer">
        HMRC figures for {TAX_YEAR}, reviewed {REVIEWED_ON}. Update them in{' '}
        <code>src/lib/hmrc.js</code> each April to keep the model current.
      </footer>
    </div>
    </>
  )
}
