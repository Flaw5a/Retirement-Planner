import { HMRC } from './hmrc.js'
import { marginalRate } from './tax.js'
import {
  projectHouseholdAccumulation,
  householdRetirementOffset,
  potsAtRetirement,
  PEOPLE,
  BASE_YEAR,
} from './projection.js'
import {
  simulateHouseholdDrawdown,
  sustainableHouseholdIncome,
} from './drawdown.js'
import { giftingImpact, inheritanceTax, estateValue, pensionIhtImpact } from './iht.js'

// Whole-life household fund trajectory: accumulation (each partner accumulating
// until their OWN retirement) stitched onto the household drawdown, indexed by
// years-from-now `t` and calendar year. The two phases meet at the first
// retirement: accumulation runs to the later retirement, drawdown from the
// earlier one, so the overlap years appear in both — we take accumulation for
// t before the first retirement and drawdown from then on.
export function buildTrajectory(plan, options = {}) {
  const targetIncome = options.targetIncome ?? plan.targetIncome
  const acc = projectHouseholdAccumulation(plan)

  const offsets = {}
  for (const who of PEOPLE) {
    const person = plan.people[who]
    offsets[who] = Math.max(0, (person.retirementAge || 0) - (person.currentAge || 0))
  }
  const firstRetireT = Math.min(...PEOPLE.map((who) => offsets[who]))

  const series = []
  // Accumulation phase: t = 0 .. firstRetireT - 1 (before anyone spends).
  for (const s of acc) {
    if (s.t >= firstRetireT) break
    series.push({
      t: s.t,
      year: s.year,
      ages: s.ages,
      phase: 'accumulation',
      pension: s.pension,
      isa: s.isa,
      cash: s.cash,
      property: s.property,
      investable: s.investable,
      total: s.total,
      spIncome: 0,
    })
  }

  // Property grows per each owner's own property growth, tracked from today.
  const propBase = {}
  const propGrowth = {}
  for (const who of PEOPLE) {
    propBase[who] = plan.people[who].pots?.property?.balance || 0
    propGrowth[who] = plan.people[who].pots?.property?.growth || 0
  }
  function householdProperty(t) {
    let total = 0
    for (const who of PEOPLE) total += propBase[who] * Math.pow(1 + propGrowth[who], t)
    return total
  }

  // Drawdown phase: from firstRetireT onward, using the household sim.
  const sim = simulateHouseholdDrawdown(plan, { targetIncome })
  for (const row of sim.rows) {
    const property = householdProperty(row.t)
    series.push({
      t: row.t,
      year: row.year,
      ages: row.ages,
      phase: 'drawdown',
      pension: row.pension.total,
      isa: row.isa,
      cash: row.cash,
      property,
      investable: row.pension.total + row.isa + row.cash,
      total: row.pension.total + row.isa + row.cash + property,
      spIncome: row.spIncome.total,
    })
  }

  // Per-partner retirement and State Pension markers (calendar year + age).
  const retirementMarkers = {}
  const spMarkers = {}
  for (const who of PEOPLE) {
    const person = plan.people[who]
    const rOff = offsets[who]
    retirementMarkers[who] = {
      t: rOff,
      year: BASE_YEAR + rOff,
      age: person.retirementAge || 0,
    }
    const sp = person.statePension || {}
    const deferYears = sp.deferYears || 0
    const spAge = (sp.startAge ?? HMRC.statePension.age) + deferYears
    const spOff = Math.max(0, spAge - (person.currentAge || 0))
    spMarkers[who] = { t: spOff, year: BASE_YEAR + spOff, age: spAge }
  }

  return {
    series,
    retirementMarkers,
    spMarkers,
    depletionYear: sim.depletionYear,
    baseYear: BASE_YEAR,
  }
}

// Deep-clone the household plan shape so scenario variants don't mutate state.
function clonePlan(plan) {
  const people = {}
  for (const who of PEOPLE) {
    const p = plan.people[who]
    people[who] = {
      ...p,
      pots: {
        pension: { ...p.pots.pension },
        isa: { ...p.pots.isa },
        cash: { ...p.pots.cash },
        property: { ...p.pots.property },
      },
      lgps: { ...p.lgps },
      statePension: { ...p.statePension },
      giftsIn: [...(p.giftsIn || [])],
    }
  }
  return {
    ...plan,
    estate: { ...plan.estate },
    people,
  }
}

function indexOfMax(bars) {
  let best = 0
  for (let i = 1; i < bars.length; i++) if (bars[i].value > bars[best].value) best = i
  return best
}

function indexOfMin(bars) {
  let best = 0
  for (let i = 1; i < bars.length; i++) if (bars[i].value < bars[best].value) best = i
  return best
}

const PERSON_LABEL = { male: 'Partner A', female: 'Partner B' }

// 1) Where the SELECTED person's new monthly money is best put. Routes that
// person's net monthly contributions to ISA, pension (grossed up by their
// marginal relief), or a 50/50 split — the partner is held fixed. Metric:
// HOUSEHOLD sustainable yearly income.
function contributionScenario(plan, who) {
  const person = plan.people[who]
  const investableMonthly =
    (person.pots.pension.monthly || 0) +
    (person.pots.isa.monthly || 0) +
    (person.pots.cash.monthly || 0)
  const relief = marginalRate(person.grossSalary || 0) || HMRC.incomeTax.bands[0].rate
  const uplift = 1 / (1 - relief)

  function variant(label, alloc) {
    const p = clonePlan(plan)
    const pots = p.people[who].pots
    pots.pension.monthly = 0
    pots.isa.monthly = 0
    pots.cash.monthly = 0
    if (alloc === 'pension') pots.pension.monthly = investableMonthly * uplift
    else if (alloc === 'isa') pots.isa.monthly = investableMonthly
    else {
      pots.pension.monthly = (investableMonthly / 2) * uplift
      pots.isa.monthly = investableMonthly / 2
    }
    return { label, value: sustainableHouseholdIncome(p), meta: { who } }
  }

  const bars = [
    variant('All to pension', 'pension'),
    variant('All to ISA', 'isa'),
    variant('Split 50/50', 'split'),
  ]
  return {
    key: 'contribution',
    title: `Where ${PERSON_LABEL[who]} should put new monthly money`,
    blurb: `Routing ${PERSON_LABEL[who]}'s ${Math.round(investableMonthly)}/month of contributions, pension gets ${Math.round((uplift - 1) * 100)}% tax relief on the way in but is taxed on the way out; ISA is the reverse. Metric is household income.`,
    unit: 'income',
    lowerIsBetter: false,
    bars,
    bestIndex: indexOfMax(bars),
  }
}

// 2) Effect of the SELECTED person retiring at different ages, partner fixed.
// Metric: HOUSEHOLD sustainable yearly income.
function retirementAgeScenario(plan, who) {
  const person = plan.people[who]
  const candidates = [...new Set([60, 65, person.retirementAge, HMRC.statePension.age])]
    .filter((a) => a > person.currentAge)
    .sort((a, b) => a - b)

  const bars = candidates.map((age) => {
    const p = clonePlan(plan)
    p.people[who].retirementAge = age
    const pot = potsAtRetirement(p.people[who]).investable
    return { label: `Retire at ${age}`, value: sustainableHouseholdIncome(p), meta: { age, pot, who } }
  })
  return {
    key: 'retirementAge',
    title: `When ${PERSON_LABEL[who]} retires`,
    blurb: `Working longer means more contributions, more growth and fewer drawdown years for ${PERSON_LABEL[who]} — so a higher household sustainable income. The trade-off is time.`,
    unit: 'income',
    lowerIsBetter: false,
    bars,
    bestIndex: indexOfMax(bars),
  }
}

// 3) HOUSEHOLD-level order pots are drawn in. Metric: total income tax across
// retirement (lower is better). Also reports the depletion year, if any.
function drawdownOrderScenario(plan) {
  const orders = [
    { label: 'ISA & cash first', order: ['cash', 'isa', 'pension'] },
    { label: 'Pension first', order: ['pension', 'cash', 'isa'] },
    { label: 'Balanced', order: ['cash', 'pension', 'isa'] },
  ]
  const bars = orders.map(({ label, order }) => {
    const sim = simulateHouseholdDrawdown(plan, { order, targetIncome: plan.targetIncome })
    return {
      label,
      value: sim.totalTaxPaid,
      meta: { depletionYear: sim.depletionYear, order },
    }
  })
  return {
    key: 'drawdownOrder',
    title: 'Which pots to draw first',
    blurb: 'Spending ISA and cash first keeps more in tax wrappers; pension withdrawals are taxable. Note: from Apr 2027 unused pensions count for IHT, so the lowest-income-tax order is not always the most estate-efficient.',
    unit: 'tax',
    lowerIsBetter: true,
    bars,
    bestIndex: indexOfMin(bars),
  }
}

// 4) The SELECTED person taking the State Pension on time vs deferring, partner
// fixed. Metric: HOUSEHOLD sustainable income.
function deferStatePensionScenario(plan, who) {
  const defers = [0, 1, 2, 3]
  const bars = defers.map((d) => {
    const p = clonePlan(plan)
    p.people[who].statePension = { ...p.people[who].statePension, deferYears: d }
    const spAnnual =
      (p.people[who].statePension.annual || 0) * (1 + HMRC.statePension.deferralUpliftPerYear * d)
    return {
      label: d === 0 ? 'Take on time' : `Defer ${d}yr`,
      value: sustainableHouseholdIncome(p),
      meta: { deferYears: d, spAnnual, who },
    }
  })
  return {
    key: 'deferStatePension',
    title: `Should ${PERSON_LABEL[who]} defer the State Pension?`,
    blurb: `Each year ${PERSON_LABEL[who]} defers raises their State Pension by about ${Math.round(HMRC.statePension.deferralUpliftPerYear * 100)}% for life — worth it if you expect a long retirement.`,
    unit: 'income',
    lowerIsBetter: false,
    bars,
    bestIndex: indexOfMax(bars),
  }
}

// 5) HOUSEHOLD gifting to children. Metric: total passed to children (gifts
// already made plus the estate remaining after IHT).
function giftingScenario(plan) {
  const horizon = Math.max(
    0,
    ...PEOPLE.map((who) => (plan.people[who].lifeExpectancy || 95) - plan.people[who].currentAge),
  )
  const strategies = [
    { label: 'No gifting', annualGift: 0 },
    { label: `£${HMRC.iht.annualGiftExemption / 1000}k/yr exempt`, annualGift: HMRC.iht.annualGiftExemption },
    { label: '£10k/yr to kids', annualGift: 10000 },
  ]
  const bars = strategies.map(({ label, annualGift }) => {
    const gi = giftingImpact(plan, { annualGift, years: horizon })
    return {
      label,
      value: gi.netToHeirsAfter,
      meta: { ihtAfter: gi.ihtAfter, ihtSaved: gi.ihtSaved, gifted: gi.giftedTotal },
    }
  })
  return {
    key: 'gifting',
    title: 'Gifting to your children',
    blurb: 'Gifts that you survive by 7 years fall outside your estate; the £3,000 annual exemption and regular gifts out of surplus income are exempt immediately.',
    unit: 'estate',
    lowerIsBetter: false,
    bars,
    bestIndex: indexOfMax(bars),
  }
}

// Household-level levers (drawdown order, gifting) stay global; the inherently
// personal levers act on the selected `who`, partner held fixed. All metrics
// use household sustainable income / household tax.
export function buildScenarios(plan, { who = 'male' } = {}) {
  return [
    contributionScenario(plan, who),
    retirementAgeScenario(plan, who),
    drawdownOrderScenario(plan),
    deferStatePensionScenario(plan, who),
    giftingScenario(plan),
  ]
}

// Headline numbers for the dashboard, summed across the household.
export function buildSummary(plan) {
  const acc = projectHouseholdAccumulation(plan)
  const horizon = householdRetirementOffset(plan)
  const atRetirement = acc[horizon] // household pots when the LATER partner retires
  const sim = simulateHouseholdDrawdown(plan, { targetIncome: plan.targetIncome })
  const sustainable = sustainableHouseholdIncome(plan)
  const estate = estateValue(plan, { includePensions: true })
  const iht = inheritanceTax(estate, {
    married: plan.estate?.married,
    leaveHomeToDescendants: plan.estate?.leaveHomeToDescendants ?? true,
    charityTenPercent: plan.estate?.charityTenPercent || false,
  })
  return {
    potAtRetirement: atRetirement.investable,
    totalWealthAtRetirement: atRetirement.total,
    sustainableIncome: sustainable,
    targetIncome: plan.targetIncome,
    depletionYear: sim.depletionYear,
    totalTaxInRetirement: sim.totalTaxPaid,
    estateValue: estate,
    ihtDue: iht.tax,
    pensionIht: pensionIhtImpact(plan),
  }
}
