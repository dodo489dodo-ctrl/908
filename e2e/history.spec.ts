import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const ALLOWED = process.env.E2E_ALLOW === '1'
const SUPA_URL = process.env.E2E_SUPABASE_URL!
const SUPA_ANON = process.env.E2E_SUPABASE_ANON_KEY!
const ADMIN_LOGIN = process.env.E2E_ADMIN_LOGIN!
const ADMIN_PW = process.env.E2E_ADMIN_PASSWORD!
const SV_LOGIN = process.env.E2E_SV_LOGIN!
const SV_PW = process.env.E2E_SV_PASSWORD!
const QR_APARTMENT_ID = process.env.E2E_QR_APARTMENT_ID!

test.skip(!ALLOWED, 'E2E_ALLOW=1 required')

async function login(page: Page, login: string, password: string) {
  await page.goto('/')
  await page.fill('input[type="text"]', login)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
}

async function adminClient() {
  const c = createClient(SUPA_URL, SUPA_ANON)
  const email = `${ADMIN_LOGIN.toLowerCase().trim()}@sklad.internal`
  const { error } = await c.auth.signInWithPassword({ email, password: ADMIN_PW })
  if (error) throw error
  return c
}

async function createCleaning(c: ReturnType<typeof createClient>, apartmentId: number, note: string) {
  const adminId = (await c.auth.getUser()).data.user!.id
  const cleanedAt = new Date().toISOString()
  const clientOpId = `e2e-delete-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const { error } = await c.rpc('complete_cleaning', {
    p_apartment_id: apartmentId,
    p_cleaned_at: cleanedAt,
    p_client_op_id: clientOpId,
    p_staff_ids: [],
    p_lead_staff_id: null,
    p_note: note,
  })
  if (error) throw error
  return { clientOpId, adminId }
}

async function gotoHistory(page: Page) {
  await page.goto('/admin/more/history')
  await expect(page.getByTestId('history-filters')).toBeVisible({ timeout: 15000 })
}

test.describe('History', () => {
  test('admin can open history page', async ({ page }) => {
    await login(page, ADMIN_LOGIN, ADMIN_PW)
    await page.waitForURL('**/admin', { timeout: 15000 })
    await gotoHistory(page)
    await expect(page.getByTestId('history-filters')).toBeVisible({ timeout: 10000 })
  })

  test('search filters by text', async ({ page }) => {
    await login(page, ADMIN_LOGIN, ADMIN_PW)
    await page.waitForURL('**/admin', { timeout: 15000 })
    await gotoHistory(page)

    const toggle = page.getByTestId('filters-toggle')
    await expect(toggle).toBeVisible()
    await toggle.click()

    const searchInput = page.getByTestId('search-input')
    await expect(searchInput).toBeVisible({ timeout: 5000 })
    await searchInput.fill('zzz-no-match-xyz')
    await expect(page.getByTestId('cleaning-card')).toHaveCount(0, { timeout: 8000 })
  })

  test('date filter narrows results', async ({ page }) => {
    await login(page, ADMIN_LOGIN, ADMIN_PW)
    await page.waitForURL('**/admin', { timeout: 15000 })
    await gotoHistory(page)

    const toggle = page.getByTestId('filters-toggle')
    await expect(toggle).toBeVisible()
    await toggle.click()

    const dateFrom = page.getByTestId('date-from')
    await expect(dateFrom).toBeVisible({ timeout: 5000 })
    await dateFrom.fill('2099-01-01')
    await expect(page.getByTestId('cleaning-card')).toHaveCount(0, { timeout: 8000 })
  })

  test('admin can open a cleaning card and delete with reason', async ({ page }) => {
    const c = await adminClient()
    const aptId = Number(QR_APARTMENT_ID)
    const uniqueNote = `e2e-delete-${Date.now()}`
    const { clientOpId } = await createCleaning(c, aptId, uniqueNote)

    await login(page, ADMIN_LOGIN, ADMIN_PW)
    await page.waitForURL('**/admin', { timeout: 15000 })
    await gotoHistory(page)

    const toggle = page.getByTestId('filters-toggle')
    await expect(toggle).toBeVisible()
    await toggle.click()

    const searchInput = page.getByTestId('search-input')
    await expect(searchInput).toBeVisible({ timeout: 5000 })
    await searchInput.fill(uniqueNote)
    await expect(page.getByTestId('cleaning-card')).toHaveCount(1, { timeout: 10000 })

    const card = page.getByTestId('cleaning-card').first()
    await card.click()

    const detail = page.getByTestId('cleaning-detail')
    await expect(detail).toBeVisible({ timeout: 5000 })

    const deleteBtn = detail.getByTestId('cleaning-delete-btn')
    await expect(deleteBtn).toBeVisible({ timeout: 3000 })
    await deleteBtn.click()

    const reasonField = page.getByTestId('delete-reason')
    await expect(reasonField).toBeVisible({ timeout: 3000 })
    await reasonField.fill('e2e test deletion')

    const confirmDelete = page.getByTestId('confirm-delete')
    await expect(confirmDelete).toBeVisible()
    await confirmDelete.click()

    await expect(page.getByTestId('cleaning-card')).toHaveCount(0, { timeout: 10000 })

    void clientOpId
  })

  test('supervisor has no delete button', async ({ page }) => {
    await login(page, SV_LOGIN, SV_PW)
    await page.waitForURL(/\/(admin|sv)$/, { timeout: 15000 })
    await page.goto('/sv')
    await page.waitForTimeout(2000)

    const cardButton = page.locator('button.w-full.text-left.bg-surface').first()
    await expect(cardButton).toBeVisible({ timeout: 8000 })
    await cardButton.click()

    const detailSheet = page.locator('aside.fixed.top-0.right-0').first()
    await expect(detailSheet).toBeVisible({ timeout: 5000 })
    const deleteBtn = page.locator('button:has-text("Удалить")')
    await expect(deleteBtn).not.toBeVisible()
  })
})
