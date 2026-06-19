# Retirement Cash Flow Planner

A UK retirement cash flow model. Enter your current wealth across pensions, ISAs,
cash, LGPS, property and gifts received; add monthly contributions; and see your
fund trajectory, retirement income, tax, and estate position projected against
**current HMRC rules**. It highlights the best course of action by comparing
scenarios side by side.

> **Illustration only — not financial advice.** Investment growth is not
> guaranteed and the model makes simplifying assumptions. For real decisions,
> speak to a regulated financial adviser.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # vitest — the calculation engine is fully unit-tested
npm run build      # production build
```

## What it does

- **Inputs** — your age/retirement age, target income, every pot (balance,
  monthly contribution, growth), LGPS defined-benefit pension, State Pension,
  gifts received (e.g. from grandparents), and estate details. Everything saves
  to `localStorage` and recalculates live. Toggle **Today's money** to view in
  real terms.
- **Projection** — a stacked bar chart of your fund trajectory from now through
  retirement to life expectancy, with markers for your retirement age and when
  the State Pension starts (default 67).
- **Retirement income** — year-by-year income, where it comes from, the tax
  paid, and when (if ever) the pots run out.
- **Best actions** — five side-by-side comparisons: where to put new monthly
  money, when to retire, which pots to draw first, whether to defer the State
  Pension, and gifting to your children. The best option in each is highlighted.
- **Estate & gifting** — Inheritance Tax on your estate (including pensions from
  April 2027), and an interactive gifting strategy showing the IHT saved.

## Keeping HMRC figures current

All tax rules live in one dated file: **`src/lib/hmrc.js`**. It carries the tax
year, a review date, and an "April refresh checklist". Update it each new tax
year (and re-run `npm run test`) to keep the model current. The current figures
are for the **2026/27** tax year.

## How it's built

- React 19 + Vite, no UI/chart libraries — charts are hand-rolled SVG/CSS.
- Pure-function calculation engine in `src/lib/` (`tax`, `projection`,
  `drawdown`, `iht`, `scenarios`), each with vitest tests in `src/lib/__tests__`.
- `demo/demo.mjs` captures screenshots of each tab (needs Playwright).
