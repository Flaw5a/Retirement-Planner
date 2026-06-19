import { describe, it, expect } from 'vitest'
import { personalAllowance, incomeTax, netIncome, marginalRate } from '../tax.js'

describe('personalAllowance', () => {
  it('is the full allowance below £100k', () => {
    expect(personalAllowance(50000)).toBe(12570)
  })

  it('tapers £1 for every £2 above £100k', () => {
    expect(personalAllowance(110000)).toBe(7570) // 12570 - 5000
  })

  it('reaches zero at £125,140', () => {
    expect(personalAllowance(125140)).toBe(0)
    expect(personalAllowance(150000)).toBe(0)
  })
})

describe('incomeTax', () => {
  it('is zero up to the personal allowance', () => {
    expect(incomeTax(0)).toBe(0)
    expect(incomeTax(12570)).toBe(0)
  })

  it('taxes basic-rate income at 20%', () => {
    expect(incomeTax(20000)).toBeCloseTo(1486, 2) // (20000-12570)*0.2
  })

  it('uses the full basic-rate band at the higher-rate threshold', () => {
    expect(incomeTax(50270)).toBeCloseTo(7540, 2) // 37700*0.2
  })

  it('applies higher rate above £50,270', () => {
    // 37700*0.2 + (47430-37700)*0.4 = 7540 + 3892
    expect(incomeTax(60000)).toBeCloseTo(11432, 2)
  })

  it('applies additional rate above £125,140 with no personal allowance', () => {
    // 7540 + (125140-37700)*0.4 + (150000-125140)*0.45
    expect(incomeTax(150000)).toBeCloseTo(53703, 2)
  })
})

describe('netIncome', () => {
  it('is gross minus tax', () => {
    expect(netIncome(60000)).toBeCloseTo(48568, 2)
  })
})

describe('marginalRate', () => {
  it('is 20% in the basic-rate band', () => {
    expect(marginalRate(40000)).toBeCloseTo(0.2, 5)
  })

  it('is 40% in the higher-rate band', () => {
    expect(marginalRate(60000)).toBeCloseTo(0.4, 5)
  })

  it('is 60% in the personal-allowance taper band', () => {
    expect(marginalRate(110000)).toBeCloseTo(0.6, 5)
  })

  it('is 45% in the additional-rate band', () => {
    expect(marginalRate(160000)).toBeCloseTo(0.45, 5)
  })
})
