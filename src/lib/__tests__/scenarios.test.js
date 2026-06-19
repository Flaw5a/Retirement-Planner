import { describe, it, expect } from 'vitest'
import { buildScenarios, buildSummary, buildTrajectory } from '../scenarios.js'

function person(overrides = {}) {
  return {
    currentAge: 50,
    retirementAge: 65,
    lifeExpectancy: 90,
    grossSalary: 60000,
    pots: {
      pension: { balance: 200000, monthly: 500, growth: 0.05 },
      isa: { balance: 80000, monthly: 300, growth: 0.05 },
      cash: { balance: 30000, monthly: 100, growth: 0.02 },
      property: { balance: 350000, monthly: 0, growth: 0.03 },
    },
    giftsIn: [],
    lgps: { annualPension: 6000, lumpSum: 0, startAge: 67, revaluation: 0 },
    statePension: { annual: 12547, startAge: 67, deferYears: 0 },
    ...overrides,
  }
}

function plan(overrides = {}) {
  const { people, ...rest } = overrides
  return {
    inflation: 0.025,
    targetIncome: 30000,
    realTerms: false,
    estate: { married: true, leaveHomeToDescendants: true, otherEstate: 0 },
    people: {
      male: person(people?.male),
      female: person(people?.female),
    },
    ...rest,
  }
}

describe('buildScenarios', () => {
  const scenarios = buildScenarios(plan())

  it('returns all five comparisons', () => {
    expect(scenarios.map((s) => s.key)).toEqual([
      'contribution',
      'retirementAge',
      'drawdownOrder',
      'deferStatePension',
      'gifting',
    ])
  })

  it('gives each comparison bars and a chosen best option', () => {
    for (const s of scenarios) {
      expect(s.bars.length).toBeGreaterThanOrEqual(2)
      expect(s.bestIndex).toBeGreaterThanOrEqual(0)
      expect(s.bestIndex).toBeLessThan(s.bars.length)
      for (const bar of s.bars) {
        expect(Number.isFinite(bar.value)).toBe(true)
      }
    }
  })

  it('finds ISA/cash-first the lowest-tax drawdown order', () => {
    const order = scenarios.find((s) => s.key === 'drawdownOrder')
    expect(order.lowerIsBetter).toBe(true)
    expect(order.bars[order.bestIndex].label).toBe('ISA & cash first')
  })
})

describe('buildSummary', () => {
  it('produces headline figures', () => {
    const s = buildSummary(plan())
    expect(s.potAtRetirement).toBeGreaterThan(0)
    expect(s.sustainableIncome).toBeGreaterThan(0)
    expect(s.estateValue).toBeGreaterThan(0)
    expect(Number.isFinite(s.ihtDue)).toBe(true)
  })

  it('sums the household estate across both partners', () => {
    const s = buildSummary(plan())
    // both partners property+isa+cash+pension = 2 x 660,000 = 1,320,000
    expect(s.estateValue).toBe(1320000)
  })
})

describe('buildTrajectory', () => {
  it('returns a year-indexed series with markers and depletionYear', () => {
    const traj = buildTrajectory(plan())
    expect(traj.baseYear).toBe(2026)
    expect(traj.series.length).toBeGreaterThan(0)
    const row = traj.series[0]
    expect(row).toHaveProperty('t')
    expect(row).toHaveProperty('year')
    expect(row).toHaveProperty('ages')
    expect(row).toHaveProperty('phase')
    expect(row).toHaveProperty('total')
    expect(row.year).toBe(2026 + row.t)
    expect(traj.retirementMarkers.male.age).toBe(65)
    expect(traj.retirementMarkers.female.age).toBe(65)
    expect(traj.spMarkers.male.age).toBe(67)
    // 'depletionYear' is null or { t, year }
    expect(traj.depletionYear === null || typeof traj.depletionYear.t === 'number').toBe(true)
  })

  it('aligns partners of different ages on the same calendar year', () => {
    const p = plan({ people: { male: { currentAge: 50 }, female: { currentAge: 45 } } })
    const traj = buildTrajectory(p)
    // at t=0 the year is the base year and ages are currentAge + 0
    const first = traj.series[0]
    expect(first.year).toBe(2026)
    expect(first.ages.male).toBe(50)
    expect(first.ages.female).toBe(45)
  })
})
