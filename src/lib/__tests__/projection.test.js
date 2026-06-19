import { describe, it, expect } from 'vitest'
import {
  growPotOneYear,
  projectAccumulation,
  potsAtRetirement,
  deflator,
  toTodaysMoney,
} from '../projection.js'

function pots(overrides = {}) {
  return {
    pension: { balance: 0, monthly: 0, growth: 0 },
    isa: { balance: 0, monthly: 0, growth: 0 },
    cash: { balance: 0, monthly: 0, growth: 0 },
    property: { balance: 0, monthly: 0, growth: 0 },
    ...overrides,
  }
}

describe('growPotOneYear', () => {
  it('adds 12 monthly contributions with no growth', () => {
    expect(growPotOneYear(0, 100, 0)).toBeCloseTo(1200, 6)
  })

  it('compounds growth monthly', () => {
    // 1000 * (1 + 0.12/12)^12
    expect(growPotOneYear(1000, 0, 0.12)).toBeCloseTo(1126.825, 2)
  })
})

describe('projectAccumulation', () => {
  it('returns a snapshot per year inclusive of both ends', () => {
    const plan = { currentAge: 40, retirementAge: 45, pots: pots() }
    const series = projectAccumulation(plan)
    expect(series).toHaveLength(6)
    expect(series[0].age).toBe(40)
    expect(series[5].age).toBe(45)
  })

  it('keeps a static pot flat with no growth or contributions', () => {
    const plan = {
      currentAge: 40,
      retirementAge: 41,
      pots: pots({ pension: { balance: 1000, monthly: 0, growth: 0 } }),
    }
    const series = projectAccumulation(plan)
    expect(series[1].pension).toBeCloseTo(1000, 6)
  })

  it('adds gifts received at the right age', () => {
    const plan = {
      currentAge: 40,
      retirementAge: 42,
      pots: pots(),
      giftsIn: [{ age: 40, amount: 5000, into: 'isa' }],
    }
    const series = projectAccumulation(plan)
    expect(series[2].isa).toBeCloseTo(5000, 6)
  })

  it('separates investable pots from property in the total', () => {
    const plan = {
      currentAge: 40,
      retirementAge: 40,
      pots: pots({
        pension: { balance: 100, monthly: 0, growth: 0 },
        isa: { balance: 50, monthly: 0, growth: 0 },
        property: { balance: 300, monthly: 0, growth: 0 },
      }),
    }
    const snap = potsAtRetirement(plan)
    expect(snap.investable).toBe(150)
    expect(snap.total).toBe(450)
  })
})

describe('inflation helpers', () => {
  it('compounds the deflator', () => {
    expect(deflator(10, 0.025)).toBeCloseTo(1.28008, 4)
  })

  it('converts future money to today’s money', () => {
    expect(toTodaysMoney(1280.08, 10, 0.025)).toBeCloseTo(1000, 1)
  })
})
