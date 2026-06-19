import { HMRC } from './hmrc.js'
import { incomeTax } from './tax.js'
import { potsAtRetirement, lgpsAtRetirement, growPotOneYear, PEOPLE, BASE_YEAR } from './projection.js'

// Retirement-income engine. From the retirement age to life expectancy it draws
// down the pots each year to meet a target net (after-tax) income, layering in
// LGPS and the State Pension, and reporting the tax paid and the age (if any)
// the investable pots run out.
//
// Pension withdrawals are modelled UFPLS-style: each £1 taken is 25% tax-free
// and 75% taxable income. ISA and cash withdrawals are tax-free.

const TF = HMRC.pension.taxFreeLumpSumRate // tax-free proportion of a pension withdrawal

// Net cash received from a gross pension withdrawal, given other taxable income
// already in the year (State Pension + LGPS + any pension already taken).
export function netFromPensionGross(grossPension, otherTaxable, cfg = HMRC.incomeTax) {
  if (grossPension <= 0) return 0
  const taxablePart = grossPension * (1 - TF)
  const extraTax = incomeTax(otherTaxable + taxablePart, cfg) - incomeTax(otherTaxable, cfg)
  return grossPension - extraTax
}

// Smallest gross pension withdrawal whose net meets `targetNet`, capped at the
// available balance. netFromPensionGross is monotonic in gross, so we bisect.
export function solvePensionGross(targetNet, otherTaxable, maxGross, cfg = HMRC.incomeTax) {
  if (targetNet <= 0 || maxGross <= 0) return 0
  if (targetNet >= netFromPensionGross(maxGross, otherTaxable, cfg)) return maxGross
  let lo = 0
  let hi = maxGross
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (netFromPensionGross(mid, otherTaxable, cfg) < targetNet) lo = mid
    else hi = mid
  }
  return hi
}

const DEFAULT_ORDER = ['cash', 'isa', 'pension']

// Run the full year-by-year drawdown.
// options: { order, targetIncome, lifeExpectancy, inflateTarget }
export function simulateDrawdown(plan, options = {}) {
  const cfg = HMRC.incomeTax
  const { currentAge, retirementAge } = plan
  const order = options.order || DEFAULT_ORDER
  const inflateTarget = options.inflateTarget !== false
  const lifeExpectancy = options.lifeExpectancy ?? plan.lifeExpectancy ?? 95
  const inflation = plan.inflation || 0
  const targetIncome = options.targetIncome ?? plan.targetIncome ?? 0

  const start = potsAtRetirement(plan)
  const bal = { pension: start.pension, isa: start.isa, cash: start.cash }

  const lgps = lgpsAtRetirement(plan.lgps, currentAge, retirementAge)
  const sp = plan.statePension || {}
  const deferYears = sp.deferYears || 0
  const spAnnual = (sp.annual || 0) * (1 + HMRC.statePension.deferralUpliftPerYear * deferYears)
  const spStartAge = (sp.startAge ?? HMRC.statePension.age) + deferYears

  const rows = []
  let depletionAge = null
  let totalTaxPaid = 0
  let totalNetIncome = 0

  for (let age = retirementAge; age <= lifeExpectancy; age++) {
    const yearsFromRetire = age - retirementAge
    const target = inflateTarget
      ? targetIncome * Math.pow(1 + inflation, yearsFromRetire)
      : targetIncome

    const lgpsIncome = age >= lgps.startAge ? lgps.annualPension : 0
    const spIncome = age >= spStartAge ? spAnnual : 0
    const guaranteedGross = lgpsIncome + spIncome
    const netGuaranteed = guaranteedGross - incomeTax(guaranteedGross, cfg)

    let remainingNet = target - netGuaranteed
    let cashDrawn = 0
    let isaDrawn = 0
    let pensionGross = 0

    for (const src of order) {
      if (remainingNet <= 0.01) break
      if (src === 'cash' || src === 'isa') {
        const take = Math.min(bal[src], remainingNet)
        bal[src] -= take
        remainingNet -= take
        if (src === 'cash') cashDrawn = take
        else isaDrawn = take
      } else if (src === 'pension') {
        const gross = solvePensionGross(remainingNet, guaranteedGross, bal.pension, cfg)
        bal.pension -= gross
        pensionGross = gross
        remainingNet -= netFromPensionGross(gross, guaranteedGross, cfg)
      }
    }

    const netPension = netFromPensionGross(pensionGross, guaranteedGross, cfg)
    const actualNet = netGuaranteed + cashDrawn + isaDrawn + netPension
    const shortfall = Math.max(0, target - actualNet)
    const taxableIncome = guaranteedGross + pensionGross * (1 - TF)
    const tax = incomeTax(taxableIncome, cfg)

    if (shortfall > 1 && depletionAge === null) depletionAge = age

    // Grow the remaining pots into next year.
    for (const key of ['pension', 'isa', 'cash']) {
      bal[key] = bal[key] * (1 + (plan.pots?.[key]?.growth || 0))
    }

    totalTaxPaid += tax
    totalNetIncome += actualNet

    rows.push({
      age,
      target,
      lgpsIncome,
      spIncome,
      guaranteedGross,
      cashDrawn,
      isaDrawn,
      pensionGross,
      taxableIncome,
      tax,
      netIncome: actualNet,
      shortfall,
      pension: bal.pension,
      isa: bal.isa,
      cash: bal.cash,
      potTotal: bal.pension + bal.isa + bal.cash,
    })
  }

  return { rows, depletionAge, totalTaxPaid, totalNetIncome }
}

// Highest constant (inflation-linked) target income that lasts to life
// expectancy without the pots running dry. Bisects on the target.
export function sustainableIncome(plan, options = {}) {
  let lo = 0
  let hi = 500000
  // If even £500k/yr never depletes (huge pots), return the upper bound.
  if (simulateDrawdown(plan, { ...options, targetIncome: hi }).depletionAge === null) {
    return hi
  }
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const { depletionAge } = simulateDrawdown(plan, { ...options, targetIncome: mid })
    if (depletionAge === null) lo = mid
    else hi = mid
  }
  return lo
}

// ============================================================================
// HOUSEHOLD (couple) drawdown — a single unified per-person walk
// ============================================================================
// Partners differ in age, so we walk by years-from-now `t` (and calendar year),
// not by age. Each partner has three life stages within the walk:
//   • ACCUMULATING  (age < retirementAge): pots grow with monthly contributions,
//     growth and gifts; they fund NOTHING and their pension is NOT drawn.
//   • RETIRED       (age >= retirementAge): pots join the household pool; LGPS
//     switches on at lgps.startAge, State Pension at spStartAge.
//   • DEAD          (age > lifeExpectancy): on first death their remaining pots
//     transfer to the survivor.
// Household SPENDING starts from the EARLIER retirement (first year either
// partner is retired). Each spending year: each retired partner's guaranteed
// gross is taxed with their OWN incomeTax(); the household draws the remaining
// net from pooled cash -> pooled ISA -> pension; pension is split between
// retired owners in proportion to their pension balances (each solved with
// solvePensionGross at that owner's marginal position).

// Per-person fixed retirement parameters derived once up front.
function personParams(person) {
  const currentAge = person.currentAge || 0
  const retirementAge = person.retirementAge || 0
  const lifeExpectancy = person.lifeExpectancy ?? 95
  const lgps = lgpsAtRetirement(person.lgps, currentAge, retirementAge)
  const sp = person.statePension || {}
  const deferYears = sp.deferYears || 0
  const spAnnual = (sp.annual || 0) * (1 + HMRC.statePension.deferralUpliftPerYear * deferYears)
  const spStartAge = (sp.startAge ?? HMRC.statePension.age) + deferYears
  return { currentAge, retirementAge, lifeExpectancy, lgps, spAnnual, spStartAge }
}

export function simulateHouseholdDrawdown(plan, options = {}) {
  const cfg = HMRC.incomeTax
  const order = options.order || DEFAULT_ORDER
  const inflateTarget = options.inflateTarget !== false
  const inflation = plan.inflation || 0
  const targetIncome = options.targetIncome ?? plan.targetIncome ?? 0

  const params = {}
  const offsets = {} // retirement offset (years from now)
  const deathOffset = {} // last offset alive (lifeExpectancy - currentAge)
  for (const who of PEOPLE) {
    const person = plan.people[who]
    params[who] = personParams(person)
    offsets[who] = Math.max(0, params[who].retirementAge - params[who].currentAge)
    deathOffset[who] = Math.max(0, params[who].lifeExpectancy - params[who].currentAge)
  }

  // Walk from now (t=0) to the LATER life-expectancy offset. Accumulation up to
  // each partner's own retirement is handled inline so a partner's pension can
  // never be drawn early.
  const endT = Math.max(...PEOPLE.map((who) => deathOffset[who]))
  const firstRetireT = Math.min(...PEOPLE.map((who) => offsets[who]))

  // Live pot balances per partner, seeded at today's balances, then advanced by
  // accumulation up to the walk's start (the first retirement). A partner who
  // is still accumulating at that point has their contributions/growth/gifts
  // applied here so the walk begins with correct balances; a partner who has
  // already retired by then stops accumulating at their own retirement.
  const bal = {}
  for (const who of PEOPLE) {
    const pots = plan.people[who].pots || {}
    const b = {
      pension: pots.pension?.balance || 0,
      isa: pots.isa?.balance || 0,
      cash: pots.cash?.balance || 0,
    }
    const p = params[who]
    for (let t = 0; t < firstRetireT; t++) {
      const age = p.currentAge + t
      if (age >= p.retirementAge) break // retired: held flat until the walk reaches it
      for (const g of plan.people[who].giftsIn || []) {
        if (g.age === age && b[g.into] != null) b[g.into] += g.amount || 0
      }
      for (const key of ['pension', 'isa', 'cash']) {
        b[key] = growPotOneYear(b[key], pots[key]?.monthly || 0, pots[key]?.growth || 0)
      }
    }
    bal[who] = b
  }

  const alive = { male: true, female: true }
  const transferred = { male: false, female: false }

  const rows = []
  let depletionYear = null
  let totalTaxPaid = 0
  let totalNetIncome = 0

  for (let t = firstRetireT; t <= endT; t++) {
    const year = BASE_YEAR + t

    // --- Resolve each partner's status this year -----------------------------
    const status = {}
    const ages = {}
    for (const who of PEOPLE) {
      const p = params[who]
      const age = p.currentAge + t
      ages[who] = alive[who] ? age : null
      if (!alive[who]) {
        status[who] = 'dead'
      } else if (age > p.lifeExpectancy) {
        // Death this year: transfer remaining pots to the survivor (once).
        status[who] = 'dead'
        ages[who] = null
      } else if (age >= p.retirementAge) {
        status[who] = 'retired'
      } else {
        status[who] = 'accumulating'
      }
    }

    // Apply first-death pot transfer to the survivor.
    for (const who of PEOPLE) {
      if (status[who] === 'dead' && alive[who] && !transferred[who]) {
        const survivor = PEOPLE.find((o) => o !== who)
        if (survivor && alive[survivor] && params[survivor].currentAge + t <= params[survivor].lifeExpectancy) {
          bal[survivor].pension += bal[who].pension
          bal[survivor].isa += bal[who].isa
          bal[survivor].cash += bal[who].cash
        }
        bal[who] = { pension: 0, isa: 0, cash: 0 }
        transferred[who] = true
        alive[who] = false
      }
    }

    const yearsFromFirstRetire = t - firstRetireT
    const target = inflateTarget
      ? targetIncome * Math.pow(1 + inflation, yearsFromFirstRetire)
      : targetIncome

    // --- Guaranteed income + per-person tax on it ----------------------------
    const guaranteedGross = { male: 0, female: 0, total: 0 }
    const lgpsIncome = { male: 0, female: 0, total: 0 }
    const spIncome = { male: 0, female: 0, total: 0 }
    let netGuaranteed = 0
    for (const who of PEOPLE) {
      if (status[who] !== 'retired') continue
      const p = params[who]
      const age = p.currentAge + t
      const lg = age >= p.lgps.startAge ? p.lgps.annualPension : 0
      const spv = age >= p.spStartAge ? p.spAnnual : 0
      lgpsIncome[who] = lg
      spIncome[who] = spv
      const gross = lg + spv
      guaranteedGross[who] = gross
      netGuaranteed += gross - incomeTax(gross, cfg)
    }
    lgpsIncome.total = lgpsIncome.male + lgpsIncome.female
    spIncome.total = spIncome.male + spIncome.female
    guaranteedGross.total = guaranteedGross.male + guaranteedGross.female

    // --- Draw the remaining net from pooled cash -> pooled ISA -> pension -----
    let remainingNet = target - netGuaranteed
    let cashDrawn = 0
    let isaDrawn = 0
    const pensionGross = { male: 0, female: 0, total: 0 }

    // Retired owners eligible to draw a pension this year.
    const pensionOwners = PEOPLE.filter((who) => status[who] === 'retired')

    for (const src of order) {
      if (remainingNet <= 0.01) break
      if (src === 'cash' || src === 'isa') {
        const pool = pensionOwners.reduce((s, who) => s + bal[who][src], 0)
        const take = Math.min(pool, Math.max(0, remainingNet))
        // Deduct proportionally across owners' balances in this class.
        if (pool > 0 && take > 0) {
          for (const who of pensionOwners) {
            bal[who][src] -= take * (bal[who][src] / pool)
          }
        }
        remainingNet -= take
        if (src === 'cash') cashDrawn = take
        else isaDrawn = take
      } else if (src === 'pension') {
        const totalPension = pensionOwners.reduce((s, who) => s + bal[who].pension, 0)
        if (totalPension <= 0 || remainingNet <= 0.01) continue
        // Split the required net between owners IN PROPORTION to their pension
        // balances; solve each owner's gross against THEIR own guaranteed gross.
        let netGot = 0
        for (const who of pensionOwners) {
          const share = remainingNet * (bal[who].pension / totalPension)
          const gross = solvePensionGross(share, guaranteedGross[who], bal[who].pension, cfg)
          bal[who].pension -= gross
          pensionGross[who] = gross
          netGot += netFromPensionGross(gross, guaranteedGross[who], cfg)
        }
        remainingNet -= netGot
      }
    }
    pensionGross.total = pensionGross.male + pensionGross.female

    // --- Per-person tax for the year (guaranteed + taxable 75% of pension) ----
    const taxableIncome = { male: 0, female: 0 }
    const tax = { male: 0, female: 0, total: 0 }
    let netPensionTotal = 0
    for (const who of PEOPLE) {
      const ti = guaranteedGross[who] + pensionGross[who] * (1 - TF)
      taxableIncome[who] = ti
      tax[who] = incomeTax(ti, cfg)
      netPensionTotal += netFromPensionGross(pensionGross[who], guaranteedGross[who], cfg)
    }
    tax.total = tax.male + tax.female

    const actualNet = netGuaranteed + cashDrawn + isaDrawn + netPensionTotal
    const shortfall = Math.max(0, target - actualNet)
    if (shortfall > 1 && depletionYear === null) depletionYear = { t, year }

    // --- Grow surviving partners' remaining pots into next year --------------
    for (const who of PEOPLE) {
      if (!alive[who]) continue
      const pots = plan.people[who].pots || {}
      const age = params[who].currentAge + t
      if (age >= params[who].retirementAge) {
        // Retired: simple growth on remaining balances.
        for (const key of ['pension', 'isa', 'cash']) {
          bal[who][key] = bal[who][key] * (1 + (pots[key]?.growth || 0))
        }
      } else {
        // Still accumulating: gifts received at this age, then contributions + growth.
        for (const g of plan.people[who].giftsIn || []) {
          if (g.age === age && bal[who][g.into] != null) bal[who][g.into] += g.amount || 0
        }
        for (const key of ['pension', 'isa', 'cash']) {
          bal[who][key] = growPotOneYear(bal[who][key], pots[key]?.monthly || 0, pots[key]?.growth || 0)
        }
      }
    }

    totalTaxPaid += tax.total
    totalNetIncome += actualNet

    const pension = {
      male: bal.male.pension,
      female: bal.female.pension,
      total: bal.male.pension + bal.female.pension,
    }
    const isa = bal.male.isa + bal.female.isa
    const cash = bal.male.cash + bal.female.cash

    rows.push({
      t,
      year,
      ages,
      target,
      guaranteedGross,
      lgpsIncome,
      spIncome,
      cashDrawn,
      isaDrawn,
      pensionGross,
      taxableIncome,
      tax,
      netIncome: actualNet,
      shortfall,
      pension,
      isa,
      cash,
      potTotal: pension.total + isa + cash,
    })
  }

  return { rows, depletionYear, totalTaxPaid, totalNetIncome }
}

// Highest constant (inflation-linked) household target income that lasts to the
// later life expectancy without the pooled pots running dry. Same bisection as
// the single-person version, against the household sim.
export function sustainableHouseholdIncome(plan, options = {}) {
  let lo = 0
  let hi = 500000
  if (simulateHouseholdDrawdown(plan, { ...options, targetIncome: hi }).depletionYear === null) {
    return hi
  }
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    const { depletionYear } = simulateHouseholdDrawdown(plan, { ...options, targetIncome: mid })
    if (depletionYear === null) lo = mid
    else hi = mid
  }
  return lo
}
