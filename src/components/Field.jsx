import { useState } from 'react'
import { parseAmount } from '../lib/money.js'

// A labelled input. `kind` controls formatting:
//   currency -> whole-pound number with a £ prefix
//   percent  -> stored as a decimal (0.05) but shown as 5
//   number / age -> plain number
//   select   -> dropdown (pass `options`: [{value,label}])
//   checkbox -> boolean
//   range    -> native slider (numeric; pass min/max/step)
export default function Field({
  label,
  kind = 'number',
  value,
  onChange,
  hint,
  options,
  min,
  max,
  step,
}) {
  if (kind === 'select') {
    return (
      <label className="field">
        <span className="field-label">{label}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {hint && <span className="field-hint">{hint}</span>}
      </label>
    )
  }

  if (kind === 'checkbox') {
    return (
      <label className="field field-checkbox">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        <span className="field-label">{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </label>
    )
  }

  if (kind === 'range') {
    return (
      <label className="field field-range">
        <span className="field-label">{label}</span>
        <span className="field-input kind-range">
          <input
            type="range"
            min={min}
            max={max}
            step={step ?? 1}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </span>
        {hint && <span className="field-hint">{hint}</span>}
      </label>
    )
  }

  return (
    <TextField
      label={label}
      kind={kind}
      value={value}
      onChange={onChange}
      hint={hint}
      min={min}
      max={max}
    />
  )
}

// Free-text numeric input (number/age/currency/percent). Kept as its own
// component so its hooks are unconditional regardless of the parent's `kind`.
function TextField({ label, kind, value, onChange, hint, min, max }) {
  const toDisplay = (v) => (kind === 'percent' ? String(Math.round(v * 1000) / 10) : String(v))

  const [text, setText] = useState(() => toDisplay(value))
  // Track the model value we last rendered so we can re-sync the text when the
  // model changes externally (e.g. Reset) without clobbering a mid-edit value
  // that already represents the same number. Adjusting state during render is
  // the recommended alternative to a sync effect.
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    const current = kind === 'percent' ? parseAmount(text) / 100 : parseAmount(text)
    if (current !== value) setText(toDisplay(value))
    setLastValue(value)
  }

  function handleChange(e) {
    const raw = e.target.value
    setText(raw)
    const num = parseAmount(raw)
    onChange(kind === 'percent' ? num / 100 : num)
  }

  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className={`field-input kind-${kind}`}>
        {kind === 'currency' && <span className="affix">£</span>}
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onChange={handleChange}
          min={min}
          max={max}
        />
        {kind === 'percent' && <span className="affix suffix">%</span>}
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}
