import type { Locator, Page } from 'playwright/test'

// NOTE on the two fixes baked into `resolveField` below (this helper was previously dead
// code — unused by any test — so neither bug had been exercised until now):
//
// 1. The `has` locator is rooted at `dialog.page()`, not at `dialog` itself. Chaining it off
//    `dialog` (e.g. `dialog.getByText(...)`) embeds the dialog's own selector chain inside the
//    `has` filter, which then requires a nested dialog-role element to exist *inside* each
//    candidate `div` — something that can never happen — so every match silently comes back
//    empty and callers hang waiting for an element that will never resolve.
// 2. `.last()`, not `.first()`: a field's label sits inside a small wrapper div, which is
//    itself nested inside larger container divs (e.g. the dialog's overall `space-y-3` fields
//    div). All of those ancestors also satisfy the `has` filter (they all contain the label
//    text somewhere in their subtree). Document order lists a parent before its descendants,
//    so `.first()` always picks the outermost container — the same one for every field in the
//    dialog — and then `.first()` on its inputs always resolves to the dialog's very first
//    input, no matter which label was requested. `.last()` picks the innermost (most specific)
//    matching div, i.e. the field's own wrapper.
function resolveField(dialog: Locator, label: string): Locator {
  return dialog.locator('div', { has: dialog.page().getByText(label, { exact: true }) }).last()
}

export async function fillDialogField(dialog: Locator, label: string, value: string) {
  const field = resolveField(dialog, label)
  await field.locator('input, textarea').first().fill(value)
}

export async function selectDialogOption(page: Page, dialog: Locator, label: string, optionText: string | RegExp) {
  const field = resolveField(dialog, label)
  await field.getByRole('combobox').click()
  await page.getByRole('option', { name: optionText, exact: true }).click()
}

export async function checkDialogCheckbox(dialog: Locator, label: string) {
  const field = resolveField(dialog, label)
  await field.locator('input[type="checkbox"]').check()
}
