import { TAX_YEAR, REVIEWED_ON } from '../lib/hmrc.js'

export default function Disclaimer() {
  return (
    <div className="disclaimer" role="note">
      <strong>Illustration only — not financial advice.</strong> This tool models
      UK tax rules for the <b>{TAX_YEAR}</b> tax year (figures reviewed{' '}
      {REVIEWED_ON}) and makes simplifying assumptions. Investment growth is not
      guaranteed. For decisions about your pension, tax or estate, speak to a
      regulated financial adviser.
    </div>
  )
}
