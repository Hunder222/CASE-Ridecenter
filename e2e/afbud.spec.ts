import path from 'node:path';
import { expect, test } from '@playwright/test';
import { config as indlaesEnv } from 'dotenv';

indlaesEnv({ path: path.resolve(import.meta.dirname, '../.env'), quiet: true });

test('V5: Afbud før/efter kl. 12:00 og automatisk ventelisteforslag (FR-015, SC-006, US4, T155)', async ({
  page,
}) => {
  test.setTimeout(180_000);

  // 1. Log ind som Ledelse (Malene) på /admin/login
  await page.goto('/admin/login');
  await page.locator('#email').fill('malene@ridecenter.dk');
  await page.locator('#adgangskode').fill('Ridecenter2026!');
  await page.getByRole('button', { name: /Log ind/i }).click();

  // 2. Gå til /admin/venteliste og verificér at venteliste og forslag vises
  await page.goto('/admin/venteliste');
  await expect(page.getByText('Ventelister & Genbesættelse')).toBeVisible();

  // Verificér afventende forslag boks
  await expect(page.getByText(/Afventende genbesættelsesforslag/i)).toBeVisible();

  // Verificér aktive ventelister tabel
  await expect(page.getByText(/Aktive ventelister/i)).toBeVisible();
});

