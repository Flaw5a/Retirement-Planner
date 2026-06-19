import { useEffect, useState } from 'react'
import { HMRC } from '../lib/hmrc.js'

const STORAGE_KEY = 'retirement-plan-v2'
const LEGACY_KEY = 'retirement-plan-v1'

// One partner's inputs. This is the SAME field set the app used when it modelled
// a single person, so the per-person calc engine (projectAccumulation, etc.) can
// consume a `person` object unchanged. Property is each partner's SHARE of any
// jointly-owned home — split it (e.g. 50/50) so the estate isn't double-counted.
export function defaultPerson(overrides = {}) {
  return {
    currentAge: 45,
    retirementAge: 60,
    lifeExpectancy: 90,
    grossSalary: 45000,
    pots: {
      pension: { balance: 120000, monthly: 600, growth: 0.05 },
      isa: { balance: 40000, monthly: 300, growth: 0.05 },
      cash: { balance: 20000, monthly: 100, growth: 0.02 },
      property: { balance: 175000, monthly: 0, growth: 0.03 },
    },
    giftsIn: [], // lump sums received, e.g. from grandparents
    lgps: { annualPension: 8000, lumpSum: 0, startAge: 67, revaluation: 0 },
    statePension: { annual: HMRC.statePension.fullAnnual, startAge: HMRC.statePension.age, deferYears: 0 },
    ...overrides,
  }
}

// A worked example so the app shows something meaningful on first load. Every
// figure is editable in the Inputs panel. Household-shared fields sit at the top
// level; per-person fields live under people.male / people.female.
export function defaultPlan() {
  return {
    inflation: 0.025,
    targetIncome: 30000, // joint net yearly income target in retirement (today's money)
    realTerms: false, // UI toggle: show figures in today's money
    estate: { married: true, leaveHomeToDescendants: true, otherEstate: 20000, charityTenPercent: false },
    people: {
      male: defaultPerson({ currentAge: 45, retirementAge: 60, grossSalary: 45000 }),
      female: defaultPerson({
        currentAge: 43,
        retirementAge: 60,
        grossSalary: 38000,
        pots: {
          pension: { balance: 80000, monthly: 400, growth: 0.05 },
          isa: { balance: 25000, monthly: 200, growth: 0.05 },
          cash: { balance: 15000, monthly: 100, growth: 0.02 },
          property: { balance: 175000, monthly: 0, growth: 0.03 },
        },
      }),
    },
  }
}

// Merge a saved person over a base person section-by-section, so older saved
// data picks up any new fields.
function mergePerson(base, saved = {}) {
  return {
    ...base,
    ...saved,
    pots: {
      pension: { ...base.pots.pension, ...saved.pots?.pension },
      isa: { ...base.pots.isa, ...saved.pots?.isa },
      cash: { ...base.pots.cash, ...saved.pots?.cash },
      property: { ...base.pots.property, ...saved.pots?.property },
    },
    lgps: { ...base.lgps, ...saved.lgps },
    statePension: { ...base.statePension, ...saved.statePension },
    giftsIn: Array.isArray(saved.giftsIn) ? saved.giftsIn : base.giftsIn,
  }
}

// Pull the per-person fields out of a legacy (v1) flat single-person plan.
function legacyToPerson(stored) {
  const p = {}
  for (const k of ['currentAge', 'retirementAge', 'lifeExpectancy', 'grossSalary', 'pots', 'giftsIn', 'lgps', 'statePension']) {
    if (stored[k] !== undefined) p[k] = stored[k]
  }
  return p
}

function loadPlan() {
  // Current (v2) household plan.
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (stored && typeof stored === 'object' && stored.people) {
      const base = defaultPlan()
      return {
        ...base,
        ...stored,
        estate: { ...base.estate, ...stored.estate },
        people: {
          male: mergePerson(base.people.male, stored.people.male),
          female: mergePerson(base.people.female, stored.people.female),
        },
      }
    }
  } catch {
    // corrupt v2 — fall through to migration / defaults
  }

  // One-time migration from the legacy single-person plan (v1). The old plan
  // becomes the "male" partner; the v1 key is left untouched as a backup.
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY))
    if (legacy && typeof legacy === 'object') {
      const base = defaultPlan()
      return {
        ...base,
        inflation: legacy.inflation ?? base.inflation,
        targetIncome: legacy.targetIncome ?? base.targetIncome,
        realTerms: legacy.realTerms ?? base.realTerms,
        estate: { ...base.estate, ...legacy.estate },
        people: {
          male: mergePerson(base.people.male, legacyToPerson(legacy)),
          female: base.people.female,
        },
      }
    }
  } catch {
    // corrupt v1 — start from the example
  }

  return defaultPlan()
}

export function usePlan() {
  const [plan, setPlan] = useState(loadPlan)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
  }, [plan])

  // Household-shared scalar (inflation, targetIncome, realTerms).
  function setHousehold(field, value) {
    setPlan((p) => ({ ...p, [field]: value }))
  }

  // Household estate fields.
  function setEstate(field, value) {
    setPlan((p) => ({ ...p, estate: { ...p.estate, [field]: value } }))
  }

  // Per-person scalar (currentAge, retirementAge, lifeExpectancy, grossSalary).
  function setPersonField(who, field, value) {
    setPlan((p) => ({ ...p, people: { ...p.people, [who]: { ...p.people[who], [field]: value } } }))
  }

  // Per-person pot field.
  function setPot(who, key, field, value) {
    setPlan((p) => ({
      ...p,
      people: {
        ...p.people,
        [who]: {
          ...p.people[who],
          pots: { ...p.people[who].pots, [key]: { ...p.people[who].pots[key], [field]: value } },
        },
      },
    }))
  }

  // Per-person nested section (lgps, statePension).
  function setSection(who, section, field, value) {
    setPlan((p) => ({
      ...p,
      people: {
        ...p.people,
        [who]: { ...p.people[who], [section]: { ...p.people[who][section], [field]: value } },
      },
    }))
  }

  function addGift(who) {
    setPlan((p) => ({
      ...p,
      people: {
        ...p.people,
        [who]: {
          ...p.people[who],
          giftsIn: [
            ...p.people[who].giftsIn,
            { id: crypto.randomUUID(), age: p.people[who].currentAge, amount: 10000, into: 'isa' },
          ],
        },
      },
    }))
  }

  function updateGift(who, id, field, value) {
    setPlan((p) => ({
      ...p,
      people: {
        ...p.people,
        [who]: {
          ...p.people[who],
          giftsIn: p.people[who].giftsIn.map((g) => (g.id === id ? { ...g, [field]: value } : g)),
        },
      },
    }))
  }

  function removeGift(who, id) {
    setPlan((p) => ({
      ...p,
      people: {
        ...p.people,
        [who]: { ...p.people[who], giftsIn: p.people[who].giftsIn.filter((g) => g.id !== id) },
      },
    }))
  }

  function reset() {
    setPlan(defaultPlan())
  }

  return { plan, setHousehold, setPersonField, setPot, setSection, setEstate, addGift, updateGift, removeGift, reset }
}
