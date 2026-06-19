import { describe, it, expect } from 'vitest'
import {
  nilRateBands,
  inheritanceTax,
  estateValue,
  taperReliefFactor,
  giftingImpact,
  pensionIhtImpact,
} from '../iht.js'

function person(pots, overrides = {}) {
  return {
    currentAge: 60,
    lifeExpectancy: 90,
    pots: {
      pension: { balance: 0 },
      isa: { balance: 0 },
      cash: { balance: 0 },
      property: { balance: 0 },
      ...pots,
    },
    ...overrides,
  }
}

// Single funded partner (male); female empty — so existing band/estate
// assertions (570k single estate) still hold under the household sum.
function plan(overrides = {}) {
  return {
    people: {
      male: person({
        pension: { balance: 200000 },
        isa: { balance: 50000 },
        cash: { balance: 20000 },
        property: { balance: 300000 },
      }),
      female: person({}),
    },
    estate: { married: false, leaveHomeToDescendants: true, otherEstate: 0 },
    ...overrides,
  }
}

// Both partners funded identically — household estate should be the sum.
function couplePlan(overrides = {}) {
  return {
    people: {
      male: person({
        pension: { balance: 200000 },
        isa: { balance: 50000 },
        cash: { balance: 20000 },
        property: { balance: 300000 },
      }),
      female: person({
        pension: { balance: 200000 },
        isa: { balance: 50000 },
        cash: { balance: 20000 },
        property: { balance: 300000 },
      }),
    },
    estate: { married: true, leaveHomeToDescendants: true, otherEstate: 0 },
    ...overrides,
  }
}

describe('nilRateBands', () => {
  it('gives NRB + RNRB for a single person leaving a home to children', () => {
    const b = nilRateBands(400000, { married: false, leaveHomeToDescendants: true })
    expect(b.nrb).toBe(325000)
    expect(b.rnrb).toBe(175000)
    expect(b.total).toBe(500000)
  })

  it('doubles both bands for a married couple', () => {
    const b = nilRateBands(800000, { married: true })
    expect(b.total).toBe(1000000)
  })

  it('tapers the RNRB above a £2m estate', () => {
    // estate 2.3m, single: RNRB 175000 - (300000/2)=150000 -> 25000
    const b = nilRateBands(2300000, { married: false, leaveHomeToDescendants: true })
    expect(b.rnrb).toBe(25000)
  })

  it('removes the RNRB entirely by £2.35m', () => {
    const b = nilRateBands(2350000, { married: false, leaveHomeToDescendants: true })
    expect(b.rnrb).toBe(0)
  })
})

describe('inheritanceTax', () => {
  it('is zero when the estate is within the bands', () => {
    expect(inheritanceTax(400000, { leaveHomeToDescendants: true }).tax).toBe(0)
  })

  it('charges 40% above the bands', () => {
    // estate 1,000,000 single, bands 500,000 -> taxable 500,000 -> 200,000
    expect(inheritanceTax(1000000, { leaveHomeToDescendants: true }).tax).toBeCloseTo(200000, 2)
  })
})

describe('estateValue', () => {
  it('includes pensions by default (Apr 2027 change)', () => {
    expect(estateValue(plan())).toBe(570000)
  })

  it('can exclude pensions (pre-2027 treatment)', () => {
    expect(estateValue(plan(), { includePensions: false })).toBe(370000)
  })

  it('sums both partners plus the single shared otherEstate', () => {
    // each partner 570k -> 1,140,000; plus shared otherEstate 50,000
    expect(estateValue(couplePlan({ estate: { married: true, leaveHomeToDescendants: true, otherEstate: 50000 } }))).toBe(
      1190000,
    )
  })
})

describe('taperReliefFactor', () => {
  it('is full within 3 years and exempt after 7', () => {
    expect(taperReliefFactor(2)).toBe(1)
    expect(taperReliefFactor(7)).toBe(0)
  })

  it('steps down between years 3 and 7', () => {
    expect(taperReliefFactor(3)).toBe(0.8)
    expect(taperReliefFactor(4)).toBe(0.6)
    expect(taperReliefFactor(5)).toBe(0.4)
    expect(taperReliefFactor(6)).toBe(0.2)
  })
})

describe('giftingImpact', () => {
  it('reduces IHT by moving assets out of the estate', () => {
    // estate 570k single, bands 500k -> IHT 28k. Gift 70k -> estate 500k -> IHT 0.
    const gi = giftingImpact(plan(), { annualGift: 10000, years: 7 })
    expect(gi.ihtBefore).toBeCloseTo(28000, 2)
    expect(gi.ihtAfter).toBeCloseTo(0, 2)
    expect(gi.ihtSaved).toBeCloseTo(28000, 2)
  })

  it('passes more to heirs overall', () => {
    const gi = giftingImpact(plan(), { annualGift: 10000, years: 7 })
    expect(gi.netToHeirsAfter).toBeGreaterThan(gi.netToHeirsBefore)
  })
})

describe('pensionIhtImpact', () => {
  it('quantifies the extra IHT from counting pensions in the estate', () => {
    const impact = pensionIhtImpact(plan())
    expect(impact.extraDueToChange).toBeGreaterThanOrEqual(0)
    expect(impact.withPensions).toBeGreaterThanOrEqual(impact.withoutPensions)
  })
})
