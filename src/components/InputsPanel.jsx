import { useState } from 'react'
import Field from './Field.jsx'
import { ASSET_STACK } from './chartMeta.js'

const POT_HINTS = {
  pension: 'Defined-contribution / SIPP pots (not LGPS)',
  isa: 'Stocks & shares / cash ISAs',
  cash: 'Savings outside an ISA',
  property:
    'Enter your SHARE of jointly-owned property (e.g. split 50/50) to avoid double-counting.',
}

const INTO_OPTIONS = ASSET_STACK.map((a) => ({ value: a.key, label: a.label }))

const PEOPLE = [
  { key: 'male', label: 'Partner A' },
  { key: 'female', label: 'Partner B' },
]

export default function InputsPanel({
  plan,
  setHousehold,
  setPersonField,
  setPot,
  setSection,
  setEstate,
  addGift,
  updateGift,
  removeGift,
  reset,
}) {
  const [who, setWho] = useState('male')

  return (
    <section className="inputs">
      <div className="inputs-head">
        <p className="section-intro">
          Enter your figures below — everything saves automatically and recalculates live. The
          household shares inflation, the joint income target and the estate; each partner has their
          own pots, pensions and gifts.
        </p>
        <button className="ghost" onClick={reset}>Reset to example</button>
      </div>

      {/* Always-visible shared household fields */}
      <fieldset>
        <legend>Household</legend>
        <div className="field-grid">
          <Field
            kind="currency"
            label="Joint target income / yr"
            value={plan.targetIncome}
            onChange={(v) => setHousehold('targetIncome', v)}
            hint="Net, in today's money"
          />
          <Field
            kind="percent"
            label="Inflation"
            value={plan.inflation}
            onChange={(v) => setHousehold('inflation', v)}
          />
          <Field
            kind="currency"
            label="Other estate"
            value={plan.estate.otherEstate}
            onChange={(v) => setEstate('otherEstate', v)}
            hint="Possessions, etc. (shared)"
          />
          <Field
            kind="checkbox"
            label="Married / civil partner"
            value={plan.estate.married}
            onChange={(v) => setEstate('married', v)}
          />
          <Field
            kind="checkbox"
            label="Leaving home to children"
            value={plan.estate.leaveHomeToDescendants}
            onChange={(v) => setEstate('leaveHomeToDescendants', v)}
          />
          <Field
            kind="checkbox"
            label="Leaving 10%+ to charity"
            value={plan.estate.charityTenPercent}
            onChange={(v) => setEstate('charityTenPercent', v)}
          />
        </div>
      </fieldset>

      {/* Person toggle keeps the two partner sections compact */}
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

      <PersonInputs
        who={who}
        person={plan.people[who]}
        setPersonField={setPersonField}
        setPot={setPot}
        setSection={setSection}
        addGift={addGift}
        updateGift={updateGift}
        removeGift={removeGift}
      />
    </section>
  )
}

function PersonInputs({ who, person, setPersonField, setPot, setSection, addGift, updateGift, removeGift }) {
  return (
    <div className="person-inputs">
      <fieldset>
        <legend>About this partner</legend>
        <div className="field-grid">
          <Field kind="number" label="Current age" value={person.currentAge} onChange={(v) => setPersonField(who, 'currentAge', v)} />
          <Field kind="number" label="Retirement age" value={person.retirementAge} onChange={(v) => setPersonField(who, 'retirementAge', v)} />
          <Field kind="number" label="Plan to age" value={person.lifeExpectancy} onChange={(v) => setPersonField(who, 'lifeExpectancy', v)} hint="Life expectancy" />
          <Field kind="currency" label="Current gross salary" value={person.grossSalary} onChange={(v) => setPersonField(who, 'grossSalary', v)} hint="Sets pension tax-relief rate" />
        </div>
      </fieldset>

      <fieldset>
        <legend>Pots</legend>
        {ASSET_STACK.map((a) => (
          <div key={a.key} className="pot-row">
            <div className="pot-name">
              <span className="legend-swatch" style={{ background: a.color }} />
              {a.label}
              <span className="field-hint">{POT_HINTS[a.key]}</span>
            </div>
            <div className="field-grid pot-fields">
              <Field kind="currency" label="Current value" value={person.pots[a.key].balance} onChange={(v) => setPot(who, a.key, 'balance', v)} />
              <Field kind="currency" label="Monthly in" value={person.pots[a.key].monthly} onChange={(v) => setPot(who, a.key, 'monthly', v)} />
              <Field kind="percent" label="Growth / yr" value={person.pots[a.key].growth} onChange={(v) => setPot(who, a.key, 'growth', v)} />
            </div>
          </div>
        ))}
      </fieldset>

      <fieldset>
        <legend>LGPS (defined-benefit pension)</legend>
        <div className="field-grid">
          <Field kind="currency" label="Annual pension" value={person.lgps.annualPension} onChange={(v) => setSection(who, 'lgps', 'annualPension', v)} hint="From your benefit statement" />
          <Field kind="currency" label="Automatic lump sum" value={person.lgps.lumpSum} onChange={(v) => setSection(who, 'lgps', 'lumpSum', v)} />
          <Field kind="number" label="Starts at age" value={person.lgps.startAge} onChange={(v) => setSection(who, 'lgps', 'startAge', v)} />
          <Field kind="percent" label="Revaluation / yr" value={person.lgps.revaluation} onChange={(v) => setSection(who, 'lgps', 'revaluation', v)} />
        </div>
      </fieldset>

      <fieldset>
        <legend>State Pension</legend>
        <div className="field-grid">
          <Field kind="currency" label="Annual amount" value={person.statePension.annual} onChange={(v) => setSection(who, 'statePension', 'annual', v)} hint="Full new = ~£12,548" />
          <Field kind="number" label="Starts at age" value={person.statePension.startAge} onChange={(v) => setSection(who, 'statePension', 'startAge', v)} />
          <Field kind="number" label="Years deferred" value={person.statePension.deferYears} onChange={(v) => setSection(who, 'statePension', 'deferYears', v)} />
        </div>
      </fieldset>

      <fieldset>
        <legend>Gifts received (e.g. from grandparents)</legend>
        {person.giftsIn.length === 0 && <p className="muted">No gifts added.</p>}
        {person.giftsIn.map((g) => (
          <div key={g.id} className="field-grid gift-row">
            <Field kind="number" label="At their age" value={g.age} onChange={(v) => updateGift(who, g.id, 'age', v)} />
            <Field kind="currency" label="Amount" value={g.amount} onChange={(v) => updateGift(who, g.id, 'amount', v)} />
            <Field kind="select" label="Add to" value={g.into} options={INTO_OPTIONS} onChange={(v) => updateGift(who, g.id, 'into', v)} />
            <button className="ghost danger gift-remove" onClick={() => removeGift(who, g.id)}>Remove</button>
          </div>
        ))}
        <button className="ghost" onClick={() => addGift(who)}>+ Add a gift</button>
      </fieldset>
    </div>
  )
}
