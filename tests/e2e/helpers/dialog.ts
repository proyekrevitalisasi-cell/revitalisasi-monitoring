import type { Locator, Page } from 'playwright/test'

export async function fillDialogField(dialog: Locator, label: string, value: string) {
  const field = dialog.locator('div', { has: dialog.getByText(label, { exact: true }) }).first()
  await field.locator('input, textarea').first().fill(value)
}

export async function selectDialogOption(page: Page, dialog: Locator, label: string, optionText: string) {
  const field = dialog.locator('div', { has: dialog.getByText(label, { exact: true }) }).first()
  await field.getByRole('combobox').click()
  await page.getByRole('option', { name: optionText, exact: true }).click()
}

export async function checkDialogCheckbox(dialog: Locator, label: string) {
  const field = dialog.locator('div', { has: dialog.getByText(label, { exact: true }) }).first()
  await field.locator('input[type="checkbox"]').check()
}
