import { test, expect, type Page } from '@playwright/test'

const ALLOWED = process.env.E2E_ALLOW === '1'
const ADMIN_LOGIN = process.env.E2E_ADMIN_LOGIN!
const ADMIN_PW = process.env.E2E_ADMIN_PASSWORD!
const QR_APARTMENT_ID = process.env.E2E_QR_APARTMENT_ID!

test.skip(!ALLOWED, 'E2E_ALLOW=1 required')

async function login(page: Page, login: string, password: string) {
  await page.goto('/')
  await page.fill('input[type="text"]', login)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
}

test.describe('QR History', () => {
  test('history page shows cleaning and incident tabs, search, date filter, detail, no delete', async ({ page }) => {
    await login(page, ADMIN_LOGIN, ADMIN_PW)
    await page.waitForURL(/\/(admin|sv)$/, { timeout: 15000 })

    const aptId = QR_APARTMENT_ID
    await page.goto(`/qr.html#/qr/${aptId}/history`)
    await expect(page).toHaveURL(new RegExp(`/qr\\.html#/qr/${aptId}/history`))

    await expect(page.getByTestId('history-filters')).toBeVisible({ timeout: 15000 })

    const toggle = page.getByTestId('filters-toggle')
    await expect(toggle).toBeVisible()
    await toggle.click()

    const searchInput = page.getByTestId('search-input')
    await expect(searchInput).toBeVisible({ timeout: 5000 })
    await searchInput.fill('zzz-no-match-xyz')
    await expect(page.getByTestId('cleaning-card')).toHaveCount(0, { timeout: 5000 })
    await searchInput.fill('')
    await expect(page.getByTestId('cleaning-card').first()).toBeVisible({ timeout: 8000 })

    const dateFrom = page.getByTestId('date-from')
    await expect(dateFrom).toBeVisible()
    await dateFrom.fill('2099-01-01')
    await expect(page.getByTestId('cleaning-card')).toHaveCount(0, { timeout: 5000 })
    await dateFrom.fill('')

    await expect(page.getByTestId('filters-reset')).toBeVisible()
    await page.getByTestId('filters-reset').click()

    const firstCard = page.getByTestId('cleaning-card').first()
    await expect(firstCard).toBeVisible({ timeout: 8000 })
    await firstCard.click()

    const detail = page.getByTestId('cleaning-detail')
    await expect(detail).toBeVisible({ timeout: 5000 })
    await expect(detail.getByTestId('cleaning-delete-btn')).not.toBeVisible()

    await page.keyboard.press('Escape')
    await expect(detail).not.toBeVisible({ timeout: 5000 })

    const incidentTab = page.getByTestId('tab-incidents')
    await expect(incidentTab).toBeVisible()
    await incidentTab.click()
    await expect(page.getByTestId('incident-card').first()).toBeVisible({ timeout: 8000 })

    const firstIncident = page.getByTestId('incident-card').first()
    await firstIncident.click()
    const incidentDetail = page.getByTestId('incident-detail')
    await expect(incidentDetail).toBeVisible({ timeout: 5000 })
    await expect(incidentDetail.getByTestId('incident-delete-btn')).not.toBeVisible()
  })
})
