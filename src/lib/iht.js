import { HMRC } from './hmrc.js'

const I = HMRC.iht

// Available nil-rate band (NRB) + residence nil-rate band (RNRB) for an estate.
// A married couple can pass unused bands to the survivor, so on the second death
// both bands can be doubled. The RNRB tapers £1 for every £2 of estate above £2m.
export function nilRateBands(estate, { married = false, leaveHomeToDescendants = true } = {}) {
  const nrb = I.nilRateBand * (married ? 2 : 1)
  let rnrb = leaveHomeToDescendants ? I.residenceNilRateBand * (married ? 2 : 1) : 0
  if (estate > I.rnrbTaperThreshold) {
    const reduction = Math.floor((estate - I.rnrbTaperThreshold) / 2)
    rnrb = Math.max(0, rnrb - reduction)
  }
  return { nrb, rnrb, total: nrb + rnrb }
}

// Inheritance tax on an estate value.
export function inheritanceTax(estate, opts = {}) {
  const { nrb, rnrb, total } = nilRateBands(estate, opts)
  const taxable = Math.max(0, estate - total)
  const rate = opts.charityTenPercent ? I.charityReducedRate : I.rate
  return { estate, taxable, tax: taxable * rate, nrb, rnrb, bandTotal: total, rate }
}

const PEOPLE = ['male', 'female']

// Household estate value: both partners' pots (property + ISA + cash + pension
// if included) plus the single shared `estate.otherEstate`. This models the
// second-death couple estate (married:true doubles the bands in nilRateBands).
// From 6 Apr 2027 unused pensions count towards the estate, so they are
// included by default. Property is each partner's SHARE of any jointly-owned
// home — entered split so the estate isn't double-counted.
export function estateValue(plan, { includePensions = true } = {}) {
  let sum = plan.estate?.otherEstate || 0
  for (const who of PEOPLE) {
    const pots = plan.people?.[who]?.pots || {}
    sum += pots.property?.balance || 0
    sum += pots.isa?.balance || 0
    sum += pots.cash?.balance || 0
    if (includePensions) sum += pots.pension?.balance || 0
  }
  return sum
}

function estateOpts(plan) {
  return {
    married: plan.estate?.married || false,
    leaveHomeToDescendants: plan.estate?.leaveHomeToDescendants ?? true,
    charityTenPercent: plan.estate?.charityTenPercent || false,
  }
}

// Taper-relief factor applied to the 40% rate on the slice of gifts above the
// NRB, by whole years survived after the gift. 1.0 = full charge, 0 = exempt.
export function taperReliefFactor(yearsSinceGift) {
  for (const band of I.taperRelief) {
    if (yearsSinceGift < band.maxYears) return band.rateFactor
  }
  return 0
}

// Effect of a gifting-to-children strategy on IHT.
// giftPlan: { annualGift, years } — gift `annualGift` per year for `years` years.
// Assumes the donor survives 7+ years so gifts (PETs) fall outside the estate;
// the annual exemption and gifts out of surplus income are exempt immediately.
export function giftingImpact(plan, giftPlan = {}) {
  const opts = estateOpts(plan)
  const baseEstate = estateValue(plan, { includePensions: true })
  const before = inheritanceTax(baseEstate, opts)

  const annualGift = giftPlan.annualGift || 0
  const years = giftPlan.years || 0
  const gifted = Math.min(annualGift * years, Math.max(0, baseEstate))
  const afterEstate = baseEstate - gifted
  const after = inheritanceTax(afterEstate, opts)

  return {
    baseEstate,
    giftedTotal: gifted,
    ihtBefore: before.tax,
    ihtAfter: after.tax,
    ihtSaved: before.tax - after.tax,
    // What the children ultimately receive: gifts already given, plus the
    // remaining estate after IHT.
    netToHeirsBefore: baseEstate - before.tax,
    netToHeirsAfter: gifted + (afterEstate - after.tax),
    before,
    after,
  }
}

// How much IHT the Apr-2027 "pensions in the estate" change adds for this plan.
export function pensionIhtImpact(plan) {
  const opts = estateOpts(plan)
  const withPensions = inheritanceTax(estateValue(plan, { includePensions: true }), opts).tax
  const withoutPensions = inheritanceTax(estateValue(plan, { includePensions: false }), opts).tax
  return { withPensions, withoutPensions, extraDueToChange: withPensions - withoutPensions }
}
