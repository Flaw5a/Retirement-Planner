import { describe, it, expect } from 'vitest'
import {
  netFromPensionGross,
  solvePensionGross,
  simulateDrawdown,
  sustainableIncome,
} from '../drawdown.js'

function basePlan(overrides = {}) {
  return {
    currentAge: 60,
    retirementAge: 60,
    lifeExpectancy: 90,
    inflation: 0,
    targetIncome: 0,
    pots: {
      pension: { balance: 0, monthly: 0, growth: 0 },
      isa: { balance: 0, monthly: 0, growth: 0 },
      cash: { balance: 0, monthly: 0, growth: 0 },
      property: { balance: 0, monthly: 0, growth: 0 },
    },
    lgps: { annualPension: 0, lumpSum: 0, startAge: 67, revaluation: 0 },
    statePension: { annual: 0, startAge: 67, deferYears: 0 },
    ...overrides,
  }
}

describe('netFromPensionGross', () => {
  it('is tax-free when the taxable part stays within the personal allowance', () => {
    expect(netFromPensionGross(10000, 0)).toBeCloseTo(10000, 2)
  })

  it('deducts tax on the 75% taxable part', () => {
    // taxable part = 30000; tax on 30000 = (30000-12570)*0.2 = 3486
    expect(netFromPensionGross(40000, 0)).toBeCloseTo(36514, 2)
  })

  it('accounts for other taxable income already using the allowance', () => {
    // other = 12570 (uses all PA); taxable part of 10000 gross = 7500 @20% = 1500
    expect(netFromPensionGross(10000, 12570)).toBeCloseTo(8500, 2)
  })
})

describe('solvePensionGross', () => {
  it('finds the gross that yields the requested net', () => {
    const gross = solvePensionGross(36514, 0, 100000)
    expect(gross).toBeCloseTo(40000, 0)
  })

  it('caps at the available balance', () => {
    expect(solvePensionGross(1_000_000, 0, 5000)).toBe(5000)
  })
})

describe('simulateDrawdown', () => {
  it('meets the target from guaranteed income without touching pots', () => {
    const plan = basePlan({
      retirementAge: 67,
      lifeExpectancy: 70,
      targetIncome: 12000,
      statePension: { annual: 12547, startAge: 67, deferYears: 0 },
    })
    const { rows, depletionAge } = simulateDrawdown(plan)
    expect(depletionAge).toBeNull()
    expect(rows[0].pensionGross).toBe(0)
    expect(rows[0].shortfall).toBe(0)
    expect(rows[0].netIncome).toBeCloseTo(12547, 0) // full State Pension, tax-free
  })

  it('flags the age the pots run out', () => {
    const plan = basePlan({
      retirementAge: 60,
      lifeExpectancy: 95,
      targetIncome: 12000,
      pots: {
        pension: { balance: 10000, monthly: 0, growth: 0 },
        isa: { balance: 0, monthly: 0, growth: 0 },
        cash: { balance: 0, monthly: 0, growth: 0 },
        property: { balance: 0, monthly: 0, growth: 0 },
      },
    })
    const { depletionAge } = simulateDrawdown(plan)
    expect(depletionAge).not.toBeNull()
    expect(depletionAge).toBeGreaterThanOrEqual(60)
    expect(depletionAge).toBeLessThan(63)
  })

  it('spends ISA before pension under the default order', () => {
    const plan = basePlan({
      retirementAge: 60,
      lifeExpectancy: 61,
      targetIncome: 5000,
      pots: {
        pension: { balance: 100000, monthly: 0, growth: 0 },
        isa: { balance: 100000, monthly: 0, growth: 0 },
        cash: { balance: 0, monthly: 0, growth: 0 },
        property: { balance: 0, monthly: 0, growth: 0 },
      },
    })
    const { rows } = simulateDrawdown(plan)
    expect(rows[0].isaDrawn).toBeCloseTo(5000, 2)
    expect(rows[0].pensionGross).toBe(0)
  })

  it('drawing pension first incurs more tax than ISA/cash first', () => {
    const plan = basePlan({
      retirementAge: 65,
      lifeExpectancy: 85,
      targetIncome: 25000,
      pots: {
        pension: { balance: 300000, monthly: 0, growth: 0.03 },
        isa: { balance: 150000, monthly: 0, growth: 0.03 },
        cash: { balance: 30000, monthly: 0, growth: 0.01 },
        property: { balance: 0, monthly: 0, growth: 0 },
      },
      statePension: { annual: 12547, startAge: 67, deferYears: 0 },
    })
    const isaFirst = simulateDrawdown(plan, { order: ['cash', 'isa', 'pension'] })
    const pensionFirst = simulateDrawdown(plan, { order: ['pension', 'cash', 'isa'] })
    expect(pensionFirst.totalTaxPaid).toBeGreaterThan(isaFirst.totalTaxPaid)
  })
})

describe('sustainableIncome', () => {
  it('returns a positive income for a funded plan', () => {
    const plan = basePlan({
      retirementAge: 65,
      lifeExpectancy: 90,
      pots: {
        pension: { balance: 400000, monthly: 0, growth: 0.04 },
        isa: { balance: 100000, monthly: 0, growth: 0.04 },
        cash: { balance: 20000, monthly: 0, growth: 0.01 },
        property: { balance: 0, monthly: 0, growth: 0 },
      },
      statePension: { annual: 12547, startAge: 67, deferYears: 0 },
    })
    const income = sustainableIncome(plan)
    expect(income).toBeGreaterThan(20000)
  })

  it('is effectively zero when there are no pots and no guaranteed income', () => {
    // Resolves to within ~£1 of zero: the drawdown ignores sub-£1 shortfalls as
    // float noise, so the bisection can't push the last pound below £1.
    expect(sustainableIncome(basePlan({ retirementAge: 60, lifeExpectancy: 90 }))).toBeLessThan(2)
  })
})
