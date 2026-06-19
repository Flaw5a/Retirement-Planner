import { describe, it, expect } from 'vitest'
import { simulateDrawdown, sustainableIncome } from '../drawdown.js'
import { simulateHouseholdDrawdown, sustainableHouseholdIncome } from '../drawdown.js'

// A single partner's inputs in the household shape.
function person(overrides = {}) {
  return {
    currentAge: 60,
    retirementAge: 60,
    lifeExpectancy: 90,
    grossSalary: 0,
    pots: {
      pension: { balance: 0, monthly: 0, growth: 0 },
      isa: { balance: 0, monthly: 0, growth: 0 },
      cash: { balance: 0, monthly: 0, growth: 0 },
      property: { balance: 0, monthly: 0, growth: 0 },
    },
    giftsIn: [],
    lgps: { annualPension: 0, lumpSum: 0, startAge: 67, revaluation: 0 },
    statePension: { annual: 0, startAge: 67, deferYears: 0 },
    ...overrides,
  }
}

function household(male, female, top = {}) {
  return {
    inflation: 0,
    targetIncome: 0,
    estate: { married: true, leaveHomeToDescendants: true, otherEstate: 0 },
    people: { male: person(male), female: person(female) },
    ...top,
  }
}

describe('simulateHouseholdDrawdown — identical partners', () => {
  // Two identical partners retiring at the same age, at 2x a single person's
  // target, should give ~2x a single person's results.
  const potsSpec = {
    pension: { balance: 300000, monthly: 0, growth: 0.03 },
    isa: { balance: 100000, monthly: 0, growth: 0.03 },
    cash: { balance: 20000, monthly: 0, growth: 0.01 },
    property: { balance: 0, monthly: 0, growth: 0 },
  }
  const singlePlan = {
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 85,
    inflation: 0,
    targetIncome: 20000,
    pots: potsSpec,
    lgps: { annualPension: 0, lumpSum: 0, startAge: 67, revaluation: 0 },
    statePension: { annual: 11000, startAge: 67, deferYears: 0 },
  }
  const personSpec = {
    currentAge: 65,
    retirementAge: 65,
    lifeExpectancy: 85,
    pots: potsSpec,
    lgps: { annualPension: 0, lumpSum: 0, startAge: 67, revaluation: 0 },
    statePension: { annual: 11000, startAge: 67, deferYears: 0 },
  }

  it('household total tax ≈ 2x single tax at 2x target', () => {
    const single = simulateDrawdown(singlePlan, { targetIncome: 20000 })
    const hh = simulateHouseholdDrawdown(
      household(personSpec, personSpec, { inflation: 0 }),
      { targetIncome: 40000 },
    )
    expect(hh.totalTaxPaid).toBeCloseTo(single.totalTaxPaid * 2, -1)
    expect(hh.totalNetIncome).toBeCloseTo(single.totalNetIncome * 2, -1)
  })

  it('household pension pots are split 50/50 between identical owners', () => {
    const hh = simulateHouseholdDrawdown(
      household(personSpec, personSpec, { inflation: 0 }),
      { targetIncome: 40000 },
    )
    const r = hh.rows[0]
    expect(r.pension.male).toBeCloseTo(r.pension.female, 4)
    expect(r.pensionGross.male).toBeCloseTo(r.pensionGross.female, 4)
  })

  it('household sustainable income ≈ 2x single sustainable income', () => {
    const single = sustainableIncome(singlePlan)
    const hh = sustainableHouseholdIncome(household(personSpec, personSpec, { inflation: 0 }))
    expect(hh).toBeCloseTo(single * 2, -2)
  })
})

describe('simulateHouseholdDrawdown — calendar alignment for different ages', () => {
  it('lines up partners of different ages on the same calendar year and ages', () => {
    const hh = simulateHouseholdDrawdown(
      household(
        { currentAge: 60, retirementAge: 60, lifeExpectancy: 85 },
        { currentAge: 55, retirementAge: 60, lifeExpectancy: 85 },
      ),
      { targetIncome: 0 },
    )
    // first spending year is the EARLIER retirement: male at 60 (t=0), female 55
    const first = hh.rows[0]
    expect(first.t).toBe(0)
    expect(first.year).toBe(2026)
    expect(first.ages.male).toBe(60)
    expect(first.ages.female).toBe(55)
    // a later row: ages advance together by year
    const r5 = hh.rows.find((row) => row.t === 5)
    expect(r5.ages.male).toBe(65)
    expect(r5.ages.female).toBe(60)
  })
})

describe('simulateHouseholdDrawdown — pooled guaranteed income taxed per person', () => {
  it('taxes each partner separately, not the pooled total', () => {
    // Each partner has a State Pension of 20,000 (taxable). Taxed separately:
    // tax on 20,000 each = (20000-12570)*0.2 = 1486 each -> 2972 total.
    // If (wrongly) pooled to 40,000: (40000-12570)*0.2 = 5486. We expect 2972.
    const hh = simulateHouseholdDrawdown(
      household(
        { retirementAge: 60, lifeExpectancy: 61, statePension: { annual: 20000, startAge: 60, deferYears: 0 } },
        { retirementAge: 60, lifeExpectancy: 61, statePension: { annual: 20000, startAge: 60, deferYears: 0 } },
      ),
      { targetIncome: 0 },
    )
    const r = hh.rows[0]
    expect(r.tax.male).toBeCloseTo(1486, 0)
    expect(r.tax.female).toBeCloseTo(1486, 0)
    expect(r.tax.total).toBeCloseTo(2972, 0)
  })
})

describe('simulateHouseholdDrawdown — proportional pension split', () => {
  it('splits the required pension net in proportion to pension balances', () => {
    // Male pension 300k, female pension 100k -> 75/25 split of the gross draw,
    // no guaranteed income so tax positions are identical per pound.
    const hh = simulateHouseholdDrawdown(
      household(
        { retirementAge: 60, lifeExpectancy: 61, pots: { pension: { balance: 300000, monthly: 0, growth: 0 }, isa: { balance: 0, monthly: 0, growth: 0 }, cash: { balance: 0, monthly: 0, growth: 0 }, property: { balance: 0, monthly: 0, growth: 0 } } },
        { retirementAge: 60, lifeExpectancy: 61, pots: { pension: { balance: 100000, monthly: 0, growth: 0 }, isa: { balance: 0, monthly: 0, growth: 0 }, cash: { balance: 0, monthly: 0, growth: 0 }, property: { balance: 0, monthly: 0, growth: 0 } } },
      ),
      { targetIncome: 20000 },
    )
    const r = hh.rows[0]
    const ratio = r.pensionGross.male / (r.pensionGross.male + r.pensionGross.female)
    expect(ratio).toBeCloseTo(0.75, 2)
  })
})

describe('simulateHouseholdDrawdown — depletionYear', () => {
  it('is null for a comfortably funded household', () => {
    const hh = simulateHouseholdDrawdown(
      household(
        { retirementAge: 60, lifeExpectancy: 70, pots: { pension: { balance: 500000, monthly: 0, growth: 0.03 }, isa: { balance: 200000, monthly: 0, growth: 0.03 }, cash: { balance: 50000, monthly: 0, growth: 0.01 }, property: { balance: 0, monthly: 0, growth: 0 } } },
        { retirementAge: 60, lifeExpectancy: 70, pots: { pension: { balance: 500000, monthly: 0, growth: 0.03 }, isa: { balance: 200000, monthly: 0, growth: 0.03 }, cash: { balance: 50000, monthly: 0, growth: 0.01 }, property: { balance: 0, monthly: 0, growth: 0 } } },
      ),
      { targetIncome: 20000 },
    )
    expect(hh.depletionYear).toBeNull()
  })

  it('reports {t, year} for the first shortfall year when pots run dry', () => {
    const hh = simulateHouseholdDrawdown(
      household(
        { retirementAge: 60, lifeExpectancy: 95, pots: { pension: { balance: 5000, monthly: 0, growth: 0 }, isa: { balance: 0, monthly: 0, growth: 0 }, cash: { balance: 0, monthly: 0, growth: 0 }, property: { balance: 0, monthly: 0, growth: 0 } } },
        { retirementAge: 60, lifeExpectancy: 95, pots: { pension: { balance: 5000, monthly: 0, growth: 0 }, isa: { balance: 0, monthly: 0, growth: 0 }, cash: { balance: 0, monthly: 0, growth: 0 }, property: { balance: 0, monthly: 0, growth: 0 } } },
      ),
      { targetIncome: 30000 },
    )
    expect(hh.depletionYear).not.toBeNull()
    expect(hh.depletionYear.year).toBe(2026 + hh.depletionYear.t)
  })
})

describe('simulateHouseholdDrawdown — pension not drawn before retirement', () => {
  it("does not touch a partner's pension before they retire", () => {
    // Male retires at 60 (t=0), female (age 55) retires at 65 -> her offset is
    // 10 (t=10). The household needs pension money from the start; female's
    // pension must NOT be drawn until t=10.
    const hh = simulateHouseholdDrawdown(
      household(
        { currentAge: 60, retirementAge: 60, lifeExpectancy: 90, pots: { pension: { balance: 200000, monthly: 0, growth: 0 }, isa: { balance: 0, monthly: 0, growth: 0 }, cash: { balance: 0, monthly: 0, growth: 0 }, property: { balance: 0, monthly: 0, growth: 0 } } },
        { currentAge: 55, retirementAge: 65, lifeExpectancy: 90, pots: { pension: { balance: 200000, monthly: 0, growth: 0 }, isa: { balance: 0, monthly: 0, growth: 0 }, cash: { balance: 0, monthly: 0, growth: 0 }, property: { balance: 0, monthly: 0, growth: 0 } } },
      ),
      { targetIncome: 15000 },
    )
    // While female is still accumulating (age < 65, i.e. t < 10) her pension is untouched.
    for (const row of hh.rows.filter((r) => r.t < 10)) {
      expect(row.pensionGross.female).toBe(0)
      expect(row.ages.female).toBeLessThan(65)
    }
    // Once she retires (t >= 10) her pension is available.
    const afterRetire = hh.rows.find((r) => r.t >= 10)
    expect(afterRetire.ages.female).toBeGreaterThanOrEqual(65)
  })
})
