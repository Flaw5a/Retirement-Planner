// Accumulation engine: grows each pot from the current age to retirement, with
// monthly contributions, annual growth, and any one-off gifts received.
//
// The plan shape consumed here (see usePlan.js for the full default):
//   {
//     currentAge, retirementAge,
//     inflation,                       // decimal, e.g. 0.025
//     pots: {                          // money-purchase / liquid pots
//       pension: { balance, monthly, growth },
//       isa:     { balance, monthly, growth },
//       cash:    { balance, monthly, growth },
//       property:{ balance, monthly, growth },
//     },
//     giftsIn: [{ age, amount, into }], // lump sums received, added at that age
//     lgps: { annualPension, lumpSum, startAge, revaluation },
//     statePension: { annual, startAge, deferYears },
//   }

export const POT_KEYS = ['pension', 'isa', 'cash', 'property']

// Pots that fund retirement spending (property is wealth but not drawn for
// income in this model — it sits separately unless explicitly released).
export const INVESTABLE_KEYS = ['pension', 'isa', 'cash']

// The two partners in a household plan. Each lives under plan.people[who] and
// has the same per-person shape the single-person engine consumes.
export const PEOPLE = ['male', 'female']

// Calendar year that t=0 represents. The household series is indexed by
// years-from-now (t); calendar year = BASE_YEAR + t so partners of different
// ages line up on the same year.
export const BASE_YEAR = 2026

// Compound one pot for a year: contributions added monthly, growth applied
// monthly. Returns the end-of-year balance.
export function growPotOneYear(balance, monthlyContribution, annualGrowth) {
  const monthlyRate = annualGrowth / 12
  let b = balance
  for (let m = 0; m < 12; m++) {
    b = b * (1 + monthlyRate) + monthlyContribution
  }
  return b
}

function snapshot(age, bal) {
  const investable = INVESTABLE_KEYS.reduce((sum, k) => sum + (bal[k] || 0), 0)
  return {
    age,
    pension: bal.pension || 0,
    isa: bal.isa || 0,
    cash: bal.cash || 0,
    property: bal.property || 0,
    investable,
    total: investable + (bal.property || 0),
  }
}

// Year-by-year balances from currentAge to retirementAge (inclusive of both).
export function projectAccumulation(plan) {
  const { currentAge, retirementAge, giftsIn = [] } = plan
  const bal = {}
  for (const key of POT_KEYS) bal[key] = plan.pots?.[key]?.balance || 0

  const series = [snapshot(currentAge, bal)]

  for (let age = currentAge; age < retirementAge; age++) {
    for (const g of giftsIn) {
      if (g.age === age && bal[g.into] != null) bal[g.into] += g.amount || 0
    }
    for (const key of POT_KEYS) {
      const pot = plan.pots?.[key] || {}
      bal[key] = growPotOneYear(bal[key], pot.monthly || 0, pot.growth || 0)
    }
    series.push(snapshot(age + 1, bal))
  }
  return series
}

// Balances at retirement (last accumulation snapshot).
export function potsAtRetirement(plan) {
  const series = projectAccumulation(plan)
  return series[series.length - 1]
}

// Inflation deflator: a nominal £ `years` in the future is worth
// amount / deflator(years) in today's money.
export function deflator(years, inflation) {
  return Math.pow(1 + (inflation || 0), Math.max(0, years))
}

export function toTodaysMoney(amount, years, inflation) {
  return amount / deflator(years, inflation)
}

// A person's retirement offset = years from now until they retire.
function retirementOffset(person) {
  return Math.max(0, (person.retirementAge || 0) - (person.currentAge || 0))
}

// The household's accumulation horizon: the LATER of the two retirement offsets,
// so the chart's accumulation phase runs until the second partner retires.
export function householdRetirementOffset(plan) {
  return Math.max(...PEOPLE.map((who) => retirementOffset(plan.people[who])))
}

// Combined accumulation series indexed by years-from-now (t). Each partner's
// pots are taken from their OWN accumulation snapshot at min(t, theirOffset) —
// i.e. they keep accumulating until their own retirement, then hold flat — and
// the asset classes are summed across both partners.
export function projectHouseholdAccumulation(plan) {
  const horizon = householdRetirementOffset(plan)
  const perPerson = {}
  const offsets = {}
  for (const who of PEOPLE) {
    const person = plan.people[who]
    perPerson[who] = projectAccumulation(person)
    offsets[who] = retirementOffset(person)
  }

  const series = []
  for (let t = 0; t <= horizon; t++) {
    const ages = {}
    let pension = 0
    let isa = 0
    let cash = 0
    let property = 0
    for (const who of PEOPLE) {
      const person = plan.people[who]
      ages[who] = (person.currentAge || 0) + t
      const idx = Math.min(t, offsets[who]) // hold flat after their retirement
      const snap = perPerson[who][idx]
      pension += snap.pension
      isa += snap.isa
      cash += snap.cash
      property += snap.property
    }
    const investable = pension + isa + cash
    series.push({
      t,
      year: BASE_YEAR + t,
      ages,
      pension,
      isa,
      cash,
      property,
      investable,
      total: investable + property,
    })
  }
  return series
}

// LGPS defined-benefit entitlement carried to retirement. The user enters the
// projected annual pension (and any automatic lump sum) from their benefit
// statement; an optional revaluation rate grows it to the retirement year.
export function lgpsAtRetirement(lgps = {}, currentAge, retirementAge) {
  const years = Math.max(0, retirementAge - currentAge)
  const factor = Math.pow(1 + (lgps.revaluation || 0), years)
  return {
    annualPension: (lgps.annualPension || 0) * factor,
    lumpSum: (lgps.lumpSum || 0) * factor,
    startAge: lgps.startAge ?? retirementAge,
  }
}
