import { HMRC } from './hmrc.js'

// UK income tax (England, Wales & NI) for the configured tax year.
// All functions take the gross taxable income for the year (State Pension,
// defined-benefit pensions and the taxable part of pension withdrawals are all
// taxable income; ISA and cash withdrawals are not).

// Personal allowance after the £1-per-£2 taper above £100,000.
export function personalAllowance(grossIncome, cfg = HMRC.incomeTax) {
  if (grossIncome <= cfg.paTaperThreshold) return cfg.personalAllowance
  const reduction = Math.floor((grossIncome - cfg.paTaperThreshold) / 2)
  return Math.max(0, cfg.personalAllowance - reduction)
}

// Income tax due on a gross income for the year.
export function incomeTax(grossIncome, cfg = HMRC.incomeTax) {
  if (grossIncome <= 0) return 0
  const pa = personalAllowance(grossIncome, cfg)
  const taxable = Math.max(0, grossIncome - pa)

  let tax = 0
  let lower = 0
  for (const band of cfg.bands) {
    if (taxable <= lower) break
    const upper = Math.min(taxable, band.upTo)
    tax += (upper - lower) * band.rate
    lower = upper
  }
  return tax
}

// Net (after-tax) income for a gross figure.
export function netIncome(grossIncome, cfg = HMRC.incomeTax) {
  return grossIncome - incomeTax(grossIncome, cfg)
}

// Marginal tax rate at a given income — the rate applied to the next pound.
// Probed over £2 because the personal allowance tapers £1 per £2, which is what
// creates the 60% effective band between £100,000 and £125,140.
export function marginalRate(grossIncome, cfg = HMRC.incomeTax) {
  if (grossIncome < cfg.personalAllowance) return 0
  const delta = 2
  return (incomeTax(grossIncome + delta, cfg) - incomeTax(grossIncome, cfg)) / delta
}

// The pension contribution that gives this much tax relief is handled in
// scenarios; here we expose the rate at which relief is granted, i.e. the
// marginal rate on the slice of income covered by the contribution.
export function reliefRate(grossIncome, cfg = HMRC.incomeTax) {
  return marginalRate(grossIncome, cfg)
}
