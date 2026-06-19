// Formatting and parsing helpers for GBP amounts and percentages.

const gbpFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
})

const gbpFormatterPence = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

// "£12,345" — whole pounds (the default for planning figures).
export function gbp(n) {
  if (!Number.isFinite(n)) return '—'
  return gbpFormatter.format(Math.round(n))
}

// "£12,345.67" — when pence matter (e.g. weekly State Pension).
export function gbpPence(n) {
  if (!Number.isFinite(n)) return '—'
  return gbpFormatterPence.format(n)
}

// Compact form for chart axes: "£1.2m", "£450k", "£900".
export function gbpCompact(n) {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}£${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`
  if (abs >= 1_000) return `${sign}£${Math.round(abs / 1_000)}k`
  return `${sign}£${Math.round(abs)}`
}

// 0.05 -> "5%". Pass decimals for fractional rates.
export function pct(fraction, decimals = 1) {
  if (!Number.isFinite(fraction)) return '—'
  const value = fraction * 100
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(decimals))
  return `${rounded}%`
}

// Parse a user-typed amount: strips £, commas and spaces. Returns a finite
// number or 0 for empty/invalid input.
export function parseAmount(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0
  if (input == null) return 0
  const cleaned = String(input).replace(/[£,\s]/g, '')
  if (cleaned === '' || cleaned === '-') return 0
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : 0
}
