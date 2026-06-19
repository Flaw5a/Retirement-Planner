// ============================================================================
// HMRC RULES — SINGLE SOURCE OF TRUTH
// ============================================================================
// UK tax year 2026/27. Figures apply to England, Wales & Northern Ireland.
// (Scottish income tax bands differ and are not modelled here.)
//
// >>> APRIL REFRESH CHECKLIST — review every new tax year (early April) <<<
//   1. Income tax: personal allowance, band thresholds (frozen to 2027/28).
//   2. ISA allowance (cash-ISA sub-limit of £12,000 starts 6 Apr 2027).
//   3. Pension: annual allowance, MPAA, Lump Sum Allowance, minimum pension
//      age (rises 55 -> 57 on 6 Apr 2028).
//   4. State Pension: full new rate (triple-lock uprating each April) and the
//      State Pension age (66 -> 67 phasing Apr 2026 - Apr 2028).
//   5. IHT: nil-rate bands (frozen to 2030); from 6 Apr 2027 unused pensions
//      count towards the estate.
//   6. Bump REVIEWED_ON below and re-run the test suite.
//
// Sources: gov.uk (income tax, ISA, pensions, state pension), lgpsmember.org,
// and HMRC IHT guidance. See the build notes for the exact pages checked.
// ============================================================================

export const TAX_YEAR = '2026/27'
export const REVIEWED_ON = '2026-06-15'

export const HMRC = {
  taxYear: TAX_YEAR,
  reviewedOn: REVIEWED_ON,

  // --- Income tax (rUK) -----------------------------------------------------
  // Bands are expressed as cumulative cut-offs on TAXABLE income (i.e. income
  // after the personal allowance). The additional-rate cut-off of 125,140 is
  // also the income at which the personal allowance has fully tapered to zero,
  // so defining it on taxable income stays correct across the taper.
  incomeTax: {
    personalAllowance: 12570,
    paTaperThreshold: 100000, // PA reduces £1 for every £2 of income above this
    bands: [
      { rate: 0.2, upTo: 37700 }, // basic rate
      { rate: 0.4, upTo: 125140 }, // higher rate
      { rate: 0.45, upTo: Infinity }, // additional rate
    ],
  },

  // --- ISAs -----------------------------------------------------------------
  isa: {
    annualAllowance: 20000,
    cashSubLimitFrom2027: 12000, // from 6 Apr 2027, within the £20k overall
    lisaAnnualMax: 4000, // counts within the £20k allowance
    lisaBonusRate: 0.25,
  },

  // --- Pensions -------------------------------------------------------------
  pension: {
    annualAllowance: 60000, // or 100% of relevant earnings if lower
    moneyPurchaseAnnualAllowance: 10000,
    taperThreshold: 260000, // adjusted income above which AA tapers
    taperMinimum: 10000,
    taxFreeLumpSumRate: 0.25, // 25% tax-free (PCLS / UFPLS tax-free element)
    lumpSumAllowance: 268275, // cap on total tax-free lump sums
    minPensionAge: 55,
    minPensionAgeFrom2028: 57, // from 6 Apr 2028
    pensionsCountInEstateFrom: '2027-04-06', // IHT change
  },

  // --- State Pension --------------------------------------------------------
  statePension: {
    fullWeekly: 241.3, // full new State Pension, 2026/27 (after 4.8% triple lock)
    get fullAnnual() {
      return Math.round(this.fullWeekly * 52)
    },
    age: 67, // phasing 66 -> 67 between Apr 2026 and Apr 2028
    deferralUpliftPerYear: 0.058, // ~1% per 9 weeks deferred
  },

  // --- Savings & dividends --------------------------------------------------
  savings: {
    personalSavingsAllowanceBasic: 1000,
    personalSavingsAllowanceHigher: 500,
    personalSavingsAllowanceAdditional: 0,
    dividendAllowance: 500,
  },

  // --- Capital gains tax ----------------------------------------------------
  cgt: {
    annualExempt: 3000,
    basicRate: 0.18,
    higherRate: 0.24,
  },

  // --- Inheritance tax ------------------------------------------------------
  iht: {
    nilRateBand: 325000, // frozen to 2030
    residenceNilRateBand: 175000, // when main home left to direct descendants
    rnrbTaperThreshold: 2000000, // RNRB tapers £1 per £2 of estate above this
    rate: 0.4,
    charityReducedRate: 0.36, // if 10%+ of estate left to charity
    annualGiftExemption: 3000, // per year (one year's unused amount carries forward)
    smallGiftExemption: 250, // per recipient per year
    weddingGiftChild: 5000,
    weddingGiftGrandchild: 2500,
    weddingGiftOther: 1000,
    // Taper relief reduces the tax (not the gift) on gifts above the NRB when
    // death occurs 3-7 years after the gift. Factor multiplies the 40% rate.
    taperRelief: [
      { maxYears: 3, rateFactor: 1.0 }, // 0-3 yrs: full 40%
      { maxYears: 4, rateFactor: 0.8 }, // 3-4 yrs: 32%
      { maxYears: 5, rateFactor: 0.6 }, // 4-5 yrs: 24%
      { maxYears: 6, rateFactor: 0.4 }, // 5-6 yrs: 16%
      { maxYears: 7, rateFactor: 0.2 }, // 6-7 yrs: 8%
      { maxYears: Infinity, rateFactor: 0.0 }, // 7+ yrs: exempt
    ],
  },
}
