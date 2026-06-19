// Drives the retirement planner in headless Chromium and saves screenshots of
// each tab. Requires Playwright (`npm i -D playwright && npx playwright install
// chromium`) and a running server:
//   npm run build && npm run preview     (serves on http://localhost:4173)
// then:  node demo/demo.mjs
import { chromium } from 'playwright'

const URL = 'http://localhost:4173/'
const SHOTS = 'demo/shots'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1100, height: 950 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()))

await page.goto(URL)
await page.waitForSelector('text=Retirement Cash Flow Planner')
await page.waitForSelector('.projection-svg')
await page.screenshot({ path: `${SHOTS}/1-projection.png`, fullPage: true })

await page.click('button.tab:has-text("Retirement income")')
await page.waitForSelector('.income-table')
await page.screenshot({ path: `${SHOTS}/2-income.png`, fullPage: true })

await page.click('button.tab:has-text("Best actions")')
await page.waitForSelector('.scenario-card')
await page.screenshot({ path: `${SHOTS}/3-best-actions.png`, fullPage: true })

await page.click('button.tab:has-text("Estate & gifting")')
await page.waitForSelector('.estate-block')
await page.screenshot({ path: `${SHOTS}/4-estate.png`, fullPage: true })

await page.click('button.tab:has-text("Inputs")')
await page.waitForSelector('fieldset')
await page.screenshot({ path: `${SHOTS}/5-inputs.png`, fullPage: true })

console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join('\n')}` : 'No console errors.')
await browser.close()
